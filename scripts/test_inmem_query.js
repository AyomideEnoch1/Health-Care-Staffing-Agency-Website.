process.env.DB_PORT = '9999';
const pool = require('../db');

const regClientsSql = `
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
`;

async function testReg() {
  const [rows] = await pool.query(regClientsSql);
  console.log('Registered Clients Query in In-Memory Mode returned count:', rows ? rows.length : 'none');
  if (rows && rows.length > 0) {
    rows.forEach(r => console.log(' -> ' + r.organization_name + ' | ' + r.full_name + ' | ' + r.email + ' | ' + r.phone));
  }
  process.exit(0);
}
testReg().catch(console.error);
