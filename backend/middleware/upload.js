/**
 * Resume Upload Middleware — Multer + Strict Magic-Byte Content Sniffing + ClamAV Hook
 * Divine Fingers Healthcare Services Inc.
 *
 * Multi-layer upload defenses:
 * 1. Extension & declared MIME filter.
 * 2. Strict magic-byte inspection (fails closed, deletes mismatched files).
 * 3. ClamAV malware scan hook.
 * 4. Randomized UUID disk filenames to prevent path traversal.
 */

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { execFile } = require('child_process');

const os = require('os');
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const uploadDir = process.env.UPLOAD_DIR || (isServerless ? path.join(os.tmpdir(), 'uploads', 'resumes') : path.join(__dirname, '../uploads/resumes'));
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (e) {
  console.warn('[Upload Directory Warning]:', e.message);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    } catch (err) {
      const fallbackDir = path.join(os.tmpdir(), 'uploads', 'resumes');
      try {
        if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
        cb(null, fallbackDir);
      } catch (fallbackErr) {
        cb(null, os.tmpdir());
      }
    }
  },
  filename: (req, file, cb) => {
    const uniqueId = crypto.randomUUID();
    const safeExt = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `RESUME-${Date.now()}-${uniqueId}${safeExt}`);
  }
});

const ALLOWED_EXTS = ['.pdf', '.docx', '.doc'];
const ALLOWED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/octet-stream'
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTS.includes(ext) && ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, and DOCX resume formats are accepted.'), false);
  }
};

const uploadResume = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE_BYTES || '10485760', 10), // 10MB
    files: 1
  }
});

/**
 * Scan file with ClamAV if available on host.
 */
function scanWithClamAV(filePath) {
  return new Promise((resolve) => {
    // If CLAMAV_ENABLED is explicitly false or running in serverless Vercel, skip
    if (process.env.CLAMAV_ENABLED === 'false' || process.env.VERCEL) return resolve(true);

    execFile('clamscan', ['--no-summary', filePath], (error, stdout, stderr) => {
      if (error) {
        // If command not found (ENOENT), ClamAV is not installed on this machine
        if (error.code === 'ENOENT') {
          return resolve(true);
        }
        // Exit code 1 means virus found
        if (error.code === 1) {
          console.warn(`[ClamAV Threat Detected] Infected upload quarantined: ${filePath}`);
          return resolve(false);
        }
      }
      resolve(true);
    });
  });
}

/**
 * Strict magic-byte MIME validation.
 * Must be executed immediately after Multer saves the file to disk.
 */
async function validateMimeContent(req, res, next) {
  if (!req.file || !req.file.path) return next();

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(req.file.path, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46; // %PDF
    const isDocx = buffer[0] === 0x50 && buffer[1] === 0x4B; // PK zip header
    const isDoc = buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0; // OLE Compound

    let matches = false;
    if (ext === '.pdf' && isPdf) matches = true;
    else if (ext === '.docx' && isDocx) matches = true;
    else if (ext === '.doc' && isDoc) matches = true;

    if (!matches) {
      fs.unlink(req.file.path, () => {});
      return res.status(422).json({
        success: false,
        error: 'File content failed binary header inspection. Only genuine PDF and Word documents are permitted.'
      });
    }

    // ClamAV Antivirus Scanning
    const isClean = await scanWithClamAV(req.file.path);
    if (!isClean) {
      fs.unlink(req.file.path, () => {});
      return res.status(422).json({
        success: false,
        error: 'Uploaded file failed security validation and was quarantined.'
      });
    }

    next();
  } catch (err) {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(422).json({
      success: false,
      error: 'Security verification failed during upload inspection.'
    });
  }
}

module.exports = { uploadResume, validateMimeContent };
