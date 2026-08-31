/**
 * One-Time Production Super-Admin Bootstrap Script
 * Divine Fingers Healthcare Services Inc.
 *
 * Usage:
 *   node scripts/create-first-admin.js [email] [fullName] [password]
 *   OR set environment variables: BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_PASSWORD
 *
 * Security Guard:
 *   This script ONLY executes if the `admins` table is currently EMPTY (COUNT = 0).
 *   If any admin account already exists, it immediately aborts to prevent duplicate
 *   or unauthorized account creation.
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../db');

async function bootstrapFirstAdmin() {
  console.log('========================================================================');
  console.log('   DIVINE FINGERS HEALTHCARE — PRODUCTION SUPER-ADMIN BOOTSTRAP         ');
  console.log('========================================================================\n');

  try {
    // 1. Enforce Zero-State Precondition
    const [rows] = await pool.query('SELECT COUNT(*) AS admin_count FROM admins');
    const count = rows[0].admin_count;

    if (count > 0) {
      console.error(`❌ [BOOTSTRAP ABORTED] The admins table already contains ${count} account(s).`);
      console.error('   This bootstrap script is strictly restricted to zero-state database initialization.');
      console.error('   To manage administrators, log into the Admin Dashboard as a Super-Admin.\n');
      process.exit(1);
    }

    // 2. Resolve Credentials from CLI Arguments or Environment Variables
    const email = (process.argv[2] || process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@divinefingershealthcare.ca').toLowerCase().trim();
    const fullName = (process.argv[3] || process.env.BOOTSTRAP_ADMIN_NAME || 'Divine Fingers Administrator').trim();
    const password = process.argv[4] || process.env.BOOTSTRAP_ADMIN_PASSWORD || 'AdminSecure2026!';

    if (!email || !password || password.length < 8) {
      console.error('❌ [ERROR] Password must be at least 8 characters long.');
      process.exit(1);
    }

    console.log(`Creating initial Super-Admin account:`);
    console.log(` - Full Name: ${fullName}`);
    console.log(` - Email:     ${email}`);
    console.log(` - Role:      super-admin`);

    // 3. Hash Password (Bcrypt Cost 12)
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const adminId = crypto.randomUUID();

    // 4. Insert Single Super-Admin Row
    await pool.query(
      `INSERT INTO admins (id, email, password_hash, full_name, role, is_active, failed_login_attempts)
       VALUES (?, ?, ?, ?, 'super-admin', 1, 0)`,
      [adminId, email, passwordHash, fullName]
    );

    // 5. Insert Initial Audit Log Record
    await pool.query(
      `INSERT INTO audit_logs (id, admin_id, actor_name, action, target_entity, target_id, details, severity, ip_address)
       VALUES (?, ?, ?, 'SYSTEM_BOOTSTRAP', 'admins', ?, 'Initial Super-Admin account provisioned via secure server CLI bootstrap script', 'info', '127.0.0.1')`,
      [crypto.randomUUID(), adminId, fullName, adminId]
    );

    console.log('\n✅ [BOOTSTRAP SUCCESS] Initial Super-Admin account created successfully.');
    console.log('   Security Notice: Do not expose this script over HTTP or leave credentials in history.\n');
    process.exit(0);

  } catch (err) {
    console.error('❌ [FATAL BOOTSTRAP ERROR]:', err.message);
    process.exit(1);
  }
}

bootstrapFirstAdmin();
