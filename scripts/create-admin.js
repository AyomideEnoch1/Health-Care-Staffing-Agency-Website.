'use strict';

/**
 * Super Admin Provisioning Script
 * Divine Fingers Healthcare Services Inc.
 * 
 * Safely provisions a super-admin account via CLI interactive prompts.
 * Prompts for email, full name, and password (masked).
 * Hashes password using bcryptjs with 12 salt rounds.
 * Sets totp_secret to NULL.
 */

require('dotenv').config();
const readline = require('readline');
const { Writable } = require('stream');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');

// Resolve database pool
let pool;
try {
  pool = require('../backend/db');
} catch {
  pool = require('./backend/db');
}

const ALL_PERMISSIONS = [
  'requests:view',
  'requests:dispatch',
  'roster:view',
  'roster:manage',
  'applications:view',
  'applications:manage',
  'facilities:view',
  'facilities:manage',
  'inquiries:manage',
  'reports:view',
  'reports:export',
  'newsletter:manage',
  'audit:view',
  'admins:manage',
  'settings:view',
  'settings:edit'
];

function promptInput(promptText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptPassword(promptText) {
  let muted = false;
  const mutableStdout = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) {
        process.stdout.write(chunk, encoding);
      }
      callback();
    }
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: mutableStdout,
    terminal: true
  });

  return new Promise((resolve) => {
    process.stdout.write(promptText);
    muted = true;
    rl.question('', (answer) => {
      muted = false;
      process.stdout.write('\n');
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('\n======================================================');
  console.log(' Divine Fingers Healthcare - Provision Super-Admin');
  console.log('======================================================\n');

  try {
    const email = await promptInput('Enter Admin Email: ');
    if (!email || !email.includes('@') || !email.includes('.')) {
      console.error('❌ Error: A valid email address is required.');
      process.exit(1);
    }

    const fullName = await promptInput('Enter Admin Full Name: ');
    if (!fullName || fullName.length < 2) {
      console.error('❌ Error: Full name must be at least 2 characters.');
      process.exit(1);
    }

    const password = await promptPassword('Enter Admin Password (hidden): ');
    if (!password || password.length < 8) {
      console.error('❌ Error: Password must be at least 8 characters long.');
      process.exit(1);
    }

    const confirmPassword = await promptPassword('Confirm Admin Password (hidden): ');
    if (password !== confirmPassword) {
      console.error('❌ Error: Passwords do not match.');
      process.exit(1);
    }

    console.log('\n🔒 Hashing password with bcryptjs (12 rounds)...');
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const adminId = crypto.randomUUID();
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = fullName.trim();
    const permissionsJson = JSON.stringify(ALL_PERMISSIONS);

    console.log(`💾 Inserting super-admin into database (${cleanEmail})...`);

    const query = `
      INSERT INTO admins (
        id, email, password_hash, full_name, role, permissions,
        totp_secret, totp_enabled, is_active, email_verified,
        failed_login_attempts, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'super-admin', ?, NULL, 0, 1, 1, 0, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        full_name = VALUES(full_name),
        role = 'super-admin',
        permissions = VALUES(permissions),
        totp_secret = NULL,
        totp_enabled = 0,
        is_active = 1,
        email_verified = 1,
        failed_login_attempts = 0,
        updated_at = NOW();
    `;

    await pool.query(query, [
      adminId,
      cleanEmail,
      passwordHash,
      cleanName,
      permissionsJson
    ]);

    console.log('\n✅ Super-admin provisioned successfully!');
    console.log(`👤 ID:          ${adminId}`);
    console.log(`📧 Email:       ${cleanEmail}`);
    console.log(`🏷️  Role:        super-admin`);
    console.log(`🔑 Permissions: ${ALL_PERMISSIONS.length} permissions granted`);
    console.log(`🛡️  2FA Secret:  NULL (Not enrolled)\n`);

  } catch (err) {
    console.error(`\n❌ Failed to provision admin: ${err.message}`);
    process.exit(1);
  } finally {
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
