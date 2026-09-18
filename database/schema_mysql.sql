-- ══════════════════════════════════════════════════════════════════════════════
-- Soukhya Tech Face Recognition Attendance System — Enterprise Database Schema
-- Target Engine: MySQL 8.4 LTS (Long-Term Support) / 8.0 LTS Compatible
-- Storage Engine: InnoDB | Character Set: utf8mb4 | Collation: utf8mb4_0900_ai_ci
-- ══════════════════════════════════════════════════════════════════════════════

SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. Database Initialization ──
CREATE DATABASE IF NOT EXISTS `soukhya_attendance`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE `soukhya_attendance`;

-- ── 2. Schema Version Tracking ──
CREATE TABLE IF NOT EXISTS `_schema_version` (
  `version` INT UNSIGNED NOT NULL PRIMARY KEY,
  `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `description` VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 3. Users Table (Role-Based Auth & Hashed Governance) ──
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL,
  `username_hash` CHAR(64) NOT NULL,
  `username_display` VARCHAR(50) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('ADMIN', 'HR', 'EMPLOYEE', 'USER', 'DEVICE') NOT NULL DEFAULT 'USER',
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_users_username_hash` (`username_hash`),
  UNIQUE KEY `uq_users_username` (`username`),
  KEY `idx_users_role_active` (`role`, `active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 4. Employees Table (Biometric Profiles & Enterprise Master Data) ──
CREATE TABLE IF NOT EXISTS `employees` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `department` VARCHAR(50) NOT NULL,
  `role` VARCHAR(100) NOT NULL,
  `descriptor` JSON NOT NULL,
  `descriptor_hash` CHAR(64) NOT NULL,
  `image` MEDIUMTEXT NULL,
  `status` ENUM('Active', 'Hibernate', 'On Leave', 'Resigned') NOT NULL DEFAULT 'Active',
  `hibernate_start_date` DATE NULL,
  `hibernate_end_date` DATE NULL,
  `hibernate_reason` TEXT NULL,
  `company` VARCHAR(100) NULL,
  `designation` VARCHAR(100) NULL,
  `gender` VARCHAR(20) NULL,
  `date_of_joining` DATE NULL,
  `date_of_confirmation` DATE NULL,
  `last_working_day` DATE NULL,
  `aadhaar_number` VARCHAR(20) NULL,
  `pan_number` VARCHAR(20) NULL,
  `card_number` VARCHAR(50) NULL,
  `phone_no` VARCHAR(25) NULL,
  `email` VARCHAR(100) NULL,
  `reporting_to` VARCHAR(100) NULL,
  `device_code` VARCHAR(50) NULL,
  `sub_department` VARCHAR(50) NULL,
  `division` VARCHAR(50) NULL,
  `grade` VARCHAR(50) NULL,
  `team` VARCHAR(50) NULL,
  `location` VARCHAR(100) NULL,
  `employment_type` VARCHAR(50) NULL,
  `category` VARCHAR(50) NULL,
  `holiday_group` VARCHAR(50) NULL,
  `shift_group` VARCHAR(50) NULL,
  `shift_roster` VARCHAR(50) NULL,
  `geofence` VARCHAR(100) NULL,
  `device_expiry_rule_applicable` TINYINT(1) DEFAULT 0,
  `verification_type` VARCHAR(50) NULL,
  `expiry_start_date` DATE NULL,
  `expiry_end_date` DATE NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `updated_by` VARCHAR(100) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_emp_dept_status` (`department`, `status`),
  KEY `idx_emp_company` (`company`),
  KEY `idx_emp_status_created` (`status`, `created_at`),
  KEY `idx_emp_card_number` (`card_number`),
  KEY `idx_emp_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 5. Attendance Punches Table (High-Speed Time Logging) ──
CREATE TABLE IF NOT EXISTS `attendance` (
  `att_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `emp_id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `dept` VARCHAR(50) NOT NULL,
  `role` VARCHAR(100) NOT NULL,
  `timestamp` DATETIME NOT NULL,
  `status` ENUM('Present', 'Late') NOT NULL DEFAULT 'Present',
  `logged_by` VARCHAR(100) NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_attendance_employee`
    FOREIGN KEY (`emp_id`) REFERENCES `employees` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  KEY `idx_att_emp_ts` (`emp_id`, `timestamp`),
  KEY `idx_att_ts_status` (`timestamp`, `status`),
  KEY `idx_att_dept_ts` (`dept`, `timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 6. Audit Trail Table (Enterprise Compliance & Security) ──
CREATE TABLE IF NOT EXISTS `audit_log` (
  `log_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `table_name` VARCHAR(50) NOT NULL,
  `record_id` VARCHAR(100) NOT NULL,
  `action` ENUM('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'RESET_SEED') NOT NULL,
  `old_values` JSON NULL,
  `new_values` JSON NULL,
  `performed_by` VARCHAR(100) NOT NULL,
  `performed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  KEY `idx_audit_table_record` (`table_name`, `record_id`),
  KEY `idx_audit_performed_at` (`performed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 7. Token Blacklist Table (JWT Revocation) ──
CREATE TABLE IF NOT EXISTS `token_blacklist` (
  `token_hash` CHAR(64) NOT NULL PRIMARY KEY,
  `expires_at` BIGINT UNSIGNED NOT NULL,
  KEY `idx_blacklist_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 8. Master Configuration Settings Table ──
CREATE TABLE IF NOT EXISTS `master_settings` (
  `setting_key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `setting_value` TEXT NOT NULL,
  `category` ENUM('GENERAL', 'ATTENDANCE', 'BIOMETRICS', 'SECURITY') NOT NULL DEFAULT 'GENERAL',
  `description` VARCHAR(255) NULL,
  `updated_by` VARCHAR(100) NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_settings_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 9. Seed Initial Schema Version, Master Settings & Default Users ──
INSERT IGNORE INTO `_schema_version` (`version`, `description`)
VALUES (8, 'Add master_settings table for enterprise business rules');

-- Default Master Settings
INSERT IGNORE INTO `master_settings` (`setting_key`, `setting_value`, `category`, `description`) VALUES
  ('company_name', 'Soukhya Tech Solutions Ltd.', 'GENERAL', 'Global enterprise display name'),
  ('hq_location', 'Bangalore Headquarters, India', 'GENERAL', 'Primary corporate headquarters location'),
  ('timezone', 'Asia/Kolkata', 'GENERAL', 'Default system timezone'),
  ('date_format', 'DD/MM/YYYY', 'GENERAL', 'Default date format across UI and exports'),
  ('currency', 'INR (₹)', 'GENERAL', 'Corporate currency identifier'),
  ('late_grace_mins', '15', 'ATTENDANCE', 'Permissible punch-in delay in minutes before marking Late'),
  ('half_day_hrs', '4.0', 'ATTENDANCE', 'Minimum hours worked required for Half-Day presence'),
  ('full_day_hrs', '8.0', 'ATTENDANCE', 'Standard hours worked required for Full-Day presence'),
  ('punch_cooldown_mins', '5', 'ATTENDANCE', 'Cooldown buffer between consecutive punches to prevent duplicates'),
  ('ot_threshold_mins', '30', 'ATTENDANCE', 'Minimum minutes worked past shift end before Overtime starts counting'),
  ('face_match_threshold', '0.55', 'BIOMETRICS', 'AI Face Recognition Euclidean distance matching threshold (lower is stricter)'),
  ('liveness_detection_enabled', 'true', 'BIOMETRICS', 'Enforce anti-spoofing liveness check during facial scan'),
  ('multi_factor_required', 'false', 'BIOMETRICS', 'Require dual verification (Card/PIN + Face Scan)'),
  ('session_timeout_mins', '30', 'SECURITY', 'Automatic administrator and user session inactivity timeout in minutes'),
  ('pii_masking_enabled', 'true', 'SECURITY', 'Mask sensitive Aadhaar, PAN, and phone numbers in non-admin views'),
  ('audit_retention_days', '180', 'SECURITY', 'Number of days before audit logs are eligible for archival');

-- ── 9. Shift Master & Definitions Table ──
CREATE TABLE IF NOT EXISTS `shifts` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `break_start` TIME NULL,
  `break_end` TIME NULL,
  `break_mins` INT UNSIGNED NOT NULL DEFAULT 60,
  `early_in_mins` INT UNSIGNED NOT NULL DEFAULT 30,
  `late_grace_mins` INT UNSIGNED NOT NULL DEFAULT 15,
  `early_out_mins` INT UNSIGNED NOT NULL DEFAULT 15,
  `min_half_day_hrs` DECIMAL(4,2) NOT NULL DEFAULT 4.00,
  `min_full_day_hrs` DECIMAL(4,2) NOT NULL DEFAULT 8.00,
  `is_night_shift` TINYINT(1) NOT NULL DEFAULT 0,
  `color` VARCHAR(20) NOT NULL DEFAULT '#00d4aa',
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_shifts_code` (`code`),
  KEY `idx_shifts_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Default Standard Shifts Seed
INSERT IGNORE INTO `shifts` (`id`, `name`, `code`, `start_time`, `end_time`, `break_start`, `break_end`, `break_mins`, `early_in_mins`, `late_grace_mins`, `early_out_mins`, `min_half_day_hrs`, `min_full_day_hrs`, `is_night_shift`, `color`) VALUES
  ('SHIFT_GEN', 'General Day Shift', 'GEN', '09:00:00', '18:00:00', '13:00:00', '14:00:00', 60, 30, 15, 15, 4.00, 8.00, 0, '#00d4aa'),
  ('SHIFT_MOR', 'Morning Early Shift', 'MOR', '06:00:00', '14:30:00', '10:00:00', '10:30:00', 30, 30, 15, 15, 4.00, 8.00, 0, '#4f8ef7'),
  ('SHIFT_EVE', 'Evening Afternoon Shift', 'EVE', '14:00:00', '22:30:00', '18:00:00', '18:30:00', 30, 30, 15, 15, 4.00, 8.00, 0, '#f59e0b'),
  ('SHIFT_NIT', 'Night Overnight Shift', 'NIT', '22:00:00', '06:30:00', '02:00:00', '02:30:00', 30, 30, 15, 15, 4.00, 8.00, 1, '#a855f7');

-- Default Administrator: admin / admin123 (SHA-256 username hash, Bcrypt password hash)
INSERT IGNORE INTO `users` (`username`, `username_hash`, `username_display`, `password_hash`, `role`, `active`)
VALUES (
  'admin',
  '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
  'admin',
  '$2a$12$sXN1/1O0xspznvIkGBj2qeH.C3v326J1JmYkZqYhYgW955n37U4sO',
  'ADMIN',
  1
);

-- Default User: user / user123 (SHA-256 username hash, Bcrypt password hash)
INSERT IGNORE INTO `users` (`username`, `username_hash`, `username_display`, `password_hash`, `role`, `active`)
VALUES (
  'user',
  '04f8996da763b7a969b1028ee3007569eaf3a635486ddab211d512c85b9df8fb',
  'user',
  '$2a$12$WBhCotrZQesRnzIiz.ifqOoFqG9Q2G8vjP1Z2x.2G2t0g2E7g7R0m',
  'USER',
  1
);

SET FOREIGN_KEY_CHECKS = 1;
