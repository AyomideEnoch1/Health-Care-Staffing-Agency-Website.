/**
 * Job Applications Route — Candidate Resume Submission
 * Divine Fingers Healthcare Services Inc.
 *
 * Security controls applied (three-layer file validation):
 *   1. Extension whitelist (.pdf, .docx, .doc) — Multer fileFilter
 *   2. Declared MIME type whitelist — Multer fileFilter
 *   3. Magic-byte content sniffing via file-type — validateMimeContent middleware
 *
 * ip_address retention: recommended 90 days (configurable via IP_RETENTION_DAYS env).
 * A scheduled purge job should nullify ip_address values older than the retention window.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { z } = require('zod');
const pool = require('../db');
const { uploadResume, validateMimeContent } = require('../middleware/upload');
const { publicFormLimiter } = require('../middleware/rateLimiter');
const { sendApplicantConfirmation } = require('../utils/mailer');
const adminEvents = require('../utils/events');

const applicationSchema = z.object({
  full_name:            z.string().min(2).max(120),
  role_applied:         z.enum(['RN', 'RPN', 'PSW', 'Companion', 'Travel Nurse']),
  email:                z.string().email().max(191),
  phone:                z.string().min(10).max(30),
  // license_registration is collected but not required on the public form
  // (candidate may not have their registration number at application time)
  license_registration: z.string().max(80).optional().default('Pending Verification')
});

router.post(
  '/',
  publicFormLimiter,
  uploadResume.single('resume'),  // Layer 1 & 2: extension + declared MIME
  validateMimeContent,            // Layer 3: magic byte content sniffing
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Resume file (PDF, DOC, or DOCX) is required.' });
      }

      const validated = applicationSchema.parse(req.body);
      const id      = crypto.randomUUID();
      const appCode = `APP-${Date.now().toString(36).toUpperCase()}`;

      await pool.query(
        `INSERT INTO job_applications
          (id, application_code, full_name, role_applied, email, phone,
           license_registration, stage, resume_original_name, resume_stored_name,
           resume_mime_type, resume_file_size, resume_storage_path, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?)`,
        [
          id, appCode,
          validated.full_name, validated.role_applied,
          validated.email, validated.phone, validated.license_registration,
          req.file.originalname, req.file.filename,
          req.file.mimetype, req.file.size, req.file.path,
          req.ip
        ]
      );

      // Broadcast live update to connected admin dashboards
      adminEvents.emit('application:created', {
        id,
        application_code: appCode,
        full_name:   validated.full_name,
        role_applied: validated.role_applied,
        stage: 'new',
        created_at: new Date().toISOString()
      });

      // Send confirmation email (non-blocking — failure doesn't affect response)
      sendApplicantConfirmation({ ...validated, application_code: appCode })
        .catch(err => console.error('[MAIL CONFIRM ERROR]:', err.message));

      res.status(201).json({
        success: true,
        message: 'Application and resume received. A Divine Fingers coordinator will be in touch.',
        data: { application_code: appCode }
      });

    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

module.exports = router;
