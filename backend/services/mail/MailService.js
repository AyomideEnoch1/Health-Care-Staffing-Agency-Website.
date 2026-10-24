'use strict';
const crypto = require('crypto');
const pool = require('../../db');
const { compileTemplate, interpolate, validateVariables, htmlToPlainText } = require('./templateEngine');
const ConsoleLogAdapter = require('./adapters/ConsoleLogAdapter');
const SmtpAdapter = require('./adapters/SmtpAdapter');
const ResendAdapter = require('./adapters/ResendAdapter');
const BrevoAdapter = require('./adapters/BrevoAdapter');

class MailService {
  constructor() {
    this.consoleAdapter = new ConsoleLogAdapter();
    this.smtpAdapter = new SmtpAdapter();
    this.resendAdapter = new ResendAdapter();
    this.brevoAdapter = new BrevoAdapter();
    this.workerTimer = null;
    this.isDispatching = false;

    // Cache templates in memory for 60 seconds to avoid DB pounding
    this.templateCache = new Map();
    this.cacheTtlMs = 60 * 1000;
  }

  /**
   * Determine active adapter based on environment or fallback
   */
  getAdapter() {
    const driver = (process.env.MAIL_DRIVER || '').toLowerCase().trim();
    if (driver === 'console') {
      return this.consoleAdapter;
    }
    if (driver === 'resend' || (process.env.RESEND_API_KEY && !driver)) {
      return this.resendAdapter;
    }
    if (driver === 'brevo' || (process.env.BREVO_API_KEY && !driver)) {
      return this.brevoAdapter;
    }
    if (driver === 'https') {
      if (process.env.RESEND_API_KEY) return this.resendAdapter;
      if (process.env.BREVO_API_KEY) return this.brevoAdapter;
    }
    if (process.env.RESEND_API_KEY) {
      return this.resendAdapter;
    }
    if (process.env.BREVO_API_KEY) {
      return this.brevoAdapter;
    }
    return this.smtpAdapter;
  }

  /**
   * Clear template cache
   */
  clearCache(templateKey = null) {
    if (templateKey) {
      this.templateCache.delete(templateKey);
    } else {
      this.templateCache.clear();
    }
  }

  /**
   * Retrieve active template by key
   */
  async getTemplate(templateKey) {
    const cached = this.templateCache.get(templateKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp < this.cacheTtlMs)) {
      return cached.template;
    }

    const [rows] = await pool.query(
      'SELECT * FROM email_templates WHERE template_key = ? AND is_active = 1 LIMIT 1',
      [templateKey]
    );

    if (rows.length === 0) {
      throw new Error(`Email template '${templateKey}' not found or inactive`);
    }

    const template = rows[0];
    if (typeof template.required_vars === 'string') {
      try { template.required_vars = JSON.parse(template.required_vars); } catch { template.required_vars = []; }
    }
    if (typeof template.sample_vars === 'string') {
      try { template.sample_vars = JSON.parse(template.sample_vars); } catch { template.sample_vars = {}; }
    }

    this.templateCache.set(templateKey, { template, timestamp: now });
    return template;
  }

  /**
   * Central dispatch method
   * @param {string} templateKey Template identifier
   * @param {object} options { to, data, idempotencyKey, userId, recipientType, attachments, replyTo }
   */
  async send(templateKey, options = {}) {
    const {
      to,
      data = {},
      idempotencyKey = null,
      userId = null,
      recipientType = 'visitor',
      replyTo = null
    } = options;

    if (!to || typeof to !== 'string') {
      throw new Error('Valid recipient email (to) is required');
    }

    // 1. Idempotency Check
    if (idempotencyKey) {
      const [existing] = await pool.query(
        'SELECT id, template_key, recipient_email, status, provider_message_id FROM email_logs WHERE idempotency_key = ? LIMIT 1',
        [idempotencyKey]
      );
      if (existing.length > 0) {
        const item = existing[0];
        console.log(`[MailService] Idempotent duplicate suppressed for key: ${idempotencyKey} (Status: ${item.status})`);
        return {
          id: item.id,
          templateKey: item.template_key,
          recipient: item.recipient_email,
          status: item.status,
          duplicate: true
        };
      }
    }

    // 2. Fetch and Validate Template
    const template = await this.getTemplate(templateKey);
    const requiredVars = template.required_vars || [];
    const validation = validateVariables(requiredVars, data);

    if (!validation.isValid) {
      throw new Error(`Template '${templateKey}' missing required variables: ${validation.missing.join(', ')}`);
    }

    // 3. Compile Content
    const renderedSubject = interpolate(template.subject, data);
    const renderedHtml = compileTemplate(template.body_html, data, { preheader: renderedSubject });
    const renderedText = template.body_text
      ? interpolate(template.body_text, data)
      : htmlToPlainText(renderedHtml);

    // 4. Create Audit Log Record in 'queued' state
    const logId = crypto.randomUUID();
    const adapter = this.getAdapter();
    const providerName = adapter.name || 'smtp';

    const metadata = JSON.stringify({
      dataSummary: Object.keys(data),
      templateVersion: template.current_version,
      queuedAt: new Date().toISOString()
    });

    await pool.query(
      `INSERT INTO email_logs (
        id, template_key, recipient_email, recipient_user_id, recipient_type,
        subject, status, idempotency_key, provider, attempts, max_attempts, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?, 0, 5, ?)`,
      [
        logId,
        templateKey,
        to.trim().toLowerCase(),
        userId,
        recipientType,
        renderedSubject,
        idempotencyKey,
        providerName,
        metadata
      ]
    );

    // 5. Trigger Immediate Dispatch (synchronously in serverless/critical auth context to prevent freeze)
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const isCritical = ['auth_password_reset', 'staff_welcome', 'password_reset'].includes(templateKey);

    if (isServerless || isCritical) {
      try {
        await this.dispatchLog(logId, {
          to: to.trim().toLowerCase(),
          subject: renderedSubject,
          html: renderedHtml,
          text: renderedText,
          replyTo
        });
      } catch (err) {
        console.error(`[MailService] Immediate dispatch error for ${logId}:`, err.message);
      }
    } else {
      setImmediate(async () => {
        try {
          await this.dispatchLog(logId, {
            to: to.trim().toLowerCase(),
            subject: renderedSubject,
            html: renderedHtml,
            text: renderedText,
            replyTo
          });
        } catch (err) {
          console.error(`[MailService] Immediate dispatch error for ${logId}:`, err.message);
        }
      });
    }

    return {
      id: logId,
      templateKey,
      recipient: to,
      subject: renderedSubject,
      status: 'queued'
    };
  }

  /**
   * Internal worker execution for a specific log item
   */
  async dispatchLog(logId, payload) {
    const [rows] = await pool.query(
      'SELECT id, status, attempts, max_attempts FROM email_logs WHERE id = ? LIMIT 1',
      [logId]
    );
    if (rows.length === 0) return;

    const log = rows[0];
    if (['sent', 'delivered'].includes(log.status)) {
      return; // Already processed
    }

    const nextAttempt = log.attempts + 1;
    let chosenAdapter = this.getAdapter();

    await pool.query(
      'UPDATE email_logs SET status = "sending", attempts = ? WHERE id = ?',
      [nextAttempt, logId]
    );

    try {
      let result;
      try {
        result = await chosenAdapter.send({
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
          replyTo: payload.replyTo
        });
      } catch (adapterErr) {
        // In local development, if SMTP fails (e.g., Brevo IP whitelist or unreachable),
        // fallback smoothly to ConsoleLogAdapter to avoid halting developer flow
        if (process.env.NODE_ENV !== 'production' && chosenAdapter.name !== 'console') {
          console.warn(`[MailService] SMTP failed (${adapterErr.message}); falling back to ConsoleLogAdapter for dev preview.`);
          chosenAdapter = this.consoleAdapter;
          result = await chosenAdapter.send({
            to: payload.to,
            subject: payload.subject,
            html: payload.html,
            text: payload.text,
            replyTo: payload.replyTo
          });
        } else {
          throw adapterErr;
        }
      }

      await pool.query(
        `UPDATE email_logs SET
          status = "sent",
          provider = ?,
          provider_message_id = ?,
          sent_at = NOW(),
          error_message = NULL
        WHERE id = ?`,
        [chosenAdapter.name, result.messageId || null, logId]
      );
    } catch (err) {
      const isDeadLetter = nextAttempt >= log.max_attempts;
      const finalStatus = isDeadLetter ? 'failed' : 'queued';

      console.error(`[MailService] Delivery failed for log ${logId} (attempt ${nextAttempt}/${log.max_attempts}): ${err.message}`);

      await pool.query(
        `UPDATE email_logs SET
          status = ?,
          error_message = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [finalStatus, err.message, logId]
      );
    }
  }

  /**
   * Dispatch batch of emails
   */
  async sendBatch(templateKey, recipients = []) {
    const results = [];
    for (const item of recipients) {
      try {
        const res = await this.send(templateKey, item);
        results.push(res);
      } catch (err) {
        results.push({
          error: err.message,
          recipient: item.to,
          status: 'failed'
        });
      }
    }
    return results;
  }

  /**
   * Sweep and dispatch any queued or retryable logs (Queue Worker Daemon)
   */
  async dispatchPending(limit = 20) {
    if (this.isDispatching) return;
    this.isDispatching = true;

    try {
      const [logs] = await pool.query(
        `SELECT l.id, l.template_key, l.recipient_email, l.subject, l.attempts, l.max_attempts,
                t.body_html, t.body_text
         FROM email_logs l
         LEFT JOIN email_templates t ON l.template_key = t.template_key
         WHERE l.status = 'queued' AND l.attempts < l.max_attempts
         ORDER BY l.created_at ASC
         LIMIT ?`,
        [limit]
      );

      for (const log of logs) {
        if (!log.body_html) continue;
        const html = compileTemplate(log.body_html, {}, { preheader: log.subject });
        const text = log.body_text || htmlToPlainText(html);

        await this.dispatchLog(log.id, {
          to: log.recipient_email,
          subject: log.subject,
          html,
          text
        });
      }
    } catch (err) {
      console.error('[MailService] Queue worker sweep error:', err.message);
    } finally {
      this.isDispatching = false;
    }
  }

  /**
   * Render HTML and plain text preview with sample data
   */
  async renderPreview(templateKey, sampleData = {}) {
    const template = await this.getTemplate(templateKey);
    const data = Object.assign({}, template.sample_vars || {}, sampleData);
    const subject = interpolate(template.subject, data);
    const html = compileTemplate(template.body_html, data, { preheader: subject });
    const text = template.body_text
      ? interpolate(template.body_text, data)
      : htmlToPlainText(html);

    return {
      templateKey,
      name: template.name,
      category: template.category,
      subject,
      html,
      text,
      required_vars: template.required_vars,
      sample_vars: template.sample_vars,
      current_version: template.current_version
    };
  }

  /**
   * Roll back template to a historical version
   */
  async rollbackTemplate(templateKey, targetVersion, adminUser = 'admin') {
    const [versions] = await pool.query(
      `SELECT * FROM email_template_versions
       WHERE template_key = ? AND version = ? LIMIT 1`,
      [templateKey, targetVersion]
    );

    if (versions.length === 0) {
      throw new Error(`Version ${targetVersion} not found for template '${templateKey}'`);
    }

    const v = versions[0];
    const [current] = await pool.query(
      'SELECT id, current_version FROM email_templates WHERE template_key = ? LIMIT 1',
      [templateKey]
    );

    if (current.length === 0) {
      throw new Error(`Template '${templateKey}' not found`);
    }

    const templateId = current[0].id;
    const newVersionNum = current[0].current_version + 1;

    // Update active template
    await pool.query(
      `UPDATE email_templates SET
        subject = ?,
        body_html = ?,
        body_text = ?,
        required_vars = ?,
        sample_vars = ?,
        current_version = ?,
        last_edited_by = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        v.subject,
        v.body_html,
        v.body_text,
        typeof v.required_vars === 'string' ? v.required_vars : JSON.stringify(v.required_vars),
        typeof v.sample_vars === 'string' ? v.sample_vars : JSON.stringify(v.sample_vars),
        newVersionNum,
        adminUser,
        templateId
      ]
    );

    // Record new version in versions table
    const newVersionId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO email_template_versions (
        id, template_id, template_key, version, subject, body_html, body_text,
        required_vars, sample_vars, change_summary, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newVersionId,
        templateId,
        templateKey,
        newVersionNum,
        v.subject,
        v.body_html,
        v.body_text,
        typeof v.required_vars === 'string' ? v.required_vars : JSON.stringify(v.required_vars),
        typeof v.sample_vars === 'string' ? v.sample_vars : JSON.stringify(v.sample_vars),
        `Rollback to version ${targetVersion}`,
        adminUser
      ]
    );

    this.clearCache(templateKey);

    return {
      success: true,
      templateKey,
      previousVersion: current[0].current_version,
      rolledBackTo: targetVersion,
      currentVersion: newVersionNum
    };
  }

  /**
   * Start embedded worker daemon
   */
  startWorkerDaemon(intervalMs = 10000) {
    if (this.workerTimer) return;
    console.log(`[MailService] Embedded queue worker daemon started (interval: ${intervalMs}ms)`);
    this.workerTimer = setInterval(() => {
      this.dispatchPending().catch(err => {
        console.error('[MailService] Daemon tick error:', err.message);
      });
    }, intervalMs);

    // Initial sweep
    this.dispatchPending().catch(() => {});
  }

  /**
   * Stop embedded worker daemon
   */
  stopWorkerDaemon() {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
      console.log('[MailService] Embedded queue worker daemon stopped');
    }
  }
}

// Export singleton instance
const mailService = new MailService();
module.exports = mailService;
