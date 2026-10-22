'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../db');

describe('Admin Mandatory Email OTP Authentication (Option 1)', () => {
  const BASE_URL = 'http://localhost:3000';
  const testEmail = `admin-otp-${Date.now()}@divinefingershealthcare.ca`;
  const rawPassword = 'Password123!@#Secure';
  let adminId;

  before(async () => {
    adminId = crypto.randomUUID();
    const hash = await bcrypt.hash(rawPassword, 10);
    await pool.query(
      `INSERT INTO admins (id, email, password_hash, full_name, role, is_active, email_verified)
       VALUES (?, ?, ?, 'Test OTP Admin', 'super-admin', 1, 1)`,
      [adminId, testEmail, hash]
    );
  });

  test('Step 1: Primary credentials return requires_email_verification challenge', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: rawPassword })
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.requires_email_verification, true);
    assert.ok(data.verify_token, 'Verify token must be present');
    assert.ok(data.email, 'Masked email must be present');

    // Verify OTP was stored in DB
    const [rows] = await pool.query('SELECT email_verification_token, email_verification_expires FROM admins WHERE id = ?', [adminId]);
    assert.ok(rows[0].email_verification_token, 'Hashed OTP must exist in DB');
    assert.ok(new Date(rows[0].email_verification_expires) > new Date(), 'Expires must be in future');
  });

  test('Step 2: Submitting wrong OTP code is rejected', async () => {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: rawPassword })
    });
    const loginData = await loginRes.json();
    const verifyToken = loginData.verify_token;

    const badVerifyRes = await fetch(`${BASE_URL}/api/auth/email/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verify_token: verifyToken, email_code: '000000' })
    });

    const badData = await badVerifyRes.json();
    assert.equal(badVerifyRes.status, 400);
    assert.equal(badData.success, false);
    assert.ok(badData.error.includes('Invalid verification code'));
  });

  test('Step 3: Submitting valid OTP completes login and sets session cookie', async () => {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: rawPassword })
    });
    const loginData = await loginRes.json();
    const freshOtp = loginData.dev_otp;
    const verifyToken = loginData.verify_token;

    const goodVerifyRes = await fetch(`${BASE_URL}/api/auth/email/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verify_token: verifyToken, email_code: freshOtp })
    });

    const goodData = await goodVerifyRes.json();
    assert.equal(goodVerifyRes.status, 200);
    assert.equal(goodData.success, true);
    assert.equal(goodData.admin.email, testEmail);

    // Verify cookies set
    const cookieHeader = goodVerifyRes.headers.get('set-cookie');
    assert.ok(cookieHeader, 'Set-Cookie headers must be present');
    assert.ok(cookieHeader.includes('df_admin_session'), 'df_admin_session cookie must be set');
    assert.ok(cookieHeader.includes('df_csrf_token'), 'df_csrf_token cookie must be set');

    // Verify DB OTP was invalidated (single-use)
    const [rows] = await pool.query('SELECT email_verification_token FROM admins WHERE id = ?', [adminId]);
    assert.equal(rows[0].email_verification_token, null, 'OTP must be cleared after use');
  });

  test('Step 4: Replay attack (re-using old OTP) fails', async () => {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: rawPassword })
    });
    const loginData = await loginRes.json();
    const verifyToken = loginData.verify_token;
    const otp = loginData.dev_otp;

    // First use - succeeds
    const res1 = await fetch(`${BASE_URL}/api/auth/email/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verify_token: verifyToken, email_code: otp })
    });
    const data1 = await res1.json();
    assert.equal(res1.status, 200);
    assert.equal(data1.success, true);

    // Second use - fails
    const res2 = await fetch(`${BASE_URL}/api/auth/email/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verify_token: verifyToken, email_code: otp })
    });
    assert.equal(res2.status, 400);
  });

  after(async () => {
    try {
      await pool.query('DELETE FROM admins WHERE id = ?', [adminId]);
      await pool.query('DELETE FROM email_logs WHERE recipient_email = ?', [testEmail]);
      await pool.end().catch(() => {});
    } catch (_) {}
  });
});
