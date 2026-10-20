'use strict';
/**
 * SMTP Relay & Outbox Verification Script
 * Divine Fingers Healthcare Services Inc.
 *
 * Usage:
 *   node scripts/test_email_dispatch.js [recipient@domain.com]
 *   node scripts/test_email_dispatch.js --ethereal [recipient@domain.com]
 */

require('dotenv').config();
const nodemailer = require('nodemailer');
const { sendRawMail, verifyConnection } = require('../utils/mailer');
const { enqueueMail, pool } = require('../utils/mailOutbox');

const args = process.argv.slice(2);
const useEthereal = args.includes('--ethereal');
const filteredArgs = args.filter(a => a !== '--ethereal');
const targetEmail = filteredArgs[0] || process.env.AGENCY_ALERT_EMAIL || 'info@divinefingershealthcare.ca';

async function runDiagnostic() {
  console.log('==================================================================');
  console.log(' 📬 SMTP RELAY & OUTBOX DISPATCH DIAGNOSTIC');
  console.log('==================================================================');

  let testTransporter = null;
  let testFrom = null;

  if (useEthereal) {
    console.log('🧪 Provisioning automated Ethereal SMTP test relay...');
    const testAccount = await nodemailer.createTestAccount();
    console.log(`   Ethereal User: ${testAccount.user}`);
    testTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    testFrom = `"Divine Fingers Test Relay" <${testAccount.user}>`;
  } else {
    console.log(`Node Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`SMTP Host:        ${process.env.SMTP_HOST || '127.0.0.1'}`);
    console.log(`SMTP Port:        ${process.env.SMTP_PORT || '587'}`);
    console.log(`SMTP Secure:      ${process.env.SMTP_SECURE || 'false'}`);
    console.log(`SMTP User:        ${process.env.SMTP_USER || '(none)'}`);
    console.log(`Recipient:        ${targetEmail}`);
  }
  console.log('------------------------------------------------------------------');

  try {
    // Step 1: Handshake
    console.log('\n[Step 1/3] Verifying SMTP handshake and TLS negotiation...');
    try {
      if (useEthereal) {
        await testTransporter.verify();
        console.log('✅ Connected to Ethereal SMTP relay (TLS verified).');
      } else {
        const ok = await verifyConnection();
        if (!ok) {
          console.warn('⚠️ SMTP verify returned false. Proceeding with probe...');
        }
      }
    } catch (err) {
      console.error(`❌ SMTP Connection Failed: ${err.message}`);
      console.log('\n💡 Tip: To test with Hostinger Mail, configure in your .env:');
      console.log('   SMTP_HOST=smtp.hostinger.com');
      console.log('   SMTP_PORT=465');
      console.log('   SMTP_SECURE=true');
      console.log('   SMTP_USER=<your_hostinger_email>');
      console.log('   SMTP_PASS=<your_mailbox_password>');
      return;
    }

    // Step 2: Probe Message
    console.log(`\n[Step 2/3] Sending probe email to ${targetEmail}...`);
    try {
      let info;
      const mailOptions = {
        from: testFrom || process.env.SYSTEM_FROM_EMAIL || `"Divine Fingers Dispatch" <no-reply@${process.env.NOTIFY_DOMAIN || 'notify.divinefingershealthcare.ca'}>`,
        to: targetEmail,
        subject: `[DIAGNOSTIC] Divine Fingers Healthcare SMTP Relay Test — ${new Date().toLocaleTimeString()}`,
        text: 'This email confirms that your SMTP relay, TLS negotiation, and delivery pipeline are working.',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #00a896; border-radius: 8px; background: #ffffff;">
            <h2 style="color: #00a896; margin-top: 0;">✅ Outbound SMTP Relay Test Successful</h2>
            <p>This message was dispatched to verify that outbound SMTP communication and TLS encryption are operating correctly.</p>
            <div style="background: #f0fdfa; border: 1px solid #99f6e4; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
              <p style="margin: 4px 0; font-size: 14px;"><strong>Target Recipient:</strong> ${targetEmail}</p>
              <p style="margin: 4px 0; font-size: 14px;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
              <p style="margin: 4px 0; font-size: 14px;"><strong>Relay:</strong> ${useEthereal ? 'Ethereal Cloud SMTP' : process.env.SMTP_HOST}</p>
            </div>
            <p style="font-size: 13px; color: #64748b;">Technical Safeguards: TLS 1.2+ minimum, header injection sanitization, plain-text multipart fallback.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">Divine Fingers Healthcare Services Inc. (Corp ID: 1592082-5) &bull; Operations Desk</p>
          </div>
        `
      };

      if (useEthereal) {
        info = await testTransporter.sendMail(mailOptions);
      } else {
        info = await sendRawMail({
          to: mailOptions.to,
          subject: mailOptions.subject,
          text: mailOptions.text,
          html: mailOptions.html
        });
      }

      console.log('✅ Probe dispatched successfully!');
      console.log(`   Message ID: ${info.messageId}`);
      if (info.response) console.log(`   Server Response: ${info.response}`);

      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`\n🎉 Web Preview URL: ${previewUrl}`);
        console.log('   (Open this URL in your browser to view the delivered email, headers, and plain-text fallback!)');
      }
    } catch (err) {
      console.error(`❌ Probe delivery failed: ${err.message}`);
    }

    // Step 3: Outbox verification
    console.log('\n[Step 3/3] Testing transactional outbox queue in MySQL...');
    try {
      const outboxRes = await enqueueMail({
        type: 'newsletter_welcome',
        to: targetEmail,
        vars: {}
      });
      console.log(`✅ Outbox entry recorded in MySQL (status: "${outboxRes.status}", outbox ID: ${outboxRes.outboxId})`);
      console.log('   Run `node workers/mailWorker.js` to process and deliver outbox entries.');
    } catch (err) {
      console.warn(`⚠️ Outbox test notice: ${err.message}`);
    }

    console.log('\n==================================================================');
    console.log(' Diagnostic complete.');
    console.log('==================================================================');
  } finally {
    if (pool && typeof pool.end === 'function') {
      await pool.end().catch(() => {});
    }
  }
}

runDiagnostic().catch((e) => {
  console.error('[FATAL]', e);
  process.exit(1);
});
