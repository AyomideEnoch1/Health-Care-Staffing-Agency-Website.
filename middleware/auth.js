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
const JWT_SECRET = process.env.JWT_SECRET || 'divine_fingers_default_secure_jwt_secret_key_2026_production_fallback';

const ALL_PERMISSIONS = [
  'requests:view',
  'requests:dispatch',
  'roster:view',
  'roster:manage',
  'applications:view',
  'applications:manage',
  'inquiries:manage',
  'reports:view',
  'reports:export',
  'newsletter:manage',
  'audit:view',
  'admins:manage'
];

function normalizePermissions(role, rawPermissions) {
  if (role === 'super-admin') {
    return ALL_PERMISSIONS;
  }
  if (!rawPermissions) {
    if (role === 'dispatch') return ['requests:view', 'requests:dispatch', 'roster:view', 'reports:view'];
    if (role === 'care-coordinator') return ['requests:view', 'requests:dispatch', 'roster:view'];
    if (role === 'recruiter') return ['applications:view', 'applications:manage', 'roster:view'];
    if (role === 'auditor') return ['audit:view', 'reports:view', 'reports:export', 'requests:view', 'roster:view'];
    return [];
  }
  if (Array.isArray(rawPermissions)) {
    return rawPermissions;
  }
  try {
    const parsed = typeof rawPermissions === 'string' ? JSON.parse(rawPermissions) : rawPermissions;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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
      const decoded = jwt.verify(token, JWT_SECRET);

      // Verify active account status in real-time
      const [rows] = await pool.query('SELECT id, email, role, permissions, full_name, is_active FROM admins WHERE id = ?', [decoded.id]);
      if (rows.length === 0 || !rows[0].is_active) {
        res.clearCookie('df_admin_session');
        res.clearCookie('df_csrf_token');
        return res.status(401).json({
          success: false,
          error: 'Account has been deactivated or no longer exists. Access revoked.'
        });
      }

      const admin = rows[0];
      admin.permissions = normalizePermissions(admin.role, admin.permissions);
      req.admin = admin;

      // Role-based access check
      if (allowedRoles.length > 0 && !allowedRoles.includes(req.admin.role) && req.admin.role !== 'super-admin') {
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

/**
 * requirePermission — validates that the authenticated admin has a specific module permission.
 *
 * @param {string} permission - required permission key (e.g. 'requests:dispatch')
 */
function requirePermission(permission) {
  return async (req, res, next) => {
    // Ensure requireAdminAuth has run
    if (!req.admin) {
      return requireAdminAuth()(req, res, () => {
        if (!req.admin) return;
        if (req.admin.role === 'super-admin' || (req.admin.permissions && req.admin.permissions.includes(permission))) {
          return next();
        }
        return res.status(403).json({
          success: false,
          error: `Forbidden: You do not have permission to perform this action (${permission}).`
        });
      });
    }

    if (req.admin.role === 'super-admin' || (req.admin.permissions && req.admin.permissions.includes(permission))) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `Forbidden: You do not have permission to perform this action (${permission}).`
    });
  };
}

module.exports = {
  requireAdminAuth,
  requirePermission,
  normalizePermissions,
  ALL_PERMISSIONS
};
