const pool = require('../db.js');

async function main() {
  try {
    const [rows] = await pool.query(`
      SELECT 
        f.id,
        f.name,
        COUNT(DISTINCT CASE WHEN (frc.expiry_date IS NULL OR frc.expiry_date >= CURDATE()) THEN frc.id END) AS active_rate_cards_count,
        GROUP_CONCAT(
          DISTINCT CASE 
            WHEN (frc.expiry_date IS NULL OR frc.expiry_date >= CURDATE()) 
            THEN CONCAT(frc.role, ':$', ROUND(frc.bill_rate))
          END 
          ORDER BY frc.role ASC
          SEPARATOR '|'
        ) AS active_terms_tags
      FROM facilities f
      LEFT JOIN facility_rate_cards frc ON frc.facility_id = f.id
      GROUP BY f.id
      ORDER BY f.created_at DESC
    `);
    console.log('Facilities in DB:');
    rows.forEach(r => {
      console.log(` - ${r.name}: ${r.active_rate_cards_count} active terms -> [${r.active_terms_tags}]`);
    });
    process.exit(0);
  } catch (err) {
    console.error('Query error:', err);
    process.exit(1);
  }
}

main();
