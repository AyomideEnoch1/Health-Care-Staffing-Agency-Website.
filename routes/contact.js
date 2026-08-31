const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { z } = require('zod');
const pool = require('../db');
const { publicFormLimiter } = require('../middleware/rateLimiter');
const adminEvents = require('../utils/events');

const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(191),
  phone: z.string().max(30).optional(),
  inquiry_type: z.string().max(80).optional(),
  message: z.string().min(5).max(3000)
});

router.post('/', publicFormLimiter, async (req, res, next) => {
  try {
    const validated = contactSchema.parse(req.body);
    const id = crypto.randomUUID();
    const inqCode = `INQ-${Math.floor(400 + Math.random() * 500)}`;

    await pool.query(
      `INSERT INTO contact_inquiries (id, inquiry_code, name, email, phone, inquiry_type, message, status, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'unread', ?)`,
      [id, inqCode, validated.name, validated.email, validated.phone || null, validated.inquiry_type || 'General Inquiry', validated.message, req.ip]
    );

    // Broadcast inquiry event
    adminEvents.emit('inquiry:created', {
      id,
      inquiry_code: inqCode,
      name: validated.name,
      email: validated.email,
      created_at: new Date().toISOString()
    });

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
