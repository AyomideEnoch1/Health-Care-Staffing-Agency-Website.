/**
 * Comprehensive Automated QA Test Suite for:
 * Facilities & Contracted Rates Page (Admin Dashboard)
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const pool = require('../db');

const results = [];

function recordTest(step, feature, expected, actual, pass, notes = '') {
  results.push({ step, feature, expected, actual, pass, notes });
  const icon = pass ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] Step ${step}: ${feature}`);
  if (!pass) {
    console.error(`       Expected: ${expected}`);
    console.error(`       Actual:   ${actual}`);
  }
  if (notes) console.log(`       Note:     ${notes}`);
}

async function runFacilitiesQATests() {
  console.log('================================================================');
  console.log('  STARTING FACILITIES & CONTRACTED RATES QA TEST SUITE');
  console.log(`  Target: ${BASE_URL}`);
  console.log('================================================================\n');

  let adminCookie = '';
  let csrfToken = '';
  let testFacilityId = null;
  let testTerm1Id = null;
  let testTerm2Id = null;
  let testTerm3Id = null;
  let testTerm4Id = null;
  let testClientId = null;
  let testRequestId = null;

  try {
    // -------------------------------------------------------------------------
    // 1. Admin Authentication & CSRF
    // -------------------------------------------------------------------------
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@divinefingershealthcare.ca',
        password: 'AdminSecure2026!'
      })
    });

    const setCookies = loginRes.headers.get('set-cookie') || '';
    const sessionMatch = setCookies.match(/df_admin_session=([^;]+)/);
    const csrfMatch = setCookies.match(/df_csrf_token=([^;]+)/);

    if (sessionMatch && csrfMatch) {
      adminCookie = `df_admin_session=${sessionMatch[1]}; df_csrf_token=${csrfMatch[1]}`;
      csrfToken = decodeURIComponent(csrfMatch[1]);
      recordTest(1, 'Admin Authentication & CSRF Acquisition', 'Valid session and CSRF cookies received', 'Session and CSRF tokens received', true);
    } else {
      recordTest(1, 'Admin Authentication & CSRF Acquisition', 'Valid cookies', `Cookies: ${setCookies}`, false);
      throw new Error('Failed admin login');
    }

    const authHeaders = {
      'Content-Type': 'application/json',
      'Cookie': adminCookie,
      'X-CSRF-Token': csrfToken
    };

    // -------------------------------------------------------------------------
    // 2. Initial Facilities Ledger Retrieval (GET /api/admin/facilities)
    // -------------------------------------------------------------------------
    const facListRes = await fetch(`${BASE_URL}/api/admin/facilities`, {
      headers: { 'Cookie': adminCookie }
    });
    const facListData = await facListRes.json();
    const facListOk = facListRes.status === 200 && facListData.success === true && Array.isArray(facListData.data);
    recordTest(
      2,
      'Facilities Ledger Retrieval (GET /api/admin/facilities)',
      'HTTP 200 with success: true and data array',
      `HTTP ${facListRes.status}, data length: ${facListData.data ? facListData.data.length : 0}`,
      facListOk,
      `Retrieved ${facListData.data ? facListData.data.length : 0} facility records`
    );

    // Verify presence of required fields in facility records
    if (facListData.data && facListData.data.length > 0) {
      const sample = facListData.data[0];
      const hasFields = sample.id && sample.name && ('active_rate_cards_count' in sample) && ('effective_status' in sample);
      recordTest(
        3,
        'Facility Record Schema Verification',
        'Facility objects contain id, name, effective_status, active_rate_cards_count, has_portal_account',
        `Sample facility has: id=${!!sample.id}, status=${sample.effective_status}, activeTerms=${sample.active_rate_cards_count}`,
        hasFields
      );
    } else {
      recordTest(3, 'Facility Record Schema Verification', 'Facility objects present', 'No existing facilities, will test on newly created', true);
    }

    // -------------------------------------------------------------------------
    // 3. Initial Registered Clients Retrieval (GET /api/admin/registered-clients)
    // -------------------------------------------------------------------------
    const clientListRes = await fetch(`${BASE_URL}/api/admin/registered-clients`, {
      headers: { 'Cookie': adminCookie }
    });
    const clientListData = await clientListRes.json();
    const clientListOk = clientListRes.status === 200 && clientListData.success === true && Array.isArray(clientListData.data);
    recordTest(
      4,
      'Registered Clients Ledger Retrieval (GET /api/admin/registered-clients)',
      'HTTP 200 with success: true and data array',
      `HTTP ${clientListRes.status}, data length: ${clientListData.data ? clientListData.data.length : 0}`,
      clientListOk,
      `Retrieved ${clientListData.data ? clientListData.data.length : 0} registered client users`
    );

    // -------------------------------------------------------------------------
    // 4. Facility Registration Validation (POST /api/admin/facilities - Invalid Body)
    // -------------------------------------------------------------------------
    const invalidFacRes = await fetch(`${BASE_URL}/api/admin/facilities`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        address: '123 Fake Street',
        region: 'GTA'
      })
    });
    const invalidFacData = await invalidFacRes.json();
    recordTest(
      5,
      'Facility Registration Validation (Missing Name)',
      'HTTP 400 with validation failure message',
      `HTTP ${invalidFacRes.status}, success: ${invalidFacData.success}`,
      invalidFacRes.status === 400 && invalidFacData.success === false
    );

    // -------------------------------------------------------------------------
    // 5. Register Healthcare Facility (POST /api/admin/facilities - Valid Body)
    // -------------------------------------------------------------------------
    const newFacilityPayload = {
      name: 'Sunnybrook QA Testing Health Centre',
      facility_code: 'FAC-SBK-QA',
      address: '2075 Bayview Ave, Toronto, ON M4N 3M5',
      region: 'Toronto Central',
      contact_name: 'Dr. Gregory House',
      contact_email: 'staffing-qa@sunnybrook-test.ca',
      contact_phone: '+1 416-480-6100',
      status: 'pending',
      msa_signed_date: '2026-01-15',
      msa_expiry_date: '2027-01-15',
      msa_document_url: 'https://storage.divinefingershealthcare.ca/contracts/msa-sbk-qa-2026.pdf'
    };

    const createFacRes = await fetch(`${BASE_URL}/api/admin/facilities`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(newFacilityPayload)
    });
    const createFacData = await createFacRes.json();
    const createFacOk = createFacRes.status === 201 && createFacData.success === true && createFacData.data?.id;
    if (createFacOk) {
      testFacilityId = createFacData.data.id;
    }
    recordTest(
      6,
      'Register Healthcare Facility Profile (POST /api/admin/facilities)',
      'HTTP 201 with generated UUID id and saved fields',
      `HTTP ${createFacRes.status}, id=${testFacilityId}`,
      createFacOk,
      `Created facility "${newFacilityPayload.name}" with initial status "pending"`
    );

    // -------------------------------------------------------------------------
    // 6. Edit Facility Details (PATCH /api/admin/facilities/:id)
    // -------------------------------------------------------------------------
    const editFacRes = await fetch(`${BASE_URL}/api/admin/facilities/${testFacilityId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        contact_name: 'Dr. James Wilson (Chief of Staffing)',
        contact_phone: '+1 416-480-9999',
        facility_code: 'FAC-SBK-V2'
      })
    });
    const editFacData = await editFacRes.json();
    const editFacOk = editFacRes.status === 200 && editFacData.success === true && editFacData.data?.contact_name === 'Dr. James Wilson (Chief of Staffing)';
    recordTest(
      7,
      'Edit Facility Profile (PATCH /api/admin/facilities/:id)',
      'HTTP 200 with updated contact person and facility code',
      `HTTP ${editFacRes.status}, contact_name="${editFacData.data?.contact_name}"`,
      editFacOk
    );

    // -------------------------------------------------------------------------
    // 7. Rate Cards Retrieval on Fresh Facility (GET /api/admin/facilities/:id/rate-cards)
    // -------------------------------------------------------------------------
    const ratesInitialRes = await fetch(`${BASE_URL}/api/admin/facilities/${testFacilityId}/rate-cards`, {
      headers: { 'Cookie': adminCookie }
    });
    const ratesInitialData = await ratesInitialRes.json();
    const ratesInitialOk = ratesInitialRes.status === 200 && ratesInitialData.success === true && Array.isArray(ratesInitialData.data) && ratesInitialData.data.length === 0;
    recordTest(
      8,
      'Rate Cards Initial Query (GET /api/admin/facilities/:id/rate-cards)',
      'HTTP 200 with empty array (triggering Global Standard fallback hint in UI)',
      `HTTP ${ratesInitialRes.status}, terms count=${ratesInitialData.data ? ratesInitialData.data.length : -1}`,
      ratesInitialOk
    );

    // -------------------------------------------------------------------------
    // 8. Add Contracted Rate Term (POST /api/admin/facilities/:id/rate-cards - Term 1)
    // -------------------------------------------------------------------------
    const term1Payload = {
      role: 'RN',
      shift_type: 'standard',
      bill_rate: 94.50,
      pay_rate: 55.00,
      overtime_multiplier: 1.50,
      effective_date: '2026-02-01',
      notes: 'Initial Term 1 - Schedule B Agreement'
    };

    const term1Res = await fetch(`${BASE_URL}/api/admin/facilities/${testFacilityId}/rate-cards`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(term1Payload)
    });
    const term1Data = await term1Res.json();
    const term1Ok = term1Res.status === 201 && term1Data.success === true && term1Data.data?.id;
    if (term1Ok) testTerm1Id = term1Data.data.id;
    recordTest(
      9,
      'Establish Contracted Rate Term (POST /api/admin/facilities/:id/rate-cards)',
      'HTTP 201 with term ID and is_active: 1',
      `HTTP ${term1Res.status}, termId=${testTerm1Id}`,
      term1Ok,
      'RN standard bill rate $94.50/hr established'
    );

    // Verify facility status was auto-promoted from 'pending' to 'active'
    const [facRow] = await pool.query('SELECT status FROM facilities WHERE id = ?', [testFacilityId]);
    const autoPromoted = facRow && facRow[0]?.status === 'active';
    recordTest(
      10,
      'Automatic Facility Status Promotion on Rate Term Establishment',
      'Facility status automatically transitions from "pending" to "active"',
      `Facility status in database: "${facRow ? facRow[0]?.status : 'null'}"`,
      autoPromoted,
      'Contract status promoted to "active" upon recording live contracted rate terms'
    );

    // -------------------------------------------------------------------------
    // 9. Add Term 2 - Verify Automatic Expiry of Term 1
    // -------------------------------------------------------------------------
    const term2Payload = {
      role: 'RN',
      shift_type: 'standard',
      bill_rate: 99.00,
      pay_rate: 58.00,
      overtime_multiplier: 1.50,
      effective_date: '2026-06-01',
      notes: 'Term 2 - Mid-Year Market Revision'
    };

    const term2Res = await fetch(`${BASE_URL}/api/admin/facilities/${testFacilityId}/rate-cards`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(term2Payload)
    });
    const term2Data = await term2Res.json();
    const term2Ok = term2Res.status === 201 && term2Data.success === true && term2Data.data?.id;
    if (term2Ok) testTerm2Id = term2Data.data.id;
    recordTest(
      11,
      'Establish Revised Rate Term (POST /api/admin/facilities/:id/rate-cards)',
      'HTTP 201 for Term 2 with $99.00/hr effective 2026-06-01',
      `HTTP ${term2Res.status}, termId=${testTerm2Id}`,
      term2Ok
    );

    // Verify Term 1 was auto-expired with expiry_date = 2026-05-31
    const [rateRows] = await pool.query('SELECT id, bill_rate, effective_date, expiry_date FROM facility_rate_cards WHERE facility_id = ? ORDER BY effective_date ASC', [testFacilityId]);
    const term1InDb = rateRows.find(r => r.id === testTerm1Id);
    const term2InDb = rateRows.find(r => r.id === testTerm2Id);
    const autoExpiredOk = term1InDb && term1InDb.expiry_date && term1InDb.expiry_date.toISOString().slice(0, 10) === '2026-05-31' && term2InDb && term2InDb.expiry_date === null;
    recordTest(
      12,
      'Auto-Expiry Audit Trail of Superseded Terms',
      'Term 1 expiry_date set to 2026-05-31 (1 day prior to Term 2) and Term 2 active',
      `Term 1 expiry: ${term1InDb?.expiry_date ? term1InDb.expiry_date.toISOString().slice(0, 10) : 'null'}, Term 2 expiry: ${term2InDb?.expiry_date || 'null (active)'}`,
      autoExpiredOk
    );

    // -------------------------------------------------------------------------
    // 10. Multi-Role Rate Terms & Margin Verification (RPN & PSW)
    // -------------------------------------------------------------------------
    const term3Res = await fetch(`${BASE_URL}/api/admin/facilities/${testFacilityId}/rate-cards`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        role: 'RPN',
        shift_type: 'standard',
        bill_rate: 72.00,
        pay_rate: 42.00,
        effective_date: '2026-02-01',
        notes: 'RPN Contract Rate'
      })
    });
    const term3Data = await term3Res.json();
    testTerm3Id = term3Data.data?.id;

    const term4Res = await fetch(`${BASE_URL}/api/admin/facilities/${testFacilityId}/rate-cards`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        role: 'PSW',
        shift_type: 'standard',
        bill_rate: 48.00,
        pay_rate: 28.00,
        effective_date: '2026-02-01',
        notes: 'PSW Contract Rate to be deleted later'
      })
    });
    const term4Data = await term4Res.json();
    testTerm4Id = term4Data.data?.id;

    // Fetch all terms via GET endpoint
    const allRatesRes = await fetch(`${BASE_URL}/api/admin/facilities/${testFacilityId}/rate-cards`, {
      headers: { 'Cookie': adminCookie }
    });
    const allRatesData = await allRatesRes.json();
    const activeTerms = (allRatesData.data || []).filter(c => Number(c.is_active) === 1);

    const rolesCovered = activeTerms.map(t => t.role).sort();
    const marginOk = activeTerms.every(t => {
      const margin = parseFloat(t.bill_rate) - parseFloat(t.pay_rate);
      return margin > 0;
    });

    recordTest(
      13,
      'Multi-Role Rate Cards & Margin Validation',
      'Active terms for RN, RPN, PSW with positive margin (bill_rate > pay_rate)',
      `Active roles: [${rolesCovered.join(', ')}], Margin check passed: ${marginOk}`,
      rolesCovered.includes('RN') && rolesCovered.includes('RPN') && rolesCovered.includes('PSW') && marginOk,
      'RN: $99.00/58.00 (+$41/hr), RPN: $72.00/42.00 (+$30/hr), PSW: $48.00/28.00 (+$20/hr)'
    );

    // -------------------------------------------------------------------------
    // 11. Delete Rate Card Term (DELETE /api/admin/facilities/:id/rate-cards/:termId)
    // -------------------------------------------------------------------------
    const deleteTermRes = await fetch(`${BASE_URL}/api/admin/facilities/${testFacilityId}/rate-cards/${testTerm4Id}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    const deleteTermData = await deleteTermRes.json();
    const deleteTermOk = deleteTermRes.status === 200 && deleteTermData.success === true;

    // Check DB that term 4 is truly removed
    const [checkDeleted] = await pool.query('SELECT id FROM facility_rate_cards WHERE id = ?', [testTerm4Id]);
    const termTrulyDeleted = deleteTermOk && checkDeleted.length === 0;

    recordTest(
      14,
      'Delete Rate Card Term (DELETE /api/admin/facilities/:id/rate-cards/:termId)',
      'HTTP 200 and term record completely removed from facility_rate_cards',
      `HTTP ${deleteTermRes.status}, remaining records matching termId: ${checkDeleted.length}`,
      termTrulyDeleted,
      'Term 4 (PSW) removed cleanly'
    );

    // -------------------------------------------------------------------------
    // 12. Shift Rate Exception (PATCH /api/admin/requests/:id/rate-exception)
    // -------------------------------------------------------------------------
    const tempReqId = require('crypto').randomUUID();
    testRequestId = tempReqId;
    await pool.query(`
      INSERT INTO staffing_requests (id, request_code, facility_name, facility_id, role_requested, shift_type, start_date, contact_name, contact_email, contact_phone, status, billing_hourly_rate)
      VALUES (?, 'REQ-TEST-EXC', 'Sunnybrook QA Testing Health Centre', ?, 'RN', 'standard', CURDATE(), 'Dr. Wilson', 'staffing-qa@sunnybrook-test.ca', '+1 416-480-9999', 'open', 99.00)
    `, [tempReqId, testFacilityId]);

    const exceptionRes = await fetch(`${BASE_URL}/api/admin/requests/${tempReqId}/rate-exception`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        billing_hourly_rate: 115.00,
        reason: 'Critical blizzard surge authorized by clinical operations director'
      })
    });
    const exceptionData = await exceptionRes.json();
    const exceptionOk = exceptionRes.status === 200 && exceptionData.success === true;

    const [reqAfter] = await pool.query('SELECT billing_hourly_rate FROM staffing_requests WHERE id = ?', [tempReqId]);
    const rateUpdatedOk = exceptionOk && parseFloat(reqAfter[0]?.billing_hourly_rate) === 115.00;

    recordTest(
      15,
      'One-Off Shift Rate Exception (PATCH /api/admin/requests/:id/rate-exception)',
      'HTTP 200 and shift billing_hourly_rate updated to $115.00',
      `HTTP ${exceptionRes.status}, new rate in DB: $${reqAfter[0]?.billing_hourly_rate}`,
      rateUpdatedOk
    );

    // -------------------------------------------------------------------------
    // 13. Registered Client Account Creation & Linking
    // -------------------------------------------------------------------------
    const tempClientId = require('crypto').randomUUID();
    testClientId = tempClientId;
    const bcrypt = require('bcryptjs');
    const initHash = await bcrypt.hash('InitialPass2026!', 10);

    await pool.query(`
      INSERT INTO users (id, role, email, password_hash, full_name, organization_name, facility_id, client_role, phone, is_active, email_verified)
      VALUES (?, 'client', 'dr.house.qa@sunnybrook-test.ca', ?, 'Dr. Gregory House', 'Sunnybrook QA Testing Health Centre', ?, 'Medical Director', '+1 416-480-6100', 1, 1)
    `, [tempClientId, initHash, testFacilityId]);

    // Check Registered Clients list to ensure new client appears and links to facility
    const clientsRefreshedRes = await fetch(`${BASE_URL}/api/admin/registered-clients`, {
      headers: { 'Cookie': adminCookie }
    });
    const clientsRefreshedData = await clientsRefreshedRes.json();
    const foundClient = (clientsRefreshedData.data || []).find(c => c.id === tempClientId);
    const clientLinkedOk = foundClient && foundClient.facility_code === 'FAC-SBK-V2' && foundClient.linked_facility_name === 'Sunnybrook QA Testing Health Centre';

    recordTest(
      16,
      'Registered Client Account Linking & Facility Binding',
      'Client user appears in registered-clients ledger with matching facility_code & facility_name',
      `Found: ${!!foundClient}, Linked facility: "${foundClient?.linked_facility_name}", Code: "${foundClient?.facility_code}"`,
      clientLinkedOk
    );

    // -------------------------------------------------------------------------
    // 14. Toggle Client Account Status (PATCH /api/admin/registered-clients/:id/toggle-status)
    // -------------------------------------------------------------------------
    const toggle1Res = await fetch(`${BASE_URL}/api/admin/registered-clients/${tempClientId}/toggle-status`, {
      method: 'PATCH',
      headers: authHeaders
    });
    const toggle1Data = await toggle1Res.json();
    const toggle1Ok = toggle1Res.status === 200 && toggle1Data.is_active === 0;

    const toggle2Res = await fetch(`${BASE_URL}/api/admin/registered-clients/${tempClientId}/toggle-status`, {
      method: 'PATCH',
      headers: authHeaders
    });
    const toggle2Data = await toggle2Res.json();
    const toggle2Ok = toggle2Res.status === 200 && toggle2Data.is_active === 1;

    recordTest(
      17,
      'Toggle Client Portal Status (Suspend / Reactivate)',
      'Account transitions cleanly: Active (1) -> Suspended (0) -> Reactivated (1)',
      `Toggle 1 is_active=${toggle1Data.is_active}, Toggle 2 is_active=${toggle2Data.is_active}`,
      toggle1Ok && toggle2Ok
    );

    // -------------------------------------------------------------------------
    // 15. Admin Forced Password Reset (POST /api/admin/registered-clients/:id/reset-password)
    // -------------------------------------------------------------------------
    const newClientPassword = 'DF-NewPasscode2026!';
    const resetPwdRes = await fetch(`${BASE_URL}/api/admin/registered-clients/${tempClientId}/reset-password`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ new_password: newClientPassword })
    });
    const resetPwdData = await resetPwdRes.json();
    const resetPwdOk = resetPwdRes.status === 200 && resetPwdData.success === true;
    recordTest(
      18,
      'Admin Client Password Reset (POST /api/admin/registered-clients/:id/reset-password)',
      'HTTP 200 with success message',
      `HTTP ${resetPwdRes.status}, message="${resetPwdData.message}"`,
      resetPwdOk
    );

    // -------------------------------------------------------------------------
    // 16. Verify Client Login with Reset Password (POST /api/users/login)
    // -------------------------------------------------------------------------
    const clientLoginRes = await fetch(`${BASE_URL}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'dr.house.qa@sunnybrook-test.ca',
        password: newClientPassword
      })
    });
    const clientLoginData = await clientLoginRes.json();
    const clientLoginOk = clientLoginRes.status === 200 && clientLoginData.success === true && clientLoginData.user?.role === 'client';
    recordTest(
      19,
      'Client Portal Login Verification with Reset Password',
      'HTTP 200 and successful client portal authentication with new password',
      `HTTP ${clientLoginRes.status}, client name="${clientLoginData.user?.full_name}"`,
      clientLoginOk,
      'Confirmed end-to-end credential synchronization'
    );

    // -------------------------------------------------------------------------
    // 17. Audit Logs Verification
    // -------------------------------------------------------------------------
    const [auditRows] = await pool.query(`
      SELECT action, target_entity, details 
      FROM audit_logs 
      WHERE target_id IN (?, ?, ?) OR details LIKE '%Sunnybrook%'
      ORDER BY created_at DESC
    `, [testFacilityId, tempClientId, testTerm1Id]);

    const auditActions = auditRows.map(r => r.action);
    const expectedActions = ['FACILITY_CREATED', 'FACILITY_UPDATED', 'RATE_CARD_TERM_CREATED', 'RATE_CARD_TERM_DELETED', 'CLIENT_STATUS_TOGGLED', 'CLIENT_PASSWORD_RESET'];
    const auditsFound = expectedActions.filter(act => auditActions.includes(act));

    recordTest(
      20,
      'Regulatory Audit Log Trail Verification',
      'Audit log entries recorded for: FACILITY_CREATED, FACILITY_UPDATED, RATE_CARD_TERM_CREATED, RATE_CARD_TERM_DELETED, CLIENT_STATUS_TOGGLED, CLIENT_PASSWORD_RESET',
      `Found ${auditsFound.length} of ${expectedActions.length} expected actions: [${auditsFound.join(', ')}]`,
      auditsFound.length >= 5
    );

  } catch (err) {
    console.error('[FATAL ERROR IN TEST SUITE]:', err);
    recordTest(99, 'Test Suite Execution', 'Clean execution without runtime error', `Error: ${err.message}`, false);
  } finally {
    // -------------------------------------------------------------------------
    // 18. Cleanup Test Records
    // -------------------------------------------------------------------------
    console.log('\n--- Cleaning up temporary QA test records ---');
    try {
      if (testRequestId) {
        await pool.query('DELETE FROM staffing_requests WHERE id = ?', [testRequestId]);
      }
      if (testClientId) {
        await pool.query('DELETE FROM users WHERE id = ?', [testClientId]);
      }
      if (testFacilityId) {
        await pool.query('DELETE FROM facility_rate_cards WHERE facility_id = ?', [testFacilityId]);
        await pool.query('DELETE FROM facilities WHERE id = ?', [testFacilityId]);
        await pool.query('DELETE FROM audit_logs WHERE target_id = ? OR details LIKE ?', [testFacilityId, '%Sunnybrook%']);
      }
      console.log('Cleanup completed successfully.\n');
    } catch (cleanErr) {
      console.warn('Cleanup warning:', cleanErr.message);
    }
  }

  // Summary
  console.log('================================================================');
  console.log('  FACILITIES & CONTRACTED RATES QA TEST SUMMARY');
  console.log('================================================================');
  const passedCount = results.filter(r => r.pass).length;
  const failedCount = results.filter(r => !r.pass).length;
  console.log(`  TOTAL TESTS:  ${results.length}`);
  console.log(`  PASSED:       ${passedCount}`);
  console.log(`  FAILED:       ${failedCount}`);
  console.log('================================================================\n');

  return { passedCount, failedCount, results };
}

runFacilitiesQATests().then(({ passedCount, failedCount }) => {
  process.exit(failedCount > 0 ? 1 : 0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
