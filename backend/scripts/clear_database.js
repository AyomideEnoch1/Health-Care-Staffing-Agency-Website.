/**
 * Database Purge Script
 * Cleans out all operational, mock, and test data across all tables
 * Preserves super-admin login accounts so administrators are never locked out.
 */

const pool = require('../db');

async function clearDatabase() {
  console.log('================================================================');
  console.log('  PURGING DATABASE: divine_fingers_dev');
  console.log('================================================================\n');

  const tablesToClear = [
    'shift_punches',
    'staff_documents',
    'staffing_requests',
    'job_applications',
    'contact_inquiries',
    'newsletter_subscribers',
    'facility_rate_cards',
    'users',
    'facilities',
    'staff_roster',
    'audit_logs'
  ];

  try {
    // Disable foreign key checks for clean cascading purge
    await pool.query('SET FOREIGN_KEY_CHECKS = 0;');

    for (const table of tablesToClear) {
      const [res] = await pool.query(`DELETE FROM \`${table}\``);
      console.log(`- Cleared \`${table}\`: ${res.affectedRows || 0} rows deleted.`);
    }

    // Clean extra admin accounts, preserve primary super admins
    const [adminRes] = await pool.query(
      "DELETE FROM admins WHERE email NOT IN ('admin@divinefingershealthcare.ca', 'ayomidenoch15@gmail.com')"
    );
    console.log(`- Preserved primary super-admins. Deleted ${adminRes.affectedRows || 0} temporary admin accounts.`);

    // Re-enable foreign key checks
    await pool.query('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('\n================================================================');
    console.log('  CURRENT POST-PURGE DATABASE ROW COUNTS');
    console.log('================================================================');

    const [allTables] = await pool.query('SHOW TABLES');
    for (const row of allTables) {
      const tableName = Object.values(row)[0];
      const [countResult] = await pool.query(`SELECT COUNT(*) as c FROM \`${tableName}\``);
      console.log(`  • ${tableName.padEnd(25)} : ${countResult[0].c} rows`);
    }

    console.log('================================================================');
    console.log('  DATABASE CLEANUP COMPLETE');
    console.log('================================================================\n');

  } catch (err) {
    console.error('Error clearing database:', err);
  } finally {
    process.exit();
  }
}

clearDatabase();
