'use strict';
/**
 * Named lock manager using MySQL GET_LOCK / RELEASE_LOCK.
 * Ensures only ONE process runs a background daemon (e.g. shiftLifecycle, mailWorker),
 * even if multiple Node instances are spawned.
 */
const dbModule = require('../db');
const pool = dbModule.pool || dbModule;

let held = null; // Keeps connection open while lock is held

async function acquireSingleton(name) {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT GET_LOCK(?, 0) AS got', [`app:${name}`]);
    const got = Array.isArray(rows) && rows[0] ? rows[0].got : 0;
    if (got === 1) {
      held = conn;
      return true;
    }
    conn.release();
    return false;
  } catch (err) {
    console.warn(`[Singleton Lock Notice] Could not acquire lock for ${name}: ${err.message}`);
    // In dev without mysql, permit execution
    if (process.env.NODE_ENV !== 'production') return true;
    return false;
  }
}

async function releaseSingleton(name) {
  if (!held) return;
  try {
    await held.query('SELECT RELEASE_LOCK(?)', [`app:${name}`]);
  } catch (_) {}
  try {
    held.release();
  } catch (_) {}
  held = null;
}

module.exports = { acquireSingleton, releaseSingleton };
