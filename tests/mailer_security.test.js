'use strict';
/**
 * Automated Security & Unit Tests: Email, Crypto, and Startup Guards
 * Run with: npm test
 */

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  sanitizeHeader,
  escapeHtml,
  generateSecureToken,
  verifyTokenHash,
  hashEmail,
  maskEmail,
  encryptField,
  decryptField
} = require('../utils/cryptoUtils');

const { render } = require('../utils/mailTemplates');

describe('Cryptographic & Header Injection Defenses', () => {
  test('sanitizeHeader() must completely strip CRLF and control characters', () => {
    const maliciousSubject = "Urgent Update\r\nBcc: attacker@evil.com\nSubject: Spoofed";
    const sanitized = sanitizeHeader(maliciousSubject);

    assert.equal(sanitized.includes('\r'), false, 'Must not contain carriage return');
    assert.equal(sanitized.includes('\n'), false, 'Must not contain newline');
    assert.equal(sanitized, 'Urgent Update Bcc: attacker@evil.com Subject: Spoofed');

    // Test null byte injection
    const nullByteHeader = "Normal\x00Header\x1FValue";
    assert.equal(sanitizeHeader(nullByteHeader), 'Normal Header Value');
  });

  test('escapeHtml() must escape dangerous HTML characters to neutralize email XSS', () => {
    const maliciousInput = '<script>alert("xss")</script><img src=x onerror=alert(1)> & " \'';
    const escaped = escapeHtml(maliciousInput);

    assert.equal(escaped.includes('<script>'), false);
    assert.equal(escaped.includes('<img'), false);
    assert.equal(escaped.includes('&amp;'), true);
    assert.equal(escaped.includes('&quot;'), true);
    assert.equal(escaped.includes('&#039;'), true);
  });

  test('generateSecureToken() generates high-entropy 32-byte tokens and matching SHA-256 hashes', () => {
    const { token, hash } = generateSecureToken(32);

    assert.equal(token.length, 64, '32 bytes in hex must be 64 characters');
    assert.equal(hash.length, 64, 'SHA-256 hex must be 64 characters');

    const expectedHash = crypto.createHash('sha256').update(token).digest('hex');
    assert.equal(hash, expectedHash);

    assert.equal(verifyTokenHash(token, hash), true, 'Valid token must verify true');
    assert.equal(verifyTokenHash('invalid-tampered-token', hash), false, 'Tampered token must verify false');
    assert.equal(verifyTokenHash(token, 'invalid-hash'), false);
  });

  test('hashEmail() generates deterministic SHA-256 for case-insensitive suppression checks', () => {
    const hash1 = hashEmail('Nurse.Jane@Hospital.CA');
    const hash2 = hashEmail('  nurse.jane@hospital.ca ');
    assert.equal(hash1, hash2, 'Trimmed lowercase emails must produce identical hash');
    assert.equal(hash1.length, 64);
  });

  test('maskEmail() masks PII for privacy-safe audit logging', () => {
    assert.equal(maskEmail('john.doe@example.com'), 'j***e@example.com');
    assert.equal(maskEmail('rn@hospital.ca'), 'r***@hospital.ca');
  });

  test('encryptField() and decryptField() correctly round-trip using AES-256-GCM', () => {
    const sensitive = 'super-confidential-nurse-ssn-or-email@domain.com';
    const encrypted = encryptField(sensitive);
    assert.notEqual(encrypted, sensitive);
    assert.equal(encrypted.split(':').length, 3, 'GCM format must be iv:tag:ciphertext');

    const decrypted = decryptField(encrypted);
    assert.equal(decrypted, sensitive);
  });
});

describe('Template Rendering & Privacy Rules', () => {
  test('staffing_request_alert escapes untrusted user inputs and produces plaintext fallback', () => {
    const rendered = render('staffing_request_alert', {
      facility_name: '<script>alert(1)</script> Sunnybrook',
      role_requested: 'RN">malicious',
      request_code: 'REQ-999',
      urgency_level: 'routine'
    });

    assert.equal(rendered.html.includes('<script>'), false);
    assert.equal(rendered.html.includes('&lt;script&gt;'), true);
    assert.equal(rendered.subject.includes('<script>'), false);
    assert.ok(rendered.text.length > 50, 'Plaintext alternative must be populated');
  });

  test('staff_welcome contains NO plaintext passwords', () => {
    const rendered = render('staff_welcome', {
      full_name: 'Florence Nightingale',
      staff_code: 'RN-8801',
      activation_url: 'https://example.com/portal?token=abc'
    });

    assert.equal(/temporary[-_\s]password/i.test(rendered.html), false, 'No temporary password wording');
    assert.equal(/DivineFingers2026!/.test(rendered.html), false, 'No default credentials');
    assert.equal(rendered.html.includes('Florence Nightingale'), true);
  });

  test('All registered email templates render properly with clean plaintext fallback', () => {
    const { templates } = require('../utils/mailTemplates');
    assert.ok(templates.length >= 10, 'Must have at least 10 email templates registered');

    const sampleVars = {
      facility_name: 'Mount Sinai Hospital',
      role_requested: 'RN Intensive Care',
      request_code: 'REQ-5512',
      urgency_level: 'routine',
      full_name: 'Dr. Jane Smith',
      role_applied: 'RPN Specialist',
      application_code: 'APP-9988',
      otp_code: '839201',
      reset_url: 'https://example.com/reset?token=xyz',
      invite_url: 'https://example.com/invite?token=abc',
      role: 'Staff Administrator',
      staff_code: 'RN-1022',
      activation_url: 'https://example.com/activate?token=123',
      name: 'John Client',
      contact_name: 'Sarah Director',
      inquiry_code: 'INQ-402',
      inquiry_type: 'Facility Partnership',
      message: 'Need 5 RNs for surgical ward next week.',
      unit_department: 'Cardiology',
      shift_type: 'Day 07:00-15:00',
      staff_name: 'Nurse David',
      email: 'staff@example.com',
      phone: '+1-647-555-0199'
    };

    for (const type of templates) {
      const rendered = render(type, sampleVars);
      assert.ok(rendered.subject && rendered.subject.length > 5, `Subject for ${type} must be non-empty`);
      assert.ok(rendered.html && rendered.html.includes('Divine Fingers'), `HTML for ${type} must contain branding`);
      assert.ok(rendered.text && rendered.text.length > 20, `Plaintext for ${type} must be non-empty`);
      assert.equal(rendered.html.includes('<script>'), false, `HTML for ${type} must not contain raw script tags`);
    }
  });
});

describe('Production Startup Guards', () => {
  test('Refuses to start if NODE_ENV=production and SMTP_HOST is localhost/empty', () => {
    const { assertProductionSmtpConfig } = require('../utils/mailer');
    const origEnv = process.env.NODE_ENV;
    const origHost = process.env.SMTP_HOST;
    const origUser = process.env.SMTP_USER;
    const origPass = process.env.SMTP_PASS;

    try {
      process.env.NODE_ENV = 'production';
      process.env.SMTP_HOST = '127.0.0.1';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';

      assert.throws(() => {
        assertProductionSmtpConfig();
      }, /Insecure SMTP_HOST/);

      process.env.SMTP_HOST = 'smtp.hostinger.com';
      process.env.SMTP_USER = '';
      assert.throws(() => {
        assertProductionSmtpConfig();
      }, /SMTP authentication credentials/);

      process.env.SMTP_USER = 'valid@notify.domain.com';
      process.env.SMTP_PASS = 'StrongPassword123!';
      assert.doesNotThrow(() => {
        assertProductionSmtpConfig();
      });
    } finally {
      process.env.NODE_ENV = origEnv;
      process.env.SMTP_HOST = origHost;
      process.env.SMTP_USER = origUser;
      process.env.SMTP_PASS = origPass;
    }
  });
});

describe('Email Webhook Signature Verification', () => {
  test('Verifies valid HMAC-SHA256 signature and rejects tampered payloads', () => {
    const secret = 'test-webhook-secret-key-32-bytes-long';
    process.env.EMAIL_WEBHOOK_SECRET = secret;

    const payload = JSON.stringify({
      event: 'bounce',
      email: 'bounced.clinician@domain.com',
      reason: '550 User unknown'
    });

    const validSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // Simulate mock req, res, next
    let nextCalled = false;
    const req = {
      headers: { 'x-webhook-signature': validSig },
      body: payload
    };
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(obj) {
        this.body = obj;
        return this;
      }
    };
    const next = () => { nextCalled = true; };

    const { verifyWebhookSignature } = require('../routes/emailWebhooks');
    verifyWebhookSignature(req, res, next);
    assert.equal(nextCalled, true, 'Valid signature must invoke next()');

    // Test tampered signature
    nextCalled = false;
    req.headers['x-webhook-signature'] = 'bad' + validSig.slice(3);
    verifyWebhookSignature(req, res, next);
    assert.equal(nextCalled, false, 'Tampered signature must be rejected');
    assert.equal(res.statusCode, 401);
  });
});

after(async () => {
  const pool = require('../db');
  if (pool && typeof pool.end === 'function') {
    await pool.end().catch(() => {});
  }
});
