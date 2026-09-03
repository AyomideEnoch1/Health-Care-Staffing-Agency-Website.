/**
 * Admin Routes — Protected Operations Dashboard API
 * Divine Fingers Healthcare Services Inc.
 *
 * All routes require a valid httpOnly session cookie (requireAdminAuth).
 * State-changing routes (PATCH) also require the X-CSRF-Token header (enforced in server.js).
 *
 * KPI endpoint computes live aggregate counts from the database — no hardcoded numbers.
 *
 * SSE stream:
 *   - Client must send cookies (EventSource uses credentials automatically when
 *     the cookie is same-origin; for cross-origin use fetch + ReadableStream instead).
 *   - Retry: 5000ms — browser will auto-reconnect after 5 seconds on disconnect.
 *   - Heartbeat comment sent every 25 seconds to keep the connection alive through
 *     proxies and load balancers that time out idle connections.
 *
 * IP address retention:
 *   - ip_address columns across all tables are retained for a recommended maximum of 90 days.
 *   - This window is configurable via IP_RETENTION_DAYS env var.
 *   - A scheduled purge job (cron) should be configured separately to nullify or
 *     delete ip_address values older than the retention window.
 *   - This is a privacy hygiene requirement aligned with PIPEDA's data minimization principle.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { uploadCredential } = require('../middleware/uploadCredentials');
const { requireAdminAuth, requirePermission, normalizePermissions, ALL_PERMISSIONS } = require('../middleware/auth');
const adminEvents = require('../utils/events');
const { sendAdminEmailVerificationOtp } = require('../utils/mailer');

// All admin routes require authentication
router.use(requireAdminAuth());

// ============================================================================
// REAL-TIME SERVER-SENT EVENTS (SSE) STREAM
// GET /api/admin/stream
// ============================================================================
router.get('/stream', (req, res) => {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Tell the browser to reconnect after 5 seconds if the connection drops
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering if behind proxy
  res.flushHeaders();

  // Retry directive: browser auto-reconnects after 5000ms on disconnect
  res.write('retry: 5000\n\n');

  // Initial connected confirmation — client uses this to clear the "reconnecting" banner
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Event listeners
  const onRequest     = (data) => res.write(`data: ${JSON.stringify({ type: 'request:created',     payload: data })}\n\n`);
  const onApplication = (data) => res.write(`data: ${JSON.stringify({ type: 'application:created', payload: data })}\n\n`);
  const onInquiry     = (data) => res.write(`data: ${JSON.stringify({ type: 'inquiry:created',     payload: data })}\n\n`);
  const onStatusChange= (data) => res.write(`data: ${JSON.stringify({ type: 'status:changed',      payload: data })}\n\n`);

  adminEvents.on('request:created',     onRequest);
  adminEvents.on('application:created', onApplication);
  adminEvents.on('inquiry:created',     onInquiry);
  adminEvents.on('status:changed',      onStatusChange);

  // Keep-alive heartbeat every 25 seconds (SSE comment lines — not parsed by client)
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  // Clean up all listeners when client disconnects
  req.on('close', () => {
    clearInterval(heartbeat);
    adminEvents.off('request:created',     onRequest);
    adminEvents.off('application:created', onApplication);
    adminEvents.off('inquiry:created',     onInquiry);
    adminEvents.off('status:changed',      onStatusChange);
  });
});

// ============================================================================
// LIVE KPI METRICS — computed from real DB rows
// GET /api/admin/kpis
// ============================================================================
router.get('/kpis', async (req, res, next) => {
  try {
    // All counts derived from real table rows — zero is a valid honest state
    const [[requestCounts]] = await pool.query(`
      SELECT
        COUNT(*) AS total_requests,
        SUM(CASE WHEN status = 'pending'    THEN 1 ELSE 0 END) AS pending_requests,
        SUM(CASE WHEN status = 'dispatched' THEN 1 ELSE 0 END) AS dispatched_requests,
        SUM(CASE WHEN status = 'completed'  THEN 1 ELSE 0 END) AS completed_requests,
        SUM(CASE WHEN urgency_level = 'emergency_surge' AND status = 'pending' THEN 1 ELSE 0 END) AS urgent_pending
      FROM staffing_requests
    `);

    const [[appCounts]] = await pool.query(`
      SELECT
        COUNT(*) AS total_applications,
        SUM(CASE WHEN stage = 'new'       THEN 1 ELSE 0 END) AS new_applications,
        SUM(CASE WHEN stage = 'interview' THEN 1 ELSE 0 END) AS interview_stage,
        SUM(CASE WHEN stage = 'hired'     THEN 1 ELSE 0 END) AS hired
      FROM job_applications
    `);

    const [[rosterCounts]] = await pool.query(`
      SELECT
        COUNT(*) AS total_staff,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available_staff,
        SUM(CASE WHEN credential_status = 'expiring' OR credential_status = 'expired' THEN 1 ELSE 0 END) AS credentials_expiring
      FROM staff_roster
    `);

    // Shift fill rate: completed / total * 100 (0 if no requests yet)
    const total = parseInt(requestCounts.total_requests) || 0;
    const completed = parseInt(requestCounts.completed_requests) || 0;
    const fillRate = total > 0 ? ((completed / total) * 100).toFixed(1) : null;

    res.json({
      success: true,
      data: {
        requests: {
          total:      parseInt(requestCounts.total_requests)      || 0,
          pending:    parseInt(requestCounts.pending_requests)    || 0,
          dispatched: parseInt(requestCounts.dispatched_requests) || 0,
          completed:  parseInt(requestCounts.completed_requests)  || 0,
          urgent:     parseInt(requestCounts.urgent_pending)      || 0
        },
        applications: {
          total:     parseInt(appCounts.total_applications) || 0,
          new:       parseInt(appCounts.new_applications)   || 0,
          interview: parseInt(appCounts.interview_stage)    || 0,
          hired:     parseInt(appCounts.hired)              || 0
        },
        roster: {
          total:               parseInt(rosterCounts.total_staff)           || 0,
          available:           parseInt(rosterCounts.available_staff)       || 0,
          credentials_expiring:parseInt(rosterCounts.credentials_expiring)  || 0
        },
        shift_fill_rate: fillRate // null if no data yet — UI shows "N/A"
      }
    });
  } catch (err) { next(err); }
});

// ============================================================================
// STAFFING REQUESTS
// GET /api/admin/requests
// ============================================================================
router.get('/requests', requirePermission('requests:view'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.*,
             s.name  AS assigned_staff_name,
             s.role  AS assigned_staff_role
      FROM staffing_requests r
      LEFT JOIN staff_roster s ON r.assigned_staff_id = s.id
      ORDER BY r.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// PATCH /api/admin/requests/:id/status
router.patch('/requests/:id/status', requirePermission('requests:dispatch'), async (req, res, next) => {
  try {
    const { status, assigned_staff_id, confirm_override, start_date, shift_type, unit_department } = req.body;
    const { id } = req.params;

    const VALID_STATUSES = ['pending', 'dispatched', 'in_session', 'confirmed', 'completed', 'cancelled'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const [existing] = await pool.query('SELECT request_code, facility_name, start_date, shift_type, unit_department FROM staffing_requests WHERE id = ?', [id]);
    const reqCode = existing.length ? existing[0].request_code : id.slice(0, 8);
    const facilityName = existing.length ? existing[0].facility_name : '';

    let staffName = '';
    let isConflict = false;
    let activeShift = null;

    if (assigned_staff_id) {
      const [staff] = await pool.query('SELECT name, staff_code FROM staff_roster WHERE id = ?', [assigned_staff_id]);
      if (staff.length) {
        staffName = `${staff[0].name} (${staff[0].staff_code})`;
      }

      if (status === 'dispatched') {
        const [activeShifts] = await pool.query(
          "SELECT request_code, facility_name, shift_type FROM staffing_requests WHERE assigned_staff_id = ? AND status = 'dispatched' AND id != ?",
          [assigned_staff_id, id]
        );
        if (activeShifts.length > 0) {
          isConflict = true;
          activeShift = activeShifts[0];
        }
      }
    }

    // POLICY ENFORCEMENT: If conflict detected and coordinator has not confirmed override, reject with 409
    if (isConflict && !confirm_override) {
      return res.status(409).json({
        success: false,
        requires_confirmation: true,
        conflict_detected: true,
        message: `Conflict detected: ${staffName} is already assigned to active shift ${activeShift.request_code} at ${activeShift.facility_name} (${activeShift.shift_type}). Dispatch anyway?`,
        conflict_details: {
          staff_name: staffName,
          existing_shift_code: activeShift.request_code,
          existing_facility: activeShift.facility_name,
          existing_shift_type: activeShift.shift_type
        }
      });
    }

    await pool.query(
      `UPDATE staffing_requests SET 
        status = ?, 
        assigned_staff_id = ?,
        start_date = COALESCE(?, start_date),
        shift_type = COALESCE(?, shift_type),
        unit_department = COALESCE(?, unit_department)
       WHERE id = ?`,
      [status, assigned_staff_id || null, start_date || null, shift_type || null, unit_department || null, id]
    );

    const logAction = isConflict ? 'DISPATCH_CONFLICT_CONFIRMED' : 'STATUS_CHANGED';
    const logSeverity = isConflict ? 'warning' : 'info';
    const logDetails = isConflict
      ? `Coordinator explicitly confirmed double-booking override for ${staffName} on request ${reqCode} (${facilityName}), concurrently active on ${activeShift.request_code} at ${activeShift.facility_name}`
      : `Request ${reqCode} (${facilityName}) moved to ${status}${staffName ? ' — Dispatched to ' + staffName : ''}`;

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), req.admin.id, req.admin.full_name,
       logAction, 'staffing_requests', id,
       logDetails, logSeverity, req.ip]
    );

    adminEvents.emit('status:changed', {
      entity: 'staffing_requests',
      id,
      status,
      assigned_staff_id,
      conflict_confirmed: isConflict
    });

    res.json({
      success: true,
      message: isConflict
        ? `Shift dispatch confirmed with explicit override for ${staffName}.`
        : `Request status updated to ${status}.`,
      conflict_confirmed: isConflict
    });
  } catch (err) { next(err); }
});

// ============================================================================
// JOB APPLICATIONS (ATS)
// GET /api/admin/applications
// ============================================================================
router.get('/applications', requirePermission('applications:view'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, application_code, full_name, role_applied, email, phone, license_registration, stage, resume_original_name, resume_stored_name, experience_summary, created_at FROM job_applications ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// PATCH /api/admin/applications/:id/stage
router.patch('/applications/:id/stage', requirePermission('applications:manage'), async (req, res, next) => {
  try {
    const { stage } = req.body;
    const { id } = req.params;

    const VALID_STAGES = ['new', 'review', 'interview', 'credential_check', 'hired', 'rejected'];
    if (!VALID_STAGES.includes(stage)) {
      return res.status(400).json({ success: false, error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}` });
    }

    await pool.query('UPDATE job_applications SET stage = ? WHERE id = ?', [stage, id]);

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), req.admin.id, req.admin.full_name,
       'STAGE_CHANGED', 'job_applications', id,
       `Application ${id.slice(0,8)} moved to ${stage}`, 'info', req.ip]
    );

    adminEvents.emit('status:changed', { entity: 'job_applications', id, stage });

    res.json({ success: true, message: `Application stage updated to ${stage}.` });
  } catch (err) { next(err); }
});

// GET /api/admin/applications/:id/resume — Secure file download
router.get('/applications/:id/resume', requirePermission('applications:view'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT resume_stored_name, resume_original_name, resume_mime_type, resume_storage_path FROM job_applications WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length || !rows[0].resume_stored_name) {
      return res.status(404).json({ success: false, error: 'Resume not found.' });
    }

    const { resume_stored_name, resume_original_name, resume_mime_type, resume_storage_path } = rows[0];
    const filePath = resume_storage_path || path.join(
      process.env.UPLOAD_DIR || path.join(__dirname, '../uploads/resumes'),
      resume_stored_name
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Resume file not found on server.' });
    }

    // Serve with original filename for download, not the UUID name
    res.setHeader('Content-Type', resume_mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${resume_original_name.replace(/[^a-zA-Z0-9._-]/g, '_')}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) { next(err); }
});

// ============================================================================
// STAFF ROSTER (CRUD)
// ============================================================================
// GET /api/admin/roster
router.get('/roster', requirePermission('roster:view'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, staff_code, name, role, specialty, cno_registration_num, status,
              credential_status, rating, shifts_completed, region, phone, email,
              hourly_rate, cpr_expiry_date, vss_status, n95_fit_test, avatar_url
       FROM staff_roster ORDER BY name ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /api/admin/roster — Add new staff member
router.post('/roster', requirePermission('roster:manage'), async (req, res, next) => {
  try {
    const {
      name, role, specialty, region, phone, email,
      hourly_rate, cpr_expiry_date, cno_registration_num,
      status, credential_status, vss_status, n95_fit_test
    } = req.body;

    if (!name || !role || !phone || !email) {
      return res.status(400).json({ success: false, error: 'Name, role, phone, and email are required.' });
    }

    const id = crypto.randomUUID();
    const countRes = await pool.query('SELECT COUNT(*) AS total FROM staff_roster');
    const nextNum = (countRes[0][0].total || 0) + 1;
    const staffCode = `STF-${String(nextNum).padStart(3, '0')}`;

    await pool.query(
      `INSERT INTO staff_roster
        (id, staff_code, name, role, specialty, region, phone, email,
         hourly_rate, cpr_expiry_date, cno_registration_num, status,
         credential_status, vss_status, n95_fit_test)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, staffCode, name, role, specialty || 'General Care',
        region || 'Greater Toronto Area', phone, email,
        parseFloat(hourly_rate) || 35.00,
        cpr_expiry_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        cno_registration_num || null,
        status || 'available',
        credential_status || 'verified',
        vss_status || 'Clear',
        n95_fit_test || '3M Valid'
      ]
    );

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), req.admin.id, req.admin.full_name,
       'STAFF_ADDED', 'staff_roster', id,
       `Added new staff ${name} (${role}) as ${staffCode}`, 'info', req.ip]
    );

    adminEvents.emit('status:changed', { entity: 'staff_roster', id, action: 'created' });

    res.status(201).json({
      success: true,
      message: `Staff member ${name} added successfully.`,
      data: { id, staff_code: staffCode }
    });
  } catch (err) { next(err); }
});

// PATCH /api/admin/roster/:id — Update existing staff member
router.patch('/roster/:id', requirePermission('roster:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name, role, specialty, status, credential_status, rating,
      region, phone, email, hourly_rate, cpr_expiry_date,
      cno_registration_num, vss_status, n95_fit_test
    } = req.body;

    const [existing] = await pool.query('SELECT * FROM staff_roster WHERE id = ?', [id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, error: 'Staff member not found.' });
    }

    const cur = existing[0];
    await pool.query(
      `UPDATE staff_roster SET
        name = ?, role = ?, specialty = ?, status = ?, credential_status = ?,
        rating = ?, region = ?, phone = ?, email = ?, hourly_rate = ?,
        cpr_expiry_date = ?, cno_registration_num = ?, vss_status = ?, n95_fit_test = ?
       WHERE id = ?`,
      [
        name ?? cur.name,
        role ?? cur.role,
        specialty ?? cur.specialty,
        status ?? cur.status,
        credential_status ?? cur.credential_status,
        rating ?? cur.rating,
        region ?? cur.region,
        phone ?? cur.phone,
        email ?? cur.email,
        hourly_rate ?? cur.hourly_rate,
        cpr_expiry_date ?? cur.cpr_expiry_date,
        cno_registration_num ?? cur.cno_registration_num,
        vss_status ?? cur.vss_status,
        n95_fit_test ?? cur.n95_fit_test,
        id
      ]
    );

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), req.admin.id, req.admin.full_name,
       'STAFF_UPDATED', 'staff_roster', id,
       `Updated profile for staff member ${cur.name} (${cur.staff_code})`, 'info', req.ip]
    );

    adminEvents.emit('status:changed', { entity: 'staff_roster', id, action: 'updated' });

    res.json({ success: true, message: `Staff profile for ${cur.name} updated successfully.` });
  } catch (err) { next(err); }
});

// ============================================================================
// CLINICAL CREDENTIALS & STAFF DOCUMENTS
// ============================================================================

// GET /api/admin/staff/:id/documents — Retrieve all documents for a staff member
router.get('/staff/:id/documents', async (req, res, next) => {
  try {
    const { id } = req.params;
    const [docs] = await pool.query(
      `SELECT id, staff_id, doc_type, title, file_name, file_size, mime_type, expiry_date, uploaded_by, created_at
       FROM staff_documents WHERE staff_id = ? ORDER BY created_at DESC`,
      [id]
    );
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
});

// POST /api/admin/staff/:id/documents — Upload new document / certificate
router.post('/staff/:id/documents', uploadCredential.single('document'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { doc_type, title, expiry_date } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file was uploaded.' });
    }

    const [staffRows] = await pool.query('SELECT name, staff_code FROM staff_roster WHERE id = ?', [id]);
    if (!staffRows.length) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, error: 'Staff member not found.' });
    }

    const docId = crypto.randomUUID();
    const docTitle = title || req.file.originalname;
    const docType = doc_type || 'other';

    await pool.query(
      `INSERT INTO staff_documents
        (id, staff_id, doc_type, title, file_path, file_name, file_size, mime_type, expiry_date, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        docId, id, docType, docTitle, req.file.path, req.file.originalname,
        req.file.size, req.file.mimetype, expiry_date || null, req.admin.full_name
      ]
    );

    // If doc is CPR or CNO and has expiry date, update caregiver profile
    if (expiry_date && (docType === 'cpr_card' || docType === 'cno_license')) {
      const exp = new Date(expiry_date);
      const today = new Date();
      const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const credStatus = exp < today ? 'expired' : (exp <= thirtyDays ? 'expiring' : 'verified');

      await pool.query(
        `UPDATE staff_roster SET cpr_expiry_date = ?, credential_status = ? WHERE id = ?`,
        [expiry_date, credStatus, id]
      );
    } else if (docType === 'vss_check') {
      await pool.query(`UPDATE staff_roster SET vss_status = 'Clear' WHERE id = ?`, [id]);
    } else if (docType === 'n95_fit') {
      await pool.query(`UPDATE staff_roster SET n95_fit_test = '3M Valid' WHERE id = ?`, [id]);
    }

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), req.admin.id, req.admin.full_name,
       'CREDENTIAL_UPLOADED', 'staff_documents', docId,
       `Uploaded ${docType} (${docTitle}) for ${staffRows[0].name} (${staffRows[0].staff_code})`, 'info', req.ip]
    );

    res.status(201).json({
      success: true,
      message: `Document "${docTitle}" uploaded successfully.`,
      data: {
        id: docId,
        staff_id: id,
        doc_type: docType,
        title: docTitle,
        file_name: req.file.originalname,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        expiry_date: expiry_date || null
      }
    });
  } catch (err) { next(err); }
});

// GET /api/admin/staff/documents/:docId/download — Preview or download credential document
router.get('/staff/documents/:docId/download', async (req, res, next) => {
  try {
    const { docId } = req.params;
    const [rows] = await pool.query('SELECT * FROM staff_documents WHERE id = ?', [docId]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    const doc = rows[0];
    if (!fs.existsSync(doc.file_path)) {
      return res.status(404).json({ success: false, error: 'Document file missing from server storage.' });
    }

    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.file_name)}"`);
    fs.createReadStream(doc.file_path).pipe(res);
  } catch (err) { next(err); }
});

// DELETE /api/admin/staff/documents/:docId — Delete document
router.delete('/staff/documents/:docId', async (req, res, next) => {
  try {
    const { docId } = req.params;
    const [rows] = await pool.query('SELECT * FROM staff_documents WHERE id = ?', [docId]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    const doc = rows[0];
    if (fs.existsSync(doc.file_path)) {
      fs.unlinkSync(doc.file_path);
    }

    await pool.query('DELETE FROM staff_documents WHERE id = ?', [docId]);

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), req.admin.id, req.admin.full_name,
       'CREDENTIAL_DELETED', 'staff_documents', docId,
       `Deleted document ${doc.title} (${doc.file_name})`, 'warning', req.ip]
    );

    res.json({ success: true, message: `Document "${doc.title}" deleted successfully.` });
  } catch (err) { next(err); }
});

// ============================================================================
// MANUAL SHIFT REQUEST CREATION (FROM ADMIN)
// POST /api/admin/requests
// ============================================================================
router.post('/requests', async (req, res, next) => {
  try {
    const {
      facility_name, unit_department, contact_name, contact_email, contact_phone,
      role_requested, shift_type, start_date, urgency_level, special_instructions,
      assigned_staff_id, status
    } = req.body;

    if (!facility_name || !contact_name || !contact_email || !contact_phone) {
      return res.status(400).json({ success: false, error: 'Facility, contact name, email, and phone are required.' });
    }

    const id = crypto.randomUUID();
    const reqCode = `REQ-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;

    await pool.query(
      `INSERT INTO staffing_requests
        (id, request_code, facility_name, unit_department, contact_name, contact_email, contact_phone,
         role_requested, shift_type, start_date, urgency_level, special_instructions, assigned_staff_id, status, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, reqCode, facility_name, unit_department || 'General Care', contact_name, contact_email, contact_phone,
        role_requested || 'RN', shift_type || 'Day Shift', start_date || new Date().toISOString().slice(0, 10),
        urgency_level || 'routine', special_instructions || null, assigned_staff_id || null,
        status || (assigned_staff_id ? 'dispatched' : 'pending'), req.ip
      ]
    );

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), req.admin.id, req.admin.full_name,
       'REQUEST_CREATED_ADMIN', 'staffing_requests', id,
       `Created shift request ${reqCode} for ${facility_name} (${role_requested})`, 'info', req.ip]
    );

    adminEvents.emit('request:created', {
      id,
      request_code: reqCode,
      facility_name,
      role_requested,
      shift_type,
      urgency_level: urgency_level || 'routine',
      status: status || (assigned_staff_id ? 'dispatched' : 'pending'),
      created_at: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      message: `Staffing request ${reqCode} created successfully.`,
      data: { id, request_code: reqCode }
    });
  } catch (err) { next(err); }
});

// ============================================================================
// AUDIT LOGS LEDGER
// GET /api/admin/audit-logs & GET /api/admin/audit
// ============================================================================
router.get(['/audit-logs', '/audit'], requirePermission('audit:view'), async (req, res, next) => {
  try {
    const [logs] = await pool.query(`
      SELECT id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 100
    `);
    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
});

// ============================================================================
// COMPLIANCE AUDIT ENGINE
// POST /api/admin/compliance/audit
// ============================================================================
router.post('/compliance/audit', requirePermission('roster:manage'), async (req, res, next) => {
  try {
    const [roster] = await pool.query('SELECT id, name, staff_code, cpr_expiry_date FROM staff_roster');
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    let expiredCount = 0;
    let expiringCount = 0;
    let verifiedCount = 0;

    for (const staff of roster) {
      let newStatus = 'verified';
      if (staff.cpr_expiry_date) {
        const expiry = new Date(staff.cpr_expiry_date);
        if (expiry < today) {
          newStatus = 'expired';
          expiredCount++;
        } else if (expiry <= thirtyDaysFromNow) {
          newStatus = 'expiring';
          expiringCount++;
        } else {
          verifiedCount++;
        }
      }

      await pool.query('UPDATE staff_roster SET credential_status = ? WHERE id = ?', [newStatus, staff.id]);
    }

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, details, severity, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), req.admin.id, req.admin.full_name,
       'COMPLIANCE_AUDIT', 'staff_roster',
       `Compliance scan complete: ${verifiedCount} verified, ${expiringCount} expiring, ${expiredCount} expired.`,
       expiredCount > 0 ? 'warning' : 'info', req.ip]
    );

    adminEvents.emit('status:changed', { entity: 'compliance_audit', verifiedCount, expiringCount, expiredCount });

    res.json({
      success: true,
      message: `Compliance audit completed: ${verifiedCount} verified, ${expiringCount} expiring (<30d), ${expiredCount} expired.`,
      data: { verifiedCount, expiringCount, expiredCount, totalAudited: roster.length }
    });
  } catch (err) { next(err); }
});

// ============================================================================
// CONTACT INQUIRIES & DISPATCH MESSAGES
// ============================================================================
// GET /api/admin/inquiries
router.get('/inquiries', requirePermission('inquiries:manage'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, inquiry_code, name, email, phone, inquiry_type, message, status, created_at FROM contact_inquiries ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /api/admin/inquiries/:id/reply
router.post('/inquiries/:id/reply', requirePermission('inquiries:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { replyMessage } = req.body;

    if (!replyMessage || !replyMessage.trim()) {
      return res.status(400).json({ success: false, error: 'Reply message cannot be empty.' });
    }

    const [rows] = await pool.query('SELECT * FROM contact_inquiries WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Inquiry not found.' });
    }

    const inq = rows[0];
    await pool.query('UPDATE contact_inquiries SET status = ? WHERE id = ?', ['in_progress', id]);

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), req.admin.id, req.admin.full_name,
       'DISPATCH_MESSAGE_SENT', 'contact_inquiries', id,
       `Sent dispatch message to ${inq.name} (${inq.email}): "${replyMessage.slice(0, 50)}..."`,
       'info', req.ip]
    );

    adminEvents.emit('inquiry:replied', {
      id,
      reply: replyMessage,
      sender: req.admin.full_name,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Reply sent and logged for ${inq.name}.`,
      data: {
        inquiryId: id,
        sender: req.admin.full_name,
        reply: replyMessage,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) { next(err); }
});

// ============================================================================
// ADMIN ACCOUNT MANAGEMENT (Super-Admin Only)
// ============================================================================

const createAdminSchema = z.object({
  email: z.string().email().max(191),
  full_name: z.string().min(2).max(100),
  role: z.enum(['super-admin', 'dispatch', 'care-coordinator', 'recruiter', 'auditor', 'custom']),
  password: z.string().min(8, 'Password must be at least 8 characters long')
});

// GET /api/admin/admins — list all admin accounts (super-admin only)
router.get('/admins', requirePermission('admins:manage'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, email, full_name, role, permissions, is_active, totp_enabled, email_verified, last_login, last_login_ip, failed_login_attempts, lock_until, created_at, updated_at FROM admins ORDER BY created_at ASC'
    );

    const formatted = rows.map(a => ({
      ...a,
      permissions: normalizePermissions(a.role, a.permissions)
    }));

    res.json({ success: true, data: formatted });
  } catch (err) { next(err); }
});

// PATCH /api/admin/admins/:id/permissions — configure role and granular permissions (super-admin only)
router.patch('/admins/:id/permissions', requirePermission('admins:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, permissions } = req.body;

    const VALID_ROLES = ['super-admin', 'dispatch', 'care-coordinator', 'recruiter', 'auditor', 'custom'];
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`
      });
    }

    const [rows] = await pool.query('SELECT id, email, full_name, role, permissions FROM admins WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Administrator account not found.' });
    }

    const targetAdmin = rows[0];

    // Self-demotion guard
    if (req.admin.id === id && role && role !== 'super-admin') {
      return res.status(400).json({
        success: false,
        error: 'Self-demotion prohibited: You cannot remove your own Super-Admin role.'
      });
    }

    const targetRole = role || targetAdmin.role;
    let targetPermissions = normalizePermissions(targetRole, permissions);

    if (targetRole === 'super-admin') {
      targetPermissions = ALL_PERMISSIONS;
    }

    await pool.query(
      'UPDATE admins SET role = ?, permissions = ? WHERE id = ?',
      [targetRole, JSON.stringify(targetPermissions), id]
    );

    const logDetails = `Super-admin ${req.admin.full_name} updated role to '${targetRole}' and configured ${targetPermissions.length} permissions for ${targetAdmin.full_name} (${targetAdmin.email})`;

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, 'ADMIN_PERMISSIONS_MODIFIED', 'admins', ?, ?, 'info', ?)`,
      [crypto.randomUUID(), req.admin.id, req.admin.full_name, id, logDetails, req.ip]
    );

    adminEvents.emit('admin:permissions_updated', {
      id,
      email: targetAdmin.email,
      role: targetRole,
      permissions: targetPermissions,
      modified_by: req.admin.full_name
    });

    res.json({
      success: true,
      message: `Permissions and role updated successfully for ${targetAdmin.full_name}.`,
      data: {
        id,
        email: targetAdmin.email,
        full_name: targetAdmin.full_name,
        role: targetRole,
        permissions: targetPermissions
      }
    });
  } catch (err) { next(err); }
});

// POST /api/admin/admins/:id/reset-mfa — reset 2FA for an admin user (super-admin only)
router.post('/admins/:id/reset-mfa', requirePermission('admins:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT id, email, full_name, role FROM admins WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Administrator account not found.' });
    }

    const targetAdmin = rows[0];
    await pool.query('UPDATE admins SET totp_enabled = 0, totp_secret = NULL WHERE id = ?', [id]);

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, 'ADMIN_MFA_RESET', 'admins', ?, ?, 'warning', ?)`,
      [crypto.randomUUID(), req.admin.id, req.admin.full_name, id,
       `Super-admin ${req.admin.full_name} reset Two-Factor Authentication credentials for ${targetAdmin.full_name} (${targetAdmin.email})`,
       req.ip]
    );

    res.json({
      success: true,
      message: `Two-Factor Authentication reset successfully for ${targetAdmin.full_name}. They can log in with password and set up new MFA.`
    });
  } catch (err) { next(err); }
});

// POST /api/admin/admins/:id/resend-verification — resend email verification OTP (super-admin only)
router.post('/admins/:id/resend-verification', requirePermission('admins:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT id, email, full_name, role, email_verified FROM admins WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Administrator account not found.' });
    }

    const targetAdmin = rows[0];
    const emailOtp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = crypto.createHash('sha256').update(emailOtp).digest('hex');

    await pool.query(
      'UPDATE admins SET email_verification_token = ?, email_verification_expires = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE id = ?',
      [hashedOtp, id]
    );

    await sendAdminEmailVerificationOtp(targetAdmin.email, targetAdmin.full_name, emailOtp);

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, 'ADMIN_VERIFICATION_RESENT', 'admins', ?, ?, 'info', ?)`,
      [crypto.randomUUID(), req.admin.id, req.admin.full_name, id,
       `Super-admin ${req.admin.full_name} re-dispatched email verification code to ${targetAdmin.email}`,
       req.ip]
    );

    res.json({
      success: true,
      message: `Verification email dispatched to ${targetAdmin.email}.`
    });
  } catch (err) { next(err); }
});

// POST /api/admin/admins — create a new admin account (super-admin only)
router.post('/admins', requirePermission('admins:manage'), async (req, res, next) => {
  try {
    const validated = createAdminSchema.parse(req.body);
    const emailLower = validated.email.toLowerCase().trim();

    // Check email uniqueness
    const [existing] = await pool.query('SELECT id FROM admins WHERE email = ?', [emailLower]);
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'An administrator account with this email address already exists.'
      });
    }

    const newId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(validated.password, 12);
    const emailOtp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = crypto.createHash('sha256').update(emailOtp).digest('hex');
    const initialPermissions = normalizePermissions(validated.role, req.body.permissions);

    await pool.query(
      `INSERT INTO admins (id, email, password_hash, full_name, role, permissions, is_active, failed_login_attempts, email_verified, email_verification_token, email_verification_expires)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
      [newId, emailLower, passwordHash, validated.full_name.trim(), validated.role, JSON.stringify(initialPermissions), hashedOtp]
    );

    // Send verification OTP to new administrator's corporate email
    await sendAdminEmailVerificationOtp(emailLower, validated.full_name.trim(), emailOtp);

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), req.admin.id, req.admin.full_name,
       'ADMIN_ACCOUNT_CREATED', 'admins', newId,
       `Super-admin ${req.admin.full_name} created new ${validated.role} account for ${validated.full_name} (${emailLower}) with verification requirement`,
       'info', req.ip]
    );

    adminEvents.emit('admin:created', {
      id: newId,
      email: emailLower,
      full_name: validated.full_name.trim(),
      role: validated.role,
      permissions: initialPermissions,
      created_by: req.admin.full_name
    });

    res.status(201).json({
      success: true,
      message: `Admin account provisioned for ${validated.full_name}. A verification email has been dispatched to ${emailLower}.`,
      data: {
        id: newId,
        email: emailLower,
        full_name: validated.full_name.trim(),
        role: validated.role,
        permissions: initialPermissions,
        is_active: 1,
        email_verified: 0
      }
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, error: err.errors.map(e => e.message).join(', ') });
    }
    next(err);
  }
});

// PATCH /api/admin/admins/:id — toggle active status on an admin account (super-admin only)
router.patch('/admins/:id', requirePermission('admins:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Self-deactivation guard
    if (req.admin.id === id) {
      return res.status(400).json({
        success: false,
        error: 'Self-deactivation is prohibited. You cannot deactivate your own active session.'
      });
    }

    const [rows] = await pool.query('SELECT id, email, full_name, role, is_active FROM admins WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Administrator account not found.' });
    }

    const targetAdmin = rows[0];
    const newActiveState = typeof req.body.is_active === 'boolean'
      ? (req.body.is_active ? 1 : 0)
      : (targetAdmin.is_active ? 0 : 1);

    await pool.query('UPDATE admins SET is_active = ? WHERE id = ?', [newActiveState, id]);

    const logAction = newActiveState ? 'ADMIN_ACCOUNT_REACTIVATED' : 'ADMIN_ACCOUNT_DEACTIVATED';
    const logSeverity = newActiveState ? 'info' : 'warning';
    const logDetails = `Super-admin ${req.admin.full_name} ${newActiveState ? 'reactivated' : 'deactivated'} account for ${targetAdmin.full_name} (${targetAdmin.email}, ${targetAdmin.role})`;

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), req.admin.id, req.admin.full_name,
       logAction, 'admins', id,
       logDetails, logSeverity, req.ip]
    );

    adminEvents.emit('admin:status_changed', {
      id,
      email: targetAdmin.email,
      is_active: newActiveState,
      modified_by: req.admin.full_name
    });

    res.json({
      success: true,
      message: `Admin account ${newActiveState ? 'reactivated' : 'deactivated'} successfully.`,
      data: {
        id,
        email: targetAdmin.email,
        full_name: targetAdmin.full_name,
        role: targetAdmin.role,
        is_active: newActiveState
      }
    });
  } catch (err) { next(err); }
});

// DELETE /api/admin/admins/:id — permanently delete an admin account (super-admin only)
router.delete('/admins/:id', requirePermission('admins:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Self-deletion guard
    if (req.admin.id === id) {
      return res.status(400).json({
        success: false,
        error: 'Self-deletion is prohibited. You cannot delete your own active account.'
      });
    }

    // 2. Fetch target account
    const [rows] = await pool.query('SELECT id, email, full_name, role, is_active FROM admins WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Administrator account not found.' });
    }

    const targetAdmin = rows[0];

    // 3. Last active super-admin safeguard
    if (targetAdmin.role === 'super-admin' && targetAdmin.is_active) {
      const [superAdmins] = await pool.query(
        "SELECT COUNT(*) AS total FROM admins WHERE role = 'super-admin' AND is_active = 1"
      );
      if (superAdmins[0].total <= 1) {
        return res.status(400).json({
          success: false,
          error: 'Action blocked: Cannot delete the last remaining active Super-Admin account. The system requires at least one active Super-Admin at all times.'
        });
      }
    }

    // 4. Atomic Transaction: Log audit record before deleting row
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
         VALUES (?, ?, ?, 'ADMIN_ACCOUNT_DELETED', 'admins', ?, ?, 'warning', ?)`,
        [
          crypto.randomUUID(),
          req.admin.id,
          req.admin.full_name,
          id,
          `Super-admin ${req.admin.full_name} permanently deleted administrator account for ${targetAdmin.full_name} (${targetAdmin.email}, ${targetAdmin.role})`,
          req.ip
        ]
      );

      await conn.query('DELETE FROM admins WHERE id = ?', [id]);

      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    adminEvents.emit('admin:deleted', {
      id,
      email: targetAdmin.email,
      full_name: targetAdmin.full_name,
      deleted_by: req.admin.full_name
    });

    res.json({
      success: true,
      message: `Administrator account for ${targetAdmin.full_name} (${targetAdmin.email}) deleted permanently.`,
      data: { id, email: targetAdmin.email, full_name: targetAdmin.full_name }
    });
  } catch (err) { next(err); }
});

module.exports = router;

