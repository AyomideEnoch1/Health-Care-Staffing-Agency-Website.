/**
 * Database Connection Module
 * Divine Fingers Healthcare Services Inc.
 * 
 * Uses mysql2/promise with connection pooling and parameterized query execution.
 * Works seamlessly across both local development (Docker/native) and Hostinger production.
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_NAME'];
for (const key of requiredEnv) {
  if (process.env[key] === undefined || process.env[key] === '') {
    throw new Error(`CRITICAL CONFIG ERROR: Missing environment variable [${key}]. Check your .env file.`);
  }
}

// Scoped connection pool: The application user MUST NOT have DROP/ALTER/GRANT permissions in production.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  timezone: '+00:00'
});

// Boot connection test
pool.getConnection()
  .then(conn => {
    console.log(`✅ [Database] Connected to MySQL (${process.env.DB_HOST}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME})`);
    conn.release();
  })
  .catch(err => {
    console.error(`❌ [Database Error] Failed to connect:`, err.message);
  });

module.exports = pool;
