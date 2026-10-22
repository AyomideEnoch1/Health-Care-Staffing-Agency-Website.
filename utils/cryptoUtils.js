/**
 * Cryptographic & Sanitization Utilities
 * Divine Fingers Healthcare Services Inc.
 * Aligned with PHIPA/PIPEDA and HIPAA data-at-rest principles.
 */

const crypto = require('crypto');

// Master encryption key: Must be 32 bytes (64 hex characters or 32 raw bytes)
function getMasterKey() {
  const envKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!envKey) {
    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
      throw new Error('CRITICAL: ENCRYPTION_KEY environment variable is mandatory in production.');
    }
    // Development-only deterministic fallback
    return crypto.createHash('sha256').update('dev-local-encryption-key-divine-fingers-2026').digest();
  }
  return crypto.createHash('sha256').update(envKey).digest();
}

/**
 * Hash an email address using SHA-256 for indexed lookup & suppression list checks
 * without storing or exposing raw plaintext email.
 */
function hashEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

/**
 * Mask an email for audit logs (e.g., j***n@example.com).
 * Prevents PHI/PII leakage in operational log stores.
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) {
    return `${name[0]}***@${domain}`;
  }
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

/**
 * Encrypt sensitive text (such as email recipient or payload) using AES-256-GCM.
 * Output format: iv:authTag:ciphertext (hex encoded)
 */
function encryptField(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return '';
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const key = getMasterKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt text encrypted with encryptField().
 */
function decryptField(encryptedString) {
  if (!encryptedString || typeof encryptedString !== 'string') return '';
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    // Return raw if it was stored unencrypted (legacy backward compatibility)
    return encryptedString;
  }
  
  const [ivHex, tagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const key = getMasterKey();
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Sanitize an email header field to strictly prevent CRLF / SMTP header injection.
 * Strips \r, \n, and other ASCII control characters (0x00 - 0x1F, 0x7F).
 */
function sanitizeHeader(headerValue) {
  if (headerValue === null || headerValue === undefined) return '';
  return String(headerValue)
    .replace(/[\r\n\x00-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Escape HTML characters to prevent email-based XSS and HTML injection.
 */
function escapeHtml(unsafeText) {
  if (unsafeText === null || unsafeText === undefined) return '';
  return String(unsafeText)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate a cryptographically secure random token and its SHA-256 hash.
 * Only the hash should ever be stored in the database.
 */
function generateSecureToken(bytes = 32) {
  const token = crypto.randomBytes(bytes).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

/**
 * Verify a plaintext candidate token against a stored SHA-256 hash using timingSafeEqual.
 */
function verifyTokenHash(candidateToken, storedHash) {
  if (!candidateToken || !storedHash) return false;
  const candidateHash = crypto.createHash('sha256').update(candidateToken).digest('hex');
  const candBuf = Buffer.from(candidateHash, 'utf8');
  const storedBuf = Buffer.from(storedHash, 'utf8');
  if (candBuf.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(candBuf, storedBuf);
}

module.exports = {
  hashEmail,
  maskEmail,
  encryptField,
  decryptField,
  sanitizeHeader,
  escapeHtml,
  generateSecureToken,
  verifyTokenHash
};
