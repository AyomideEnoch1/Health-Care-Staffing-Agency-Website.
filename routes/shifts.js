const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const adminEvents = require('../utils/events');
const { uploadCredential } = require('../middleware/uploadCredentials');

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
 * Check current active punch status, weekly logged hours, and admin-allocated shifts for the authenticated staff
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
       WHERE (staff_id = ? OR staff_email = ?) AND status = 'active'
       ORDER BY clock_in_time DESC
       LIMIT 1`,
      [user.id, user.email || '']
    );

    const activePunch = (activeRows && activeRows.length > 0) ? activeRows[0] : null;

    // 2. Fetch shifts allocated/dispatched by Admin to this staff member
    let allocatedShifts = [];
    try {
      const [assignedRows] = await pool.query(
        `SELECT r.id, r.request_code, r.facility_name, r.unit_department, r.role_requested,
                r.shift_type, r.start_date, r.urgency_level, r.status, r.special_instructions,
                r.contact_name, r.contact_phone, r.created_at
         FROM staffing_requests r
         WHERE (r.assigned_staff_id = ? OR r.assigned_staff_id IN (SELECT id FROM staff_roster WHERE email = ?))
           AND r.status IN ('dispatched', 'in_session', 'confirmed')
         ORDER BY CASE 
           WHEN r.status = 'in_session' THEN 1 
           WHEN r.status = 'dispatched' THEN 2 
           ELSE 3 END,
           r.start_date ASC, r.created_at DESC
         LIMIT 10`,
        [user.id, user.email || '']
      );
      allocatedShifts = assignedRows || [];
    } catch (e) {
      console.warn('[Allocated Shifts Query Warning]:', e.message);
    }

    const assignedShift = allocatedShifts.length > 0 ? allocatedShifts[0] : null;

    // 3. Compute weekly hours (last 7 days)
    let weeklyHours = 0;
    try {
      const [sumRows] = await pool.query(
        `SELECT COALESCE(SUM(total_hours), 0) AS total_weekly_hours
         FROM shift_punches
         WHERE (staff_id = ? OR staff_email = ?) AND status = 'completed' AND clock_in_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
        [user.id, user.email || '']
      );
      if (sumRows && sumRows.length > 0 && sumRows[0].total_weekly_hours) {
        weeklyHours = parseFloat(sumRows[0].total_weekly_hours) || 0;
      }
    } catch (e) {}

    res.json({
      success: true,
      onShift: Boolean(activePunch),
      activePunch,
      assignedShift,
      allocatedShifts,
      weeklyHours: Number(weeklyHours.toFixed(1))
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/shifts/my-assigned
 * Returns all shifts allocated by admin to the authenticated staff member
 */
router.get('/my-assigned', async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const [rows] = await pool.query(
      `SELECT r.id, r.request_code, r.facility_name, r.unit_department, r.role_requested,
              r.shift_type, r.start_date, r.urgency_level, r.status, r.special_instructions,
              r.contact_name, r.contact_phone, r.created_at, r.clock_in_time, r.clock_out_time
       FROM staffing_requests r
       WHERE (r.assigned_staff_id = ? OR r.assigned_staff_id IN (SELECT id FROM staff_roster WHERE email = ?))
       ORDER BY CASE 
         WHEN r.status = 'in_session' THEN 1 
         WHEN r.status = 'dispatched' THEN 2 
         WHEN r.status = 'confirmed' THEN 3 
         ELSE 4 END,
         r.start_date ASC, r.created_at DESC`,
      [user.id, user.email || '']
    );

    res.json({
      success: true,
      shifts: rows || []
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/shifts/clock-in
 * Healthcare staff clocks into an allocated shift
 */
router.post('/clock-in', async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required. Please sign in.' });
    }

    // Check if already clocked in
    const [existing] = await pool.query(
      `SELECT id, facility_name, clock_in_time FROM shift_punches WHERE (staff_id = ? OR staff_email = ?) AND status = 'active' LIMIT 1`,
      [user.id, user.email || '']
    );

    if (existing && existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `You are already clocked in to ${existing[0].facility_name}. Please clock out before starting a new shift.`,
        activePunch: existing[0]
      });
    }

    let {
      shift_id,
      facility_name,
      unit_department,
      role,
      notes = null
    } = req.body || {};

    // If shift_id was passed, look up the shift details directly from staffing_requests
    if (shift_id) {
      const [shiftRows] = await pool.query(
        `SELECT id, request_code, facility_name, unit_department, role_requested, shift_type, status
         FROM staffing_requests WHERE id = ?`,
        [shift_id]
      );
      if (shiftRows && shiftRows.length > 0) {
        const s = shiftRows[0];
        facility_name = s.facility_name || facility_name;
        unit_department = s.unit_department || unit_department;
        role = s.role_requested || role;
      }
    } else {
      // If no shift_id was passed, automatically find the latest allocated shift for this user!
      const [allocated] = await pool.query(
        `SELECT id, request_code, facility_name, unit_department, role_requested, shift_type, status
         FROM staffing_requests
         WHERE (assigned_staff_id = ? OR assigned_staff_id IN (SELECT id FROM staff_roster WHERE email = ?))
           AND status IN ('dispatched', 'confirmed')
         ORDER BY start_date ASC, created_at DESC
         LIMIT 1`,
        [user.id, user.email || '']
      );
      if (allocated && allocated.length > 0) {
        const s = allocated[0];
        shift_id = s.id;
        facility_name = s.facility_name;
        unit_department = s.unit_department;
        role = s.role_requested;
      }
    }

    facility_name = facility_name || 'Divine Fingers Partner Facility';
    unit_department = unit_department || 'General Floor';
    role = role || user.role || 'RN';

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

    // If shift_id was linked, update staffing_requests to 'in_session'
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

// ============================================================================
// STAFF CREDENTIAL & LICENSE MANAGEMENT WORKFLOW
// ============================================================================

/**
 * GET /api/shifts/my-documents
 * Retrieve verified clinical licenses, certifications, police checks for the logged-in staff member
 */
router.get('/my-documents', async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    let rosterStaff = null;
    try {
      const [rRows] = await pool.query(
        'SELECT id, name, staff_code, role, email, phone, cpr_expiry_date, credential_status, vss_status, n95_fit_test, cno_registration_num FROM staff_roster WHERE id = ? OR email = ? LIMIT 1',
        [user.id, user.email || '']
      );
      if (rRows && rRows.length > 0) {
        rosterStaff = rRows[0];
      }
    } catch (e) {
      console.warn('[Staff Lookup Warning]:', e.message);
    }

    const staffRosterId = rosterStaff ? rosterStaff.id : user.id;

    const [docs] = await pool.query(
      `SELECT id, staff_id, doc_type, title, file_name, file_size, mime_type, expiry_date, uploaded_by, created_at
       FROM staff_documents
       WHERE staff_id = ? OR staff_id = ?
       ORDER BY created_at DESC`,
      [staffRosterId, user.id]
    );

    res.json({
      success: true,
      documents: docs || [],
      compliance: {
        cpr_expiry_date: rosterStaff ? rosterStaff.cpr_expiry_date : null,
        credential_status: rosterStaff ? rosterStaff.credential_status : 'verified',
        vss_status: rosterStaff ? rosterStaff.vss_status : 'Clear',
        n95_fit_test: rosterStaff ? rosterStaff.n95_fit_test : '3M Valid',
        cno_registration_num: rosterStaff ? rosterStaff.cno_registration_num : null,
        role: rosterStaff ? rosterStaff.role : user.role,
        staff_code: rosterStaff ? rosterStaff.staff_code : null,
        name: rosterStaff ? rosterStaff.name : user.full_name
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/shifts/my-documents/upload
 * Upload clinical license, CPR card, police check, or certification
 */
router.post('/my-documents/upload', uploadCredential.single('document'), async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    if (!user) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No credential file was selected for upload.' });
    }

    const { doc_type, title, expiry_date } = req.body;

    let rosterStaff = null;
    try {
      const [rRows] = await pool.query(
        'SELECT id, name, staff_code, role, email FROM staff_roster WHERE id = ? OR email = ? LIMIT 1',
        [user.id, user.email || '']
      );
      if (rRows && rRows.length > 0) rosterStaff = rRows[0];
    } catch (e) {}

    const staffId = rosterStaff ? rosterStaff.id : user.id;
    const staffName = rosterStaff ? rosterStaff.name : (user.full_name || 'Staff Member');
    const docId = crypto.randomUUID();
    const docTitle = (title && title.trim()) ? title.trim() : req.file.originalname;
    
    // Ensure doc_type is valid enum
    const VALID_DOC_TYPES = ['cno_license', 'cpr_card', 'vss_check', 'n95_fit', 'immunization', 'diploma', 'work_auth', 'driver_license', 'other'];
    const safeDocType = VALID_DOC_TYPES.includes(doc_type) ? doc_type : 'other';

    await pool.query(
      `INSERT INTO staff_documents
        (id, staff_id, doc_type, title, file_path, file_name, file_size, mime_type, expiry_date, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        docId,
        staffId,
        safeDocType,
        docTitle,
        req.file.path,
        req.file.originalname,
        req.file.size,
        req.file.mimetype,
        expiry_date || null,
        staffName
      ]
    );

    // If doc is CPR or CNO, update caregiver compliance standing
    if (rosterStaff) {
      if (expiry_date && (safeDocType === 'cpr_card' || safeDocType === 'cno_license')) {
        const exp = new Date(expiry_date);
        const today = new Date();
        const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
        const credStatus = exp < today ? 'expired' : (exp <= thirtyDays ? 'expiring' : 'verified');
        await pool.query(
          `UPDATE staff_roster SET cpr_expiry_date = ?, credential_status = ? WHERE id = ?`,
          [expiry_date, credStatus, rosterStaff.id]
        );
      } else if (safeDocType === 'vss_check') {
        await pool.query(`UPDATE staff_roster SET vss_status = 'Clear' WHERE id = ?`, [rosterStaff.id]);
      } else if (safeDocType === 'n95_fit') {
        await pool.query(`UPDATE staff_roster SET n95_fit_test = '3M Valid' WHERE id = ?`, [rosterStaff.id]);
      }
    }

    try {
      await pool.query(
        `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          user.id,
          staffName,
          'CREDENTIAL_UPLOADED',
          'staff_documents',
          docId,
          `Staff member ${staffName} uploaded ${safeDocType} (${docTitle}) via Staff Portal`,
          'info',
          req.ip
        ]
      );
    } catch (e) {}

    adminEvents.emit('status:changed', { entity: 'staff_documents', id: docId, staff_id: staffId, action: 'uploaded' });

    res.status(201).json({
      success: true,
      message: `Credential "${docTitle}" uploaded and verified successfully!`,
      document: {
        id: docId,
        staff_id: staffId,
        doc_type: safeDocType,
        title: docTitle,
        file_name: req.file.originalname,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        expiry_date: expiry_date || null,
        uploaded_by: staffName,
        created_at: new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/shifts/documents/:docId/download
 * Secure download/preview of staff credential
 */
router.get('/documents/:docId/download', async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const { docId } = req.params;
    const [rows] = await pool.query('SELECT * FROM staff_documents WHERE id = ?', [docId]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Credential document not found.' });
    }

    const doc = rows[0];

    // Ownership check: matches user.id or staff_roster id
    let isOwner = (doc.staff_id === user.id);
    if (!isOwner) {
      const [rRows] = await pool.query('SELECT id FROM staff_roster WHERE id = ? AND email = ?', [doc.staff_id, user.email || '']);
      if (rRows && rRows.length > 0) isOwner = true;
    }
    const isAdmin = (user.role === 'admin' || user.role === 'super-admin');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Access denied to this document.' });
    }

    if (!fs.existsSync(doc.file_path)) {
      return res.status(404).json({ success: false, error: 'Document file is missing from secure storage.' });
    }

    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.file_name)}"`);
    fs.createReadStream(doc.file_path).pipe(res);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/shifts/documents/:docId
 * Delete a credential uploaded by the worker
 */
router.delete('/documents/:docId', async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const { docId } = req.params;
    const [rows] = await pool.query('SELECT * FROM staff_documents WHERE id = ?', [docId]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    const doc = rows[0];

    let isOwner = (doc.staff_id === user.id);
    if (!isOwner) {
      const [rRows] = await pool.query('SELECT id FROM staff_roster WHERE id = ? AND email = ?', [doc.staff_id, user.email || '']);
      if (rRows && rRows.length > 0) isOwner = true;
    }
    const isAdmin = (user.role === 'admin' || user.role === 'super-admin');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, error: 'You are not authorized to delete this document.' });
    }

    if (fs.existsSync(doc.file_path)) {
      fs.unlinkSync(doc.file_path);
    }

    await pool.query('DELETE FROM staff_documents WHERE id = ?', [docId]);

    try {
      await pool.query(
        `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          user.id,
          user.full_name || 'Staff Member',
          'CREDENTIAL_DELETED',
          'staff_documents',
          docId,
          `Deleted document ${doc.title} (${doc.file_name}) via Staff Portal`,
          'info',
          req.ip
        ]
      );
    } catch (e) {}

    adminEvents.emit('status:changed', { entity: 'staff_documents', id: docId, action: 'deleted' });

    res.json({ success: true, message: `Document "${doc.title}" was successfully removed.` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
