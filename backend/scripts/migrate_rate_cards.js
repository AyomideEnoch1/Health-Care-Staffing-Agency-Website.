/**
 * Database Migration: Admin-Managed MSA Facility Rate Cards
 * Divine Fingers Healthcare Services Inc.
 */
const pool = require('../db');
const crypto = require('crypto');

async function migrate() {
  console.log('🚀 Starting Facilities & Rate Cards Migration...');
  const conn = await pool.getConnection();

  try {
    // 1. Create facilities table
    console.log('Creating `facilities` table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`facilities\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`facility_code\` VARCHAR(20) NOT NULL,
        \`address\` VARCHAR(255) NULL,
        \`region\` VARCHAR(80) NULL DEFAULT 'Greater Toronto Area',
        \`contact_name\` VARCHAR(100) NULL,
        \`contact_email\` VARCHAR(191) NULL,
        \`contact_phone\` VARCHAR(30) NULL,
        \`msa_signed_date\` DATE NULL,
        \`msa_expiry_date\` DATE NULL,
        \`msa_document_url\` TEXT NULL,
        \`status\` ENUM('active', 'pending', 'expired') NOT NULL DEFAULT 'pending',
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`idx_facility_code\` (\`facility_code\`),
        INDEX \`idx_facility_name\` (\`name\`),
        INDEX \`idx_facility_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Create facility_rate_cards table
    console.log('Creating `facility_rate_cards` table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`facility_rate_cards\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`facility_id\` VARCHAR(36) NOT NULL,
        \`role\` ENUM('RN', 'RPN', 'PSW', 'Companion', 'Travel Nurse', 'Multiple') NOT NULL,
        \`shift_type\` VARCHAR(60) NOT NULL DEFAULT 'standard',
        \`bill_rate\` DECIMAL(6,2) NOT NULL,
        \`pay_rate\` DECIMAL(6,2) NULL,
        \`overtime_multiplier\` DECIMAL(3,2) NOT NULL DEFAULT 1.50,
        \`effective_date\` DATE NOT NULL,
        \`expiry_date\` DATE NULL,
        \`notes\` TEXT NULL,
        \`created_by\` VARCHAR(64) NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_rate_cards_lookup\` (\`facility_id\`, \`role\`, \`shift_type\`, \`effective_date\`),
        INDEX \`idx_rate_cards_facility\` (\`facility_id\`),
        CONSTRAINT \`fk_rate_cards_facility\`
          FOREIGN KEY (\`facility_id\`) REFERENCES \`facilities\` (\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Add facility_id to staffing_requests if not present
    console.log('Updating `staffing_requests` schema...');
    try {
      const [colCheck] = await conn.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'staffing_requests' 
          AND COLUMN_NAME = 'facility_id'
      `);
      if (colCheck.length === 0) {
        await conn.query(`ALTER TABLE staffing_requests ADD COLUMN facility_id VARCHAR(36) NULL AFTER facility_name`);
        await conn.query(`ALTER TABLE staffing_requests ADD INDEX idx_requests_facility_id (facility_id)`);
        console.log('✅ Added facility_id to staffing_requests');
      }
    } catch (colErr) {
      console.warn('Notice checking facility_id column:', colErr.message);
    }

    // 4. Seed initial facilities from existing distinct facility names if any
    console.log('Scanning existing facility names to seed facilities...');
    const knownFacilities = [
      { name: 'Scarborough Health Network', code: 'FAC-SHN-01', address: '3050 Lawrence Ave E, Scarborough, ON', region: 'Scarborough / GTA', status: 'active', signed: '2026-01-15', expiry: '2027-01-14' },
      { name: 'Downrise Hospital', code: 'FAC-DNR-02', address: '120 Finch Ave W, North York, ON', region: 'North York / GTA', status: 'active', signed: '2026-02-01', expiry: '2027-01-31' },
      { name: 'Trillium Health Partners', code: 'FAC-THP-03', address: '100 Queensway W, Mississauga, ON', region: 'Mississauga / Peel', status: 'pending', signed: null, expiry: null }
    ];

    for (const kf of knownFacilities) {
      const [check] = await conn.query('SELECT id FROM facilities WHERE name = ? OR facility_code = ?', [kf.name, kf.code]);
      let facId;
      if (check.length === 0) {
        facId = crypto.randomUUID();
        await conn.query(`
          INSERT INTO facilities (id, name, facility_code, address, region, status, msa_signed_date, msa_expiry_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [facId, kf.name, kf.code, kf.address, kf.region, kf.status, kf.signed, kf.expiry]);

        console.log(`✅ Seeded facility: ${kf.name} (${kf.code})`);

        // If active, seed initial contracted rate cards for this facility
        if (kf.status === 'active') {
          const rates = [
            { role: 'RN', bill_rate: 92.00, pay_rate: 52.00 },
            { role: 'RPN', bill_rate: 70.00, pay_rate: 42.00 },
            { role: 'PSW', bill_rate: 48.00, pay_rate: 30.00 },
            { role: 'Companion', bill_rate: 40.00, pay_rate: 26.00 },
            { role: 'Travel Nurse', bill_rate: 115.00, pay_rate: 75.00 }
          ];

          for (const r of rates) {
            await conn.query(`
              INSERT INTO facility_rate_cards (id, facility_id, role, shift_type, bill_rate, pay_rate, overtime_multiplier, effective_date, expiry_date, created_by)
              VALUES (?, ?, ?, 'standard', ?, ?, 1.50, '2026-01-01', NULL, 'system_migration')
            `, [crypto.randomUUID(), facId, r.role, r.bill_rate, r.pay_rate]);
          }
          console.log(`   ➜ Seeded contracted rate cards for ${kf.name}`);
        }
      } else {
        facId = check[0].id;
      }
    }

    // Link any staffing requests to existing facilities by name
    await conn.query(`
      UPDATE staffing_requests sr
      JOIN facilities f ON LOWER(TRIM(sr.facility_name)) = LOWER(TRIM(f.name))
      SET sr.facility_id = f.id
      WHERE sr.facility_id IS NULL
    `);

    console.log('🎉 Facilities & Rate Cards Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate().catch(() => process.exit(1));
