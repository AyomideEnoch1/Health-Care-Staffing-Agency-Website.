/**
 * Contract & MSA Document Upload Middleware
 * Divine Fingers Healthcare Services Inc.
 *
 * Security controls:
 * 1. Strict extension whitelist (.pdf, .doc, .docx).
 * 2. Strict MIME and magic byte binary signature validation.
 * 3. 25MB file size limit for enterprise healthcare contracts.
 * 4. Stored in isolated /uploads/contracts directory.
 * 5. Unique UUID disk filenames to prevent collisions and directory traversal.
 */

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const contractsUploadDir = process.env.CONTRACTS_UPLOAD_DIR || (isServerless ? path.join(os.tmpdir(), 'uploads', 'contracts') : path.join(__dirname, '../uploads/contracts'));

try {
  if (!fs.existsSync(contractsUploadDir)) {
    fs.mkdirSync(contractsUploadDir, { recursive: true });
  }
} catch (e) {
  console.warn('[Contracts Upload Directory Warning]:', e.message);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!fs.existsSync(contractsUploadDir)) {
        fs.mkdirSync(contractsUploadDir, { recursive: true });
      }
      cb(null, contractsUploadDir);
    } catch (err) {
      const fallbackDir = path.join(os.tmpdir(), 'uploads', 'contracts');
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
    cb(null, `MSA-${Date.now()}-${uniqueId}${safeExt}`);
  }
});

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream'
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error('Invalid document format. Only PDF, DOC, and DOCX files are allowed for contracts.'), false);
  }
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error('Invalid MIME type for contract document.'), false);
  }
  cb(null, true);
};

const uploadContract = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max
    files: 1
  }
});

/**
 * Strict magic byte inspection for contract uploads.
 */
function validateContractMime(req, res, next) {
  if (!req.file || !req.file.path) return next();

  fs.open(req.file.path, 'r', (openErr, fd) => {
    if (openErr) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(500).json({ success: false, error: 'Failed to verify uploaded contract file integrity.' });
    }

    const buffer = Buffer.alloc(8);
    fs.read(fd, buffer, 0, 8, 0, (readErr) => {
      fs.close(fd, () => {});

      if (readErr) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(500).json({ success: false, error: 'Failed to read uploaded contract file header.' });
      }

      // Check magic signatures:
      // PDF: %PDF (0x25, 0x50, 0x44, 0x46)
      const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
      // DOCX: Zip header PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
      const isDocx = buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
      // DOC: OLE CFBF (0xD0, 0xCF, 0x11, 0xE0)
      const isDoc = buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0;

      if (!isPdf && !isDocx && !isDoc) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: 'Security verification failed: File content does not match genuine PDF or Word document signature.'
        });
      }

      next();
    });
  });
}

module.exports = {
  uploadContract,
  validateContractMime,
  contractsUploadDir
};
