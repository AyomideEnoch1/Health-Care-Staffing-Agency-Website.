const pool = require('../db');

async function migrateShiftTracking() {
  try {
    console.log('🔄 Running Shift Tracking DB migration...');

    // 1. Modify status ENUM to include 'in_session' and 'confirmed'
    await pool.query(`
      ALTER TABLE staffing_requests 
      MODIFY COLUMN status ENUM('pending', 'dispatched', 'confirmed', 'in_session', 'completed', 'cancelled') NOT NULL DEFAULT 'pending'
    `).catch(err => {
      console.log('Note on ENUM modify:', err.message);
    });

    // 2. Add clock_in_time, clock_out_time, clock_token if not exist
    const [cols] = await pool.query(`SHOW COLUMNS FROM staffing_requests`);
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('clock_in_time')) {
      await pool.query(`ALTER TABLE staffing_requests ADD COLUMN clock_in_time TIMESTAMP NULL AFTER special_instructions`);
      console.log('✅ Added clock_in_time column to staffing_requests.');
    }

    if (!colNames.includes('clock_out_time')) {
      await pool.query(`ALTER TABLE staffing_requests ADD COLUMN clock_out_time TIMESTAMP NULL AFTER clock_in_time`);
      console.log('✅ Added clock_out_time column to staffing_requests.');
    }

    if (!colNames.includes('clock_token')) {
      await pool.query(`ALTER TABLE staffing_requests ADD COLUMN clock_token VARCHAR(64) NULL AFTER clock_out_time`);
      console.log('✅ Added clock_token column to staffing_requests.');
    }

    console.log('🎉 Shift Tracking DB migration complete!');
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

if (require.main === module) {
  migrateShiftTracking().then(() => process.exit(0));
}

module.exports = migrateShiftTracking;
