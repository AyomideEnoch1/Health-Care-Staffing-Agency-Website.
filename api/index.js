/**
 * NON-PRODUCTION / LEGACY PREVIEW ADAPTER ONLY
 * Divine Fingers Healthcare Services Inc.
 * 
 * NOTICE: The production deployment target is a hardened Hostinger VPS.
 * This serverless shim is retained solely for non-production preview testing.
 */

let app;
try {
  app = require('../server');
} catch (err) {
  console.error('[Preview Server Init Error]:', err.message);
}

module.exports = (req, res) => {
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    return res.status(403).json({
      error: 'Access Denied: Serverless endpoint disabled in production. Use VPS origin.'
    });
  }

  if (!app) {
    try {
      app = require('../server');
    } catch (err) {
      return res.status(500).json({ error: 'Server initialization failed' });
    }
  }

  try {
    if (req.url && !req.url.startsWith('/api') && !req.url.startsWith('/admin')) {
      req.url = '/api' + req.url;
    }
    return app(req, res);
  } catch (err) {
    return res.status(500).json({ error: 'Request execution failed' });
  }
};
