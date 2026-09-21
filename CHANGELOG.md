# Changelog — Soukhya Tech HR Enterprise

All notable changes across architecture, database, API layer, frontend modules, governance, and user self-service are documented in this file.

---

## [4.1.0] - 2026-09-21 (Branch: `HR-Enterprise-Prod`)

### 🛡️ Administrator & Technical Perspective
- **Role-Based Access Control (RBAC) Segregation & Privilege Hardening**:
  - Full interface and API segregation between Administrative Governance and Employee Self-Service (ESS).
  - High-privilege administrative actions (Punch Regularization, Weekly-Off Pattern Application, Karnataka Gazette Import, Shift Synchronization, Leave/OD Status Approvals) protected by `.admin-action` CSS classes and backend `requireRoles('ADMIN', 'HR')` middleware.
  - Server-side data scoping: `GET /api/attendance-log`, `GET /api/leave-entries`, and `GET /api/outdoor-entries` strictly scope results to `req.user.emp_id` when called by `USER` role tokens.
- **Live Machine Geolocation Engine & OpenStreetMap Leaflet Mapping**:
  - Integrated OpenStreetMap with Leaflet.js for interactive mapping and coordinate capture during employee registration.
  - Captures browser hardware coordinates (latitude, longitude, accuracy) via W3C Geolocation API with reverse geocoding via OpenStreetMap Nominatim.
  - Persists geolocation data in MySQL 8.4 schema (`employees.latitude`, `employees.longitude`, `employees.registered_location`) and verifies coordinates against active polygon and circular geofence boundaries.
- **Organization Masters Restoration & 3NF Data Pipelines**:
  - Restored complete relational data rendering across Companies, Branches, Divisions, Cost Centers, Designations, Departments, Department Shifts, Geofences, and Work Codes.
  - Added global `window.state` resolver proxying to `EMP`, `ATT`, and `COMPANIES` arrays.
  - Normalized API response payloads with `.data` aliasing in `apiFetch` (`public/js/core/changelog.js`).
  - Added direct modal launchers for all 10 organization master entities in the `#sub-org` drawer menu.
- **Senior DBA Performance Optimizations & Covering Indexes**:
  - Executed automated 15-tier benchmark suite (`scripts/db_benchmark.js`) testing Simple (S1–S5), Medium (M1–M5), and Complex (C1–C5) performance tiers under high concurrency on 10,100 employees, 156,000+ attendance records, and 284,000+ roster slots.
  - Sub-millisecond latency for Simple/Medium queries (0.16 ms – 0.79 ms) with throughput up to 23,000+ QPS.
  - Roster Matrix scan optimized from 622 ms to 54.8 ms (11.3x speedup); 30-day attendance rollup reduced from 284 ms to 70.0 ms (4x speedup).
  - Stored generated column `punch_date` on `attendance` table with covering index `idx_att_pdate_dept_stat_cov`.
- **Edge Biometric Ingestion & Device Management**:
  - Ultra-high-throughput fast punch ingestion buffer capable of 20,000 TPS with sub-5ms OLTP response times.
  - Hardware terminal TCP ping latency monitor and synchronized biometric template distributor across 10,100 employee profiles.
- **Cross-Platform Startup & Execution**:
  - Standardized cross-platform Python 3 runners (`start_all.py`, `stop_all.py`, `test_all.py`) alongside native Windows batch scripts (`start-all.bat`, `stop-all.bat`, `test-all.bat`).
- **Code Quality & Verification**:
  - 100% compliance with strict file modularity rule: all `.js` and `.css` files remain $\le 500$ lines.
  - 38/38 end-to-end integration tests passing 100% (`node test_integration.js` & `python3 test_all.py`).

### 👤 Employee & User Self-Service (ESS) Perspective
- **Dedicated Employee Self-Service (ESS) Portal**:
  - Streamlined, distraction-free interface when in User Mode with complex administrative drawers, company configs, and device consoles hidden.
  - Added top navigation quick-access bar:
    - `📅 My Schedule`: View monthly assigned shifts, working hours, and scheduled rest days.
    - `📝 Leave & Balances`: Check real-time quota ledgers (Casual, Sick, Earned, Maternity, Restricted Holiday), submit leave requests, and track approval status.
    - `🚶 Outdoor Duty (OD)`: Submit off-site client and field duty requisitions with automatic attendance credit synchronization.
    - `🕒 Attendance History`: View personal punch-in/out records, timestamps, and verification status.
    - `🏖️ Holidays 2026`: View the full Karnataka 2026 gazetted and restricted holiday calendar.
- **Live GPS Machine Location & Visual Mapping**:
  - Automatic geolocation detection and interactive OpenStreetMap pin placement during registration and check-in.
  - Real-time address resolution and geofence boundary verification.
- **Smart Karnataka Holiday Leave Application**:
  - Ingested 53 official holidays from the Karnataka Gazette & High Court 2026 calendar (32 Mandatory Gazetted + 21 Restricted / Optional Holidays).
  - One-click holiday leave application via `#la-holiday-id` dropdown with automated date population, 1.0 day quota deduction, and leave type pre-selection (`LT_RH` / `LT_CL`).
- **Personal Data Privacy**:
  - Non-admin staff can only query and view their own personal records, protecting employee attendance and leave confidentiality across all screens.
- **Sub-Second Face Attendance**:
  - Instant face alignment and punch recording with neural 128-d AI embeddings and duplicate punch cooldown protection.

---

## [4.0.0] - 2026-09-20 (Branch: `HR-Enterprise-Dev-V4` / `HR-Enterprise-Prod`)

### 🚀 Highlights & Enterprise Milestones
- **High Court of Karnataka 2026 Official Calendar Ingestion**:
  - Full ingestion of 41 official Karnataka holidays (20 Mandatory Gazetted + 21 Restricted / RH).
  - Shift Calendar integration: Automated statutory holiday mapping and weekly-off rotation overrides.
  - Interactive Holiday Leave Workflow: Dynamic holiday selection dropdown in Leave Entry modal (`#la-holiday-id`), automated leave date pre-filling, 1.0 day quota allocation, and category badges (`LT_RH` Restricted Holiday vs. `LT_CL` Casual Leave).
- **Senior DBA Database Benchmark Suite (`scripts/db_benchmark.js`)**:
  - 15 high-concurrency queries categorized into Simple (S1–S5), Medium (M1–M5), and Complex (C1–C5) performance tiers.
  - Sub-millisecond latency for Simple/Medium queries (0.16 ms – 0.79 ms) with throughput up to 23,000+ QPS.
  - Post-optimization performance gains:
    - Shift Roster Matrix Scan (284K+ rows): **622 ms → 54.8 ms** (11.3x speedup).
    - 30-Day Attendance Analytics (156K+ rows): **284 ms → 70.0 ms** (4x speedup).
    - Employee 360° Profile Rollup: **4.8 ms → 0.39 ms** (12x speedup).
- **Senior DBA Covering Indexes & Generated Column Optimizations**:
  - `attendance`: Stored generated column `punch_date DATE GENERATED ALWAYS AS (CAST(timestamp AS DATE)) STORED` with covering index `idx_att_pdate_dept_stat_cov (punch_date, dept, status, emp_id)`.
  - `shift_roster`: Covering composite index `idx_roster_date_shift_emp_cov (roster_date, shift_id, emp_id)`.
  - `employees`: Covering composite indexes `idx_emp_comp_dept_stat_cov` and `idx_emp_div_cc_stat_cov`.
  - `ot_records`: Covering index `idx_ot_emp_stat_hrs_cov (emp_id, status, ot_hours)`.
  - `employee_leave_balances`: Covering index `idx_elb_emp_yr_avail_cov (emp_id, financial_year, available_balance)`.
- **Master Configuration & 3NF Schema Normalization**:
  - 32 relational tables with foreign keys and cascade rules: `companies`, `divisions`, `cost_centers`, `departments`, `designations`, `branches`, `geofences`, `shifts`, `department_shifts`, `shift_calendar_days`, `shift_groups`, `shift_roster`, `employment_types`, `employee_cohort_groups`, `work_codes`, `biometric_devices`, `employee_transfers`, `fast_punch_buffer`.
  - Realistic multi-tenant dataset: 10,100 active employees with 128-d AI face embeddings and 3NF mapping.
- **Architectural Modularity & 100% Integration Test Pass**:
  - Strict compliance: 100% of all JavaScript and CSS files are $\le 500$ lines of code.
  - End-to-end integration test suite: 38/38 automated tests passing (100%).

---

## [3.1.0] - 2026-09-18 (Branch: `HR-Enterprise-Dev-V3.1`)

### ✨ Features & Refactoring
- Relocated Leave Types, Leave Entries, and Outdoor Entries into the unified Organization configuration drawer.
- Implemented Attendance Log, Geofences, Work Codes, and Overtime Register modules.
- Added live coordinate validation for circular and polygon GPS geofence zones.
- Restructured Employee Management into Employees, Employment Types, and Employee Groups with full MySQL persistence.

---

## [2.0.0] - 2026-09-15 (Branch: `HR-Enterprise-Dev-V2`)

### 🗄️ Database & Security Architecture
- Full migration to MySQL 8.4 LTS InnoDB storage engine with `utf8mb4_0900_ai_ci` collation.
- Eliminated SQLite runtime dependencies and fallback logic.
- Zero-plaintext authentication: SHA-256 username hashing, Bcrypt (cost 12) salted passwords, and JWT token revocation blacklist.
- Role-based access control supporting `ADMIN`, `HR`, `EMPLOYEE`, `USER`, and `DEVICE`.
- Custom \(O(1)\) doubly-linked-list LRU Cache and Prefix Search Trie.
- Real-time Server-Sent Events (SSE) data synchronization (`/api/sync/events`).

---

## [1.0.0] - 2026-09-08 (Branch: `HR-Enterprise-Prod`)

### 📦 Initial Baseline
- In-browser facial recognition using `face-api.js` (SSD MobileNet V1 & Tiny Face Detector).
- Polyglot backend implementations (Node.js Express, Java Spring Boot 3, C# .NET 8).
- Basic employee master, shift creation, and attendance punch-in UI.
