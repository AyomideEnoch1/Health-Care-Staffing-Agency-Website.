const fs = require('fs');
const path = require('path');

let html = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');

// 1. Remove duplicate admin accounts section in #settings-tab
const duplicateStart = '<div class="table-card" id="admin-accounts-card"';
const duplicateEnd = '<div class="table-card" style="padding: 1.75rem;">\n            <h2 style="font-size: 1.25rem; font-weight: 800; margin-bottom: 0.5rem;">Security &amp; System Audit Log</h2>';

if (html.includes(duplicateStart)) {
  const sIdx = html.indexOf(duplicateStart);
  const eIdx = html.indexOf(duplicateEnd);
  if (sIdx !== -1 && eIdx !== -1) {
    const replacement = `<div class="table-card" id="admin-accounts-settings-link-card" style="padding: 1.5rem; margin-bottom: 1.5rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
              <div>
                <h3 style="font-size: 1.05rem; font-weight: 800; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem;">
                  <i data-lucide="users" style="width: 18px; height: 18px; color: var(--brand-turquoise);"></i>
                  Administrator Access &amp; Operator Roster
                </h3>
                <p style="color: var(--text-muted); font-size: 0.82rem; margin: 0;">
                  Provision new administrators, configure granular RBAC permissions, and manage 2FA security in the dedicated Administrators Roster.
                </p>
              </div>
              <a href="#admin-users" class="btn-primary-action" style="padding: 0.5rem 1rem; font-size: 0.85rem; text-decoration: none;" onclick="window.switchTab && window.switchTab('admin-users')">
                <i data-lucide="shield-check" style="width: 15px; height: 15px;"></i> Open Administrator Roster
              </a>
            </div>
          </div>

          `;
    html = html.substring(0, sIdx) + replacement + html.substring(eIdx);
    console.log('Successfully de-duplicated admin accounts card in #settings-tab');
  }
}

// 2. Remove the inline hardcoded credentials in the auth overlay if present
html = html.replace('value="admin@divinefingershealthcare.ca"', 'value=""');
html = html.replace('value="AdminSecure2026!"', 'value=""');

// 3. Remove One-Click Instant Access button
const oneClickBtnRegex = /<button type="button" class="btn-secondary-action" id="btn-quick-admin-login"[\s\S]*?<\/button>/;
html = html.replace(oneClickBtnRegex, '');

// 4. Update the "Provision New Administrator" form to feature invite link recommendation
html = html.replace(
  `<label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.35rem;">TEMPORARY PASSWORD *</label>
                  <input type="password" id="dedicated-new-admin-password" required minlength="8" placeholder="Min 8 characters" style="width: 100%; padding: 0.6rem 0.8rem; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-surface); color: var(--text-primary); font-size: 0.85rem;">`,
  `<label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.35rem;">TEMPORARY PASSWORD / ACTIVATION *</label>
                  <input type="password" id="dedicated-new-admin-password" minlength="8" placeholder="Optional: Leave blank to email invite link" style="width: 100%; padding: 0.6rem 0.8rem; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-surface); color: var(--text-primary); font-size: 0.85rem;">
                  <span style="display: block; font-size: 0.7rem; color: var(--text-muted); margin-top: 3px;">🔒 Recommended: Blank password generates single-use activation invite.</span>`
);

const outPath = path.join(__dirname, '../private/admin-dashboard.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('Successfully generated private/admin-dashboard.html (' + html.length + ' bytes)');
