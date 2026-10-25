/**
 * Database Connection Module with Automatic Resilient Fallback
 * Divine Fingers Healthcare Services Inc.
 * 
 * Automatically connects to MySQL in production/local environments, and gracefully
 * falls back to an in-memory datastore on serverless platforms (e.g. Vercel) when
 * a remote database is not yet provisioned.
 */
const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config();

const host = process.env.DB_HOST || '127.0.0.1';
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_NAME || 'divine_fingers_dev';
const port = parseInt(process.env.DB_PORT || '3306', 10);

let isMySqlAvailable = false;
let realPool = null;

try {
  let sslConfig = undefined;
  if (process.env.DB_CA_CERT) {
    sslConfig = {
      ca: process.env.DB_CA_CERT.replace(/\\n/g, '\n'),
      rejectUnauthorized: true
    };
  } else if (process.env.DB_SSL === 'true' || host.includes('tidbcloud.com') || host.includes('aivencloud.com')) {
    sslConfig = { minVersion: 'TLSv1.2', rejectUnauthorized: true };
  }

  realPool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    ssl: sslConfig,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '5', 10),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    timezone: 'local',
    connectTimeout: 20000
  });

  realPool.getConnection()
    .then(async conn => {
      isMySqlAvailable = true;
      console.log(`✅ [Database] Connected to MySQL (${host}:${port}/${database})`);

      // Auto-heal / verify schema integrity across all deployment targets (dev/test only; in production schema is already provisioned)
      if (process.env.NODE_ENV !== 'production') {
        try {
        await conn.query(`
          CREATE TABLE IF NOT EXISTS shift_punches (
            id VARCHAR(64) NOT NULL,
            staff_id VARCHAR(64) NOT NULL,
            staff_name VARCHAR(120) NOT NULL DEFAULT 'Staff Member',
            staff_email VARCHAR(191) NOT NULL DEFAULT '',
            shift_id VARCHAR(64) NULL DEFAULT NULL,
            facility_name VARCHAR(150) NOT NULL DEFAULT 'Unknown Facility',
            unit_department VARCHAR(100) NOT NULL DEFAULT 'General Floor',
            role VARCHAR(60) NOT NULL DEFAULT 'RN',
            clock_in_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            clock_out_time DATETIME NULL DEFAULT NULL,
            total_hours DECIMAL(5,2) NOT NULL DEFAULT 0.00,
            notes TEXT NULL DEFAULT NULL,
            status ENUM('active','completed','cancelled') NOT NULL DEFAULT 'active',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_punches_staff (staff_id),
            INDEX idx_punches_status (status)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await conn.query(`
          CREATE TABLE IF NOT EXISTS staff_documents (
            id VARCHAR(64) NOT NULL,
            staff_id VARCHAR(64) NOT NULL,
            doc_type ENUM('cpr','n95','vss','license','other') NOT NULL DEFAULT 'other',
            title VARCHAR(200) NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            file_size INT UNSIGNED NOT NULL DEFAULT 0,
            mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
            expiry_date DATE NULL DEFAULT NULL,
            uploaded_by VARCHAR(100) NOT NULL DEFAULT 'Staff',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_docs_staff (staff_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await conn.query(`
          CREATE TABLE IF NOT EXISTS newsletter_subscribers (
            id VARCHAR(64) NOT NULL,
            email VARCHAR(191) NOT NULL,
            status ENUM('active','unsubscribed') NOT NULL DEFAULT 'active',
            source VARCHAR(50) NOT NULL DEFAULT 'homepage_strip',
            ip_address VARCHAR(45) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY idx_newsletter_email (email)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        try { await conn.query('ALTER TABLE users MODIFY COLUMN id VARCHAR(64) NOT NULL'); } catch (_) {}
        try { await conn.query('ALTER TABLE staffing_requests ADD COLUMN clock_in_time DATETIME NULL DEFAULT NULL'); } catch (_) {}
        try { await conn.query('ALTER TABLE staffing_requests ADD COLUMN clock_out_time DATETIME NULL DEFAULT NULL'); } catch (_) {}
        try { await conn.query(`ALTER TABLE staffing_requests MODIFY COLUMN status ENUM('pending','confirmed','dispatched','in_session','completed','cancelled') NOT NULL DEFAULT 'pending'`); } catch (_) {}
        try { await conn.query('ALTER TABLE staffing_requests ADD COLUMN facility_id VARCHAR(36) NULL'); } catch (_) {}
        try { await conn.query('ALTER TABLE admins ADD COLUMN avatar_url VARCHAR(500) NULL AFTER role'); } catch (_) {}
        try { await conn.query('ALTER TABLE admins ADD COLUMN avatar_updated_at TIMESTAMP NULL AFTER avatar_url'); } catch (_) {}
        try { await conn.query('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL AFTER organization_name'); } catch (_) {}
        try { await conn.query('ALTER TABLE users ADD COLUMN avatar_updated_at TIMESTAMP NULL AFTER avatar_url'); } catch (_) {}
        try { await conn.query('ALTER TABLE users ADD COLUMN password_reset_token_hash VARCHAR(128) NULL DEFAULT NULL'); } catch (_) {}
        try { await conn.query('ALTER TABLE users ADD COLUMN password_reset_expires DATETIME NULL DEFAULT NULL'); } catch (_) {}
        try { await conn.query('ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(128) NULL DEFAULT NULL AFTER email_verified'); } catch (_) {}
        try { await conn.query('ALTER TABLE users ADD COLUMN email_verification_expires DATETIME NULL DEFAULT NULL AFTER email_verification_token'); } catch (_) {}
        try { await conn.query('ALTER TABLE users ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 1'); } catch (_) {}
        try { await conn.query('ALTER TABLE facilities ADD COLUMN logo_url VARCHAR(500) NULL AFTER facility_code'); } catch (_) {}
        try { await conn.query('ALTER TABLE staff_roster MODIFY COLUMN avatar_url VARCHAR(500) NULL'); } catch (_) {}
        try { await conn.query('ALTER TABLE users MODIFY COLUMN phone VARCHAR(50) NULL'); } catch (_) {}
        try { await conn.query('ALTER TABLE facilities MODIFY COLUMN contact_phone VARCHAR(50) NULL'); } catch (_) {}

        await conn.query(`
          CREATE TABLE IF NOT EXISTS facilities (
            id VARCHAR(36) NOT NULL,
            name VARCHAR(255) NOT NULL,
            facility_code VARCHAR(20) NOT NULL,
            address VARCHAR(255) NULL,
            region VARCHAR(80) NULL DEFAULT 'Greater Toronto Area',
            contact_name VARCHAR(100) NULL,
            contact_email VARCHAR(191) NULL,
            contact_phone VARCHAR(30) NULL,
            msa_signed_date DATE NULL,
            msa_expiry_date DATE NULL,
            msa_document_url TEXT NULL,
            status ENUM('active', 'pending', 'expired') NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY idx_facility_code (facility_code),
            INDEX idx_facility_name (name),
            INDEX idx_facility_status (status)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await conn.query(`
          CREATE TABLE IF NOT EXISTS facility_rate_cards (
            id VARCHAR(36) NOT NULL,
            facility_id VARCHAR(36) NOT NULL,
            role ENUM('RN', 'RPN', 'PSW', 'Companion', 'Travel Nurse', 'Multiple') NOT NULL,
            shift_type VARCHAR(60) NOT NULL DEFAULT 'standard',
            bill_rate DECIMAL(6,2) NOT NULL,
            pay_rate DECIMAL(6,2) NULL,
            overtime_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.50,
            effective_date DATE NOT NULL,
            expiry_date DATE NULL,
            notes TEXT NULL,
            created_by VARCHAR(64) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_rate_cards_lookup (facility_id, role, shift_type, effective_date),
            INDEX idx_rate_cards_facility (facility_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        // Auto-seed baseline facility rate cards if table is empty
        try {
          const [rcCount] = await conn.query('SELECT COUNT(*) AS total FROM facility_rate_cards');
          if (rcCount && rcCount[0] && Number(rcCount[0].total) === 0) {
            console.log('🌱 [Database] Seeding initial facility rate cards...');
            const [existingFacs] = await conn.query('SELECT id, name FROM facilities LIMIT 5');
            if (existingFacs && existingFacs.length > 0) {
              for (const ef of existingFacs) {
                await conn.query(`
                  INSERT INTO facility_rate_cards (id, facility_id, role, shift_type, bill_rate, pay_rate, effective_date, expiry_date, notes)
                  VALUES 
                    (UUID(), ?, 'RN', 'standard', 85.00, 55.00, '2026-01-10', '2027-01-10', 'Master Service Agreement'),
                    (UUID(), ?, 'RPN', 'standard', 65.00, 42.00, '2026-01-10', '2027-01-10', 'Master Service Agreement'),
                    (UUID(), ?, 'PSW', 'standard', 45.00, 28.00, '2026-01-10', '2027-01-10', 'Master Service Agreement')
                  ON DUPLICATE KEY UPDATE bill_rate = VALUES(bill_rate)
                `, [ef.id, ef.id, ef.id]);
              }
            }
          }
        } catch (seedErr) {
          console.warn('⚠️ [Rate Cards Seed Notice]:', seedErr.message);
        }

        } catch (schemaNotice) {
          console.warn('⚠️ [Database Schema Verification Notice]:', schemaNotice.message);
        }
      }
      conn.release();
    })
    .catch(err => {
      isMySqlAvailable = false;
      if (process.env.NODE_ENV === 'production') {
        console.error(`⚠️ [Database] Initial connection attempt: ${err.message}. Retrying via pool...`);
      } else if (!err.message.includes('Pool is closed')) {
        console.warn(`⚠️ [Database] MySQL not reachable (${err.message}). Activating In-Memory Resilient Mode (DEVELOPMENT ONLY).`);
      }
    });
} catch (e) {
  isMySqlAvailable = false;
  if (process.env.NODE_ENV === 'production') {
    console.error(`❌ [FATAL DATABASE ERROR] Failed to initialize database pool: ${e.message}`);
    process.exit(1);
  }
}

// ── In-Memory Datastore (Strictly for local unit testing / non-production) ─────
const inMemoryStore = {
  admins: [
    {
      id: '1f2465dc-9c9b-4d09-a5fa-24c019be87d6',
      email: 'ayomidenoch15@gmail.com',
      password_hash: '$2b$10$ICqO6AZ.OprBLcm5OT5Nm.aWhldo4q3dLx6tHzcaFg6PwaX23uUPG',
      full_name: 'Olugbodi Ayomide',
      role: 'super-admin',
      failed_login_attempts: 0,
      lock_until: null,
      totp_secret: null,
      totp_enabled: 0,
      email_verified: 1,
      email_verification_token: null,
      email_verification_expires: null,
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'c4970cd8-eb90-4e33-9aba-446711e88d8b',
      email: 'admin@divinefingershealthcare.ca',
      password_hash: '$2b$10$mDfhqm556YwMEL3q2GbDSOPnZB1ffpq2GUQFyQ2QveIkZmcw9..r2',
      full_name: 'Divine Fingers Administrator',
      role: 'super-admin',
      failed_login_attempts: 0,
      lock_until: null,
      totp_secret: null,
      totp_enabled: 0,
      email_verified: 1,
      email_verification_token: null,
      email_verification_expires: null,
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  staff_roster: [],
  staffing_requests: [],
  job_applications: [],
  contact_inquiries: [],
  audit_logs: [],
  staff_documents: [],
  shift_punches: [],
  newsletter_subscribers: [],
  facilities: [
    {
      id: 'fac-sunnybrook-001',
      name: 'Sunnybrook Health Sciences Centre',
      facility_code: 'FAC-SHN-01',
      address: '2075 Bayview Ave, Toronto, ON M4N 3M5',
      region: 'Toronto Central',
      contact_name: 'Director Laura Rossi',
      contact_email: 'clinical.staffing@sunnybrook.ca',
      contact_phone: '(416) 480-6100',
      status: 'active',
      msa_signed_date: '2026-01-10',
      msa_expiry_date: '2027-01-10',
      msa_document_url: 'https://storage.divinefingershealthcare.ca/contracts/msa-sunnybrook-2026.pdf',
      created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'fac-humber-002',
      name: 'Humber River Hospital',
      facility_code: 'FAC-HRH-02',
      address: '1235 Wilson Ave, North York, ON M3M 0B2',
      region: 'North York / GTA West',
      contact_name: 'Lead Coordinator James Patel',
      contact_email: 'dispatch@hrh.ca',
      contact_phone: '(416) 242-1000',
      status: 'active',
      msa_signed_date: '2026-02-15',
      msa_expiry_date: '2027-02-15',
      msa_document_url: 'https://storage.divinefingershealthcare.ca/contracts/msa-hrh-2026.pdf',
      created_at: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'fac-stmichael-003',
      name: "St. Michael's Hospital (Unity Health)",
      facility_code: 'FAC-SMH-03',
      address: '36 Queen St E, Toronto, ON M5B 1W8',
      region: 'Downtown Toronto',
      contact_name: 'Supervisor Marcus Wong',
      contact_email: 'dispatch@unityhealth.to',
      contact_phone: '(416) 864-6060',
      status: 'active',
      msa_signed_date: '2026-03-01',
      msa_expiry_date: '2027-03-01',
      msa_document_url: null,
      created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  facility_rate_cards: [
    {
      id: 'rc-sb-rn-001',
      facility_id: 'fac-sunnybrook-001',
      role: 'RN',
      shift_type: 'standard',
      bill_rate: 85.00,
      pay_rate: 55.00,
      overtime_multiplier: 1.50,
      effective_date: '2026-01-10',
      expiry_date: '2027-01-10',
      notes: 'Master Service Agreement Contracted Rate',
      created_by: 'admin',
      created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'rc-sb-rpn-002',
      facility_id: 'fac-sunnybrook-001',
      role: 'RPN',
      shift_type: 'standard',
      bill_rate: 65.00,
      pay_rate: 42.00,
      overtime_multiplier: 1.50,
      effective_date: '2026-01-10',
      expiry_date: '2027-01-10',
      notes: 'Master Service Agreement Contracted Rate',
      created_by: 'admin',
      created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'rc-sb-psw-003',
      facility_id: 'fac-sunnybrook-001',
      role: 'PSW',
      shift_type: 'standard',
      bill_rate: 45.00,
      pay_rate: 28.00,
      overtime_multiplier: 1.50,
      effective_date: '2026-01-10',
      expiry_date: '2027-01-10',
      notes: 'Master Service Agreement Contracted Rate',
      created_by: 'admin',
      created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'rc-hrh-rn-004',
      facility_id: 'fac-humber-002',
      role: 'RN',
      shift_type: 'standard',
      bill_rate: 82.50,
      pay_rate: 52.00,
      overtime_multiplier: 1.50,
      effective_date: '2026-02-15',
      expiry_date: '2027-02-15',
      notes: 'Master Service Agreement Contracted Rate',
      created_by: 'admin',
      created_at: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'rc-hrh-psw-005',
      facility_id: 'fac-humber-002',
      role: 'PSW',
      shift_type: 'standard',
      bill_rate: 44.00,
      pay_rate: 28.00,
      overtime_multiplier: 1.50,
      effective_date: '2026-02-15',
      expiry_date: '2027-02-15',
      notes: 'Master Service Agreement Contracted Rate',
      created_by: 'admin',
      created_at: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'rc-smh-rn-006',
      facility_id: 'fac-stmichael-003',
      role: 'RN',
      shift_type: 'standard',
      bill_rate: 85.00,
      pay_rate: 55.00,
      overtime_multiplier: 1.50,
      effective_date: '2026-03-01',
      expiry_date: '2027-03-01',
      notes: 'Master Service Agreement Contracted Rate',
      created_by: 'admin',
      created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'rc-smh-tn-007',
      facility_id: 'fac-stmichael-003',
      role: 'Travel Nurse',
      shift_type: 'standard',
      bill_rate: 110.00,
      pay_rate: 75.00,
      overtime_multiplier: 1.50,
      effective_date: '2026-03-01',
      expiry_date: '2027-03-01',
      notes: 'Master Service Agreement Contracted Rate',
      created_by: 'admin',
      created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
    }
  ],
  email_outbox: [],
  email_suppressions: [],
  email_audit_logs: [],
  sms_consent: [],
  // IMPORTANT: users[] must NEVER contain administrator emails.
  // Admins live exclusively in admins[]. Mixing them here bypasses the
  // /api/users/login 403 rejection check and lets admins access the public portal.
  users: [
    {
      id: 'usr-laura-rossi-001',
      email: 'clinical.staffing@sunnybrook.ca',
      password_hash: '$2b$10$ICqO6AZ.OprBLcm5OT5Nm.aWhldo4q3dLx6tHzcaFg6PwaX23uUPG',
      full_name: 'Director Laura Rossi',
      role: 'client',
      organization_name: 'Sunnybrook Health Sciences Centre',
      facility_id: 'fac-sunnybrook-001',
      phone: '+1 (416) 480-6100',
      client_role: 'Director of Clinical Staffing',
      is_active: 1,
      email_verified: 1,
      created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'usr-james-patel-002',
      email: 'dispatch@hrh.ca',
      password_hash: '$2b$10$ICqO6AZ.OprBLcm5OT5Nm.aWhldo4q3dLx6tHzcaFg6PwaX23uUPG',
      full_name: 'Lead Coordinator James Patel',
      role: 'client',
      organization_name: 'Humber River Hospital',
      facility_id: 'fac-humber-002',
      phone: '+1 (416) 242-1000',
      client_role: 'Lead Staffing Coordinator',
      is_active: 1,
      email_verified: 1,
      created_at: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'usr-marcus-wong-003',
      email: 'dispatch@unityhealth.to',
      password_hash: '$2b$10$ICqO6AZ.OprBLcm5OT5Nm.aWhldo4q3dLx6tHzcaFg6PwaX23uUPG',
      full_name: 'Supervisor Marcus Wong',
      role: 'client',
      organization_name: "St. Michael's Hospital (Unity Health)",
      facility_id: 'fac-stmichael-003',
      phone: '+1 (416) 864-6060',
      client_role: 'Clinical Operations Supervisor',
      is_active: 1,
      email_verified: 1,
      created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'usr-client-login-004',
      email: 'client.test.login@hospital.ca',
      password_hash: '$2b$10$ICqO6AZ.OprBLcm5OT5Nm.aWhldo4q3dLx6tHzcaFg6PwaX23uUPG',
      full_name: 'Client Test Login',
      role: 'client',
      organization_name: 'City Care Hospital',
      facility_id: 'fac-citycare-004',
      phone: '+1 (647) 123-4567',
      client_role: 'Staffing Coordinator',
      is_active: 1,
      email_verified: 1,
      created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'usr-dr-adeleke-005',
      email: 'dr.adeleke@stmaryshospital.org',
      password_hash: '$2b$10$ICqO6AZ.OprBLcm5OT5Nm.aWhldo4q3dLx6tHzcaFg6PwaX23uUPG',
      full_name: 'Dr. Samuel Adeleke',
      role: 'client',
      organization_name: 'St. Mary Medical Centre',
      facility_id: 'fac-stmary-005',
      phone: '+234 803 123 4567',
      client_role: 'Medical Director & Staffing Lead',
      is_active: 1,
      email_verified: 1,
      created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    }
  ]
};

// Set of admin emails for fast O(1) lookup — used to guard users[] queries.
const _adminEmailSet = new Set(
  inMemoryStore.admins.map(a => a.email.toLowerCase())
);

// ── In-Memory Query Router ────────────────────────────────────────────────────
function handleInMemoryQuery(sql, params = []) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[FATAL DATABASE ERROR] In-memory mock database fallback is strictly disabled in production (NODE_ENV=production). Primary MySQL pool is unreachable.');
  }
  const normalized = sql.trim().toLowerCase();

  // ── SPECIAL HANDLER: /api/admin/registered-clients ──────────────────────
  if ((normalized.includes('from facilities') && normalized.includes('client_role')) || (normalized.includes('from users') && normalized.includes('facility_code')) || (normalized.includes('from facilities') && normalized.includes('left join users') && normalized.includes('coalesce(u.id'))) {
    const facs = inMemoryStore.facilities || [];
    const clientUsers = (inMemoryStore.users || []).filter(u => u.role === 'client');
    
    // Map from facilities first so EVERY registered facility is guaranteed to appear
    const facList = facs.map(f => {
      const matchedUser = clientUsers.find(u => 
        (u.facility_id && u.facility_id === f.id) ||
        (u.organization_name && f.name && u.organization_name.toLowerCase().trim() === f.name.toLowerCase().trim()) ||
        (u.email && f.contact_email && u.email.toLowerCase() === f.contact_email.toLowerCase())
      );
      const reqCount = (inMemoryStore.staffing_requests || []).filter(sr => 
        sr.facility_id === f.id || 
        (sr.facility_name && f.name && sr.facility_name.toLowerCase().trim() === f.name.toLowerCase().trim()) || 
        (matchedUser && sr.contact_email && sr.contact_email.toLowerCase() === matchedUser.email.toLowerCase())
      ).length;

      return {
        id: matchedUser ? matchedUser.id : f.id,
        email: matchedUser ? matchedUser.email : (f.contact_email || 'client@hospital.ca'),
        full_name: matchedUser ? matchedUser.full_name : (f.contact_name || 'Facility Coordinator'),
        organization_name: f.name || (matchedUser ? matchedUser.organization_name : 'Healthcare Facility'),
        facility_id: f.id,
        client_role: matchedUser ? (matchedUser.client_role || 'Staffing Requester') : 'Facility Coordinator',
        phone: matchedUser ? (matchedUser.phone || f.contact_phone) : (f.contact_phone || '—'),
        is_active: matchedUser ? Number(matchedUser.is_active) : 1,
        email_verified: matchedUser ? Number(matchedUser.email_verified) : 1,
        last_login: matchedUser ? matchedUser.last_login : null,
        created_at: matchedUser ? matchedUser.created_at : f.created_at,
        facility_code: f.facility_code || 'FAC',
        linked_facility_name: f.name,
        facility_status: f.status || 'pending',
        total_requests_count: reqCount
      };
    });

    const standaloneClients = clientUsers.filter(u => 
      !facs.some(f => 
        (u.facility_id && u.facility_id === f.id) ||
        (u.organization_name && f.name && u.organization_name.toLowerCase().trim() === f.name.toLowerCase().trim())
      )
    ).map(u => ({
      ...u,
      facility_code: 'FAC',
      linked_facility_name: u.organization_name || 'Individual Facility',
      facility_status: 'pending',
      total_requests_count: 0
    }));

    return [[...facList, ...standaloneClients]];
  }

  // ── SPECIAL HANDLER: /api/admin/facilities ──────────────────────────────
  if ((normalized.includes('from facilities') || normalized.includes('from `facilities`')) && !normalized.includes('client_role')) {
    if (normalized.startsWith('select')) {
      if (normalized.includes('count(*) as total') || normalized.includes('count(*)')) {
        const total = (inMemoryStore.facilities || []).length;
        const pending = (inMemoryStore.facilities || []).filter(f => f.status === 'pending').length;
        const active = (inMemoryStore.facilities || []).filter(f => f.status === 'active').length;
        return [[{ total_facilities: total, pending_facilities: pending, active_facilities: active, total, count: total }]];
      }
      if (normalized.includes('where id = ?') || normalized.includes('where lower(trim(name)) = lower(trim(?))')) {
        const p0 = String(params[0] || '').toLowerCase().trim();
        const found = (inMemoryStore.facilities || []).filter(f => f.id === params[0] || (f.name && f.name.toLowerCase().trim() === p0));
        return [found];
      }

      // Return enriched facilities with rate card stats and client user info
      const today = new Date();
      const enriched = (inMemoryStore.facilities || []).map(fac => {
        const rateCards = (inMemoryStore.facility_rate_cards || []).filter(rc => rc.facility_id === fac.id);
        const users = (inMemoryStore.users || []).filter(u => u.facility_id === fac.id || (u.organization_name && fac.name && u.organization_name.toLowerCase().trim() === fac.name.toLowerCase().trim()));
        const requests = (inMemoryStore.staffing_requests || []).filter(r => r.facility_id === fac.id || (r.facility_name && fac.name && r.facility_name.toLowerCase().trim() === fac.name.toLowerCase().trim()));

        let isExpired = fac.status === 'expired';
        let isExpiringSoon = false;
        let daysUntilExpiry = null;
        if (fac.msa_expiry_date) {
          const expDate = new Date(fac.msa_expiry_date);
          const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
          daysUntilExpiry = diffDays;
          if (diffDays <= 0) isExpired = true;
          else if (diffDays <= 30) isExpiringSoon = true;
        }

        const activeCards = rateCards.filter(rc => !rc.expiry_date || new Date(rc.expiry_date) >= today);
        const termsTags = activeCards.map(rc => `${rc.role}:${Math.round(Number(rc.bill_rate))}`).join('|');
        const termsSummary = activeCards.map(rc => `${rc.role}: ${Number(rc.bill_rate).toFixed(0)}/hr`).join(', ');

        return {
          ...fac,
          effective_status: isExpired ? 'expired' : (fac.status || 'pending'),
          is_expiring_soon: isExpiringSoon,
          days_until_expiry: daysUntilExpiry,
          active_rate_cards_count: activeCards.length,
          total_rate_cards_count: rateCards.length,
          active_terms_tags: termsTags,
          active_terms_summary: termsSummary,
          has_portal_account: users.length > 0,
          registered_user_emails: users.map(u => u.email).join(', '),
          registered_users_count: users.length,
          latest_user_registered_at: users.length > 0 ? users[users.length - 1].created_at : null,
          total_shifts_requested: requests.length
        };
      });

      return [enriched];
    }
  }

  // Health check query
  if (normalized.startsWith('select 1')) {
    return [[{ '1': 1 }]];
  }

  // Show tables
  if (normalized.startsWith('show tables')) {
    return [Object.keys(inMemoryStore).map(t => ({ [`Tables_in_${database}`]: t }))];
  }

  // 1. SELECT from admins
  if (normalized.includes('from admins') || normalized.includes('from `admins`')) {
    if (normalized.includes('where email = ?')) {
      const emailParam = (params[0] || '').toLowerCase().trim();
      const found = inMemoryStore.admins.filter(a => a.email.toLowerCase() === emailParam);
      return [found];
    }
    if (normalized.includes('where id = ?')) {
      const idParam = params[0];
      const found = inMemoryStore.admins.filter(a => a.id === idParam);
      return [found];
    }
    if (normalized.includes('count(*)')) {
      return [[{ count: inMemoryStore.admins.length, c: inMemoryStore.admins.length }]];
    }
    return [inMemoryStore.admins];
  }

  // 2. UPDATE admins
  if (normalized.startsWith('update admins') || normalized.startsWith('update `admins`')) {
    if (params.length > 0) {
      const targetId = params[params.length - 1];
      const admin = inMemoryStore.admins.find(a => a.id === targetId || a.email === targetId);
      if (admin) {
        if (normalized.includes('email_verification_token = ?')) {
          admin.email_verification_token = params[0];
          admin.email_verification_expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        }
        if (normalized.includes('email_verified = 1')) {
          admin.email_verified = 1;
          admin.email_verification_token = null;
          admin.email_verification_expires = null;
        }
        if (normalized.includes('failed_login_attempts = ?')) admin.failed_login_attempts = params[0];
        if (normalized.includes('totp_enabled = ?')) admin.totp_enabled = params[0];
        if (normalized.includes('totp_secret = ?')) admin.totp_secret = params[0];
        if (normalized.includes('last_login = now()') || normalized.includes('last_login')) admin.last_login = new Date().toISOString();
        admin.updated_at = new Date().toISOString();
      }
    }
    return [{ affectedRows: 1, changedRows: 1 }];
  }

  // 3. INSERT into admins
  if (normalized.startsWith('insert into admins') || normalized.startsWith('insert into `admins`')) {
    if (params.length >= 4) {
      const newAdmin = {
        id: params[0] || crypto.randomUUID(),
        email: params[1],
        password_hash: params[2],
        full_name: params[3],
        role: params[4] || 'care-coordinator',
        failed_login_attempts: 0,
        lock_until: null,
        totp_secret: null,
        totp_enabled: 0,
        email_verified: 1,
        is_active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      inMemoryStore.admins.push(newAdmin);
    }
    return [{ affectedRows: 1, insertId: inMemoryStore.admins.length }];
  }

  // 4. DELETE from admins
  if (normalized.startsWith('delete from admins') || normalized.startsWith('delete from `admins`')) {
    if (params.length > 0) {
      const idOrEmail = params[0];
      inMemoryStore.admins = inMemoryStore.admins.filter(a => a.id !== idOrEmail && a.email !== idOrEmail);
    }
    return [{ affectedRows: 1 }];
  }

  // 5. STAFF_ROSTER
  if (normalized.includes('staff_roster') && !normalized.includes('staffing_requests')) {
    if (normalized.startsWith('select')) {
      // Auto-sync any registered healthcare_worker users into staff_roster
      if (inMemoryStore.users && inMemoryStore.staff_roster) {
        const hwUsers = inMemoryStore.users.filter(u => u.role === 'healthcare_worker');
        hwUsers.forEach(u => {
          if (!inMemoryStore.staff_roster.some(s => s.id === u.id || (s.email && u.email && s.email.toLowerCase() === u.email.toLowerCase()))) {
            inMemoryStore.staff_roster.push({
              id: u.id,
              staff_code: 'STF-' + String(inMemoryStore.staff_roster.length + 1).padStart(3, '0'),
              name: u.full_name || 'Staff Member',
              role: u.clinical_role || 'RN',
              specialty: 'General Care',
              region: 'Greater Toronto Area',
              phone: u.phone || null,
              email: u.email,
              status: 'available',
              credential_status: 'pending',
              rating: 5.00,
              shifts_completed: 0,
              hourly_rate: 35.00,
              cpr_expiry_date: '2027-12-31',
              vss_status: 'Clear',
              n95_fit_test: '3M Valid',
              created_at: u.created_at || new Date().toISOString()
            });
          }
        });
      }

      if (normalized.includes('count(*)')) {
        return [[{ total: inMemoryStore.staff_roster.length, count: inMemoryStore.staff_roster.length }]];
      }
      if (normalized.includes('where id = ?') || normalized.includes('where lower(email) = ?') || normalized.includes('where email = ?') || normalized.includes('staff_code = ?')) {
        const pList = params.map(p => String(p || '').toLowerCase().trim());
        let found = inMemoryStore.staff_roster.filter(s => 
          params.includes(s.id) ||
          pList.includes(s.id) ||
          pList.includes((s.email || '').toLowerCase()) ||
          pList.includes((s.staff_code || '').toLowerCase())
        );
        // If not found, auto-sync from inMemoryStore.users
        if (found.length === 0 && inMemoryStore.users) {
          const matchedUser = inMemoryStore.users.find(u => 
            params.includes(u.id) || pList.includes(u.id) || pList.includes((u.email || '').toLowerCase())
          );
          if (matchedUser) {
            const newStaff = {
              id: matchedUser.id,
              staff_code: 'STF-' + String(inMemoryStore.staff_roster.length + 1).padStart(3, '0'),
              name: matchedUser.full_name || 'Staff Member',
              role: 'RN',
              specialty: 'General Care',
              region: 'Greater Toronto Area',
              phone: matchedUser.phone || null,
              email: matchedUser.email,
              status: 'available',
              credential_status: 'pending',
              rating: 5.00,
              shifts_completed: 0,
              hourly_rate: 35.00,
              cpr_expiry_date: '2027-12-31',
              vss_status: 'Clear',
              n95_fit_test: '3M Valid',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            inMemoryStore.staff_roster.push(newStaff);
            found = [newStaff];
          }
        }
        return [found];
      }
      return [inMemoryStore.staff_roster];
    }
    if (normalized.startsWith('insert')) {
      const colMatch = sql.match(/insert\s+into\s+[`"]?staff_roster[`"]?\s*\(([^)]+)\)\s*values\s*\(([\s\S]+?)\)/i);
      const newStaff = {
        id: crypto.randomUUID(),
        staff_code: 'STF-' + String(inMemoryStore.staff_roster.length + 1).padStart(3, '0'),
        name: 'Staff Member',
        role: 'RN',
        specialty: 'General Care',
        region: 'Greater Toronto Area',
        phone: null,
        email: null,
        status: 'available',
        credential_status: 'verified',
        rating: 5.00,
        shifts_completed: 0,
        hourly_rate: 35.00,
        cpr_expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        vss_status: 'Clear',
        n95_fit_test: '3M Valid',
        cno_registration_num: null,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (colMatch) {
        const cols = colMatch[1].split(',').map(c => c.trim().replace(/[`"']/g, ''));
        const valDefs = colMatch[2].split(',').map(v => v.trim());
        let paramIdx = 0;
        cols.forEach((col, idx) => {
          const valDef = valDefs[idx] ? valDefs[idx].trim() : '?';
          if (valDef === '?') {
            if (params[paramIdx] !== undefined) {
              newStaff[col] = params[paramIdx];
            }
            paramIdx++;
          } else if (valDef) {
            newStaff[col] = valDef.replace(/^['"]|['"]$/g, '');
          }
        });
      } else {
        newStaff.id = params[0] || newStaff.id;
        newStaff.staff_code = params[1] || newStaff.staff_code;
        newStaff.name = params[2] || newStaff.name;
        newStaff.role = params[3] || newStaff.role;
      }

      if (newStaff.hourly_rate !== undefined && newStaff.hourly_rate !== null) {
        newStaff.hourly_rate = parseFloat(newStaff.hourly_rate) || 35.00;
      }

      const emailLower = (newStaff.email || '').toLowerCase().trim();
      const existingIdx = inMemoryStore.staff_roster.findIndex(s => 
        (newStaff.id && s.id === newStaff.id) || 
        (emailLower && s.email && s.email.toLowerCase().trim() === emailLower)
      );
      if (existingIdx >= 0) {
        Object.assign(inMemoryStore.staff_roster[existingIdx], newStaff, { updated_at: new Date().toISOString() });
      } else {
        inMemoryStore.staff_roster.push(newStaff);
      }
      return [{ affectedRows: 1, insertId: inMemoryStore.staff_roster.length }];
    }
    if (normalized.startsWith('update')) {
      const setMatch = sql.match(/update\s+[`"]?staff_roster[`"]?\s+set\s+([\s\S]+?)\s+where\s+([\s\S]+)/i);
      if (setMatch) {
        const setClause = setMatch[1].trim();
        const whereClause = setMatch[2].trim();
        const setQuestionCount = (setClause.match(/\?/g) || []).length;
        const whereParams = params.slice(setQuestionCount);

        const staffList = inMemoryStore.staff_roster.filter(s => {
          if (whereParams.some(p => p && (s.id === p || (s.email && s.email.toLowerCase() === String(p).toLowerCase()) || s.staff_code === p))) return true;
          if (s.email && whereClause.toLowerCase().includes(s.email.toLowerCase())) return true;
          if (s.id && whereClause.includes(s.id)) return true;
          return false;
        });

        let updatedCount = 0;
        for (const staff of staffList) {
          let pIdx = 0;
          const assignments = setClause.split(',').map(a => a.trim());
          for (const assign of assignments) {
            const parts = assign.split('=').map(p => p.trim());
            if (parts.length >= 2) {
              const col = parts[0].replace(/[`"']/g, '').trim();
              const valExpr = parts.slice(1).join('=').trim();
              if (valExpr === '?') {
                staff[col] = params[pIdx++];
              } else if (/shifts_completed/i.test(col) && /shifts_completed/i.test(valExpr)) {
                staff.shifts_completed = (Number(staff.shifts_completed) || 0) + 1;
              } else if (valExpr.startsWith("'") && valExpr.endsWith("'")) {
                staff[col] = valExpr.slice(1, -1);
              } else if (!isNaN(Number(valExpr))) {
                staff[col] = Number(valExpr);
              }
            }
          }
          staff.updated_at = new Date().toISOString();
          updatedCount++;
        }
        if (updatedCount > 0) {
          return [{ affectedRows: updatedCount }];
        }
      }

      // Fallback update
      const targetParam = params[params.length - 1];
      const staff = inMemoryStore.staff_roster.find(s => s.id === targetParam || s.email === targetParam);
      if (staff) {
        if (normalized.includes("status = 'on-shift'")) staff.status = 'on-shift';
        if (normalized.includes("status = 'available'")) staff.status = 'available';
        if (normalized.includes("status = 'off-duty'")) staff.status = 'off-duty';
        if (normalized.includes("status = 'pending_verification'")) staff.status = 'pending_verification';
        if (normalized.includes("credential_status = 'verified'")) staff.credential_status = 'verified';
        if (normalized.includes("credential_status = 'pending'")) staff.credential_status = 'pending';
        if (normalized.includes('shifts_completed')) staff.shifts_completed = (Number(staff.shifts_completed) || 0) + 1;
        staff.updated_at = new Date().toISOString();
      }
      return [{ affectedRows: staff ? 1 : 0 }];
    }
    if (normalized.startsWith('delete')) {
      if (params.length > 0) {
        inMemoryStore.staff_roster = inMemoryStore.staff_roster.filter(s => s.id !== params[0] && s.email !== params[0]);
      } else {
        inMemoryStore.staff_roster = [];
      }
      return [{ affectedRows: 1 }];
    }
  }

  // 6. STAFFING_REQUESTS
  if (normalized.includes('staffing_requests')) {
    if (normalized.startsWith('select')) {
      if (normalized.includes('where id = ? or request_code = ?') || normalized.includes('id = ? or request_code = ?') || normalized.includes('where (id = ?') || normalized.includes('where id = ?')) {
        const targetId = params[0];
        const altId = params[1] || targetId;
        return [inMemoryStore.staffing_requests.filter(r => r.id === targetId || r.request_code === targetId || r.id === altId || r.request_code === altId)];
      }
      if (normalized.includes('contact_email')) {
        const email = (params[0] || '').toLowerCase().trim();
        return [inMemoryStore.staffing_requests.filter(r => (r.contact_email || '').toLowerCase() === email)];
      }
      if (normalized.includes('assigned_staff_id = ?') || normalized.includes('assigned_staff_id in')) {
        const staffId = params[0];
        const staffEmail = (params[1] || '').toLowerCase().trim();
        const rosterMatch = inMemoryStore.staff_roster.find(s => s.id === staffId || s.staff_code === staffId || (staffEmail && s.email && s.email.toLowerCase() === staffEmail));
        const validIds = new Set([staffId]);
        const validEmails = new Set();
        if (staffEmail) validEmails.add(staffEmail);
        if (rosterMatch) {
          validIds.add(rosterMatch.id);
          if (rosterMatch.staff_code) validIds.add(rosterMatch.staff_code);
          if (rosterMatch.email) validEmails.add(rosterMatch.email.toLowerCase());
        }

        const matched = inMemoryStore.staffing_requests.filter(r => {
          const idMatch = (r.assigned_staff_id && validIds.has(r.assigned_staff_id)) || 
                          (r.assigned_staff_email && validEmails.has(r.assigned_staff_email.toLowerCase()));
          if (!idMatch) return false;
          if (normalized.includes("status in ('dispatched', 'in_session', 'confirmed')") || normalized.includes("r.status in ('dispatched', 'in_session', 'confirmed')")) {
            return ['dispatched', 'in_session', 'confirmed'].includes(r.status);
          }
          return true;
        });
        return [matched];
      }
      if (normalized.includes("status = 'pending'") || normalized.includes("r.status = 'pending'")) {
        return [inMemoryStore.staffing_requests.filter(r => 
          (r.status === 'pending' || (r.status === 'confirmed' && (!r.assigned_staff_id || r.assigned_staff_id === ''))) &&
          r.status !== 'dispatched' && r.status !== 'in_session' && r.status !== 'completed' && r.status !== 'cancelled'
        )];
      }
      if (normalized.includes("where r.status in ('pending', 'confirmed', 'dispatched')") || normalized.includes("where status in ('pending', 'confirmed', 'dispatched')")) {
        return [inMemoryStore.staffing_requests.filter(r => ['pending', 'confirmed', 'dispatched'].includes(r.status))];
      }
      return [inMemoryStore.staffing_requests];
    }
    if (normalized.startsWith('insert')) {
      const colMatch = sql.match(/insert\s+into\s+[`"]?staffing_requests[`"]?\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
      const newReq = {
        id: crypto.randomUUID(),
        request_code: 'REQ-' + Date.now().toString().slice(-4),
        facility_name: 'Partner Health Facility',
        unit_department: 'General Care',
        contact_name: 'Dispatch Coordinator',
        contact_email: 'dispatch@example.com',
        contact_phone: '416-555-0100',
        role_requested: 'RN',
        shift_type: 'Day Shift',
        start_date: new Date().toISOString().slice(0, 10),
        urgency_level: 'routine',
        status: 'pending',
        assigned_staff_id: null,
        assigned_staff_email: null,
        staff_name: null,
        clock_in_time: null,
        clock_out_time: null,
        special_instructions: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (colMatch) {
        const cols = colMatch[1].split(',').map(c => c.trim().replace(/[`"']/g, ''));
        const valDefs = colMatch[2].split(',').map(v => v.trim());
        let paramIdx = 0;
        cols.forEach((col, idx) => {
          const valDef = valDefs[idx];
          if (valDef === '?') {
            if (params[paramIdx] !== undefined) {
              newReq[col] = params[paramIdx];
            }
            paramIdx++;
          } else if (valDef) {
            newReq[col] = valDef.replace(/^['"]|['"]$/g, '');
          }
        });
      } else {
        newReq.id = params[0] || newReq.id;
        newReq.request_code = params[1] || newReq.request_code;
      }

      if (newReq.assigned_staff_id) {
        const staff = inMemoryStore.staff_roster.find(s => s.id === newReq.assigned_staff_id || s.staff_code === newReq.assigned_staff_id || s.email === newReq.assigned_staff_id);
        if (staff) {
          newReq.staff_name = staff.name;
          newReq.assigned_staff_email = staff.email;
        }
      }

      inMemoryStore.staffing_requests.push(newReq);
      return [{ affectedRows: 1, insertId: newReq.id }];
    }
    if (normalized.startsWith('update')) {
      const targetId = params[params.length - 1];
      const reqItem = inMemoryStore.staffing_requests.find(r => r.id === targetId || r.request_code === targetId);
      if (reqItem) {
        if (normalized.includes('assigned_staff_id = ?')) {
          reqItem.assigned_staff_id = params[0];
          const staff = inMemoryStore.staff_roster.find(s => s.id === params[0] || s.staff_code === params[0] || s.email === params[0]);
          if (staff) {
            reqItem.staff_name = staff.name;
            reqItem.assigned_staff_email = staff.email;
          }
        }
        if (normalized.includes("status = 'dispatched'")) {
          reqItem.status = 'dispatched';
        }
        if (normalized.includes("status = 'in_session'")) {
          reqItem.status = 'in_session';
          reqItem.clock_in_time = new Date().toISOString();
        } else if (normalized.includes("status = 'completed'")) {
          reqItem.status = 'completed';
          reqItem.clock_out_time = new Date().toISOString();
        } else if (normalized.includes("status = 'cancelled'")) {
          reqItem.status = 'cancelled';
          reqItem.cancelled_at = new Date().toISOString();
          reqItem.cancellation_reason = params[0] || 'Cancelled by client';
        } else if (normalized.includes('status = ?')) {
          reqItem.status = params[0];
          if (params.length > 2 && params[1]) {
            reqItem.assigned_staff_id = params[1];
            const staff = inMemoryStore.staff_roster.find(s => s.id === params[1] || s.staff_code === params[1] || s.email === params[1]);
            if (staff) {
              reqItem.staff_name = staff.name;
              reqItem.assigned_staff_email = staff.email;
            }
          }
        }
        if (normalized.includes('client_rating = ?')) {
          reqItem.client_rating = params[0];
          reqItem.client_feedback = params[1] || null;
          reqItem.client_rated_at = new Date().toISOString();
        }
        reqItem.updated_at = new Date().toISOString();
      }
      return [{ affectedRows: reqItem ? 1 : 0 }];
    }
    if (normalized.startsWith('delete')) {
      inMemoryStore.staffing_requests = [];
      return [{ affectedRows: 0 }];
    }
  }

  // 7. JOB_APPLICATIONS
  if (normalized.includes('job_applications')) {
    if (normalized.startsWith('select')) return [inMemoryStore.job_applications];
    if (normalized.startsWith('insert')) {
      inMemoryStore.job_applications.push({
        id: params[0] || crypto.randomUUID(),
        application_code: params[1] || 'APP-100',
        full_name: params[2] || 'Applicant',
        role_applied: params[3] || 'RN',
        email: params[4] || '',
        phone: params[5] || '',
        license_registration: params[6] || '',
        stage: 'new',
        resume_original_name: params[7] || '',
        resume_stored_name: params[8] || '',
        resume_mime_type: params[9] || '',
        resume_file_size: params[10] || 0,
        resume_storage_path: params[11] || '',
        ip_address: params[12] || '',
        created_at: new Date().toISOString()
      });
      return [{ affectedRows: 1, insertId: params[0] }];
    }
    if (normalized.startsWith('delete')) {
      inMemoryStore.job_applications = [];
      return [{ affectedRows: 0 }];
    }
  }

  // 8. CONTACT_INQUIRIES
  if (normalized.includes('contact_inquiries')) {
    if (normalized.startsWith('select')) return [inMemoryStore.contact_inquiries];
    if (normalized.startsWith('insert')) {
      inMemoryStore.contact_inquiries.push({ id: params[0] || crypto.randomUUID(), name: params[2] || 'Inquiry', created_at: new Date().toISOString() });
      return [{ affectedRows: 1 }];
    }
    if (normalized.startsWith('delete')) {
      inMemoryStore.contact_inquiries = [];
      return [{ affectedRows: 0 }];
    }
  }

  // 9. AUDIT_LOGS
  if (normalized.includes('audit_logs')) {
    if (normalized.startsWith('select')) {
      return [inMemoryStore.audit_logs.map(log => ({
        id: log.id,
        admin_id: log.admin_id || null,
        actor_name: log.actor_name || 'System Operator',
        action: log.action || 'SECURITY_EVENT',
        target_entity: log.target_entity || 'System',
        target_id: log.target_id || null,
        details: log.details || 'System operation executed successfully',
        severity: log.severity || 'info',
        ip_address: log.ip_address || '127.0.0.1',
        created_at: log.created_at || new Date().toISOString()
      }))];
    }
    if (normalized.startsWith('insert')) {
      const newLog = {
        id: params[0] || crypto.randomUUID(),
        admin_id: params[1] || null,
        actor_name: params[2] || 'System Operator',
        action: params[3] || 'ACTION',
        target_entity: params[4] || 'System',
        target_id: params[5] || null,
        details: params[6] || 'System operation recorded',
        severity: params[7] || 'info',
        ip_address: params[8] || '127.0.0.1',
        created_at: new Date().toISOString()
      };
      inMemoryStore.audit_logs.unshift(newLog);
      return [{ affectedRows: 1 }];
    }
    if (normalized.startsWith('delete')) {
      inMemoryStore.audit_logs = [];
      return [{ affectedRows: 0 }];
    }
  }

  // 10. STAFF_DOCUMENTS
  if (normalized.includes('staff_documents')) {
    if (normalized.startsWith('select')) {
      if (params.length > 0) {
        return [inMemoryStore.staff_documents.filter(d => params.includes(d.staff_id) || params.includes(d.id))];
      }
      return [inMemoryStore.staff_documents];
    }
    if (normalized.startsWith('insert')) {
      const newDoc = {
        id: params[0] || crypto.randomUUID(),
        staff_id: params[1],
        doc_type: params[2] || 'other',
        title: params[3],
        file_path: params[4],
        file_name: params[5],
        file_size: params[6] || 0,
        mime_type: params[7] || 'application/pdf',
        expiry_date: params[8] || null,
        uploaded_by: params[9] || 'Admin',
        created_at: new Date().toISOString()
      };
      inMemoryStore.staff_documents.push(newDoc);
      return [{ affectedRows: 1, insertId: 1 }];
    }
    if (normalized.startsWith('delete')) {
      inMemoryStore.staff_documents = inMemoryStore.staff_documents.filter(d => d.id !== params[0]);
      return [{ affectedRows: 1 }];
    }
  }

  // 11. NEWSLETTER_SUBSCRIBERS
  if (normalized.includes('newsletter_subscribers')) {
    if (normalized.startsWith('select')) {
      if (params.length > 0) {
        return [inMemoryStore.newsletter_subscribers.filter(s => s.email === params[0] || s.id === params[0])];
      }
      return [inMemoryStore.newsletter_subscribers];
    }
    if (normalized.startsWith('insert')) {
      const existing = inMemoryStore.newsletter_subscribers.find(s => s.email === params[1]);
      if (existing) {
        existing.status = 'active';
        return [{ affectedRows: 1 }];
      }
      const newSub = {
        id: params[0] || crypto.randomUUID(),
        email: params[1],
        status: params[2] || 'active',
        source: params[3] || 'homepage_strip',
        ip_address: params[4] || null,
        created_at: new Date().toISOString()
      };
      inMemoryStore.newsletter_subscribers.push(newSub);
      return [{ affectedRows: 1, insertId: 1 }];
    }
    if (normalized.startsWith('delete')) {
      inMemoryStore.newsletter_subscribers = inMemoryStore.newsletter_subscribers.filter(s => s.id !== params[0] && s.email !== params[0]);
      return [{ affectedRows: 1 }];
    }
  }

  // 12. USERS
  if (normalized.includes('users') || normalized.includes('`users`')) {
    if (normalized.startsWith('select')) {
      // Handle registered-clients join query
      if (normalized.includes('facilities f') || normalized.includes('linked_facility_name')) {
        const facs = inMemoryStore.facilities || [];
        const clientUsers = (inMemoryStore.users || []).filter(u => u.role === 'client');
        
        // Map from facilities first so EVERY registered facility is guaranteed to appear
        const facList = facs.map(f => {
          const matchedUser = clientUsers.find(u => 
            (u.facility_id && u.facility_id === f.id) ||
            (u.organization_name && f.name && u.organization_name.toLowerCase().trim() === f.name.toLowerCase().trim()) ||
            (u.email && f.contact_email && u.email.toLowerCase() === f.contact_email.toLowerCase())
          );
          const reqCount = (inMemoryStore.staffing_requests || []).filter(sr => 
            sr.facility_id === f.id || 
            (sr.facility_name && f.name && sr.facility_name.toLowerCase().trim() === f.name.toLowerCase().trim()) || 
            (matchedUser && sr.contact_email && sr.contact_email.toLowerCase() === matchedUser.email.toLowerCase())
          ).length;

          return {
            id: matchedUser ? matchedUser.id : f.id,
            email: matchedUser ? matchedUser.email : (f.contact_email || 'client@hospital.ca'),
            full_name: matchedUser ? matchedUser.full_name : (f.contact_name || 'Facility Administrator'),
            organization_name: f.name || (matchedUser ? matchedUser.organization_name : 'Healthcare Facility'),
            facility_id: f.id,
            client_role: matchedUser ? (matchedUser.client_role || 'Staffing Requester') : 'Facility Coordinator',
            phone: matchedUser ? (matchedUser.phone || f.contact_phone) : (f.contact_phone || '—'),
            is_active: matchedUser ? Number(matchedUser.is_active) : 1,
            email_verified: matchedUser ? Number(matchedUser.email_verified) : 1,
            last_login: matchedUser ? matchedUser.last_login : null,
            created_at: matchedUser ? matchedUser.created_at : f.created_at,
            facility_code: f.facility_code || 'FAC',
            linked_facility_name: f.name,
            facility_status: f.status || 'pending',
            total_requests_count: reqCount
          };
        });

        const standaloneClients = clientUsers.filter(u => 
          !facs.some(f => 
            (u.facility_id && u.facility_id === f.id) ||
            (u.organization_name && f.name && u.organization_name.toLowerCase().trim() === f.name.toLowerCase().trim())
          )
        ).map(u => ({
          ...u,
          facility_code: 'FAC',
          linked_facility_name: u.organization_name || 'Individual Facility',
          facility_status: 'pending',
          total_requests_count: 0
        }));

        return [[...facList, ...standaloneClients]];
      }
      if (normalized.includes('where (id = ? or email = ?)') || normalized.includes('where id = ? or email = ?') || normalized.includes('where lower(email) = ? or id = ?') || normalized.includes('where email = ? or id = ?') || normalized.includes('where id = ? or lower(email) = lower(?)') || normalized.includes('where id = ? or lower(email) = ?')) {
        const p0 = String(params[0] || '').toLowerCase().trim();
        const p1 = String(params[1] || p0).toLowerCase().trim();
        const found = inMemoryStore.users.filter(u => 
          (u.id === params[0] || u.id === params[1] || u.email.toLowerCase() === p0 || u.email.toLowerCase() === p1) &&
          !_adminEmailSet.has(u.email.toLowerCase())
        );
        return [found];
      }
      if (normalized.includes('where email = ?') || normalized.includes('where lower(email) = ?')) {
        const emailParam = (params[0] || '').toLowerCase().trim();
        // Guard: never return a user row for an admin email address
        if (_adminEmailSet.has(emailParam)) return [[]];
        const found = inMemoryStore.users.filter(u => u.email.toLowerCase() === emailParam);
        return [found];
      }
      if (normalized.includes('where id = ?')) {
        const idParam = params[0];
        const found = inMemoryStore.users.filter(u => u.id === idParam && !_adminEmailSet.has(u.email.toLowerCase()));
        return [found];
      }
      return [inMemoryStore.users.filter(u => !_adminEmailSet.has(u.email.toLowerCase()))];
    }
    if (normalized.startsWith('insert')) {
      const colMatch = sql.match(/insert\s+into\s+[`"]?users[`"]?\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
      const newUser = {
        id: crypto.randomUUID(),
        email: '',
        password_hash: '',
        full_name: 'Portal User',
        role: 'client',
        organization_name: null,
        phone: null,
        facility_id: null,
        client_role: 'requester',
        is_active: 1,
        email_verified: 1,
        last_login: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (colMatch) {
        const cols = colMatch[1].split(',').map(c => c.trim().replace(/[`"']/g, '').toLowerCase());
        const rawVals = colMatch[2].split(',').map(v => v.trim());
        let pIdx = 0;
        for (let i = 0; i < cols.length; i++) {
          const col = cols[i];
          const rawVal = rawVals[i];
          if (rawVal === '?') {
            newUser[col] = params[pIdx++];
          } else if (/^['"].*['"]$/.test(rawVal)) {
            newUser[col] = rawVal.slice(1, -1);
          } else if (/^\d+$/.test(rawVal)) {
            newUser[col] = parseInt(rawVal, 10);
          } else {
            newUser[col] = rawVal;
          }
        }
      } else {
        newUser.id = params[0] || newUser.id;
        newUser.email = (params[1] || '').toLowerCase().trim();
        newUser.password_hash = params[2];
        newUser.full_name = params[3];
        newUser.role = params[4] || 'client';
      }

      if (newUser.email) newUser.email = newUser.email.toLowerCase().trim();

      const existingIdx = inMemoryStore.users.findIndex(u => 
        (newUser.id && u.id === newUser.id) || 
        (newUser.email && u.email && u.email.toLowerCase() === newUser.email)
      );

      if (existingIdx >= 0) {
        Object.assign(inMemoryStore.users[existingIdx], newUser, { updated_at: new Date().toISOString() });
      } else {
        inMemoryStore.users.push(newUser);
      }

      // Auto-mirror healthcare_worker into staff_roster
      if (newUser.role === 'healthcare_worker' && inMemoryStore.staff_roster) {
        if (!inMemoryStore.staff_roster.some(s => s.id === newUser.id || (s.email && s.email.toLowerCase() === newUser.email))) {
          inMemoryStore.staff_roster.push({
            id: newUser.id,
            staff_code: 'STF-' + String(inMemoryStore.staff_roster.length + 1).padStart(3, '0'),
            name: newUser.full_name || 'Staff Member',
            role: 'RN',
            specialty: 'General Care',
            region: 'Greater Toronto Area',
            phone: newUser.phone || null,
            email: newUser.email,
            status: 'available',
            credential_status: 'pending',
            rating: 5.00,
            shifts_completed: 0,
            hourly_rate: 35.00,
            cpr_expiry_date: '2027-12-31',
            vss_status: 'Clear',
            n95_fit_test: '3M Valid',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }

      return [{ affectedRows: 1, insertId: newUser.id }];
    }
    if (normalized.startsWith('update')) {
      if (normalized.includes('email_verification_token = ?')) {
        const targetId = String(params[params.length - 1] || '').toLowerCase().trim();
        const user = inMemoryStore.users.find(u => u.id === params[params.length - 1] || (u.email && u.email.toLowerCase() === targetId));
        if (user) {
          user.email_verification_token = params[0];
          const exp = (params.length > 2 && params[1]) ? params[1] : null;
          user.email_verification_expires = exp ? (exp instanceof Date ? exp.toISOString() : String(exp)) : new Date(Date.now() + 15 * 60 * 1000).toISOString();
        }
        return [{ affectedRows: 1, changedRows: 1 }];
      }
      if (normalized.includes('email_verified = 1')) {
        const targetId = params[params.length - 1];
        const user = inMemoryStore.users.find(u => u.id === targetId || u.email === targetId);
        if (user) {
          user.email_verified = 1;
          user.email_verification_token = null;
          user.email_verification_expires = null;
          user.last_login = new Date().toISOString();
        }
        return [{ affectedRows: 1, changedRows: 1 }];
      }
      if (normalized.includes('password_hash = ?')) {
        const newHash = params[0];
        const whereParams = params.slice(1).map(p => String(p || '').toLowerCase().trim());
        inMemoryStore.users.forEach(u => {
          if (whereParams.includes(u.id) || whereParams.includes(u.email.toLowerCase())) {
            u.password_hash = newHash;
            u.is_active = 1;
          }
        });
        return [{ affectedRows: 1 }];
      }
      if (normalized.includes('last_login = now()') && normalized.includes('where id = ?')) {
        const idParam = params[params.length - 1];
        const user = inMemoryStore.users.find(u => u.id === idParam);
        if (user) user.last_login = new Date().toISOString();
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 1 }];
    }
  }

  // 13. SHIFT_PUNCHES
  if (normalized.includes('shift_punches') || normalized.includes('`shift_punches`')) {
    if (normalized.startsWith('select')) {
      if (normalized.includes('sum(total_hours)')) {
        const staffId = params[0] || '';
        const email = params[1] || '';
        const punches = (inMemoryStore.shift_punches || []).filter(p => (p.staff_id === staffId || p.staff_email === email) && p.status === 'completed');
        const sum = punches.reduce((acc, p) => acc + (parseFloat(p.total_hours) || 0), 0);
        return [[{ total_weekly_hours: sum }]];
      }
      if (normalized.includes("status = 'active'")) {
        const staffIdParam = params[0] || '';
        const emailParam = params[1] || '';
        const active = (inMemoryStore.shift_punches || []).filter(p => (p.staff_id === staffIdParam || p.staff_email === emailParam) && p.status === 'active');
        return [active];
      }
      if (normalized.includes('staff_id') || normalized.includes('staff_email')) {
        const staffIdParam = params[0] || '';
        const emailParam = params[1] || '';
        const list = (inMemoryStore.shift_punches || []).filter(p => p.staff_id === staffIdParam || p.staff_email === emailParam);
        return [list.map(p => ({ ...p, duration_hours: p.total_hours }))];
      }
      return [(inMemoryStore.shift_punches || []).map(p => ({ ...p, duration_hours: p.total_hours }))];
    }
    if (normalized.startsWith('insert')) {
      const punch = {
        id: params[0] || crypto.randomUUID(),
        staff_id: params[1],
        staff_name: params[2],
        staff_email: params[3],
        shift_id: params[4] || null,
        facility_name: params[5],
        unit_department: params[6] || 'General Floor',
        role: params[7] || 'RN',
        clock_in_time: new Date().toISOString(),
        clock_out_time: null,
        total_hours: 0,
        notes: params[8] || null,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (!inMemoryStore.shift_punches) inMemoryStore.shift_punches = [];
      inMemoryStore.shift_punches.unshift(punch);
      return [{ affectedRows: 1, insertId: punch.id }];
    }
    if (normalized.startsWith('update')) {
      if (params.length > 0) {
        const targetId = params[params.length - 1];
        const punch = (inMemoryStore.shift_punches || []).find(p => p.id === targetId);
        if (punch) {
          punch.status = 'completed';
          punch.clock_out_time = new Date().toISOString();
          punch.total_hours = params[0] || 0;
          punch.duration_hours = punch.total_hours;
          punch.notes = params[1] || punch.notes;
          punch.updated_at = new Date().toISOString();
        }
      }
      return [{ affectedRows: 1 }];
    }
    if (normalized.startsWith('delete')) {
      inMemoryStore.shift_punches = [];
      return [{ affectedRows: 1 }];
    }
  }

  // 10. FACILITIES
  if (normalized.includes('from facilities') || normalized.includes('from `facilities`') || normalized.includes('into facilities') || normalized.includes('update facilities') || normalized.includes('update `facilities`')) {
    if (normalized.startsWith('select')) {
      if (normalized.includes('count(*) as total') || normalized.includes('count(*)')) {
        const total = (inMemoryStore.facilities || []).length;
        const pending = (inMemoryStore.facilities || []).filter(f => f.status === 'pending').length;
        const active = (inMemoryStore.facilities || []).filter(f => f.status === 'active').length;
        return [[{ total_facilities: total, pending_facilities: pending, active_facilities: active, total, count: total }]];
      }
      if (normalized.includes('where id = ?') || normalized.includes('where lower(trim(name)) = lower(trim(?))')) {
        const p0 = String(params[0] || '').toLowerCase().trim();
        const found = (inMemoryStore.facilities || []).filter(f => f.id === params[0] || (f.name && f.name.toLowerCase().trim() === p0));
        return [found];
      }

      // Return enriched facilities
      const today = new Date();
      const enriched = (inMemoryStore.facilities || []).map(fac => {
        const rateCards = (inMemoryStore.facility_rate_cards || []).filter(rc => rc.facility_id === fac.id);
        const users = (inMemoryStore.users || []).filter(u => u.facility_id === fac.id || (u.organization_name && fac.name && u.organization_name.toLowerCase().trim() === fac.name.toLowerCase().trim()));
        const requests = (inMemoryStore.staffing_requests || []).filter(r => r.facility_id === fac.id || (r.facility_name && fac.name && r.facility_name.toLowerCase().trim() === fac.name.toLowerCase().trim()));

        let isExpired = fac.status === 'expired';
        let isExpiringSoon = false;
        let daysUntilExpiry = null;
        if (fac.msa_expiry_date) {
          const expDate = new Date(fac.msa_expiry_date);
          const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
          daysUntilExpiry = diffDays;
          if (diffDays <= 0) isExpired = true;
          else if (diffDays <= 30) isExpiringSoon = true;
        }

        return {
          ...fac,
          effective_status: isExpired ? 'expired' : (fac.status || 'pending'),
          is_expiring_soon: isExpiringSoon,
          days_until_expiry: daysUntilExpiry,
          active_rate_cards_count: rateCards.length,
          total_rate_cards_count: rateCards.length,
          has_portal_account: users.length > 0,
          registered_user_emails: users.map(u => u.email).join(', '),
          registered_users_count: users.length,
          latest_user_registered_at: users.length > 0 ? users[users.length - 1].created_at : null,
          total_shifts_requested: requests.length
        };
      });

      return [enriched];
    }

    if (normalized.startsWith('insert')) {
      const colMatch = sql.match(/insert\s+into\s+[`"]?facilities[`"]?\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
      const newFac = {
        id: crypto.randomUUID(),
        name: 'New Healthcare Facility',
        facility_code: 'FAC-' + Date.now().toString().slice(-4),
        address: null,
        region: 'Greater Toronto Area',
        contact_name: null,
        contact_email: null,
        contact_phone: null,
        msa_signed_date: null,
        msa_expiry_date: null,
        msa_document_url: null,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (colMatch) {
        const cols = colMatch[1].split(',').map(c => c.trim().replace(/[`"']/g, '').toLowerCase());
        const rawVals = colMatch[2].split(',').map(v => v.trim());
        let pIdx = 0;
        for (let i = 0; i < cols.length; i++) {
          const col = cols[i];
          const rawVal = rawVals[i];
          if (rawVal === '?') {
            newFac[col] = params[pIdx++];
          } else if (/^['"].*['"]$/.test(rawVal)) {
            newFac[col] = rawVal.slice(1, -1);
          } else if (/^\d+$/.test(rawVal)) {
            newFac[col] = parseInt(rawVal, 10);
          } else if (rawVal.toLowerCase() === 'now()') {
            newFac[col] = new Date().toISOString();
          } else {
            newFac[col] = rawVal;
          }
        }
      } else {
        newFac.id = params[0] || newFac.id;
        newFac.name = params[1] || newFac.name;
        newFac.facility_code = params[2] || newFac.facility_code;
      }

      inMemoryStore.facilities = inMemoryStore.facilities || [];
      inMemoryStore.facilities.unshift(newFac);
      return [{ affectedRows: 1, insertId: newFac.id }];
    }

    if (normalized.startsWith('update')) {
      const idParam = params[params.length - 1];
      const fac = (inMemoryStore.facilities || []).find(f => f.id === idParam);
      if (fac) {
        if (normalized.includes('status = ?')) fac.status = params[0];
        if (normalized.includes('address = ?')) fac.address = params[1] || fac.address;
        fac.updated_at = new Date().toISOString();
      }
      return [{ affectedRows: 1, changedRows: 1 }];
    }
  }

  // 11. FACILITY RATE CARDS
  if (normalized.includes('from facility_rate_cards') || normalized.includes('from `facility_rate_cards`') || normalized.includes('into facility_rate_cards')) {
    if (normalized.startsWith('select')) {
      let cards = inMemoryStore.facility_rate_cards || [];
      if (normalized.includes('facility_id = ?') && params && params[0]) {
        cards = cards.filter(c => c.facility_id === params[0]);
      }
      return [cards.map(c => ({
        ...c,
        is_active: (!c.expiry_date || new Date(c.expiry_date) >= new Date()) ? 1 : 0
      }))];
    }
    if (normalized.startsWith('insert')) {
      const card = {
        id: params[0] || crypto.randomUUID(),
        facility_id: params[1],
        role: params[2],
        shift_type: params[3] || 'standard',
        bill_rate: params[4],
        pay_rate: params[5] || null,
        overtime_multiplier: params[6] || 1.5,
        effective_date: params[7] || new Date().toISOString().slice(0, 10),
        expiry_date: params[8] || null,
        created_by: params[9] || null,
        created_at: new Date().toISOString()
      };
      inMemoryStore.facility_rate_cards.push(card);
      return [{ affectedRows: 1, insertId: card.id }];
    }
  }

  // Default fallback
  return [[]];
}

// ── Unified Database Pool Export ──────────────────────────────────────────────
const isProd = process.env.NODE_ENV === 'production';

const pool = {
  async query(sql, params = []) {
    if (isProd) {
      if (!realPool) {
        throw new Error('Database pool uninitialized in production.');
      }
      // Never fall back to in-memory store in production (fail closed)
      return await realPool.query(sql, params);
    }

    if (realPool) {
      try {
        return await realPool.query(sql, params);
      } catch (err) {
        if (!err.message.includes('Pool is closed')) {
          console.warn(`⚠️ [Database] MySQL query failed (${err.message}). Using In-Memory fallback (DEV ONLY).`);
        }
        return handleInMemoryQuery(sql, params);
      }
    }
    return handleInMemoryQuery(sql, params);
  },
  async execute(sql, params = []) {
    return this.query(sql, params);
  },
  async getConnection() {
    if (isProd) {
      if (!realPool) {
        throw new Error('Database pool uninitialized in production.');
      }
      return await realPool.getConnection();
    }

    if (realPool) {
      try {
        return await realPool.getConnection();
      } catch (err) {
        return {
          async query(sql, params) { return pool.query(sql, params); },
          async execute(sql, params) { return pool.query(sql, params); },
          async beginTransaction() {},
          async commit() {},
          async rollback() {},
          release() {}
        };
      }
    }
    return {
      async query(sql, params) { return handleInMemoryQuery(sql, params); },
      async execute(sql, params) { return handleInMemoryQuery(sql, params); },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
      release() {}
    };
  },
  isMySqlAvailable() {
    return isMySqlAvailable || Boolean(realPool);
  },
  async end() {
    if (realPool) {
      await realPool.end();
      realPool = null;
    }
  },
  inMemoryStore
};

module.exports = pool;
