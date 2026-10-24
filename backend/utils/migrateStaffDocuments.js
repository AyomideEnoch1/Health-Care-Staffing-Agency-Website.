const path = require('path');
const mysql = require(path.join(__dirname, '../node_modules/mysql2/promise'));
require('dotenv').config();

async function migrateStaffDocuments() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'divine_fingers_dev'
    });

    console.log('Connected to MySQL. Creating staff_documents table if not exists...');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`staff_documents\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`staff_id\` VARCHAR(36) NOT NULL,
        \`doc_type\` ENUM('cno_license', 'cpr_card', 'vss_check', 'n95_fit', 'immunization', 'other') NOT NULL DEFAULT 'other',
        \`title\` VARCHAR(150) NOT NULL,
        \`file_path\` VARCHAR(255) NOT NULL,
        \`file_name\` VARCHAR(255) NOT NULL,
        \`file_size\` INT UNSIGNED NOT NULL DEFAULT 0,
        \`mime_type\` VARCHAR(100) NOT NULL,
        \`expiry_date\` DATE NULL,
        \`uploaded_by\` VARCHAR(100) NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_staff_docs_staff_id\` (\`staff_id\`),
        INDEX \`idx_staff_docs_type\` (\`doc_type\`),
        CONSTRAINT \`fk_staff_docs_staff\`
          FOREIGN KEY (\`staff_id\`) REFERENCES \`staff_roster\` (\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ staff_documents table is created and ready in MySQL.');
    await conn.end();
  } catch (err) {
    console.error('Migration error in migrateStaffDocuments:', err.message);
  }
}

if (require.main === module) {
  migrateStaffDocuments().then(() => process.exit(0));
}

module.exports = migrateStaffDocuments;
