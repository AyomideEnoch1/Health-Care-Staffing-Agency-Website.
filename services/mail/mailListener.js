'use strict';
const adminEvents = require('../../utils/events');
const mailService = require('./MailService');
const pool = require('../../db');

const AGENCY_ALERT_EMAIL = process.env.AGENCY_ALERT_EMAIL || 'info@divinefingershealthcare.ca';
const BASE_APP_URL = process.env.APP_BASE_URL || 'https://www.divinefingershealthcare.ca';

/**
 * Register Domain Event Listeners for Automatic Transactional & Notification Mailings
 */
function initMailListener() {
  console.log('[MailListener] Initializing domain event mail subscriptions...');

  // ── 1. JOB APPLICATION SUBMITTED ──────────────────────────────────────────
  adminEvents.on('application:created', async (evt) => {
    try {
      const email = evt.email;
      const phone = evt.phone || 'N/A';
      const fullName = evt.full_name || 'Applicant';
      const firstName = fullName.split(' ')[0] || 'Applicant';
      const roleApplied = evt.role_applied || 'Clinical Staff';
      const appCode = evt.application_code || evt.id;

      // 1A. Alert Admin Immediately
      await mailService.send('admin_new_staff_application', {
        to: AGENCY_ALERT_EMAIL,
        recipientType: 'admin',
        idempotencyKey: `mail:admin_app:${evt.id}`,
        data: {
          full_name: fullName,
          role_applied: roleApplied,
          application_code: appCode,
          email: email || 'N/A',
          phone,
          admin_url: `${BASE_APP_URL}/admin-login.html`
        }
      });

      // 1B. Confirmation to Job Seeker Immediately
      if (email && email.includes('@')) {
        await mailService.send('staff_application_received', {
          to: email,
          recipientType: 'candidate',
          idempotencyKey: `mail:applicant_ack:${evt.id}`,
          data: {
            first_name: firstName,
            role_applied: roleApplied,
            application_code: appCode
          }
        });
      }
    } catch (err) {
      console.error('[MailListener] Error handling application:created:', err.message);
    }
  });

  // ── 2. CLIENT REGISTRATION ────────────────────────────────────────────────
  adminEvents.on('client:registered', async (evt) => {
    try {
      const fullName = evt.full_name || 'Client';
      const orgName = evt.organization_name || 'Your Facility';
      const email = evt.email;
      const phone = evt.phone || 'N/A';

      // 2A. Client Welcome Email Immediately
      if (email && email.includes('@')) {
        await mailService.send('client_welcome', {
          to: email,
          recipientType: 'client',
          userId: evt.id,
          idempotencyKey: `mail:client_welcome:${evt.id}`,
          data: {
            contact_name: fullName,
            facility_name: orgName,
            login_url: `${BASE_APP_URL}/login.html`
          }
        });
      }

      // 2B. Admin Alert Immediately
      await mailService.send('admin_new_client_registered', {
        to: AGENCY_ALERT_EMAIL,
        recipientType: 'admin',
        idempotencyKey: `mail:admin_client_reg:${evt.id}`,
        data: {
          organization_name: orgName,
          full_name: fullName,
          email: email || 'N/A',
          phone,
          admin_url: `${BASE_APP_URL}/admin-login.html`
        }
      });
    } catch (err) {
      console.error('[MailListener] Error handling client:registered:', err.message);
    }
  });

  // ── 3. STAFFING REQUEST SUBMITTED ─────────────────────────────────────────
  adminEvents.on('request:created', async (evt) => {
    try {
      const facilityName = evt.facility_name || 'Client Facility';
      const roleRequested = evt.role_requested || 'Healthcare Professional';
      const urgencyLevel = evt.urgency_level || 'routine';
      const requestCode = evt.request_code || evt.id;
      const shiftType = evt.shift_type || 'Standard Shift';
      const contactName = evt.contact_name || 'Staffing Coordinator';
      const contactEmail = evt.contact_email;

      // 3A. Admin Alert Immediately
      await mailService.send('admin_new_staff_request', {
        to: AGENCY_ALERT_EMAIL,
        recipientType: 'admin',
        idempotencyKey: `mail:admin_req:${evt.id}`,
        data: {
          facility_name: facilityName,
          role_requested: roleRequested,
          urgency_level: urgencyLevel,
          request_code: requestCode,
          admin_url: `${BASE_APP_URL}/admin-login.html`
        }
      });

      // 3B. Client Confirmation Email Immediately
      if (contactEmail && contactEmail.includes('@')) {
        await mailService.send('client_request_confirmation', {
          to: contactEmail,
          recipientType: 'client',
          idempotencyKey: `mail:client_req_ack:${evt.id}`,
          data: {
            contact_name: contactName,
            facility_name: facilityName,
            role_requested: roleRequested,
            shift_type: shiftType,
            request_code: requestCode
          }
        });
      }
    } catch (err) {
      console.error('[MailListener] Error handling request:created:', err.message);
    }
  });

  // ── 4. APPLICATION & ROSTER STATUS UPDATES ────────────────────────────────
  adminEvents.on('status:changed', async (evt) => {
    try {
      if (evt.entity === 'job_applications' && evt.id && evt.stage) {
        // Fetch applicant details
        const [rows] = await pool.query(
          'SELECT email, full_name, role_applied, application_code FROM job_applications WHERE id = ? LIMIT 1',
          [evt.id]
        );
        if (rows.length === 0 || !rows[0].email) return;

        const app = rows[0];
        const firstName = app.full_name ? app.full_name.split(' ')[0] : 'Applicant';
        const roleApplied = app.role_applied || 'Clinical Staff';

        if (evt.stage === 'shortlisted') {
          await mailService.send('staff_application_shortlisted', {
            to: app.email,
            recipientType: 'candidate',
            idempotencyKey: `mail:app_shortlisted:${evt.id}`,
            data: {
              first_name: firstName,
              role_applied: roleApplied,
              next_steps: 'Our clinical talent team is reviewing your availability for an introductory interview.'
            }
          });
        } else if (evt.stage === 'interview') {
          await mailService.send('staff_interview_invitation', {
            to: app.email,
            recipientType: 'candidate',
            idempotencyKey: `mail:app_interview:${evt.id}`,
            data: {
              first_name: firstName,
              role_applied: roleApplied,
              interview_date: 'To be scheduled with coordinator',
              interview_time: '15-minute briefing',
              meeting_link: `${BASE_APP_URL}/contact.html`
            }
          });
        } else if (evt.stage === 'rejected') {
          await mailService.send('staff_application_rejected', {
            to: app.email,
            recipientType: 'candidate',
            idempotencyKey: `mail:app_rejected:${evt.id}`,
            data: {
              first_name: firstName,
              role_applied: roleApplied
            }
          });
        } else if (evt.stage === 'hired') {
          await mailService.send('staff_application_hired', {
            to: app.email,
            recipientType: 'candidate',
            idempotencyKey: `mail:app_hired:${evt.id}`,
            data: {
              first_name: firstName,
              role_applied: roleApplied,
              onboarding_url: `${BASE_APP_URL}/staff-portal.html`
            }
          });
        }
      }
    } catch (err) {
      console.error('[MailListener] Error handling status:changed:', err.message);
    }
  });

  console.log('✅ [MailListener] Domain event mail listeners successfully registered.');
}

module.exports = { initMailListener };
