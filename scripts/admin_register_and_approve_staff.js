/**
 * Admin Action: Add/Register Staff from Admin Dashboard & Approve Staff
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function main() {
  console.log('================================================================');
  console.log('  ADMIN DASHBOARD: ADD / REGISTER & APPROVE STAFF');
  console.log('  Target: ' + BASE_URL);
  console.log('================================================================\n');

  // 1. Admin Login
  console.log('Step 1: Authenticating as Super-Admin...');
  const loginRes = await fetch(BASE_URL + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@divinefingershealthcare.ca',
      password: 'AdminSecure2026!'
    })
  });

  const cookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')];
  const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
  const loginData = await loginRes.json();
  const csrfToken = loginData.csrfToken || (cookieHeader.match(/df_csrf_token=([^;]+)/) || [])[1] || '';

  if (!loginData.success) {
    console.error('❌ Admin login failed:', loginData);
    process.exit(1);
  }
  console.log('✅ Logged in as: ' + loginData.admin.full_name + ' (' + loginData.admin.role + ')');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Cookie': cookieHeader,
    'X-CSRF-Token': csrfToken
  };

  // 2. Add / Register Staff Member
  console.log('\nStep 2: Registering new healthcare staff via Admin Dashboard (+ Add Staff)...');
  const timestamp = Date.now();
  const staffPayload = {
    name: 'Nurse Hannah Adeyemi',
    role: 'RN',
    email: 'hannah.adeyemi.' + timestamp + '@divinefingershealthcare.ca',
    phone: '+1 416-555-7890',
    specialty: 'Critical Care & Emergency',
    region: 'Greater Toronto Area',
    cno_registration_num: 'CNO-RN-784921',
    hourly_rate: 48.50,
    cpr_expiry_date: '2027-11-30',
    status: 'pending_verification',
    initial_password: 'DivineFingers2026!'
  };

  const addRes = await fetch(BASE_URL + '/api/admin/roster', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(staffPayload)
  });

  const addData = await addRes.json();
  if (!addRes.ok || !addData.success) {
    console.error('❌ Failed to add staff:', addData);
    process.exit(1);
  }

  const staffId = addData.data.id;
  const staffCode = addData.data.staff_code;
  console.log('✅ Staff Member Registered: ' + addData.data.name);
  console.log('   • ID:         ' + staffId);
  console.log('   • Code:       ' + staffCode);
  console.log('   • Role:       ' + addData.data.role);
  console.log('   • Status:     ' + addData.data.status);
  console.log('   • Email:      ' + addData.data.email);

  // 3. Confirm Presence in Roster
  console.log('\nStep 3: Querying live Roster to verify staff member is listed...');
  const rosterRes = await fetch(BASE_URL + '/api/admin/roster', { headers: authHeaders });
  const rosterData = await rosterRes.json();
  const staffMember = (rosterData.data || []).find(s => s.id === staffId || s.email === staffPayload.email);

  if (!staffMember) {
    console.error('❌ Registered staff member NOT found in roster list!');
    process.exit(1);
  }
  console.log('✅ Found in live Roster: ' + staffMember.name + ' (' + staffMember.staff_code + ')');
  console.log('   • Current Status: ' + staffMember.status + ' | Credential Status: ' + staffMember.credential_status);

  // 4. Approve Staff Credentials & Activate Dispatch
  console.log('\nStep 4: Executing "Approve Credentials & Activate Dispatch"...');
  const approveRes = await fetch(BASE_URL + '/api/admin/roster/' + staffId + '/approve', {
    method: 'POST',
    headers: authHeaders
  });
  const approveData = await approveRes.json();

  if (!approveRes.ok || !approveData.success) {
    console.error('❌ Failed to approve staff member:', approveData);
    process.exit(1);
  }
  console.log('✅ Staff Approved Successfully!');
  console.log('   • Response Message: ' + approveData.message);

  // 5. Verify Updated Status in Roster
  console.log('\nStep 5: Verifying updated status in Roster...');
  const verifyRes = await fetch(BASE_URL + '/api/admin/roster', { headers: authHeaders });
  const verifyData = await verifyRes.json();
  const approvedStaff = (verifyData.data || []).find(s => s.id === staffId);

  console.log('✅ Verified Live Standing:');
  console.log('   • Status:            ' + approvedStaff?.status + ' (Expected: available)');
  console.log('   • Credential Status: ' + approvedStaff?.credential_status + ' (Expected: verified)');

  if (approvedStaff?.status !== 'available' || approvedStaff?.credential_status !== 'verified') {
    console.error('❌ Status mismatch! Expected status=available and credential_status=verified.');
    process.exit(1);
  }

  // 6. Test Staff Portal Sign In
  console.log('\nStep 6: Verifying that approved staff can sign into the Staff Portal (portal.html)...');
  const loginStaffRes = await fetch(BASE_URL + '/api/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: staffPayload.email,
      password: staffPayload.initial_password
    })
  });
  const staffPortalData = await loginStaffRes.json();

  if (!loginStaffRes.ok || !staffPortalData.success) {
    console.error('❌ Staff portal login failed:', staffPortalData);
    process.exit(1);
  }
  console.log('✅ Staff Member Authenticated Successfully to Portal:');
  console.log('   • User ID:           ' + staffPortalData.user?.id);
  console.log('   • Full Name:         ' + staffPortalData.user?.full_name);
  console.log('   • Role:              ' + staffPortalData.user?.role);
  console.log('   • Staff Status:      ' + staffPortalData.user?.staff_status);
  console.log('   • Credential Status: ' + staffPortalData.user?.credential_status);
  console.log('   • Redirect Target:   ' + staffPortalData.redirectTo);

  // 7. Verify Compliance Dossier
  console.log('\nStep 7: Verifying Client Compliance Dossier (/api/requests/staff/:id/compliance)...');
  const compRes = await fetch(BASE_URL + '/api/requests/staff/' + staffId + '/compliance', { headers: authHeaders });
  const compData = await compRes.json();
  if (!compRes.ok || !compData.success) {
    console.error('❌ Compliance dossier query failed:', compData);
    process.exit(1);
  }
  console.log('✅ Compliance Dossier Retrieved:');
  console.log('   • Staff Name:        ' + compData.data?.name);
  console.log('   • CNO Registration:  ' + compData.data?.cno_registration?.number + ' (' + compData.data?.cno_registration?.status + ')');
  console.log('   • VSS Clearance:     ' + compData.data?.vulnerable_sector_check?.status);
  console.log('   • CPR/BLS Status:    ' + compData.data?.cpr_bls_certification?.level);

  console.log('\n================================================================');
  console.log('  ALL CHECKS PASSED: STAFF SUCCESSFULLY ADDED & APPROVED!');
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Unhandled Error in script:', err);
  process.exit(1);
});
