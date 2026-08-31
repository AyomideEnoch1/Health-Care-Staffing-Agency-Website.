const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { z } = require('zod');
const pool = require('../db');
const { publicFormLimiter } = require('../middleware/rateLimiter');
const { sendStaffingRequestAlert } = require('../utils/mailer');
const adminEvents = require('../utils/events');

const requestSchema = z.object({
  facility_name: z.string().min(2).max(150),
  contact_name: z.string().min(2).max(100),
  contact_email: z.string().email().max(191),
  contact_phone: z.string().min(10).max(30),
  role_requested: z.enum(['RN', 'RPN', 'PSW', 'Companion', 'Travel Nurse', 'Multiple']),
  shift_type: z.string().min(2).max(60),
  urgency_level: z.enum(['routine', 'urgent', 'emergency_surge']).optional().default('routine'),
  special_instructions: z.string().max(2000).optional()
});

router.post('/', publicFormLimiter, async (req, res, next) => {
  try {
    const validated = requestSchema.parse(req.body);
    const id = crypto.randomUUID();
    const requestCode = `REQ-${Math.floor(100 + Math.random() * 900)}`;

    const query = `
      INSERT INTO staffing_requests 
        (id, request_code, facility_name, contact_name, contact_email, contact_phone, role_requested, shift_type, urgency_level, status, special_instructions, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `;

    await pool.query(query, [
      id,
      requestCode,
      validated.facility_name,
      validated.contact_name,
      validated.contact_email,
      validated.contact_phone,
      validated.role_requested,
      validated.shift_type,
      validated.urgency_level,
      validated.special_instructions || null,
      req.ip
    ]);

    // Broadcast real-time event to connected admin dashboards
    adminEvents.emit('request:created', {
      id,
      request_code: requestCode,
      facility_name: validated.facility_name,
      role_requested: validated.role_requested,
      shift_type: validated.shift_type,
      urgency_level: validated.urgency_level,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    // Send async email notification
    sendStaffingRequestAlert({ ...validated, request_code: requestCode }).catch(err =>
      console.error('[MAIL ALERT ERROR]:', err.message)
    );

    res.status(201).json({
      success: true,
      message: 'Staffing request submitted successfully.',
      data: { request_code: requestCode }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    next(err);
  }
});

module.exports = router;
