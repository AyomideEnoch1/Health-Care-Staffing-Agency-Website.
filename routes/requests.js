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
  unit_department: z.string().max(100).optional().default('General Care'),
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
    const requestCode = `REQ-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;

    const query = `
      INSERT INTO staffing_requests 
        (id, request_code, facility_name, unit_department, contact_name, contact_email, contact_phone, role_requested, shift_type, urgency_level, status, special_instructions, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `;

    await pool.query(query, [
      id,
      requestCode,
      validated.facility_name,
      validated.unit_department || 'General Care',
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

// ============================================================================
// BULK & HIGH-VOLUME STAFFING REQUEST INGESTION
// POST /api/requests/bulk
// ============================================================================
const bulkRequestSchema = z.object({
  facility_name: z.string().min(2).max(150),
  unit_department: z.string().max(100).optional().default('General Care'),
  contact_name: z.string().min(2).max(100),
  contact_email: z.string().email().max(191),
  contact_phone: z.string().min(10).max(30),
  urgency_level: z.enum(['routine', 'urgent', 'emergency_surge']).optional().default('routine'),
  special_instructions: z.string().max(2000).optional(),
  shifts: z.array(z.object({
    role: z.enum(['RN', 'RPN', 'PSW', 'Companion', 'Travel Nurse', 'Multiple']),
    shift_type: z.string().min(2).max(60),
    shift_date: z.string().optional(),
    unit_department: z.string().optional(),
    quantity: z.number().int().min(1).max(100)
  })).min(1, 'At least one shift requirement must be provided.')
});

router.post('/bulk', publicFormLimiter, async (req, res, next) => {
  try {
    const validated = bulkRequestSchema.parse(req.body);
    const batchCode = `BATCH-${Math.floor(1000 + Math.random() * 9000)}`;
    const createdShifts = [];

    let shiftIndex = 1;
    for (const item of validated.shifts) {
      const qty = item.quantity || 1;
      for (let i = 0; i < qty; i++) {
        const id = crypto.randomUUID();
        const requestCode = `REQ-${Date.now().toString().slice(-3)}${Math.floor(10 + Math.random() * 90)}-${shiftIndex.toString().padStart(2, '0')}`;
        shiftIndex++;
        const unit = item.unit_department || validated.unit_department || 'General Care';

        await pool.query(`
          INSERT INTO staffing_requests 
            (id, request_code, batch_code, facility_name, unit_department, contact_name, contact_email, contact_phone, role_requested, shift_type, start_date, urgency_level, status, special_instructions, ip_address)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        `, [
          id,
          requestCode,
          batchCode,
          validated.facility_name,
          unit,
          validated.contact_name,
          validated.contact_email,
          validated.contact_phone,
          item.role,
          item.shift_type,
          item.shift_date || null,
          validated.urgency_level,
          validated.special_instructions || null,
          req.ip
        ]);

        createdShifts.push({
          id,
          request_code: requestCode,
          batch_code: batchCode,
          facility_name: validated.facility_name,
          unit_department: unit,
          role_requested: item.role,
          shift_type: item.shift_type,
          shift_date: item.shift_date || null,
          urgency_level: validated.urgency_level
        });

        adminEvents.emit('request:created', {
          id,
          request_code: requestCode,
          batch_code: batchCode,
          facility_name: validated.facility_name,
          role_requested: item.role,
          shift_type: item.shift_type,
          urgency_level: validated.urgency_level,
          status: 'pending',
          created_at: new Date().toISOString()
        });
      }
    }

    sendStaffingRequestAlert({
      ...validated,
      role_requested: 'Multiple (Bulk Order)',
      shift_type: `${createdShifts.length} Shifts (${batchCode})`,
      request_code: batchCode
    }).catch(err => console.error('[MAIL ALERT ERROR]:', err.message));

    res.status(201).json({
      success: true,
      message: `Batch order of ${createdShifts.length} clinical shifts submitted successfully.`,
      batch_code: batchCode,
      total_shifts: createdShifts.length,
      data: createdShifts
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    next(err);
  }
});

module.exports = router;
