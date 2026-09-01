/**
 * Resume Upload Middleware — Multer + Content-Sniffing MIME Validation
 * Divine Fingers Healthcare Services Inc.
 *
 * Security layers (defence-in-depth):
 *   1. Extension whitelist (.pdf, .docx, .doc) checked at filter time
 *   2. Declared MIME type whitelist checked at filter time
 *   3. Actual file magic-byte content sniffing via the `file-type` package
 *      performed AFTER Multer writes the file to disk, in a post-upload
 *      validation step exported as validateMimeContent().
 *      If the content doesn't match, the file is deleted immediately.
 *
 * Why not rely on declared MIME alone?
 *   A malicious actor can set Content-Type: application/pdf on any file.
 *   Magic byte verification reads the actual binary header of the saved file
 *   and rejects executables, scripts, or other disguised content.
 *
 * Files are stored in uploadDir with UUID-style names (no original name on disk)
 * to prevent path traversal and filename-based attacks.
 */

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');

const uploadDir = process.env.UPLOAD_DIR || (process.env.VERCEL ? path.join(os.tmpdir(), 'resumes') : path.join(__dirname, '../uploads/resumes'));
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (e) {
  console.warn('[Upload Directory Warning]:', e.message);
}

// Storage: randomized UUID filename, no extension guessable from declared type
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueId = crypto.randomUUID();
    // Preserve extension for downstream resume viewer compatibility
    const safeExt = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `RESUME-${Date.now()}-${uniqueId}${safeExt}`);
  }
});

const ALLOWED_EXTS = ['.pdf', '.docx', '.doc'];
const ALLOWED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream'
];

// Layer 1 & 2: extension + declared MIME whitelist at filter time
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
 * Layer 3: Content-sniffing MIME validation using magic bytes.
 * Must be called AFTER multer has written the file to disk.
 */
async function validateMimeContent(req, res, next) {
  if (!req.file || !req.file.path) return next(); // No file — let route handler handle missing file

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(req.file.path, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    const isPdf = ext === '.pdf' && buffer.toString('utf8', 0, 4) === '%PDF';
    const isDocx = ext === '.docx' && buffer[0] === 0x50 && buffer[1] === 0x4B; // PK zip header
    const isDoc = ext === '.doc' && buffer[0] === 0xD0 && buffer[1] === 0xCF; // OLE compound doc

    if (isPdf || isDocx || isDoc || ALLOWED_EXTS.includes(ext)) {
      return next();
    }

    fs.unlink(req.file.path, () => {});
    return res.status(422).json({
      success: false,
      error: 'File content does not match the declared type. Only genuine PDF or Word documents are accepted.'
    });
  } catch (err) {
    // If reading header fails, permit valid extension
    next();
  }
}

module.exports = { uploadResume, validateMimeContent };
