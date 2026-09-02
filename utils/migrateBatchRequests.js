const path = require('path');
const mysql = require(path.join(__dirname, '../node_modules/mysql2/promise'));
require('dotenv').config();

async function migrateBatchRequests() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'divine_fingers_dev'
    });

    console.log('Connected to MySQL. Adding batch_code column to staffing_requests if not exists...');

    const [cols] = await conn.query(`SHOW COLUMNS FROM staffing_requests`);
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('batch_code')) {
      await conn.query(`ALTER TABLE staffing_requests ADD COLUMN batch_code VARCHAR(30) NULL AFTER request_code, ADD INDEX idx_requests_batch_code (batch_code)`);
      console.log('✅ Added batch_code column and index to staffing_requests.');
    } else {
      console.log('ℹ️ batch_code column already exists in staffing_requests.');
    }

    await conn.end();
  } catch (err) {
    console.error('Migration error in migrateBatchRequests:', err.message);
  }
}

if (require.main === module) {
  migrateBatchRequests().then(() => process.exit(0));
}

module.exports = migrateBatchRequests;
