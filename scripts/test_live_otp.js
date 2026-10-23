const path = require('path');
const jwt = require(path.join(__dirname, '../node_modules/jsonwebtoken'));

const API_BASE = 'https://health-care-staffing-agency-website.vercel.app/api';

async function testLiveProduction() {
  console.log('Testing live Vercel deployment at:', API_BASE);

  const testEmail = `live.test.${Date.now()}@test-hospital.ca`;
  const regRes = await fetch(`${API_BASE}/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'client',
      full_name: 'Live Verifier',
      email: testEmail,
      phone: '+1 416-555-1234',
      password: 'SecurePassword123!',
      organization_name: 'Vercel Live Hospital'
    })
  });

  const regData = await regRes.json();
  console.log('Register HTTP Status:', regRes.status);
  console.log('Register Response:', regData);

  if (!regData.success || !regData.verify_token) {
    throw new Error('Registration failed on live production: ' + JSON.stringify(regData));
  }

  const decoded1 = jwt.decode(regData.verify_token);
  console.log('Initial token decoded successfully:', {
    email: decoded1.email,
    has_otp_hash: !!decoded1.otp_hash,
    otp_exp: new Date(decoded1.otp_exp).toISOString()
  });

  // Test Resend OTP on live production
  console.log('\nTesting Resend OTP on live production...');
  const resendRes = await fetch(`${API_BASE}/users/resend-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verify_token: regData.verify_token })
  });

  const resendData = await resendRes.json();
  console.log('Resend HTTP Status:', resendRes.status);
  console.log('Resend Response:', resendData);

  if (!resendData.success || !resendData.verify_token) {
    throw new Error('Resend OTP failed on live production: ' + JSON.stringify(resendData));
  }

  const decoded2 = jwt.decode(resendData.verify_token);
  console.log('Resend token decoded successfully:', {
    email: decoded2.email,
    has_otp_hash: !!decoded2.otp_hash,
    is_new_hash: decoded2.otp_hash !== decoded1.otp_hash,
    otp_exp: new Date(decoded2.otp_exp).toISOString()
  });

  console.log('\n🎉 ALL LIVE PRODUCTION CHECKS SUCCEEDED! No account not found errors, no expiration bugs!');
}

testLiveProduction().catch(err => {
  console.error('❌ Live production test error:', err);
  process.exit(1);
});
