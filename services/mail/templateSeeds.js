'use strict';
const crypto = require('crypto');

/**
 * Standard Default Email Templates for Divine Fingers Healthcare
 * Covers Authentication, Staff, Client, Admin, and Marketing categories.
 */
const SEED_TEMPLATES = [
  // ── 1. AUTHENTICATION & ACCOUNT ───────────────────────────────────────────
  {
    template_key: 'auth_welcome',
    name: 'Welcome & Account Created',
    category: 'authentication',
    subject: 'Welcome to Divine Fingers Healthcare — Account Ready',
    required_vars: ['first_name', 'email', 'login_url'],
    sample_vars: { first_name: 'John', email: 'john@example.com', login_url: 'https://www.divinefingershealthcare.ca/login.html' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Welcome, {{first_name}}!</h2>
      <p>Your secure account for <strong>{{email}}</strong> has been provisioned and is ready for access.</p>
      <div style="background: #F0FDFA; border: 1px solid #99F6E4; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px; color: #115E59;">Please sign in to configure your notification settings and complete profile verification.</p>
      </div>
      <div style="text-align: center; margin: 26px 0;">
        <a href="{{login_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Sign In to Portal</a>
      </div>
    `
  },
  {
    template_key: 'auth_email_verification',
    name: 'Email Address Verification',
    category: 'authentication',
    subject: 'Verify Your Email — Divine Fingers Healthcare',
    required_vars: ['first_name', 'verification_url', 'otp_code'],
    sample_vars: { first_name: 'Jane', verification_url: 'https://www.divinefingershealthcare.ca/verify?token=abc', otp_code: '492810' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Verify Your Email Address</h2>
      <p>Hello {{first_name}}, please verify your email address to enable communications and roster access.</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #0A192F; background: #F0FDFA; padding: 12px 24px; border-radius: 8px; border: 1.5px solid #3CAF8A; display: inline-block;">
          {{otp_code}}
        </span>
      </div>
      <p style="text-align: center; font-size: 13px; color: #64748B;">Or click below to verify directly:</p>
      <div style="text-align: center; margin: 16px 0;">
        <a href="{{verification_url}}" style="background: #1A3A63; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Verify Email</a>
      </div>
      <p style="font-size: 12px; color: #94A3B8;">Code expires in 30 minutes.</p>
    `
  },
  {
    template_key: 'auth_admin_login_otp',
    name: 'Admin Sign-In Verification Code (OTP)',
    category: 'authentication',
    subject: '🔐 Your Divine Fingers Admin Verification Code: {{otp_code}}',
    required_vars: ['full_name', 'otp_code', 'expires_in_minutes'],
    sample_vars: { full_name: 'Administrator', otp_code: '492810', expires_in_minutes: '10' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Admin Sign-In Verification</h2>
      <p>Hello <strong>{{full_name}}</strong>,</p>
      <p>A sign-in request was initiated for your Divine Fingers Healthcare Administrator account.</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0A192F; background: #F0FDFA; padding: 14px 28px; border-radius: 8px; border: 2px solid #3CAF8A; display: inline-block;">
          {{otp_code}}
        </span>
      </div>
      <p style="text-align: center; font-size: 13px; color: #64748B;">This one-time passcode is valid for <strong>{{expires_in_minutes}} minutes</strong> and can only be used once.</p>
      <div style="background: #FFFBEB; border: 1px solid #FCD34D; padding: 12px 16px; border-radius: 6px; margin: 20px 0; font-size: 13px; color: #92400E;">
        <strong>Security Notice:</strong> If you did not initiate this sign-in attempt, please immediately change your administrator password and notify clinical operations.
      </div>
    `
  },
  {
    template_key: 'auth_password_reset',
    name: 'Password Reset Request',
    category: 'authentication',
    subject: 'Password Reset Request — Divine Fingers Healthcare',
    required_vars: ['first_name', 'reset_url'],
    sample_vars: { first_name: 'David', reset_url: 'https://www.divinefingershealthcare.ca/login.html?token=xyz' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Reset Your Password</h2>
      <p>Hello {{first_name}}, a request was received to reset the password for your account.</p>
      <div style="text-align: center; margin: 26px 0;">
        <a href="{{reset_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Reset Password</a>
      </div>
      <p style="font-size: 13px; color: #64748B;">This link is valid for 20 minutes. If you did not request this, please disregard this email.</p>
    `
  },
  {
    template_key: 'auth_password_changed',
    name: 'Password Changed Confirmation',
    category: 'authentication',
    subject: 'Security Alert: Password Changed Successfully',
    required_vars: ['first_name', 'changed_at'],
    sample_vars: { first_name: 'David', changed_at: '2026-10-21 21:00 UTC' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Password Successfully Changed</h2>
      <p>Hello {{first_name}}, the password for your Divine Fingers Healthcare account was updated on <strong>{{changed_at}}</strong>.</p>
      <p style="font-size: 13px; color: #E11D48;">If you did not make this change, please contact our security team immediately at dispatch@divinefingershealthcare.ca or +1 (647) 210-6463.</p>
    `
  },
  {
    template_key: 'auth_login_new_device',
    name: 'Login From New Device',
    category: 'authentication',
    subject: 'Security Notice: New Sign-In Detected',
    required_vars: ['first_name', 'ip_address', 'device_info', 'login_time'],
    sample_vars: { first_name: 'Sarah', ip_address: '142.250.190.46', device_info: 'Chrome on macOS', login_time: '2026-10-21 21:15 UTC' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">New Sign-In Detected</h2>
      <p>Hello {{first_name}}, a sign-in to your portal was recorded from a new device:</p>
      <div style="background: #F8FAFC; border-left: 4px solid #1BAECF; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 4px 0;"><strong>Device / Browser:</strong> {{device_info}}</p>
        <p style="margin: 4px 0;"><strong>IP Address:</strong> {{ip_address}}</p>
        <p style="margin: 4px 0;"><strong>Timestamp:</strong> {{login_time}}</p>
      </div>
      <p style="font-size: 13px; color: #64748B;">If this was you, no action is needed. Otherwise, reset your password immediately.</p>
    `
  },
  {
    template_key: 'auth_account_archived',
    name: 'Account Archived',
    category: 'authentication',
    subject: 'Notice: Account Placed in Archive Vault',
    required_vars: ['first_name', 'reason'],
    sample_vars: { first_name: 'Mark', reason: 'Staff member requested inactive status' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Account Archived</h2>
      <p>Hello {{first_name}}, your account has been placed in the Divine Fingers archive vault.</p>
      <p><strong>Reason:</strong> {{reason}}</p>
      <p style="font-size: 13px; color: #64748B;">All records and historical credentials are maintained in accordance with our 7-year regulatory retention policy. Contact clinical dispatch to request reactivation.</p>
    `
  },
  {
    template_key: 'auth_account_restored',
    name: 'Account Restored from Archive',
    category: 'authentication',
    subject: 'Account Reactivated: Welcome Back',
    required_vars: ['first_name', 'login_url'],
    sample_vars: { first_name: 'Mark', login_url: 'https://www.divinefingershealthcare.ca/login.html' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Account Restored</h2>
      <p>Hello {{first_name}}, your account has been successfully restored from the archive vault. Your portal access and active permissions are restored.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{login_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Access Portal</a>
      </div>
    `
  },

  // ── 2. STAFF WORKFLOWS ────────────────────────────────────────────────────
  {
    template_key: 'staff_application_received',
    name: 'Staff Application Received',
    category: 'staff',
    subject: 'Application Received: Divine Fingers Healthcare ({{application_code}})',
    required_vars: ['first_name', 'role_applied', 'application_code'],
    sample_vars: { first_name: 'David', role_applied: 'Registered Nurse (RN)', application_code: 'APP-RN981' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Application Received</h2>
      <p>Hello {{first_name}}, thank you for applying for the <strong>{{role_applied}}</strong> position with Divine Fingers Healthcare Services Inc.</p>
      <div style="background: #F0FDFA; border: 1px solid #99F6E4; padding: 14px 18px; border-radius: 8px; margin: 18px 0;">
        <p style="margin: 0; font-size: 14px; color: #115E59;"><strong>Reference Code:</strong> {{application_code}}</p>
      </div>
      <p style="font-size: 14px; color: #334155;">Our clinical onboarding desk reviews credentials in accordance with CNO and Ontario healthcare standards. You will be notified as soon as initial vetting is complete.</p>
    `
  },
  {
    template_key: 'staff_application_shortlisted',
    name: 'Application Shortlisted',
    category: 'staff',
    subject: 'Application Update: You Have Been Shortlisted! ({{application_code}})',
    required_vars: ['first_name', 'role_applied', 'application_code'],
    sample_vars: { first_name: 'David', role_applied: 'Registered Nurse (RN)', application_code: 'APP-RN981' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Great News, {{first_name}}!</h2>
      <p>Your application for <strong>{{role_applied}}</strong> has been shortlisted by our clinical recruitment committee.</p>
      <p>Our staffing coordinator will be in touch shortly to schedule your clinical interview and document intake.</p>
    `
  },
  {
    template_key: 'staff_interview_invitation',
    name: 'Interview Invitation',
    category: 'staff',
    subject: 'Interview Invitation — Divine Fingers Healthcare',
    required_vars: ['first_name', 'role_applied', 'interview_date', 'interview_time', 'meeting_link'],
    sample_vars: { first_name: 'David', role_applied: 'RN', interview_date: 'October 25, 2026', interview_time: '10:00 AM EDT', meeting_link: 'https://meet.google.com/xyz' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Clinical Interview Scheduled</h2>
      <p>Hello {{first_name}}, you are invited to a clinical interview for the <strong>{{role_applied}}</strong> position.</p>
      <div style="background: #F8FAFC; border-left: 4px solid #3CAF8A; padding: 14px 18px; margin: 18px 0; border-radius: 6px;">
        <p style="margin: 4px 0;"><strong>Date:</strong> {{interview_date}}</p>
        <p style="margin: 4px 0;"><strong>Time:</strong> {{interview_time}}</p>
        <p style="margin: 4px 0;"><strong>Format:</strong> Video Conference</p>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{meeting_link}}" style="background: #3CAF8A; color: #FFFFFF; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Join Video Interview</a>
      </div>
    `
  },
  {
    template_key: 'staff_shift_offer',
    name: 'New Shift Offer',
    category: 'staff',
    subject: 'Shift Opportunity Available: {{facility_name}} — {{shift_date}}',
    required_vars: ['first_name', 'facility_name', 'role_requested', 'shift_date', 'shift_time', 'hourly_rate', 'claim_url'],
    sample_vars: { first_name: 'Mary', facility_name: 'Seven Oaks Long-Term Care', role_requested: 'PSW', shift_date: 'Oct 23, 2026', shift_time: '07:00 - 15:00', hourly_rate: '$28.50/hr', claim_url: 'https://www.divinefingershealthcare.ca/portal.html#shifts' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">New Shift Available for Claiming</h2>
      <p>Hello {{first_name}}, a shift matching your credentials and region is open for claiming:</p>
      <div style="background: #F8FAFC; border-left: 4px solid #3CAF8A; padding: 14px 18px; margin: 18px 0; border-radius: 6px;">
        <p style="margin: 4px 0;"><strong>Facility:</strong> {{facility_name}}</p>
        <p style="margin: 4px 0;"><strong>Role:</strong> {{role_requested}}</p>
        <p style="margin: 4px 0;"><strong>Date:</strong> {{shift_date}}</p>
        <p style="margin: 4px 0;"><strong>Hours:</strong> {{shift_time}}</p>
        <p style="margin: 4px 0;"><strong>Pay Rate:</strong> <span style="color: #3CAF8A; font-weight: 700;">{{hourly_rate}}</span></p>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{claim_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Claim Shift Now</a>
      </div>
      <p style="font-size: 12px; color: #94A3B8;">Shifts are awarded on a first-come, first-confirmed basis.</p>
    `
  },
  {
    template_key: 'staff_shift_confirmed',
    name: 'Shift Confirmed',
    category: 'staff',
    subject: 'Shift Confirmed: {{facility_name}} ({{shift_date}})',
    required_vars: ['first_name', 'facility_name', 'role_requested', 'shift_date', 'shift_time', 'unit_department', 'portal_url'],
    sample_vars: { first_name: 'Mary', facility_name: 'Seven Oaks Long-Term Care', role_requested: 'PSW', shift_date: 'Oct 23, 2026', shift_time: '07:00 - 15:00', unit_department: '3rd Floor West', portal_url: 'https://www.divinefingershealthcare.ca/portal.html' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Shift Confirmation</h2>
      <p>Hello {{first_name}}, you are confirmed for the following upcoming clinical shift:</p>
      <div style="background: #F0FDFA; border: 1px solid #99F6E4; padding: 14px 18px; border-radius: 6px; margin: 18px 0;">
        <p style="margin: 4px 0;"><strong>Facility:</strong> {{facility_name}}</p>
        <p style="margin: 4px 0;"><strong>Unit / Ward:</strong> {{unit_department}}</p>
        <p style="margin: 4px 0;"><strong>Role:</strong> {{role_requested}}</p>
        <p style="margin: 4px 0;"><strong>Date &amp; Time:</strong> {{shift_date}} &bull; {{shift_time}}</p>
      </div>
      <p style="font-size: 14px; color: #334155;">Remember to arrive in agency-standard scrubs with your photo ID and complete your EVV GPS Clock-In via the Staff Portal upon arrival.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{portal_url}}" style="background: #1A3A63; color: #FFFFFF; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Open Shift Telemetry</a>
      </div>
    `
  },
  {
    template_key: 'staff_shift_cancelled',
    name: 'Shift Cancelled',
    category: 'staff',
    subject: 'Shift Cancellation Notice: {{facility_name}} ({{shift_date}})',
    required_vars: ['first_name', 'facility_name', 'shift_date', 'reason'],
    sample_vars: { first_name: 'Mary', facility_name: 'Seven Oaks', shift_date: 'Oct 23, 2026', reason: 'Facility census decreased' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Shift Cancellation Notice</h2>
      <p>Hello {{first_name}}, the facility has cancelled the following shift assignment:</p>
      <div style="background: #FFF1F2; border: 1px solid #FECDD3; padding: 14px 18px; border-radius: 6px; margin: 18px 0;">
        <p style="margin: 4px 0;"><strong>Facility:</strong> {{facility_name}}</p>
        <p style="margin: 4px 0;"><strong>Date:</strong> {{shift_date}}</p>
        <p style="margin: 4px 0;"><strong>Reason:</strong> {{reason}}</p>
      </div>
      <p style="font-size: 14px; color: #334155;">Our dispatch desk is matching you with alternate shifts in your area.</p>
    `
  },
  {
    template_key: 'staff_shift_reminder_24h',
    name: 'Shift Reminder (24 Hours)',
    category: 'staff',
    subject: 'Reminder: Upcoming Shift Tomorrow at {{facility_name}}',
    required_vars: ['first_name', 'facility_name', 'shift_date', 'shift_time'],
    sample_vars: { first_name: 'Mary', facility_name: 'Mount Sinai', shift_date: 'Tomorrow, Oct 22', shift_time: '07:00 - 15:00' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Upcoming Shift in 24 Hours</h2>
      <p>Hello {{first_name}}, this is a friendly reminder of your upcoming shift tomorrow:</p>
      <div style="background: #F8FAFC; border-left: 4px solid #3CAF8A; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 4px 0;"><strong>Facility:</strong> {{facility_name}}</p>
        <p style="margin: 4px 0;"><strong>Schedule:</strong> {{shift_date}} at {{shift_time}}</p>
      </div>
      <p style="font-size: 13px; color: #64748B;">Please ensure you are well-rested and bring your required PPE and agency ID badge.</p>
    `
  },
  {
    template_key: 'staff_timesheet_approved',
    name: 'Timesheet Approved',
    category: 'staff',
    subject: 'Timesheet Approved for {{facility_name}} ({{shift_date}})',
    required_vars: ['first_name', 'facility_name', 'shift_date', 'hours_worked', 'total_amount'],
    sample_vars: { first_name: 'David', facility_name: 'Sunnybrook Health', shift_date: 'Oct 20, 2026', hours_worked: '8.0 hrs', total_amount: '$360.00' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Timesheet Approved</h2>
      <p>Hello {{first_name}}, your timesheet has been approved by the facility supervisor:</p>
      <div style="background: #F0FDFA; border: 1px solid #99F6E4; padding: 14px 18px; border-radius: 6px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Facility:</strong> {{facility_name}}</p>
        <p style="margin: 4px 0;"><strong>Shift Date:</strong> {{shift_date}}</p>
        <p style="margin: 4px 0;"><strong>Logged Hours:</strong> {{hours_worked}}</p>
        <p style="margin: 4px 0;"><strong>Approved Amount:</strong> <strong style="color: #3CAF8A;">{{total_amount}}</strong></p>
      </div>
      <p style="font-size: 13px; color: #64748B;">This entry has been queued for our next payroll disbursement cycle.</p>
    `
  },
  {
    template_key: 'staff_document_expiry_30d',
    name: 'Document Expiry Warning (30 Days)',
    category: 'staff',
    subject: 'Action Required: Clinical Credential Expiring in 30 Days',
    required_vars: ['first_name', 'document_name', 'expiry_date', 'upload_url'],
    sample_vars: { first_name: 'David', document_name: 'CPR / BLS Certification', expiry_date: 'Nov 20, 2026', upload_url: 'https://www.divinefingershealthcare.ca/portal.html#credentials' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Credential Renewal Notice (30 Days)</h2>
      <p>Hello {{first_name}}, our compliance tracking system indicates that your <strong>{{document_name}}</strong> will expire on <strong>{{expiry_date}}</strong>.</p>
      <p>To avoid any disruption to your shift eligibility and active roster status, please obtain recertification and upload your new document:</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{upload_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Upload New Credential</a>
      </div>
    `
  },

  // ── 3. CLIENT WORKFLOWS ───────────────────────────────────────────────────
  {
    template_key: 'client_welcome',
    name: 'Client Welcome & Onboarding',
    category: 'client',
    subject: 'Welcome to Divine Fingers Healthcare — Client Portal Activated',
    required_vars: ['contact_name', 'facility_name', 'login_url'],
    sample_vars: { contact_name: 'Sarah Connor', facility_name: 'Toronto General Hospital', login_url: 'https://www.divinefingershealthcare.ca/login.html' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Welcome, {{contact_name}}</h2>
      <p>Your client portal account for <strong>{{facility_name}}</strong> has been activated.</p>
      <div style="background: #F0FDFA; border: 1px solid #99F6E4; padding: 14px 18px; border-radius: 6px; margin: 18px 0;">
        <p style="margin: 4px 0;"><strong>Facility:</strong> {{facility_name}}</p>
        <p style="margin: 4px 0;"><strong>Portal Access:</strong> 24/7 Shift Orders, Clinician Telemetry &amp; Invoices</p>
      </div>
      <p style="font-size: 14px; color: #334155;">From your portal you can place single, recurring, and emergency surge shift requests, view EVV GPS tracking, and review vetted nurse certifications.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{login_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Access Client Portal</a>
      </div>
    `
  },
  {
    template_key: 'client_request_confirmation',
    name: 'Staffing Request Confirmation',
    category: 'client',
    subject: 'Staffing Order Confirmation: {{facility_name}} ({{request_code}})',
    required_vars: ['contact_name', 'facility_name', 'role_requested', 'shift_type', 'request_code'],
    sample_vars: { contact_name: 'Sarah Connor', facility_name: 'Toronto General Hospital', role_requested: 'RN Intensive Care', shift_type: 'Night 23:00 - 07:00', request_code: 'REQ-9102' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Staffing Order Received</h2>
      <p>Dear {{contact_name}}, we have successfully logged your staffing order for <strong>{{facility_name}}</strong>.</p>
      <div style="background: #F0FDFA; border: 1px solid #99F6E4; padding: 14px 18px; border-radius: 6px; margin: 18px 0;">
        <p style="margin: 4px 0;"><strong>Order Reference:</strong> {{request_code}}</p>
        <p style="margin: 4px 0;"><strong>Role Requested:</strong> {{role_requested}}</p>
        <p style="margin: 4px 0;"><strong>Shift Timing:</strong> {{shift_type}}</p>
      </div>
      <p style="font-size: 14px; color: #334155;">Our on-call clinical dispatch coordinators are matching your order against qualified and vetted roster nurses and PSWs. You will receive a notification as soon as staffing is assigned.</p>
    `
  },
  {
    template_key: 'client_staff_assigned',
    name: 'Staff Assigned to Shift',
    category: 'client',
    subject: 'Staff Confirmed for Shift: {{facility_name}} ({{request_code}})',
    required_vars: ['contact_name', 'facility_name', 'staff_name', 'role_requested', 'shift_date', 'shift_time', 'request_code'],
    sample_vars: { contact_name: 'Sarah Connor', facility_name: 'Toronto General', staff_name: 'Nurse David (RN-1022)', role_requested: 'RN', shift_date: 'Oct 23, 2026', shift_time: '07:00 - 15:00', request_code: 'REQ-9102' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Staff Assigned &amp; Confirmed</h2>
      <p>Dear {{contact_name}}, a qualified healthcare professional has been assigned to your shift order:</p>
      <div style="background: #F8FAFC; border-left: 4px solid #3CAF8A; padding: 14px 18px; margin: 18px 0; border-radius: 6px;">
        <p style="margin: 4px 0;"><strong>Assigned Clinician:</strong> {{staff_name}}</p>
        <p style="margin: 4px 0;"><strong>Discipline:</strong> {{role_requested}}</p>
        <p style="margin: 4px 0;"><strong>Date &amp; Time:</strong> {{shift_date}} &bull; {{shift_time}}</p>
        <p style="margin: 4px 0;"><strong>Order Reference:</strong> {{request_code}}</p>
      </div>
      <p style="font-size: 13px; color: #475569;">All background verification and clinical certifications (CNO, N95, CPR) are validated in our compliance vault.</p>
    `
  },
  {
    template_key: 'client_invoice_issued',
    name: 'Invoice Issued',
    category: 'client',
    subject: 'Invoice {{invoice_number}} from Divine Fingers Healthcare',
    required_vars: ['contact_name', 'facility_name', 'invoice_number', 'amount_due', 'due_date', 'invoice_url'],
    sample_vars: { contact_name: 'Sarah Connor', facility_name: 'Toronto General', invoice_number: 'INV-2026-104', amount_due: '$3,420.00 CAD', due_date: 'November 15, 2026', invoice_url: 'https://www.divinefingershealthcare.ca/portal.html#billing' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Invoice Issued</h2>
      <p>Dear {{contact_name}}, invoice <strong>{{invoice_number}}</strong> for healthcare staffing services provided to <strong>{{facility_name}}</strong> is now available.</p>
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 14px 18px; border-radius: 6px; margin: 18px 0;">
        <p style="margin: 4px 0;"><strong>Invoice Number:</strong> {{invoice_number}}</p>
        <p style="margin: 4px 0;"><strong>Amount Due:</strong> <strong style="color: #0A192F; font-size: 16px;">{{amount_due}}</strong></p>
        <p style="margin: 4px 0;"><strong>Payment Due Date:</strong> {{due_date}}</p>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{invoice_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">View &amp; Pay Invoice</a>
      </div>
    `
  },

  // ── 4. ADMIN WORKFLOWS ────────────────────────────────────────────────────
  {
    template_key: 'admin_new_staff_application',
    name: 'Admin: New Staff Application Alert',
    category: 'admin',
    subject: '👩‍⚕️ [NEW CANDIDATE] {{role_applied}}: {{full_name}} ({{application_code}})',
    required_vars: ['full_name', 'role_applied', 'application_code', 'email', 'phone', 'admin_url'],
    sample_vars: { full_name: 'David Adeleke', role_applied: 'RN', application_code: 'APP-9988', email: 'david@example.com', phone: '+1 647 555 0199', admin_url: 'https://www.divinefingershealthcare.ca/admin-login.html' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">New Clinician Application Submitted</h2>
      <div style="background: #F8FAFC; border-left: 4px solid #3CAF8A; padding: 14px 18px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 4px 0;"><strong>Candidate:</strong> {{full_name}}</p>
        <p style="margin: 4px 0;"><strong>Discipline:</strong> {{role_applied}}</p>
        <p style="margin: 4px 0;"><strong>Email:</strong> {{email}}</p>
        <p style="margin: 4px 0;"><strong>Phone:</strong> {{phone}}</p>
        <p style="margin: 4px 0;"><strong>Application Reference:</strong> {{application_code}}</p>
      </div>
      <p style="font-size: 13px; color: #64748B;">Resume and clinical credentials are ready for compliance review in the Operations Console.</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="{{admin_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Review Application</a>
      </div>
    `
  },
  {
    template_key: 'admin_new_staff_request',
    name: 'Admin: New Staff Request Alert',
    category: 'admin',
    subject: '🚨 [STAFF REQUEST] {{urgency_level}}: {{facility_name}} — {{role_requested}} ({{request_code}})',
    required_vars: ['facility_name', 'role_requested', 'urgency_level', 'request_code', 'admin_url'],
    sample_vars: { facility_name: 'Sunnybrook Health', role_requested: 'RN Acute Care', urgency_level: 'routine', request_code: 'REQ-4011', admin_url: 'https://www.divinefingershealthcare.ca/admin-login.html' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">New Staffing Shift Request</h2>
      <div style="background: #F8FAFC; border-left: 4px solid #3CAF8A; padding: 14px 18px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 4px 0;"><strong>Facility:</strong> {{facility_name}}</p>
        <p style="margin: 4px 0;"><strong>Role Requested:</strong> {{role_requested}}</p>
        <p style="margin: 4px 0;"><strong>Urgency Level:</strong> <span style="text-transform: uppercase; font-weight: 700; color: #3CAF8A;">{{urgency_level}}</span></p>
        <p style="margin: 4px 0;"><strong>Order Code:</strong> {{request_code}}</p>
      </div>
      <div style="text-align: center; margin: 20px 0;">
        <a href="{{admin_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Open Dispatch Console</a>
      </div>
    `
  },
  {
    template_key: 'admin_new_client_registered',
    name: 'Admin: New Client Registered',
    category: 'admin',
    subject: '🏥 [NEW CLIENT] {{organization_name}} — {{full_name}}',
    required_vars: ['organization_name', 'full_name', 'email', 'phone', 'admin_url'],
    sample_vars: { organization_name: 'Scarborough Health Network', full_name: 'Jane Doe', email: 'jane@shn.ca', phone: '+1 416 555 0100', admin_url: 'https://www.divinefingershealthcare.ca/admin-login.html' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">New Facility Client Account Registered</h2>
      <div style="background: #F8FAFC; border-left: 4px solid #1BAECF; padding: 14px 18px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 4px 0;"><strong>Organization:</strong> {{organization_name}}</p>
        <p style="margin: 4px 0;"><strong>Contact Name:</strong> {{full_name}}</p>
        <p style="margin: 4px 0;"><strong>Email:</strong> {{email}}</p>
        <p style="margin: 4px 0;"><strong>Phone:</strong> {{phone}}</p>
      </div>
      <div style="text-align: center; margin: 20px 0;">
        <a href="{{admin_url}}" style="background: #1A3A63; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Open Client Directory</a>
      </div>
    `
  },

  // ── 5. MARKETING & ANNOUNCEMENTS ──────────────────────────────────────────
  {
    template_key: 'marketing_announcement',
    name: 'General Announcement / Bulletin',
    category: 'marketing',
    subject: '{{headline}} — Divine Fingers Healthcare',
    required_vars: ['recipient_name', 'headline', 'announcement_body', 'action_url', 'action_label'],
    sample_vars: { recipient_name: 'Valued Partner', headline: 'Winter Surge Staffing Protocols', announcement_body: 'In response to regional seasonal surge volumes, Divine Fingers has activated extended on-call dispatch coverage across all hospital networks.', action_url: 'https://www.divinefingershealthcare.ca/portal.html', action_label: 'Read Full Bulletin' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">{{headline}}</h2>
      <p>Dear {{recipient_name}},</p>
      <div style="font-size: 15px; line-height: 1.7; color: #334155;">
        {{announcement_body}}
      </div>
      <div style="text-align: center; margin: 26px 0;">
        <a href="{{action_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">{{action_label}}</a>
      </div>
    `
  },
  {
    template_key: 'auth_account_suspended',
    name: 'Account Suspended Notice',
    category: 'authentication',
    subject: 'Important: Your Divine Fingers Account Has Been Suspended',
    required_vars: ['first_name', 'reason', 'support_email'],
    sample_vars: { first_name: 'Alex', reason: 'Compliance document lapse', support_email: 'compliance@divinefingershealthcare.ca' },
    body_html: `
      <h2 style="color: #DC2626; margin-top: 0;">Account Suspended</h2>
      <p>Hello {{first_name}}, your account access has been temporarily suspended.</p>
      <div style="background: #FEF2F2; border-left: 4px solid #DC2626; padding: 12px 16px; margin: 16px 0;">
        <p style="margin: 0; color: #991B1B;"><strong>Reason:</strong> {{reason}}</p>
      </div>
      <p>Please contact our operations and compliance office at <a href="mailto:{{support_email}}">{{support_email}}</a> to restore your credentials.</p>
    `
  },
  {
    template_key: 'staff_application_rejected',
    name: 'Staff Application Outcome: Not Selected',
    category: 'staff',
    subject: 'Update Regarding Your Application with Divine Fingers Healthcare',
    required_vars: ['first_name', 'role_applied'],
    sample_vars: { first_name: 'David', role_applied: 'Registered Nurse' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Application Status Update</h2>
      <p>Dear {{first_name}},</p>
      <p>Thank you for your interest in joining Divine Fingers Healthcare as a <strong>{{role_applied}}</strong>. After careful review of candidate qualifications against our current placement requirements, we will not be moving forward with your application at this time.</p>
      <p>We will keep your resume in our talent database for six months should future opportunities align with your profile.</p>
    `
  },
  {
    template_key: 'staff_application_hired',
    name: 'Staff Application: Offer & Hired',
    category: 'staff',
    subject: '🎉 Congratulations! You have been accepted to Divine Fingers Healthcare',
    required_vars: ['first_name', 'role_applied', 'onboarding_url'],
    sample_vars: { first_name: 'David', role_applied: 'Registered Nurse', onboarding_url: 'https://www.divinefingershealthcare.ca/staff-portal.html' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Welcome to the Clinical Team!</h2>
      <p>Dear {{first_name}},</p>
      <p>We are delighted to welcome you to Divine Fingers Healthcare as a <strong>{{role_applied}}</strong>. Your clinical credentials have been accepted.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{onboarding_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Complete Onboarding &amp; Roster Activation</a>
      </div>
    `
  },
  {
    template_key: 'staff_interview_rescheduled',
    name: 'Staff Interview Rescheduled',
    category: 'staff',
    subject: 'Updated: Interview Details with Divine Fingers Healthcare',
    required_vars: ['first_name', 'interview_date', 'interview_time', 'meeting_link'],
    sample_vars: { first_name: 'Jane', interview_date: 'October 28, 2026', interview_time: '14:30 EST', meeting_link: 'https://meet.google.com/xyz-abc' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Interview Rescheduled</h2>
      <p>Hello {{first_name}}, your clinical interview has been rescheduled:</p>
      <div style="background: #F0FDFA; border-left: 4px solid #3CAF8A; padding: 14px 18px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>New Date:</strong> {{interview_date}}</p>
        <p style="margin: 4px 0;"><strong>New Time:</strong> {{interview_time}}</p>
      </div>
      <div style="text-align: center; margin: 20px 0;">
        <a href="{{meeting_link}}" style="background: #1A3A63; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Join Video Room</a>
      </div>
    `
  },
  {
    template_key: 'staff_onboarding_checklist',
    name: 'Staff Onboarding Checklist & Reminders',
    category: 'staff',
    subject: 'Action Needed: Complete Your Onboarding Checklist',
    required_vars: ['first_name', 'checklist_url', 'missing_items'],
    sample_vars: { first_name: 'Jane', checklist_url: 'https://www.divinefingershealthcare.ca/staff-portal.html#compliance', missing_items: 'CPR/BLS Card, Vulnerable Sector Check' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Onboarding Pending Items</h2>
      <p>Hello {{first_name}}, before we can schedule your first shift, please submit:</p>
      <div style="background: #FFFBEB; border-left: 4px solid #F59E0B; padding: 14px 18px; margin: 16px 0;">
        <p style="margin: 0; color: #B45309;"><strong>Outstanding Items:</strong> {{missing_items}}</p>
      </div>
      <div style="text-align: center; margin: 20px 0;">
        <a href="{{checklist_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Upload Documents</a>
      </div>
    `
  },
  {
    template_key: 'staff_shift_changed',
    name: 'Staff Shift Modified',
    category: 'staff',
    subject: 'Shift Update: {{facility_name}} on {{shift_date}}',
    required_vars: ['first_name', 'facility_name', 'shift_date', 'shift_time', 'change_summary', 'portal_url'],
    sample_vars: { first_name: 'Sarah', facility_name: 'Toronto General', shift_date: 'Oct 25, 2026', shift_time: '07:00 - 15:00', change_summary: 'Unit changed to 4B Surgical', portal_url: 'https://www.divinefingershealthcare.ca/staff-portal.html' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Shift Details Modified</h2>
      <p>Hello {{first_name}}, your scheduled shift at <strong>{{facility_name}}</strong> has been updated.</p>
      <div style="background: #F8FAFC; border: 1px solid #CBD5E1; padding: 14px 18px; border-radius: 6px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Date & Time:</strong> {{shift_date}} ({{shift_time}})</p>
        <p style="margin: 4px 0; color: #0284C7;"><strong>Change Note:</strong> {{change_summary}}</p>
      </div>
      <div style="text-align: center; margin: 20px 0;">
        <a href="{{portal_url}}" style="background: #1A3A63; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">View Shift Schedule</a>
      </div>
    `
  },
  {
    template_key: 'staff_shift_reminder_2h',
    name: 'Staff Shift Reminder: 2 Hours Prior',
    category: 'staff',
    subject: '⏰ Shift Starting in 2 Hours at {{facility_name}}',
    required_vars: ['first_name', 'facility_name', 'facility_address', 'shift_time'],
    sample_vars: { first_name: 'Sarah', facility_name: 'Toronto General', facility_address: '200 Elizabeth St, Toronto, ON', shift_time: '15:00 - 23:00' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Shift Starting Soon</h2>
      <p>Hello {{first_name}}, your shift begins in 2 hours.</p>
      <div style="background: #F0FDFA; border-left: 4px solid #3CAF8A; padding: 14px 18px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Facility:</strong> {{facility_name}}</p>
        <p style="margin: 4px 0;"><strong>Address:</strong> {{facility_address}}</p>
        <p style="margin: 4px 0;"><strong>Shift Time:</strong> {{shift_time}}</p>
      </div>
      <p style="font-size: 13px; color: #64748B;">Remember your ID badge and scrub uniform. Please clock in upon arrival.</p>
    `
  },
  {
    template_key: 'staff_timesheet_reminder',
    name: 'Staff Timesheet Submission Reminder',
    category: 'staff',
    subject: 'Action Required: Submit Your Timesheet for Week Ending {{week_ending}}',
    required_vars: ['first_name', 'week_ending', 'timesheet_url'],
    sample_vars: { first_name: 'Sarah', week_ending: 'Oct 23, 2026', timesheet_url: 'https://www.divinefingershealthcare.ca/staff-portal.html#timesheets' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Submit Your Timesheet</h2>
      <p>Hello {{first_name}}, please review and submit your hours worked for the week ending <strong>{{week_ending}}</strong> to ensure prompt payroll processing.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{timesheet_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Submit Timesheet</a>
      </div>
    `
  },
  {
    template_key: 'staff_timesheet_rejected',
    name: 'Staff Timesheet Rejected / Needs Revision',
    category: 'staff',
    subject: 'Timesheet Revision Requested: Week Ending {{week_ending}}',
    required_vars: ['first_name', 'week_ending', 'rejection_reason', 'timesheet_url'],
    sample_vars: { first_name: 'Sarah', week_ending: 'Oct 23, 2026', rejection_reason: 'Supervisor signature missing on Thursday shift', timesheet_url: 'https://www.divinefingershealthcare.ca/staff-portal.html#timesheets' },
    body_html: `
      <h2 style="color: #DC2626; margin-top: 0;">Timesheet Revision Needed</h2>
      <p>Hello {{first_name}}, your timesheet for <strong>{{week_ending}}</strong> was returned with the following note:</p>
      <div style="background: #FEF2F2; border-left: 4px solid #DC2626; padding: 12px 16px; margin: 16px 0;">
        <p style="margin: 0; color: #991B1B;"><strong>Reason:</strong> {{rejection_reason}}</p>
      </div>
      <p>Please edit and re-submit as soon as possible.</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="{{timesheet_url}}" style="background: #1A3A63; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Review Timesheet</a>
      </div>
    `
  },
  {
    template_key: 'staff_payslip_issued',
    name: 'Staff Payslip / Payment Notification',
    category: 'staff',
    subject: 'Payslip Available for Pay Period {{pay_period}}',
    required_vars: ['first_name', 'pay_period', 'net_pay', 'portal_url'],
    sample_vars: { first_name: 'Sarah', pay_period: 'Oct 01 - Oct 15, 2026', net_pay: '$2,140.50 CAD', portal_url: 'https://www.divinefingershealthcare.ca/staff-portal.html#payroll' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Payslip Generated</h2>
      <p>Hello {{first_name}}, your payslip for <strong>{{pay_period}}</strong> is ready for review.</p>
      <div style="background: #F0FDFA; border: 1px solid #99F6E4; padding: 14px 18px; border-radius: 6px; margin: 16px 0;">
        <p style="margin: 0; font-size: 15px;"><strong>Net Deposit:</strong> <span style="color: #0F766E; font-weight: 800; font-size: 18px;">{{net_pay}}</span></p>
      </div>
      <div style="text-align: center; margin: 20px 0;">
        <a href="{{portal_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">View Payslip Details</a>
      </div>
    `
  },
  {
    template_key: 'staff_document_expiry_14d',
    name: 'Staff Document Expiry Warning (14 Days)',
    category: 'staff',
    subject: '⚠️ Reminder: {{document_name}} expires in 14 days',
    required_vars: ['first_name', 'document_name', 'expiry_date', 'upload_url'],
    sample_vars: { first_name: 'Sarah', document_name: 'CNO License', expiry_date: 'November 05, 2026', upload_url: 'https://www.divinefingershealthcare.ca/staff-portal.html#compliance' },
    body_html: `
      <h2 style="color: #F59E0B; margin-top: 0;">Document Expiring in 14 Days</h2>
      <p>Hello {{first_name}}, your <strong>{{document_name}}</strong> will expire on <strong>{{expiry_date}}</strong>.</p>
      <p>To prevent shift scheduling pauses, please upload your renewed credential now.</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="{{upload_url}}" style="background: #F59E0B; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Upload Renewed Document</a>
      </div>
    `
  },
  {
    template_key: 'staff_document_expiry_7d',
    name: 'Staff Document Expiry Urgent Warning (7 Days)',
    category: 'staff',
    subject: '🚨 URGENT: {{document_name}} expires in 7 days',
    required_vars: ['first_name', 'document_name', 'expiry_date', 'upload_url'],
    sample_vars: { first_name: 'Sarah', document_name: 'Vulnerable Sector Check', expiry_date: 'October 28, 2026', upload_url: 'https://www.divinefingershealthcare.ca/staff-portal.html#compliance' },
    body_html: `
      <h2 style="color: #DC2626; margin-top: 0;">Urgent: Document Expiring in 7 Days</h2>
      <p>Hello {{first_name}}, your <strong>{{document_name}}</strong> expires on <strong>{{expiry_date}}</strong>.</p>
      <p style="color: #DC2626; font-weight: 600;">Failure to provide proof of renewal within 7 days will automatically pause your ability to accept shifts.</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="{{upload_url}}" style="background: #DC2626; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Upload Urgently</a>
      </div>
    `
  },
  {
    template_key: 'staff_profile_incomplete',
    name: 'Staff Profile Incomplete Reminder',
    category: 'staff',
    subject: 'Complete Your Divine Fingers Profile to Unlock Shifts',
    required_vars: ['first_name', 'completion_percent', 'profile_url'],
    sample_vars: { first_name: 'Sarah', completion_percent: '65%', profile_url: 'https://www.divinefingershealthcare.ca/staff-portal.html#profile' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Complete Your Profile</h2>
      <p>Hello {{first_name}}, your clinician profile is currently <strong>{{completion_percent}}</strong> complete.</p>
      <p>Complete your certifications, emergency contacts, and direct deposit details to qualify for immediate placement.</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="{{profile_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Complete Profile</a>
      </div>
    `
  },
  {
    template_key: 'staff_availability_reminder',
    name: 'Staff Availability Update Request',
    category: 'staff',
    subject: 'Update Your Availability for Next Week',
    required_vars: ['first_name', 'portal_url'],
    sample_vars: { first_name: 'Sarah', portal_url: 'https://www.divinefingershealthcare.ca/staff-portal.html#availability' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Update Your Work Availability</h2>
      <p>Hello {{first_name}}, clients are posting shifts for the upcoming week. Keep your calendar up to date so we match you with shifts that fit your schedule.</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="{{portal_url}}" style="background: #1A3A63; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Update Availability</a>
      </div>
    `
  },
  {
    template_key: 'client_contract_ready',
    name: 'Client Master Services Agreement Ready for Signing',
    category: 'client',
    subject: 'Divine Fingers Staffing Agreement Ready for {{organization_name}}',
    required_vars: ['contact_name', 'organization_name', 'signing_url'],
    sample_vars: { contact_name: 'Dr. Emily Vance', organization_name: 'Centennial Care', signing_url: 'https://www.divinefingershealthcare.ca/sign-agreement' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Staffing Agreement Ready</h2>
      <p>Dear {{contact_name}},</p>
      <p>The Divine Fingers Healthcare Staffing Master Services Agreement for <strong>{{organization_name}}</strong> is ready for review and digital signature.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{signing_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Review &amp; Sign Agreement</a>
      </div>
    `
  },
  {
    template_key: 'client_candidate_shortlist',
    name: 'Client Candidate Shortlist Shared',
    category: 'client',
    subject: 'Candidate Shortlist Ready for Request {{request_code}}',
    required_vars: ['contact_name', 'facility_name', 'request_code', 'candidate_count', 'portal_url'],
    sample_vars: { contact_name: 'Dr. Emily Vance', facility_name: 'Centennial Care', request_code: 'REQ-5020', candidate_count: '3', portal_url: 'https://www.divinefingershealthcare.ca/portal.html#shortlist' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Candidate Shortlist Ready</h2>
      <p>Dear {{contact_name}}, our clinical staffing team has shortlisted <strong>{{candidate_count}} verified clinicians</strong> for order <strong>{{request_code}}</strong> at {{facility_name}}.</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="{{portal_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Review Profiles &amp; Confirm</a>
      </div>
    `
  },
  {
    template_key: 'client_shift_unfilled_alert',
    name: 'Client Shift Unfilled Warning Alert',
    category: 'client',
    subject: 'Status Alert: Staffing Request {{request_code}} Dispatch Update',
    required_vars: ['contact_name', 'facility_name', 'request_code', 'shift_date', 'action_status'],
    sample_vars: { contact_name: 'Dr. Emily Vance', facility_name: 'Centennial Care', request_code: 'REQ-5020', shift_date: 'Oct 24, 2026', action_status: 'Active recruitment in progress' },
    body_html: `
      <h2 style="color: #F59E0B; margin-top: 0;">Shift Dispatch Update</h2>
      <p>Dear {{contact_name}},</p>
      <p>We are actively working on fulfilling your upcoming shift on <strong>{{shift_date}}</strong> (Ref: {{request_code}}).</p>
      <div style="background: #FFFBEB; border-left: 4px solid #F59E0B; padding: 12px 16px; margin: 16px 0;">
        <p style="margin: 0; color: #B45309;"><strong>Dispatch Status:</strong> {{action_status}}</p>
      </div>
      <p>Our on-call coordinator is actively contacting eligible clinicians in your zone.</p>
    `
  },
  {
    template_key: 'client_staff_noshow_alert',
    name: 'Client Staff No-Show Immediate Notice',
    category: 'client',
    subject: 'Urgent Alert: Shift Attendance Issue (Ref: {{request_code}})',
    required_vars: ['contact_name', 'facility_name', 'request_code', 'staff_name', 'coordinator_phone'],
    sample_vars: { contact_name: 'Dr. Emily Vance', facility_name: 'Centennial Care', request_code: 'REQ-5020', staff_name: 'Nurse A', coordinator_phone: '+1 647 555 0199' },
    body_html: `
      <h2 style="color: #DC2626; margin-top: 0;">Urgent Attendance Alert</h2>
      <p>Dear {{contact_name}}, we have been informed of an attendance discrepancy regarding {{staff_name}} for order {{request_code}} at {{facility_name}}.</p>
      <p>Our 24/7 dispatch desk is already mobilizing backup coverage. If you need immediate assistance, please call our direct hotline: <strong>{{coordinator_phone}}</strong>.</p>
    `
  },
  {
    template_key: 'client_timesheet_ready',
    name: 'Client Timesheet Ready for Approval',
    category: 'client',
    subject: 'Timesheet Pending Your Approval: {{staff_name}} ({{shift_date}})',
    required_vars: ['contact_name', 'facility_name', 'staff_name', 'shift_date', 'hours_worked', 'approval_url'],
    sample_vars: { contact_name: 'Dr. Emily Vance', facility_name: 'Centennial Care', staff_name: 'Sarah Connor RN', shift_date: 'Oct 21, 2026', hours_worked: '8.0 hours', approval_url: 'https://www.divinefingershealthcare.ca/portal.html#timesheets' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Timesheet Pending Approval</h2>
      <p>Dear {{contact_name}}, <strong>{{staff_name}}</strong> has submitted hours for their shift at {{facility_name}} on <strong>{{shift_date}}</strong> ({{hours_worked}}).</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{approval_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Review &amp; Approve Timesheet</a>
      </div>
    `
  },
  {
    template_key: 'client_payment_reminder',
    name: 'Client Invoice Payment Reminder',
    category: 'client',
    subject: 'Payment Reminder: Invoice {{invoice_number}} (Due {{due_date}})',
    required_vars: ['contact_name', 'facility_name', 'invoice_number', 'amount_due', 'due_date', 'invoice_url'],
    sample_vars: { contact_name: 'Dr. Emily Vance', facility_name: 'Centennial Care', invoice_number: 'INV-2026-104', amount_due: '$3,420.00 CAD', due_date: 'November 15, 2026', invoice_url: 'https://www.divinefingershealthcare.ca/portal.html#billing' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Payment Reminder</h2>
      <p>Dear {{contact_name}}, this is a friendly reminder that invoice <strong>{{invoice_number}}</strong> for <strong>{{amount_due}}</strong> is due on <strong>{{due_date}}</strong>.</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="{{invoice_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">View Invoice &amp; Pay</a>
      </div>
    `
  },
  {
    template_key: 'client_payment_receipt',
    name: 'Client Payment Received Receipt',
    category: 'client',
    subject: 'Receipt: Payment Received for Invoice {{invoice_number}}',
    required_vars: ['contact_name', 'facility_name', 'invoice_number', 'amount_paid', 'receipt_number'],
    sample_vars: { contact_name: 'Dr. Emily Vance', facility_name: 'Centennial Care', invoice_number: 'INV-2026-104', amount_paid: '$3,420.00 CAD', receipt_number: 'REC-90412' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Payment Confirmation</h2>
      <p>Dear {{contact_name}}, thank you for your payment of <strong>{{amount_paid}}</strong> for invoice <strong>{{invoice_number}}</strong>.</p>
      <p>Receipt Reference: <strong>{{receipt_number}}</strong>. Your account is in good standing.</p>
    `
  },
  {
    template_key: 'client_shift_feedback_request',
    name: 'Client Shift Feedback & Rating Request',
    category: 'client',
    subject: 'How was your experience with {{staff_name}} at {{facility_name}}?',
    required_vars: ['contact_name', 'facility_name', 'staff_name', 'shift_date', 'feedback_url'],
    sample_vars: { contact_name: 'Dr. Emily Vance', facility_name: 'Centennial Care', staff_name: 'Sarah Connor RN', shift_date: 'Oct 21, 2026', feedback_url: 'https://www.divinefingershealthcare.ca/portal.html#feedback' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Shift Quality Feedback</h2>
      <p>Dear {{contact_name}},</p>
      <p><strong>{{staff_name}}</strong> completed a shift at {{facility_name}} on {{shift_date}}. We value your feedback to ensure our clinicians maintain the highest standard of patient care.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{feedback_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Rate Shift Experience</a>
      </div>
    `
  },
  {
    template_key: 'admin_unfilled_shift_alert',
    name: 'Admin: Unfilled Shift Alert',
    category: 'admin',
    subject: '⚠️ [UNFILLED SHIFT] {{facility_name}} starts in {{hours_left}}h ({{request_code}})',
    required_vars: ['facility_name', 'request_code', 'role_needed', 'shift_start', 'hours_left', 'admin_url'],
    sample_vars: { facility_name: 'Trillium Health', request_code: 'REQ-992', role_needed: 'ICU RN', shift_start: 'Tomorrow 07:00', hours_left: '12', admin_url: 'https://www.divinefingershealthcare.ca/admin-login.html' },
    body_html: `
      <h2 style="color: #DC2626; margin-top: 0;">Unfilled Shift Escalation</h2>
      <div style="background: #FEF2F2; border-left: 4px solid #DC2626; padding: 14px 18px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Facility:</strong> {{facility_name}}</p>
        <p style="margin: 4px 0;"><strong>Role Needed:</strong> {{role_needed}}</p>
        <p style="margin: 4px 0;"><strong>Start Time:</strong> {{shift_start}} ({{hours_left}} hours remaining)</p>
        <p style="margin: 4px 0;"><strong>Order Code:</strong> {{request_code}}</p>
      </div>
      <div style="text-align: center; margin: 20px 0;">
        <a href="{{admin_url}}" style="background: #DC2626; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Dispatch Clinician Now</a>
      </div>
    `
  },
  {
    template_key: 'admin_compliance_alert',
    name: 'Admin: Compliance / Document Expiry Warning',
    category: 'admin',
    subject: '📋 [COMPLIANCE ALERT] Staff Document Expiries Detected ({{count}} records)',
    required_vars: ['count', 'summary_table_html', 'admin_url'],
    sample_vars: { count: '4', summary_table_html: '<p>4 clinicians have licenses expiring within 14 days.</p>', admin_url: 'https://www.divinefingershealthcare.ca/admin-login.html' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Staff Compliance Audit Warning</h2>
      <p>The daily compliance monitor detected <strong>{{count}}</strong> clinician document(s) requiring attention:</p>
      <div style="margin: 16px 0;">
        {{summary_table_html}}
      </div>
      <div style="text-align: center; margin: 20px 0;">
        <a href="{{admin_url}}" style="background: #1A3A63; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Open Compliance Ledger</a>
      </div>
    `
  },
  {
    template_key: 'admin_digest_summary',
    name: 'Admin: Daily Operations Digest',
    category: 'admin',
    subject: '📊 Daily Operations Digest — {{date_str}}',
    required_vars: ['date_str', 'open_requests_count', 'filled_shifts_count', 'new_candidates_count', 'admin_url'],
    sample_vars: { date_str: 'October 21, 2026', open_requests_count: '12', filled_shifts_count: '28', new_candidates_count: '5', admin_url: 'https://www.divinefingershealthcare.ca/admin-login.html' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">Daily Operations Summary</h2>
      <p>Summary for <strong>{{date_str}}</strong>:</p>
      <div style="background: #F8FAFC; border: 1px solid #CBD5E1; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 6px 0;">🔹 <strong>Filled Shifts:</strong> {{filled_shifts_count}}</p>
        <p style="margin: 6px 0;">🔹 <strong>Open Staffing Requests:</strong> {{open_requests_count}}</p>
        <p style="margin: 6px 0;">🔹 <strong>New Candidates Registered:</strong> {{new_candidates_count}}</p>
      </div>
      <div style="text-align: center; margin: 20px 0;">
        <a href="{{admin_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Open Admin Operations</a>
      </div>
    `
  },
  {
    template_key: 'admin_mail_health_alert',
    name: 'Admin: Mail System Health Alert',
    category: 'admin',
    subject: '🚨 [MAIL SYSTEM HEALTH] {{alert_type}}: {{alert_message}}',
    required_vars: ['alert_type', 'alert_message', 'pending_count', 'failed_count', 'admin_url'],
    sample_vars: { alert_type: 'Queue Backlog', alert_message: 'High pending email volume detected', pending_count: '45', failed_count: '2', admin_url: 'https://www.divinefingershealthcare.ca/admin-login.html' },
    body_html: `
      <h2 style="color: #DC2626; margin-top: 0;">Mail System Health Incident</h2>
      <div style="background: #FEF2F2; border-left: 4px solid #DC2626; padding: 14px 18px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Incident:</strong> {{alert_type}}</p>
        <p style="margin: 4px 0;"><strong>Details:</strong> {{alert_message}}</p>
        <p style="margin: 4px 0;"><strong>Pending Outbox:</strong> {{pending_count}} | <strong>Failed:</strong> {{failed_count}}</p>
      </div>
      <div style="text-align: center; margin: 20px 0;">
        <a href="{{admin_url}}" style="background: #1A3A63; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Open Mail Console</a>
      </div>
    `
  },
  {
    template_key: 'marketing_job_alert',
    name: 'Marketing: New Job & Shift Alerts',
    category: 'marketing',
    subject: '🩺 Hot Shifts Open: {{specialty}} in {{location}}',
    required_vars: ['recipient_name', 'specialty', 'location', 'shift_details_html', 'apply_url'],
    sample_vars: { recipient_name: 'Nurse Alex', specialty: 'Emergency & ICU RN', location: 'Greater Toronto Area', shift_details_html: '<p>Immediate openings at competitive rates ($45-$65/hr) with flexible schedules.</p>', apply_url: 'https://www.divinefingershealthcare.ca/staff-portal.html' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">New Shifts Available in Your Area</h2>
      <p>Hello {{recipient_name}},</p>
      <p>High-priority shifts matching your profile as <strong>{{specialty}}</strong> in <strong>{{location}}</strong> are now open for claiming:</p>
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 14px 18px; border-radius: 6px; margin: 16px 0;">
        {{shift_details_html}}
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{apply_url}}" style="background: #3CAF8A; color: #FFFFFF; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Claim Shifts Now</a>
      </div>
    `
  },
  {
    template_key: 'marketing_newsletter',
    name: 'Marketing: Divine Fingers Healthcare Newsletter',
    category: 'marketing',
    subject: 'Divine Fingers Healthcare Digest — {{issue_title}}',
    required_vars: ['recipient_name', 'issue_title', 'content_html', 'read_more_url'],
    sample_vars: { recipient_name: 'Healthcare Partner', issue_title: 'Fall 2026 Innovations in Patient Staffing', content_html: '<p>Read our latest healthcare industry updates and continuous learning opportunities.</p>', read_more_url: 'https://www.divinefingershealthcare.ca/news' },
    body_html: `
      <h2 style="color: #0A192F; margin-top: 0;">{{issue_title}}</h2>
      <p>Hello {{recipient_name}},</p>
      <div style="margin: 16px 0; font-size: 14px; line-height: 1.7; color: #334155;">
        {{content_html}}
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{read_more_url}}" style="background: #1A3A63; color: #FFFFFF; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-block;">Read Online</a>
      </div>
    `
  }
];

module.exports = { SEED_TEMPLATES };
