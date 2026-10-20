'use strict';
/**
 * Standalone Email Outbox Worker
 * Divine Fingers Healthcare Services Inc.
 *
 * Runs as an independent process (managed by systemd: app-mail-worker.service).
 * Uses MySQL transactions with `FOR UPDATE SKIP LOCKED` to enable safe multi-worker concurrency.
 * Strictly logs operational metadata (timestamps, IDs, status); never logs email content or PHI.
 */

require('dotenv').config();
const { sendRawMail, verifyConnection } = require('../utils/mailer');
const { render } = require('../utils/mailTemplates');
const { pool, decrypt, isSuppressed, logEmailAudit, hashEmail } = require('../utils/mailOutbox');

const POLL_MS = Number(process.env.MAIL_POLL_MS || 5000);
const BATCH = Number(process.env.MAIL_BATCH || 10);
const MAX_ATTEMPTS = Number(process.env.MAIL_MAX_ATTEMPTS || 6);

// Rate limits: Configured for Hostinger Business Mail / standard SMTP (typically 500-1500/day)
const MAX_PER_MIN = Number(process.env.MAIL_MAX_PER_MIN || 25);
const DAILY_CAP = Number(process.env.MAIL_DAILY_CAP || 1000);
const SEND_GAP_MS = Math.ceil(60000 / Math.max(1, MAX_PER_MIN));

let stopping = false;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const log = (payload) => console.log(JSON.stringify({ ts: new Date().toISOString(), svc: 'mail-worker', ...payload }));

// Exponential backoff in seconds: 1m, 2m, 4m, 8m, 16m, capped at 4h
const backoffSeconds = (attempt) => Math.min(60 * (2 ** (attempt - 1)), 4 * 3600);

async function claim(conn, limit = BATCH) {
  await conn.beginTransaction();
  const [rows] = await conn.query(
    `SELECT id, type, to_hash, to_encrypted, payload, attempts FROM email_outbox
     WHERE status IN ('pending', 'retry') AND next_attempt_at <= NOW()
     ORDER BY id ASC LIMIT ? FOR UPDATE SKIP LOCKED`,
    [limit]
  );

  if (rows && rows.length > 0) {
    const ids = rows.map((r) => r.id);
    await conn.query(`UPDATE email_outbox SET status = 'sending' WHERE id IN (?)`, [ids]);
  }
  await conn.commit();
  return rows || [];
}

async function processRow(row) {
  const attempt = row.attempts + 1;
  const toHash = row.to_hash;
  let recipient = '';

  try {
    recipient = decrypt(row.to_encrypted);
    
    // Check suppression list
    if (await isSuppressed(recipient)) {
      await pool.query(
        `UPDATE email_outbox SET status = 'suppressed', attempts = ? WHERE id = ?`,
        [attempt, row.id]
      );
      await logEmailAudit({
        outboxId: row.id,
        type: row.type,
        recipientHash: toHash,
        status: 'suppressed',
        errorCode: 'SUPPRESSED_ADDRESS'
      });
      return log({ id: row.id, type: row.type, status: 'suppressed' });
    }

    const vars = typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {});
    const { subject, html, text } = render(row.type, vars);

    const info = await sendRawMail({
      to: recipient,
      subject,
      html,
      text
    });

    const messageId = info && info.messageId ? String(info.messageId).slice(0, 255) : null;

    await pool.query(
      `UPDATE email_outbox SET status = 'sent', attempts = ?, provider_message_id = ?, sent_at = NOW(), error_code = NULL WHERE id = ?`,
      [attempt, messageId, row.id]
    );

    await logEmailAudit({
      outboxId: row.id,
      type: row.type,
      recipientHash: toHash,
      providerMessageId: messageId,
      status: 'sent'
    });

    log({ id: row.id, type: row.type, status: 'sent', messageId });
  } catch (err) {
    const permanent = attempt >= MAX_ATTEMPTS || /Invalid recipient|Unknown email template/i.test(err.message);
    const code = String(err.responseCode || err.code || 'SMTP_ERR').slice(0, 50);

    await pool.query(
      `UPDATE email_outbox SET status = ?, attempts = ?, error_code = ?,
       next_attempt_at = DATE_ADD(NOW(), INTERVAL ? SECOND) WHERE id = ?`,
      [permanent ? 'failed' : 'retry', attempt, code, backoffSeconds(attempt), row.id]
    );

    await logEmailAudit({
      outboxId: row.id,
      type: row.type,
      recipientHash: toHash,
      status: permanent ? 'failed' : 'retry',
      errorCode: code
    });

    log({ id: row.id, type: row.type, status: permanent ? 'failed' : 'retry', attempt, code, err: err.message });
  }
}

async function remainingToday() {
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS n FROM email_outbox WHERE status = 'sent' AND sent_at > (NOW() - INTERVAL 24 HOUR)`
    );
    const sentCount = rows && rows[0] ? Number(rows[0].n) : 0;
    return Math.max(0, DAILY_CAP - sentCount);
  } catch (err) {
    return DAILY_CAP;
  }
}

async function tick() {
  const left = await remainingToday();
  if (left <= 0) {
    log({ level: 'warn', msg: 'Daily dispatch cap reached; idling', cap: DAILY_CAP });
    await sleep(60000);
    return 0;
  }

  let rows = [];
  let conn = null;
  try {
    conn = await pool.getConnection();
    rows = await claim(conn, Math.min(BATCH, left));
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    log({ level: 'error', msg: 'Outbox claim transaction failed', error: err.message });
  } finally {
    if (conn) conn.release();
  }

  for (const row of rows) {
    if (stopping) break;
    await processRow(row);
    await sleep(SEND_GAP_MS);
  }

  return rows.length;
}

async function recoverStuckSendingRows() {
  try {
    await pool.query(
      `UPDATE email_outbox SET status = 'retry' WHERE status = 'sending' AND updated_at < (NOW() - INTERVAL 10 MINUTE)`
    );
  } catch (_) {}
}

(async () => {
  log({ msg: 'Starting Outbox Dispatch Worker' });
  try {
    await verifyConnection();
    log({ msg: 'SMTP connection verified successfully' });
  } catch (smtpErr) {
    log({ level: 'warn', msg: `SMTP connection verification notice: ${smtpErr.message}` });
  }

  let counter = 0;
  while (!stopping) {
    const processedCount = await tick();
    if (++counter % 60 === 0) {
      await recoverStuckSendingRows().catch(() => {});
    }
    if (!processedCount && !stopping) {
      await sleep(POLL_MS);
    }
  }

  log({ msg: 'Outbox Dispatch Worker stopped cleanly' });
})().catch((err) => {
  log({ level: 'fatal', msg: err.message, stack: err.stack });
  process.exit(1);
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    log({ msg: `Received ${sig}, terminating worker gracefully...` });
    stopping = true;
  });
}
