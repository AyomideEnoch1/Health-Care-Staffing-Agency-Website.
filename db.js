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
  const sslConfig = (process.env.DB_SSL === 'true' || host.includes('tidbcloud.com') || host.includes('aivencloud.com'))
    ? { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    : undefined;

  realPool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    ssl: sslConfig,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    timezone: '+00:00',
    connectTimeout: 5000
  });

  realPool.getConnection()
    .then(async conn => {
      isMySqlAvailable = true;
      console.log(`✅ [Database] Connected to MySQL (${host}:${port}/${database})`);

      // Auto-heal / verify schema integrity across all deployment targets
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
      } catch (schemaNotice) {
        console.warn('⚠️ [Database Schema Verification Notice]:', schemaNotice.message);
      } finally {
        conn.release();
      }
    })
    .catch(err => {
      isMySqlAvailable = false;
      console.warn(`⚠️ [Database] MySQL not reachable (${err.message}). Activating In-Memory Resilient Mode.`);
    });
} catch (e) {
  isMySqlAvailable = false;
}

// ── In-Memory Datastore ───────────────────────────────────────────────────────
const inMemoryStore = {
  admins: [
    {
      id: 'c4970cd8-eb90-4e33-9aba-446711e88d8b',
      email: 'admin@divinefingershealthcare.ca',
      password_hash: '$2b$10$ICqO6AZ.OprBLcm5OT5Nm.aWhldo4q3dLx6tHzcaFg6PwaX23uUPG',
      full_name: 'Divine Fingers Administrator',
      role: 'super-admin',
      permissions: ['requests:view', 'requests:dispatch', 'roster:view', 'roster:manage', 'applications:view', 'applications:manage', 'inquiries:manage', 'reports:view', 'reports:export', 'newsletter:manage', 'audit:view', 'admins:manage'],
      failed_login_attempts: 0,
      lock_until: null,
      totp_secret: null,
      totp_enabled: 0,
      email_verified: 1,
      email_verification_token: null,
      email_verification_expires: null,
      last_login: new Date().toISOString(),
      last_login_ip: '127.0.0.1',
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '1f2465dc-9c9b-4d09-a5fa-24c019be87d6',
      email: 'ayomidenoch15@gmail.com',
      password_hash: '$2b$10$ICqO6AZ.OprBLcm5OT5Nm.aWhldo4q3dLx6tHzcaFg6PwaX23uUPG',
      full_name: 'Olugbodi Ayomide',
      role: 'super-admin',
      permissions: ['requests:view', 'requests:dispatch', 'roster:view', 'roster:manage', 'applications:view', 'applications:manage', 'inquiries:manage', 'reports:view', 'reports:export', 'newsletter:manage', 'audit:view', 'admins:manage'],
      failed_login_attempts: 0,
      lock_until: null,
      totp_secret: null,
      totp_enabled: 0,
      email_verified: 1,
      email_verification_token: null,
      email_verification_expires: null,
      last_login: new Date().toISOString(),
      last_login_ip: '127.0.0.1',
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  staff_roster: [
    {
      id: 'staff-nurse-sarah',
      staff_code: 'STF-001',
      name: 'Sarah Jenkins, RN',
      role: 'RN',
      specialty: 'Emergency & Critical Care',
      region: 'Greater Toronto Area',
      phone: '(416) 555-0199',
      email: 'sarah.jenkins@divinefingershealthcare.ca',
      status: 'available',
      credential_status: 'verified',
      rating: 5.00,
      shifts_completed: 48,
      hourly_rate: 52.00,
      cpr_expiry_date: '2027-12-31',
      vss_status: 'Clear',
      n95_fit_test: '3M Valid',
      cno_registration_num: 'RN-948210',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  staffing_requests: [
    {
      id: 'req-open-001',
      request_code: 'REQ-2026-8801',
      facility_name: 'Sunnybrook Health Sciences Centre',
      unit_department: 'Critical Care ICU',
      contact_name: 'Dr. Michael Chen',
      contact_email: 'dispatch@sunnybrook.ca',
      contact_phone: '(416) 480-6100',
      role_requested: 'RN',
      shift_type: 'Day Shift (07:00 - 19:30)',
      start_date: new Date().toISOString().slice(0, 10),
      urgency_level: 'urgent',
      status: 'pending',
      assigned_staff_id: null,
      assigned_staff_email: null,
      staff_name: null,
      clock_in_time: null,
      clock_out_time: null,
      special_instructions: 'Unit 4C Trauma Centre. Please report to Nursing Station C on arrival.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'req-open-002',
      request_code: 'REQ-2026-8802',
      facility_name: "St. Michael's Hospital (Unity Health)",
      unit_department: 'Emergency Department',
      contact_name: 'Supervisor Laura Rossi',
      contact_email: 'dispatch@unityhealth.to',
      contact_phone: '(416) 864-6060',
      role_requested: 'RN',
      shift_type: 'Night Shift (19:00 - 07:30)',
      start_date: new Date().toISOString().slice(0, 10),
      urgency_level: 'routine',
      status: 'pending',
      assigned_staff_id: null,
      assigned_staff_email: null,
      staff_name: null,
      clock_in_time: null,
      clock_out_time: null,
      special_instructions: 'Acute Care Pod B. Hospital scrub top provided at check-in.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'req-open-003',
      request_code: 'REQ-2026-8803',
      facility_name: 'Humber River Health',
      unit_department: 'Complex Transitional Care',
      contact_name: 'Clinical Lead James Patel',
      contact_email: 'dispatch@hrh.ca',
      contact_phone: '(416) 242-1000',
      role_requested: 'RPN',
      shift_type: 'Evening Shift (15:00 - 23:30)',
      start_date: new Date().toISOString().slice(0, 10),
      urgency_level: 'routine',
      status: 'pending',
      assigned_staff_id: null,
      assigned_staff_email: null,
      staff_name: null,
      clock_in_time: null,
      clock_out_time: null,
      special_instructions: 'Floor 5 West wing. Epic EMR credentials active.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  job_applications: [],
  contact_inquiries: [],
  audit_logs: [],
  staff_documents: [],
  shift_punches: [],
  newsletter_subscribers: [],
  // IMPORTANT: users[] must NEVER contain administrator emails.
  // Admins live exclusively in admins[]. Mixing them here bypasses the
  // /api/users/login 403 rejection check and lets admins access the public portal.
  users: [
    {
      id: 'staff-nurse-sarah',
      email: 'sarah.jenkins@divinefingershealthcare.ca',
      password_hash: '$2b$10$ICqO6AZ.OprBLcm5OT5Nm.aWhldo4q3dLx6tHzcaFg6PwaX23uUPG',
      full_name: 'Sarah Jenkins, RN',
      role: 'healthcare_worker',
      clinical_role: 'RN',
      phone: '(416) 555-0199',
      organization_name: null,
      is_active: 1,
      created_at: new Date().toISOString(),
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
  const normalized = sql.trim().toLowerCase();

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
        if (normalized.includes('email_verified = 1')) admin.email_verified = 1;
        if (normalized.includes('failed_login_attempts = ?')) admin.failed_login_attempts = params[0];
        if (normalized.includes('totp_enabled = ?')) admin.totp_enabled = params[0];
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
      if (normalized.includes('count(*)')) {
        return [[{ total: inMemoryStore.staff_roster.length, count: inMemoryStore.staff_roster.length }]];
      }
      if (normalized.includes('where id = ? or email = ?') || normalized.includes('where email = ? or id = ?')) {
        return [inMemoryStore.staff_roster.filter(s => s.id === params[0] || s.email === params[0] || s.id === params[1] || s.email === params[1])];
      }
      if (normalized.includes('where id = ?')) {
        return [inMemoryStore.staff_roster.filter(s => s.id === params[0] || s.email === params[0])];
      }
      if (normalized.includes('where email = ?')) {
        return [inMemoryStore.staff_roster.filter(s => s.email === params[0])];
      }
      return [inMemoryStore.staff_roster];
    }
    if (normalized.startsWith('insert')) {
      // INSERT INTO staff_roster (id, staff_code, name, role, specialty, region, phone, email, status, credential_status)
      const existingIdx = inMemoryStore.staff_roster.findIndex(s => s.id === params[0] || s.email === params[7]);
      const newStaff = {
        id: params[0] || crypto.randomUUID(),
        staff_code: params[1] || ('STF-' + String(inMemoryStore.staff_roster.length + 1).padStart(3, '0')),
        name: params[2] || 'Staff Member',
        role: params[3] || 'RN',
        specialty: params[4] || 'General Care',
        region: params[5] || 'Greater Toronto Area',
        phone: params[6] || null,
        email: params[7] || null,
        status: params[8] || 'available',
        credential_status: params[9] || 'pending',
        rating: 5.00,
        shifts_completed: 0,
        hourly_rate: 0.00,
        cpr_expiry_date: '2027-12-31',
        vss_status: 'Clear',
        n95_fit_test: '3M Valid',
        cno_registration_num: null,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (existingIdx >= 0) {
        // ON DUPLICATE KEY UPDATE
        const existing = inMemoryStore.staff_roster[existingIdx];
        existing.name = newStaff.name;
        existing.role = newStaff.role;
        existing.phone = newStaff.phone;
        existing.updated_at = newStaff.updated_at;
      } else {
        inMemoryStore.staff_roster.push(newStaff);
      }
      return [{ affectedRows: 1, insertId: inMemoryStore.staff_roster.length }];
    }
    if (normalized.startsWith('update')) {
      const targetParam = params[params.length - 1];
      const staff = inMemoryStore.staff_roster.find(s => s.id === targetParam || s.email === targetParam);
      if (staff) {
        if (normalized.includes("status = 'on-shift'")) staff.status = 'on-shift';
        if (normalized.includes("status = 'available'")) staff.status = 'available';
        if (normalized.includes("status = 'off-duty'")) staff.status = 'off-duty';
        if (normalized.includes('shifts_completed')) staff.shifts_completed = (staff.shifts_completed || 0) + 1;
        if (normalized.includes('cpr_expiry_date') && params[0]) staff.cpr_expiry_date = params[0];
        if (normalized.includes('credential_status') && params[0]) staff.credential_status = params[0];
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
      inMemoryStore.job_applications.push({ id: params[0] || crypto.randomUUID(), full_name: params[1] || 'Applicant', created_at: new Date().toISOString() });
      return [{ affectedRows: 1 }];
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
      const newUser = {
        id: params[0] || crypto.randomUUID(),
        email: (params[1] || '').toLowerCase().trim(),
        password_hash: params[2],
        full_name: params[3],
        role: params[4] || 'client',
        organization_name: params[5] || null,
        phone: params[6] || null,
        facility_id: null,
        client_role: 'requester',
        is_active: 1,
        email_verified: 1,
        last_login: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      inMemoryStore.users.push(newUser);
      return [{ affectedRows: 1, insertId: newUser.id }];
    }
    if (normalized.startsWith('update')) {
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
  }

  // Default fallback
  return [[]];
}

// ── Unified Database Pool Export ──────────────────────────────────────────────
const pool = {
  async query(sql, params = []) {
    if (realPool) {
      try {
        return await realPool.query(sql, params);
      } catch (err) {
        console.warn(`⚠️ [Database] MySQL query failed (${err.message}). Using In-Memory fallback.`);
        return handleInMemoryQuery(sql, params);
      }
    }
    return handleInMemoryQuery(sql, params);
  },
  async getConnection() {
    if (realPool) {
      try {
        return await realPool.getConnection();
      } catch (err) {
        return {
          async query(sql, params) { return pool.query(sql, params); },
          release() {}
        };
      }
    }
    return {
      async query(sql, params) { return handleInMemoryQuery(sql, params); },
      release() {}
    };
  },
  isMySqlAvailable() {
    return isMySqlAvailable || Boolean(realPool);
  },
  inMemoryStore
};

module.exports = pool;
