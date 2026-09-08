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

-- ── 8. Seed Initial Schema Version & Default Users ──
INSERT IGNORE INTO `_schema_version` (`version`, `description`)
VALUES (7, 'Initial MySQL 8.4 LTS Schema with Hashed Usernames and Face JSON vectors');

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
