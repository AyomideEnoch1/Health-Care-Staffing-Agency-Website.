const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { z } = require('zod');
const pool = require('../db');
const { publicFormLimiter } = require('../middleware/rateLimiter');
const adminEvents = require('../utils/events');
const { enqueueMail } = require('../utils/mailOutbox');

const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(191),
  phone: z.string().trim().max(30).optional(),
  inquiry_type: z.string().trim().max(80).optional(),
  message: z.string().trim().min(5).max(3000),
  // Honeypot fields (hidden in frontend form)
  _hp_company: z.string().optional(),
  website: z.string().optional(),
  // Cloudflare Turnstile token
  'cf-turnstile-response': z.string().optional(),
  turnstile_token: z.string().optional()
});

/**
 * Server-side verification for Cloudflare Turnstile CAPTCHA.
 */
async function verifyCloudflareTurnstile(token, ip) {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️ [Turnstile Notice] CLOUDFLARE_TURNSTILE_SECRET_KEY unset in production; skipping bot verification.');
    }
    return true;
  }

  if (!token) return false;

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secret);
    formData.append('response', token);
    if (ip) formData.append('remoteip', ip);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const data = await res.json();
    return Boolean(data.success);
  } catch (err) {
    console.error('[Turnstile Verification Error]:', err.message);
    return false;
  }
}

router.post('/', publicFormLimiter, async (req, res, next) => {
  try {
    const validated = contactSchema.parse(req.body);

    // 1. Honeypot verification: Silently drop bots that populate honeypot fields
    if (validated._hp_company || validated.website) {
      console.warn(`[Bot Defense] Honeypot triggered from IP ${req.ip}`);
      // Return identical success response so bot does not retry
      return res.status(201).json({
        success: true,
        message: 'Thank you for contacting Divine Fingers. A care coordinator will reach out promptly.'
      });
    }

    // 2. Cloudflare Turnstile verification
    const turnstileToken = validated['cf-turnstile-response'] || validated.turnstile_token;
    const isHuman = await verifyCloudflareTurnstile(turnstileToken, req.ip);
    if (!isHuman) {
      return res.status(403).json({
        success: false,
        error: 'Security verification failed. Please refresh and try again.'
      });
    }

    const id = crypto.randomUUID();
    const inqCode = `INQ-${Math.floor(400 + Math.random() * 500)}`;

    await pool.query(
      `INSERT INTO contact_inquiries (id, inquiry_code, name, email, phone, inquiry_type, message, status, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'unread', ?)`,
      [id, inqCode, validated.name, validated.email, validated.phone || null, validated.inquiry_type || 'General Inquiry', validated.message, req.ip]
    );

    // Broadcast inquiry event to active admin dashboards
    adminEvents.emit('inquiry:created', {
      id,
      inquiry_code: inqCode,
      name: validated.name,
      email: validated.email,
      created_at: new Date().toISOString()
    });

    // Enqueue transactional acknowledgment email to user via resilient outbox
    enqueueMail({
      type: 'contact_ack',
      to: validated.email,
      vars: {
        name: validated.name,
        inquiry_code: inqCode
      }
    }).catch(err => console.warn('[Contact Ack Outbox Warning]:', err.message));

    // Enqueue notification alert to agency operations desk
    enqueueMail({
      type: 'contact_alert',
      to: process.env.AGENCY_ALERT_EMAIL || 'info@divinefingershealthcare.ca',
      vars: {
        name: validated.name,
        email: validated.email,
        replyTo: validated.email,
        phone: validated.phone || 'Not provided',
        inquiry_type: validated.inquiry_type || 'General Inquiry',
        inquiry_code: inqCode,
        message: validated.message
      }
    }).catch(err => console.warn('[Contact Alert Outbox Warning]:', err.message));

    res.status(201).json({
      success: true,
      message: 'Thank you for contacting Divine Fingers. A care coordinator will reach out promptly.'
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    next(err);
  }
});

module.exports = router;
