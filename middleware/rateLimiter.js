const rateLimit = require('express-rate-limit');

/**
 * Public Form Submission Rate Limiter
 * Limits IP to 10 submissions per 15 minutes window.
 */
const isProd = process.env.NODE_ENV === 'production';

const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 10 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many submissions from this IP address. Please wait 15 minutes before trying again.'
  }
});

const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 30 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many login attempts. Please wait 15 minutes before trying again.'
  }
});

module.exports = { publicFormLimiter, authLoginLimiter };
