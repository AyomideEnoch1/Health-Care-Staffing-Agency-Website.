'use strict';
/**
 * Sanitized Email Templates
 * Divine Fingers Healthcare Services Inc.
 *
 * Rules:
 * - NO PHI, diagnosis, or sensitive patient data in email bodies.
 * - NO passwords, plaintext credentials, or temporary access codes in email bodies.
 * - All variables are escaped against HTML injection.
 * - Plaintext fallback is automatically compiled alongside HTML.
 */

const { escapeHtml, sanitizeHeader } = require('./cryptoUtils');

const APP_URL = () => (process.env.APP_BASE_URL || process.env.APP_URL || 'https://www.divinefingershealthcare.ca').replace(/\/$/, '');

function wrapTemplate(title, bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="background: #0a192f; padding: 20px 24px; text-align: left;">
      <h2 style="color: #00a896; margin: 0; font-size: 1.25rem; font-weight: 700; letter-spacing: 0.5px;">Divine Fingers Healthcare</h2>
      <p style="color: #94a3b8; margin: 4px 0 0; font-size: 0.8rem;">Clinical Staffing &amp; Healthcare Operations</p>
    </div>
    <div style="padding: 24px;">
      ${bodyContent}
    </div>
    <div style="background: #f1f5f9; padding: 16px 24px; border-top: 1px solid #e2e8f0; font-size: 0.75rem; color: #64748b; line-height: 1.5;">
      <p style="margin: 0 0 6px;"><strong>Divine Fingers Healthcare Services Inc.</strong> (Corp ID: 1592082-5)</p>
      <p style="margin: 0 0 6px;">17-2 Dailing Gate, Scarborough, ON M1B 1Z8 &bull; Direct: +1 (647) 210-6463</p>
      <p style="margin: 0;">This is an automated transmission. Please do not reply directly to this notice.</p>
    </div>
  </div>
</body>
</html>`;
}

const templates = {
  staffing_request_alert: (vars) => {
    const facility = escapeHtml(sanitizeHeader(vars.facility_name || 'Healthcare Facility'));
    const role = escapeHtml(sanitizeHeader(vars.role_requested || 'Clinical Shift'));
    const code = escapeHtml(sanitizeHeader(vars.request_code || 'REF'));
    const urgency = escapeHtml(sanitizeHeader(vars.urgency_level || 'routine'));
    const loginUrl = `${APP_URL()}/admin-login.html`;

    return {
      subject: `🚨 [STAFF REQUEST] ${vars.urgency_level === 'emergency_surge' ? 'URGENT: ' : ''}${facility} — ${role} (${code})`,
      html: wrapTemplate(
        'Staffing Shift Request',
        `<h3 style="color: #0f172a; margin-top: 0;">New Shift Fulfillment Order Received</h3>
         <div style="background: #f8fafc; border-left: 4px solid #00a896; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
           <p style="margin: 4px 0;"><strong>Facility:</strong> ${facility}</p>
           <p style="margin: 4px 0;"><strong>Role Requested:</strong> ${role}</p>
           <p style="margin: 4px 0;"><strong>Urgency Level:</strong> <span style="text-transform: uppercase; font-weight: bold; color: #00a896;">${urgency}</span></p>
           <p style="margin: 4px 0;"><strong>Reference Code:</strong> ${code}</p>
         </div>
         <p style="font-size: 0.9rem; color: #475569;">To protect client and clinical confidentiality under health privacy guidelines, full dispatch details and shift scheduling must be reviewed inside the portal.</p>
         <div style="text-align: center; margin: 24px 0;">
           <a href="${loginUrl}" style="background: #00a896; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Open Dispatch Console</a>
         </div>`
      )
    };
  },

  applicant_confirmation: (vars) => {
    const name = escapeHtml(sanitizeHeader(vars.full_name || 'Candidate'));
    const role = escapeHtml(sanitizeHeader(vars.role_applied || 'Clinical Role'));
    const code = escapeHtml(sanitizeHeader(vars.application_code || 'REF'));

    return {
      subject: `Application Received — Divine Fingers Healthcare (${code})`,
      html: wrapTemplate(
        'Application Acknowledged',
        `<h3 style="color: #0f172a; margin-top: 0;">Application Submitted</h3>
         <p>Hello <strong>${name}</strong>,</p>
         <p>Thank you for submitting your credentials for the <strong>${role}</strong> position at Divine Fingers Healthcare Services Inc.</p>
         <div style="background: #f0fdfa; border: 1px solid #99f6e4; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
           <p style="margin: 0; font-size: 0.9rem; color: #115e59;"><strong>Application Code:</strong> ${code}</p>
         </div>
         <p style="font-size: 0.9rem; color: #334155;">Our clinical compliance desk is reviewing your submission according to CNO and Ontario healthcare standards. We will contact you regarding next steps.</p>`
      )
    };
  },

  admin_verification_otp: (vars) => {
    const name = escapeHtml(sanitizeHeader(vars.full_name || 'Administrator'));
    const otp = escapeHtml(sanitizeHeader(vars.otp_code || ''));

    return {
      subject: `Your Portal Verification Code: ${otp}`,
      html: wrapTemplate(
        'Security Verification',
        `<h3 style="color: #0f172a; margin-top: 0;">Identity Verification Required</h3>
         <p>Hello <strong>${name}</strong>,</p>
         <p>Enter the following single-use verification code to complete your portal sign-in:</p>
         <div style="text-align: center; margin: 24px 0;">
           <span style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0a192f; background: #f0fdfa; padding: 12px 24px; border-radius: 6px; border: 1px solid #00a896;">
             ${otp}
           </span>
         </div>
         <p style="font-size: 0.85rem; color: #64748b;">This code expires in <strong>15 minutes</strong> and is strictly single-use. If you did not initiate this login, notify your security administrator immediately.</p>`
      )
    };
  },

  password_reset: (vars) => {
    const name = escapeHtml(sanitizeHeader(vars.full_name || 'User'));
    const resetUrl = sanitizeHeader(vars.reset_url || '');

    return {
      subject: `Password Reset Request — Divine Fingers Healthcare`,
      text: `Hello ${vars.full_name || 'User'},\n\nA request was received to reset the password for your Divine Fingers account.\nTo choose a new password, visit the secure link below:\n\n${resetUrl}\n\nThis link is single-use and will expire in 20 minutes. If you did not request a password reset, you can safely ignore this message.\n\nDivine Fingers Healthcare Services Inc.`,
      html: wrapTemplate(
        'Password Reset',
        `<h3 style="color: #0f172a; margin-top: 0;">Password Reset Request</h3>
         <p>Hello <strong>${name}</strong>,</p>
         <p>A request was received to reset the password for your Divine Fingers account. Click below to establish a new password:</p>
         <div style="text-align: center; margin: 24px 0;">
           <a href="${resetUrl}" style="background: #00a896; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Reset My Password</a>
         </div>
         <p style="font-size: 0.85rem; color: #64748b;">Or paste this link into your browser:<br><span style="word-break: break-all; font-family: monospace;">${resetUrl}</span></p>
         <p style="font-size: 0.85rem; color: #64748b;">This link is single-use and will expire in <strong>20 minutes</strong>. If you did not request a password reset, you can safely ignore this message.</p>`
      )
    };
  },

  admin_invite: (vars) => {
    const name = escapeHtml(sanitizeHeader(vars.full_name || 'Colleague'));
    const role = escapeHtml(sanitizeHeader(vars.role || 'Staff'));
    const inviteUrl = sanitizeHeader(vars.invite_url || '');

    return {
      subject: `Administrator Access Invitation — Divine Fingers Healthcare`,
      html: wrapTemplate(
        'Portal Invitation',
        `<h3 style="color: #0f172a; margin-top: 0;">Welcome to Divine Fingers Operations</h3>
         <p>Hello <strong>${name}</strong>,</p>
         <p>You have been invited to join the Divine Fingers Healthcare Operations Portal as <strong>${role}</strong>.</p>
         <div style="text-align: center; margin: 24px 0;">
           <a href="${inviteUrl}" style="background: #00a896; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Accept Invitation &amp; Set Password</a>
         </div>
         <p style="font-size: 0.85rem; color: #64748b;">For security compliance, Two-Factor Authentication (TOTP) enrollment will be required upon initial access. This invitation link is valid for 24 hours.</p>`
      )
    };
  },

  staff_welcome: (vars) => {
    const name = escapeHtml(sanitizeHeader(vars.full_name || 'Clinician'));
    const code = escapeHtml(sanitizeHeader(vars.staff_code || 'STAFF'));
    const activationUrl = sanitizeHeader(vars.activation_url || `${APP_URL()}/portal.html`);

    return {
      subject: `Account Approved: Welcome to Divine Fingers Healthcare (${code})`,
      html: wrapTemplate(
        'Staff Roster Approval',
        `<h3 style="color: #0f172a; margin-top: 0;">Welcome to the Clinical Staffing Roster</h3>
         <p>Dear <strong>${name}</strong>,</p>
         <p>Your clinician profile has been approved and enrolled onto our active Ontario healthcare roster with Staff Code <strong>${code}</strong>.</p>
         <p>In accordance with healthcare security standards, account credentials and passwords are never transmitted via plain email. Please click below to activate your account and establish your secure credentials:</p>
         <div style="text-align: center; margin: 24px 0;">
           <a href="${activationUrl}" style="background: #00a896; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Activate Staff Portal Account</a>
         </div>
         <p style="font-size: 0.85rem; color: #475569;">Once signed in, access your <strong>Credentials Vault</strong> to maintain your N95, CPR/BLS, and police background clearance records.</p>`
      )
    };
  },

  newsletter_welcome: (vars) => {
    return {
      subject: `Welcome to Divine Fingers Healthcare Shift & Staffing Alerts`,
      html: wrapTemplate(
        'Subscription Confirmed',
        `<h3 style="color: #0f172a; margin-top: 0;">Subscription Confirmed</h3>
         <p>Thank you for subscribing to Divine Fingers Healthcare staffing and clinical bulletins.</p>
         <p>You will receive updates on Ontario healthcare staffing opportunities, surge coverage, and regulatory compliance notices.</p>`
      )
    };
  },

  contact_ack: (vars) => {
    const name = escapeHtml(sanitizeHeader(vars.name || 'Friend'));
    const code = escapeHtml(sanitizeHeader(vars.inquiry_code || 'INQ'));

    return {
      subject: `We received your inquiry — Divine Fingers Healthcare (${code})`,
      html: wrapTemplate(
        'Inquiry Acknowledged',
        `<h3 style="color: #0f172a; margin-top: 0;">Thank You for Reaching Out</h3>
         <p>Hello <strong>${name}</strong>,</p>
         <p>We have received your message (Reference: <strong>${code}</strong>). A care coordination representative will review your inquiry and follow up promptly.</p>`
      )
    };
  },

  contact_alert: (vars) => {
    const name = escapeHtml(sanitizeHeader(vars.name || 'Visitor'));
    const email = escapeHtml(sanitizeHeader(vars.email || ''));
    const phone = escapeHtml(sanitizeHeader(vars.phone || 'Not provided'));
    const inqType = escapeHtml(sanitizeHeader(vars.inquiry_type || 'General Inquiry'));
    const code = escapeHtml(sanitizeHeader(vars.inquiry_code || 'INQ'));
    const message = escapeHtml(vars.message || '');
    const loginUrl = `${APP_URL()}/admin-login.html`;

    return {
      subject: `📬 [NEW INQUIRY] ${inqType} from ${name} (${code})`,
      html: wrapTemplate(
        'Contact Inquiry Alert',
        `<h3 style="color: #0f172a; margin-top: 0;">New Portal Contact Submission</h3>
         <div style="background: #f8fafc; border-left: 4px solid #00a896; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
           <p style="margin: 4px 0;"><strong>Sender Name:</strong> ${name}</p>
           <p style="margin: 4px 0;"><strong>Email:</strong> ${email}</p>
           <p style="margin: 4px 0;"><strong>Phone:</strong> ${phone}</p>
           <p style="margin: 4px 0;"><strong>Inquiry Type:</strong> ${inqType}</p>
           <p style="margin: 4px 0;"><strong>Reference Code:</strong> ${code}</p>
         </div>
         <p style="margin: 8px 0 4px; font-weight: bold;">Message Content:</p>
         <blockquote style="background: #f1f5f9; padding: 12px 16px; border-radius: 4px; margin: 0 0 16px; font-style: italic; color: #334155; white-space: pre-wrap;">${message}</blockquote>
         <div style="text-align: center; margin: 20px 0;">
           <a href="${loginUrl}" style="background: #00a896; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Open Admin Operations Console</a>
         </div>`
      )
    };
  },

  client_request_ack: (vars) => {
    const facility = escapeHtml(sanitizeHeader(vars.facility_name || 'Healthcare Facility'));
    const contact = escapeHtml(sanitizeHeader(vars.contact_name || 'Facility Coordinator'));
    const role = escapeHtml(sanitizeHeader(vars.role_requested || 'Clinical Shift'));
    const code = escapeHtml(sanitizeHeader(vars.request_code || 'REF'));
    const shiftType = escapeHtml(sanitizeHeader(vars.shift_type || 'Standard'));

    return {
      subject: `Shift Order Confirmation: Divine Fingers Healthcare (${code})`,
      html: wrapTemplate(
        'Shift Order Received',
        `<h3 style="color: #0f172a; margin-top: 0;">Staffing Order Acknowledged</h3>
         <p>Dear <strong>${contact}</strong>,</p>
         <p>We have successfully received your shift fulfillment request for <strong>${facility}</strong>.</p>
         <div style="background: #f0fdfa; border: 1px solid #99f6e4; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
           <p style="margin: 4px 0;"><strong>Order Reference:</strong> ${code}</p>
           <p style="margin: 4px 0;"><strong>Role Requested:</strong> ${role}</p>
           <p style="margin: 4px 0;"><strong>Shift Timing:</strong> ${shiftType}</p>
         </div>
         <p style="font-size: 0.9rem; color: #334155;">Our on-call clinical dispatch coordinators are matching your order against qualified and credentialed roster nurses and PSWs. You will receive a notification as soon as staffing is assigned.</p>
         <p style="font-size: 0.85rem; color: #64748b;">For urgent amendments or emergency surge adjustments, contact the 24/7 Dispatch Desk at +1 (647) 210-6463.</p>`
      )
    };
  },

  shift_assigned_staff: (vars) => {
    const name = escapeHtml(sanitizeHeader(vars.staff_name || 'Clinician'));
    const facility = escapeHtml(sanitizeHeader(vars.facility_name || 'Facility'));
    const unit = escapeHtml(sanitizeHeader(vars.unit_department || 'General Care'));
    const role = escapeHtml(sanitizeHeader(vars.role_requested || 'Clinical Staff'));
    const shiftType = escapeHtml(sanitizeHeader(vars.shift_type || 'Scheduled Shift'));
    const code = escapeHtml(sanitizeHeader(vars.request_code || 'REF'));
    const portalUrl = `${APP_URL()}/portal.html`;

    return {
      subject: `📋 Shift Assigned: ${facility} — ${role} (${code})`,
      html: wrapTemplate(
        'Shift Assignment Notice',
        `<h3 style="color: #0f172a; margin-top: 0;">New Shift Assignment</h3>
         <p>Hello <strong>${name}</strong>,</p>
         <p>You have been assigned to an upcoming shift with Divine Fingers Healthcare Services Inc.</p>
         <div style="background: #f8fafc; border-left: 4px solid #00a896; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
           <p style="margin: 4px 0;"><strong>Facility:</strong> ${facility}</p>
           <p style="margin: 4px 0;"><strong>Unit / Ward:</strong> ${unit}</p>
           <p style="margin: 4px 0;"><strong>Role:</strong> ${role}</p>
           <p style="margin: 4px 0;"><strong>Shift Type:</strong> ${shiftType}</p>
           <p style="margin: 4px 0;"><strong>Reference:</strong> ${code}</p>
         </div>
         <p style="font-size: 0.9rem; color: #475569;">Please log into the Staff Portal to review parking details, PPE requirements, and to complete Electronic Visit Verification (EVV) upon arrival:</p>
         <div style="text-align: center; margin: 20px 0;">
           <a href="${portalUrl}" style="background: #00a896; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Open Staff Portal</a>
         </div>`
      )
    };
  },

  application_alert: (vars) => {
    const name = escapeHtml(sanitizeHeader(vars.full_name || 'Candidate'));
    const role = escapeHtml(sanitizeHeader(vars.role_applied || 'Clinical Staff'));
    const code = escapeHtml(sanitizeHeader(vars.application_code || 'REF'));
    const email = escapeHtml(sanitizeHeader(vars.email || ''));
    const phone = escapeHtml(sanitizeHeader(vars.phone || ''));
    const loginUrl = `${APP_URL()}/admin-login.html`;

    return {
      subject: `👩‍⚕️ [NEW APPLICANT] ${role}: ${name} (${code})`,
      html: wrapTemplate(
        'New Applicant Submission',
        `<h3 style="color: #0f172a; margin-top: 0;">New Clinician Application Submitted</h3>
         <div style="background: #f8fafc; border-left: 4px solid #00a896; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
           <p style="margin: 4px 0;"><strong>Applicant Name:</strong> ${name}</p>
           <p style="margin: 4px 0;"><strong>Role Applied:</strong> ${role}</p>
           <p style="margin: 4px 0;"><strong>Email:</strong> ${email}</p>
           <p style="margin: 4px 0;"><strong>Phone:</strong> ${phone}</p>
           <p style="margin: 4px 0;"><strong>Application Reference:</strong> ${code}</p>
         </div>
         <p style="font-size: 0.9rem; color: #475569;">Credentials and uploaded resume are ready for clinical onboarding review inside the Operations Console.</p>
         <div style="text-align: center; margin: 20px 0;">
           <a href="${loginUrl}" style="background: #00a896; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Review Application</a>
         </div>`
      )
    };
  }
};

function render(type, vars) {
  const t = templates[type];
  if (!t) {
    throw new Error(`Unknown email template: "${type}"`);
  }
  const rendered = t(vars || {});
  // Generate plaintext version automatically
  const text = String(rendered.html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    subject: rendered.subject,
    html: rendered.html,
    text
  };
}

module.exports = { render, templates: Object.keys(templates) };
