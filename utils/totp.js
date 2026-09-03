const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(encoded) {
  const cleaned = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function generateSecret(length = 20) {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += BASE32_ALPHABET[bytes[i] % 32];
  }
  return result;
}

function generateURI({ issuer = 'Divine Fingers Healthcare', label = 'admin', secret }) {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedLabel = encodeURIComponent(label);
  return `otpauth://totp/${encodedIssuer}:${encodedLabel}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

function generateHOTP(secret, counter) {
  const key = typeof secret === 'string' ? base32Decode(secret) : secret;
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter), 0);

  const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1000000;

  return String(code).padStart(6, '0');
}

function verify({ token, secret, window = 2 }) {
  if (!token || !secret) return { valid: false };
  const cleanedToken = String(token).trim();
  const currentCounter = Math.floor(Date.now() / 1000 / 30);

  for (let i = -window; i <= window; i++) {
    const counter = currentCounter + i;
    const expected = generateHOTP(secret, counter);
    if (expected === cleanedToken) {
      return { valid: true };
    }
  }
  return { valid: false };
}

module.exports = {
  generateSecret,
  generateURI,
  generateHOTP,
  verify
};
