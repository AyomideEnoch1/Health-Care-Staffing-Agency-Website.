const db = require('../db');

async function migrate() {
  try {
    await db.query(`
      ALTER TABLE staff_roster 
      MODIFY COLUMN status ENUM('available', 'on-shift', 'off-duty', 'suspended', 'pending_verification', 'active') 
      NOT NULL DEFAULT 'available'
    `);
    console.log('✅ Altered staff_roster status ENUM successfully.');

    await db.query(`
      ALTER TABLE staff_roster 
      MODIFY COLUMN credential_status ENUM('verified', 'expiring', 'expired', 'pending') 
      NOT NULL DEFAULT 'pending'
    `);
    console.log('✅ Altered staff_roster credential_status ENUM successfully.');

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
