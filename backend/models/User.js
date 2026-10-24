'use strict';
/**
 * User Model
 * Divine Fingers Healthcare Services Inc.
 */

const pool = require('../db');

class UserModel {
  static async findByEmail(email) {
    const emailClean = String(email || '').toLowerCase().trim();
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1',
      [emailClean]
    );
    return rows && rows[0] ? rows[0] : null;
  }

  static async findById(id) {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    return rows && rows[0] ? rows[0] : null;
  }

  static async updatePassword(id, passwordHash) {
    const [res] = await pool.query(
      `UPDATE users SET 
        password_hash = ?, 
        password_reset_token_hash = NULL, 
        password_reset_expires = NULL, 
        token_version = token_version + 1,
        is_active = 1,
        updated_at = NOW() 
       WHERE id = ?`,
      [passwordHash, id]
    );
    return res;
  }

  static async setResetToken(id, tokenHash, expiryIntervalMinutes = 30) {
    const [res] = await pool.query(
      `UPDATE users SET 
        password_reset_token_hash = ?, 
        password_reset_expires = DATE_ADD(NOW(), INTERVAL ? MINUTE), 
        is_active = 1 
       WHERE id = ?`,
      [tokenHash, expiryIntervalMinutes, id]
    );
    return res;
  }

  static async findByValidResetToken(tokenHash) {
    const [rows] = await pool.query(
      `SELECT id, email, full_name, token_version FROM users 
       WHERE password_reset_token_hash = ? AND password_reset_expires > NOW() LIMIT 1`,
      [tokenHash]
    );
    return rows && rows[0] ? rows[0] : null;
  }

  static async updateLastLogin(id) {
    return await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [id]);
  }
}

module.exports = UserModel;
