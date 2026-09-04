const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const adminEvents = require('../utils/events');

const JWT_SECRET = process.env.JWT_SECRET || 'divine_fingers_default_secure_jwt_secret_key_2026_production_fallback';

function getAuthUser(req) {
  const token = req.cookies && (req.cookies['df_user_session'] || req.cookies['df_admin_session']);
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

/**
 * GET /api/shifts
 * Returns open shifts available for claiming/working
 */
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.id, r.request_code, r.facility_name, r.unit_department, r.role_requested,
             r.shift_type, r.status, r.urgency_level, r.start_date, r.created_at
      FROM staffing_requests r
      WHERE r.status IN ('pending', 'confirmed', 'dispatched')
      ORDER BY r.created_at DESC
      LIMIT 30
    `);

    const shifts = (rows || []).map(r => ({
      id: r.id,
      request_code: r.request_code,
      facility: r.facility_name,
      department: r.unit_department,
      role: r.role_requested || 'Registered Nurse',
      shift_type: r.shift_type || 'Day Shift',
      time: r.shift_type || '07:00 - 15:30 (Day Shift)',
      rate: r.role_requested === 'PSW' ? '$28.50/hr' : (r.role_requested === 'RPN' ? '$38.00/hr' : '$48.50/hr'),
      urgency: r.urgency_level === 'emergency_surge' ? 'Urgent Surge' : (r.urgency_level === 'urgent' ? 'High Priority' : 'Open'),
      status: r.status
    }));

    res.json({ success: true, shifts });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/shifts/clock-status
 * Check current active punch status and weekly logged hours for the authenticated staff
 */
router.get('/clock-status', async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    // 1. Check active punch
    const [activeRows] = await pool.query(
      `SELECT id, staff_id, staff_name, shift_id, facility_name, unit_department, role,
              clock_in_time, status, notes
       FROM shift_punches
       WHERE staff_id = ? AND status = 'active'
       ORDER BY clock_in_time DESC
       LIMIT 1`,
      [user.id]
    );

    const activePunch = (activeRows && activeRows.length > 0) ? activeRows[0] : null;

    // 2. Compute weekly hours (last 7 days)
    let weeklyHours = 0;
    try {
      const [sumRows] = await pool.query(
        `SELECT COALESCE(SUM(total_hours), 0) AS total_weekly_hours
         FROM shift_punches
         WHERE staff_id = ? AND status = 'completed' AND clock_in_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
        [user.id]
      );
      if (sumRows && sumRows.length > 0 && sumRows[0].total_weekly_hours) {
        weeklyHours = parseFloat(sumRows[0].total_weekly_hours) || 0;
      }
    } catch (e) {}

    res.json({
      success: true,
      onShift: Boolean(activePunch),
      activePunch,
      weeklyHours: Number(weeklyHours.toFixed(1))
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/shifts/clock-in
 * Healthcare staff clocks into a shift
 */
router.post('/clock-in', async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required. Please sign in.' });
    }

    // Check if already clocked in
    const [existing] = await pool.query(
      `SELECT id, facility_name, clock_in_time FROM shift_punches WHERE staff_id = ? AND status = 'active' LIMIT 1`,
      [user.id]
    );

    if (existing && existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `You are already clocked in to ${existing[0].facility_name}. Please clock out before starting a new shift.`,
        activePunch: existing[0]
      });
    }

    const {
      shift_id,
      facility_name = 'Divine Fingers Partner Facility',
      unit_department = 'General Floor',
      role = 'RN',
      notes = null
    } = req.body || {};

    const punchId = crypto.randomUUID();
    const staffName = user.full_name || 'Staff Member';
    const staffEmail = user.email || '';

    // Insert punch
    await pool.query(
      `INSERT INTO shift_punches
        (id, staff_id, staff_name, staff_email, shift_id, facility_name, unit_department, role, clock_in_time, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'active', ?)`,
      [punchId, user.id, staffName, staffEmail, shift_id || null, facility_name, unit_department, role, notes]
    );

    // If shift_id was linked, update staffing_requests
    if (shift_id) {
      await pool.query(
        `UPDATE staffing_requests SET status = 'in_session', clock_in_time = NOW() WHERE id = ?`,
        [shift_id]
      ).catch(() => {});
    }

    // Update staff_roster status
    await pool.query(
      `UPDATE staff_roster SET status = 'on-shift' WHERE email = ? OR id = ?`,
      [staffEmail, user.id]
    ).catch(() => {});

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, 'SHIFT_CLOCK_IN', 'shift_punches', ?, ?, 'info', ?)`,
      [crypto.randomUUID(), staffName, punchId, `Clocked in for shift at ${facility_name} (${unit_department})`, req.ip]
    ).catch(() => {});

    adminEvents.emit('status:changed', {
      entity: 'shift_punches',
      id: punchId,
      staff_id: user.id,
      staff_name: staffName,
      facility_name,
      status: 'active',
      clock_in_time: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      message: `🟢 Clocked In Successfully at ${facility_name}!`,
      punch: {
        id: punchId,
        facility_name,
        unit_department,
        role,
        clock_in_time: new Date().toISOString(),
        status: 'active'
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/shifts/clock-out
 * Healthcare staff clocks out of their active shift
 */
router.post('/clock-out', async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const [activeRows] = await pool.query(
      `SELECT id, shift_id, facility_name, unit_department, clock_in_time FROM shift_punches WHERE staff_id = ? AND status = 'active' ORDER BY clock_in_time DESC LIMIT 1`,
      [user.id]
    );

    if (!activeRows || activeRows.length === 0) {
      return res.status(400).json({ success: false, error: 'No active shift found to clock out of.' });
    }

    const punch = activeRows[0];
    const { notes = null, break_minutes = 0 } = req.body || {};

    const clockIn = new Date(punch.clock_in_time);
    const clockOut = new Date();
    const elapsedMinutes = Math.max(1, Math.round((clockOut.getTime() - clockIn.getTime()) / 60000));
    const paidMinutes = Math.max(1, elapsedMinutes - (parseInt(break_minutes, 10) || 0));
    const totalHours = Number((paidMinutes / 60).toFixed(2));

    await pool.query(
      `UPDATE shift_punches
       SET clock_out_time = NOW(), total_hours = ?, notes = COALESCE(?, notes), status = 'completed', updated_at = NOW()
       WHERE id = ?`,
      [totalHours, notes, punch.id]
    );

    if (punch.shift_id) {
      await pool.query(
        `UPDATE staffing_requests SET status = 'completed', clock_out_time = NOW() WHERE id = ?`,
        [punch.shift_id]
      ).catch(() => {});
    }

    // Set staff available and increment shifts_completed
    await pool.query(
      `UPDATE staff_roster SET status = 'available', shifts_completed = COALESCE(shifts_completed, 0) + 1 WHERE email = ? OR id = ?`,
      [user.email, user.id]
    ).catch(() => {});

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, 'SHIFT_CLOCK_OUT', 'shift_punches', ?, ?, 'info', ?)`,
      [crypto.randomUUID(), user.full_name || 'Staff Member', punch.id, `Clocked out from ${punch.facility_name}. Duration: ${totalHours} hrs.`, req.ip]
    ).catch(() => {});

    adminEvents.emit('status:changed', {
      entity: 'shift_punches',
      id: punch.id,
      staff_id: user.id,
      status: 'completed',
      total_hours: totalHours,
      clock_out_time: clockOut.toISOString()
    });

    res.json({
      success: true,
      message: `🎉 Shift Concluded and Clocked Out Successfully! Total shift time: ${totalHours} hours.`,
      punch: {
        id: punch.id,
        facility_name: punch.facility_name,
        clock_in_time: punch.clock_in_time,
        clock_out_time: clockOut.toISOString(),
        total_hours: totalHours,
        status: 'completed'
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/shifts/my-punches
 * Get past punch logs and timecard history for authenticated staff member
 */
router.get('/my-punches', async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const [rows] = await pool.query(
      `SELECT id, shift_id, facility_name, unit_department, role, clock_in_time, clock_out_time, total_hours, status, notes
       FROM shift_punches
       WHERE staff_id = ?
       ORDER BY clock_in_time DESC
       LIMIT 20`,
      [user.id]
    );

    res.json({ success: true, punches: rows || [] });
  } catch (err) {
    next(err);
  }
});

/**
 * Legacy routes for single shift ID lookups (Caregiver 1-Tap Checkin page)
 */
router.get('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT r.id, r.request_code, r.facility_name, r.unit_department, r.role_requested,
             r.shift_type, r.status, r.clock_in_time, r.clock_out_time, r.created_at,
             s.name AS staff_name, s.staff_code, s.role AS staff_role
      FROM staffing_requests r
      LEFT JOIN staff_roster s ON r.assigned_staff_id = s.id
      WHERE r.id = ?
    `, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Shift order not found.' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/clock-in', async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      'SELECT id, request_code, facility_name, status, assigned_staff_id FROM staffing_requests WHERE id = ?',
      [id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Shift order not found.' });
    }
    const shift = rows[0];
    await pool.query(`UPDATE staffing_requests SET status = 'in_session', clock_in_time = NOW() WHERE id = ?`, [id]);
    res.json({ success: true, message: `✅ Clocked In for ${shift.facility_name}.`, status: 'in_session' });
  } catch (err) { next(err); }
});

router.post('/:id/clock-out', async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE staffing_requests SET status = 'completed', clock_out_time = NOW() WHERE id = ?`, [id]);
    res.json({ success: true, message: `🎉 Shift Concluded.`, status: 'completed' });
  } catch (err) { next(err); }
});

module.exports = router;
