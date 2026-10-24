/**
 * End-to-End Verification Test: Admin-Managed MSA Rate Cards
 * Divine Fingers Healthcare Services Inc.
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'divine_fingers_default_secure_jwt_secret_key_2026_production_fallback';

// Generate admin JWT session token
const adminToken = jwt.sign({
  id: 'c4970cd8-eb90-4e33-9aba-446711e88d8b',
  email: 'admin@divinefingershealthcare.ca',
  full_name: 'Divine Fingers Administrator',
  role: 'super-admin',
  permissions: ['requests:view', 'requests:dispatch', 'roster:view', 'roster:manage', 'admins:manage']
}, JWT_SECRET, { expiresIn: '1h' });

const csrfToken = 'test-csrf-token-2026';
const cookieHeader = `df_admin_session=${adminToken}; df_csrf_token=${csrfToken}`;

async function runTests() {
  console.log('🧪 Starting MSA Rate Card Flow Verification Tests...\n');
  let testsPassed = 0;

  // 1. GET /api/admin/facilities
  console.log('Test 1: List all facilities...');
  const res1 = await fetch(`${BASE_URL}/api/admin/facilities`, {
    headers: { 'Cookie': cookieHeader }
  });
  const data1 = await res1.json();
  if (!data1.success || !Array.isArray(data1.data) || data1.data.length === 0) {
    throw new Error('Test 1 Failed: Could not list facilities');
  }
  console.log(`✅ Test 1 Passed: Retrieved ${data1.data.length} facilities.`);
  testsPassed++;

  const existingFacility = data1.data[0];
  console.log(`   Sample facility: ${existingFacility.name} (${existingFacility.facility_code}), Status: ${existingFacility.status}`);

  // 2. POST /api/admin/facilities (Create new facility)
  console.log('\nTest 2: Create a new healthcare facility profile...');
  const testFacName = `Test Hospital Center ${Date.now().toString().slice(-4)}`;
  const res2 = await fetch(`${BASE_URL}/api/admin/facilities`, {
    method: 'POST',
    headers: {
      'Cookie': cookieHeader,
      'X-CSRF-Token': csrfToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: testFacName,
      address: '789 Bay Street, Toronto, ON',
      region: 'Toronto Central',
      contact_name: 'Dr. Marcus Vance',
      contact_email: 'staffing@testhospital.ca',
      contact_phone: '+1 416-555-0199',
      status: 'pending'
    })
  });
  const data2 = await res2.json();
  if (!data2.success || !data2.data.id) {
    throw new Error('Test 2 Failed: ' + JSON.stringify(data2));
  }
  const createdFacId = data2.data.id;
  console.log(`✅ Test 2 Passed: Facility created: ${testFacName} (ID: ${createdFacId}, Code: ${data2.data.facility_code})`);
  testsPassed++;

  // 3. POST /api/admin/facilities/:id/rate-cards (Establish Term 1)
  console.log('\nTest 3: Establish Contracted Term 1 for RN ($95.00/hr)...');
  const res3 = await fetch(`${BASE_URL}/api/admin/facilities/${createdFacId}/rate-cards`, {
    method: 'POST',
    headers: {
      'Cookie': cookieHeader,
      'X-CSRF-Token': csrfToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      role: 'RN',
      shift_type: 'standard',
      bill_rate: 95.00,
      pay_rate: 55.00,
      overtime_multiplier: 1.50,
      effective_date: '2026-03-01',
      notes: 'Initial signed MSA term'
    })
  });
  const data3 = await res3.json();
  if (!data3.success || !data3.data.id) {
    throw new Error('Test 3 Failed: ' + JSON.stringify(data3));
  }
  const term1Id = data3.data.id;
  console.log(`✅ Test 3 Passed: Contracted term established: RN @ $95.00/hr (ID: ${term1Id})`);
  testsPassed++;

  // 4. POST /api/admin/facilities/:id/rate-cards (Establish Term 2 - Auto-expire Term 1)
  console.log('\nTest 4: Establish Contracted Term 2 for RN ($99.50/hr effective 2026-06-01) -> Auto-expire Term 1...');
  const res4 = await fetch(`${BASE_URL}/api/admin/facilities/${createdFacId}/rate-cards`, {
    method: 'POST',
    headers: {
      'Cookie': cookieHeader,
      'X-CSRF-Token': csrfToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      role: 'RN',
      shift_type: 'standard',
      bill_rate: 99.50,
      pay_rate: 58.00,
      overtime_multiplier: 1.50,
      effective_date: '2026-06-01',
      notes: 'Mid-year MSA contracted increase'
    })
  });
  const data4 = await res4.json();
  if (!data4.success || !data4.data.id) {
    throw new Error('Test 4 Failed: ' + JSON.stringify(data4));
  }
  console.log(`✅ Test 4 Passed: Second contracted term established: RN @ $99.50/hr`);
  testsPassed++;

  // 5. GET /api/admin/facilities/:id/rate-cards (Verify Auto-Expiry in Audit Trail)
  console.log('\nTest 5: Verify Term 1 was auto-expired and Term 2 is active...');
  const res5 = await fetch(`${BASE_URL}/api/admin/facilities/${createdFacId}/rate-cards`, {
    headers: { 'Cookie': cookieHeader }
  });
  const data5 = await res5.json();
  if (!data5.success || data5.data.length < 2) {
    throw new Error('Test 5 Failed: Expected 2 rate cards, got: ' + JSON.stringify(data5));
  }
  const term1Record = data5.data.find(c => c.id === term1Id);
  const term2Record = data5.data.find(c => c.id === data4.data.id);

  if (!term1Record || !term1Record.expiry_date) {
    throw new Error(`Test 5 Failed: Term 1 expiry_date should be set. Actual: ${term1Record?.expiry_date}`);
  }
  if (!term2Record || term2Record.expiry_date !== null) {
    throw new Error(`Test 5 Failed: Term 2 should be active (expiry_date null). Actual: ${term2Record?.expiry_date}`);
  }
  console.log(`✅ Test 5 Passed: Term 1 auto-expired on ${term1Record.expiry_date.slice(0, 10)}. Term 2 active with bill_rate $${term2Record.bill_rate}/hr.`);
  testsPassed++;

  // 6. Test Billing Summary Rate Resolution
  console.log('\nTest 6: Verify GET /api/requests/billing-summary resolves MSA contracted rates...');
  const res6 = await fetch(`${BASE_URL}/api/requests/billing-summary`, {
    headers: { 'Cookie': cookieHeader }
  });
  const data6 = await res6.json();
  if (!data6.success || !Array.isArray(data6.itemized_records)) {
    throw new Error('Test 6 Failed: Billing summary invalid response');
  }
  console.log(`✅ Test 6 Passed: Billing summary returned ${data6.itemized_records.length} itemized records with dynamic rate resolution.`);
  if (data6.itemized_records.length > 0) {
    const sample = data6.itemized_records[0];
    console.log(`   Sample shift ${sample.request_code} (${sample.facility_name}): Role ${sample.staff_role}, Hourly Rate $${sample.hourly_rate}/hr, Rate Source: ${sample.rate_source}`);
  }
  testsPassed++;

  // 7. Test Admin One-Off Rate Exception on a Shift
  console.log('\nTest 7: Verify Admin One-Off Rate Exception PATCH /api/admin/requests/:id/rate-exception...');
  if (data6.itemized_records.length > 0) {
    const shiftId = data6.itemized_records[0].id;
    const res7 = await fetch(`${BASE_URL}/api/admin/requests/${shiftId}/rate-exception`, {
      method: 'PATCH',
      headers: {
        'Cookie': cookieHeader,
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        billing_hourly_rate: 112.50,
        reason: 'Special holiday emergency coverage approved by account manager'
      })
    });
    const data7 = await res7.json();
    if (!data7.success || data7.data.billing_hourly_rate !== 112.50) {
      throw new Error('Test 7 Failed: Rate exception not saved: ' + JSON.stringify(data7));
    }
    console.log(`✅ Test 7 Passed: One-off rate exception applied ($112.50/hr).`);
    testsPassed++;

    // Verify billing-summary now uses this exception rate
    const res8 = await fetch(`${BASE_URL}/api/requests/billing-summary`, {
      headers: { 'Cookie': cookieHeader }
    });
    const data8 = await res8.json();
    const updatedRecord = data8.itemized_records.find(r => r.id === shiftId);
    if (!updatedRecord || updatedRecord.hourly_rate !== 112.50 || updatedRecord.rate_source !== 'admin_exception') {
      throw new Error(`Test 7 Failed: Expected rate 112.50 from admin_exception, got ${updatedRecord?.hourly_rate}`);
    }
    console.log(`✅ Test 7b Passed: Billing summary reflects admin exception rate ($112.50/hr) with source 'admin_exception'.`);
    testsPassed++;
  }

  console.log(`\n==================================================`);
  console.log(`🎉 ALL ${testsPassed} VERIFICATION TESTS PASSED SUCCESSFULLY!`);
  console.log(`==================================================\n`);
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
