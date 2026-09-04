-- ============================================================================
-- DIVINE FINGERS HEALTHCARE SERVICES INC. - 3NF NORMALIZED SCHEMA
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `divine_fingers_dev` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `divine_fingers_dev`;

-- 1. ADMINS TABLE
-- Purpose: Secure administrator accounts replacing client-side PINs
-- Cryptographic Rule: password_hash uses bcrypt (cost factor 12).
CREATE TABLE IF NOT EXISTS `admins` (
  `id` VARCHAR(36) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `role` ENUM('super-admin', 'dispatch', 'care-coordinator') NOT NULL DEFAULT 'care-coordinator',
  `failed_login_attempts` INT UNSIGNED NOT NULL DEFAULT 0,
  `lock_until` DATETIME NULL DEFAULT NULL,
  `totp_secret` VARCHAR(128) NULL DEFAULT NULL,
  `totp_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `email_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `email_verification_token` VARCHAR(128) NULL DEFAULT NULL,
  `email_verification_expires` DATETIME NULL DEFAULT NULL,
  `last_login` TIMESTAMP NULL DEFAULT NULL,
  `last_login_ip` VARCHAR(45) NULL DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_admins_email` (`email`),
  INDEX `idx_admins_status` (`is_active`, `lock_until`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. STAFF ROSTER TABLE
-- Purpose: Verified nurses and personal support workers on the agency roster.
CREATE TABLE IF NOT EXISTS `staff_roster` (
  `id` VARCHAR(36) NOT NULL,
  `staff_code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `role` ENUM('RN', 'RPN', 'PSW', 'Companion', 'Travel Nurse') NOT NULL,
  `specialty` VARCHAR(120) NOT NULL,
  `cno_registration_num` VARCHAR(50) NULL,
  `status` ENUM('available', 'on-shift', 'off-duty', 'suspended') NOT NULL DEFAULT 'available',
  `credential_status` ENUM('verified', 'expiring', 'expired') NOT NULL DEFAULT 'verified',
  `rating` DECIMAL(3,2) NOT NULL DEFAULT 5.00,
  `shifts_completed` INT UNSIGNED NOT NULL DEFAULT 0,
  `region` VARCHAR(80) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `hourly_rate` DECIMAL(6,2) NOT NULL,
  `cpr_expiry_date` DATE NOT NULL,
  `vss_status` VARCHAR(60) NOT NULL DEFAULT 'Clear',
  `n95_fit_test` VARCHAR(60) NOT NULL DEFAULT '3M Valid',
  `avatar_url` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_roster_code` (`staff_code`),
  INDEX `idx_roster_role_status` (`role`, `status`),
  INDEX `idx_roster_cred_status` (`credential_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. STAFFING REQUESTS TABLE
-- Purpose: Incoming shift orders submitted by healthcare facilities (clients.html).
CREATE TABLE IF NOT EXISTS `staffing_requests` (
  `id` VARCHAR(36) NOT NULL,
  `request_code` VARCHAR(20) NOT NULL,
  `facility_name` VARCHAR(150) NOT NULL,
  `unit_department` VARCHAR(100) NULL,
  `contact_name` VARCHAR(100) NOT NULL,
  `contact_email` VARCHAR(191) NOT NULL,
  `contact_phone` VARCHAR(30) NOT NULL,
  `role_requested` ENUM('RN', 'RPN', 'PSW', 'Companion', 'Travel Nurse', 'Multiple') NOT NULL,
  `shift_type` VARCHAR(60) NOT NULL,
  `urgency_level` ENUM('routine', 'urgent', 'emergency_surge') NOT NULL DEFAULT 'routine',
  `start_date` DATE NULL,
  `status` ENUM('pending', 'dispatched', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  `assigned_staff_id` VARCHAR(36) NULL,
  `special_instructions` TEXT NULL,
  `ip_address` VARCHAR(45) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_requests_code` (`request_code`),
  INDEX `idx_requests_status` (`status`),
  INDEX `idx_requests_created` (`created_at` DESC),
  INDEX `idx_requests_facility` (`facility_name`),
  CONSTRAINT `fk_requests_assigned_staff`
    FOREIGN KEY (`assigned_staff_id`) REFERENCES `staff_roster` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. JOB APPLICATIONS TABLE
-- Purpose: Candidate submissions from jobseekers.html with uploaded resume references.
CREATE TABLE IF NOT EXISTS `job_applications` (
  `id` VARCHAR(36) NOT NULL,
  `application_code` VARCHAR(20) NOT NULL,
  `full_name` VARCHAR(120) NOT NULL,
  `role_applied` ENUM('RN', 'RPN', 'PSW', 'Companion', 'Travel Nurse') NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `license_registration` VARCHAR(80) NOT NULL,
  `stage` ENUM('new', 'review', 'interview', 'credential_check', 'hired', 'rejected') NOT NULL DEFAULT 'new',
  `resume_original_name` VARCHAR(255) NOT NULL,
  `resume_stored_name` VARCHAR(255) NOT NULL,
  `resume_mime_type` VARCHAR(100) NOT NULL,
  `resume_file_size` INT UNSIGNED NOT NULL,
  `resume_storage_path` VARCHAR(255) NOT NULL,
  `experience_summary` TEXT NULL,
  `ip_address` VARCHAR(45) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_apps_code` (`application_code`),
  INDEX `idx_apps_stage` (`stage`),
  INDEX `idx_apps_role` (`role_applied`),
  INDEX `idx_apps_created` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. CONTACT INQUIRIES TABLE
-- Purpose: Inquiries submitted via contact.html and index.html forms.
CREATE TABLE IF NOT EXISTS `contact_inquiries` (
  `id` VARCHAR(36) NOT NULL,
  `inquiry_code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(30) NULL,
  `inquiry_type` VARCHAR(80) NOT NULL DEFAULT 'General Inquiry',
  `message` TEXT NOT NULL,
  `status` ENUM('unread', 'in_progress', 'resolved', 'archived') NOT NULL DEFAULT 'unread',
  `ip_address` VARCHAR(45) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_inquiries_code` (`inquiry_code`),
  INDEX `idx_inquiries_status` (`status`),
  INDEX `idx_inquiries_created` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. AUDIT LOGS TABLE
-- Purpose: Immutable record of administrative operations and logins.
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(36) NOT NULL,
  `admin_id` VARCHAR(36) NULL,
  `actor_name` VARCHAR(100) NOT NULL,
  `action` VARCHAR(60) NOT NULL,
  `target_entity` VARCHAR(60) NOT NULL,
  `target_id` VARCHAR(36) NULL,
  `details` TEXT NOT NULL,
  `severity` ENUM('info', 'warning', 'critical') NOT NULL DEFAULT 'info',
  `ip_address` VARCHAR(45) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_audit_admin` (`admin_id`),
  INDEX `idx_audit_action` (`action`),
  INDEX `idx_audit_created` (`created_at` DESC),
  CONSTRAINT `fk_audit_admin`
    FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. USERS TABLE
-- Purpose: Public website accounts for Healthcare Facilities (Clients) and Healthcare Workers.
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(36) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(120) NOT NULL,
  `role` ENUM('client', 'healthcare_worker') NOT NULL DEFAULT 'client',
  `organization_name` VARCHAR(150) NULL,
  `phone` VARCHAR(30) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `email_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `last_login` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_users_email` (`email`),
  INDEX `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

