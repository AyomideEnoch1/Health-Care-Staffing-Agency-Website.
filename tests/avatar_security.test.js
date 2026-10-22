'use strict';
/**
 * Automated Security Tests: Profile Avatar Upload Defenses
 * Divine Fingers Healthcare Services Inc.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { validateAvatarContent } = require('../middleware/avatarUpload');

describe('Profile Avatar Upload Security Defenses', () => {
  const tmpDir = os.tmpdir();

  test('validateAvatarContent accepts genuine JPEG binary signature', (t, done) => {
    const testFile = path.join(tmpDir, `valid-${Date.now()}.jpg`);
    // Valid JPEG magic header: FF D8 FF E0 ...
    const jpegBuf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    fs.writeFileSync(testFile, jpegBuf);

    const req = {
      file: { path: testFile, originalname: 'portrait.jpg' }
    };
    const res = {
      status: (code) => ({ json: (d) => done(new Error(`Unexpected status ${code}: ${d.error}`)) })
    };

    validateAvatarContent(req, res, () => {
      try { fs.unlinkSync(testFile); } catch (_) {}
      assert.ok(true, 'Genuine JPEG passed validation');
      done();
    });
  });

  test('validateAvatarContent accepts genuine PNG binary signature', (t, done) => {
    const testFile = path.join(tmpDir, `valid-${Date.now()}.png`);
    // Valid PNG magic header: 89 50 4E 47 0D 0A 1A 0A ...
    const pngBuf = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    fs.writeFileSync(testFile, pngBuf);

    const req = {
      file: { path: testFile, originalname: 'logo.png' }
    };
    const res = {
      status: (code) => ({ json: (d) => done(new Error(`Unexpected status ${code}: ${d.error}`)) })
    };

    validateAvatarContent(req, res, () => {
      try { fs.unlinkSync(testFile); } catch (_) {}
      assert.ok(true, 'Genuine PNG passed validation');
      done();
    });
  });

  test('validateAvatarContent accepts genuine WebP binary signature', (t, done) => {
    const testFile = path.join(tmpDir, `valid-${Date.now()}.webp`);
    // Valid WebP: 'RIFF' + 4 bytes size + 'WEBP'
    const webpBuf = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x00, 0x00, 0x00, 0x20]),
      Buffer.from('WEBP'),
      Buffer.from('VP8 ')
    ]);
    fs.writeFileSync(testFile, webpBuf);

    const req = {
      file: { path: testFile, originalname: 'avatar.webp' }
    };
    const res = {
      status: (code) => ({ json: (d) => done(new Error(`Unexpected status ${code}: ${d.error}`)) })
    };

    validateAvatarContent(req, res, () => {
      try { fs.unlinkSync(testFile); } catch (_) {}
      assert.ok(true, 'Genuine WebP passed validation');
      done();
    });
  });

  test('validateAvatarContent rejects and unlinks executable disguised with .jpg extension', (t, done) => {
    const testFile = path.join(tmpDir, `evil-${Date.now()}.jpg`);
    // Bash / ELF executable signature: #!/bin/bash
    fs.writeFileSync(testFile, Buffer.from('#!/bin/bash\nrm -rf /'));

    const req = {
      file: { path: testFile, originalname: 'innocent_picture.jpg' }
    };
    const res = {
      status: (code) => {
        assert.equal(code, 422, 'Returns 422 Unprocessable Entity');
        return {
          json: (body) => {
            assert.equal(body.success, false);
            assert.match(body.error, /failed binary header inspection/);
            // Verify malicious file was deleted from disk
            assert.equal(fs.existsSync(testFile), false, 'Malicious file must be unlinked');
            done();
          }
        };
      }
    };

    validateAvatarContent(req, res, () => {
      done(new Error('Validation should have failed'));
    });
  });

  test('validateAvatarContent rejects and unlinks SVG file with script injection', (t, done) => {
    const testFile = path.join(tmpDir, `xss-${Date.now()}.jpg`);
    // SVG script payload named as .jpg
    fs.writeFileSync(testFile, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'));

    const req = {
      file: { path: testFile, originalname: 'vector.jpg' }
    };
    const res = {
      status: (code) => {
        assert.equal(code, 422, 'Returns 422 for SVG disguised as JPG');
        return {
          json: (body) => {
            assert.equal(body.success, false);
            assert.equal(fs.existsSync(testFile), false, 'SVG file must be unlinked');
            done();
          }
        };
      }
    };

    validateAvatarContent(req, res, () => {
      done(new Error('Validation should have rejected SVG'));
    });
  });
});
