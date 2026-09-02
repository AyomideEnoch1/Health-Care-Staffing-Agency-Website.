const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || '127.0.0.1',
  port: parseInt(process.env.SMTP_PORT || '1025', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  } : undefined
});

// Export connection verifier without blocking module load
async function verifyConnection() {
  return new Promise((resolve) => {
    transporter.verify((error) => {
      if (error) {
        console.warn('⚠️ [SMTP Warning] Could not connect to mail server:', error.message);
      } else {
        console.log('✅ [SMTP Mailer] Connected to mail server.');
      }
      resolve(!error);
    });
  });
}

async function sendStaffingRequestAlert(requestData) {
  const mailOptions = {
    from: `"Divine Fingers Dispatch" <${process.env.SMTP_USER || 'no-reply@divinefingershealthcare.ca'}>`,
    to: process.env.AGENCY_ALERT_EMAIL || 'info@divinefingershealthcare.ca',
    subject: `🚨 [NEW STAFF REQUEST] ${requestData.facility_name} - ${requestData.role_requested}`,
    html: `
      <h2>New Staffing Request Received (${requestData.request_code})</h2>
      <p><strong>Facility:</strong> ${requestData.facility_name}</p>
      <p><strong>Contact Person:</strong> ${requestData.contact_name} (${requestData.contact_phone})</p>
      <p><strong>Email:</strong> ${requestData.contact_email}</p>
      <p><strong>Role Needed:</strong> ${requestData.role_requested}</p>
      <p><strong>Shift / Location:</strong> ${requestData.shift_type}</p>
      <p><strong>Urgency:</strong> ${requestData.urgency_level || 'routine'}</p>
      <p><strong>Special Instructions:</strong> ${requestData.special_instructions || 'None'}</p>
      <br>
      <p>Log in to the Divine Fingers Dispatch Portal to assign staff to this facility.</p>
    `
  };
  return transporter.sendMail(mailOptions);
}

async function sendApplicantConfirmation(applicantData) {
  const mailOptions = {
    from: `"Divine Fingers Recruitment" <${process.env.SMTP_USER || 'no-reply@divinefingershealthcare.ca'}>`,
    to: applicantData.email,
    subject: `Application Received - Divine Fingers Healthcare Services Inc.`,
    html: `
      <h3>Hello ${applicantData.full_name},</h3>
      <p>Thank you for submitting your application for the <strong>${applicantData.role_applied}</strong> role at Divine Fingers Healthcare Services Inc. (Corp ID: 1592082-5).</p>
      <p>Your application reference code is <strong>${applicantData.application_code}</strong>. Our clinical recruitment team will review your submitted credentials and contact you directly for the next onboarding stage.</p>
      <br>
      <p>Best regards,<br>
      <strong>Divine Fingers Healthcare Recruitment Desk</strong><br>
      17-2 Dailing Gate, Scarborough, ON M1B 1Z8<br>
      Direct Lines: +1 (647) 210-6463 | +1 (647) 764-8522<br>
      <a href="http://www.divinefingershealthcare.com">www.divinefingershealthcare.com</a></p>
    `
  };
  return transporter.sendMail(mailOptions);
}

async function sendAdminEmailVerificationOtp(adminEmail, adminName, otpCode) {
  console.log(`\n================================================================`);
  console.log(` 📧 [PORTAL EMAIL VERIFICATION DISPATCH]`);
  console.log(` To:      ${adminName} <${adminEmail}>`);
  console.log(` 🔐 CODE: ${otpCode}`);
  console.log(` Expiry: 15 minutes`);
  console.log(`================================================================\n`);

  const mailOptions = {
    from: `"Divine Fingers Portal Security" <${process.env.SMTP_USER || 'no-reply@divinefingershealthcare.ca'}>`,
    to: adminEmail,
    subject: `🔐 Your Portal Verification Code: ${otpCode} - Divine Fingers Healthcare`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
        <h2 style="color: #00a896; margin-top: 0;">Portal Identity Verification</h2>
        <p>Hello <strong>${adminName}</strong>,</p>
        <p>A sign-in or account setup request was initiated for your administrator account on the Divine Fingers Healthcare Care Coordination & Operations Portal.</p>
        <p>Please enter the following 6-digit verification code to verify your corporate email address and finalize your login:</p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0a192f; background: #f0fdfa; padding: 12px 24px; border-radius: 6px; border: 1px solid #00a896;">
            ${otpCode}
          </span>
        </div>
        <p style="font-size: 13px; color: #64748b;">This verification code is valid for <strong>15 minutes</strong>. If you did not attempt this sign-in, please notify your Super-Admin immediately.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">Divine Fingers Healthcare Services Inc. (Corp ID: 1592082-5) &bull; Security &amp; Compliance</p>
      </div>
    `
  };
  try {
    return await transporter.sendMail(mailOptions);
  } catch (err) {
    console.warn(`⚠️ [SMTP Offline / Dev Intercept] Physical email delivery failed (${err.message}). In development, use console code above.`);
    return { mock: true, accepted: [adminEmail] };
  }
}

async function sendNewsletterWelcomeEmail(subscriberEmail) {
  const mailOptions = {
    from: `"Divine Fingers Healthcare" <${process.env.SMTP_USER || 'no-reply@divinefingershealthcare.ca'}>`,
    to: subscriberEmail,
    subject: `Welcome to Divine Fingers Staffing & Shift Alerts`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
        <h2 style="color: #00a896; margin-top: 0;">Welcome to Divine Fingers Shift Alerts</h2>
        <p>Hello,</p>
        <p>Thank you for subscribing to the <strong>Divine Fingers Healthcare Services Inc.</strong> newsletter and clinical staffing alerts network.</p>
        <p>You will now receive:</p>
        <ul>
          <li>🚨 Priority Ontario healthcare staffing & urgent surge availability</li>
          <li>📋 Hospital, LTC, and community care shift openings</li>
          <li>💡 Healthcare regulatory compliance updates & CNO bulletins</li>
        </ul>
        <br>
        <p>If you have urgent staffing needs or questions, our 24/7 Clinical Dispatch team is always available at <strong>+1 (647) 210-6463</strong> or <strong>info@divinefingershealthcare.ca</strong>.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">Divine Fingers Healthcare Services Inc. (Corp ID: 1592082-5) &bull; 17-2 Dailing Gate, Scarborough, ON M1B 1Z8</p>
      </div>
    `
  };
  try {
    return await transporter.sendMail(mailOptions);
  } catch (err) {
    console.warn(`⚠️ [SMTP Offline / Dev Intercept] Newsletter email delivery failed (${err.message}).`);
    return { mock: true, accepted: [subscriberEmail] };
  }
}

module.exports = {
  sendStaffingRequestAlert,
  sendApplicantConfirmation,
  sendAdminEmailVerificationOtp,
  sendNewsletterWelcomeEmail,
  verifyConnection
};

