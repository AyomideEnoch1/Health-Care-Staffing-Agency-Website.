/**
 * Main Application Server
 * Divine Fingers Healthcare Services Inc.
 *
 * Architecture: Node.js + Express + MySQL (mysql2/promise)
 * Security stack: Helmet, CORS, cookie-parser, CSRF (double-submit cookie pattern),
 *                 httpOnly JWT cookies, rate limiting, parameterized queries.
 *
 * CSRF strategy (double-submit cookie pattern):
 *   - On login, server sets two cookies: df_admin_session (httpOnly JWT) and
 *     df_csrf_token (readable by JS).
 *   - Client reads df_csrf_token cookie and sends it as X-CSRF-Token header on
 *     every state-changing request (PATCH/POST to /api/admin/*).
 *   - Server verifies the header value matches the cookie value.
 *   - Cross-site requests cannot read the cookie (SameSite + CORS) so they
 *     cannot forge the header. This defends against CSRF without server-side sessions.
 *
 * Technical safeguards are aligned with PHIPA/PIPEDA principles.
 * Legal/privacy compliance (data retention policy, breach notification procedure,
 * privacy officer designation) requires separate non-technical review.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const pool = require('./db');
const requestsRoute     = require('./routes/requests');
const applicationsRoute = require('./routes/applications');
const contactRoute      = require('./routes/contact');
const authRoute         = require('./routes/auth');
const adminRoute        = require('./routes/admin');
const shiftsRoute       = require('./routes/shifts');
const newsletterRoute   = require('./routes/newsletter');
const usersAuthRoute    = require('./routes/usersAuth');
const { startShiftLifecycleDaemon } = require('./utils/shiftLifecycle');
const errorHandler      = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security Headers (Helmet + Strict Telemetry & Privacy Safeguards) ──────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https:"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
}));

// Additional HTTP Security & Permissions Headers
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allowed origins are configured via ALLOWED_ORIGINS env var (comma-separated).
// In development (NODE_ENV !== 'production'), localhost is always permitted.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === 'null') return callback(null, true); // Same-origin, file:// or non-browser requests
    const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
    const isDev   = process.env.NODE_ENV !== 'production';
    if ((isDev && isLocal) || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: origin ${origin} not allowed.`));
  },
  credentials: true, // Required for cookies to be sent cross-origin
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token']
}));

// ── Cookie Parser ─────────────────────────────────────────────────────────────
app.use(cookieParser());

// ── CSRF Validation Middleware (double-submit cookie pattern) ─────────────────
// Applied to state-changing admin routes only (PATCH/POST /api/admin/*).
// GET requests and public routes are excluded — they don't modify state.
function verifyCsrfToken(req, res, next) {
  const tokenFromCookie = req.cookies['df_csrf_token'];
  const tokenFromHeader = req.headers['x-csrf-token'];

  if (!tokenFromCookie || !tokenFromHeader) {
    return res.status(403).json({
      success: false,
      error: 'CSRF validation failed: missing token. Please refresh the page and try again.'
    });
  }

  // Constant-time comparison to prevent timing attacks
  const cookieBuf = Buffer.from(tokenFromCookie);
  const headerBuf = Buffer.from(tokenFromHeader);
  if (cookieBuf.length !== headerBuf.length || !require('crypto').timingSafeEqual(cookieBuf, headerBuf)) {
    return res.status(403).json({
      success: false,
      error: 'CSRF validation failed: token mismatch. Request blocked.'
    });
  }

  next();
}

// ── Body Parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── Server-Side Gate for Admin Dashboard (Zero Unauthenticated Markup) ────────
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'divine_fingers_default_secure_jwt_secret_key_2026_production_fallback';

app.get(['/admin', '/admin.html'], (req, res) => {
  const sessionCookie = req.cookies['df_admin_session'];
  if (!sessionCookie) {
    // Unauthenticated visitor: Return ONLY the clean login shell (no dashboard DOM/PII)
    return res.sendFile(path.join(__dirname, 'admin-login.html'));
  }

  try {
    const decoded = jwt.verify(sessionCookie, JWT_SECRET);
    if (!decoded || !decoded.id) {
      res.clearCookie('df_admin_session');
      return res.sendFile(path.join(__dirname, 'admin-login.html'));
    }
    // Authenticated administrator: Serve private operational dashboard shell
    return res.sendFile(path.join(__dirname, 'private/admin-dashboard.html'));
  } catch (err) {
    res.clearCookie('df_admin_session');
    return res.sendFile(path.join(__dirname, 'admin-login.html'));
  }
});

// Block any direct public access to private directory
app.use('/private', (req, res) => {
  res.status(403).json({ error: 'Access Denied: Private Server Directory' });
});

// ── Static Assets (serves HTML, CSS, JS, images) ─────────────────────────────
app.use(express.static(path.join(__dirname, './')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/requests',     requestsRoute);
app.use('/api/applications', applicationsRoute);
app.use('/api/contact',      contactRoute);
app.use('/api/auth',         authRoute);
// CSRF verification only on admin state-changing routes
app.use('/api/admin', (req, res, next) => {
  // Apply CSRF check only to PATCH and POST (not GET/OPTIONS/SSE stream)
  if (req.method === 'PATCH' || (req.method === 'POST' && req.path !== '/stream')) {
    return verifyCsrfToken(req, res, next);
  }
  next();
});
app.use('/api/admin', adminRoute);
app.use('/api/shifts', shiftsRoute);
app.use('/api/newsletter', newsletterRoute);
app.use('/api/users', usersAuthRoute);

// ── Health Check ──────────────────────────────────────────────────────────────
// Checks both API liveness AND active DB connection.
// Dashboard polls this endpoint and surfaces a "system degraded" state if it fails.
app.get('/api/health', async (req, res) => {
  let dbOk = false;
  let dbLatencyMs = null;
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    dbLatencyMs = Date.now() - start;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const status = dbOk ? 'healthy' : 'degraded';
  res.status(dbOk ? 200 : 503).json({
    status,
    api: 'online',
    database: dbOk ? `connected (${dbLatencyMs}ms)` : 'unreachable',
    timestamp: new Date().toISOString(),
    service: 'Divine Fingers Healthcare API'
  });
});

// ── Centralized Error Handler ─────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server (Local / Standalone execution) ───────────────────────────────
if (require.main === module) {
  const server = app.listen(PORT, async () => {
    console.log(`🚀 Divine Fingers Healthcare API running on http://localhost:${PORT}`);
    console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);

    // Verify DB connection on startup
    try {
      await pool.query('SELECT 1');
      console.log(`✅ [Database] Connected to MySQL (${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'divine_fingers_dev'})`);
    } catch (err) {
      console.error(`❌ [Database] Connection failed: ${err.message}`);
    }

    // Verify SMTP (non-blocking warning only)
    try {
      const mailer = require('./utils/mailer');
      await mailer.verifyConnection();
    } catch (err) {
      console.warn(`⚠️  [SMTP Warning] Could not connect to mail server: ${err.message}`);
    }

    // Start automated shift progression lifecycle engine
    startShiftLifecycleDaemon(60000);
  });
}

module.exports = app;
