-- ══════════════════════════════════════════════════════════════════════════════
-- Soukhya Tech Face Recognition Attendance System — Enterprise Database Schema
-- Target Engine: MySQL 8.4 LTS (Long-Term Support) / MariaDB Compatible
-- Storage Engine: InnoDB | Character Set: utf8mb4 | Collation: utf8mb4_0900_ai_ci
-- Architecture: Normalized Transactional Relational Database (1NF, 2NF, 3NF)
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

-- ── 4. Master: Companies (Enterprise Organization Units) ──
CREATE TABLE IF NOT EXISTS `companies` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `short_name` VARCHAR(50) NOT NULL,
  `logo_url` VARCHAR(255) NULL,
  `address` VARCHAR(255) NULL,
  `city` VARCHAR(100) NOT NULL DEFAULT 'Bangalore',
  `state` VARCHAR(100) NOT NULL DEFAULT 'Karnataka',
  `country` VARCHAR(100) NOT NULL DEFAULT 'India',
  `pincode` VARCHAR(20) NULL,
  `email` VARCHAR(255) NULL,
  `phone` VARCHAR(25) NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_companies_code` (`code`),
  UNIQUE KEY `uq_companies_short_name` (`short_name`),
  KEY `idx_companies_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 5. Master: Departments (Divisions & Functional Units) ──
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
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 6. Master: Designations (Hierarchical Job Roles) ──
CREATE TABLE IF NOT EXISTS `designations` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `dept_id` VARCHAR(50) NULL,
  `grade_level` VARCHAR(20) NOT NULL DEFAULT 'L1',
  `description` VARCHAR(255) NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_designations_code` (`code`),
  KEY `idx_designations_dept` (`dept_id`),
  KEY `idx_designations_active` (`active`),
  CONSTRAINT `fk_designations_dept`
    FOREIGN KEY (`dept_id`) REFERENCES `departments` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 7. Master: Geofences (GPS Boundaries & Mobile Zones) ──
CREATE TABLE IF NOT EXISTS `geofences` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `latitude` DECIMAL(10, 7) NOT NULL,
  `longitude` DECIMAL(10, 7) NOT NULL,
  `radius_meters` INT UNSIGNED NOT NULL DEFAULT 150,
  `enforcement_mode` ENUM('STRICT', 'WARNING') NOT NULL DEFAULT 'STRICT',
  `allowed_depts` JSON NULL,
  `ip_range` VARCHAR(100) NULL,
  `wifi_bssid` VARCHAR(100) NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_geofence_code` (`code`),
  KEY `idx_geofence_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 8. Master: Branches (Physical Campus & Office Locations) ──
CREATE TABLE IF NOT EXISTS `branches` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `address` VARCHAR(255) NULL,
  `city` VARCHAR(100) NOT NULL DEFAULT 'Bangalore',
  `state` VARCHAR(100) NOT NULL DEFAULT 'Karnataka',
  `country` VARCHAR(100) NOT NULL DEFAULT 'India',
  `pincode` VARCHAR(20) NULL,
  `geofence_id` VARCHAR(50) NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_branches_code` (`code`),
  KEY `idx_branches_geofence` (`geofence_id`),
  KEY `idx_branches_active` (`active`),
  CONSTRAINT `fk_branches_geofence`
    FOREIGN KEY (`geofence_id`) REFERENCES `geofences` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 9. Master: Shifts (Work Timing Rules) ──
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

-- ── 10. Master: Employment Types (Workforce Classifications) ──
CREATE TABLE IF NOT EXISTS `employment_types` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `code` VARCHAR(20) NOT NULL,
  `title` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NULL,
  `probation_days` INT UNSIGNED NOT NULL DEFAULT 90,
  `notice_period_days` INT UNSIGNED NOT NULL DEFAULT 30,
  `pf_esi_eligible` TINYINT(1) NOT NULL DEFAULT 1,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_employment_type_code` (`code`),
  KEY `idx_employment_type_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 11. Master Configuration Settings Table ──
CREATE TABLE IF NOT EXISTS `master_settings` (
  `setting_key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `setting_value` TEXT NOT NULL,
  `category` ENUM('GENERAL', 'ATTENDANCE', 'BIOMETRICS', 'SECURITY') NOT NULL DEFAULT 'GENERAL',
  `description` VARCHAR(255) NULL,
  `updated_by` VARCHAR(100) NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_settings_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 12. Employees Table (Core Biometric Profiles & 3NF Normalized Relational Entity) ──
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
  `company_id` VARCHAR(50) NULL,
  `department_id` VARCHAR(50) NULL,
  `designation` VARCHAR(100) NULL,
  `designation_id` VARCHAR(50) NULL,
  `branch_id` VARCHAR(50) NULL,
  `employment_type_id` VARCHAR(50) NULL,
  `primary_shift_id` VARCHAR(50) NULL,
  `geofence_id` VARCHAR(50) NULL,
  `gender` VARCHAR(20) NULL,
  `date_of_joining` DATE NULL,
  `date_of_confirmation` DATE NULL,
  `last_working_day` DATE NULL,
  `aadhaar_number` VARCHAR(255) NULL,
  `pan_number` VARCHAR(255) NULL,
  `card_number` VARCHAR(255) NULL,
  `phone_no` VARCHAR(255) NULL,
  `email` VARCHAR(255) NULL,
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
  KEY `idx_emp_company_id` (`company_id`),
  KEY `idx_emp_dept_id` (`department_id`),
  KEY `idx_emp_designation_id` (`designation_id`),
  KEY `idx_emp_branch_id` (`branch_id`),
  KEY `idx_emp_employment_type_id` (`employment_type_id`),
  KEY `idx_emp_primary_shift_id` (`primary_shift_id`),
  KEY `idx_emp_geofence_id` (`geofence_id`),
  KEY `idx_emp_status_created` (`status`, `created_at`),
  KEY `idx_emp_card_number` (`card_number`),
  KEY `idx_emp_email` (`email`),
  CONSTRAINT `fk_emp_company`
    FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_emp_dept`
    FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_emp_designation`
    FOREIGN KEY (`designation_id`) REFERENCES `designations` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_emp_branch`
    FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_emp_employment_type`
    FOREIGN KEY (`employment_type_id`) REFERENCES `employment_types` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_emp_shift`
    FOREIGN KEY (`primary_shift_id`) REFERENCES `shifts` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_emp_geofence`
    FOREIGN KEY (`geofence_id`) REFERENCES `geofences` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 13. Department Shifts Table (Department Default Shift Policy) ──
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

-- ── 14. Shift Calendar Days Table (Holidays, Weekly Offs & Default Shifts) ──
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

-- ── 15. Shift Groups Table (Team Cohort & Rotation Rules) ──
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

-- ── 16. Shift Group Members Table (Employee to Group Assignment) ──
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

-- ── 17. Shift Roster Matrix Table (Day-by-Day Employee Assignments) ──
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
  KEY `idx_roster_date_shift_emp_cov` (`roster_date`, `shift_id`, `emp_id`),
  CONSTRAINT `fk_roster_emp`
    FOREIGN KEY (`emp_id`) REFERENCES `employees` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_roster_shift`
    FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 18. Public Holidays Table (Annual Gazette Holidays Master) ──
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

-- ── 19. Employee Groups Table (Cohorts & Cross-Functional Teams) ──
CREATE TABLE IF NOT EXISTS `employee_cohort_groups` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `category` VARCHAR(50) NOT NULL DEFAULT 'OPERATIONAL',
  `description` VARCHAR(255) NULL,
  `leader_emp_id` VARCHAR(50) NULL,
  `color` VARCHAR(20) NOT NULL DEFAULT '#4f8ef7',
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_emp_cohort_group_code` (`code`),
  KEY `idx_emp_cohort_group_active` (`active`),
  CONSTRAINT `fk_emp_cohort_group_leader`
    FOREIGN KEY (`leader_emp_id`) REFERENCES `employees` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 20. Employee Group Members Table (Junction Mapping) ──
CREATE TABLE IF NOT EXISTS `employee_cohort_members` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `group_id` VARCHAR(50) NOT NULL,
  `emp_id` VARCHAR(50) NOT NULL,
  `role_in_group` VARCHAR(50) NOT NULL DEFAULT 'Member',
  `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_cohort_grp_emp` (`group_id`, `emp_id`),
  KEY `idx_cohort_member_emp` (`emp_id`),
  CONSTRAINT `fk_cohort_member_group`
    FOREIGN KEY (`group_id`) REFERENCES `employee_cohort_groups` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cohort_member_emp`
    FOREIGN KEY (`emp_id`) REFERENCES `employees` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 21. Work Codes Table (Project, Task & Cost Center Tracking) ──
CREATE TABLE IF NOT EXISTS `work_codes` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `category` ENUM('BILLABLE_PROJECT', 'CLIENT_ONSITE', 'INTERNAL_OPS', 'TRAINING_LD', 'FACILITY_MAINT') NOT NULL DEFAULT 'BILLABLE_PROJECT',
  `description` VARCHAR(255) NULL,
  `billing_rate_multiplier` DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  `ot_eligible` TINYINT(1) NOT NULL DEFAULT 1,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_work_code_code` (`code`),
  KEY `idx_work_code_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 22. Attendance Punches Table (High-Speed Time Logging) ──
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
  `punch_date` DATE GENERATED ALWAYS AS (CAST(`timestamp` AS DATE)) STORED,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_attendance_employee`
    FOREIGN KEY (`emp_id`) REFERENCES `employees` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  KEY `idx_att_emp_ts` (`emp_id`, `timestamp`),
  KEY `idx_att_ts_status` (`timestamp`, `status`),
  KEY `idx_att_dept_ts` (`dept`, `timestamp`),
  KEY `idx_att_pdate_dept_stat_cov` (`punch_date`, `dept`, `status`, `emp_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 23. Employee Overtime Register Table ──
CREATE TABLE IF NOT EXISTS `ot_records` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `emp_id` VARCHAR(50) NOT NULL,
  `ot_date` DATE NOT NULL,
  `shift_id` VARCHAR(50) NULL,
  `scheduled_hours` DECIMAL(4,2) NOT NULL DEFAULT 8.00,
  `actual_hours` DECIMAL(4,2) NOT NULL DEFAULT 8.00,
  `ot_hours` DECIMAL(4,2) NOT NULL DEFAULT 0.00,
  `ot_multiplier` DECIMAL(4,2) NOT NULL DEFAULT 1.50,
  `ot_rate_type` ENUM('STANDARD_DAY', 'WEEKLY_OFF', 'PUBLIC_HOLIDAY') NOT NULL DEFAULT 'STANDARD_DAY',
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'COMP_OFF') NOT NULL DEFAULT 'PENDING',
  `approved_by` VARCHAR(100) NULL,
  `approved_at` DATETIME NULL,
  `comments` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_emp_ot_date` (`emp_id`, `ot_date`),
  KEY `idx_ot_date` (`ot_date`),
  KEY `idx_ot_status` (`status`),
  CONSTRAINT `fk_ot_emp`
    FOREIGN KEY (`emp_id`) REFERENCES `employees` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ot_shift`
    FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 24. Leave Types Master Table ──
CREATE TABLE IF NOT EXISTS `leave_types` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `category` VARCHAR(30) NOT NULL DEFAULT 'CASUAL',
  `description` VARCHAR(255) NULL,
  `paid` TINYINT(1) NOT NULL DEFAULT 1,
  `annual_quota_days` DECIMAL(4,1) NOT NULL DEFAULT 12.0,
  `carry_forward_max` DECIMAL(4,1) NOT NULL DEFAULT 0.0,
  `encashable` TINYINT(1) NOT NULL DEFAULT 0,
  `color` VARCHAR(20) NOT NULL DEFAULT '#4f8ef7',
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_leave_type_code` (`code`),
  KEY `idx_leave_type_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 25. Employee Leave Applications & Entries Table ──
CREATE TABLE IF NOT EXISTS `employee_leave_entries` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `emp_id` VARCHAR(50) NOT NULL,
  `leave_type_id` VARCHAR(50) NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `total_days` DECIMAL(4,1) NOT NULL DEFAULT 1.0,
  `reason` VARCHAR(255) NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `approved_by` VARCHAR(100) NULL,
  `approved_at` DATETIME NULL,
  `comments` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_leave_emp_dates` (`emp_id`, `start_date`, `end_date`),
  KEY `idx_leave_status` (`status`),
  CONSTRAINT `fk_leave_emp`
    FOREIGN KEY (`emp_id`) REFERENCES `employees` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_leave_type`
    FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 26. Employee Outdoor / On-Duty (OD) Entries Table ──
CREATE TABLE IF NOT EXISTS `employee_outdoor_entries` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `emp_id` VARCHAR(50) NOT NULL,
  `od_date` DATE NOT NULL,
  `start_time` TIME NOT NULL DEFAULT '09:00:00',
  `end_time` TIME NOT NULL DEFAULT '18:00:00',
  `destination_client` VARCHAR(150) NOT NULL,
  `purpose` VARCHAR(255) NOT NULL,
  `travel_allowance_eligible` TINYINT(1) NOT NULL DEFAULT 1,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `approved_by` VARCHAR(100) NULL,
  `approved_at` DATETIME NULL,
  `comments` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_od_emp_date` (`emp_id`, `od_date`),
  KEY `idx_od_status` (`status`),
  CONSTRAINT `fk_od_emp`
    FOREIGN KEY (`emp_id`) REFERENCES `employees` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 27. Audit Trail Table (Enterprise Compliance & Security) ──
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

-- ── 28. Token Blacklist Table (JWT Revocation) ──
CREATE TABLE IF NOT EXISTS `token_blacklist` (
  `token_hash` CHAR(64) NOT NULL PRIMARY KEY,
  `expires_at` BIGINT UNSIGNED NOT NULL,
  KEY `idx_blacklist_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 29. Master: Divisions (Business Units & Strategic Verticals) ──
CREATE TABLE IF NOT EXISTS `divisions` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `company_id` VARCHAR(50) NOT NULL,
  `head_emp_id` VARCHAR(50) NULL,
  `budget_code` VARCHAR(50) NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_divisions_code` (`code`),
  KEY `idx_divisions_company` (`company_id`),
  KEY `idx_divisions_active` (`active`),
  CONSTRAINT `fk_divisions_company`
    FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_divisions_head`
    FOREIGN KEY (`head_emp_id`) REFERENCES `employees` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 30. Master: Cost Centers (Financial & Project Cost Accounting) ──
CREATE TABLE IF NOT EXISTS `cost_centers` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `company_id` VARCHAR(50) NOT NULL,
  `dept_id` VARCHAR(50) NULL,
  `gl_account` VARCHAR(50) NULL,
  `annual_budget` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_cost_centers_code` (`code`),
  KEY `idx_cost_centers_company` (`company_id`),
  KEY `idx_cost_centers_dept` (`dept_id`),
  KEY `idx_cost_centers_active` (`active`),
  CONSTRAINT `fk_cost_centers_company`
    FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cost_centers_dept`
    FOREIGN KEY (`dept_id`) REFERENCES `departments` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 31. Master: Biometric Devices (Edge Hardware & Terminal Manager) ──
CREATE TABLE IF NOT EXISTS `biometric_devices` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `serial_number` VARCHAR(50) NOT NULL,
  `device_name` VARCHAR(100) NOT NULL,
  `device_ip` VARCHAR(45) NOT NULL,
  `device_port` INT UNSIGNED NOT NULL DEFAULT 4370,
  `device_model` VARCHAR(50) NOT NULL DEFAULT 'eSSL SilkBio-101TC',
  `protocol` ENUM('ZKEM', 'HIKVISION', 'ESSL', 'ANVIZ', 'REST_API') NOT NULL DEFAULT 'ESSL',
  `branch_id` VARCHAR(50) NULL,
  `direction` ENUM('IN', 'OUT', 'BOTH') NOT NULL DEFAULT 'BOTH',
  `last_heartbeat` DATETIME NULL,
  `status` ENUM('ONLINE', 'OFFLINE', 'SYNCING', 'ERROR') NOT NULL DEFAULT 'ONLINE',
  `template_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `buffer_lag_ms` INT UNSIGNED NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_biometric_devices_serial` (`serial_number`),
  KEY `idx_biometric_devices_branch` (`branch_id`),
  KEY `idx_biometric_devices_status` (`status`, `active`),
  CONSTRAINT `fk_biometric_devices_branch`
    FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 32. Master: Employee Transfers & Promotion Audit Ledger ──
CREATE TABLE IF NOT EXISTS `employee_transfers` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `emp_id` VARCHAR(50) NOT NULL,
  `prev_company_id` VARCHAR(50) NULL,
  `new_company_id` VARCHAR(50) NULL,
  `prev_dept_id` VARCHAR(50) NULL,
  `new_dept_id` VARCHAR(50) NULL,
  `prev_desig_id` VARCHAR(50) NULL,
  `new_desig_id` VARCHAR(50) NULL,
  `prev_branch_id` VARCHAR(50) NULL,
  `new_branch_id` VARCHAR(50) NULL,
  `transfer_type` ENUM('PROMOTION', 'DEPARTMENT_TRANSFER', 'BRANCH_RELOCATION', 'LATERAL_MOVE', 'RE_DESIGNATION') NOT NULL,
  `effective_date` DATE NOT NULL,
  `remarks` TEXT NULL,
  `approved_by` VARCHAR(50) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_transfers_emp_date` (`emp_id`, `effective_date`),
  KEY `idx_transfers_type` (`transfer_type`),
  CONSTRAINT `fk_transfers_emp`
    FOREIGN KEY (`emp_id`) REFERENCES `employees` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 33. High-Speed Transactional Buffer: Fast Punch Ingestion Pipeline ──
CREATE TABLE IF NOT EXISTS `fast_punch_buffer` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `emp_id` VARCHAR(50) NOT NULL,
  `terminal_id` VARCHAR(50) NOT NULL,
  `punch_timestamp` DATETIME NOT NULL,
  `punch_state` ENUM('CHECK_IN', 'CHECK_OUT', 'BREAK_IN', 'BREAK_OUT', 'AUTO') NOT NULL DEFAULT 'AUTO',
  `verification_type` ENUM('FACE', 'FINGERPRINT', 'CARD', 'PASSCODE', 'GPS_MOBILE') NOT NULL DEFAULT 'FACE',
  `temperature` DECIMAL(4,1) NULL,
  `mask_detected` TINYINT(1) NOT NULL DEFAULT 0,
  `processed` TINYINT(1) NOT NULL DEFAULT 0,
  `process_latency_ms` DECIMAL(6,2) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_punch_proc_created` (`processed`, `created_at`),
  KEY `idx_punch_emp_time` (`emp_id`, `punch_timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ══════════════════════════════════════════════════════════════════════════════
-- PRE-SEEDED ENTERPRISE MASTER DATA (1NF, 2NF, 3NF ALIGNED)
-- ══════════════════════════════════════════════════════════════════════════════

-- Schema Version
INSERT IGNORE INTO `_schema_version` (`version`, `description`)
VALUES (10, 'Normalized 3NF schema for companies, designations, branches, shifts, and masters');

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

-- Pre-seeded Companies
INSERT IGNORE INTO `companies` (`id`, `code`, `name`, `short_name`, `address`, `city`, `state`, `country`, `pincode`, `email`, `phone`, `active`) VALUES
  ('COMP_KRIDE', 'KRIDE', 'Rail Infrastructure Development Company (Karnataka) Ltd', 'KRIDE', 'Samparka Soudha, Dr. Rajkumar Road, Rajajinagar', 'Bangalore', 'Karnataka', 'India', '560010', 'contact@kride.in', '+91 80 2296 9300', 1),
  ('COMP_BMRCL', 'BMRCL', 'Bangalore Metro Rail Corporation Limited', 'BMRCL', 'BMTC Complex, Shanthinagar, K.H. Road', 'Bangalore', 'Karnataka', 'India', '560027', 'contact@bmrc.co.in', '+91 80 2296 9200', 1),
  ('COMP_SOUKHYA', 'SOUKHYA', 'Soukhya Tech Solutions Ltd.', 'SOUKHYA', 'Outer Ring Road, Bellandur Eco-Space', 'Bangalore', 'Karnataka', 'India', '560103', 'support@soukhyatech.com', '+91 80 4099 8877', 1),
  ('COMP_INFOPARK', 'INFOPARK', 'Infopark IT Enterprises Ltd.', 'INFOPARK', 'Whitefield Export Promotion Industrial Park', 'Bangalore', 'Karnataka', 'India', '560066', 'info@infoparkit.in', '+91 80 6712 3456', 1);

-- Pre-seeded Standard Enterprise Departments
INSERT IGNORE INTO `departments` (`id`, `code`, `name`, `division`, `location`, `active`) VALUES
  ('DEP_ENG', 'ENG', 'Engineering & Product', 'Technology', 'Bangalore HQ', 1),
  ('DEP_HR', 'HR', 'Human Resources', 'Corporate', 'Bangalore HQ', 1),
  ('DEP_FIN', 'FIN', 'Finance & Accounts', 'Corporate', 'Bangalore HQ', 1),
  ('DEP_OPS', 'OPS', '24x7 Operations & Support', 'Operations', 'Bangalore HQ', 1),
  ('DEP_SALES', 'SALES', 'Sales & Marketing', 'Commercial', 'Bangalore HQ', 1),
  ('DEP_IT', 'IT', 'IT Infrastructure & SecOps', 'Technology', 'Bangalore HQ', 1);

-- Pre-seeded Designations
INSERT IGNORE INTO `designations` (`id`, `code`, `name`, `dept_id`, `grade_level`, `description`, `active`) VALUES
  ('DES_SE', 'SE', 'Software Engineer', 'DEP_ENG', 'L1', 'Full-stack software engineering', 1),
  ('DES_SSE', 'SSE', 'Senior Software Engineer', 'DEP_ENG', 'L2', 'Senior architecture and backend systems', 1),
  ('DES_TL', 'TL', 'Technical Lead', 'DEP_ENG', 'L3', 'Technical mentorship and delivery lead', 1),
  ('DES_ARCH', 'ARCH', 'Principal Architect', 'DEP_ENG', 'L4', 'Enterprise system design & deep-tech', 1),
  ('DES_HRE', 'HRE', 'HR Executive', 'DEP_HR', 'L1', 'Talent acquisition and onboarding', 1),
  ('DES_HRM', 'HRM', 'HR Manager', 'DEP_HR', 'L3', 'People operations and statutory compliance', 1),
  ('DES_ACC', 'ACC', 'Senior Accountant', 'DEP_FIN', 'L2', 'Corporate taxation and payroll audit', 1),
  ('DES_FINM', 'FINM', 'Finance Manager', 'DEP_FIN', 'L3', 'Financial planning and budgeting', 1),
  ('DES_OPSE', 'OPSE', 'Operations Executive', 'DEP_OPS', 'L1', 'Shift monitoring and customer support', 1),
  ('DES_OPSL', 'OPSL', 'Operations Lead', 'DEP_OPS', 'L3', '24x7 site operations management', 1),
  ('DES_SEM', 'SEM', 'Sales Executive', 'DEP_SALES', 'L1', 'Enterprise client relations', 1),
  ('DES_SDIR', 'SDIR', 'Sales Director', 'DEP_SALES', 'L5', 'Commercial strategy and regional growth', 1),
  ('DES_SYSADMIN', 'SYSADMIN', 'Lead Systems Administrator', 'DEP_IT', 'L3', 'Cloud infrastructure and networking', 1),
  ('DES_SECOPS', 'SECOPS', 'SecOps & Security Analyst', 'DEP_IT', 'L2', 'Information security and audit vigilance', 1);

-- Pre-seeded Geofences
INSERT IGNORE INTO `geofences` (`id`, `code`, `name`, `latitude`, `longitude`, `radius_meters`, `enforcement_mode`, `active`) VALUES
  ('GEO_HQ', 'BLR_HQ', 'Soukhya Tech Corporate HQ (Bangalore)', 12.9716000, 77.5946000, 150, 'STRICT', 1),
  ('GEO_WFD', 'WFD_PARK', 'Whitefield Tech Campus (SEZ Unit)', 12.9698000, 77.7499000, 250, 'STRICT', 1),
  ('GEO_MYS', 'MYS_PLANT', 'Mysore R&D and Manufacturing Center', 12.3051000, 76.6551000, 300, 'WARNING', 1),
  ('GEO_REMOTE', 'FIELD_SALES', 'Client Onsite & Flexible Field Zone', 12.9716000, 77.5946000, 5000, 'WARNING', 1);

-- Pre-seeded Branches / Locations
INSERT IGNORE INTO `branches` (`id`, `code`, `name`, `address`, `city`, `state`, `country`, `pincode`, `geofence_id`, `active`) VALUES
  ('BR_HQ', 'BLR_HQ', 'Bangalore Corporate Headquarters', 'Outer Ring Road, Bellandur Eco-Space', 'Bangalore', 'Karnataka', 'India', '560103', 'GEO_HQ', 1),
  ('BR_WFD', 'WFD_PARK', 'Whitefield SEZ Tech Center', 'EPIP Zone, Whitefield', 'Bangalore', 'Karnataka', 'India', '560066', 'GEO_WFD', 1),
  ('BR_MYS', 'MYS_PLANT', 'Mysore Development & Hardware Center', 'Hebbal Industrial Area', 'Mysore', 'Karnataka', 'India', '570016', 'GEO_MYS', 1),
  ('BR_REM', 'REMOTE_FIELD', 'Field & Client Sites', 'Multi-City Onsite & Client Deployments', 'Bangalore', 'Karnataka', 'India', '560001', 'GEO_REMOTE', 1);

-- Pre-seeded Shifts
INSERT IGNORE INTO `shifts` (`id`, `name`, `code`, `start_time`, `end_time`, `break_start`, `break_end`, `break_mins`, `early_in_mins`, `late_grace_mins`, `early_out_mins`, `min_half_day_hrs`, `min_full_day_hrs`, `is_night_shift`, `color`) VALUES
  ('SHIFT_GEN', 'General Day Shift', 'GEN', '09:00:00', '18:00:00', '13:00:00', '14:00:00', 60, 30, 15, 15, 4.00, 8.00, 0, '#00d4aa'),
  ('SHIFT_MOR', 'Morning Early Shift', 'MOR', '06:00:00', '14:30:00', '10:00:00', '10:30:00', 30, 30, 15, 15, 4.00, 8.00, 0, '#4f8ef7'),
  ('SHIFT_EVE', 'Evening Afternoon Shift', 'EVE', '14:00:00', '22:30:00', '18:00:00', '18:30:00', 30, 30, 15, 15, 4.00, 8.00, 0, '#f59e0b'),
  ('SHIFT_NIT', 'Night Overnight Shift', 'NIT', '22:00:00', '06:30:00', '02:00:00', '02:30:00', 30, 30, 15, 15, 4.00, 8.00, 1, '#a855f7');

-- Pre-seeded Department Shift Mappings
INSERT IGNORE INTO `department_shifts` (`dept_id`, `default_shift_id`, `allowed_shifts`, `auto_apply`, `updated_by`) VALUES
  ('DEP_ENG', 'SHIFT_GEN', '["SHIFT_GEN", "SHIFT_MOR"]', 1, 'system'),
  ('DEP_HR', 'SHIFT_GEN', '["SHIFT_GEN"]', 1, 'system'),
  ('DEP_FIN', 'SHIFT_GEN', '["SHIFT_GEN"]', 1, 'system'),
  ('DEP_OPS', 'SHIFT_MOR', '["SHIFT_MOR", "SHIFT_EVE", "SHIFT_NIT"]', 1, 'system'),
  ('DEP_SALES', 'SHIFT_GEN', '["SHIFT_GEN", "SHIFT_EVE"]', 1, 'system'),
  ('DEP_IT', 'SHIFT_GEN', '["SHIFT_GEN", "SHIFT_NIT"]', 1, 'system');

-- Pre-seeded Public Holidays (Karnataka Gazetted 2026)
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

-- Pre-seeded Employment Types
INSERT IGNORE INTO `employment_types` (`id`, `code`, `title`, `description`, `probation_days`, `notice_period_days`, `pf_esi_eligible`, `active`) VALUES
  ('ET_PERM', 'PERM', 'Permanent / Full-Time', 'Regular permanent employee with standard company benefits', 90, 30, 1, 1),
  ('ET_PROB', 'PROB', 'Probationary Staff', 'New joiner under probation evaluation', 180, 15, 1, 1),
  ('ET_CONT', 'CONT', 'Fixed-Term Contract', 'Contractual staff hired for fixed durations/deliverables', 0, 30, 1, 1),
  ('ET_INTR', 'INTR', 'Intern / Trainee', 'Apprenticeship and university trainee roles', 0, 7, 0, 1),
  ('ET_PTME', 'PTME', 'Part-Time Employee', 'Part-time hourly or flexible shift schedule', 0, 15, 0, 1),
  ('ET_CONS', 'CONS', 'Consultant / Retainer', 'Professional external advisory or retainer engagement', 0, 15, 0, 1);

-- Pre-seeded Employee Groups (Cohorts)
INSERT IGNORE INTO `employee_cohort_groups` (`id`, `code`, `name`, `category`, `description`, `color`, `active`) VALUES
  ('EGRP_EXEC', 'EXEC', 'Executive & Leadership Council', 'GOVERNANCE', 'Core strategic and executive operational team', '#8b5cf6', 1),
  ('EGRP_SAFETY', 'SAFETY', 'Emergency & Workplace Safety Taskforce', 'COMPLIANCE', 'First-aid, fire safety, and emergency response leads', '#ef4444', 1),
  ('EGRP_INNOV', 'INNOV', 'R&D Innovation & AI Lab', 'PROJECT', 'Deep-tech research and product incubation squad', '#00d4aa', 1),
  ('EGRP_OPS', 'OPS_SWAT', '24x7 Tier-2 Rapid Support Team', 'OPERATIONAL', 'Critical response and production incident resolution', '#f59e0b', 1);

-- Pre-seeded Work Codes
INSERT IGNORE INTO `work_codes` (`id`, `code`, `name`, `category`, `description`, `billing_rate_multiplier`, `ot_eligible`, `active`) VALUES
  ('WC_DEV', 'DEV_PROD', 'Core Engineering & Product Sprint', 'BILLABLE_PROJECT', 'Standard software engineering and product feature delivery', 1.00, 1, 1),
  ('WC_CLIENT', 'CLIENT_IMP', 'Client Deployment & Onsite Integration', 'CLIENT_ONSITE', 'Customer site deployment, hardware commissioning & training', 1.25, 1, 1),
  ('WC_OPS', 'OPS_RUN', '24x7 Infrastructure & Production Support', 'INTERNAL_OPS', 'Critical server uptime, SecOps and IT helpdesk response', 1.00, 1, 1),
  ('WC_MAINT', 'FAC_MAINT', 'Biometric Hardware & Facility Maintenance', 'FACILITY_MAINT', 'Face terminal calibration, access gate servicing & repairs', 1.00, 1, 1),
  ('WC_TRAIN', 'LND_SKILLS', 'Learning & Development / Certification', 'TRAINING_LD', 'Internal technical training and domain compliance programs', 1.00, 0, 1);

-- Pre-seeded Leave Types
INSERT IGNORE INTO `leave_types` (`id`, `code`, `name`, `category`, `description`, `paid`, `annual_quota_days`, `carry_forward_max`, `encashable`, `color`, `active`) VALUES
  ('LT_CL', 'CL', 'Casual Leave (CL)', 'CASUAL', 'Short-notice personal leave for urgent private affairs', 1, 12.0, 0.0, 0, '#4f8ef7', 1),
  ('LT_SL', 'SL', 'Sick / Medical Leave (SL)', 'SICK', 'Medical illness or health recovery leave', 1, 12.0, 6.0, 0, '#ef4444', 1),
  ('LT_EL', 'EL', 'Earned / Privilege Leave (EL)', 'EARNED', 'Annual accrued vacation and privilege leave', 1, 18.0, 30.0, 1, '#10b981', 1),
  ('LT_ML', 'ML', 'Maternity Leave (Statutory)', 'MATERNITY', 'Statutory 26-week paid maternity benefit under Indian Maternity Act', 1, 182.0, 0.0, 0, '#ec4899', 1),
  ('LT_PL', 'PL', 'Paternity Leave', 'PATERNITY', 'Parental support leave for male employees on child birth', 1, 15.0, 0.0, 0, '#8b5cf6', 1),
  ('LT_CO', 'COMP_OFF', 'Compensatory Off (Comp-Off)', 'COMP_OFF', 'Credit granted for approved overtime or weekend shifts worked', 1, 0.0, 10.0, 0, '#f59e0b', 1),
  ('LT_LWP', 'LWP', 'Leave Without Pay / Loss of Pay', 'UNPAID', 'Authorized absence when all paid leave balances are exhausted', 0, 0.0, 0.0, 0, '#64748b', 1);

-- Pre-seeded Shift Groups
INSERT IGNORE INTO `shift_groups` (`id`, `name`, `code`, `rotation_type`, `description`, `color`, `shifts_sequence`, `active`) VALUES
  ('SGRP_24X7', '24x7 Continuous Operations Rotation', 'ROT_24X7', 'WEEKLY', 'Three-shift rotational roster for support and operations engineers', '#4f8ef7', '["SHIFT_MOR", "SHIFT_EVE", "SHIFT_NIT"]', 1),
  ('SGRP_GEN', 'Corporate General Working Group', 'CORP_GEN', 'FIXED', 'Standard Monday to Friday corporate schedule', '#00d4aa', '["SHIFT_GEN"]', 1);

-- Default Administrator: admin / admin123 (SHA-256 username hash, Bcrypt password hash)
INSERT IGNORE INTO `users` (`username`, `username_hash`, `username_display`, `password_hash`, `role`, `active`)
VALUES (
  'admin',
  '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
  'admin',
  '$2a$12$onT9g75hBg6X6.OH1NU1uu/J17IZGVZl1p96TNG3TeCp.ZeKtZZKy',
  'ADMIN',
  1
);

-- Default User: user / user123 (SHA-256 username hash, Bcrypt password hash)
INSERT IGNORE INTO `users` (`username`, `username_hash`, `username_display`, `password_hash`, `role`, `active`)
VALUES (
  'user',
  '04f8996da763b7a969b1028ee3007569eaf3a635486ddab211d512c85b9df8fb',
  'user',
  '$2a$12$SAFTdl1/QIJnUigAAQ0kzuzEYGb3SxMtqgpNh7i9LrkZEX6F8k47.',
  'USER',
  1
);

-- Pre-seeded Divisions
INSERT IGNORE INTO `divisions` (`id`, `code`, `name`, `company_id`, `budget_code`, `active`) VALUES
  ('DIV_TECH', 'TECH_DEV', 'Technology, Product Engineering & AI', 'COMP_KRIDE', 'BU_TECH_2026', 1),
  ('DIV_OPS', 'RAIL_OPS', 'Rail Infrastructure & Signal Operations', 'COMP_KRIDE', 'BU_OPS_2026', 1),
  ('DIV_FIN', 'CORP_FIN', 'Corporate Finance & Procurement', 'COMP_SOUKHYA', 'BU_FIN_2026', 1),
  ('DIV_HR', 'PEOPLE_HR', 'Human Resources & Talent Management', 'COMP_SOUKHYA', 'BU_HR_2026', 1);

-- Pre-seeded Cost Centers
INSERT IGNORE INTO `cost_centers` (`id`, `code`, `name`, `company_id`, `dept_id`, `gl_account`, `annual_budget`, `currency`, `active`) VALUES
  ('CC_ENG_101', 'ENG_CORE', 'Core Software Engineering Cost Center', 'COMP_KRIDE', 'DEP_ENG', 'GL-70102', 15000000.00, 'INR', 1),
  ('CC_RAIL_502', 'RAIL_COMM', 'Rail Commissioning & Field Works', 'COMP_KRIDE', 'DEP_OPS', 'GL-80204', 35000000.00, 'INR', 1),
  ('CC_CORP_901', 'CORP_EXEC', 'Corporate Executive & Administration', 'COMP_SOUKHYA', 'DEP_HR', 'GL-90101', 8000000.00, 'INR', 1),
  ('CC_IT_301', 'IT_CLOUD', 'Enterprise Cloud & Data Infrastructure', 'COMP_SOUKHYA', 'DEP_IT', 'GL-60302', 12000000.00, 'INR', 1);

-- Pre-seeded Biometric Devices
INSERT IGNORE INTO `biometric_devices` (`id`, `serial_number`, `device_name`, `device_ip`, `device_port`, `device_model`, `protocol`, `branch_id`, `direction`, `status`, `template_count`, `buffer_lag_ms`, `active`) VALUES
  ('DEV_BLR_01', 'ESSL-BLR-001', 'HQ Main Entrance Turnstile #1', '192.168.1.15', 4370, 'eSSL SilkBio-101TC', 'ESSL', 'BR_HQ', 'IN', 'ONLINE', 5100, 12, 1),
  ('DEV_BLR_02', 'ESSL-BLR-002', 'HQ West Exit Turnstile #2', '192.168.1.16', 4370, 'eSSL SilkBio-101TC', 'ESSL', 'BR_HQ', 'OUT', 'ONLINE', 5100, 15, 1),
  ('DEV_WFD_01', 'HIK-WFD-001', 'Whitefield SEZ Face Pod Gate', '192.168.10.22', 8000, 'Hikvision DS-K1T671MF', 'HIKVISION', 'BR_WFD', 'BOTH', 'ONLINE', 1200, 24, 1),
  ('DEV_MYS_01', 'ESSL-MYS-001', 'Mysore Plant Security Gate', '192.168.20.10', 4370, 'eSSL uFace 800 Plus', 'ESSL', 'BR_MYS', 'BOTH', 'OFFLINE', 450, 0, 1);

SET FOREIGN_KEY_CHECKS = 1;
