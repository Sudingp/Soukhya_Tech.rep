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

-- ── 10. Shift Calendar Days Table (Holidays, Weekly Offs & Default Shifts) ──
CREATE TABLE IF NOT EXISTS `shift_calendar_days` (
  `cal_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `cal_date` DATE NOT NULL,
  `day_type` ENUM('WORK', 'WEEKLY_OFF', 'HOLIDAY', 'HALF_DAY') NOT NULL DEFAULT 'WORK',
  `default_shift_id` VARCHAR(50) NULL,
  `title` VARCHAR(100) NULL,
  `is_recurring` TINYINT(1) NOT NULL DEFAULT 0,
  `updated_by` VARCHAR(100) NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_cal_date` (`cal_date`),
  KEY `idx_cal_day_type` (`day_type`),
  CONSTRAINT `fk_cal_shift`
    FOREIGN KEY (`default_shift_id`) REFERENCES `shifts` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 11. Shift Groups Table (Team Cohort & Rotation Rules) ──
CREATE TABLE IF NOT EXISTS `shift_groups` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `rotation_type` ENUM('FIXED', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY') NOT NULL DEFAULT 'FIXED',
  `description` VARCHAR(255) NULL,
  `color` VARCHAR(20) NOT NULL DEFAULT '#4f8ef7',
  `shifts_sequence` JSON NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_shift_group_code` (`code`),
  KEY `idx_shift_group_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 12. Shift Group Members Table (Employee to Group Assignment) ──
CREATE TABLE IF NOT EXISTS `shift_group_members` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `group_id` VARCHAR(50) NOT NULL,
  `emp_id` VARCHAR(50) NOT NULL,
  `start_date` DATE NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_grp_emp` (`group_id`, `emp_id`),
  KEY `idx_grp_member_emp` (`emp_id`),
  CONSTRAINT `fk_grp_member_group`
    FOREIGN KEY (`group_id`) REFERENCES `shift_groups` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_grp_member_emp`
    FOREIGN KEY (`emp_id`) REFERENCES `employees` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 13. Shift Roster Matrix Table (Day-by-Day Employee Assignments) ──
CREATE TABLE IF NOT EXISTS `shift_roster` (
  `roster_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `emp_id` VARCHAR(50) NOT NULL,
  `roster_date` DATE NOT NULL,
  `shift_id` VARCHAR(50) NOT NULL,
  `day_type` ENUM('WORK', 'WEEKLY_OFF', 'HOLIDAY', 'LEAVE', 'OUTDOOR') NOT NULL DEFAULT 'WORK',
  `source` ENUM('DEFAULT', 'GROUP_ROTATION', 'MANUAL_OVERRIDE') NOT NULL DEFAULT 'DEFAULT',
  `note` VARCHAR(255) NULL,
  `assigned_by` VARCHAR(100) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_roster_emp_date` (`emp_id`, `roster_date`),
  KEY `idx_roster_date` (`roster_date`),
  KEY `idx_roster_emp_month` (`emp_id`, `roster_date`),
  CONSTRAINT `fk_roster_emp`
    FOREIGN KEY (`emp_id`) REFERENCES `employees` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_roster_shift`
    FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 14. Departments Table (Department Master) ──
CREATE TABLE IF NOT EXISTS `departments` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `head_emp_id` VARCHAR(50) NULL,
  `parent_dept_id` VARCHAR(50) NULL,
  `division` VARCHAR(50) NULL DEFAULT 'Corporate',
  `location` VARCHAR(100) NOT NULL DEFAULT 'Bangalore HQ',
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_dept_code` (`code`),
  KEY `idx_dept_active` (`active`),
  KEY `idx_dept_parent` (`parent_dept_id`),
  CONSTRAINT `fk_dept_head`
    FOREIGN KEY (`head_emp_id`) REFERENCES `employees` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_dept_parent`
    FOREIGN KEY (`parent_dept_id`) REFERENCES `departments` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 15. Department Shifts Table (Department Default Shift Policy) ──
CREATE TABLE IF NOT EXISTS `department_shifts` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `dept_id` VARCHAR(50) NOT NULL,
  `default_shift_id` VARCHAR(50) NOT NULL DEFAULT 'SHIFT_GEN',
  `allowed_shifts` JSON NOT NULL,
  `auto_apply` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_by` VARCHAR(100) NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_dept_shifts_dept` (`dept_id`),
  CONSTRAINT `fk_dept_shifts_dept`
    FOREIGN KEY (`dept_id`) REFERENCES `departments` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_dept_shifts_shift`
    FOREIGN KEY (`default_shift_id`) REFERENCES `shifts` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 16. Public Holidays Table (Annual Gazette Holidays Master) ──
CREATE TABLE IF NOT EXISTS `public_holidays` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(120) NOT NULL,
  `holiday_date` DATE NOT NULL,
  `holiday_type` ENUM('MANDATORY', 'RESTRICTED', 'COMPANY_DECLARED') NOT NULL DEFAULT 'MANDATORY',
  `applicable_state` VARCHAR(50) NOT NULL DEFAULT 'Karnataka',
  `applicable_location` VARCHAR(100) NOT NULL DEFAULT 'All Locations',
  `description` VARCHAR(255) NULL,
  `is_recurring` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_holiday_date_title` (`holiday_date`, `title`),
  KEY `idx_holiday_date` (`holiday_date`),
  KEY `idx_holiday_type` (`holiday_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Pre-seeded Standard Enterprise Departments
INSERT IGNORE INTO `departments` (`id`, `code`, `name`, `division`, `location`, `active`) VALUES
  ('DEP_ENG', 'ENG', 'Engineering & Product', 'Technology', 'Bangalore HQ', 1),
  ('DEP_HR', 'HR', 'Human Resources', 'Corporate', 'Bangalore HQ', 1),
  ('DEP_FIN', 'FIN', 'Finance & Accounts', 'Corporate', 'Bangalore HQ', 1),
  ('DEP_OPS', 'OPS', '24x7 Operations & Support', 'Operations', 'Bangalore HQ', 1),
  ('DEP_SALES', 'SALES', 'Sales & Marketing', 'Commercial', 'Bangalore HQ', 1),
  ('DEP_IT', 'IT', 'IT Infrastructure & SecOps', 'Technology', 'Bangalore HQ', 1);

-- Pre-seeded Department Shift Mappings
INSERT IGNORE INTO `department_shifts` (`dept_id`, `default_shift_id`, `allowed_shifts`, `auto_apply`, `updated_by`) VALUES
  ('DEP_ENG', 'SHIFT_GEN', '["SHIFT_GEN", "SHIFT_MOR"]', 1, 'system'),
  ('DEP_HR', 'SHIFT_GEN', '["SHIFT_GEN"]', 1, 'system'),
  ('DEP_FIN', 'SHIFT_GEN', '["SHIFT_GEN"]', 1, 'system'),
  ('DEP_OPS', 'SHIFT_MOR', '["SHIFT_MOR", "SHIFT_EVE", "SHIFT_NIT"]', 1, 'system'),
  ('DEP_SALES', 'SHIFT_GEN', '["SHIFT_GEN", "SHIFT_EVE"]', 1, 'system'),
  ('DEP_IT', 'SHIFT_GEN', '["SHIFT_GEN", "SHIFT_NIT"]', 1, 'system');

-- Pre-seeded Karnataka Gazetted Public Holidays 2026 (From Official Gazette / india.gov.in)
INSERT IGNORE INTO `public_holidays` (`title`, `holiday_date`, `holiday_type`, `applicable_state`, `applicable_location`, `description`) VALUES
  ('Uttarayana Punyakala, Makara Sankranti', '2026-01-15', 'MANDATORY', 'Karnataka', 'All Locations', 'Harvest Festival / Makara Sankranti (Gazetted)'),
  ('Republic Day', '2026-01-26', 'MANDATORY', 'Karnataka', 'All Locations', 'National Holiday - Republic Day of India'),
  ('Ugadi Festival', '2026-03-19', 'MANDATORY', 'Karnataka', 'All Locations', 'Kannada New Year (Gazetted)'),
  ('Khutub-E-Ramzan (Eid-ul-Fitr)', '2026-03-21', 'MANDATORY', 'Karnataka', 'All Locations', 'Eid-ul-Fitr Celebration (Gazetted)'),
  ('Mahaveera Jayanthi', '2026-03-31', 'MANDATORY', 'Karnataka', 'All Locations', 'Birth anniversary of Bhagwan Mahaveer (Gazetted)'),
  ('Good Friday', '2026-04-03', 'MANDATORY', 'Karnataka', 'All Locations', 'Christian Observance - Good Friday (Gazetted)'),
  ('Dr. B.R. Ambedkar Jayanthi', '2026-04-14', 'MANDATORY', 'Karnataka', 'All Locations', 'Birth anniversary of Dr. B.R. Ambedkar (Gazetted)'),
  ('Basava Jayanthi, Akshaya Tritiya', '2026-04-20', 'MANDATORY', 'Karnataka', 'All Locations', 'Birth anniversary of Jagadjyothi Basaveshwara (Gazetted)'),
  ('May Day (International Labour Day)', '2026-05-01', 'MANDATORY', 'Karnataka', 'All Locations', 'Labour Day / Worker Rights Day (Gazetted)'),
  ('Bakrid (Eid al-Adha)', '2026-05-28', 'MANDATORY', 'Karnataka', 'All Locations', 'Eid al-Adha Feast of Sacrifice (Gazetted)'),
  ('Last Day of Muharram', '2026-06-26', 'MANDATORY', 'Karnataka', 'All Locations', 'Muharram Observance (Gazetted)'),
  ('Independence Day', '2026-08-15', 'MANDATORY', 'Karnataka', 'All Locations', 'National Holiday - 79th Independence Day of India'),
  ('Eid-Milad', '2026-08-26', 'MANDATORY', 'Karnataka', 'All Locations', 'Milad-un-Nabi (Gazetted)'),
  ('Varasiddhi Vinayaka Vrata', '2026-09-14', 'MANDATORY', 'Karnataka', 'All Locations', 'Ganesh Chaturthi Festival (Gazetted)'),
  ('Mahatma Gandhi Jayanthi', '2026-10-02', 'MANDATORY', 'Karnataka', 'All Locations', 'National Holiday - Birth anniversary of Mahatma Gandhi'),
  ('Mahanavami / Ayudha Pooja', '2026-10-20', 'MANDATORY', 'Karnataka', 'All Locations', 'Ayudha Pooja Festival (Gazetted)'),
  ('Vijayadashami (Dussehra)', '2026-10-21', 'MANDATORY', 'Karnataka', 'All Locations', 'Vijayadashami / Mysore Dasara Festival (Gazetted)'),
  ('Kannada Rajyotsava', '2026-11-01', 'MANDATORY', 'Karnataka', 'All Locations', 'Karnataka State Formation Day (Gazetted)'),
  ('Kanakadasa Jayanthi', '2026-11-10', 'MANDATORY', 'Karnataka', 'All Locations', 'Birth anniversary of Saint Kanakadasa (Gazetted)'),
  ('Guru Nanak Jayanthi', '2026-11-27', 'MANDATORY', 'Karnataka', 'All Locations', 'Birth anniversary of Guru Nanak Dev (Gazetted)'),
  ('Christmas Day', '2026-12-25', 'MANDATORY', 'Karnataka', 'All Locations', 'Christian Festival - Christmas Day (Gazetted)');

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
