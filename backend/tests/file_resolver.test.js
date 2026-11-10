const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { resolveUploadFile, generateApplicantDossierHtml } = require('../utils/fileResolver');

test('FileResolver: resolveUploadFile finds existing file on disk', () => {
  // Test with one of the actual files in backend/uploads/resumes
  const resumes = fs.readdirSync(path.join(__dirname, '../uploads/resumes'));
  if (resumes.length > 0) {
    const sample = resumes[0];
    const res = resolveUploadFile({
      storedPath: 'some/wrong/path/' + sample,
      fileName: sample,
      subDir: 'resumes'
    });
    assert.strictEqual(res.found, true);
    assert.ok(fs.existsSync(res.filePath));
  }
});

test('FileResolver: resolveUploadFile uses buffer if file is missing from disk', () => {
  const fakeBuffer = Buffer.from('PDF-SAMPLE-DATA-2026');
  const res = resolveUploadFile({
    storedPath: '/non/existent/path/SAMPLE.pdf',
    fileName: 'SAMPLE-TEST-RESTORE.pdf',
    subDir: 'resumes',
    fileBuffer: fakeBuffer
  });
  assert.strictEqual(res.found, true);
  assert.ok(res.buffer || res.filePath);
});

test('FileResolver: generateApplicantDossierHtml produces complete HTML page', () => {
  const html = generateApplicantDossierHtml({
    id: '123',
    application_code: 'APP-TEST-99',
    full_name: 'Florence Nightingale',
    role_applied: 'RN',
    email: 'florence@example.com',
    phone: '555-123-4567',
    license_registration: 'CNO #998877',
    stage: 'review',
    resume_original_name: 'Florence_Nightingale_CV.pdf',
    created_at: new Date().toISOString()
  });

  assert.ok(html.includes('Florence Nightingale'));
  assert.ok(html.includes('APP-TEST-99'));
  assert.ok(html.includes('florence@example.com'));
  assert.ok(html.includes('CNO #998877'));
  assert.ok(html.includes('Email Candidate to Request Resume'));
  assert.ok(html.includes('Print / Save Profile as PDF'));
});
