/**
 * Auth Route — Login, MFA (TOTP RFC 6238), and Session Management
 * Divine Fingers Healthcare Services Inc.
 *
 * Security controls:
 *   - Bcrypt / Argon2id password verification
 *   - Time-based One-Time Password (TOTP RFC 6238) via Google/Microsoft Authenticator
 *   - Account lockout: 15-minute ban after 5 consecutive failures
 *   - Client Fingerprint Binding (IP Subnet /24 and User-Agent hash)
 *   - JWT issued as httpOnly, Secure, SameSite=Strict cookie
 *   - CSRF protection via random nonce tied to session
 *   - SIEM-structured audit logging
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const otplib = require('otplib');
const qrcode = require('qrcode');
const { z } = require('zod');
const pool = require('../db');
const { authLoginLimiter } = require('../middleware/rateLimiter');
const { requireAdminAuth } = require('../middleware/auth');
const { sendAdminEmailVerificationOtp } = require('../utils/mailer');
const JWT_SECRET = process.env.JWT_SECRET || 'divine_fingers_default_secure_jwt_secret_key_2026_production_fallback';

const loginSchema = z.object({
  email: z.string().email({ message: 'A valid email address is required.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' })
});

function extractClientFingerprint(req) {
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  let subnet = ip;
  if (ip.includes('.')) {
    subnet = ip.split('.').slice(0, 3).join('.') + '.0/24';
  } else if (ip.includes(':')) {
    subnet = ip.split(':').slice(0, 3).join(':') + '::/48';
  }
  const ua = req.headers['user-agent'] || 'unknown';
  const uaHash = crypto.createHash('sha256').update(ua).digest('hex');
  return { ip, subnet, uaHash };
}

function buildCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'Strict' : 'Lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours absolute max
    path: '/'
  };
}

// ── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', authLoginLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const clientFP = extractClientFingerprint(req);

    const [rows] = await pool.query(
      `SELECT id, email, password_hash, full_name, role,
              failed_login_attempts, lock_until, is_active,
              totp_enabled, totp_secret, email_verified
       FROM admins WHERE email = ? LIMIT 1`,
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const admin = rows[0];

    if (!admin.is_active) {
      return res.status(403).json({ success: false, error: 'Account is disabled. Contact your administrator.' });
    }

    // Check active lockout
    if (admin.lock_until && new Date(admin.lock_until) > new Date()) {
      const waitMinutes = Math.ceil((new Date(admin.lock_until) - new Date()) / 60000);
      return res.status(429).json({
        success: false,
        error: `Account temporarily locked after repeated failures. Try again in ${waitMinutes} minute(s).`
      });
    }

    // Verify password
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
      const attempts = admin.failed_login_attempts + 1;
      const lockTime = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await pool.query(
        'UPDATE admins SET failed_login_attempts = ?, lock_until = ? WHERE id = ?',
        [attempts, lockTime, admin.id]
      );
      await pool.query(
        `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, details, severity, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), admin.id, admin.full_name, 'FAILED_LOGIN', 'admins',
         `Failed login attempt #${attempts}${lockTime ? ' — account locked for 15 minutes' : ''}`, 'warning', clientFP.ip]
      );

      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    // ── STEP 1.5: EMAIL VERIFICATION GATE ──
    // If corporate email is unverified, issue a 6-digit OTP to the email before login
    if (!admin.email_verified) {
      const emailOtp = crypto.randomInt(100000, 999999).toString();
      const hashedOtp = crypto.createHash('sha256').update(emailOtp).digest('hex');

      await pool.query(
        'UPDATE admins SET email_verification_token = ?, email_verification_expires = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?',
        [hashedOtp, admin.id]
      );

      // Send email via mailer
      await sendAdminEmailVerificationOtp(admin.email, admin.full_name, emailOtp);

      const verifyToken = jwt.sign(
        {
          id: admin.id,
          email: admin.email,
          role: admin.role,
          full_name: admin.full_name,
          purpose: 'email_verification_pending',
          subnet: clientFP.subnet,
          uaHash: clientFP.uaHash
        },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      await pool.query(
        `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, details, severity, ip_address)
         VALUES (?, ?, ?, 'EMAIL_VERIFICATION_CHALLENGE', 'admins', 'Email verification OTP dispatched to corporate address', 'info', ?)`,
        [crypto.randomUUID(), admin.id, admin.full_name, clientFP.ip]
      );

      return res.json({
        success: true,
        requires_email_verification: true,
        verify_token: verifyToken,
        email: admin.email,
        dev_otp: process.env.NODE_ENV === 'development' ? emailOtp : undefined,
        message: `A 6-digit verification code has been sent to ${admin.email}. Please verify to complete login.`
      });
    }

    // ── STEP 2: TOTP MFA ENFORCEMENT ──
    if (admin.totp_enabled && admin.totp_secret) {
      const mfaToken = jwt.sign(
        {
          id: admin.id,
          email: admin.email,
          role: admin.role,
          full_name: admin.full_name,
          purpose: 'mfa_pending',
          subnet: clientFP.subnet,
          uaHash: clientFP.uaHash
        },
        JWT_SECRET,
        { expiresIn: '5m' }
      );

      await pool.query(
        `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, details, severity, ip_address)
         VALUES (?, ?, ?, 'MFA_CHALLENGE_ISSUED', 'admins', 'Primary credentials accepted; TOTP challenge issued', 'info', ?)`,
        [crypto.randomUUID(), admin.id, admin.full_name, clientFP.ip]
      );

      return res.json({
        success: true,
        requires_mfa: true,
        mfa_token: mfaToken,
        message: 'Two-Factor Authentication required. Enter the 6-digit code from your authenticator app.'
      });
    }

    // Successful Login (Email Verified, MFA not enabled) — reset failure counter & record telemetry
    await pool.query(
      'UPDATE admins SET failed_login_attempts = 0, lock_until = NULL, last_login = NOW(), last_login_ip = ? WHERE id = ?',
      [clientFP.ip, admin.id]
    );

    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        full_name: admin.full_name,
        subnet: clientFP.subnet,
        uaHash: clientFP.uaHash
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('df_admin_session', token, buildCookieOptions());
    res.cookie('df_csrf_token', csrfToken, { ...buildCookieOptions(), httpOnly: false });

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, details, severity, ip_address)
       VALUES (?, ?, ?, 'AUTH_LOGIN', 'admins', 'Successful administrator login', 'info', ?)`,
      [crypto.randomUUID(), admin.id, admin.full_name, clientFP.ip]
    );

    res.json({
      success: true,
      csrfToken,
      admin: {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role,
        totp_enabled: Boolean(admin.totp_enabled),
        email_verified: true
      }
    });

  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    next(err);
  }
});

// ── POST /api/auth/email/verify ─────────────────────────────────────────────
router.post('/email/verify', authLoginLimiter, async (req, res, next) => {
  try {
    const { verify_token, email_code } = req.body;
    const clientFP = extractClientFingerprint(req);

    if (!verify_token || !email_code) {
      return res.status(400).json({ success: false, error: 'Verification token and 6-digit email code are required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(verify_token, JWT_SECRET);
      if (decoded.purpose !== 'email_verification_pending') throw new Error('Invalid token purpose');
    } catch {
      return res.status(401).json({ success: false, error: 'Verification session expired or invalid. Please log in again.' });
    }

    const hashedInput = crypto.createHash('sha256').update(String(email_code).trim()).digest('hex');

    const [rows] = await pool.query(
      `SELECT id, email, full_name, role, is_active, totp_enabled, totp_secret,
              email_verification_token, email_verification_expires
       FROM admins WHERE id = ? LIMIT 1`,
      [decoded.id]
    );

    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ success: false, error: 'Administrator account not found or disabled.' });
    }

    const admin = rows[0];

    if (!admin.email_verification_token || !admin.email_verification_expires || new Date(admin.email_verification_expires) < new Date()) {
      return res.status(400).json({ success: false, error: 'Verification code has expired. Please click "Resend Code".' });
    }

    if (admin.email_verification_token !== hashedInput) {
      await pool.query(
        `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, details, severity, ip_address)
         VALUES (?, ?, ?, 'EMAIL_VERIFY_FAILED', 'admins', 'Invalid email verification code entered', 'warning', ?)`,
        [crypto.randomUUID(), admin.id, admin.full_name, clientFP.ip]
      );
      return res.status(400).json({ success: false, error: 'Invalid verification code. Please check your email and try again.' });
    }

    // Email verified successfully
    await pool.query(
      'UPDATE admins SET email_verified = 1, email_verification_token = NULL, email_verification_expires = NULL WHERE id = ?',
      [admin.id]
    );

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, details, severity, ip_address)
       VALUES (?, ?, ?, 'EMAIL_VERIFIED', 'admins', 'Corporate email address successfully verified', 'info', ?)`,
      [crypto.randomUUID(), admin.id, admin.full_name, clientFP.ip]
    );

    // If TOTP is enabled on this account, advance to MFA step
    if (admin.totp_enabled && admin.totp_secret) {
      const mfaToken = jwt.sign(
        {
          id: admin.id,
          email: admin.email,
          role: admin.role,
          full_name: admin.full_name,
          purpose: 'mfa_pending',
          subnet: clientFP.subnet,
          uaHash: clientFP.uaHash
        },
        JWT_SECRET,
        { expiresIn: '5m' }
      );

      return res.json({
        success: true,
        requires_mfa: true,
        mfa_token: mfaToken,
        message: 'Email verified. Please enter the 6-digit code from your authenticator app.'
      });
    }

    // Finalize login
    await pool.query(
      'UPDATE admins SET failed_login_attempts = 0, lock_until = NULL, last_login = NOW(), last_login_ip = ? WHERE id = ?',
      [clientFP.ip, admin.id]
    );

    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        full_name: admin.full_name,
        subnet: clientFP.subnet,
        uaHash: clientFP.uaHash
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('df_admin_session', token, buildCookieOptions());
    res.cookie('df_csrf_token', csrfToken, { ...buildCookieOptions(), httpOnly: false });

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, details, severity, ip_address)
       VALUES (?, ?, ?, 'AUTH_LOGIN', 'admins', 'Successful administrator login following email verification', 'info', ?)`,
      [crypto.randomUUID(), admin.id, admin.full_name, clientFP.ip]
    );

    res.json({
      success: true,
      csrfToken,
      admin: {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role,
        totp_enabled: false,
        email_verified: true
      }
    });

  } catch (err) { next(err); }
});

// ── POST /api/auth/email/resend ─────────────────────────────────────────────
router.post('/email/resend', authLoginLimiter, async (req, res, next) => {
  try {
    const { verify_token } = req.body;
    if (!verify_token) {
      return res.status(400).json({ success: false, error: 'Verification token is required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(verify_token, JWT_SECRET);
      if (decoded.purpose !== 'email_verification_pending') throw new Error('Invalid token purpose');
    } catch {
      return res.status(401).json({ success: false, error: 'Verification session expired. Please log in again.' });
    }

    const [rows] = await pool.query('SELECT id, email, full_name, is_active FROM admins WHERE id = ?', [decoded.id]);
    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ success: false, error: 'Administrator account not found.' });
    }

    const admin = rows[0];
    const emailOtp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = crypto.createHash('sha256').update(emailOtp).digest('hex');

    await pool.query(
      'UPDATE admins SET email_verification_token = ?, email_verification_expires = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?',
      [hashedOtp, admin.id]
    );

    await sendAdminEmailVerificationOtp(admin.email, admin.full_name, emailOtp);

    res.json({
      success: true,
      dev_otp: process.env.NODE_ENV === 'development' ? emailOtp : undefined,
      message: `A fresh 6-digit verification code has been dispatched to ${admin.email}.`
    });
  } catch (err) { next(err); }
});

// ── POST /api/auth/mfa/verify ───────────────────────────────────────────────
router.post('/mfa/verify', authLoginLimiter, async (req, res, next) => {
  try {
    const { mfa_token, totp_code } = req.body;
    const clientFP = extractClientFingerprint(req);

    if (!mfa_token || !totp_code) {
      return res.status(400).json({ success: false, error: 'MFA token and 6-digit authenticator code are required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(mfa_token, JWT_SECRET);
      if (decoded.purpose !== 'mfa_pending') throw new Error('Invalid token purpose');
    } catch {
      return res.status(401).json({ success: false, error: 'MFA session expired or invalid. Please log in again.' });
    }

    const [rows] = await pool.query(
      'SELECT id, email, full_name, role, is_active, totp_secret, totp_enabled FROM admins WHERE id = ?',
      [decoded.id]
    );

    if (!rows.length || !rows[0].is_active || !rows[0].totp_secret) {
      return res.status(401).json({ success: false, error: 'Administrator account unavailable or MFA unconfigured.' });
    }

    const admin = rows[0];
    const cleanedCode = String(totp_code).trim().replace(/\s+/g, '');
    const checkRes = await otplib.verify({ token: cleanedCode, secret: admin.totp_secret });
    const isValid = Boolean(checkRes && checkRes.valid);

    if (!isValid) {
      await pool.query(
        `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, details, severity, ip_address)
         VALUES (?, ?, ?, 'MFA_VERIFY_FAILED', 'admins', 'Invalid 6-digit TOTP code submitted', 'warning', ?)`,
        [crypto.randomUUID(), admin.id, admin.full_name, clientFP.ip]
      );
      return res.status(401).json({ success: false, error: 'Invalid authenticator code. Please check your app and try again.' });
    }

    // Success — reset attempts, update telemetry
    await pool.query(
      'UPDATE admins SET failed_login_attempts = 0, lock_until = NULL, last_login = NOW(), last_login_ip = ? WHERE id = ?',
      [clientFP.ip, admin.id]
    );

    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        full_name: admin.full_name,
        mfa_verified: true,
        subnet: clientFP.subnet,
        uaHash: clientFP.uaHash
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('df_admin_session', token, buildCookieOptions());
    res.cookie('df_csrf_token', csrfToken, { ...buildCookieOptions(), httpOnly: false });

    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, details, severity, ip_address)
       VALUES (?, ?, ?, 'AUTH_MFA_LOGIN_SUCCESS', 'admins', 'Successful Two-Factor Authentication login', 'info', ?)`,
      [crypto.randomUUID(), admin.id, admin.full_name, clientFP.ip]
    );

    res.json({
      success: true,
      csrfToken,
      admin: {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role,
        totp_enabled: true
      }
    });

  } catch (err) { next(err); }
});

// ── POST /api/auth/mfa/setup ────────────────────────────────────────────────
router.post('/mfa/setup', requireAdminAuth(), async (req, res, next) => {
  try {
    const secret = otplib.generateSecret();
    const otpauth = otplib.generateURI({
      issuer: 'Divine Fingers Healthcare',
      label: req.admin.email,
      secret
    });
    const qrCodeDataUrl = await qrcode.toDataURL(otpauth, { margin: 2, width: 220 });

    // Store unconfirmed secret
    await pool.query('UPDATE admins SET totp_secret = ? WHERE id = ?', [secret, req.admin.id]);

    res.json({
      success: true,
      secret,
      qrCode: qrCodeDataUrl,
      message: 'Scan this QR code with Google Authenticator or Microsoft Authenticator, then enter the 6-digit code to enable.'
    });
  } catch (err) { next(err); }
});

// ── POST /api/auth/mfa/confirm ──────────────────────────────────────────────
router.post('/mfa/confirm', requireAdminAuth(), async (req, res, next) => {
  try {
    const { totp_code } = req.body;
    if (!totp_code) {
      return res.status(400).json({ success: false, error: '6-digit confirmation code is required.' });
    }

    const [rows] = await pool.query('SELECT totp_secret FROM admins WHERE id = ?', [req.admin.id]);
    if (!rows.length || !rows[0].totp_secret) {
      return res.status(400).json({ success: false, error: 'No MFA setup in progress. Please start setup again.' });
    }

    const cleanedCode = String(totp_code).trim().replace(/\s+/g, '');
    const checkRes = await otplib.verify({ token: cleanedCode, secret: rows[0].totp_secret });
    const isValid = Boolean(checkRes && checkRes.valid);

    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Verification code incorrect. Please try again.' });
    }

    await pool.query('UPDATE admins SET totp_enabled = 1 WHERE id = ?', [req.admin.id]);
    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, details, severity, ip_address)
       VALUES (?, ?, ?, 'MFA_ENABLED', 'admins', 'User enrolled and verified Two-Factor Authentication (TOTP)', 'info', ?)`,
      [crypto.randomUUID(), req.admin.id, req.admin.full_name, req.ip]
    );

    res.json({
      success: true,
      message: '✅ Two-Factor Authentication has been successfully enabled on your account.'
    });
  } catch (err) { next(err); }
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', requireAdminAuth(), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, email, full_name, role, is_active, email_verified, totp_enabled, last_login, last_login_ip FROM admins WHERE id = ?',
      [req.admin.id]
    );
    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ success: false, error: 'Administrator session invalid.' });
    }
    const admin = rows[0];
    res.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role,
        totp_enabled: Boolean(admin.totp_enabled),
        email_verified: Boolean(admin.email_verified),
        last_login: admin.last_login,
        last_login_ip: admin.last_login_ip
      }
    });
  } catch (err) { next(err); }
});

// ── POST /api/auth/logout ───────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('df_admin_session', { path: '/' });
  res.clearCookie('df_csrf_token', { path: '/' });
  res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;

