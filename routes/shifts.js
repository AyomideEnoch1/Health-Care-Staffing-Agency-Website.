const express = require('express');
const router = express.Router();
const pool = require('../db');
const adminEvents = require('../utils/events');

/**
 * GET /api/shifts/:id/status
 * Public status lookup for caregiver check-in page
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

/**
 * POST /api/shifts/:id/clock-in
 * Caregiver 1-Tap Clock In
 */
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
    if (shift.status === 'completed') {
      return res.status(400).json({ success: false, error: 'Shift is already completed and closed.' });
    }

    await pool.query(
      `UPDATE staffing_requests 
       SET status = 'in_session', clock_in_time = NOW() 
       WHERE id = ?`,
      [id]
    );

    if (shift.assigned_staff_id) {
      await pool.query(
        `UPDATE staff_roster SET status = 'on-shift' WHERE id = ?`,
        [shift.assigned_staff_id]
      );
    }

    const crypto = require('crypto');
    await pool.query(
      `INSERT INTO audit_logs (id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), 'Caregiver (Self-Service)', 'SHIFT_CLOCK_IN', 'staffing_requests', id,
       `Caregiver clocked in for ${shift.facility_name} (${shift.request_code})`, 'info', req.ip]
    ).catch(()=>{});

    adminEvents.emit('status:changed', {
      entity: 'staffing_requests',
      id,
      status: 'in_session',
      clock_in_time: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `✅ Clocked In Successfully for ${shift.facility_name} (${shift.request_code}). Shift is now active.`,
      status: 'in_session',
      clock_in_time: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/shifts/:id/clock-out
 * Caregiver 1-Tap Clock Out
 */
router.post('/:id/clock-out', async (req, res, next) => {
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

    await pool.query(
      `UPDATE staffing_requests 
       SET status = 'completed', clock_out_time = NOW() 
       WHERE id = ?`,
      [id]
    );

    if (shift.assigned_staff_id) {
      await pool.query(
        `UPDATE staff_roster 
         SET status = 'available', shifts_completed = COALESCE(shifts_completed, 0) + 1 
         WHERE id = ?`,
        [shift.assigned_staff_id]
      );
    }

    const crypto = require('crypto');
    await pool.query(
      `INSERT INTO audit_logs (id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), 'Caregiver (Self-Service)', 'SHIFT_CLOCK_OUT', 'staffing_requests', id,
       `Caregiver clocked out from ${shift.facility_name} (${shift.request_code}). Shift completed.`, 'info', req.ip]
    ).catch(()=>{});

    adminEvents.emit('status:changed', {
      entity: 'staffing_requests',
      id,
      status: 'completed',
      clock_out_time: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `🎉 Shift Concluded and Clocked Out for ${shift.facility_name} (${shift.request_code}). Shift record saved to payroll.`,
      status: 'completed',
      clock_out_time: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
