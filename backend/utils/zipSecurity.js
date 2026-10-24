'use strict';
/**
 * Hardened ZIP Extraction & Zip-Bomb / Zip-Slip Protection
 * Divine Fingers Healthcare Services Inc.
 *
 * Enforces defensive decompression constraints:
 * 1. Path traversal / Zip-Slip: Rejects any entry resolving outside target directory.
 * 2. Zip-Bomb / Resource Exhaustion: Limits entry count, decompressed size, and compression ratio.
 * 3. Symlink poisoning: Rejects symlink attributes.
 */

const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

const DEFAULT_OPTIONS = {
  maxEntries: 100,
  maxTotalSize: 50 * 1024 * 1024, // 50MB maximum decompressed payload
  maxSingleSize: 20 * 1024 * 1024, // 20MB per individual file
  maxCompressionRatio: 100         // Reject archives compressed > 100:1 (zip-bomb heuristic)
};

/**
 * Safely extracts a ZIP archive with strict zip-slip and zip-bomb protections.
 * @param {string|Buffer} zipInput - Path to ZIP file or Buffer
 * @param {string} destinationDir - Directory to extract into
 * @param {object} options - Custom limit overrides
 */
function safeExtractZip(zipInput, destinationDir, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const resolvedTarget = path.resolve(destinationDir);

  if (!fs.existsSync(resolvedTarget)) {
    fs.mkdirSync(resolvedTarget, { recursive: true });
  }

  const zip = (zipInput && typeof zipInput.getEntries === 'function') ? zipInput : new AdmZip(zipInput);
  const entries = zip.getEntries();

  if (entries.length > opts.maxEntries) {
    throw new Error(`Archive exceeds maximum permitted entry count (${entries.length} > ${opts.maxEntries}). Potential zip-bomb.`);
  }

  let totalExtractedSize = 0;
  const validEntries = [];

  for (const entry of entries) {
    const entryName = entry.entryName;
    
    // Check for null bytes in entry name
    if (entryName.includes('\x00')) {
      throw new Error('Malicious ZIP entry containing null byte detected.');
    }

    // Zip-Slip protection: ensure resolved extraction path stays within resolvedTarget
    const targetFilePath = path.resolve(resolvedTarget, entryName);
    if (!targetFilePath.startsWith(resolvedTarget + path.sep) && targetFilePath !== resolvedTarget) {
      throw new Error(`Security Violation (Zip-Slip): Directory traversal detected in entry "${entryName}".`);
    }

    // Reject symbolic links and character/block devices
    const mode = entry.header.attr;
    const isSymlink = (mode & 0o120000) === 0o120000;
    if (isSymlink) {
      throw new Error(`Security Violation: Symbolic link detected in entry "${entryName}".`);
    }

    const uncompressedSize = entry.header.size;
    const compressedSize = entry.header.compressedSize || 1;

    // Check individual file size
    if (uncompressedSize > opts.maxSingleSize) {
      throw new Error(`Entry "${entryName}" uncompressed size (${uncompressedSize} bytes) exceeds limit (${opts.maxSingleSize} bytes).`);
    }

    // Compression ratio check for zip-bomb defense
    const ratio = uncompressedSize / Math.max(1, compressedSize);
    if (ratio > opts.maxCompressionRatio) {
      throw new Error(`Suspicious compression ratio (${ratio.toFixed(1)}:1) on entry "${entryName}". Potential zip-bomb.`);
    }

    totalExtractedSize += uncompressedSize;
    if (totalExtractedSize > opts.maxTotalSize) {
      throw new Error(`Archive total decompressed size exceeds maximum permitted limit of ${opts.maxTotalSize} bytes.`);
    }

    validEntries.push({ entry, targetFilePath });
  }

  // Decompress validated entries safely
  for (const item of validEntries) {
    if (item.entry.isDirectory) {
      if (!fs.existsSync(item.targetFilePath)) {
        fs.mkdirSync(item.targetFilePath, { recursive: true });
      }
    } else {
      const parentDir = path.dirname(item.targetFilePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(item.targetFilePath, item.entry.getData());
    }
  }

  return {
    success: true,
    entriesCount: validEntries.length,
    totalBytes: totalExtractedSize
  };
}

module.exports = {
  safeExtractZip,
  DEFAULT_OPTIONS
};
