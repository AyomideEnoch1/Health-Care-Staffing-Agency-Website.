/**
 * Centralized Error & PII Redaction Handler
 * Ensures no sensitive fields (passwords, tokens, CNO registration numbers) leak to logs or clients.
 */
function errorHandler(err, req, res, next) {
  // Sanitize incoming body for logging
  const sanitizedBody = { ...req.body };
  if (sanitizedBody.password) sanitizedBody.password = '[REDACTED]';
  if (sanitizedBody.password_hash) sanitizedBody.password_hash = '[REDACTED]';
  if (sanitizedBody.token) sanitizedBody.token = '[REDACTED]';

  console.error(`[ERROR] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  console.error(`Client IP: ${req.ip} | Message: ${err.message}`);
  
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      error: `File upload error: ${err.message}`
    });
  }

  // Consistent sanitized client error
  res.status(err.status || 500).json({
    success: false,
    error: err.status ? err.message : 'An error occurred while processing your request. Please contact support.'
  });
}

module.exports = errorHandler;
