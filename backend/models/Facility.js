'use strict';
/**
 * Facility Model
 * Divine Fingers Healthcare Services Inc.
 */

const pool = require('../db');

class FacilityModel {
  static async findAll() {
    const [rows] = await pool.query('SELECT * FROM facilities ORDER BY name ASC');
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM facilities WHERE id = ? LIMIT 1', [id]);
    return rows && rows[0] ? rows[0] : null;
  }

  static async findByCode(code) {
    const [rows] = await pool.query('SELECT * FROM facilities WHERE facility_code = ? LIMIT 1', [code]);
    return rows && rows[0] ? rows[0] : null;
  }
}

module.exports = FacilityModel;
