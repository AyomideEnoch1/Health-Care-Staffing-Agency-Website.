process.env.DB_PORT = '9999'; // intentionally trigger in-memory fallback
const pool = require('../db.js');

async function test() {
  // Test 1: Registered Clients query
  const [clients] = await pool.query(`
    SELECT 
      COALESCE(u.id, f.id) AS id,
      COALESCE(u.email, f.contact_email, 'no-email@facility.local') AS email,
      COALESCE(u.full_name, f.contact_name, 'Facility Coordinator') AS full_name,
      COALESCE(f.name, u.organization_name, 'Healthcare Facility') AS organization_name,
      f.id AS facility_id,
      COALESCE(u.client_role, 'Staffing Requester') AS client_role,
      COALESCE(u.phone, f.contact_phone, '—') AS phone,
      COALESCE(u.is_active, 1) AS is_active,
      COALESCE(u.email_verified, 1) AS email_verified,
      u.last_login,
      COALESCE(u.created_at, f.created_at) AS created_at,
      COALESCE(f.facility_code, 'FAC') AS facility_code,
      COALESCE(f.name, u.organization_name) AS linked_facility_name,
      COALESCE(f.status, 'pending') AS facility_status,
      COUNT(DISTINCT sr.id) AS total_requests_count
    FROM facilities f
    LEFT JOIN users u ON (u.facility_id = f.id OR LOWER(TRIM(u.organization_name)) = LOWER(TRIM(f.name))) AND u.role = 'client'
    LEFT JOIN staffing_requests sr ON (sr.facility_id = f.id OR LOWER(TRIM(sr.facility_name)) = LOWER(TRIM(f.name)) OR (u.email IS NOT NULL AND sr.contact_email = u.email))
    GROUP BY f.id, u.id
    ORDER BY created_at DESC
  `);
  console.log('Registered Clients in In-Memory Mode returned count:', clients.length);
  clients.forEach(c => {
    console.log(` -> ${c.organization_name} | ${c.full_name} | Total Requests: ${c.total_requests_count}`);
  });

  // Test 2: Facilities query
  const [facilities] = await pool.query(`
    SELECT 
      f.*,
      COUNT(DISTINCT CASE WHEN (frc.expiry_date IS NULL OR frc.expiry_date >= CURDATE()) THEN frc.id END) AS active_rate_cards_count,
      COUNT(DISTINCT frc.id) AS total_rate_cards_count,
      MAX(frc.created_at) AS last_rate_updated_at,
      COUNT(DISTINCT u.id) AS registered_users_count,
      GROUP_CONCAT(DISTINCT u.email SEPARATOR ', ') AS registered_user_emails,
      MAX(u.created_at) AS latest_user_registered_at,
      COUNT(DISTINCT sr.id) AS total_shifts_requested,
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
    LEFT JOIN users u ON (u.facility_id = f.id OR LOWER(TRIM(u.organization_name)) = LOWER(TRIM(f.name))) AND u.role = 'client'
    LEFT JOIN staffing_requests sr ON (sr.facility_id = f.id OR LOWER(TRIM(sr.facility_name)) = LOWER(TRIM(f.name)))
    GROUP BY f.id
    ORDER BY f.created_at DESC, f.name ASC
  `);
  console.log('\nFacilities in In-Memory Mode returned count:', facilities.length);
  facilities.forEach(f => {
    console.log(` -> ${f.name} | Active Rates: ${f.active_rate_cards_count} | Terms Tags: ${f.active_terms_tags} | Summary: ${f.active_terms_summary}`);
  });

  process.exit(0);
}

test();
