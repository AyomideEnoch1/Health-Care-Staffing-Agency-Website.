/**
 * Public Users Authentication Route
 * Divine Fingers Healthcare Services Inc.
 *
 * Supports self-service registration and login for:
 *  - Healthcare Facilities / Clients (Hospitals, LTC, Clinics)
 *  - Healthcare Workers (RNs, RPNs, PSWs, Companions)
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const pool = require('../db');
const { authLoginLimiter } = require('../middleware/rateLimiter');
const adminEvents = require('../utils/events');

const JWT_SECRET = process.env.JWT_SECRET || 'divine_fingers_default_secure_jwt_secret_key_2026_production_fallback';
const USER_COOKIE_NAME = 'df_user_session';

function buildUserCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/'
  };
}

// Validation schemas
const registerSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters long.' }),
  full_name: z.string().min(2, { message: 'Full name must be at least 2 characters.' }),
  role: z.enum(['client', 'healthcare_worker'], { message: 'Please select an account type.' }),
  clinical_role: z.enum(['RN', 'RPN', 'PSW', 'Companion', 'Travel Nurse']).optional().nullable(),
  organization_name: z.string().optional().nullable(),
  phone: z.string().optional().nullable()
});

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' })
});

// ── POST /api/users/register ────────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const emailClean = data.email.toLowerCase().trim();
    console.log(`[AUTH REGISTER] Request received for: ${emailClean} (role: ${data.role})`);

    // Prohibit public self-registration for healthcare staff
    if (data.role === 'healthcare_worker') {
      return res.status(403).json({
        success: false,
        error: 'Public healthcare staff self-registration is disabled. Clinical staff accounts are provisioned exclusively by Divine Fingers Clinical Operations following credential vetting. To apply for our roster, please submit an application at /jobseekers.html#apply-now.'
      });
    }

    // Check if user already exists in users table
    const [existingUser] = await pool.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [emailClean]
    );

    if (existingUser && existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists in the portal. Please sign in.'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(data.password, salt);
    const userId = crypto.randomUUID();

    // If registering as a healthcare facility client, resolve or auto-provision linked facility
    let facilityId = null;
    const orgName = data.organization_name ? data.organization_name.trim() : null;

    if (data.role === 'client' && orgName) {
      try {
        const [facMatch] = await pool.query(
          'SELECT id, facility_code FROM facilities WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1',
          [orgName]
        );

        if (facMatch && facMatch.length > 0) {
          facilityId = facMatch[0].id;
        } else {
          const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM facilities');
          const nextNum = ((countRows && countRows[0] && countRows[0].total) || 0) + 1;
          const facilityCode = `FAC-${String(nextNum).padStart(3, '0')}`;
          facilityId = crypto.randomUUID();

          await pool.query(
            `INSERT INTO facilities 
              (id, name, facility_code, address, region, contact_name, contact_email, contact_phone, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
            [
              facilityId,
              orgName,
              facilityCode,
              'GTA / Client Self-Registered',
              'Greater Toronto Area',
              data.full_name.trim(),
              emailClean,
              data.phone ? data.phone.trim() : null
            ]
          );

          // Broadcast facility created to admin dashboard
          adminEvents.emit('facility:created', {
            id: facilityId,
            name: orgName,
            facility_code: facilityCode,
            status: 'pending',
            contact_name: data.full_name.trim(),
            contact_email: emailClean,
            created_at: new Date().toISOString()
          });
        }
      } catch (facErr) {
        console.warn('[Facility Auto-Link Warning]:', facErr.message);
      }
    }

    // Insert user with facility_id
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, organization_name, facility_id, phone, is_active, email_verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, NOW(), NOW())`,
      [
        userId,
        emailClean,
        password_hash,
        data.full_name.trim(),
        data.role,
        orgName,
        facilityId,
        data.phone ? data.phone.trim() : null
      ]
    );

    // Broadcast client registration event to admin dashboard
    adminEvents.emit('client:registered', {
      id: userId,
      email: emailClean,
      full_name: data.full_name.trim(),
      organization_name: orgName,
      facility_id: facilityId,
      phone: data.phone ? data.phone.trim() : null,
      created_at: new Date().toISOString()
    });

    // Record audit trail
    try {
      await pool.query(
        `INSERT INTO audit_logs (id, actor_name, action, target_entity, target_id, details, severity)
         VALUES (?, ?, 'CLIENT_REGISTERED', 'users', ?, ?, 'info')`,
        [
          crypto.randomUUID(),
          data.full_name.trim(),
          userId,
          `Client account self-registered: ${data.full_name.trim()} (${emailClean}) for facility "${orgName || 'N/A'}"`
        ]
      );
    } catch (_) {}

    // If registering as a healthcare professional, also populate staff_roster so the admin dispatch team sees them
    if (data.role === 'healthcare_worker') {
      try {
        const countRes = await pool.query('SELECT COUNT(*) AS total FROM staff_roster');
        const nextNum = ((countRes[0] && countRes[0][0] && countRes[0][0].total) || 0) + 1;
        const staffCode = `STF-${String(nextNum).padStart(3, '0')}`;
        const validRoles = ['RN', 'RPN', 'PSW', 'Companion', 'Travel Nurse'];
        const clinicalRole = (data.clinical_role && validRoles.includes(data.clinical_role)) ? data.clinical_role : 'RN';
        await pool.query(
          `INSERT INTO staff_roster (id, staff_code, name, role, specialty, region, phone, email, status, credential_status, hourly_rate, cpr_expiry_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_verification', 'pending', 0.00, '2027-12-31')
           ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role), phone = VALUES(phone), email = VALUES(email)`,
          [
            userId,
            staffCode,
            data.full_name.trim(),
            clinicalRole,
            'General Care',
            'Greater Toronto Area',
            data.phone ? data.phone.trim() : null,
            emailClean
          ]
        );
      } catch (rosterErr) {
        console.warn('[Staff Roster Mirror Warning]:', rosterErr.message);
      }
    }

    // Issue JWT session token
    const tokenPayload = {
      id: userId,
      email: emailClean,
      full_name: data.full_name.trim(),
      role: data.role,
      organization_name: orgName,
      facility_id: facilityId,
      phone: data.phone || null,
      credential_status: data.role === 'healthcare_worker' ? 'pending' : 'verified',
      staff_status: data.role === 'healthcare_worker' ? 'pending_verification' : 'available',
      is_verified: data.role !== 'healthcare_worker'
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
    res.cookie(USER_COOKIE_NAME, token, buildUserCookieOptions());

    return res.status(201).json({
      success: true,
      message: data.role === 'healthcare_worker'
        ? 'Account created! Your clinical profile is pending verification by the compliance team.'
        : 'Account created successfully.',
      redirectTo: 'portal.html',
      user: {
        id: userId,
        email: emailClean,
        full_name: data.full_name.trim(),
        role: data.role,
        organization_name: orgName,
        facility_id: facilityId,
        phone: data.phone || null,
        credential_status: data.role === 'healthcare_worker' ? 'pending' : 'verified',
        staff_status: data.role === 'healthcare_worker' ? 'pending_verification' : 'available',
        is_verified: data.role !== 'healthcare_worker'
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    next(err);
  }
});

// ── POST /api/users/login ───────────────────────────────────────────────────
router.post('/login', authLoginLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const emailClean = email.toLowerCase().trim();
    console.log(`[AUTH LOGIN] Attempt for: ${emailClean}`);

    // 1. SECURITY: Reject administrator accounts FIRST, before touching the users table.
    //    Admin emails may exist in both tables; this guard ensures they can never slip
    //    through the users path and access the public portal.
    const [adminCheck] = await pool.query(
      'SELECT id FROM admins WHERE email = ? LIMIT 1',
      [emailClean]
    );
    if (adminCheck && adminCheck.length > 0) {
      return res.status(403).json({
        success: false,
        error: 'Administrator access is restricted. Please sign in via the secure Admin Portal at /admin.'
      });
    }

    // 2. Check standard users table (clients & healthcare workers)
    const [rows] = await pool.query(
      'SELECT id, email, password_hash, full_name, role, organization_name, phone, is_active FROM users WHERE email = ? LIMIT 1',
      [emailClean]
    );

    const user = rows && rows.length > 0 ? rows[0] : null;


    if (user) {
      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          error: 'Your account is currently disabled. Please contact support.'
        });
      }

      const matchUser = await bcrypt.compare(password, user.password_hash);

      if (matchUser) {
        try {
          await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
        } catch (e) {
          console.warn('[AUTH] Failed to update user last_login:', e.message);
        }

        let credentialStatus = 'verified';
        let staffStatus = 'available';
        let clinicalRole = 'RN';
        let staffCode = null;

        if (user.role === 'healthcare_worker') {
          credentialStatus = 'pending';
          staffStatus = 'pending_verification';
          try {
            const [rosterRows] = await pool.query(
              'SELECT id, staff_code, role, status, credential_status FROM staff_roster WHERE id = ? OR email = ? LIMIT 1',
              [user.id, user.email]
            );
            if (rosterRows && rosterRows.length > 0) {
              credentialStatus = rosterRows[0].credential_status || 'pending';
              staffStatus = rosterRows[0].status || 'pending_verification';
              clinicalRole = rosterRows[0].role || 'RN';
              staffCode = rosterRows[0].staff_code;
            }
          } catch (e) {}
        }

        // Issue standard User JWT session token
        const tokenPayload = {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          organization_name: user.organization_name,
          phone: user.phone || null,
          credential_status: credentialStatus,
          staff_status: staffStatus,
          is_verified: credentialStatus === 'verified'
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
        res.cookie(USER_COOKIE_NAME, token, buildUserCookieOptions());

        return res.json({
          success: true,
          isAdmin: false,
          redirectTo: 'portal.html',
          message: 'Logged in successfully.',
          user: {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            organization_name: user.organization_name,
            phone: user.phone,
            credential_status: credentialStatus,
            staff_status: staffStatus,
            clinical_role: clinicalRole,
            staff_code: staffCode,
            is_verified: credentialStatus === 'verified'
          }
        });
      }
    }


    return res.status(401).json({
      success: false,
      error: 'Invalid email or password. Please verify your credentials.'
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    next(err);
  }
});

// ── GET /api/users/me ───────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies[USER_COOKIE_NAME];
    if (!token) {
      return res.json({ success: false, user: null, reason: 'no_token' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      console.warn('[AUTH /me JWT Verify Warning]:', jwtErr.message);
      res.clearCookie(USER_COOKIE_NAME, { path: '/' });
      return res.json({ success: false, user: null, reason: 'invalid_token', error: jwtErr.message });
    }

    let rows;
    try {
      [rows] = await pool.query(
        'SELECT id, email, full_name, role, organization_name, facility_id, client_role, phone, is_active, created_at FROM users WHERE id = ? LIMIT 1',
        [decoded.id]
      );
    } catch (queryErr) {
      console.warn('[AUTH /me Query Warning (with facility_id)]:', queryErr.message);
      try {
        [rows] = await pool.query(
          'SELECT id, email, full_name, role, organization_name, phone, is_active, created_at FROM users WHERE id = ? LIMIT 1',
          [decoded.id]
        );
      } catch (innerErr) {
        console.warn('[AUTH /me Query Warning (without facility_id)]:', innerErr.message);
        rows = [];
      }
    }

    // Fallback: If id lookup yielded no records, lookup by email from decoded token
    if ((!rows || rows.length === 0) && decoded.email) {
      const cleanEmail = decoded.email.toLowerCase().trim();
      try {
        [rows] = await pool.query(
          'SELECT id, email, full_name, role, organization_name, facility_id, client_role, phone, is_active, created_at FROM users WHERE LOWER(email) = ? LIMIT 1',
          [cleanEmail]
        );
      } catch {
        try {
          [rows] = await pool.query(
            'SELECT id, email, full_name, role, organization_name, phone, is_active, created_at FROM users WHERE LOWER(email) = ? LIMIT 1',
            [cleanEmail]
          );
        } catch {
          rows = [];
        }
      }
    }

    let user = (rows && rows.length > 0 && rows[0].is_active) ? rows[0] : null;

    if (!user) {
      if (decoded && decoded.id && decoded.email) {
        // Re-hydrate session from verified cryptographic JWT
        user = {
          id: decoded.id,
          email: decoded.email,
          full_name: decoded.full_name || 'Portal User',
          role: decoded.role || 'client',
          organization_name: decoded.organization_name || null,
          facility_id: decoded.facility_id || null,
          client_role: decoded.client_role || 'requester',
          phone: decoded.phone || null,
          created_at: new Date().toISOString()
        };

        // If user is healthcare_worker, also ensure they are in staff_roster so admin roster sees them
        if (decoded.role === 'healthcare_worker' && pool.inMemoryStore?.staff_roster) {
          const roster = pool.inMemoryStore.staff_roster;
          if (!roster.some(s => s.id === decoded.id || s.email === decoded.email)) {
            roster.push({
              id: decoded.id,
              staff_code: 'STF-' + String(roster.length + 1).padStart(3, '0'),
              name: decoded.full_name || 'Staff Member',
              role: 'RN',
              specialty: 'General Care',
              region: 'Greater Toronto Area',
              phone: decoded.phone || null,
              email: decoded.email,
              status: 'available',
              credential_status: 'verified',
              rating: 5.00,
              shifts_completed: 0,
              hourly_rate: 0.00,
              cpr_expiry_date: '2027-12-31',
              created_at: new Date().toISOString()
            });
          }
        }
      } else {
        return res.json({ success: false, user: null, reason: 'user_not_found_or_inactive' });
      }
    }

    let credentialStatus = 'verified';
    let staffStatus = 'available';
    let clinicalRole = 'RN';
    let staffCode = null;

    if (user.role === 'healthcare_worker') {
      credentialStatus = 'pending';
      staffStatus = 'pending_verification';
      try {
        const [rosterRows] = await pool.query(
          'SELECT id, staff_code, role, status, credential_status FROM staff_roster WHERE id = ? OR email = ? LIMIT 1',
          [user.id, user.email]
        );
        if (rosterRows && rosterRows.length > 0) {
          credentialStatus = rosterRows[0].credential_status || 'pending';
          staffStatus = rosterRows[0].status || 'pending_verification';
          clinicalRole = rosterRows[0].role || 'RN';
          staffCode = rosterRows[0].staff_code;
        }
      } catch (e) {}
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        organization_name: user.organization_name || null,
        facility_id: user.facility_id || null,
        client_role: user.client_role || 'requester',
        phone: user.phone || null,
        created_at: user.created_at,
        credential_status: credentialStatus,
        staff_status: staffStatus,
        clinical_role: clinicalRole,
        staff_code: staffCode,
        is_verified: credentialStatus === 'verified'
      }
    });
  } catch (err) {
    console.error('[AUTH /me Unhandled Error]:', err);
    return res.json({ success: false, user: null, reason: 'server_error', error: err.message });
  }
});

// ── GET /api/users/facility-team ────────────────────────────────────────────
router.get('/facility-team', async (req, res, next) => {
  try {
    const token = req.cookies[USER_COOKIE_NAME];
    if (!token) return res.status(401).json({ success: false, error: 'Authentication required' });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    if (!decoded.organization_name) {
      return res.status(400).json({ success: false, error: 'User does not belong to a healthcare facility organization' });
    }

    const [team] = await pool.query(
      `SELECT id, email, full_name, client_role, organization_name, phone, created_at, last_login 
       FROM users 
       WHERE organization_name = ? AND role = 'client' 
       ORDER BY created_at ASC`,
      [decoded.organization_name]
    );

    res.json({
      success: true,
      organization_name: decoded.organization_name,
      count: team.length,
      team
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/users/facility-team ───────────────────────────────────────────
const addTeamMemberSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  client_role: z.enum(['requester', 'billing_admin', 'facility_director']).default('requester'),
  phone: z.string().optional()
});

router.post('/facility-team', async (req, res, next) => {
  try {
    const token = req.cookies[USER_COOKIE_NAME];
    if (!token) return res.status(401).json({ success: false, error: 'Authentication required' });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    if (decoded.role !== 'client' || !decoded.organization_name) {
      return res.status(403).json({ success: false, error: 'Only facility clients can manage team members' });
    }

    const validated = addTeamMemberSchema.parse(req.body);
    const emailClean = validated.email.toLowerCase().trim();

    // Check if email already taken
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [emailClean]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: 'An account with this email address already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(validated.password, salt);
    const newUserId = 'u-' + crypto.randomUUID();

    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, organization_name, facility_id, client_role, phone, is_active, email_verified)
       VALUES (?, ?, ?, ?, 'client', ?, ?, ?, ?, 1, 1)`,
      [
        newUserId,
        emailClean,
        password_hash,
        validated.full_name.trim(),
        decoded.organization_name,
        decoded.facility_id || null,
        validated.client_role,
        validated.phone || null
      ]
    );

    res.status(201).json({
      success: true,
      message: `Team member ${validated.full_name} (${validated.client_role}) added successfully to ${decoded.organization_name}.`,
      user: {
        id: newUserId,
        email: emailClean,
        full_name: validated.full_name.trim(),
        client_role: validated.client_role,
        organization_name: decoded.organization_name
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    next(err);
  }
});

// ── POST /api/users/logout ──────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie(USER_COOKIE_NAME, { path: '/' });
  return res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;