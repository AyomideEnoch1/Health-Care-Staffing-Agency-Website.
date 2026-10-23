/**
 * Avatar Upload Middleware — Multer + Binary Magic-Byte Inspection + Strict Whitelist
 * Divine Fingers Healthcare Services Inc.
 *
 * Security controls:
 * 1. Strict extension whitelist (.jpg, .jpeg, .png, .webp).
 * 2. Strict MIME whitelist (image/jpeg, image/png, image/webp). SVG is strictly disallowed.
 * 3. 2MB hard file size limit.
 * 4. Magic-byte binary signature inspection (fails closed, unlinks malicious files).
 * 5. Unique UUID disk filenames to prevent directory traversal or file collision.
 */

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const os = require('os');
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const avatarUploadDir = process.env.AVATAR_UPLOAD_DIR || (isServerless ? path.join(os.tmpdir(), 'uploads', 'avatars') : path.join(__dirname, '../uploads/avatars'));
try {
  if (!fs.existsSync(avatarUploadDir)) {
    fs.mkdirSync(avatarUploadDir, { recursive: true });
  }
} catch (e) {
  console.warn('[Avatar Upload Directory Warning]:', e.message);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!fs.existsSync(avatarUploadDir)) {
        fs.mkdirSync(avatarUploadDir, { recursive: true });
      }
      cb(null, avatarUploadDir);
    } catch (err) {
      const fallbackDir = path.join(os.tmpdir(), 'uploads', 'avatars');
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
    cb(null, `AVATAR-${Date.now()}-${uniqueId}${safeExt}`);
  }
});

const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTS.includes(ext) && ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid image format. Only JPG, PNG, and WebP images are accepted (SVG is not allowed for security).'), false);
  }
};

const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
    files: 1
  }
});

/**
 * Binary magic-byte header validator for avatars.
 * Validates genuine JPEG, PNG, and WebP file signatures.
 */
function validateAvatarContent(req, res, next) {
  if (!req.file || !req.file.path) return next();

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(req.file.path, 'r');
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    // JPEG: FF D8 FF
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;

    // WebP: RIFF....WEBP (bytes 0-3 'RIFF', bytes 8-11 'WEBP')
    const isWebp = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';

    let matches = false;
    if ((ext === '.jpg' || ext === '.jpeg') && isJpeg) matches = true;
    else if (ext === '.png' && isPng) matches = true;
    else if (ext === '.webp' && isWebp) matches = true;

    if (!matches) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      return res.status(422).json({
        success: false,
        error: 'File content failed binary header inspection. Only genuine JPEG, PNG, and WebP images are accepted.'
      });
    }

    next();
  } catch (err) {
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
    return res.status(500).json({
      success: false,
      error: 'Security verification failed during avatar inspection.'
    });
  }
}

module.exports = {
  uploadAvatar,
  validateAvatarContent,
  avatarUploadDir
};
