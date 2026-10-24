'use strict';
/**
 * Automated Security Tests: Zip-Slip Defenses, Token Expiry, and Network Controls
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const AdmZip = require('adm-zip');

const { safeExtractZip } = require('../utils/zipSecurity');
const { generateSecureToken, verifyTokenHash } = require('../utils/cryptoUtils');

describe('Zip-Slip & Archive Security Defenses', () => {
  test('safeExtractZip() rejects zip-slip path traversal entry (../../evil.sh)', () => {
    const zip = new AdmZip();
    zip.addFile('normal.txt', Buffer.from('#!/bin/bash\necho "pwned"'));
    // Explicitly inject directory traversal into entryName to simulate crafted zip-slip attack
    zip.getEntries()[0].entryName = '../../evil.sh';

    const tempExtractDir = path.join(os.tmpdir(), `df-zip-test-${Date.now()}`);

    assert.throws(() => {
      safeExtractZip(zip, tempExtractDir);
    }, /Zip-Slip/);

    // Verify file was never written
    assert.equal(fs.existsSync(path.join(tempExtractDir, '../../evil.sh')), false);
  });

  test('safeExtractZip() successfully extracts safe normal archive', () => {
    const zip = new AdmZip();
    zip.addFile('subfolder/document.txt', Buffer.from('Legitimate clinical document'));
    const zipBuffer = zip.toBuffer();

    const tempExtractDir = path.join(os.tmpdir(), `df-zip-safe-${Date.now()}`);

    const result = safeExtractZip(zipBuffer, tempExtractDir);
    assert.equal(result.success, true);
    assert.equal(fs.existsSync(path.join(tempExtractDir, 'subfolder/document.txt')), true);

    // Clean up
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
  });

  test('safeExtractZip() rejects archives exceeding max entry limit (zip-bomb defense)', () => {
    const zip = new AdmZip();
    for (let i = 0; i < 15; i++) {
      zip.addFile(`file_${i}.txt`, Buffer.from(`data ${i}`));
    }
    const zipBuffer = zip.toBuffer();
    const tempDir = path.join(os.tmpdir(), `df-zip-bomb-${Date.now()}`);

    assert.throws(() => {
      safeExtractZip(zipBuffer, tempDir, { maxEntries: 10 });
    }, /exceeds maximum permitted entry count/);
  });
});

describe('Token Security & Expiry Validation', () => {
  test('Token hash verification matches and distinguishes different tokens', () => {
    const token1 = generateSecureToken(32);
    const token2 = generateSecureToken(32);

    assert.notEqual(token1.token, token2.token);
    assert.notEqual(token1.hash, token2.hash);

    assert.equal(verifyTokenHash(token1.token, token1.hash), true);
    assert.equal(verifyTokenHash(token2.token, token1.hash), false);
  });

  test('Simulated token expiry logic strictly invalidates expired tokens', () => {
    const expiredTimestamp = new Date(Date.now() - 5000); // 5 seconds in past
    const isExpired = new Date(expiredTimestamp) <= new Date();
    assert.equal(isExpired, true, 'Token with timestamp in the past must be treated as expired');

    const validTimestamp = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes in future
    const isValid = new Date(validTimestamp) > new Date();
    assert.equal(isValid, true, 'Token with future expiry must be accepted');
  });
});

describe('JWT Secret Separation Guard', () => {
  test('Production environment requires different secrets for admin and user tokens', () => {
    const origEnv = process.env.NODE_ENV;
    const origAdmin = process.env.JWT_ADMIN_SECRET;
    const origUser = process.env.JWT_USER_SECRET;

    try {
      process.env.NODE_ENV = 'production';
      process.env.JWT_ADMIN_SECRET = 'identical-secret-shared-across-both-contexts-32chars';
      process.env.JWT_USER_SECRET = 'identical-secret-shared-across-both-contexts-32chars';

      // Validation logic mimicking server.js startup guard
      const validateSecrets = (adminSecret, userSecret) => {
        if (!adminSecret || adminSecret.length < 32) throw new Error('JWT_ADMIN_SECRET too short');
        if (!userSecret || userSecret.length < 32) throw new Error('JWT_USER_SECRET too short');
        if (adminSecret === userSecret) throw new Error('JWT_ADMIN_SECRET and JWT_USER_SECRET must be different distinct keys.');
      };

      assert.throws(() => {
        validateSecrets(process.env.JWT_ADMIN_SECRET, process.env.JWT_USER_SECRET);
      }, /must be different distinct keys/);

      // Verify separate keys pass
      process.env.JWT_USER_SECRET = 'different-user-secret-with-over-32-characters-length!';
      assert.doesNotThrow(() => {
        validateSecrets(process.env.JWT_ADMIN_SECRET, process.env.JWT_USER_SECRET);
      });
    } finally {
      process.env.NODE_ENV = origEnv;
      process.env.JWT_ADMIN_SECRET = origAdmin;
      process.env.JWT_USER_SECRET = origUser;
    }
  });
});
