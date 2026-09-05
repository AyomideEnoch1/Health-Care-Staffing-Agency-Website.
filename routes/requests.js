const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const pool = require('../db');
const { publicFormLimiter } = require('../middleware/rateLimiter');
const { sendStaffingRequestAlert } = require('../utils/mailer');
const adminEvents = require('../utils/events');

const JWT_SECRET = process.env.JWT_SECRET || 'divine_fingers_default_secure_jwt_secret_key_2026_production_fallback';

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

// ============================================================================
// GET /api/requests
// Fetch client staffing requests, assigned staff details, and live activity tracking
// ============================================================================
router.get('/', async (req, res, next) => {
  try {
    let clientEmail = null;
    let clientOrg = null;

    // Check user session
    const token = req.cookies['df_user_session'];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.email) {
          clientEmail = decoded.email.toLowerCase().trim();
          clientOrg = decoded.organization_name ? decoded.organization_name.trim() : null;
        }
      } catch (_) {}
    }

    let sql = `
      SELECT 
        sr.id,
        sr.request_code,
        sr.batch_code,
        sr.facility_name,
        sr.unit_department,
        sr.contact_name,
        sr.contact_email,
        sr.contact_phone,
        sr.role_requested,
        sr.shift_type,
        sr.urgency_level,
        sr.start_date,
        sr.status,
        sr.special_instructions,
        sr.created_at,
        sr.clock_in_time,
        sr.clock_out_time,
        sr.client_rating,
        sr.client_feedback,
        sr.client_rated_at,
        st.id AS staff_id,
        st.name AS staff_name,
        st.role AS staff_role,
        st.phone AS staff_phone,
        st.email AS staff_email,
        st.staff_code,
        st.rating AS staff_rating,
        st.avatar_url AS staff_avatar
      FROM staffing_requests sr
      LEFT JOIN staff_roster st ON sr.assigned_staff_id = st.id
    `;

    const params = [];
    if (clientEmail && req.query.all !== 'true') {
      if (clientOrg) {
        sql += ` WHERE (LOWER(sr.contact_email) = ? OR LOWER(sr.facility_name) LIKE ?)`;
        params.push(clientEmail, `%${clientOrg.toLowerCase()}%`);
      } else {
        sql += ` WHERE LOWER(sr.contact_email) = ?`;
        params.push(clientEmail);
      }
    }

    sql += ` ORDER BY sr.created_at DESC LIMIT 100`;

    let [rows] = await pool.query(sql, params);

    // Fallback if client has no specific requests yet: show demo/recent staffing requests
    if (clientEmail && rows.length === 0) {
      const [fallbackRows] = await pool.query(`
        SELECT 
          sr.id,
          sr.request_code,
          sr.batch_code,
          sr.facility_name,
          sr.unit_department,
          sr.contact_name,
          sr.contact_email,
          sr.contact_phone,
          sr.role_requested,
          sr.shift_type,
          sr.urgency_level,
          sr.start_date,
          sr.status,
          sr.special_instructions,
          sr.created_at,
          sr.clock_in_time,
          sr.clock_out_time,
          sr.client_rating,
          sr.client_feedback,
          sr.client_rated_at,
          st.id AS staff_id,
          st.name AS staff_name,
          st.role AS staff_role,
          st.phone AS staff_phone,
          st.email AS staff_email,
          st.staff_code,
          st.rating AS staff_rating,
          st.avatar_url AS staff_avatar
        FROM staffing_requests sr
        LEFT JOIN staff_roster st ON sr.assigned_staff_id = st.id
        ORDER BY sr.created_at DESC LIMIT 20
      `);
      rows = fallbackRows;
    }

    res.json({
      success: true,
      count: rows.length,
      requests: rows
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /api/requests/:id/rate
// Allow client facilities to rate and review dispatched healthcare staff
// ============================================================================
const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(1000).optional().nullable()
});

router.post('/:id/rate', async (req, res, next) => {
  try {
    const { id } = req.params;
    const validated = ratingSchema.parse(req.body);

    const [rows] = await pool.query(
      'SELECT id, request_code, facility_name, assigned_staff_id, status FROM staffing_requests WHERE id = ? LIMIT 1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Staffing request not found.' });
    }

    const request = rows[0];
    if (!request.assigned_staff_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot rate a request that does not have a dispatched healthcare worker.' 
      });
    }

    // Update request rating and feedback
    await pool.query(
      `UPDATE staffing_requests 
       SET client_rating = ?, client_feedback = ?, client_rated_at = NOW() 
       WHERE id = ?`,
      [validated.rating, validated.feedback ? validated.feedback.trim() : null, id]
    );

    // Recalculate assigned staff rating average in staff_roster
    try {
      const [avgRows] = await pool.query(
        `SELECT ROUND(AVG(client_rating), 2) AS avg_rating, COUNT(client_rating) AS total_ratings
         FROM staffing_requests 
         WHERE assigned_staff_id = ? AND client_rating IS NOT NULL`,
        [request.assigned_staff_id]
      );

      if (avgRows.length > 0 && avgRows[0].avg_rating !== null) {
        const newRating = parseFloat(avgRows[0].avg_rating);
        await pool.query(
          'UPDATE staff_roster SET rating = ? WHERE id = ?',
          [newRating, request.assigned_staff_id]
        );
      }
    } catch (calcErr) {
      console.warn('[Rating Recalculation Warning]:', calcErr.message);
    }

    // Broadcast rating event
    adminEvents.emit('request:rated', {
      request_id: id,
      request_code: request.request_code,
      facility_name: request.facility_name,
      staff_id: request.assigned_staff_id,
      rating: validated.rating,
      feedback: validated.feedback
    });

    res.json({
      success: true,
      message: `Thank you! Rating of ${validated.rating} / 5 stars recorded for your assigned caregiver.`,
      rating: validated.rating,
      feedback: validated.feedback || null,
      rated_at: new Date().toISOString()
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    next(err);
  }
});

module.exports = router;
