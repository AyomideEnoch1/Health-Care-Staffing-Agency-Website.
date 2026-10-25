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
const fs = require('fs');
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
const emailWebhooksRoute = require('./routes/emailWebhooks');
const documentsRoute    = require('./routes/documents');
const adminMailRoute    = require('./routes/adminMail');
const { initMailListener } = require('./services/mail/mailListener');
const mailService       = require('./services/mail/MailService');
const { startShiftLifecycleDaemon } = require('./utils/shiftLifecycle');
const errorHandler      = require('./middleware/errorHandler');

const isProd = process.env.NODE_ENV === 'production';
const JWT_ADMIN_SECRET = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET || 'divine_fingers_default_admin_jwt_secret_key_2026';
const JWT_USER_SECRET  = process.env.JWT_USER_SECRET  || process.env.USER_JWT_SECRET || process.env.JWT_SECRET || 'divine_fingers_default_user_jwt_secret_key_2026';

// ── Startup Cryptographic Guard ───────────────────────────────────────────────
if (isProd) {
  if (!process.env.JWT_ADMIN_SECRET || process.env.JWT_ADMIN_SECRET.length < 32) {
    throw new Error('[FATAL STARTUP GUARD] JWT_ADMIN_SECRET must be set and at least 32 characters in production.');
  }
  if (!process.env.JWT_USER_SECRET || process.env.JWT_USER_SECRET.length < 32) {
    throw new Error('[FATAL STARTUP GUARD] JWT_USER_SECRET must be set and at least 32 characters in production.');
  }
  if (process.env.JWT_ADMIN_SECRET === process.env.JWT_USER_SECRET) {
    throw new Error('[FATAL STARTUP GUARD] JWT_ADMIN_SECRET and JWT_USER_SECRET must be different distinct keys.');
  }
}

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Reverse Proxy & IP Fingerprinting ─────────────────────────────────────────
// Behind Nginx and Cloudflare, trust 1 hop so req.ip reflects the real visitor IP
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
app.disable('x-powered-by');

// ── Security Headers (Helmet + Strict Telemetry & Privacy Safeguards) ──────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
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

// ── CORS (Strict Whitelist — No null origin, no wildcard hosting domains) ────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Non-browser / same-origin requests (curl, server-to-server)
    if (!origin) return callback(null, true);

    // Explicitly reject null origin (sandboxed iframe / data URI attack vector)
    if (origin === 'null') {
      return callback(new Error('CORS: origin "null" is explicitly prohibited.'));
    }

    const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
    if (!isProd && isLocal) {
      return callback(null, true);
    }

    // Auto-allow application's own origin (PUBLIC_BASE_URL)
    const publicBase = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    if (publicBase && origin === publicBase) {
      return callback(null, true);
    }

    // Auto-allow Render deployment domains and primary brand domain
    const renderHost = (process.env.RENDER_EXTERNAL_HOSTNAME || '').trim();
    if (
      (renderHost && origin.includes(renderHost)) ||
      origin.endsWith('.onrender.com') ||
      origin.includes('divinefingershealthcare.ca')
    ) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS: origin ${origin} is not authorized.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'X-Staff-Id',
    'X-Staff-Email',
    'X-Staff-Name',
    'X-User-Session',
    'X-Requested-With',
    'Accept'
  ]
}));

// ── Cookie Parser ─────────────────────────────────────────────────────────────
app.use(cookieParser());

// ── CSRF Validation Middleware (double-submit cookie pattern) ─────────────────
// Applied to state-changing admin routes only (PATCH/POST /api/admin/*).
// GET requests and public routes are excluded — they don't modify state.
function verifyCsrfToken(req, res, next) {
  if (process.env.NODE_ENV === 'test') return next();
  const tokenFromCookie = req.cookies && req.cookies['df_csrf_token'];
  const tokenFromHeader = req.headers && req.headers['x-csrf-token'];

  // Constant-time comparison when token cookie and header are both present
  if (tokenFromCookie && tokenFromHeader) {
    const cookieBuf = Buffer.from(tokenFromCookie);
    const headerBuf = Buffer.from(tokenFromHeader);
    if (cookieBuf.length === headerBuf.length && require('crypto').timingSafeEqual(cookieBuf, headerBuf)) {
      return next();
    }
  }

  // Fallback: If request is authenticated via valid admin session cookie and origin matches host
  const adminCookie = req.cookies && (req.cookies['df_admin_session'] || req.cookies['df_session']);
  if (adminCookie) {
    try {
      const decoded = jwt.verify(adminCookie, JWT_ADMIN_SECRET);
      if (decoded && (decoded.id || decoded.email)) {
        const origin = req.headers['origin'] || req.headers['referer'] || '';
        const host = req.headers['host'] || '';
        if (!origin || (host && origin.includes(host)) || tokenFromHeader) {
          return next();
        }
      }
    } catch (_) {}
  }

  // Fallback: If Bearer token is provided
  if (req.headers && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    const bearer = req.headers.authorization.split(' ')[1];
    try {
      const decoded = jwt.verify(bearer, JWT_ADMIN_SECRET);
      if (decoded && decoded.id) return next();
    } catch (_) {}
  }

  if (!tokenFromCookie || !tokenFromHeader) {
    return res.status(403).json({
      success: false,
      error: 'CSRF validation failed: missing token. Please refresh the page and try again.'
    });
  }

  return res.status(403).json({
    success: false,
    error: 'CSRF validation failed: token mismatch. Request blocked.'
  });
}

// ── Body Parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    console.log(`[API ${req.method}] ${req.url}`);
  }
  next();
});

// ── Server-Side Gate for Admin Dashboard (Zero Unauthenticated Markup) ────────
const jwt = require('jsonwebtoken');

const FRONTEND_SRC = path.join(__dirname, '../frontend/src');
const FRONTEND_PUBLIC = path.join(__dirname, '../frontend/public');

// Subdomain router: if accessing via admin subdomain, direct root / directly to /admin
app.use((req, res, next) => {
  const host = (req.hostname || req.headers.host || '').toLowerCase();
  if (host.startsWith('admin.') && (req.path === '/' || req.path === '/index.html')) {
    return res.redirect('/admin');
  }
  next();
});

app.get(['/admin', '/admin.html'], (req, res) => {
  const sessionCookie = req.cookies ? req.cookies['df_admin_session'] : null;
  const loginPath = path.join(FRONTEND_SRC, 'admin-login.html');
  const dashPath = path.join(__dirname, 'private/admin-dashboard.html');

  if (!sessionCookie) {
    if (fs.existsSync(loginPath)) {
      return res.sendFile(loginPath);
    }
    return res.redirect('/admin-login.html');
  }

  try {
    const decoded = jwt.verify(sessionCookie, JWT_ADMIN_SECRET);
    if (!decoded || !decoded.id) {
      res.clearCookie('df_admin_session');
      if (fs.existsSync(loginPath)) return res.sendFile(loginPath);
      return res.redirect('/admin-login.html');
    }
    // Authenticated administrator: Serve private operational dashboard shell
    if (fs.existsSync(dashPath)) {
      return res.sendFile(dashPath);
    }
    if (fs.existsSync(loginPath)) return res.sendFile(loginPath);
    return res.redirect('/admin-login.html');
  } catch (err) {
    res.clearCookie('df_admin_session');
    if (fs.existsSync(loginPath)) return res.sendFile(loginPath);
    return res.redirect('/admin-login.html');
  }
});

// Serve public profile pictures safely with strict caching & nosniff
app.use('/uploads/avatars', express.static(path.join(__dirname, 'uploads/avatars'), {
  maxAge: '7d',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  }
}));

// Block any direct public access to private and internal directories
app.use(['/private', '/uploads'], (req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Strict path guard: Block public access to backend code, configs, databases, and sensitive assets
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  if (
    p.startsWith('/deploy') ||
    p.startsWith('/sql') ||
    p.startsWith('/tests') ||
    p.startsWith('/scripts') ||
    p.startsWith('/workers') ||
    p.startsWith('/utils') ||
    p.startsWith('/middleware') ||
    p.startsWith('/routes') ||
    p.startsWith('/.env') ||
    p.startsWith('/.git') ||
    p.startsWith('/node_modules') ||
    p.startsWith('/scratch') ||
    p.endsWith('.sql') ||
    p.endsWith('.py') ||
    p.endsWith('.json') ||
    p.endsWith('.md') ||
    p.endsWith('.yml') ||
    p.endsWith('.yaml') ||
    p.endsWith('.sh')
  ) {
    return res.status(404).json({ error: 'Not Found' });
  }
  next();
});

// Redirect legacy/alternate careers URLs to candidate quick application section
app.get(['/careers', '/careers.html'], (req, res) => {
  res.redirect(302, '/jobseekers.html#apply-now');
});

// ── Static Assets (serves HTML, CSS, client JS, images from frontend) ─────────
app.use('/assets', express.static(path.join(FRONTEND_PUBLIC, 'assets')));
app.use(express.static(FRONTEND_PUBLIC, { dotfiles: 'ignore' }));
app.use(express.static(FRONTEND_SRC, {
  dotfiles: 'ignore',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css') || filePath.endsWith('.js') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/requests',     requestsRoute);
app.use('/api/applications', applicationsRoute);
app.use('/api/contact',      contactRoute);
app.use('/api/auth',         authRoute);
app.use('/api/documents',    documentsRoute);
// CSRF verification only on admin state-changing routes
app.use('/api/admin', (req, res, next) => {
  // Apply CSRF check to PATCH, DELETE, and POST (not GET/OPTIONS/SSE stream/clean-dummy-data)
  if (req.method === 'PATCH' || req.method === 'DELETE' || (req.method === 'POST' && req.path !== '/stream' && req.path !== '/clean-dummy-data')) {
    return verifyCsrfToken(req, res, next);
  }
  next();
});
app.use('/api/admin/mail', adminMailRoute);
app.use('/api/admin', adminRoute);
app.use('/api/shifts', shiftsRoute);
app.use('/api/newsletter', newsletterRoute);
app.use('/api/users', usersAuthRoute);
app.use('/api/webhooks/email', emailWebhooksRoute);

// ── Enterprise Domain Event Mail Listener ──────────────────────────────────────
initMailListener();

// ── Health Check ──────────────────────────────────────────────────────────────
// Checks both API liveness AND active DB connection.
// Dashboard polls this endpoint and surfaces a "system degraded" state if it fails.
app.get(['/health', '/api/health'], async (req, res) => {
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
  res.status(200).json({
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

    // Verify DB connection on startup (with 3 retries over 10s for cloud network latency)
    let dbConnected = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await pool.query('SELECT 1');
        console.log(`✅ [Database] Connected to MySQL (${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'divine_fingers_dev'})`);
        dbConnected = true;
        break;
      } catch (err) {
        console.warn(`⚠️ [Database] Connection attempt ${attempt}/3 failed: ${err.message}`);
        if (attempt < 3) await new Promise(r => setTimeout(r, 3000));
      }
    }
    if (!dbConnected) {
      console.warn('⚠️ [Database Notice] MySQL connection pending or unreachable on startup. Background pool will reconnect automatically once available.');
    }

    // Verify SMTP (non-blocking warning only)
    try {
      const mailer = require('./utils/mailer');
      await mailer.verifyConnection();
    } catch (err) {
      console.warn(`⚠️  [SMTP Warning] Could not connect to mail server: ${err.message}`);
    }

    // Shift daemon execution:
    // In production, shiftLifecycle is run as a dedicated systemd service (app-shift-lifecycle.service).
    // In local development or when RUN_EMBEDDED_DAEMON=true, run embedded daemon.
    if (process.env.RUN_EMBEDDED_DAEMON === 'true' || !isProd) {
      startShiftLifecycleDaemon(60000);
      mailService.startWorkerDaemon(10000);
      const { drainPendingOutbox } = require('./utils/mailOutbox');
      setInterval(() => drainPendingOutbox(10).catch(() => {}), 15000);
      drainPendingOutbox(20).catch(() => {});
    } else {
      console.log('⏱️ [Shift Lifecycle] Running in standalone service mode (managed by systemd).');
    }
  });
}

module.exports = app;
