'use strict';
/**
 * Staff Roster Model
 * Divine Fingers Healthcare Services Inc.
 */

const pool = require('../db');

class StaffModel {
  static async findAll({ role, status, search, limit = 50, offset = 0 } = {}) {
    let sql = 'SELECT * FROM staff_roster WHERE 1=1';
    const params = [];

    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (search) {
      sql += ' AND (name LIKE ? OR email LIKE ? OR staff_code LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM staff_roster WHERE id = ? LIMIT 1', [id]);
    return rows && rows[0] ? rows[0] : null;
  }

  static async findByEmail(email) {
    const clean = String(email || '').toLowerCase().trim();
    const [rows] = await pool.query('SELECT * FROM staff_roster WHERE LOWER(email) = ? LIMIT 1', [clean]);
    return rows && rows[0] ? rows[0] : null;
  }
}

module.exports = StaffModel;
