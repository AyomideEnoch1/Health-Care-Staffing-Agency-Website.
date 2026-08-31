/**
 * Local Admin & Staff Seed Script
 * Generates initial super-admin and staff roster data for development and testing.
 */
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../db');

async function seed() {
  console.log('🌱 Seeding database...');

  // 1. Create Super-Admin account
  const adminId = crypto.randomUUID();
  const passwordPlain = 'AdminSecure2026!';
  const passwordHash = await bcrypt.hash(passwordPlain, 12);

  await pool.query('DELETE FROM admins WHERE email = ?', ['admin@divinefingershealthcare.ca']);
  await pool.query(
    `INSERT INTO admins (id, email, password_hash, full_name, role, is_active)
     VALUES (?, ?, ?, ?, 'super-admin', 1)`,
    [adminId, 'admin@divinefingershealthcare.ca', passwordHash, 'Divine Fingers Administrator']
  );

  console.log(`✅ Super-Admin created:`);
  console.log(`   Email:    admin@divinefingershealthcare.ca`);
  console.log(`   Password: ${passwordPlain}`);

  // 2. Seed initial verified staff roster
  const staff = [
    { code: 'STF-101', name: 'Sarah Jenkins', role: 'RN', spec: 'ICU / Emergency Care', rate: 68.50, reg: 'Scarborough', phone: '+1 (416) 829-1044', email: 's.jenkins@divinefingershealthcare.ca' },
    { code: 'STF-102', name: 'Michael Adeyemi', role: 'RN', spec: 'Cardiology & Med-Surg', rate: 72.00, reg: 'North York', phone: '+1 (647) 554-3209', email: 'm.adeyemi@divinefingershealthcare.ca' },
    { code: 'STF-103', name: 'Elena Rostova', role: 'RPN', spec: 'Geriatric & LTC Care', rate: 48.00, reg: 'Mississauga', phone: '+1 (905) 431-8890', email: 'e.rostova@divinefingershealthcare.ca' },
    { code: 'STF-104', name: 'David Chen', role: 'PSW', spec: 'Dementia & Palliative', rate: 32.50, reg: 'Markham', phone: '+1 (416) 773-4412', email: 'd.chen@divinefingershealthcare.ca' },
    { code: 'STF-105', name: 'Amara Okafor', role: 'PSW', spec: 'Post-Op & Mobility Care', rate: 34.00, reg: 'Scarborough', phone: '+1 (647) 902-3341', email: 'a.okafor@divinefingershealthcare.ca' },
    { code: 'STF-106', name: 'Jonathan Miller', role: 'Companion', spec: 'Respite & Social Engagement', rate: 26.00, reg: 'Brampton', phone: '+1 (905) 881-2299', email: 'j.miller@divinefingershealthcare.ca' }
  ];

  for (const s of staff) {
    await pool.query('DELETE FROM staff_roster WHERE staff_code = ?', [s.code]);
    await pool.query(
      `INSERT INTO staff_roster 
        (id, staff_code, name, role, specialty, status, credential_status, rating, shifts_completed, region, phone, email, hourly_rate, cpr_expiry_date)
       VALUES (?, ?, ?, ?, ?, 'available', 'verified', 4.95, 120, ?, ?, ?, ?, '2027-06-01')`,
      [crypto.randomUUID(), s.code, s.name, s.role, s.spec, s.reg, s.phone, s.email, s.rate]
    );
  }
  console.log(`✅ Staff roster seeded (${staff.length} staff members).`);

  await pool.end();
  console.log('🎉 Seeding complete. You can now start the server with npm run dev.');
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
