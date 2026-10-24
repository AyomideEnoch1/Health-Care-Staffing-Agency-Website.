const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const os = require('os');
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const uploadDir = process.env.CREDENTIALS_UPLOAD_DIR || (isServerless ? path.join(os.tmpdir(), 'uploads', 'credentials') : path.join(__dirname, '../uploads/credentials'));

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (e) {
  console.warn('[Credential Upload Directory Warning]:', e.message);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueId = crypto.randomUUID();
    const safeExt = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `CREDENTIAL-${Date.now()}-${uniqueId}${safeExt}`);
  }
});

const ALLOWED_EXTS = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'];
const ALLOWED_MIMES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/octet-stream'
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTS.includes(ext) && (ALLOWED_MIMES.includes(file.mimetype) || file.mimetype.startsWith('image/'))) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, PNG, JPG, JPEG, DOC, and DOCX credential formats are accepted.'), false);
  }
};

const uploadCredential = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB
    files: 1
  }
});

/**
 * Strict magic byte inspection for uploaded credentials.
 */
function validateCredentialMime(req, res, next) {
  if (!req.file || !req.file.path) return next();

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(req.file.path, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46; // %PDF
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47; // \x89PNG
    const isJpg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF; // JPEG SOI
    const isDocx = buffer[0] === 0x50 && buffer[1] === 0x4B; // PK
    const isDoc = buffer[0] === 0xD0 && buffer[1] === 0xCF; // OLE

    let valid = false;
    if (ext === '.pdf' && isPdf) valid = true;
    else if (ext === '.png' && isPng) valid = true;
    else if ((ext === '.jpg' || ext === '.jpeg') && isJpg) valid = true;
    else if (ext === '.docx' && isDocx) valid = true;
    else if (ext === '.doc' && isDoc) valid = true;

    if (!valid) {
      fs.unlink(req.file.path, () => {});
      return res.status(422).json({
        success: false,
        error: 'Uploaded credential file content does not match its declared format.'
      });
    }

    next();
  } catch (err) {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(422).json({ success: false, error: 'File validation failed.' });
  }
}

module.exports = {
  uploadCredential,
  validateCredentialMime,
  uploadDir
};
