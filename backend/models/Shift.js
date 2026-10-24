'use strict';
/**
 * Shift Model
 * Divine Fingers Healthcare Services Inc.
 */

const pool = require('../db');

class ShiftModel {
  static async findAvailable({ facilityId, role, limit = 50 } = {}) {
    let sql = 'SELECT * FROM shifts WHERE status = "open"';
    const params = [];

    if (facilityId) {
      sql += ' AND facility_id = ?';
      params.push(facilityId);
    }
    if (role) {
      sql += ' AND role_required = ?';
      params.push(role);
    }

    sql += ' ORDER BY start_time ASC LIMIT ?';
    params.push(Number(limit));

    const [rows] = await pool.query(sql, params);
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM shifts WHERE id = ? LIMIT 1', [id]);
    return rows && rows[0] ? rows[0] : null;
  }

  static async findByStaff(staffId) {
    const [rows] = await pool.query(
      'SELECT * FROM shifts WHERE assigned_staff_id = ? ORDER BY start_time DESC',
      [staffId]
    );
    return rows;
  }
}

module.exports = ShiftModel;
