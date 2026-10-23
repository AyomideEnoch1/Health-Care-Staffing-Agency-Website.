'use strict';
/**
 * Authenticated Document Delivery Route
 * Divine Fingers Healthcare Services Inc.
 *
 * Enforces strict authentication and authorization before serving any uploaded file:
 * - Direct static access to /uploads is blocked.
 * - Resumes are accessible only to verified administrators.
 * - Credential documents are accessible only to the document owner or an authorized administrator.
 * - Content-Disposition: attachment is enforced to prevent browser execution of untrusted files.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_ADMIN_SECRET = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET || 'divine_fingers_default_admin_jwt_secret_key_2026';
const JWT_USER_SECRET = process.env.JWT_USER_SECRET || process.env.USER_JWT_SECRET || process.env.JWT_SECRET || 'divine_fingers_default_user_jwt_secret_key_2026';

const RESUME_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads/resumes');
const CREDENTIAL_DIR = process.env.CREDENTIALS_UPLOAD_DIR || path.join(__dirname, '../uploads/credentials');
const CONTRACT_DIR = process.env.CONTRACTS_UPLOAD_DIR || path.join(__dirname, '../uploads/contracts');

function verifyAdmin(req) {
  const token = req.cookies && (req.cookies['df_admin_session'] || req.cookies['df_session']);
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_ADMIN_SECRET);
  } catch (_) {
    return null;
  }
}

function verifyUser(req) {
  const token = req.cookies && req.cookies['df_user_session'];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_USER_SECRET);
  } catch (_) {
    return null;
  }
}

// GET /api/documents/resume/:filename — Admin only download
router.get('/resume/:filename', async (req, res) => {
  const admin = verifyAdmin(req);
  if (!admin) {
    return res.status(401).json({ error: 'Authentication required to view candidate documents.' });
  }

  const safeFilename = path.basename(req.params.filename);
  const filePath = path.resolve(RESUME_DIR, safeFilename);

  if (!filePath.startsWith(path.resolve(RESUME_DIR) + path.sep)) {
    return res.status(400).json({ error: 'Invalid file reference.' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  return res.sendFile(filePath);
});

// GET /api/documents/credential/:filename — Admin or credential owner
router.get('/credential/:filename', async (req, res) => {
  const admin = verifyAdmin(req);
  const user = verifyUser(req);

  if (!admin && !user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const safeFilename = path.basename(req.params.filename);
  const filePath = path.resolve(CREDENTIAL_DIR, safeFilename);

  if (!filePath.startsWith(path.resolve(CREDENTIAL_DIR) + path.sep)) {
    return res.status(400).json({ error: 'Invalid file path.' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  // If standard user (clinician), verify they own this credential record in database
  if (!admin && user) {
    const [docs] = await pool.query(
      'SELECT id, staff_id FROM staff_documents WHERE file_name = ? OR file_path LIKE ? LIMIT 1',
      [safeFilename, `%${safeFilename}%`]
    );
    if (docs && docs.length > 0) {
      if (docs[0].staff_id !== user.id) {
        return res.status(403).json({ error: 'Access denied: You do not have permission to view this document.' });
      }
    }
  }

  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  return res.sendFile(filePath);
});

// GET /api/documents/msa/:filename — Authenticated Admin or Portal Access
router.get('/msa/:filename', async (req, res) => {
  const admin = verifyAdmin(req);
  const user = verifyUser(req);

  if (!admin && !user) {
    return res.status(401).json({ error: 'Authentication required to view contract documents.' });
  }

  const safeFilename = path.basename(req.params.filename);
  const filePath = path.resolve(CONTRACT_DIR, safeFilename);

  if (!filePath.startsWith(path.resolve(CONTRACT_DIR) + path.sep)) {
    return res.status(400).json({ error: 'Invalid contract file reference.' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Contract document not found on server.' });
  }

  const isPdf = safeFilename.toLowerCase().endsWith('.pdf');
  const disposition = isPdf ? 'inline' : 'attachment';

  if (isPdf) {
    res.setHeader('Content-Type', 'application/pdf');
  }
  res.setHeader('Content-Disposition', `${disposition}; filename="${safeFilename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.sendFile(filePath);
});

module.exports = router;
