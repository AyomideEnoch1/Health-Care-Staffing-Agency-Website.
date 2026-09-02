const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { z } = require('zod');
const pool = require('../db');
const { publicFormLimiter } = require('../middleware/rateLimiter');
const { requireAdminAuth } = require('../middleware/auth');
const { sendNewsletterWelcomeEmail } = require('../utils/mailer');
const adminEvents = require('../utils/events');

const newsletterSchema = z.object({
  email: z.string().email('Please provide a valid email address.').max(191),
  source: z.string().max(50).optional().default('homepage_strip')
});

// POST /api/newsletter/subscribe (Public)
router.post('/subscribe', publicFormLimiter, async (req, res, next) => {
  try {
    const validated = newsletterSchema.parse(req.body);
    const normalizedEmail = validated.email.toLowerCase().trim();

    // Check if subscriber already exists
    const [existing] = await pool.query(
      'SELECT id, status FROM newsletter_subscribers WHERE email = ?',
      [normalizedEmail]
    );

    if (existing.length > 0) {
      if (existing[0].status === 'unsubscribed') {
        await pool.query("UPDATE newsletter_subscribers SET status = 'active' WHERE id = ?", [existing[0].id]);
        return res.json({
          success: true,
          message: 'Welcome back! Your shift alerts subscription has been reactivated.'
        });
      }
      return res.json({
        success: true,
        already_subscribed: true,
        message: 'You are already subscribed to Divine Fingers staffing & shift alerts.'
      });
    }

    const id = crypto.randomUUID();
    await pool.query(
      "INSERT INTO newsletter_subscribers (id, email, status, source, ip_address) VALUES (?, ?, 'active', ?, ?)",
      [id, normalizedEmail, validated.source || 'homepage_strip', req.ip]
    );

    // Automated welcome email dispatch
    sendNewsletterWelcomeEmail(normalizedEmail).catch(err => {
      console.warn('⚠️ [Newsletter Mailer Error]', err.message);
    });

    // Notify open admin dashboards
    adminEvents.emit('newsletter:subscribed', {
      id,
      email: normalizedEmail,
      source: validated.source || 'homepage_strip',
      created_at: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      message: '✅ Thank you for subscribing! You will receive our latest healthcare staffing updates and shift alerts.'
    });

  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    next(err);
  }
});

// GET /api/newsletter/subscribers (Admin)
router.get('/subscribers', requireAdminAuth(), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, email, status, source, ip_address, created_at FROM newsletter_subscribers ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// DELETE /api/newsletter/subscribers/:id (Admin)
router.delete('/subscribers/:id', requireAdminAuth(), async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM newsletter_subscribers WHERE id = ?', [id]);
    res.json({ success: true, message: 'Subscriber removed.' });
  } catch (err) { next(err); }
});

// GET /api/newsletter/export (Admin CSV)
router.get('/export', requireAdminAuth(), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT email, status, source, created_at FROM newsletter_subscribers ORDER BY created_at DESC'
    );
    let csv = 'Email,Status,Source,Date Subscribed\r\n';
    rows.forEach(r => {
      csv += `"${r.email}","${r.status}","${r.source}","${r.created_at}"\r\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="divine_fingers_subscribers.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

module.exports = router;
