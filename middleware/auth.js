/**
 * JWT Authentication & RBAC Middleware
 * Divine Fingers Healthcare Services Inc.
 *
 * Security design:
 *   - JWT is issued and validated from an httpOnly, Secure, SameSite=Strict cookie
 *     named "df_admin_session". This prevents XSS-based token theft because the
 *     cookie is never accessible via document.cookie / JavaScript.
 *   - CSRF protection is applied separately via tiny-csrf on all state-changing
 *     admin routes (PATCH/POST under /api/admin/*). The CSRF token is returned
 *     in the login response body and stored in sessionStorage (safe — not a secret,
 *     just a nonce tied to the session cookie).
 *   - allowedRoles: optional RBAC whitelist. If empty, any authenticated admin passes.
 */

const jwt = require('jsonwebtoken');
const pool = require('../db');

/**
 * requireAdminAuth — validates httpOnly session cookie and checks live database status.
 *
 * @param {string[]} allowedRoles - RBAC roles. Empty array = any authenticated admin.
 */
function requireAdminAuth(allowedRoles = []) {
  return async (req, res, next) => {
    const token = (req.cookies && req.cookies['df_admin_session']) ||
                  (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
                    ? req.headers.authorization.split(' ')[1]
                    : null);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied: No active session. Please log in.'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Verify active account status in real-time
      const [rows] = await pool.query('SELECT id, email, role, full_name, is_active FROM admins WHERE id = ?', [decoded.id]);
      if (rows.length === 0 || !rows[0].is_active) {
        res.clearCookie('df_admin_session');
        res.clearCookie('df_csrf_token');
        return res.status(401).json({
          success: false,
          error: 'Account has been deactivated or no longer exists. Access revoked.'
        });
      }

      req.admin = rows[0];

      // Role-based access check
      if (allowedRoles.length > 0 && !allowedRoles.includes(req.admin.role)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Insufficient privileges for this action.'
        });
      }

      next();
    } catch (err) {
      res.clearCookie('df_admin_session');
      res.clearCookie('df_csrf_token');
      return res.status(401).json({
        success: false,
        error: 'Session expired or invalid. Please log in again.'
      });
    }
  };
}

module.exports = { requireAdminAuth };
