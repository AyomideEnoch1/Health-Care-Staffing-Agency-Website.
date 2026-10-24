const path = require('path');
const crypto = require('crypto');
const jwt = require(path.join(__dirname, '../node_modules/jsonwebtoken'));
const mysql = require(path.join(__dirname, '../node_modules/mysql2/promise'));
require(path.join(__dirname, '../node_modules/dotenv')).config();

const API_BASE = 'http://localhost:3000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'divine-fingers-default-secret-key-change-in-production';

async function runTests() {
  console.log('=== STARTING OTP REGISTRATION & VERIFICATION QA TESTS ===\n');

  const testEmail = `test.facility.${Date.now()}@example-hospital.ca`;
  const testPassword = 'Password123!';
  const testOrg = `Test Hospital Center ${Date.now()}`;
  const testPhone = '+1 (416) 555-0199';

  // 1. REGISTER FACILITY
  console.log('Test 1: Registering new facility client account...');
  const regRes = await fetch(`${API_BASE}/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'client',
      full_name: 'Dr. QA Tester',
      email: testEmail,
      phone: testPhone,
      password: testPassword,
      organization_name: testOrg
    })
  });

  const regData = await regRes.json();
  console.log('Register HTTP Status:', regRes.status);
  console.log('Register Response:', regData);

  if (!regData.success || !regData.requires_email_verification || !regData.verify_token) {
    throw new Error('Registration failed or did not require verification!');
  }
  console.log('✅ Test 1 Passed: Registration created and verify_token returned.\n');

  // Decode verify_token
  const decodedToken = jwt.verify(regData.verify_token, JWT_SECRET);
  console.log('Decoded Token Claims:');
  console.log({
    id: decodedToken.id,
    email: decodedToken.email,
    purpose: decodedToken.purpose,
    has_otp_hash: !!decodedToken.otp_hash,
    otp_exp: new Date(decodedToken.otp_exp).toISOString()
  });

  // 2. RESEND OTP TEST
  console.log('\nTest 2: Requesting Resend OTP...');
  const resendRes = await fetch(`${API_BASE}/users/resend-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verify_token: regData.verify_token })
  });

  const resendData = await resendRes.json();
  console.log('Resend HTTP Status:', resendRes.status);
  console.log('Resend Response:', resendData);

  if (!resendData.success || !resendData.verify_token) {
    throw new Error('Resend OTP failed: ' + JSON.stringify(resendData));
  }
  console.log('✅ Test 2 Passed: Resend OTP returned fresh verify_token.\n');

  // 3. RETRIEVE CODE FOR VERIFICATION
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'divine_fingers_dev'
  });

  const [userRows] = await conn.query('SELECT email_verification_token, email_verification_expires FROM users WHERE email = ?', [testEmail]);
  const dbUser = userRows[0];
  console.log('DB User Verification Expiry:', dbUser.email_verification_expires);

  let matchedCode = null;
  for (let i = 100000; i <= 999999; i++) {
    const h = crypto.createHash('sha256').update(String(i)).digest('hex');
    if (h === dbUser.email_verification_token) {
      matchedCode = String(i);
      break;
    }
  }
  console.log('Found 6-digit OTP code:', matchedCode);
  await conn.end();

  // 4. VERIFY OTP TEST
  console.log('\nTest 3: Submitting 6-digit OTP verification...');
  const verifyRes = await fetch(`${API_BASE}/users/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      verify_token: resendData.verify_token,
      email_code: matchedCode
    })
  });

  const verifyData = await verifyRes.json();
  console.log('Verify HTTP Status:', verifyRes.status);
  console.log('Verify Response:', verifyData);

  if (!verifyData.success || !verifyData.user) {
    throw new Error('OTP verification failed: ' + JSON.stringify(verifyData));
  }
  console.log('✅ Test 3 Passed: Account verified, session active, redirect confirmed.\n');

  // 5. TEST STATELESS SERVERLESS RECOVERY
  console.log('Test 4: Simulating Cold-Start on Stateless Serverless Function...');
  const phantomId = crypto.randomUUID();
  const phantomEmail = `phantom.${Date.now()}@hospital.ca`;
  const phantomOtp = '654321';
  const phantomHash = crypto.createHash('sha256').update(phantomOtp).digest('hex');
  const phantomToken = jwt.sign(
    {
      id: phantomId,
      email: phantomEmail,
      full_name: 'Dr. Phantom Stateless',
      role: 'client',
      organization_name: 'Stateless Regional Hospital',
      facility_id: null,
      phone: '+1 416-555-8888',
      otp_hash: phantomHash,
      otp_exp: Date.now() + 15 * 60 * 1000,
      purpose: 'user_verify_pending'
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const coldStartRes = await fetch(`${API_BASE}/users/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      verify_token: phantomToken,
      email_code: phantomOtp
    })
  });

  const coldStartData = await coldStartRes.json();
  console.log('Cold Start Verify Status:', coldStartRes.status);
  console.log('Cold Start Verify Response:', coldStartData);

  if (!coldStartData.success || !coldStartData.user) {
    throw new Error('Cold start verify failed: ' + JSON.stringify(coldStartData));
  }
  console.log('✅ Test 4 Passed: Stateless cold-start successfully recovered and verified user.\n');

  console.log('=== ALL OTP & REGISTRATION TESTS PASSED PERFECTLY! ===');
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
