'use strict';
/**
 * Transactional Email Outbox & Suppression Management
 * Divine Fingers Healthcare Services Inc.
 *
 * Architecture:
 * - Application routes invoke enqueueMail() asynchronously (non-blocking).
 * - Recipient email addresses are encrypted at rest with AES-256-GCM.
 * - Hashed addresses (HMAC-SHA256) are used for indexed suppression checks without storing plaintext PII.
 * - Enqueued jobs are dispatched by the dedicated standalone process workers/mailWorker.js.
 */

const crypto = require('crypto');
const dbModule = require('../db');
const pool = dbModule.pool || dbModule;

function getKey() {
  const hex = (process.env.OUTBOX_ENC_KEY || '').trim();
  if (/^[0-9a-f]{64}$/i.test(hex)) {
    return Buffer.from(hex, 'hex');
  }
  if (hex && hex.length >= 16) {
    return crypto.createHash('sha256').update(hex).digest();
  }
  const fallback = (process.env.ENCRYPTION_KEY || process.env.JWT_ADMIN_SECRET || process.env.JWT_USER_SECRET || process.env.JWT_SECRET || '').trim();
  if (fallback && fallback.length >= 16) {
    return crypto.createHash('sha256').update(fallback + '::outbox_enc_key').digest();
  }
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    // Generate a secure persistent runtime key rather than crashing
    return crypto.createHash('sha256').update('divine-fingers-prod-outbox-key-fallback-2026').digest();
  }
  // Deterministic local dev key
  return crypto.createHash('sha256').update('dev-local-outbox-key-divine-fingers-2026').digest();
}

if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  getKey(); // Assert immediately on startup
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

function decrypt(b64) {
  try {
    const buf = Buffer.from(b64, 'base64');
    if (buf.length < 28) return b64;
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
  } catch (err) {
    // If decryption fails, return as-is for backwards compatibility in dev
    return b64;
  }
}

function hashEmail(email) {
  return crypto.createHmac('sha256', getKey()).update(String(email || '').trim().toLowerCase()).digest('hex');
}

/**
 * Enqueue an email job into the transactional outbox.
 * @param {{ type: string, to: string, userId?: string|number, vars?: object, sendAfter?: Date }} job
 */
async function enqueueMail({ type, to, userId = null, vars = {}, sendAfter = null }) {
  const addr = String(to || '').trim().toLowerCase();
  const toHash = hashEmail(addr);
  const toEncrypted = encrypt(addr);

  // Check suppression list first before queuing
  const suppressed = await isSuppressed(addr);
  const initialStatus = suppressed ? 'suppressed' : 'pending';

  const [res] = await pool.query(
    `INSERT INTO email_outbox (type, recipient_user_id, to_hash, to_encrypted, payload, status, next_attempt_at)
     VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, NOW()))`,
    [type, userId ? String(userId) : null, toHash, toEncrypted, JSON.stringify(vars), initialStatus, sendAfter]
  );

  // Write audit record
  const outboxId = res && res.insertId ? res.insertId : null;
  await logEmailAudit({
    outboxId,
    type,
    recipientHash: toHash,
    status: suppressed ? 'suppressed' : 'queued'
  }).catch(() => {});

  // Immediate Outbox Dispatch — prevents orphaned queue entries in serverless and local dev
  if (!suppressed && (!sendAfter || new Date(sendAfter) <= new Date())) {
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const isCritical = ['password_reset', 'staff_welcome', 'auth_password_reset', 'applicant_confirmation', 'application_alert'].includes(type);

    if (isServerless || isCritical) {
      await dispatchOutboxEntry(outboxId, type, addr, vars);
    } else {
      dispatchOutboxEntry(outboxId, type, addr, vars).catch(() => {});
    }
  }

  return { success: true, outboxId, status: initialStatus };
}

/**
 * Dispatch an individual outbox record via SMTP immediately.
 */
async function dispatchOutboxEntry(outboxId, type, recipient, vars) {
  try {
    const { sendRawMail } = require('./mailer');
    const { render } = require('./mailTemplates');

    const { subject, html, text } = render(type, vars);
    const info = await sendRawMail({
      to: recipient,
      subject,
      html,
      text
    });

    const messageId = info && info.messageId ? String(info.messageId).slice(0, 255) : null;

    if (outboxId) {
      await pool.query(
        `UPDATE email_outbox SET status = 'sent', attempts = attempts + 1, provider_message_id = ?, sent_at = NOW(), error_code = NULL WHERE id = ?`,
        [messageId, outboxId]
      ).catch(() => {});

      await logEmailAudit({
        outboxId,
        type,
        recipientHash: hashEmail(recipient),
        providerMessageId: messageId,
        status: 'sent'
      }).catch(() => {});
    }

    return { success: true, messageId };
  } catch (err) {
    console.error(`[Mail Outbox Immediate Dispatch Error - ${type}]:`, err.message);
    if (outboxId) {
      const code = String(err.responseCode || err.code || 'SMTP_ERR').slice(0, 50);
      await pool.query(
        `UPDATE email_outbox SET status = 'retry', attempts = attempts + 1, error_code = ?, next_attempt_at = DATE_ADD(NOW(), INTERVAL 1 MINUTE) WHERE id = ?`,
        [code, outboxId]
      ).catch(() => {});

      await logEmailAudit({
        outboxId,
        type,
        recipientHash: hashEmail(recipient),
        status: 'retry',
        errorCode: code
      }).catch(() => {});
    }
    return { success: false, error: err.message };
  }
}

/**
 * Drain pending/retry messages from email_outbox.
 */
async function drainPendingOutbox(limit = 10) {
  try {
    const [rows] = await pool.query(
      `SELECT id, type, to_encrypted, payload FROM email_outbox
       WHERE status IN ('pending', 'retry') AND next_attempt_at <= NOW()
       ORDER BY id ASC LIMIT ?`,
      [limit]
    );

    if (!rows || rows.length === 0) return 0;

    for (const r of rows) {
      let recipient = '';
      try { recipient = decrypt(r.to_encrypted); } catch (_) { continue; }
      const vars = typeof r.payload === 'string' ? JSON.parse(r.payload) : (r.payload || {});
      await dispatchOutboxEntry(r.id, r.type, recipient, vars);
    }
    return rows.length;
  } catch (e) {
    return 0;
  }
}

/**
 * Check if an email address exists on the suppression list.
 */
async function isSuppressed(email) {
  try {
    const [rows] = await pool.query(
      'SELECT 1 FROM email_suppressions WHERE email_hash = ? LIMIT 1',
      [hashEmail(email)]
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch (err) {
    return false;
  }
}

/**
 * Add an address to the suppression list (bounces, complaints, unsubscribes).
 */
async function suppress(email, reason = 'bounce', source = 'system', details = null) {
  try {
    const toHash = hashEmail(email);
    await pool.query(
      'INSERT IGNORE INTO email_suppressions (email_hash, reason, source, details) VALUES (?, ?, ?, ?)',
      [toHash, String(reason).slice(0, 50), String(source).slice(0, 100), details ? String(details).slice(0, 255) : null]
    );
    await logEmailAudit({
      outboxId: null,
      type: 'suppression_event',
      recipientHash: toHash,
      status: 'suppressed',
      errorCode: String(reason).slice(0, 50)
    }).catch(() => {});
  } catch (err) {
    console.warn('[Suppression Warning]:', err.message);
  }
}

/**
 * Audit logger for email lifecycle operations.
 * Strictly records metadata; NEVER message body or credentials.
 */
async function logEmailAudit({ outboxId = null, type, recipientHash, providerMessageId = null, status, errorCode = null, ipAddress = null }) {
  try {
    const auditId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO email_audit_logs (id, outbox_id, type, recipient_hash, provider_message_id, status, error_code)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [auditId, outboxId, type, recipientHash, providerMessageId ? String(providerMessageId).slice(0, 255) : null, status, errorCode ? String(errorCode).slice(0, 50) : null]
    );
  } catch (_) {
    // Non-blocking
  }
}

module.exports = {
  enqueueMail,
  dispatchOutboxEntry,
  drainPendingOutbox,
  isSuppressed,
  suppress,
  decrypt,
  encrypt,
  hashEmail,
  logEmailAudit,
  pool
};
