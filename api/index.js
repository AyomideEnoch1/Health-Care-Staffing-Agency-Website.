let app;
try {
  app = require('../server');
} catch (err) {
  console.error('[Vercel Server Init Error]:', err);
}

module.exports = (req, res) => {
  if (!app) {
    try {
      app = require('../server');
    } catch (err) {
      return res.status(500).json({
        error: 'Server Initialization Failed',
        message: err.message,
        stack: err.stack
      });
    }
  }

  try {
    if (req.url && !req.url.startsWith('/api')) {
      req.url = '/api' + req.url;
    }
    return app(req, res);
  } catch (err) {
    return res.status(500).json({
      error: 'Request Execution Failed',
      message: err.message,
      stack: err.stack
    });
  }
};
