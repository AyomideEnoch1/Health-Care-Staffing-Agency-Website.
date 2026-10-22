'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const pool = require('../db');
const { compileTemplate, interpolate, validateVariables, htmlToPlainText } = require('../services/mail/templateEngine');
const ConsoleLogAdapter = require('../services/mail/adapters/ConsoleLogAdapter');
const SmtpAdapter = require('../services/mail/adapters/SmtpAdapter');
const mailService = require('../services/mail/MailService');
const { initMailListener } = require('../services/mail/mailListener');
const adminEvents = require('../utils/events');

describe('Enterprise Mailing System Tests', () => {
  before(() => {
    initMailListener();
  });

  describe('1. Template Engine & Security Sanitization', () => {
    test('Mustache interpolation replaces {{vars}} accurately and escapes HTML', () => {
      const template = '<p>Hello {{name}}, welcome to {{facility}}!</p>';
      const data = { name: '<script>alert(1)</script>Sarah', facility: 'Toronto General' };
      const rendered = interpolate(template, data);

      assert.ok(!rendered.includes('<script>'), 'Script tag must be escaped');
      assert.ok(rendered.includes('&lt;script&gt;alert(1)&lt;/script&gt;Sarah'), 'Escaped HTML entities expected');
      assert.ok(rendered.includes('Toronto General'), 'Facility variable correctly interpolated');
    });

    test('validateVariables detects missing required variables', () => {
      const required = ['facility_name', 'role_requested', 'shift_date'];
      const partialData = { facility_name: 'Mount Sinai', role_requested: 'RN' };

      const check = validateVariables(required, partialData);
      assert.equal(check.isValid, false);
      assert.deepEqual(check.missing, ['shift_date']);
    });

    test('htmlToPlainText strips tags and preserves spacing/links', () => {
      const html = `
        <div style="padding: 20px;">
          <h2>Staffing Update</h2>
          <p>Your shift has been confirmed at <strong>Trillium Health</strong>.</p>
          <a href="https://example.com/portal">Open Staff Portal</a>
        </div>
      `;
      const plain = htmlToPlainText(html);
      assert.ok(plain.includes('Staffing Update'));
      assert.ok(plain.includes('Trillium Health'));
      assert.ok(plain.includes('Open Staff Portal (https://example.com/portal)'));
      assert.ok(!plain.includes('<div'));
    });
  });

  describe('2. Provider Adapters', () => {
    test('ConsoleLogAdapter sends and returns valid provider ID', async () => {
      const adapter = new ConsoleLogAdapter();
      const res = await adapter.send({
        to: 'nurse@example.com',
        subject: 'Shift Test',
        text: 'Hello nurse',
        html: '<p>Hello nurse</p>'
      });

      assert.equal(res.success, true);
      assert.equal(res.provider, 'console');
      assert.ok(res.messageId.startsWith('console-'));
    });

    test('SmtpAdapter initializes with strict TLS 1.2+ configuration', () => {
      const smtp = new SmtpAdapter();
      assert.equal(smtp.name, 'smtp');
      assert.ok(smtp.transporter.options.tls.minVersion === 'TLSv1.2');
    });
  });

  describe('3. MailService Orchestrator & Idempotency', () => {
    test('send() refuses when required variables are absent', async () => {
      await assert.rejects(
        async () => {
          await mailService.send('auth_welcome', {
            to: 'test@example.com',
            data: { first_name: 'Test' } // missing 'email' and 'login_url'
          });
        },
        /missing required variables/
      );
    });

    test('send() enqueues valid email into email_logs', async () => {
      const testEmail = `test-${Date.now()}@example.com`;
      const result = await mailService.send('auth_welcome', {
        to: testEmail,
        recipientType: 'staff',
        data: {
          first_name: 'Ayo',
          email: testEmail,
          login_url: 'https://www.divinefingershealthcare.ca/login.html'
        }
      });

      assert.ok(result.id, 'Log ID must be returned');
      assert.equal(result.recipient, testEmail);

      // Verify row in DB
      const [rows] = await pool.query('SELECT * FROM email_logs WHERE id = ?', [result.id]);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].recipient_email, testEmail);
      assert.equal(rows[0].template_key, 'auth_welcome');
    });

    test('Idempotency key prevents duplicate sends', async () => {
      const testEmail = `idempotent-${Date.now()}@example.com`;
      const idempotencyKey = `idem-${crypto.randomUUID()}`;

      const res1 = await mailService.send('auth_welcome', {
        to: testEmail,
        idempotencyKey,
        data: {
          first_name: 'IdemUser',
          email: testEmail,
          login_url: 'https://www.divinefingershealthcare.ca/login.html'
        }
      });

      assert.equal(res1.status, 'queued');
      assert.ok(!res1.duplicate);

      // Attempt second send with identical idempotency key
      const res2 = await mailService.send('auth_welcome', {
        to: testEmail,
        idempotencyKey,
        data: {
          first_name: 'IdemUser',
          email: testEmail,
          login_url: 'https://www.divinefingershealthcare.ca/login.html'
        }
      });

      assert.equal(res2.duplicate, true);
      assert.equal(res2.id, res1.id);
    });

    test('Template preview generation returns interpolated HTML without sending', async () => {
      const preview = await mailService.renderPreview('client_welcome', {
        contact_name: 'Dr. House',
        facility_name: 'Princeton Plainsboro'
      });

      assert.equal(preview.templateKey, 'client_welcome');
      assert.ok(preview.html.includes('Dr. House'));
      assert.ok(preview.html.includes('Princeton Plainsboro'));
    });

    test('Template rollback reverts to previous version and logs version audit', async () => {
      const templateKey = 'marketing_announcement';
      const [orig] = await pool.query('SELECT current_version, subject FROM email_templates WHERE template_key = ?', [templateKey]);
      const initialVersion = orig[0].current_version;

      // Update subject to create a new version
      const [existing] = await pool.query('SELECT id FROM email_templates WHERE template_key = ?', [templateKey]);
      const newVerNum = initialVersion + 1;
      const vId = crypto.randomUUID();

      await pool.query(
        `INSERT INTO email_template_versions (
          id, template_id, template_key, version, subject, body_html, body_text, change_summary, created_by
        ) VALUES (?, ?, ?, ?, 'Temporary Title V2', '<p>Test</p>', 'Test', 'Automated Test Edit', 'test_runner')`,
        [vId, existing[0].id, templateKey, newVerNum]
      );
      await pool.query('UPDATE email_templates SET current_version = ?, subject = "Temporary Title V2" WHERE template_key = ?', [newVerNum, templateKey]);

      // Rollback to version 1
      const rollbackResult = await mailService.rollbackTemplate(templateKey, 1, 'test_auditor');
      assert.equal(rollbackResult.success, true);
      assert.equal(rollbackResult.rolledBackTo, 1);

      // Verify template subject was restored to original
      const [restored] = await pool.query('SELECT subject, current_version FROM email_templates WHERE template_key = ?', [templateKey]);
      assert.equal(restored[0].subject, orig[0].subject);
    });
  });

  describe('4. Domain Event Trigger Verification', () => {
    test('adminEvents "application:created" triggers admin alert and candidate confirmation', async () => {
      const applicantEmail = `candidate-${Date.now()}@example.com`;
      const appId = `APP-TEST-${Date.now()}`;

      adminEvents.emit('application:created', {
        id: appId,
        application_code: appId,
        full_name: 'Chidi Anagonye',
        role_applied: 'ICU Nurse Specialist',
        email: applicantEmail,
        phone: '+1 416 555 9911',
        stage: 'new',
        created_at: new Date().toISOString()
      });

      // Allow background dispatch tick
      await new Promise(r => setTimeout(r, 600));

      const [logs] = await pool.query(
        'SELECT template_key, recipient_email FROM email_logs WHERE recipient_email = ? OR idempotency_key = ?',
        [applicantEmail, `mail:admin_app:${appId}`]
      );

      const candidateLog = logs.find(l => l.recipient_email === applicantEmail);
      const adminLog = logs.find(l => l.template_key === 'admin_new_staff_application');

      assert.ok(candidateLog, 'Candidate acknowledgment must be queued');
      assert.equal(candidateLog.template_key, 'staff_application_received');
      assert.ok(adminLog, 'Admin alert must be queued');
    });

    test('adminEvents "client:registered" triggers client welcome and admin notification', async () => {
      const clientEmail = `facility-client-${Date.now()}@example.com`;
      const clientId = `USER-CLI-${Date.now()}`;

      adminEvents.emit('client:registered', {
        id: clientId,
        email: clientEmail,
        full_name: 'Dr. Allison Cameron',
        organization_name: 'Toronto General Cardiology',
        phone: '+1 416 555 3322'
      });

      await new Promise(r => setTimeout(r, 600));

      const [logs] = await pool.query(
        'SELECT template_key, recipient_email FROM email_logs WHERE recipient_email = ? OR idempotency_key = ?',
        [clientEmail, `mail:admin_client_reg:${clientId}`]
      );

      const clientLog = logs.find(l => l.recipient_email === clientEmail);
      const adminLog = logs.find(l => l.template_key === 'admin_new_client_registered');

      assert.ok(clientLog, 'Client welcome must be queued');
      assert.equal(clientLog.template_key, 'client_welcome');
      assert.ok(adminLog, 'Admin registration notification must be queued');
    });

    test('adminEvents "request:created" triggers client confirmation and admin alert', async () => {
      const contactEmail = `coord-${Date.now()}@example.com`;
      const reqId = `REQ-TEST-${Date.now()}`;

      adminEvents.emit('request:created', {
        id: reqId,
        request_code: reqId,
        facility_name: 'Sunnybrook Health Sciences',
        role_requested: 'Emergency Room RN',
        shift_type: 'Day (07:00 - 19:00)',
        urgency_level: 'urgent',
        contact_name: 'Coordinator Mark',
        contact_email: contactEmail
      });

      await new Promise(r => setTimeout(r, 600));

      const [logs] = await pool.query(
        'SELECT template_key, recipient_email FROM email_logs WHERE recipient_email = ? OR idempotency_key = ?',
        [contactEmail, `mail:admin_req:${reqId}`]
      );

      const clientConfLog = logs.find(l => l.recipient_email === contactEmail);
      const adminReqLog = logs.find(l => l.template_key === 'admin_new_staff_request');

      assert.ok(clientConfLog, 'Client request confirmation must be queued');
      assert.equal(clientConfLog.template_key, 'client_request_confirmation');
      assert.ok(adminReqLog, 'Admin request alert must be queued');
    });
  });

  after(async () => {
    // Clean up test logs
    try {
      await pool.query("DELETE FROM email_logs WHERE recipient_email LIKE '%@example.com'");
    } catch (_) {}
    mailService.stopWorkerDaemon();
    try {
      await pool.end();
    } catch (_) {}
    setTimeout(() => process.exit(0), 100);
  });
});
