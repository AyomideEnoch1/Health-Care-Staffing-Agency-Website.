'use strict';
const fs = require('fs');
const pool = require('../db');

(async () => {
  const sql = fs.readFileSync('sql/mail_system_up.sql', 'utf8');
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    await pool.query(stmt);
  }
  console.log('✅ Mail system schema migration applied successfully!');

  const [tables] = await pool.query("SHOW TABLES LIKE 'email_%'");
  console.log('Email tables in DB:', tables.map(t => Object.values(t)[0]));
  process.exit(0);
})().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
