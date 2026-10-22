-- ============================================================================
-- DIVINE FINGERS HEALTHCARE SERVICES INC.
-- ENTERPRISE MAILING SYSTEM SCHEMA MIGRATION (UP)
-- Modules: email_templates, email_template_versions, email_logs, email_queue
-- ============================================================================

-- 1. EMAIL TEMPLATES REPOSITORY
CREATE TABLE IF NOT EXISTS email_templates (
  id VARCHAR(64) PRIMARY KEY,
  template_key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  category ENUM('authentication', 'staff', 'client', 'admin', 'marketing', 'notification') NOT NULL DEFAULT 'notification',
  subject VARCHAR(255) NOT NULL,
  body_html LONGTEXT NOT NULL,
  body_text LONGTEXT NULL,
  required_vars JSON NULL,
  sample_vars JSON NULL,
  locale VARCHAR(10) NOT NULL DEFAULT 'en',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  current_version INT NOT NULL DEFAULT 1,
  last_edited_by VARCHAR(120) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_template_category (category),
  INDEX idx_template_active (is_active),
  INDEX idx_template_locale (locale)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. EMAIL TEMPLATE VERSIONS & AUDIT HISTORY
CREATE TABLE IF NOT EXISTS email_template_versions (
  id VARCHAR(64) PRIMARY KEY,
  template_id VARCHAR(64) NOT NULL,
  template_key VARCHAR(100) NOT NULL,
  version INT NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body_html LONGTEXT NOT NULL,
  body_text LONGTEXT NULL,
  required_vars JSON NULL,
  sample_vars JSON NULL,
  change_summary VARCHAR(255) NULL,
  created_by VARCHAR(120) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE CASCADE,
  INDEX idx_tpl_version (template_key, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. ENTERPRISE EMAIL LOGS & TRACEABILITY
CREATE TABLE IF NOT EXISTS email_logs (
  id VARCHAR(64) PRIMARY KEY,
  template_key VARCHAR(100) NOT NULL,
  recipient_email VARCHAR(191) NOT NULL,
  recipient_user_id VARCHAR(64) NULL,
  recipient_type ENUM('staff', 'client', 'admin', 'candidate', 'subscriber', 'visitor') NOT NULL DEFAULT 'visitor',
  subject VARCHAR(255) NOT NULL,
  status ENUM('queued', 'sending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'suppressed') NOT NULL DEFAULT 'queued',
  idempotency_key VARCHAR(191) NULL UNIQUE,
  provider VARCHAR(50) NOT NULL DEFAULT 'smtp',
  provider_message_id VARCHAR(255) NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  error_message TEXT NULL,
  metadata JSON NULL,
  sent_at DATETIME NULL,
  delivered_at DATETIME NULL,
  opened_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_log_recipient (recipient_email),
  INDEX idx_log_status (status),
  INDEX idx_log_template (template_key),
  INDEX idx_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
