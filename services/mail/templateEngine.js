'use strict';
const { escapeHtml, sanitizeHeader } = require('../../utils/cryptoUtils');

/**
 * Shared Responsive HTML Layout Shell
 * Compliant with modern email clients (Gmail, Outlook, iOS Mail, Android)
 */
function wrapBaseLayout({ title, content, previewText = '', appUrl = 'https://www.divinefingershealthcare.ca' }) {
  const cleanAppUrl = appUrl.replace(/\/$/, '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(title)}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; margin: auto !important; }
      .fluid { max-width: 100% !important; height: auto !important; margin-left: auto !important; margin-right: auto !important; }
      .stack-column, .stack-column-center { display: block !important; width: 100% !important; max-width: 100% !important; direction: ltr !important; }
      .stack-column-center { text-align: center !important; }
      .content-padding { padding: 20px 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F7FA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B;">
  ${previewText ? `<div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; font-family: Open Sans, Helvetica, Arial, sans-serif; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">${escapeHtml(previewText)}</div>` : ''}
  <center style="width: 100%; background-color: #F4F7FA;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F4F7FA;">
      <tr>
        <td align="center" style="padding: 28px 12px;">
          <!-- Main Card Container -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid rgba(26, 58, 99, 0.08); box-shadow: 0 4px 18px rgba(26, 58, 99, 0.04);">
            <!-- Brand Banner Header -->
            <tr>
              <td style="background: linear-gradient(135deg, #0A192F 0%, #1A3A63 100%); padding: 24px 32px; text-align: left; border-bottom: 3px solid #3CAF8A;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td>
                      <h1 style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 20px; font-weight: 800; color: #FFFFFF; letter-spacing: 0.5px;">
                        DIVINE FINGERS <span style="color: #3CAF8A;">HEALTHCARE</span>
                      </h1>
                      <p style="margin: 4px 0 0; font-size: 12px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.8px;">
                        Clinical Staffing &bull; Surge Operations &bull; Ontario
                      </p>
                    </td>
                    <td align="right" style="vertical-align: middle;">
                      <span style="display: inline-block; background: rgba(60, 175, 138, 0.15); border: 1px solid rgba(60, 175, 138, 0.35); color: #3CAF8A; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; text-transform: uppercase;">
                        24/7 Dispatch
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Email Body Content -->
            <tr>
              <td class="content-padding" style="padding: 32px 32px; font-size: 15px; line-height: 1.65; color: #334155;">
                ${content}
              </td>
            </tr>

            <!-- Compliant Operational Footer -->
            <tr>
              <td style="background-color: #F8FAFC; padding: 20px 32px; border-top: 1px solid #E2E8F0; text-align: left; font-size: 12px; color: #64748B; line-height: 1.55;">
                <p style="margin: 0 0 6px;"><strong>Divine Fingers Health Care Services Inc.</strong> (Corp ID: 1592082-5)</p>
                <p style="margin: 0 0 6px;">17-2 Dailing Gate, Scarborough, ON M1B 1Z8 &bull; Dispatch: +1 (647) 210-6463</p>
                <p style="margin: 0 0 6px; color: #94A3B8; font-size: 11px;">
                  This is a privileged healthcare agency transmission. If you received this in error, please notify privacy@divinefingershealthcare.ca immediately.
                </p>
                <p style="margin: 0; font-size: 11px;">
                  <a href="${cleanAppUrl}/contact.html" style="color: #3CAF8A; text-decoration: none; font-weight: 600;">Contact Support</a> &bull; 
                  <a href="${cleanAppUrl}/portal.html" style="color: #3CAF8A; text-decoration: none; font-weight: 600;">Manage Preferences</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;
}

/**
 * Replace Handlebars/Mustache style {{variable}} tags
 */
function interpolate(templateStr, data = {}) {
  return String(templateStr || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, varName) => {
    if (Object.prototype.hasOwnProperty.call(data, varName)) {
      const val = data[varName];
      if (val === null || val === undefined) return '';
      return escapeHtml(String(val));
    }
    return '';
  });
}

/**
 * Replace unescaped variables for raw plain text
 */
function interpolateRaw(templateStr, data = {}) {
  return String(templateStr || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, varName) => {
    if (Object.prototype.hasOwnProperty.call(data, varName)) {
      const val = data[varName];
      return val === null || val === undefined ? '' : String(val);
    }
    return '';
  });
}

/**
 * Compile plain text version from rendered HTML
 */
function htmlToPlainText(html) {
  return String(html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&bull;/gi, '•')
    .replace(/&rarr;/gi, '->')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+\n/g, '\n\n')
    .trim();
}

/**
 * Validate that all required variables are supplied
 */
function validateVariables(requiredVars = [], data = {}) {
  const missing = [];
  const reqList = Array.isArray(requiredVars) ? requiredVars : [];
  for (const v of reqList) {
    if (!Object.prototype.hasOwnProperty.call(data, v) || data[v] === null || data[v] === undefined || String(data[v]).trim() === '') {
      missing.push(v);
    }
  }
  return {
    isValid: missing.length === 0,
    missing
  };
}

/**
 * Compile template body within base layout
 */
function compileTemplate(bodyTemplate, data = {}, options = {}) {
  const interpolatedBody = interpolate(bodyTemplate, data);
  return wrapBaseLayout({
    title: options.title || options.preheader || 'Divine Fingers Healthcare Services',
    content: interpolatedBody,
    previewText: options.preheader || '',
    appUrl: options.appUrl || 'https://www.divinefingershealthcare.ca'
  });
}

module.exports = {
  wrapBaseLayout,
  interpolate,
  interpolateRaw,
  htmlToPlainText,
  validateVariables,
  compileTemplate
};
