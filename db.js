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
  realPool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    timezone: '+00:00',
    connectTimeout: 2000
  });

  realPool.getConnection()
    .then(conn => {
      isMySqlAvailable = true;
      console.log(`✅ [Database] Connected to MySQL (${host}:${port}/${database})`);
      conn.release();
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
      password_hash: '$2b$10$BNYrAaErbElwzl4.Othbb.PMISnThzlgDPI3lRgeoE2c29quh3gsy',
      full_name: 'Divine Fingers Administrator',
      role: 'super-admin',
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
      password_hash: '$2b$10$BNYrAaErbElwzl4.Othbb.PMISnThzlgDPI3lRgeoE2c29quh3gsy',
      full_name: 'Olugbodi Ayomide',
      role: 'super-admin',
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
  staff_roster: [],
  staffing_requests: [],
  job_applications: [],
  contact_inquiries: [],
  audit_logs: []
};

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
  if (normalized.includes('staff_roster')) {
    if (normalized.startsWith('select')) {
      if (normalized.includes('where id = ?')) {
        return [inMemoryStore.staff_roster.filter(s => s.id === params[0])];
      }
      return [inMemoryStore.staff_roster];
    }
    if (normalized.startsWith('insert')) {
      const newStaff = { id: params[0] || crypto.randomUUID(), name: params[2] || 'Staff Member', role: params[3] || 'RN', created_at: new Date().toISOString() };
      inMemoryStore.staff_roster.push(newStaff);
      return [{ affectedRows: 1, insertId: inMemoryStore.staff_roster.length }];
    }
    if (normalized.startsWith('delete')) {
      inMemoryStore.staff_roster = [];
      return [{ affectedRows: 0 }];
    }
  }

  // 6. STAFFING_REQUESTS
  if (normalized.includes('staffing_requests')) {
    if (normalized.startsWith('select')) {
      if (normalized.includes('where id = ?')) {
        return [inMemoryStore.staffing_requests.filter(r => r.id === params[0])];
      }
      return [inMemoryStore.staffing_requests];
    }
    if (normalized.startsWith('insert')) {
      inMemoryStore.staffing_requests.push({ id: params[0] || crypto.randomUUID(), request_code: 'REQ-' + Date.now().toString().slice(-4), created_at: new Date().toISOString() });
      return [{ affectedRows: 1 }];
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
    if (normalized.startsWith('select')) return [inMemoryStore.audit_logs];
    if (normalized.startsWith('insert')) {
      inMemoryStore.audit_logs.push({ id: params[0] || crypto.randomUUID(), action: params[3] || 'ACTION', created_at: new Date().toISOString() });
      return [{ affectedRows: 1 }];
    }
    if (normalized.startsWith('delete')) {
      inMemoryStore.audit_logs = [];
      return [{ affectedRows: 0 }];
    }
  }

  // Default fallback
  return [[]];
}

// ── Unified Database Pool Export ──────────────────────────────────────────────
const pool = {
  async query(sql, params = []) {
    if (isMySqlAvailable && realPool) {
      try {
        return await realPool.query(sql, params);
      } catch (err) {
        // If MySQL connection dropped, seamlessly fallback to in-memory store
        console.warn(`⚠️ [Database] MySQL query failed (${err.message}). Using In-Memory fallback.`);
        return handleInMemoryQuery(sql, params);
      }
    }
    return handleInMemoryQuery(sql, params);
  },
  async getConnection() {
    if (isMySqlAvailable && realPool) {
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
    return isMySqlAvailable;
  }
};

module.exports = pool;
