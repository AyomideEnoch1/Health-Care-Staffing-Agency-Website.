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
const { sendAdminEmailVerificationOtp, sendAdminInviteEmail, sendStaffWelcomeEmail } = require('../utils/mailer');

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
    const total = parseInt(requestCounts?.total_requests) || 0;
    const completed = parseInt(requestCounts?.completed_requests) || 0;
    const fillRate = total > 0 ? ((completed / total) * 100).toFixed(1) : null;

    res.json({
      success: true,
      data: {
        requests: {
          total:      parseInt(requestCounts?.total_requests)      || 0,
          pending:    parseInt(requestCounts?.pending_requests)    || 0,
          dispatched: parseInt(requestCounts?.dispatched_requests) || 0,
          completed:  parseInt(requestCounts?.completed_requests)  || 0,
          urgent:     parseInt(requestCounts?.urgent_pending)      || 0
        },
        applications: {
          total:      parseInt(appCounts?.total_applications) || 0,
          new:        parseInt(appCounts?.new_applications)   || 0,
          interview:  parseInt(appCounts?.interview_stage)    || 0,
          hired:      parseInt(appCounts?.hired)              || 0
        },
        roster: {
          total:     parseInt(rosterCounts?.total_staff)          || 0,
          available: parseInt(rosterCounts?.available_staff)      || 0,
          expiring:  parseInt(rosterCounts?.credentials_expiring) || 0
        },
        shift_fill_rate: fillRate // null if no data yet — UI shows "N/A"
      }
    });
  } catch (err) { next(err); }
});

// ============================================================================
// CLEAN ALL DUMMY DATA — Purge test & mock data across all tables
// POST /api/admin/clean-dummy-data
// ============================================================================
router.post('/clean-dummy-data', async (req, res, next) => {
  try {
    const tables = [
      'shift_punches',
      'staff_documents',
      'staffing_requests',
      'job_applications',
      'contact_inquiries',
      'audit_logs',
      'newsletter_subscribers'
    ];

    const results = {};
    for (const table of tables) {
      try {
        const [delResult] = await pool.query(`DELETE FROM \`${table}\``);
        results[table] = delResult.affectedRows || 0;
      } catch (tableErr) {
        results[table] = `skipped (${tableErr.message})`;
      }
    }

    try {
      const [rStaff] = await pool.query("DELETE FROM staff_roster");
      results.staff_roster = rStaff.affectedRows || 0;
    } catch (e) {
      results.staff_roster = `skipped (${e.message})`;
    }

    try {
      const [rUsers] = await pool.query("DELETE FROM users");
      results.users = rUsers.affectedRows || 0;
    } catch (e) {
      results.users = `skipped (${e.message})`;
    }

    try {
      const [rAdmins] = await pool.query(
        "DELETE FROM admins WHERE email NOT IN ('admin@divinefingershealthcare.ca', 'ayomidenoch15@gmail.com')"
      );
      results.admins = rAdmins.affectedRows || 0;
    } catch (_) {}

    if (pool.inMemoryStore) {
      pool.inMemoryStore.shift_punches = [];
      pool.inMemoryStore.staff_documents = [];
      pool.inMemoryStore.staffing_requests = [];
      pool.inMemoryStore.job_applications = [];
      pool.inMemoryStore.contact_inquiries = [];
      pool.inMemoryStore.audit_logs = [];
      pool.inMemoryStore.newsletter_subscribers = [];
      pool.inMemoryStore.staff_roster = [];
      pool.inMemoryStore.users = [];
    }

    res.json({
      success: true,
      message: 'All dummy records have been cleanly purged from database tables.',
      cleaned: results
    });
  } catch (err) {
    next(err);
  }
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

// GET /api/admin/newsletter — alias to view newsletter subscribers
router.get('/newsletter', requirePermission('newsletter:manage'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, email, status, source, ip_address, created_at FROM newsletter_subscribers ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows || [] });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
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

    // If marked as hired, auto-provision user account and staff roster record if not exists
    if (stage === 'hired') {
      try {
        const [appRows] = await pool.query('SELECT full_name, email, phone, role_applied FROM job_applications WHERE id = ?', [id]);
        if (appRows && appRows.length > 0) {
          const app = appRows[0];
          const emailClean = (app.email || '').toLowerCase().trim();
          if (emailClean) {
            // Check users table
            const [userRows] = await pool.query('SELECT id FROM users WHERE email = ?', [emailClean]);
            if (!userRows || userRows.length === 0) {
              const plainPassword = 'DivineFingers2026!';
              const salt = await bcrypt.genSalt(10);
              const passwordHash = await bcrypt.hash(plainPassword, salt);
              await pool.query(
                `INSERT INTO users (id, email, password_hash, full_name, role, phone, is_active, email_verified)
                 VALUES (?, ?, ?, ?, 'healthcare_worker', ?, 1, 1)`,
                [id, emailClean, passwordHash, app.full_name, app.phone || null]
              );
            } else {
              await pool.query(
                `UPDATE users SET is_active = 1, role = 'healthcare_worker' WHERE id = ?`,
                [userRows[0].id]
              );
            }

            // Check staff_roster table
            const [rosterRows] = await pool.query('SELECT id FROM staff_roster WHERE email = ?', [emailClean]);
            if (!rosterRows || rosterRows.length === 0) {
              const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM staff_roster');
              const nextNum = String((countRows?.[0]?.total || 0) + 1).padStart(3, '0');
              const staffCode = `STF-${nextNum}`;
              await pool.query(
                `INSERT INTO staff_roster
                  (id, name, role, specialty, status, credential_status, rating, region, phone, email, staff_code)
                 VALUES (?, ?, ?, ?, 'active', 'verified', 5.0, 'GTA', ?, ?, ?)`,
                [id, app.full_name, app.role_applied || 'Registered Nurse (RN)', 'General', app.phone || null, emailClean, staffCode]
              );
            }
          }
        }
      } catch (provErr) {
        console.warn('[Auto-Hire Provisioning Warning]:', provErr.message);
      }
    }

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
              hourly_rate, availability_schedule, cpr_expiry_date, vss_status, n95_fit_test, avatar_url
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
      status, credential_status, vss_status, n95_fit_test,
      initial_password
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
        status || 'pending_verification',
        credential_status || 'pending',
        vss_status || 'Not Uploaded',
        n95_fit_test || 'Not Uploaded'
      ]
    );

    // Auto-provision user account in `users` table so hired staff can immediately log into the Staff Portal
    const emailClean = email.toLowerCase().trim();
    try {
      const [existingUser] = await pool.query('SELECT id FROM users WHERE email = ?', [emailClean]);
      if (!existingUser || existingUser.length === 0) {
        const plainPassword = initial_password || 'DivineFingers2026!';
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(plainPassword, salt);
        await pool.query(
          `INSERT INTO users (id, email, password_hash, full_name, role, phone, is_active, email_verified)
            VALUES (?, ?, ?, ?, 'healthcare_worker', ?, 1, 1)`,
          [id, emailClean, passwordHash, name.trim(), phone ? phone.trim() : null]
        );

        // Send email with portal link and temporary password
        sendStaffWelcomeEmail({
          name: name.trim(),
          email: emailClean,
          staff_code: staffCode,
          temporary_password: plainPassword
        }).catch(err => console.warn('[Mailer Error]:', err.message));
      } else {
        await pool.query(
          `UPDATE users SET is_active = 1, role = 'healthcare_worker' WHERE id = ?`,
          [existingUser[0].id]
        );
      }
    } catch (userErr) {
      console.warn('[Staff User Provisioning Warning]:', userErr.message);
    }

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), req.admin.id, req.admin.full_name,
       'STAFF_ADDED', 'staff_roster', id,
       `Added new staff ${name} (${role}) as ${staffCode} (Portal Login Provisioned)`, 'info', req.ip]
    );

    adminEvents.emit('status:changed', { entity: 'staff_roster', id, action: 'created' });

    res.status(201).json({
      success: true,
      message: `Staff member ${name} onboarded successfully. Initial password: ${initial_password || 'DivineFingers2026!'}`,
      data: { id, staff_code: staffCode, email: emailClean, initial_password: initial_password || 'DivineFingers2026!', login_provisioned: true }
    });
  } catch (err) { next(err); }
});

// POST /api/admin/staff/:id/reset-password — Admin resets caregiver portal password
router.post('/staff/:id/reset-password', requirePermission('roster:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body || {};
    const temporaryPassword = new_password && new_password.trim() ? new_password.trim() : 'DivineFingers2026!';

    // Find staff
    const [staffRows] = await pool.query('SELECT id, name, email, staff_code FROM staff_roster WHERE id = ? LIMIT 1', [id]);
    if (!staffRows || staffRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Staff member not found on roster.' });
    }
    const staff = staffRows[0];

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(temporaryPassword, salt);

    // Update in users table by email or id
    const [updateRes] = await pool.query(
      'UPDATE users SET password_hash = ?, is_active = 1 WHERE email = ? OR id = ?',
      [passwordHash, staff.email, id]
    );

    if (!updateRes || updateRes.affectedRows === 0) {
      // If user row didn't exist, create it
      await pool.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, is_active, email_verified)
         VALUES (?, ?, ?, ?, 'healthcare_worker', 1, 1)`,
        [id, staff.email, passwordHash, staff.name]
      );
    }

    if (pool.inMemoryStore && pool.inMemoryStore.users) {
      for (const u of pool.inMemoryStore.users) {
        if (u.email === staff.email || u.id === id) {
          u.password_hash = passwordHash;
          u.is_active = 1;
        }
      }
    }

    // Send email with new password
    sendStaffWelcomeEmail({
      name: staff.name,
      email: staff.email,
      staff_code: staff.staff_code,
      temporary_password: temporaryPassword
    }).catch(err => console.warn('[Mailer Error]:', err.message));

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, 'STAFF_PASSWORD_RESET', 'staff_roster', ?, ?, 'warn', ?)`,
      [crypto.randomUUID(), req.admin.id, req.admin.full_name, id, `Reset portal password for ${staff.name} (${staff.email})`, req.ip]
    ).catch(() => {});

    res.json({
      success: true,
      message: `Temporary password for ${staff.name} reset to "${temporaryPassword}" and emailed.`,
      temporary_password: temporaryPassword
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

// POST /api/admin/roster/:id/approve — Verify credentials & activate staff dispatch
router.post('/roster/:id/approve', requirePermission('roster:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query('SELECT * FROM staff_roster WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Staff member not found.' });
    }

    const cur = existing[0];
    await pool.query(
      `UPDATE staff_roster SET credential_status = 'verified', status = 'available' WHERE id = ?`,
      [id]
    );

    // Also activate corresponding users record if present
    if (cur.email) {
      await pool.query(
        `UPDATE users SET is_active = 1 WHERE email = ?`,
        [cur.email.toLowerCase().trim()]
      ).catch(() => {});
    }

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), req.admin.id, req.admin.full_name,
       'STAFF_APPROVED', 'staff_roster', id,
       `Approved clinical credentials and activated dispatch for ${cur.name} (${cur.staff_code || id})`, 'info', req.ip]
    );

    adminEvents.emit('status:changed', { entity: 'staff_roster', id, action: 'verified' });

    res.json({
      success: true,
      message: `Staff credentials for ${cur.name} have been approved and activated for clinical dispatch.`,
      data: { id, credential_status: 'verified', status: 'available' }
    });
  } catch (err) { next(err); }
});

// ============================================================================
// CLINICAL CREDENTIALS & STAFF DOCUMENTS
// ============================================================================

// GET /api/admin/staff/:id/availability — Retrieve caregiver's submitted 7-day availability
router.get('/staff/:id/availability', async (req, res, next) => {
  try {
    const { id } = req.params;
    const [staffRows] = await pool.query('SELECT id, email, name, availability_schedule FROM staff_roster WHERE id = ?', [id]);
    let email = '';
    let dbAvail = null;
    if (staffRows.length > 0) {
      if (staffRows[0].email) email = staffRows[0].email.toLowerCase().trim();
      if (staffRows[0].availability_schedule) {
        try { dbAvail = JSON.parse(staffRows[0].availability_schedule); } catch (e) {}
      }
    }
    const store = global.staffAvailabilityStore || {};
    const avail = dbAvail || store[email] || store[id] || [true, true, true, true, true, false, false];
    res.json({ success: true, availability: avail, days: avail });
  } catch (err) { next(err); }
});

// GET /api/admin/staff/:id/documents — Retrieve all documents for a staff member
router.get('/staff/:id/documents', async (req, res, next) => {
  try {
    const { id } = req.params;
    const [docs] = await pool.query(
      `SELECT id, staff_id, doc_type, title, file_name, file_size, mime_type, expiry_date, uploaded_by, created_at,
              status, verified_at, verified_by, credential_value
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
        (id, staff_id, doc_type, title, file_path, file_name, file_size, mime_type, expiry_date, uploaded_by, status, verified_at, verified_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', NOW(), ?)`,
      [
        docId, id, docType, docTitle, req.file.path, req.file.originalname,
        req.file.size, req.file.mimetype, expiry_date || null, req.admin.full_name, req.admin.full_name
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
       `Uploaded and verified ${docType} (${docTitle}) for ${staffRows[0].name} (${staffRows[0].staff_code})`, 'info', req.ip]
    );

    res.status(201).json({
      success: true,
      message: `Document "${docTitle}" uploaded and verified successfully.`,
      data: {
        id: docId,
        staff_id: id,
        doc_type: docType,
        title: docTitle,
        file_name: req.file.originalname,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        expiry_date: expiry_date || null,
        status: 'verified'
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

// PATCH /api/admin/staff/documents/:docId/verify — Verify and approve staff credential document
router.patch('/staff/documents/:docId/verify', async (req, res, next) => {
  try {
    const { docId } = req.params;
    const { status = 'verified', doc_type, credential_value, expiry_date } = req.body || {};

    const [docs] = await pool.query('SELECT * FROM staff_documents WHERE id = ?', [docId]);
    if (!docs.length) {
      return res.status(404).json({ success: false, error: 'Credential document not found.' });
    }
    const doc = docs[0];
    const finalDocType = doc_type || doc.doc_type || 'other';
    const finalExpiry = expiry_date || doc.expiry_date;
    const finalValue = credential_value || doc.credential_value || null;
    const adminName = (req.admin && req.admin.full_name) || 'Administrator';

    // 1. Update document status
    await pool.query(
      `UPDATE staff_documents
       SET status = ?, verified_at = NOW(), verified_by = ?, doc_type = ?, expiry_date = ?, credential_value = ?
       WHERE id = ?`,
      [status, adminName, finalDocType, finalExpiry || null, finalValue, docId]
    );

    // 2. Update staff_roster record to record the credential
    const [staffRows] = await pool.query('SELECT * FROM staff_roster WHERE id = ?', [doc.staff_id]);
    if (staffRows.length > 0) {
      const staff = staffRows[0];
      const updates = [];
      const params = [];

      if (finalDocType === 'cno_license' || finalValue) {
        updates.push('cno_registration_num = ?');
        params.push(finalValue || staff.cno_registration_num || 'CNO-RN-884920');
      }
      if (finalDocType === 'cpr_card' || finalExpiry) {
        if (finalExpiry) {
          updates.push('cpr_expiry_date = ?');
          params.push(finalExpiry);
        }
      }
      if (finalDocType === 'vss_check') {
        updates.push("vss_status = 'Clear'");
      }
      if (finalDocType === 'n95_fit') {
        updates.push("n95_fit_test = '3M Valid'");
      }

      // Check all documents for this staff member to ensure all core requirements are satisfied
      const [allStaffDocs] = await pool.query(
        'SELECT doc_type, status FROM staff_documents WHERE staff_id = ?',
        [doc.staff_id]
      );
      const verifiedTypes = new Set(
        allStaffDocs.filter(d => d.status === 'verified' || (d.id === docId && status === 'verified')).map(d => d.doc_type)
      );
      if (status === 'verified') {
        verifiedTypes.add(finalDocType);
      }

      const isNurse = ['RN', 'RPN'].includes(staff.role);
      const hasLicense = isNurse ? verifiedTypes.has('cno_license') : true;
      const allCoreDone = hasLicense && verifiedTypes.has('cpr_card') && verifiedTypes.has('vss_check') && verifiedTypes.has('n95_fit');

      if (allCoreDone) {
        updates.push("credential_status = 'verified'");
      } else {
        updates.push("credential_status = 'pending'");
      }

      if (updates.length > 0) {
        params.push(doc.staff_id);
        await pool.query(`UPDATE staff_roster SET ${updates.join(', ')} WHERE id = ?`, params);
      }
    }

    // 3. Audit log
    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, 'CREDENTIAL_VERIFIED', 'staff_documents', ?, ?, 'info', ?)`,
      [
        crypto.randomUUID(),
        req.admin ? req.admin.id : null,
        adminName,
        docId,
        `Approved & recorded ${finalDocType} (${doc.title}) for staff ID ${doc.staff_id}. Status: ${status}`,
        req.ip
      ]
    ).catch(() => {});

    adminEvents.emit('status:changed', {
      entity: 'staff_documents',
      id: docId,
      staff_id: doc.staff_id,
      action: 'verified',
      status
    });

    res.json({
      success: true,
      message: `Credential "${doc.title}" approved and recorded on staff profile!`,
      data: {
        id: docId,
        status,
        doc_type: finalDocType,
        credential_value: finalValue,
        verified_at: new Date().toISOString()
      }
    });
  } catch (err) { next(err); }
});

// PATCH /api/admin/staff/:id/quick-credentials — Directly update CNO, CPR, VSS, N95 credentials
router.patch('/staff/:id/quick-credentials', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cno_registration_num, cpr_expiry_date, vss_status, n95_fit_test, credential_status } = req.body || {};

    const [staffRows] = await pool.query('SELECT * FROM staff_roster WHERE id = ?', [id]);
    if (!staffRows.length) {
      return res.status(404).json({ success: false, error: 'Staff member not found.' });
    }

    const updates = [];
    const params = [];

    if (cno_registration_num !== undefined) {
      updates.push('cno_registration_num = ?');
      params.push(cno_registration_num || null);
    }
    if (cpr_expiry_date !== undefined) {
      updates.push('cpr_expiry_date = ?');
      params.push(cpr_expiry_date || null);
    }
    if (vss_status !== undefined) {
      updates.push('vss_status = ?');
      params.push(vss_status || 'Clear');
    }
    if (n95_fit_test !== undefined) {
      updates.push('n95_fit_test = ?');
      params.push(n95_fit_test || '3M Valid');
    }
    if (credential_status !== undefined) {
      updates.push('credential_status = ?');
      params.push(credential_status || 'verified');
    }

    if (updates.length > 0) {
      params.push(id);
      await pool.query(`UPDATE staff_roster SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const adminName = (req.admin && req.admin.full_name) || 'Administrator';
    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, 'STAFF_CREDENTIALS_UPDATED', 'staff_roster', ?, ?, 'info', ?)`,
      [
        crypto.randomUUID(),
        req.admin ? req.admin.id : null,
        adminName,
        id,
        `Directly updated clinical credentials for ${staffRows[0].name}`,
        req.ip
      ]
    ).catch(() => {});

    adminEvents.emit('status:changed', { entity: 'staff_roster', id, action: 'updated' });

    res.json({
      success: true,
      message: 'Staff clinical credentials updated and recorded successfully.'
    });
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
  password: z.string().min(8, 'Password must be at least 8 characters long').optional().or(z.literal(''))
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
    const hasTypedPassword = Boolean(validated.password && validated.password.trim().length >= 8);
    const initialSecret = hasTypedPassword ? validated.password.trim() : crypto.randomBytes(24).toString('base64url');
    const passwordHash = await bcrypt.hash(initialSecret, 12);
    const emailOtp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = crypto.createHash('sha256').update(emailOtp).digest('hex');
    const initialPermissions = normalizePermissions(validated.role, req.body.permissions);

    const isEmailVerified = hasTypedPassword ? 1 : 0;
    await pool.query(
      `INSERT INTO admins (id, email, password_hash, full_name, role, permissions, is_active, failed_login_attempts, email_verified, email_verification_token, email_verification_expires)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
      [newId, emailLower, passwordHash, validated.full_name.trim(), validated.role, JSON.stringify(initialPermissions), isEmailVerified, hasTypedPassword ? null : hashedOtp]
    );

    // Send invitation email and verification OTP to new administrator's corporate email if mailer configured
    try {
      const inviteToken = crypto.randomBytes(24).toString('hex');
      await sendAdminInviteEmail(emailLower, validated.full_name.trim(), inviteToken, validated.role);
      if (!isEmailVerified) {
        await sendAdminEmailVerificationOtp(emailLower, validated.full_name.trim(), emailOtp);
      }
    } catch (mailErr) {
      console.warn('[Admin Creation Mailer Intercept]:', mailErr.message);
    }

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), req.admin.id, req.admin.full_name,
       'ADMIN_ACCOUNT_CREATED', 'admins', newId,
       `Super-admin ${req.admin.full_name} provisioned new ${validated.role} account for ${validated.full_name} (${emailLower}) with ${hasTypedPassword ? 'direct credential access' : 'activation invite'}`,
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
      message: `Admin account provisioned for ${validated.full_name}. ${hasTypedPassword ? 'Account is active and ready to sign in.' : 'Activation invite dispatched.'}`,
      data: {
        id: newId,
        email: emailLower,
        full_name: validated.full_name.trim(),
        role: validated.role,
        permissions: initialPermissions,
        is_active: 1,
        email_verified: isEmailVerified,
        invite_dispatched: true
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

// ============================================================================
// FACILITIES & MSA RATE CARDS (INTERNAL ADMIN / ACCOUNT MANAGEMENT ONLY)
// ============================================================================

const facilitySchema = z.object({
  name: z.string().min(2).max(255),
  facility_code: z.string().max(20).optional(),
  address: z.string().max(255).optional().nullable(),
  region: z.string().max(80).optional().nullable(),
  contact_name: z.string().max(100).optional().nullable(),
  contact_email: z.string().email().max(191).optional().nullable().or(z.literal('')),
  contact_phone: z.string().max(30).optional().nullable(),
  msa_signed_date: z.string().max(10).optional().nullable(),
  msa_expiry_date: z.string().max(10).optional().nullable(),
  msa_document_url: z.string().max(500).optional().nullable(),
  status: z.enum(['active', 'pending', 'expired']).optional().default('pending')
});

const rateCardTermSchema = z.object({
  role: z.enum(['RN', 'RPN', 'PSW', 'Companion', 'Travel Nurse', 'Multiple']),
  shift_type: z.string().max(60).optional().default('standard'),
  bill_rate: z.number().positive(),
  pay_rate: z.number().positive().optional().nullable(),
  overtime_multiplier: z.number().positive().optional().default(1.50),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(1000).optional().nullable()
});

// GET /api/admin/facilities — List all facilities with MSA status & rate card stats
router.get('/facilities', async (req, res, next) => {
  try {
    const [facilities] = await pool.query(`
      SELECT 
        f.*,
        COUNT(DISTINCT CASE WHEN (frc.expiry_date IS NULL OR frc.expiry_date >= CURDATE()) THEN frc.id END) AS active_rate_cards_count,
        COUNT(DISTINCT frc.id) AS total_rate_cards_count,
        MAX(frc.created_at) AS last_rate_updated_at
      FROM facilities f
      LEFT JOIN facility_rate_cards frc ON frc.facility_id = f.id
      GROUP BY f.id
      ORDER BY f.name ASC
    `);

    // Enhance facilities with MSA expiry alert flags
    const today = new Date();
    const formatted = (facilities || []).map(fac => {
      let isExpired = fac.status === 'expired';
      let isExpiringSoon = false;
      let daysUntilExpiry = null;

      if (fac.msa_expiry_date) {
        const expDate = new Date(fac.msa_expiry_date);
        const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
        daysUntilExpiry = diffDays;
        if (diffDays <= 0) {
          isExpired = true;
        } else if (diffDays <= 30) {
          isExpiringSoon = true;
        }
      }

      return {
        ...fac,
        effective_status: isExpired ? 'expired' : fac.status,
        is_expiring_soon: isExpiringSoon,
        days_until_expiry: daysUntilExpiry,
        active_rate_cards_count: Number(fac.active_rate_cards_count || 0),
        total_rate_cards_count: Number(fac.total_rate_cards_count || 0)
      };
    });

    res.json({
      success: true,
      data: formatted,
      count: formatted.length
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/facilities — Create a new healthcare facility profile
router.post('/facilities', async (req, res, next) => {
  try {
    const parsed = facilitySchema.parse(req.body);
    const id = crypto.randomUUID();
    let facilityCode = parsed.facility_code;

    if (!facilityCode) {
      const prefix = parsed.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'FAC';
      facilityCode = `FAC-${prefix}-${Math.floor(10 + Math.random() * 90)}`;
    }

    await pool.query(`
      INSERT INTO facilities 
        (id, name, facility_code, address, region, contact_name, contact_email, contact_phone, msa_signed_date, msa_expiry_date, msa_document_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      parsed.name,
      facilityCode,
      parsed.address || null,
      parsed.region || 'Greater Toronto Area',
      parsed.contact_name || null,
      parsed.contact_email || null,
      parsed.contact_phone || null,
      parsed.msa_signed_date || null,
      parsed.msa_expiry_date || null,
      parsed.msa_document_url || null,
      parsed.status || 'pending'
    ]);

    // Audit log
    await pool.query(`
      INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
      VALUES (?, ?, ?, 'FACILITY_CREATED', 'facilities', ?, ?, 'info', ?)
    `, [
      crypto.randomUUID(),
      req.admin.id,
      req.admin.full_name,
      id,
      `Created facility profile ${parsed.name} (${facilityCode}) with MSA status '${parsed.status}'`,
      req.ip
    ]);

    res.status(201).json({
      success: true,
      message: `Facility "${parsed.name}" created successfully.`,
      data: { id, facility_code: facilityCode, ...parsed }
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
    }
    next(err);
  }
});

// PATCH /api/admin/facilities/:id — Update facility details & MSA metadata
router.patch('/facilities/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query('SELECT * FROM facilities WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Facility not found' });
    }

    const current = existing[0];
    const updates = [];
    const params = [];

    const allowed = ['name', 'address', 'region', 'contact_name', 'contact_email', 'contact_phone', 'msa_signed_date', 'msa_expiry_date', 'msa_document_url', 'status'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(req.body[key] === '' ? null : req.body[key]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields provided to update' });
    }

    params.push(id);
    await pool.query(`UPDATE facilities SET ${updates.join(', ')} WHERE id = ?`, params);

    // Audit log
    await pool.query(`
      INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
      VALUES (?, ?, ?, 'FACILITY_UPDATED', 'facilities', ?, ?, 'info', ?)
    `, [
      crypto.randomUUID(),
      req.admin.id,
      req.admin.full_name,
      id,
      `Updated facility ${current.name}: modified ${updates.map(u => u.split(' =')[0]).join(', ')}`,
      req.ip
    ]);

    const [updated] = await pool.query('SELECT * FROM facilities WHERE id = ?', [id]);
    res.json({
      success: true,
      message: 'Facility details updated successfully.',
      data: updated[0]
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/facilities/:facilityId/rate-cards — List rate cards for a facility
router.get('/facilities/:facilityId/rate-cards', async (req, res, next) => {
  try {
    const { facilityId } = req.params;
    const [cards] = await pool.query(`
      SELECT 
        frc.*,
        CASE 
          WHEN (frc.expiry_date IS NULL OR frc.expiry_date >= CURDATE()) THEN 1 
          ELSE 0 
        END AS is_active
      FROM facility_rate_cards frc
      WHERE frc.facility_id = ?
      ORDER BY is_active DESC, frc.role ASC, frc.shift_type ASC, frc.effective_date DESC
    `, [facilityId]);

    res.json({
      success: true,
      data: cards || [],
      count: (cards || []).length
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/facilities/:facilityId/rate-cards — Add new contracted rate term with auto-expiry
router.post('/facilities/:facilityId/rate-cards', async (req, res, next) => {
  const { facilityId } = req.params;
  const conn = await pool.getConnection();

  try {
    const parsed = rateCardTermSchema.parse(req.body);

    const [facCheck] = await conn.query('SELECT id, name, status FROM facilities WHERE id = ?', [facilityId]);
    if (!facCheck || facCheck.length === 0) {
      return res.status(404).json({ success: false, error: 'Facility not found' });
    }
    const facility = facCheck[0];

    await conn.beginTransaction();

    // 1. Auto-expire previous active term for (facility_id, role, shift_type)
    // Expiry date is set to 1 day prior to the new term's effective date
    await conn.query(`
      UPDATE facility_rate_cards
      SET expiry_date = DATE_SUB(?, INTERVAL 1 DAY)
      WHERE facility_id = ?
        AND role = ?
        AND shift_type = ?
        AND (expiry_date IS NULL OR expiry_date >= ?)
    `, [parsed.effective_date, facilityId, parsed.role, parsed.shift_type, parsed.effective_date]);

    // 2. Insert the new contracted rate term
    const termId = crypto.randomUUID();
    await conn.query(`
      INSERT INTO facility_rate_cards
        (id, facility_id, role, shift_type, bill_rate, pay_rate, overtime_multiplier, effective_date, expiry_date, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `, [
      termId,
      facilityId,
      parsed.role,
      parsed.shift_type,
      parsed.bill_rate,
      parsed.pay_rate || null,
      parsed.overtime_multiplier || 1.50,
      parsed.effective_date,
      parsed.notes || null,
      req.admin.full_name || req.admin.email
    ]);

    // 3. If facility was pending, activate it now that a contracted rate card exists
    if (facility.status === 'pending') {
      await conn.query(`UPDATE facilities SET status = 'active' WHERE id = ?`, [facilityId]);
    }

    // 4. Record audit log
    await conn.query(`
      INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
      VALUES (?, ?, ?, 'RATE_CARD_TERM_CREATED', 'facility_rate_cards', ?, ?, 'info', ?)
    `, [
      crypto.randomUUID(),
      req.admin.id,
      req.admin.full_name,
      termId,
      `Contracted rate term added for ${facility.name}: ${parsed.role} (${parsed.shift_type}) bill rate \$${parsed.bill_rate}/hr effective ${parsed.effective_date}. Auto-expired prior active term.`,
      req.ip
    ]);

    await conn.commit();

    // Emit live event for connected admin dashboards
    adminEvents.emit('rate_card:created', {
      facility_id: facilityId,
      facility_name: facility.name,
      term_id: termId,
      role: parsed.role,
      shift_type: parsed.shift_type,
      bill_rate: parsed.bill_rate,
      effective_date: parsed.effective_date
    });

    res.status(201).json({
      success: true,
      message: `Rate card term established for ${facility.name} (${parsed.role} - \$${parsed.bill_rate}/hr).`,
      data: {
        id: termId,
        facility_id: facilityId,
        ...parsed,
        expiry_date: null,
        is_active: 1
      }
    });
  } catch (err) {
    await conn.rollback();
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
    }
    next(err);
  } finally {
    conn.release();
  }
});

// DELETE /api/admin/facilities/:facilityId/rate-cards/:rateCardId — Remove an erroneous term
router.delete('/facilities/:facilityId/rate-cards/:rateCardId', async (req, res, next) => {
  try {
    const { facilityId, rateCardId } = req.params;
    const [cardRows] = await pool.query('SELECT * FROM facility_rate_cards WHERE id = ? AND facility_id = ?', [rateCardId, facilityId]);
    if (!cardRows || cardRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Rate card term not found' });
    }

    const card = cardRows[0];
    await pool.query('DELETE FROM facility_rate_cards WHERE id = ?', [rateCardId]);

    await pool.query(`
      INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
      VALUES (?, ?, ?, 'RATE_CARD_TERM_DELETED', 'facility_rate_cards', ?, ?, 'warning', ?)
    `, [
      crypto.randomUUID(),
      req.admin.id,
      req.admin.full_name,
      rateCardId,
      `Removed rate term for ${card.role} (${card.shift_type} - \$${card.bill_rate}/hr) from facility ${facilityId}`,
      req.ip
    ]);

    res.json({
      success: true,
      message: 'Rate card term deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/requests/:id/rate-exception — Admin-only one-off exception on a specific shift
router.patch('/requests/:id/rate-exception', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { billing_hourly_rate, reason } = req.body;

    const [reqRows] = await pool.query('SELECT * FROM staffing_requests WHERE id = ?', [id]);
    if (!reqRows || reqRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Staffing request not found' });
    }
    const shift = reqRows[0];

    const newRate = billing_hourly_rate != null && billing_hourly_rate !== '' ? parseFloat(billing_hourly_rate) : null;
    if (newRate !== null && (isNaN(newRate) || newRate <= 0)) {
      return res.status(400).json({ success: false, error: 'Invalid hourly rate amount' });
    }

    await pool.query('UPDATE staffing_requests SET billing_hourly_rate = ? WHERE id = ?', [newRate, id]);

    await pool.query(`
      INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
      VALUES (?, ?, ?, 'SHIFT_RATE_EXCEPTION_SET', 'staffing_requests', ?, ?, 'info', ?)
    `, [
      crypto.randomUUID(),
      req.admin.id,
      req.admin.full_name,
      id,
      `Admin ${req.admin.full_name} set one-off rate exception on ${shift.request_code}: \$${newRate || 'Default'}/hr. Reason: ${reason || 'N/A'}`,
      req.ip
    ]);

    adminEvents.emit('request:rate_updated', {
      id,
      request_code: shift.request_code,
      billing_hourly_rate: newRate,
      updated_by: req.admin.full_name
    });

    res.json({
      success: true,
      message: `Shift ${shift.request_code} rate exception updated to \$${newRate || 'Default'}/hr.`,
      data: { id, billing_hourly_rate: newRate }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;


