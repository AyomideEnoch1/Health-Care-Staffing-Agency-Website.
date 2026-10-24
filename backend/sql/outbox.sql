-- ============================================================================
-- DIVINE FINGERS HEALTHCARE SERVICES INC.
-- Email Outbox, Suppressions, Audit Logs, and User Security Hardening
-- ============================================================================

-- 1. EMAIL OUTBOX TABLE
-- Decouples HTTP request/response lifecycles from external SMTP relays.
-- The web app calls enqueueMail(); the standalone worker (workers/mailWorker.js) dispatches.
-- Recipient address is encrypted at rest (AES-256-GCM). Payload contains only sanitized template variables.
CREATE TABLE IF NOT EXISTS `email_outbox` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `type` VARCHAR(60) NOT NULL,
  `recipient_user_id` VARCHAR(36) NULL,
  `to_hash` CHAR(64) NOT NULL,            -- HMAC-SHA256 or SHA-256 of lowercase address for indexed suppression checks
  `to_encrypted` TEXT NOT NULL,           -- AES-256-GCM encrypted recipient address
  `payload` JSON NOT NULL,                -- Sanitized template parameters (NO PHI, NO passwords)
  `status` ENUM('pending', 'sending', 'retry', 'sent', 'failed', 'suppressed') NOT NULL DEFAULT 'pending',
  `attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `next_attempt_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `provider_message_id` VARCHAR(255) NULL,
  `error_code` VARCHAR(50) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `sent_at` DATETIME NULL,
  KEY `idx_outbox_pick` (`status`, `next_attempt_at`),
  KEY `idx_outbox_user` (`recipient_user_id`),
  KEY `idx_outbox_hash` (`to_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. EMAIL SUPPRESSION LIST
-- Stores hard bounces, complaints, spam reports, and unsubscribes to protect sender reputation.
CREATE TABLE IF NOT EXISTS `email_suppressions` (
  `email_hash` CHAR(64) NOT NULL PRIMARY KEY,
  `reason` VARCHAR(50) NOT NULL,           -- hard_bounce | complaint | unsubscribe | manual
  `source` VARCHAR(100) NOT NULL DEFAULT 'webhook',
  `details` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. EMAIL AUDIT LOGS
-- Immutable delivery record without PII/PHI.
CREATE TABLE IF NOT EXISTS `email_audit_logs` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `outbox_id` BIGINT UNSIGNED NULL,
  `type` VARCHAR(60) NOT NULL,
  `recipient_hash` CHAR(64) NOT NULL,
  `provider_message_id` VARCHAR(255) NULL,
  `status` ENUM('queued', 'sent', 'bounced', 'complaint', 'suppressed', 'failed') NOT NULL,
  `error_code` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_email_audit_status` (`status`),
  INDEX `idx_email_audit_hash` (`recipient_hash`),
  INDEX `idx_email_audit_created` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. SMS CONSENT & AUDIT TABLE
-- Complies with TCPA, CASL, and NDPA guidelines for SMS messaging.
CREATE TABLE IF NOT EXISTS `sms_consent` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `phone_hash` CHAR(64) NOT NULL,
  `phone_masked` VARCHAR(30) NOT NULL,
  `user_id` VARCHAR(36) NULL,
  `consent_status` ENUM('opted_in', 'opted_out') NOT NULL DEFAULT 'opted_in',
  `opted_in_at` DATETIME NULL,
  `opted_out_at` DATETIME NULL,
  `source` VARCHAR(50) NOT NULL DEFAULT 'portal_settings',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_sms_phone_hash` (`phone_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
