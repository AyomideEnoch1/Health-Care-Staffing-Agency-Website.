'use strict';

/**
 * Resilient File Resolver & Ephemeral Storage Handler
 * Divine Fingers Healthcare Services Inc.
 *
 * Ensures uploaded resumes and credentials can be downloaded reliably across:
 * - Local Windows/Linux development
 * - Ephemeral container environments (e.g., Render Free tier)
 * - Persistent MySQL database storage (LONGBLOB fallback)
 * - Path migrations and differing working directories
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Searches all candidate paths on disk for an uploaded asset.
 * If missing from disk but a database buffer is provided, it caches
 * the buffer back to disk and returns it.
 */
function resolveUploadFile({ storedPath, fileName, subDir = 'resumes', fileBuffer = null }) {
  const baseName = fileName || (storedPath ? path.basename(storedPath) : '');
  const candidatePaths = [];

  // 1. Direct stored path check (if provided)
  if (storedPath && typeof storedPath === 'string') {
    candidatePaths.push(storedPath);
    candidatePaths.push(path.resolve(storedPath));
    try {
      // Handle escaped or mismatched Windows/POSIX slashes
      candidatePaths.push(storedPath.replace(/\\/g, '/'));
      candidatePaths.push(storedPath.replace(/\//g, '\\'));
    } catch (_) {}
  }

  // 2. Candidate directories based on baseName
  if (baseName) {
    const envDir = subDir === 'credentials' 
      ? (process.env.CREDENTIALS_UPLOAD_DIR || process.env.UPLOAD_DIR)
      : (process.env.UPLOAD_DIR || null);

    if (envDir) {
      candidatePaths.push(path.resolve(envDir, baseName));
      candidatePaths.push(path.join(envDir, baseName));
    }

    candidatePaths.push(path.join(__dirname, '../uploads', subDir, baseName));
    candidatePaths.push(path.join(__dirname, '../../uploads', subDir, baseName));
    candidatePaths.push(path.join(process.cwd(), 'uploads', subDir, baseName));
    candidatePaths.push(path.join(process.cwd(), 'backend/uploads', subDir, baseName));
    candidatePaths.push(path.join(os.tmpdir(), 'uploads', subDir, baseName));
    candidatePaths.push(path.join(os.tmpdir(), baseName));
  }

  // 3. Search disk for first existing file
  for (const candidate of candidatePaths) {
    if (!candidate) continue;
    try {
      if (fs.existsSync(candidate)) {
        const stat = fs.statSync(candidate);
        if (stat.isFile() && stat.size > 0) {
          return { found: true, filePath: candidate, buffer: null };
        }
      }
    } catch (_) {}
  }

  // 4. Fallback to database buffer if file was cleared from ephemeral container disk
  if (fileBuffer && Buffer.isBuffer(fileBuffer) && fileBuffer.length > 0) {
    try {
      const primaryDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads', subDir);
      if (!fs.existsSync(primaryDir)) {
        fs.mkdirSync(primaryDir, { recursive: true });
      }
      const safeName = baseName || `RESTORED-${Date.now()}-${subDir}.pdf`;
      const restorePath = path.join(primaryDir, safeName);
      fs.writeFileSync(restorePath, fileBuffer);
      return { found: true, filePath: restorePath, buffer: fileBuffer };
    } catch (e) {
      // Return buffer directly if disk write fails
      return { found: true, filePath: null, buffer: fileBuffer };
    }
  }

  return { found: false, filePath: null, buffer: null };
}

/**
 * Generates an executive, professional HTML Dossier for an applicant
 * when their original uploaded file was cleared during an ephemeral cloud container restart.
 */
function generateApplicantDossierHtml(app) {
  const safeName = (app.full_name || 'Applicant').replace(/[<>&"']/g, '');
  const safeCode = (app.application_code || 'APP-N/A').replace(/[<>&"']/g, '');
  const safeRole = (app.role_applied || 'Clinical Staff').replace(/[<>&"']/g, '');
  const safeEmail = (app.email || '').replace(/[<>&"']/g, '');
  const safePhone = (app.phone || 'Not provided').replace(/[<>&"']/g, '');
  const safeLicense = (app.license_registration || 'Pending Verification').replace(/[<>&"']/g, '');
  const safeStage = (app.stage || 'new').replace(/_/g, ' ').toUpperCase();
  const safeDate = app.created_at ? new Date(app.created_at).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) : 'Unknown';
  const originalFileName = (app.resume_original_name || 'resume_document.pdf').replace(/[<>&"']/g, '');
  const experienceSummary = (app.experience_summary || 'No additional summary submitted with initial application.').replace(/[<>&"']/g, '');

  const mailSubject = encodeURIComponent(`Regarding your application for ${safeRole} at Divine Fingers Healthcare`);
  const mailBody = encodeURIComponent(
    `Dear ${safeName},\n\n` +
    `Thank you for applying for the ${safeRole} position at Divine Fingers Healthcare Services Inc. (Application Code: ${safeCode}).\n\n` +
    `We are actively reviewing candidate profiles. Could you please reply directly to this email with an updated copy of your Resume / CV for our clinical staffing onboarding file?\n\n` +
    `We look forward to speaking with you.\n\n` +
    `Warm regards,\n` +
    `Clinical Recruitment Team\n` +
    `Divine Fingers Healthcare Services Inc.\n` +
    `info@divinefingershealthcare.ca | www.divinefingershealthcare.ca`
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Candidate Application Dossier — ${safeName} (${safeCode})</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #F8FAFC;
      --card-bg: #FFFFFF;
      --navy: #0B192C;
      --navy-light: #1A3554;
      --cyan: #00C2CB;
      --cyan-dark: #009DA5;
      --border: #E2E8F0;
      --text: #1E293B;
      --text-muted: #64748B;
      --amber-bg: #FEF3C7;
      --amber-border: #F59E0B;
      --amber-text: #92400E;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', Arial, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 32px 16px;
    }
    .dossier-wrapper {
      max-width: 820px;
      margin: 0 auto;
      background: var(--card-bg);
      border-radius: 16px;
      border: 1px solid var(--border);
      box-shadow: 0 10px 25px -5px rgba(11, 25, 44, 0.08);
      overflow: hidden;
    }
    .dossier-header {
      background: linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 100%);
      color: #FFFFFF;
      padding: 28px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .brand-title {
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .brand-subtitle {
      font-size: 0.85rem;
      color: var(--cyan);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 2px;
    }
    .badge-pill {
      background: rgba(0, 194, 203, 0.15);
      border: 1px solid var(--cyan);
      color: #FFFFFF;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .dossier-body {
      padding: 32px;
    }
    .notice-card {
      background: var(--amber-bg);
      border-left: 5px solid var(--amber-border);
      padding: 16px 20px;
      border-radius: 8px;
      margin-bottom: 28px;
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }
    .notice-icon {
      font-size: 1.35rem;
      line-height: 1;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .notice-text h4 {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--amber-text);
      margin-bottom: 4px;
    }
    .notice-text p {
      font-size: 0.85rem;
      color: var(--amber-text);
      line-height: 1.5;
    }
    .candidate-hero {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid var(--border);
      padding-bottom: 20px;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .candidate-name {
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--navy);
      letter-spacing: -0.02em;
    }
    .candidate-role {
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--cyan-dark);
      margin-top: 4px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 18px 24px;
      margin-bottom: 28px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text);
      word-break: break-word;
    }
    .info-value a {
      color: var(--cyan-dark);
      text-decoration: none;
      font-weight: 700;
    }
    .info-value a:hover {
      text-decoration: underline;
    }
    .section-heading {
      font-size: 0.9rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--navy);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .experience-box {
      background: #F1F5F9;
      padding: 16px 20px;
      border-radius: 8px;
      font-size: 0.9rem;
      color: #334155;
      line-height: 1.6;
      margin-bottom: 28px;
      border: 1px solid var(--border);
    }
    .actions-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 20px;
      font-size: 0.88rem;
      font-weight: 700;
      border-radius: 8px;
      text-decoration: none;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
    }
    .btn-primary {
      background: var(--cyan);
      color: var(--navy);
    }
    .btn-primary:hover {
      background: var(--cyan-dark);
      color: #FFFFFF;
    }
    .btn-navy {
      background: var(--navy);
      color: #FFFFFF;
    }
    .btn-navy:hover {
      background: var(--navy-light);
    }
    .btn-outline {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text);
    }
    .btn-outline:hover {
      background: #F1F5F9;
    }
    @media print {
      body { background: #FFFFFF; padding: 0; }
      .dossier-wrapper { border: none; box-shadow: none; max-width: 100%; }
      .actions-strip, .notice-card { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="dossier-wrapper">
    <header class="dossier-header">
      <div>
        <div class="brand-title">Divine Fingers Healthcare Services Inc.</div>
        <div class="brand-subtitle">Candidate Application Profile</div>
      </div>
      <div class="badge-pill">${safeStage}</div>
    </header>

    <main class="dossier-body">
      <div class="notice-card">
        <div class="notice-icon">📋</div>
        <div class="notice-text">
          <h4>Candidate Record Preserved in Cloud Database</h4>
          <p>
            The original file attachment (<strong>${originalFileName}</strong>) was submitted in an earlier cloud container session prior to database storage synchronization.
            All verified submission details, contact numbers, and professional credentials have been retrieved directly from your secure database below.
          </p>
        </div>
      </div>

      <div class="candidate-hero">
        <div>
          <h1 class="candidate-name">${safeName}</h1>
          <div class="candidate-role">${safeRole} &bull; ${safeLicense}</div>
        </div>
        <div style="text-align: right;">
          <div class="info-label">Application Code</div>
          <div style="font-size: 1.1rem; font-weight: 800; color: var(--navy);">${safeCode}</div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Email Address</span>
          <span class="info-value"><a href="mailto:${safeEmail}">${safeEmail}</a></span>
        </div>
        <div class="info-item">
          <span class="info-label">Phone Number</span>
          <span class="info-value"><a href="tel:${safePhone}">${safePhone}</a></span>
        </div>
        <div class="info-item">
          <span class="info-label">License / Registration</span>
          <span class="info-value">${safeLicense}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Application Date</span>
          <span class="info-value">${safeDate}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Target Role</span>
          <span class="info-value">${safeRole}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Original Attachment Name</span>
          <span class="info-value">${originalFileName}</span>
        </div>
      </div>

      <div class="section-heading">Application / Experience Summary</div>
      <div class="experience-box">
        ${experienceSummary}
      </div>

      <footer class="actions-strip">
        <a href="mailto:${safeEmail}?subject=${mailSubject}&body=${mailBody}" class="btn btn-primary">
          ✉️ Email Candidate to Request Resume
        </a>
        <a href="tel:${safePhone}" class="btn btn-navy">
          📞 Call Candidate
        </a>
        <button type="button" class="btn btn-outline" onclick="window.print()">
          🖨️ Print / Save Profile as PDF
        </button>
        <button type="button" class="btn btn-outline" onclick="window.close()" style="margin-left: auto;">
          ✕ Close
        </button>
      </footer>
    </main>
  </div>
</body>
</html>`;
}

module.exports = {
  resolveUploadFile,
  generateApplicantDossierHtml
};
