'use strict';
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db');
const { requireAdminAuth } = require('../middleware/auth');
const mailService = require('../services/mail/MailService');
const { htmlToPlainText, validateVariables } = require('../services/mail/templateEngine');

// Secure all admin mail endpoints
router.use(requireAdminAuth());

// ============================================================================
// 1. TEMPLATE MANAGEMENT
// ============================================================================

/**
 * GET /api/admin/mail/templates
 * List all email templates with category filtering & search
 */
router.get('/templates', async (req, res) => {
  try {
    const { category, is_active, search } = req.query;
    let query = `
      SELECT id, template_key, name, category, subject, is_active,
             current_version, locale, last_edited_by, created_at, updated_at
      FROM email_templates
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (is_active !== undefined) {
      query += ' AND is_active = ?';
      params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
    }
    if (search) {
      query += ' AND (template_key LIKE ? OR name LIKE ? OR subject LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    query += ' ORDER BY category ASC, name ASC';

    const [templates] = await pool.query(query, params);
    res.json({ success: true, count: templates.length, templates });
  } catch (err) {
    console.error('[AdminMail] List templates error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve email templates' });
  }
});

/**
 * GET /api/admin/mail/templates/:key
 * Retrieve single template with version history
 */
router.get('/templates/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM email_templates WHERE template_key = ? LIMIT 1',
      [key]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: `Template '${key}' not found` });
    }

    const template = rows[0];
    if (typeof template.required_vars === 'string') {
      try { template.required_vars = JSON.parse(template.required_vars); } catch { template.required_vars = []; }
    }
    if (typeof template.sample_vars === 'string') {
      try { template.sample_vars = JSON.parse(template.sample_vars); } catch { template.sample_vars = {}; }
    }

    // Retrieve version history
    const [versions] = await pool.query(
      `SELECT id, version, subject, change_summary, created_by, created_at
       FROM email_template_versions
       WHERE template_key = ?
       ORDER BY version DESC LIMIT 20`,
      [key]
    );

    res.json({
      success: true,
      template,
      versions
    });
  } catch (err) {
    console.error('[AdminMail] Get template error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve template details' });
  }
});

/**
 * PUT /api/admin/mail/templates/:key
 * Update template content & create new version
 */
router.put('/templates/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const {
      name,
      category,
      subject,
      body_html,
      body_text,
      required_vars,
      sample_vars,
      is_active,
      change_summary
    } = req.body;

    const [existing] = await pool.query(
      'SELECT id, current_version FROM email_templates WHERE template_key = ? LIMIT 1',
      [key]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: `Template '${key}' not found` });
    }

    const tpl = existing[0];
    const newVersion = tpl.current_version + 1;
    const adminUser = (req.admin && (req.admin.email || req.admin.name || req.admin.id)) || 'admin';
    const computedText = body_text || (body_html ? htmlToPlainText(body_html) : '');

    const reqVarsJson = required_vars ? JSON.stringify(required_vars) : null;
    const sampleVarsJson = sample_vars ? JSON.stringify(sample_vars) : null;

    // 1. Update active template record
    await pool.query(
      `UPDATE email_templates SET
        name = COALESCE(?, name),
        category = COALESCE(?, category),
        subject = COALESCE(?, subject),
        body_html = COALESCE(?, body_html),
        body_text = COALESCE(?, body_text),
        required_vars = COALESCE(?, required_vars),
        sample_vars = COALESCE(?, sample_vars),
        is_active = COALESCE(?, is_active),
        current_version = ?,
        last_edited_by = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        name,
        category,
        subject,
        body_html,
        computedText,
        reqVarsJson,
        sampleVarsJson,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        newVersion,
        adminUser,
        tpl.id
      ]
    );

    // 2. Insert new version record
    const versionId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO email_template_versions (
        id, template_id, template_key, version, subject, body_html, body_text,
        required_vars, sample_vars, change_summary, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        versionId,
        tpl.id,
        key,
        newVersion,
        subject || '',
        body_html || '',
        computedText,
        reqVarsJson,
        sampleVarsJson,
        change_summary || 'Updated via Admin Console',
        adminUser
      ]
    );

    // Invalidate cached template
    mailService.clearCache(key);

    res.json({
      success: true,
      message: `Template '${key}' successfully updated to version ${newVersion}`,
      version: newVersion
    });
  } catch (err) {
    console.error('[AdminMail] Update template error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to update template' });
  }
});

/**
 * POST /api/admin/mail/templates/:key/rollback
 * Revert template to a previous version
 */
router.post('/templates/:key/rollback', async (req, res) => {
  try {
    const { key } = req.params;
    const { version } = req.body;

    if (!version || isNaN(parseInt(version, 10))) {
      return res.status(400).json({ success: false, error: 'Valid target version number is required' });
    }

    const adminUser = (req.admin && (req.admin.email || req.admin.name)) || 'admin';
    const result = await mailService.rollbackTemplate(key, parseInt(version, 10), adminUser);

    res.json({
      success: true,
      message: `Template '${key}' successfully rolled back to version ${version}. Now at version ${result.currentVersion}.`,
      ...result
    });
  } catch (err) {
    console.error('[AdminMail] Rollback template error:', err);
    res.status(400).json({ success: false, error: err.message || 'Failed to roll back template' });
  }
});

/**
 * POST /api/admin/mail/templates/:key/preview
 * Generate live rendered preview with sample variables
 */
router.post('/templates/:key/preview', async (req, res) => {
  try {
    const { key } = req.params;
    const { sampleData } = req.body;

    const preview = await mailService.renderPreview(key, sampleData || {});
    res.json({ success: true, preview });
  } catch (err) {
    console.error('[AdminMail] Preview error:', err);
    res.status(400).json({ success: false, error: err.message || 'Failed to generate preview' });
  }
});

/**
 * POST /api/admin/mail/templates/:key/test-send
 * Send test email to administrator
 */
router.post('/templates/:key/test-send', async (req, res) => {
  try {
    const { key } = req.params;
    const targetEmail = req.body.to || (req.admin && req.admin.email) || process.env.AGENCY_ALERT_EMAIL;

    if (!targetEmail || !targetEmail.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid destination email is required for test send' });
    }

    const template = await mailService.getTemplate(key);
    const data = Object.assign({}, template.sample_vars || {}, req.body.data || {});

    const result = await mailService.send(key, {
      to: targetEmail,
      data,
      recipientType: 'admin'
    });

    res.json({
      success: true,
      message: `Test email for template '${key}' dispatched to ${targetEmail}`,
      logId: result.id,
      status: result.status
    });
  } catch (err) {
    console.error('[AdminMail] Test send error:', err);
    res.status(400).json({ success: false, error: err.message || 'Failed to dispatch test email' });
  }
});

// ============================================================================
// 2. AUDIT LOGS & TRACEABILITY
// ============================================================================

/**
 * GET /api/admin/mail/logs
 * Query paged audit logs with filtering
 */
router.get('/logs', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '25', 10)));
    const offset = (page - 1) * limit;

    const { status, template_key, recipient, recipient_type } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    if (template_key) {
      whereClause += ' AND template_key = ?';
      params.push(template_key);
    }
    if (recipient) {
      whereClause += ' AND recipient_email LIKE ?';
      params.push(`%${recipient}%`);
    }
    if (recipient_type) {
      whereClause += ' AND recipient_type = ?';
      params.push(recipient_type);
    }

    const countSql = `SELECT COUNT(*) AS total FROM email_logs ${whereClause}`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0].total;

    const listSql = `
      SELECT id, template_key, recipient_email, recipient_type, subject,
             status, provider, provider_message_id, attempts, max_attempts,
             error_message, sent_at, delivered_at, opened_at, created_at, updated_at
      FROM email_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [logs] = await pool.query(listSql, [...params, limit, offset]);

    res.json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      logs
    });
  } catch (err) {
    console.error('[AdminMail] Logs error:', err);
    res.status(500).json({ success: false, error: 'Failed to query email logs' });
  }
});

/**
 * GET /api/admin/mail/logs/:id
 * Single log item inspection
 */
router.get('/logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM email_logs WHERE id = ? LIMIT 1', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Log entry not found' });
    }

    const item = rows[0];
    if (typeof item.metadata === 'string') {
      try { item.metadata = JSON.parse(item.metadata); } catch {}
    }

    res.json({ success: true, log: item });
  } catch (err) {
    console.error('[AdminMail] Get log item error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve log details' });
  }
});

/**
 * POST /api/admin/mail/logs/:id/retry
 * Re-queue a failed email for retry
 */
router.post('/logs/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM email_logs WHERE id = ? LIMIT 1', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Log entry not found' });
    }

    await pool.query(
      'UPDATE email_logs SET status = "queued", attempts = 0, error_message = NULL, updated_at = NOW() WHERE id = ?',
      [id]
    );

    setImmediate(() => {
      mailService.dispatchPending().catch(() => {});
    });

    res.json({ success: true, message: `Email ${id} re-queued for transmission` });
  } catch (err) {
    console.error('[AdminMail] Retry log error:', err);
    res.status(500).json({ success: false, error: 'Failed to re-queue email' });
  }
});

// ============================================================================
// 3. AGGREGATE SYSTEM METRICS
// ============================================================================

/**
 * GET /api/admin/mail/stats
 * Overview dashboard metrics
 */
router.get('/stats', async (req, res) => {
  try {
    const [statusRows] = await pool.query(`
      SELECT status, COUNT(*) AS count
      FROM email_logs
      GROUP BY status
    `);

    const stats = {
      total: 0,
      sent: 0,
      delivered: 0,
      queued: 0,
      sending: 0,
      failed: 0,
      bounced: 0,
      complained: 0,
      opened: 0,
      clicked: 0
    };

    statusRows.forEach(r => {
      if (stats[r.status] !== undefined) {
        stats[r.status] = r.count;
      }
      stats.total += r.count;
    });

    const [tplCount] = await pool.query('SELECT COUNT(*) AS total FROM email_templates WHERE is_active = 1');
    stats.activeTemplates = tplCount[0].total;

    res.json({ success: true, stats });
  } catch (err) {
    console.error('[AdminMail] Stats error:', err);
    res.status(500).json({ success: false, error: 'Failed to compute mail stats' });
  }
});

module.exports = router;
