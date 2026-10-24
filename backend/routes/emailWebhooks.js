'use strict';
/**
 * Email Webhook Endpoint — Bounce, Complaint & Suppression Processing
 * Divine Fingers Healthcare Services Inc.
 *
 * Verifies cryptographic webhook signatures (HMAC-SHA256) to prevent spoofing.
 * On hard bounce or complaint events, records the recipient hash into email_suppressions.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { suppress, hashEmail, logEmailAudit } = require('../utils/mailOutbox');

/**
 * Signature verification middleware for incoming email delivery webhooks.
 */
function verifyWebhookSignature(req, res, next) {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  const signatureHeader = req.headers['x-webhook-signature'] || 
                          req.headers['x-signature-sha256'] || 
                          req.headers['x-hostinger-signature'];

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Webhook Security Error] EMAIL_WEBHOOK_SECRET is not configured in production.');
      return res.status(500).json({ error: 'Webhook configuration error' });
    }
    console.warn('[Webhook Notice] Skipping signature verification in development (EMAIL_WEBHOOK_SECRET unset)');
    return next();
  }

  if (!signatureHeader) {
    return res.status(401).json({ error: 'Missing webhook signature header' });
  }

  try {
    // Expected signature: hex digest of HMAC-SHA256 over raw/serialized body
    const rawPayload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const expectedSig = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');

    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    const providedBuf = Buffer.from(signatureHeader, 'utf8');

    if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Signature verification failure' });
  }
}

// POST /api/webhooks/email — Ingest delivery event callbacks
router.post('/', express.json(), verifyWebhookSignature, async (req, res) => {
  try {
    const event = req.body || {};
    const eventType = String(event.event || event.type || '').toLowerCase();
    const email = event.email || (event.recipient ? event.recipient : null);
    const reason = event.reason || event.description || eventType;

    if (!email) {
      return res.status(400).json({ error: 'Missing recipient email in webhook payload' });
    }

    const isSuppressive = ['bounce', 'hard_bounce', 'complaint', 'spam', 'unsubscribe'].some(t => eventType.includes(t));

    if (isSuppressive) {
      await suppress(
        email,
        eventType.includes('complaint') ? 'complaint' : (eventType.includes('unsubscribe') ? 'unsubscribe' : 'bounce'),
        'provider_webhook',
        reason
      );
      console.log(`[Suppression Recorded] ${eventType} for hash ${hashEmail(email)}`);
    }

    res.status(200).json({ received: true, suppressed: isSuppressive });
  } catch (err) {
    console.error('[Email Webhook Error]:', err.message);
    res.status(500).json({ error: 'Failed to process webhook event' });
  }
});

module.exports = router;
module.exports.verifyWebhookSignature = verifyWebhookSignature;
