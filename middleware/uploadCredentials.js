const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');

const uploadDir = process.env.CREDENTIALS_UPLOAD_DIR || (process.env.VERCEL ? path.join(os.tmpdir(), 'credentials') : path.join(__dirname, '../uploads/credentials'));

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

module.exports = {
  uploadCredential,
  uploadDir
};
