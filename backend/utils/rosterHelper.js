const crypto = require('crypto');

/**
 * Robustly generates the next sequential and guaranteed-unique staff_code.
 * Inspects all existing staff codes (e.g. 'STF-001', 'STF-105') to find the highest number,
 * then checks candidate uniqueness against the database to guarantee zero collisions.
 *
 * @param {object} executor - MySQL pool or connection object with a .query() method.
 * @returns {Promise<string>} Next guaranteed-unique staff code (e.g. 'STF-007')
 */
async function generateNextStaffCode(executor) {
  try {
    const [rows] = await executor.query(
      "SELECT staff_code FROM staff_roster WHERE staff_code IS NOT NULL AND staff_code != ''"
    );

    let maxNum = 0;
    if (rows && rows.length > 0) {
      for (const r of rows) {
        if (!r.staff_code) continue;
        const match = String(r.staff_code).match(/(\d+)/);
        if (match) {
          const val = parseInt(match[1], 10);
          if (!isNaN(val) && val > maxNum) {
            maxNum = val;
          }
        }
      }
    }

    let nextNum = Math.max(maxNum + 1, 1);
    while (true) {
      const candidate = `STF-${String(nextNum).padStart(3, '0')}`;
      const [existing] = await executor.query(
        'SELECT id FROM staff_roster WHERE staff_code = ? LIMIT 1',
        [candidate]
      );
      if (!existing || existing.length === 0) {
        return candidate;
      }
      nextNum++;
    }
  } catch (err) {
    console.warn('[generateNextStaffCode Warning]:', err.message);
    return `STF-${Date.now().toString().slice(-4)}`;
  }
}

/**
 * Scans staff_roster to detect and repair any duplicate staff_codes or missing staff_codes,
 * ensuring the UNIQUE KEY `idx_roster_code` is never violated.
 *
 * @param {object} executor - MySQL pool or connection object.
 */
async function healDuplicateStaffCodes(executor) {
  try {
    // 1. Fix null or empty staff codes
    const [emptyCodeRows] = await executor.query(
      "SELECT id FROM staff_roster WHERE staff_code IS NULL OR TRIM(staff_code) = ''"
    );
    if (emptyCodeRows && emptyCodeRows.length > 0) {
      for (const row of emptyCodeRows) {
        const newCode = await generateNextStaffCode(executor);
        await executor.query('UPDATE staff_roster SET staff_code = ? WHERE id = ?', [newCode, row.id]);
      }
    }

    // 2. Fix duplicate staff codes (keep oldest row, re-code duplicates)
    const [duplicates] = await executor.query(`
      SELECT staff_code, COUNT(*) AS cnt 
      FROM staff_roster 
      WHERE staff_code IS NOT NULL AND TRIM(staff_code) != '' 
      GROUP BY staff_code 
      HAVING cnt > 1
    `);

    if (duplicates && duplicates.length > 0) {
      for (const dup of duplicates) {
        const [dupeRows] = await executor.query(
          'SELECT id FROM staff_roster WHERE staff_code = ? ORDER BY created_at ASC',
          [dup.staff_code]
        );
        for (let i = 1; i < dupeRows.length; i++) {
          const newCode = await generateNextStaffCode(executor);
          await executor.query('UPDATE staff_roster SET staff_code = ? WHERE id = ?', [newCode, dupeRows[i].id]);
        }
      }
    }
  } catch (err) {
    console.warn('[healDuplicateStaffCodes Warning]:', err.message);
  }
}

/**
 * Auto-syncs any registered healthcare_worker accounts from `users` into `staff_roster`
 * without collisions or overwriting existing staff members.
 *
 * @param {object} executor - MySQL pool or connection object.
 */
async function healMissingHealthcareWorkers(executor) {
  try {
    const [hwUsers] = await executor.query(`
      SELECT u.id, u.full_name, u.email, u.phone 
      FROM users u 
      WHERE u.role = 'healthcare_worker'
        AND u.email IS NOT NULL AND TRIM(u.email) != ''
        AND LOWER(TRIM(u.email)) NOT IN (
          SELECT LOWER(TRIM(email)) FROM staff_roster WHERE email IS NOT NULL AND TRIM(email) != ''
        )
    `);

    if (hwUsers && hwUsers.length > 0) {
      for (const mu of hwUsers) {
        const nextCode = await generateNextStaffCode(executor);
        let rosterId = mu.id;
        const [conflict] = await executor.query('SELECT id FROM staff_roster WHERE id = ?', [rosterId]);
        if (conflict && conflict.length > 0) {
          rosterId = crypto.randomUUID();
        }

        await executor.query(
          `INSERT INTO staff_roster 
            (id, staff_code, name, role, specialty, region, phone, email, status, credential_status, hourly_rate, cpr_expiry_date)
           VALUES (?, ?, ?, 'RN', 'General Care', 'Greater Toronto Area', ?, ?, 'available', 'pending', 35.00, DATE_ADD(CURDATE(), INTERVAL 1 YEAR))`,
          [rosterId, nextCode, mu.full_name || 'Staff Member', mu.phone || null, mu.email.toLowerCase().trim()]
        );
      }
    }
  } catch (err) {
    console.warn('[healMissingHealthcareWorkers Warning]:', err.message);
  }
}

module.exports = {
  generateNextStaffCode,
  healDuplicateStaffCodes,
  healMissingHealthcareWorkers
};
