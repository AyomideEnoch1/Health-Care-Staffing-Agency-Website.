'use strict';
const crypto = require('crypto');
const pool = require('../db');
const { SEED_TEMPLATES } = require('../services/mail/templateSeeds');
const { htmlToPlainText } = require('../services/mail/templateEngine');

async function seedMailTemplates() {
  console.log(`Starting email template seeding (${SEED_TEMPLATES.length} templates)...`);
  let inserted = 0;
  let updated = 0;

  for (const tpl of SEED_TEMPLATES) {
    const templateKey = tpl.template_key;
    const bodyText = tpl.body_text || htmlToPlainText(tpl.body_html);
    const requiredVarsJson = JSON.stringify(tpl.required_vars || []);
    const sampleVarsJson = JSON.stringify(tpl.sample_vars || {});

    // Check if template exists
    const [existing] = await pool.query(
      'SELECT id, current_version FROM email_templates WHERE template_key = ? LIMIT 1',
      [templateKey]
    );

    let templateId;
    if (existing.length > 0) {
      templateId = existing[0].id;
      await pool.query(
        `UPDATE email_templates SET
          name = ?, category = ?, subject = ?, body_html = ?, body_text = ?,
          required_vars = ?, sample_vars = ?, updated_at = NOW()
        WHERE id = ?`,
        [
          tpl.name,
          tpl.category || 'notification',
          tpl.subject,
          tpl.body_html,
          bodyText,
          requiredVarsJson,
          sampleVarsJson,
          templateId
        ]
      );
      updated++;
    } else {
      templateId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO email_templates (
          id, template_key, name, category, subject, body_html, body_text,
          required_vars, sample_vars, locale, is_active, current_version, last_edited_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'en', 1, 1, 'system')`,
        [
          templateId,
          templateKey,
          tpl.name,
          tpl.category || 'notification',
          tpl.subject,
          tpl.body_html,
          bodyText,
          requiredVarsJson,
          sampleVarsJson
        ]
      );
      inserted++;
    }

    // Ensure version 1 exists in email_template_versions
    const [vCheck] = await pool.query(
      'SELECT id FROM email_template_versions WHERE template_id = ? AND version = 1 LIMIT 1',
      [templateId]
    );

    if (vCheck.length === 0) {
      const versionId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO email_template_versions (
          id, template_id, template_key, version, subject, body_html, body_text,
          required_vars, sample_vars, change_summary, created_by
        ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, 'Initial seed version', 'system')`,
        [
          versionId,
          templateId,
          templateKey,
          tpl.subject,
          tpl.body_html,
          bodyText,
          requiredVarsJson,
          sampleVarsJson
        ]
      );
    }
  }

  console.log(`✅ Template seeding complete! Inserted: ${inserted}, Updated: ${updated}, Total: ${SEED_TEMPLATES.length}`);
}

if (require.main === module) {
  seedMailTemplates()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Seeding error:', err);
      process.exit(1);
    });
}

module.exports = { seedMailTemplates };
