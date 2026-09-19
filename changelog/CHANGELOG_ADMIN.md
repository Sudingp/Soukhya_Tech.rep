# Administrator & Technical Changelog — Soukhya Tech HR Enterprise

This changelog contains comprehensive, full-stack (Backend + Database + Infrastructure + Frontend Governance) documentation of all changes, architectural improvements, and security enhancements introduced across branches.

---

## Branch: `HR-Enterprise-Dev-V4` / `HR-Enterprise-Prod` (Current Active Version — v4.0.0)

### 1. Senior DBA Performance Optimizations & Benchmark Suite
- **Automated Benchmark Suite (`scripts/db_benchmark.js`)**:
  - Implemented a 15-query automated benchmarking engine testing Simple (S1–S5), Medium (M1–M5), and Complex (C1–C5) performance tiers under high concurrency on 10,100 employees, 156,000+ attendance records, and 284,000+ roster slots.
  - Generates Min, Max, Avg, P50, P95, and P99 latency distributions and queries per second (QPS).
- **Covering Composite Indexes & Generated Columns**:
  - `attendance`: Stored generated column `punch_date DATE GENERATED ALWAYS AS (CAST(timestamp AS DATE)) STORED` with covering index `idx_att_pdate_dept_stat_cov (punch_date, dept, status, emp_id)` (4x query latency reduction from 284 ms to 70 ms).
  - `shift_roster`: Covering composite index `idx_roster_date_shift_emp_cov (roster_date, shift_id, emp_id)` (11.3x speedup from 622 ms to 54.8 ms).
  - `employees`: Covering composite indexes `idx_emp_comp_dept_stat_cov (company_id, dept, status, emp_id)` and `idx_emp_div_cc_stat_cov (division_id, cost_center_id, status, emp_id)`.
  - `ot_records`: Covering index `idx_ot_emp_stat_hrs_cov (emp_id, status, ot_hours)`.
  - `employee_leave_balances`: Covering index `idx_elb_emp_yr_avail_cov (emp_id, financial_year, available_balance)`.

### 2. High Court of Karnataka 2026 Official Calendar & Leave Workflow
- **Gazette Ingestion**: Ingested 41 official holidays (20 Mandatory Gazetted + 21 Restricted / RH) with automated shift calendar synchronization and non-working day overrides.
- **Statutory Leave Type**: Added `LT_RH` (*Restricted Holiday*) leave type with an annual quota of 2.0 days.
- **Interactive Leave Application Workflow**:
  - Dynamic `#la-holiday-id` dropdown in Leave Application modal grouped by Gazetted and Restricted holidays.
  - Automated selection handlers auto-filling leave date range, setting quota to 1.0 day, and tagging category badges.

### 3. Master Configuration & 3NF Relational Mapping
- **Normalized Schema**: 32 relational tables with foreign keys and cascade rules across Companies, Divisions, Cost Centers, Designations, Branches, Geofences, Shifts, Shift Groups, Shift Calendar, Shift Roster, Employment Types, Employee Groups, Work Codes, Biometric Devices, Employee Transfers, Fast Punch Buffer.
- **Dataset Scale**: 10,100 active employee records with 128-d AI face embeddings mapped across all enterprise entities.

### 4. Code Quality & Modularity Enforcement
- **Line Limit Rule**: 100% of all JavaScript, CSS, and DAO files are strictly $\le 500$ lines.
- **Integration Test Suite**: 38/38 automated integration tests passing 100% (`node test_integration.js`).

---

## Branch: `HR-Enterprise-Dev-V2` (v2.0.0)

### 1. Enterprise Database Migration: MySQL 8.4 LTS
- **Engine & Charset**: Upgraded the core persistence layer to **MySQL 8.4 LTS / 8.0 LTS** using `InnoDB` for strict ACID transaction compliance, row-level locking, and crash resilience. Default collation set to `utf8mb4_0900_ai_ci`.
- **Biometric JSON Storage**: Facial embedding descriptors (128-dimensional float arrays) are stored in native `JSON` columns with companion SHA-256 integrity hashes (`descriptor_hash`).
- **Relational Integrity**: Added foreign key constraints (`fk_attendance_employee`) with `ON DELETE CASCADE ON UPDATE CASCADE`.
- **High-Speed Composite Indexes**:
  - `idx_att_emp_ts` (`emp_id`, `timestamp`): Instant retrieval of individual employee scan history.
  - `idx_att_ts_status` (`timestamp`, `status`): Fast range queries for daily/monthly attendance aggregation.
  - `idx_emp_dept_status` (`department`, `status`): Rapid department-level filtering.
  - `idx_emp_company` (`company`), `idx_emp_card_number` (`card_number`), `idx_emp_email` (`email`).
  - `idx_audit_perf_at` (`performed_at`), `idx_blacklist_expires` (`expires_at`).
- **High-Throughput Connection Pool (`database/mysql_adapter.js`)**:
  - Built with `mysql2/promise` supporting connection pooling (`connectionLimit: 20`), keepalives, and automatic UNIX domain socket (`./data/mysql/mysql.sock`) or TCP host/port (`127.0.0.1:3306`) auto-discovery.
  - Automatic idempotent schema bootstrapping on initialization (`initSchema()`).
- **Pure MySQL 8.4 LTS Persistence & Total SQLite Elimination**:
  - Completely removed all SQLite files (`attendance.db`, `migrate_sqlite_to_mysql.js`), `better-sqlite3` dependencies, and SQLite fallback logic.
  - Exclusively powered by enterprise MySQL 8.4 LTS with high-performance connection pooling (`connectionLimit: 20`), keepalives, and automatic UNIX domain socket (`./data/mysql/mysql.sock`) or TCP host/port (`127.0.0.1:3306`) discovery.
  - Automatic idempotent schema bootstrapping on initialization (`initSchema()`).
- **Single-Command Launch (`npm start`)**:
  - Enhanced `npm start` to execute `scripts/setup_mysql.sh` before booting `node server.js`, automatically starting the local MySQL daemon and verifying permissions.

### 2. Zero Plaintext Credential Authentication & Role Architecture
- **Hashed Usernames**: Usernames are indexed and stored as SHA-256 hashes (`username_hash`). Eliminates raw username leaks in query logs and database dumps.
- **Hashed Passwords**: Salted and hashed using Bcrypt with a cost factor of 12.
- **Role Constraint Expansion**: Expanded database role constraints to support `ADMIN`, `HR`, `EMPLOYEE`, `USER`, and `DEVICE`.
- **Pre-seeded Cryptographic Accounts**:
  - `admin`: SHA-256 hash verified, assigned `ADMIN` role.
  - `user`: SHA-256 hash verified, assigned `USER` role.
- **Dynamic Application Mode Switching**:
  - Real-time switching between `[🛡️ ADMIN MODE]` and `[👤 USER MODE]`.
  - Admin Mode: Full access to all menus, registration, masters, devices, payroll, canteen, user management, audit logs, and settings.
  - User Mode: Restricted self-service view focused purely on Face Attendance Punch-In and personal history.
- **Strictly Admin-Governed Password Recovery (No Self-Service Forgot Password)**:
  - Eliminated self-service password recovery to protect against social-engineering attacks and unauthorized takeovers.
  - System Administrators manage credentials directly via the Admin User Management console (`/api/admin/users`).
- **Token Blacklisting & Security Audit Trail**:
  - Immediate JWT revocation on `POST /api/auth/logout` via in-memory and database blacklist (`token_blacklist`).
  - Immutable audit logs for every account creation, role change, password reset, and punch.

### 3. Data Structures & Algorithms (DSA) Performance Optimizations
- **Custom Doubly-Linked-List LRU Cache (`lib/dsa_cache.js`)**:
  - \(O(1)\) get and put operations with configurable capacity and Time-To-Live (TTL).
  - Used for Employee Records (`CACHE_TTL_EMPLOYEE=300s`) and Attendance Analytics (`CACHE_TTL_STATS=60s`).
- **Prefix Search Trie (`PrefixTrie`)**:
  - \(O(K)\) prefix-based search for rapid autocomplete across hundreds of employee names and departments.
- **Real-Time Server-Sent Events (SSE) Sync (`/api/sync/events`)**:
  - Long-lived HTTP stream pushing atomic database modification events to connected clients.
  - Automates UI cache invalidation and UI re-fetching whenever database records mutate.

### 4. Cross-Platform Management Infrastructure
- Replaced legacy platform-specific scripts with pure standard-library Python 3 runners:
  - `start_all.py`: Unified process launcher with automatic port conflict detection and backend building.
  - `stop_all.py`: Safe process termination and port scavenger utility.
  - `test_all.py`: Standard library cross-platform API test runner.
  - `test_integration.js`: Comprehensive 11-step end-to-end integration test runner (`npm run test:integration`).

### 5. Viewport & Responsive UI Architecture
- Removed fixed height and width constraints across dashboard cards, employee tables, and company lists.
- Unified CSS rules to ensure all views occupy 100% viewport width and height (`100vw`, `100vh`) with responsive CSS grid and flex layouts.

---

## Branch: `HR-Enterprise-Dev-V1` & `HR-Enterprise-Prod` (v1.0.0 Baseline)

### 1. Initial Architecture & Polyglot Backends
- **C# .NET 8 Web API**: Initial backend implementation using NHibernate ORM with SQLite support.
- **Port to Java Spring Boot 3**: Ported the C# service to Java 17 + Spring Boot 3 with Spring Data JPA, Hibernate, and Spring Security.
- **Node.js Express Server**: Lightweight API server with Helmet security headers and rate limiting.
- **Client-Side Biometric Engine**: Integrated `face-api.js` (SSD MobileNet V1 & Tiny Face Detector) running in-browser with 128-dimensional face embedding extraction.
- **SQLite Database**: Initial SQLite schema (migrations v1 through v5) with AES-256-GCM encrypted PII fields (Aadhaar, PAN, phone, email).
- **ESSL-Style UI**: Initial dashboard layout, company listing, employee master drawer, and manual attendance registration.
