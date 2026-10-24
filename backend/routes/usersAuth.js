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
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const pool = require('../db');
const { uploadAvatar, validateAvatarContent } = require('../middleware/avatarUpload');
const { authLoginLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');
const adminEvents = require('../utils/events');
const { enqueueMail } = require('../utils/mailOutbox');
const { generateSecureToken, maskEmail } = require('../utils/cryptoUtils');
const { sendRawMail, buildUserVerificationOtpEmail } = require('../utils/mailer');

const USER_JWT_SECRET = process.env.JWT_USER_SECRET || process.env.USER_JWT_SECRET || process.env.JWT_SECRET || 'divine_fingers_default_user_jwt_secret_key_2026';
const JWT_SECRET = USER_JWT_SECRET;
const USER_COOKIE_NAME = 'df_user_session';
const isProd = process.env.NODE_ENV === 'production';

function buildUserCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'Strict' : 'Lax',
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
          if (data.phone) {
            try {
              await pool.query('UPDATE facilities SET contact_phone = COALESCE(NULLIF(contact_phone, ""), ?), updated_at = NOW() WHERE id = ?', [data.phone.trim(), facilityId]);
            } catch (_) {}
          }
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
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', 'pending', 0.00, '2027-12-31')
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

    // ── MANDATORY EMAIL OTP VERIFICATION FOR NEW CLIENT REGISTRATION ──
    const emailOtp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = crypto.createHash('sha256').update(emailOtp).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      'UPDATE users SET email_verified = 0, email_verification_token = ?, email_verification_expires = ? WHERE id = ?',
      [hashedOtp, expiresAt, userId]
    );

    try {
      const emailContent = buildUserVerificationOtpEmail(data.full_name.trim(), emailOtp, 'registration');
      await sendRawMail({
        to: emailClean,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html
      });
      console.log(`[AUTH REGISTER] ✅ Registration verification OTP sent to ${emailClean}`);
    } catch (mailErr) {
      console.error('[AUTH REGISTER] OTP delivery warning:', mailErr.message);
    }

    if (!isProd) {
      console.log(`🔑 [DEV REGISTER OTP for ${emailClean}]: ${emailOtp}`);
    }

    const verifyToken = jwt.sign(
      {
        id: userId,
        email: emailClean,
        full_name: data.full_name.trim(),
        role: data.role,
        organization_name: orgName,
        facility_id: facilityId,
        phone: data.phone ? data.phone.trim() : null,
        otp_hash: hashedOtp,
        otp_exp: expiresAt.getTime(),
        purpose: 'user_verify_pending'
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    return res.status(201).json({
      success: true,
      requires_email_verification: true,
      verify_token: verifyToken,
      email: maskEmail(emailClean),
      message: `Account created for ${data.full_name.trim()}! A 6-digit verification code has been dispatched to ${maskEmail(emailClean)}. Please enter the code to complete verification.`
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


    let authenticatedUser = null;

    if (user) {
      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          error: 'Your account is currently disabled. Please contact support.'
        });
      }

      const matchUser = await bcrypt.compare(password, user.password_hash);
      if (matchUser) {
        authenticatedUser = user;
      }
    }

    // Notice: If on staff_roster but no active password in users table, prompt for activation/reset
    if (!authenticatedUser) {
      try {
        const [rosterMatch] = await pool.query(
          'SELECT id, name, email, phone, role, status, credential_status FROM staff_roster WHERE LOWER(email) = ? LIMIT 1',
          [emailClean]
        );
        if (rosterMatch && rosterMatch.length > 0) {
          return res.status(401).json({
            success: false,
            error: 'Your staff account requires password activation. Please check your invitation email or click "Forgot Password" to establish your password.'
          });
        }
      } catch (rosterAuthErr) {
        console.warn('[Staff Roster Auth Notice]:', rosterAuthErr.message);
      }
    }

    if (authenticatedUser) {
      try {
        await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [authenticatedUser.id]);
      } catch (e) {
        console.warn('[AUTH] Failed to update user last_login:', e.message);
      }

      let credentialStatus = 'verified';
      let staffStatus = 'available';
      let clinicalRole = 'RN';
      let staffCode = null;

      if (authenticatedUser.role === 'healthcare_worker') {
        credentialStatus = 'pending';
        staffStatus = 'pending_verification';
        try {
          const [rosterRows] = await pool.query(
            'SELECT id, staff_code, role, status, credential_status FROM staff_roster WHERE id = ? OR email = ? LIMIT 1',
            [authenticatedUser.id, authenticatedUser.email]
          );
          if (rosterRows && rosterRows.length > 0) {
            credentialStatus = rosterRows[0].credential_status || 'pending';
            staffStatus = rosterRows[0].status || 'pending_verification';
            clinicalRole = rosterRows[0].role || 'RN';
            staffCode = rosterRows[0].staff_code;
          }
        } catch (e) {}
      }

      // ── MANDATORY REAL-TIME EMAIL OTP VERIFICATION FOR SIGN IN ──
      const emailOtp = crypto.randomInt(100000, 999999).toString();
      const hashedOtp = crypto.createHash('sha256').update(emailOtp).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await pool.query(
        'UPDATE users SET email_verification_token = ?, email_verification_expires = ? WHERE id = ?',
        [hashedOtp, expiresAt, authenticatedUser.id]
      );

      try {
        const emailContent = buildUserVerificationOtpEmail(authenticatedUser.full_name, emailOtp, 'sign-in');
        await sendRawMail({
          to: authenticatedUser.email,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html
        });
        console.log(`[AUTH LOGIN] ✅ Sign-in OTP dispatched to ${authenticatedUser.email}`);
      } catch (mailErr) {
        console.error('[AUTH LOGIN] OTP dispatch warning:', mailErr.message);
      }

      if (!isProd) {
        console.log(`🔑 [DEV SIGN-IN OTP for ${authenticatedUser.email}]: ${emailOtp}`);
      }

      const verifyToken = jwt.sign(
        {
          id: authenticatedUser.id,
          email: authenticatedUser.email,
          full_name: authenticatedUser.full_name,
          role: authenticatedUser.role,
          organization_name: authenticatedUser.organization_name,
          facility_id: authenticatedUser.facility_id,
          phone: authenticatedUser.phone,
          otp_hash: hashedOtp,
          otp_exp: expiresAt.getTime(),
          purpose: 'user_verify_pending'
        },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      return res.json({
        success: true,
        requires_email_verification: true,
        verify_token: verifyToken,
        email: maskEmail(authenticatedUser.email),
          message: `A 6-digit verification code has been dispatched to ${maskEmail(authenticatedUser.email)}. Please check your inbox to complete sign in.`
      });
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
        'SELECT id, email, full_name, role, organization_name, facility_id, client_role, phone, avatar_url, is_active, created_at FROM users WHERE id = ? LIMIT 1',
        [decoded.id]
      );
    } catch (queryErr) {
      console.warn('[AUTH /me Query Warning (with facility_id)]:', queryErr.message);
      try {
        [rows] = await pool.query(
          'SELECT id, email, full_name, role, organization_name, phone, avatar_url, is_active, created_at FROM users WHERE id = ? LIMIT 1',
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
          'SELECT id, email, full_name, role, organization_name, facility_id, client_role, phone, avatar_url, is_active, created_at FROM users WHERE LOWER(email) = ? LIMIT 1',
          [cleanEmail]
        );
      } catch {
        try {
          [rows] = await pool.query(
            'SELECT id, email, full_name, role, organization_name, phone, avatar_url, is_active, created_at FROM users WHERE LOWER(email) = ? LIMIT 1',
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
          avatar_url: decoded.avatar_url || null,
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
      staffStatus = 'available';
      try {
        const [rosterRows] = await pool.query(
          'SELECT id, staff_code, role, status, credential_status FROM staff_roster WHERE id = ? OR email = ? LIMIT 1',
          [user.id, user.email]
        );
        if (rosterRows && rosterRows.length > 0) {
          credentialStatus = rosterRows[0].credential_status || 'pending';
          staffStatus = rosterRows[0].status || 'available';
          clinicalRole = rosterRows[0].role || 'RN';
          staffCode = rosterRows[0].staff_code;
        } else {
          // Auto-sync into staff_roster if missing
          const [countRes] = await pool.query('SELECT COUNT(*) AS total FROM staff_roster');
          const nextNum = ((countRes[0] && countRes[0][0] && countRes[0][0].total) || 0) + 1;
          staffCode = `STF-${String(nextNum).padStart(3, '0')}`;
          await pool.query(
            `INSERT INTO staff_roster (id, staff_code, name, role, specialty, region, phone, email, status, credential_status, hourly_rate, cpr_expiry_date)
             VALUES (?, ?, ?, 'RN', 'General Care', 'Greater Toronto Area', ?, ?, 'available', 'pending', 35.00, DATE_ADD(CURDATE(), INTERVAL 1 YEAR))`,
            [user.id, staffCode, user.full_name || 'Staff Member', user.phone || null, user.email]
          );
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
        avatar_url: user.avatar_url || null,
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

// In-memory per-email rate limit store (15 minute window, max 3 requests)
const emailResetLimiterMap = new Map();
function checkEmailRateLimit(email) {
  const now = Date.now();
  const entry = emailResetLimiterMap.get(email) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + 15 * 60 * 1000;
  } else {
    entry.count += 1;
  }
  emailResetLimiterMap.set(email, entry);
  return entry.count <= 3;
}

// Clean up stale entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of emailResetLimiterMap.entries()) {
    if (now > v.resetAt) emailResetLimiterMap.delete(k);
  }
}, 30 * 60 * 1000).unref();

const forgotPasswordSchema = z.object({
  email: z.string().trim().email({ message: 'A valid email address is required.' })
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(32, { message: 'Invalid or malformed reset token.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long.' })
});

// ── POST /api/users/forgot-password ─────────────────────────────────────────
router.post('/forgot-password', passwordResetLimiter, async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const emailClean = email.toLowerCase().trim();

    // Constant response text to avoid account enumeration
    const genericResponse = {
      success: true,
      message: 'If an account is associated with that email address, a password reset link has been dispatched.'
    };

    // Per-email throttling
    if (!checkEmailRateLimit(emailClean)) {
      return res.status(429).json({
        success: false,
        error: 'Too many password reset requests for this email address. Please try again later.'
      });
    }

    const [rows] = await pool.query(
      'SELECT id, email, full_name, role, is_active FROM users WHERE LOWER(email) = ? LIMIT 1',
      [emailClean]
    );

    let targetUser = rows && rows[0] ? rows[0] : null;

    // Check staff_roster if not yet initialized in users table
    if (!targetUser) {
      const [rosterRows] = await pool.query(
        'SELECT id, name, email FROM staff_roster WHERE LOWER(email) = ? LIMIT 1',
        [emailClean]
      );
      if (rosterRows && rosterRows[0]) {
        const staff = rosterRows[0];
        const newUserId = staff.id || crypto.randomUUID();
        await pool.query(
          `INSERT INTO users (id, email, password_hash, full_name, role, is_active, email_verified)
           VALUES (?, ?, 'pending_initial_activation', ?, 'healthcare_worker', 1, 1)
           ON DUPLICATE KEY UPDATE is_active = 1`,
          [newUserId, emailClean, staff.name]
        );
        targetUser = { id: newUserId, email: emailClean, full_name: staff.name, is_active: 1 };
      }
    }

    // Check facilities if registered client facility contact
    if (!targetUser) {
      const [facRows] = await pool.query(
        'SELECT id, name, contact_name, contact_email FROM facilities WHERE LOWER(contact_email) = ? LIMIT 1',
        [emailClean]
      );
      if (facRows && facRows[0]) {
        const fac = facRows[0];
        const newUserId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO users (id, email, password_hash, full_name, role, facility_id, organization_name, is_active, email_verified)
           VALUES (?, ?, 'pending_client_setup', ?, 'client', ?, ?, 1, 1)
           ON DUPLICATE KEY UPDATE is_active = 1, facility_id = VALUES(facility_id)`,
          [newUserId, emailClean, fac.contact_name || fac.name, fac.id, fac.name]
        );
        targetUser = { id: newUserId, email: emailClean, full_name: fac.contact_name || fac.name, is_active: 1 };
      }
    }

    // Check admins if not yet initialized in users table
    if (!targetUser) {
      const [adminRows] = await pool.query(
        'SELECT id, full_name, email, role, is_active FROM admins WHERE LOWER(email) = ? LIMIT 1',
        [emailClean]
      );
      if (adminRows && adminRows[0]) {
        const admin = adminRows[0];
        const adminUserId = admin.id || crypto.randomUUID();
        await pool.query(
          `INSERT INTO users (id, email, password_hash, full_name, role, is_active, email_verified)
           VALUES (?, ?, 'pending_admin_sync', ?, 'super-admin', 1, 1)
           ON DUPLICATE KEY UPDATE is_active = 1, full_name = ?`,
          [adminUserId, emailClean, admin.full_name, admin.full_name]
        );
        targetUser = { id: adminUserId, email: emailClean, full_name: admin.full_name, is_active: 1 };
      }
    }

    let resetUrl = null;
    if (targetUser && targetUser.is_active !== 0) {
      const { token, hash } = generateSecureToken(32);

      await pool.query(
        'UPDATE users SET password_reset_token_hash = ?, password_reset_expires = DATE_ADD(NOW(), INTERVAL 30 MINUTE), is_active = 1 WHERE id = ? OR LOWER(email) = ?',
        [hash, targetUser.id, emailClean]
      );

      const reqHost = req.get('host') || 'health-care-staffing-agency-website.vercel.app';
      const reqProto = req.get('x-forwarded-proto') || req.protocol || 'https';
      const autoOrigin = `${reqProto}://${reqHost}`;
      const appBaseUrl = (process.env.APP_BASE_URL || process.env.APP_URL || autoOrigin).replace(/\/$/, '');
      resetUrl = `${appBaseUrl}/login.html?action=reset&token=${token}&email=${encodeURIComponent(emailClean)}`;

      // Immediate delivery via sendRawMail
      try {
        const { sendRawMail, buildPasswordResetEmail } = require('../utils/mailer');
        const emailContent = buildPasswordResetEmail(
          targetUser.full_name || 'Account Holder',
          resetUrl
        );
        const mailResult = await sendRawMail({
          to: emailClean,
          subject: emailContent.subject || 'Reset Your Divine Fingers Healthcare Password',
          html: emailContent.html,
          text: emailContent.text
        });
        console.log(`[ForgotPassword] Direct SMTP dispatch success to ${emailClean}. Message ID:`, mailResult?.messageId);
      } catch (directMailErr) {
        console.error('[ForgotPassword] Direct SMTP dispatch error:', directMailErr.message);
      }

      if (!isProd) {
        console.log('\n======================================================');
        console.log(`🔑 [PASSWORD RESET LINK GENERATED]`);
        console.log(`Recipient: ${emailClean}`);
        console.log(`Reset URL: ${resetUrl}`);
        console.log('======================================================\n');
      }
    } else {
      // Artificial delay to prevent timing-based user enumeration
      await new Promise(r => setTimeout(r, 150));
    }

    const responseData = { ...genericResponse };
    if (!isProd && resetUrl) {
      responseData.dev_reset_url = resetUrl;
      responseData.dev_notice = 'Development mode: Use the direct recovery link below or check terminal logs.';
    }

    return res.json(responseData);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    next(err);
  }
});

// ── POST /api/users/reset-password ──────────────────────────────────────────
router.post('/reset-password', passwordResetLimiter, async (req, res, next) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const [users] = await pool.query(
      `SELECT id, email, full_name, token_version FROM users 
       WHERE password_reset_token_hash = ? AND password_reset_expires > NOW() LIMIT 1`,
      [tokenHash]
    );

    if (!users || users.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Password reset link is invalid, single-use token already consumed, or link has expired.'
      });
    }

    const user = users[0];
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Consume token, update password, and increment token_version to invalidate previous sessions
    await pool.query(
      `UPDATE users SET
         password_hash = ?,
         password_reset_token_hash = NULL,
         password_reset_expires = NULL,
         token_version = token_version + 1,
         email_verified = 1,
         is_active = 1,
         updated_at = NOW()
       WHERE id = ?`,
      [passwordHash, user.id]
    );

    // If an administrator account exists with this email, keep admin password synchronized
    await pool.query(
      `UPDATE admins SET password_hash = ?, failed_login_attempts = 0, lock_until = NULL WHERE LOWER(email) = ?`,
      [passwordHash, user.email.toLowerCase()]
    ).catch(() => {});

    // Invalidate any active cookie on the client
    res.clearCookie(USER_COOKIE_NAME, { path: '/' });

    return res.json({
      success: true,
      message: 'Your password has been successfully reset. Please log in with your new credentials.'
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

// ── CLIENT & HEALTHCARE WORKER AVATAR ENDPOINTS ─────────────────────────────

// Helper to authenticate user from cookie or authorization header
function requirePortalUser(req, res, next) {
  const token = req.cookies[USER_COOKIE_NAME] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Session expired or invalid. Please log in again.' });
  }
}

// POST /api/users/profile/avatar — Upload / update user avatar
router.post('/profile/avatar', requirePortalUser, uploadAvatar.single('avatar'), validateAvatarContent, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Please choose an image file (JPG, PNG, or WebP) to upload.' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    try {
      const [curr] = await pool.query('SELECT avatar_url FROM users WHERE id = ?', [req.user.id]);
      if (curr?.[0]?.avatar_url && curr[0].avatar_url.startsWith('/uploads/avatars/')) {
        const oldFile = path.join(__dirname, '..', curr[0].avatar_url);
        if (fs.existsSync(oldFile)) {
          try { fs.unlinkSync(oldFile); } catch (_) {}
        }
      }
    } catch (_) {}

    await pool.query(
      'UPDATE users SET avatar_url = ?, avatar_updated_at = NOW() WHERE id = ?',
      [avatarUrl, req.user.id]
    );

    try {
      await pool.query('UPDATE staff_roster SET avatar_url = ? WHERE id = ? OR email = ?', [avatarUrl, req.user.id, req.user.email]);
    } catch (_) {}

    res.json({
      success: true,
      message: 'Profile picture updated successfully.',
      avatar_url: avatarUrl
    });
  } catch (err) {
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
    next(err);
  }
});

// DELETE /api/users/profile/avatar — Remove user avatar
router.delete('/profile/avatar', requirePortalUser, async (req, res, next) => {
  try {
    const [curr] = await pool.query('SELECT avatar_url FROM users WHERE id = ?', [req.user.id]);
    if (curr?.[0]?.avatar_url && curr[0].avatar_url.startsWith('/uploads/avatars/')) {
      const oldFile = path.join(__dirname, '..', curr[0].avatar_url);
      if (fs.existsSync(oldFile)) {
        try { fs.unlinkSync(oldFile); } catch (_) {}
      }
    }

    await pool.query(
      'UPDATE users SET avatar_url = NULL, avatar_updated_at = NOW() WHERE id = ?',
      [req.user.id]
    );

    try {
      await pool.query('UPDATE staff_roster SET avatar_url = NULL WHERE id = ? OR email = ?', [req.user.id, req.user.email]);
    } catch (_) {}

    res.json({
      success: true,
      message: 'Profile picture removed. Reverted to initials monogram.'
    });
  } catch (err) { next(err); }
});

// POST /api/users/facility/logo — Upload facility logo
router.post('/facility/logo', requirePortalUser, uploadAvatar.single('logo'), validateAvatarContent, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Please choose an image file (JPG, PNG, or WebP) to upload.' });
    }

    const [uRows] = await pool.query('SELECT facility_id FROM users WHERE id = ?', [req.user.id]);
    const facilityId = uRows?.[0]?.facility_id;
    if (!facilityId) {
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
      }
      return res.status(400).json({ success: false, error: 'No healthcare facility is linked to this account.' });
    }

    const logoUrl = `/uploads/avatars/${req.file.filename}`;

    try {
      const [curr] = await pool.query('SELECT logo_url FROM facilities WHERE id = ?', [facilityId]);
      if (curr?.[0]?.logo_url && curr[0].logo_url.startsWith('/uploads/avatars/')) {
        const oldFile = path.join(__dirname, '..', curr[0].logo_url);
        if (fs.existsSync(oldFile)) {
          try { fs.unlinkSync(oldFile); } catch (_) {}
        }
      }
    } catch (_) {}

    await pool.query('UPDATE facilities SET logo_url = ? WHERE id = ?', [logoUrl, facilityId]);

    res.json({
      success: true,
      message: 'Facility logo updated successfully.',
      logo_url: logoUrl
    });
  } catch (err) {
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
    next(err);
  }
});


// ── POST /api/users/verify-otp ─────────────────────────────────────────────
router.post('/verify-otp', authLoginLimiter, async (req, res, next) => {
  try {
    const verify_token = req.body.verify_token || req.body.token;
    const email_code = req.body.email_code || req.body.code;
    if (!verify_token || !email_code) {
      return res.status(400).json({ success: false, error: 'Verification session and 6-digit code are required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(verify_token, JWT_SECRET);
      if (decoded.purpose !== 'user_verify_pending') throw new Error('Invalid token purpose');
    } catch {
      return res.status(401).json({ success: false, error: 'Verification session expired. Please sign in again.' });
    }

    const cleanCode = String(email_code).replace(/\D/g, '').trim();
    if (!cleanCode || cleanCode.length !== 6) {
      return res.status(400).json({ success: false, error: 'Please enter the complete 6-digit security code.' });
    }
    const hashedInput = crypto.createHash('sha256').update(cleanCode).digest('hex');

    // 1. Check persistent database or memory store for existing account
    let [rows] = await pool.query(
      'SELECT id, email, full_name, role, organization_name, facility_id, phone, is_active, email_verified, email_verification_token, email_verification_expires FROM users WHERE id = ? OR LOWER(email) = LOWER(?) LIMIT 1',
      [decoded.id, decoded.email]
    );

    let user = rows && rows.length > 0 ? rows[0] : null;

    // 2. Resilient Serverless / Cold-Start Recovery:
    // If running in an ephemeral/recycled container without persistent database,
    // construct the user directly from the verified cryptographically signed JWT.
    if (!user && decoded.id) {
      user = {
        id: decoded.id,
        email: decoded.email,
        full_name: decoded.full_name || 'Client Administrator',
        role: decoded.role || 'client',
        organization_name: decoded.organization_name || null,
        facility_id: decoded.facility_id || null,
        phone: decoded.phone || null,
        is_active: 1,
        email_verified: 0,
        email_verification_token: decoded.otp_hash,
        email_verification_expires: decoded.otp_exp ? new Date(decoded.otp_exp) : null
      };

      try {
        await pool.query(
          `INSERT INTO users (id, email, password_hash, full_name, role, organization_name, facility_id, phone, is_active, email_verified, created_at, updated_at)
           VALUES (?, ?, 'SERVERLESS_PREVIEW_USER', ?, ?, ?, ?, ?, 1, 1, NOW(), NOW())`,
          [user.id, user.email, user.full_name, user.role, user.organization_name, user.facility_id, user.phone]
        );
      } catch (_) {}
    }

    if (!user || (user.is_active !== undefined && !user.is_active)) {
      return res.status(401).json({ success: false, error: 'Account not found or inactive.' });
    }

    // Determine effective expiration: prefer database datetime, fall back to signed JWT timestamp
    const effectiveExpiry = user.email_verification_expires 
      ? new Date(user.email_verification_expires) 
      : (decoded.otp_exp ? new Date(decoded.otp_exp) : null);

    if (!effectiveExpiry || effectiveExpiry.getTime() < Date.now()) {
      return res.status(400).json({ success: false, error: 'Verification code has expired. Please click "Resend Code".' });
    }

    // Determine expected token hash: database column or signed JWT claim
    const expectedHash = user.email_verification_token || decoded.otp_hash;
    if (!expectedHash || expectedHash !== hashedInput) {
      return res.status(400).json({ success: false, error: 'Invalid verification code. Please check your email and try again.' });
    }

    // Success: activate email verification, clear tokens, and update last_login
    try {
      await pool.query(
        'UPDATE users SET email_verified = 1, email_verification_token = NULL, email_verification_expires = NULL, last_login = NOW() WHERE id = ? OR LOWER(email) = LOWER(?)',
        [user.id, user.email]
      );
    } catch (_) {}

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

    const tokenPayload = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      organization_name: user.organization_name,
      facility_id: user.facility_id,
      phone: user.phone || null,
      credential_status: credentialStatus,
      staff_status: staffStatus,
      is_verified: true
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
    res.cookie(USER_COOKIE_NAME, token, buildUserCookieOptions());

    return res.json({
      success: true,
      message: 'Identity verified successfully! Redirecting to your portal...',
      redirectTo: 'portal.html',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        organization_name: user.organization_name,
        facility_id: user.facility_id,
        phone: user.phone,
        credential_status: credentialStatus,
        staff_status: staffStatus,
        clinical_role: clinicalRole,
        staff_code: staffCode,
        is_verified: true
      }
    });
  } catch (err) { next(err); }
});

// ── POST /api/users/resend-otp ─────────────────────────────────────────────
router.post('/resend-otp', authLoginLimiter, async (req, res, next) => {
  try {
    const verify_token = req.body.verify_token || req.body.token;
    if (!verify_token) {
      return res.status(400).json({ success: false, error: 'Verification token is required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(verify_token, JWT_SECRET);
      if (decoded.purpose !== 'user_verify_pending') throw new Error('Invalid token purpose');
    } catch {
      return res.status(401).json({ success: false, error: 'Session expired. Please sign in again.' });
    }

    let [rows] = await pool.query(
      'SELECT id, email, full_name, role, organization_name, facility_id, phone, is_active FROM users WHERE id = ? OR LOWER(email) = LOWER(?) LIMIT 1',
      [decoded.id, decoded.email]
    );
    let user = rows && rows.length > 0 ? rows[0] : null;

    if (!user && decoded.id) {
      user = {
        id: decoded.id,
        email: decoded.email,
        full_name: decoded.full_name || 'Client Administrator',
        role: decoded.role || 'client',
        organization_name: decoded.organization_name || null,
        facility_id: decoded.facility_id || null,
        phone: decoded.phone || null,
        is_active: 1
      };
    }

    if (!user || (user.is_active !== undefined && !user.is_active)) {
      return res.status(401).json({ success: false, error: 'Account not found or inactive.' });
    }

    const emailOtp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = crypto.createHash('sha256').update(emailOtp).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    try {
      await pool.query(
        'UPDATE users SET email_verification_token = ?, email_verification_expires = ? WHERE id = ? OR LOWER(email) = LOWER(?)',
        [hashedOtp, expiresAt, user.id, user.email]
      );
    } catch (_) {}

    try {
      const emailContent = buildUserVerificationOtpEmail(user.full_name, emailOtp, 'sign-in');
      await sendRawMail({
        to: user.email,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html
      });
      console.log(`[AUTH RESEND-OTP] ✅ Fresh verification code dispatched to ${user.email}`);
    } catch (mailErr) {
      console.error('[AUTH RESEND-OTP] Direct mail dispatch warning:', mailErr.message);
    }

    if (!isProd) {
      console.log(`🔑 [DEV RESEND OTP for ${user.email}]: ${emailOtp}`);
    }

    const freshVerifyToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role || decoded.role || 'client',
        organization_name: user.organization_name || decoded.organization_name || null,
        facility_id: user.facility_id || decoded.facility_id || null,
        phone: user.phone || decoded.phone || null,
        otp_hash: hashedOtp,
        otp_exp: expiresAt.getTime(),
        purpose: 'user_verify_pending'
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    return res.json({
      success: true,
      verify_token: freshVerifyToken,
      message: `A fresh 6-digit verification code has been dispatched to ${maskEmail(user.email)}. Please check your email inbox.`
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
