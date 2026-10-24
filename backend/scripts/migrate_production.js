/**
 * Production Migration Script — Divine Fingers Healthcare
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.vercel.prod' });
if (!process.env.DB_HOST || process.env.DB_HOST === '') require('dotenv').config({ override: true });

const cfg = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'divine_fingers_dev',
  ssl: (process.env.DB_HOST && process.env.DB_HOST !== '127.0.0.1') ? { rejectUnauthorized: false } : undefined
};

async function runMigration() {
  let pool, conn;
  try {
    console.log('Connecting to ' + cfg.host + ':' + cfg.port + '/' + cfg.database + ' ...');
    pool = await mysql.createPool(cfg);
    conn = await pool.getConnection();
    const [dbInfo] = await conn.query('SELECT @@hostname AS h, database() AS db');
    console.log('Connected:', dbInfo[0].h + '/' + dbInfo[0].db + '\n');

    async function alter(label, sql) {
      try { await conn.query(sql); console.log('  OK ' + label); }
      catch (e) {
        if (e.message.includes('Duplicate column') || e.message.includes('already exists') || e.code === 'ER_DUP_FIELDNAME') { console.log('  SKIP ' + label + ' (already applied)'); }
        else { console.log('  ERR ' + label + ' -- ' + e.message); }
      }
    }

    console.log('1. users.id -> VARCHAR(64)');
    await alter('users.id', 'ALTER TABLE users MODIFY COLUMN id VARCHAR(64) NOT NULL');

    console.log('2. staff_roster FK + id width');
    try { const [fks] = await conn.query("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='staffing_requests' AND CONSTRAINT_TYPE='FOREIGN KEY' AND CONSTRAINT_NAME='fk_requests_assigned_staff'"); if(fks.length>0) await conn.query('ALTER TABLE staffing_requests DROP FOREIGN KEY fk_requests_assigned_staff'); } catch(e){}
    await alter('staff_roster.id', 'ALTER TABLE staff_roster MODIFY COLUMN id VARCHAR(64) NOT NULL');
    await alter('staffing_requests.assigned_staff_id', 'ALTER TABLE staffing_requests MODIFY COLUMN assigned_staff_id VARCHAR(64) NULL DEFAULT NULL');
    await alter('FK restored', "ALTER TABLE staffing_requests ADD CONSTRAINT fk_requests_assigned_staff FOREIGN KEY (assigned_staff_id) REFERENCES staff_roster (id) ON DELETE SET NULL ON UPDATE CASCADE");

    console.log('3. staffing_requests.status ENUM');
    await alter('status ENUM', "ALTER TABLE staffing_requests MODIFY COLUMN status ENUM('pending','confirmed','dispatched','in_session','completed','cancelled') NOT NULL DEFAULT 'pending'");

    console.log('4. staffing_requests clock columns');
    await alter('clock_in_time', 'ALTER TABLE staffing_requests ADD COLUMN clock_in_time DATETIME NULL DEFAULT NULL');
    await alter('clock_out_time', 'ALTER TABLE staffing_requests ADD COLUMN clock_out_time DATETIME NULL DEFAULT NULL');

    console.log('5. staff_roster.credential_status ENUM');
    await alter('credential_status', "ALTER TABLE staff_roster MODIFY COLUMN credential_status ENUM('verified','expiring','expired','pending') NOT NULL DEFAULT 'pending'");

    console.log('6. staff_roster NOT NULL column defaults');
    await alter('hourly_rate', 'ALTER TABLE staff_roster MODIFY COLUMN hourly_rate DECIMAL(6,2) NOT NULL DEFAULT 0.00');
    await alter('cpr_expiry_date', "ALTER TABLE staff_roster MODIFY COLUMN cpr_expiry_date DATE NOT NULL DEFAULT '2027-12-31'");
    await alter('region', "ALTER TABLE staff_roster MODIFY COLUMN region VARCHAR(80) NOT NULL DEFAULT 'Greater Toronto Area'");
    await alter('specialty', "ALTER TABLE staff_roster MODIFY COLUMN specialty VARCHAR(120) NOT NULL DEFAULT 'General Care'");
    await alter('phone nullable', 'ALTER TABLE staff_roster MODIFY COLUMN phone VARCHAR(30) NULL DEFAULT NULL');

    console.log('7. CREATE shift_punches');
    await alter('shift_punches', "CREATE TABLE IF NOT EXISTS shift_punches (id VARCHAR(36) NOT NULL, staff_id VARCHAR(64) NOT NULL, staff_name VARCHAR(120) NOT NULL DEFAULT 'Staff Member', staff_email VARCHAR(191) NOT NULL DEFAULT '', shift_id VARCHAR(36) NULL DEFAULT NULL, facility_name VARCHAR(150) NOT NULL DEFAULT 'Unknown Facility', unit_department VARCHAR(100) NOT NULL DEFAULT 'General Floor', role VARCHAR(60) NOT NULL DEFAULT 'RN', clock_in_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, clock_out_time DATETIME NULL DEFAULT NULL, total_hours DECIMAL(5,2) NOT NULL DEFAULT 0.00, notes TEXT NULL DEFAULT NULL, status ENUM('active','completed','cancelled') NOT NULL DEFAULT 'active', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id), INDEX idx_punches_staff (staff_id), INDEX idx_punches_status (status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    console.log('8. CREATE staff_documents');
    await alter('staff_documents', "CREATE TABLE IF NOT EXISTS staff_documents (id VARCHAR(36) NOT NULL, staff_id VARCHAR(64) NOT NULL, doc_type ENUM('cpr','n95','vss','license','other') NOT NULL DEFAULT 'other', title VARCHAR(200) NOT NULL, file_path VARCHAR(500) NOT NULL, file_name VARCHAR(255) NOT NULL, file_size INT UNSIGNED NOT NULL DEFAULT 0, mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf', expiry_date DATE NULL DEFAULT NULL, uploaded_by VARCHAR(100) NOT NULL DEFAULT 'Staff', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id), INDEX idx_docs_staff (staff_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    console.log('9. CREATE newsletter_subscribers');
    await alter('newsletter_subscribers', "CREATE TABLE IF NOT EXISTS newsletter_subscribers (id VARCHAR(36) NOT NULL, email VARCHAR(191) NOT NULL, status ENUM('active','unsubscribed') NOT NULL DEFAULT 'active', source VARCHAR(50) NOT NULL DEFAULT 'homepage_strip', ip_address VARCHAR(45) NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id), UNIQUE KEY idx_newsletter_email (email)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    console.log('\n-- Verification --');
    const [uId] = await conn.query("SHOW COLUMNS FROM users WHERE Field='id'"); console.log('users.id:', uId[0]?.Type);
    const [rqSt] = await conn.query("SHOW COLUMNS FROM staffing_requests WHERE Field='status'"); console.log('staffing_requests.status:', rqSt[0]?.Type);
    const [punch] = await conn.query("SHOW TABLES LIKE 'shift_punches'"); console.log('shift_punches:', punch.length>0 ? 'EXISTS' : 'MISSING');
    const [docs] = await conn.query("SHOW TABLES LIKE 'staff_documents'"); console.log('staff_documents:', docs.length>0 ? 'EXISTS' : 'MISSING');
    const [nl] = await conn.query("SHOW TABLES LIKE 'newsletter_subscribers'"); console.log('newsletter_subscribers:', nl.length>0 ? 'EXISTS' : 'MISSING');
    conn.release(); await pool.end();
    console.log('\nMIGRATION COMPLETE'); process.exit(0);
  } catch (err) { console.error('FAILED:', err.message); if(conn) conn.release(); if(pool) await pool.end(); process.exit(1); }
}
runMigration();
