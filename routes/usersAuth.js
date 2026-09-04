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

const JWT_SECRET = process.env.JWT_SECRET || 'divine_fingers_default_secure_jwt_secret_key_2026_production_fallback';
const USER_COOKIE_NAME = 'df_user_session';

function buildUserCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
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

    // Check if user already exists
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [emailClean]
    );

    if (existing && existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists. Please sign in.'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(data.password, salt);
    const userId = 'u-' + crypto.randomUUID();

    // Insert user
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, organization_name, phone, is_active, email_verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, NOW(), NOW())`,
      [
        userId,
        emailClean,
        password_hash,
        data.full_name.trim(),
        data.role,
        data.organization_name ? data.organization_name.trim() : null,
        data.phone ? data.phone.trim() : null
      ]
    );

    // Issue JWT session token
    const tokenPayload = {
      id: userId,
      email: emailClean,
      full_name: data.full_name.trim(),
      role: data.role,
      organization_name: data.organization_name || null
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
    res.cookie(USER_COOKIE_NAME, token, buildUserCookieOptions());

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: {
        id: userId,
        email: emailClean,
        full_name: data.full_name.trim(),
        role: data.role,
        organization_name: data.organization_name || null,
        phone: data.phone || null
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

    let [rows] = await pool.query(
      'SELECT id, email, password_hash, full_name, role, organization_name, phone, is_active FROM users WHERE email = ? LIMIT 1',
      [emailClean]
    );

    let user = rows && rows.length > 0 ? rows[0] : null;
    let isAdminAccount = false;

    // If not found in users table, check if this is an Administrator account logging in from the website sign-in page
    if (!user) {
      const [adminRows] = await pool.query(
        'SELECT id, email, password_hash, full_name, role, is_active FROM admins WHERE email = ? LIMIT 1',
        [emailClean]
      );
      if (adminRows && adminRows.length > 0) {
        user = adminRows[0];
        isAdminAccount = true;
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: 'Your account is currently disabled. Please contact support.'
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    if (isAdminAccount) {
      // 1. Issue Admin JWT Session Token
      const adminPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name
      };
      const adminToken = jwt.sign(adminPayload, JWT_SECRET, { expiresIn: '8h' });
      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('df_admin_session', adminToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'Strict' : 'Lax',
        maxAge: 8 * 60 * 60 * 1000,
        path: '/'
      });

      // 2. Also issue User Cookie for seamless cross-navigation
      res.cookie(USER_COOKIE_NAME, adminToken, buildUserCookieOptions());

      try {
        await pool.query('UPDATE admins SET failed_login_attempts = 0, lock_until = NULL, last_login = NOW() WHERE id = ?', [user.id]);
      } catch {}

      return res.json({
        success: true,
        isAdmin: true,
        redirectTo: 'admin.html',
        message: 'Administrator verified. Redirecting to Admin Dashboard...',
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role
        }
      });
    }

    // Standard client or healthcare worker
    try {
      await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    } catch {}

    // Issue JWT session token
    const tokenPayload = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      organization_name: user.organization_name
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
        phone: user.phone
      }
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
      return res.json({ success: false, user: null });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.json({ success: false, user: null });
    }

    const [rows] = await pool.query(
      'SELECT id, email, full_name, role, organization_name, phone, is_active, created_at FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    );

    if (!rows || rows.length === 0 || !rows[0].is_active) {
      res.clearCookie(USER_COOKIE_NAME, { path: '/' });
      return res.json({ success: false, user: null });
    }

    const user = rows[0];
    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        organization_name: user.organization_name,
        phone: user.phone,
        created_at: user.created_at
      }
    });
  } catch (err) {
    return res.json({ success: false, user: null });
  }
});

// ── POST /api/users/logout ──────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie(USER_COOKIE_NAME, { path: '/' });
  return res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;