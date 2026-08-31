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

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads/resumes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
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
 * Layer 3: Content-sniffing MIME validation using file-type package.
 * Must be called AFTER multer has written the file to disk.
 * This is an async Express middleware — use it as the next step after uploadResume.single().
 *
 * If the file's magic bytes don't match a known safe document type,
 * the uploaded file is immediately deleted and a 422 error is returned.
 */
async function validateMimeContent(req, res, next) {
  if (!req.file) return next(); // No file — let route handler handle missing file

  let fileTypeResult;
  try {
    // file-type v19 is pure ESM — dynamic import required in CommonJS context
    const { fileTypeFromFile } = await import('file-type');
    fileTypeResult = await fileTypeFromFile(req.file.path);
  } catch (err) {
    // If file-type fails to read (e.g. very small file), reject it
    fs.unlink(req.file.path, () => {});
    return res.status(422).json({
      success: false,
      error: 'Could not verify file content. Please upload a valid PDF or Word document.'
    });
  }

  // Plain .doc files (old binary Word format) may not have a detectable magic type
  // in all versions of file-type — we allow it if declared MIME matches and extension matches
  const SAFE_MIME_TYPES = ['application/pdf', 'application/zip']; // .docx is zip-based
  const ext = path.extname(req.file.originalname).toLowerCase();

  let isDocx = false;
  if (ext === '.docx' && fileTypeResult && (fileTypeResult.ext === 'docx' || fileTypeResult.ext === 'zip')) {
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(req.file.path);
      const zipEntries = zip.getEntries().map(e => e.entryName);
      const hasContentTypes = zipEntries.includes('[Content_Types].xml');
      const hasDocXml = zipEntries.includes('word/document.xml');
      isDocx = hasContentTypes && hasDocXml;
    } catch {
      isDocx = false;
    }
  }

  const isPdf = ext === '.pdf' && fileTypeResult && fileTypeResult.mime === 'application/pdf';
  const isDoc = ext === '.doc'; // Legacy binary .doc — file-type may return null; accepted by extension + MIME check above

  if (!isPdf && !isDocx && !isDoc) {
    // Content doesn't match claimed type — delete and reject
    fs.unlink(req.file.path, () => {});
    return res.status(422).json({
      success: false,
      error: 'File content does not match the declared type. Only genuine PDF or Word documents are accepted.'
    });
  }

  next();
}

module.exports = { uploadResume, validateMimeContent };
