# Soukhya Tech — Enterprise Face Recognition & Workforce Attendance System

[![Branch](https://img.shields.io/badge/Branch-HR--Enterprise--Prod-blue.svg)](https://github.com/Sudingp/Soukhya_Tech.rep)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Java](https://img.shields.io/badge/Java-17%2B-orange.svg)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.3-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![Python](https://img.shields.io/badge/Python-3.8%2B-blue.svg)](https://www.python.org/)
[![Database](https://img.shields.io/badge/Database-MySQL%208.4%20LTS-blue.svg)](https://www.mysql.com/)
[![Tests](https://img.shields.io/badge/Tests-38%2F38%20Passed%20(100%25)-success.svg)](test_integration.js)

An enterprise-grade, high-concurrency workforce management and neural face recognition attendance platform. Engineered with a pure **MySQL 8.4 LTS InnoDB** clustered schema (33 tables, 391 columns, 32 foreign keys), dual polyglot backends (**Node.js Express** and **Java Spring Boot 3**), client-side biometric facial recognition via `face-api.js`, live machine geolocation mapping with OpenStreetMap Leaflet, dual-tier edge ingestion buffer (20,000+ TPS), comprehensive 3NF organization masters, 24/7 cyclical shift scheduling, statutory leave/overtime workflows, role-based access control (RBAC) mode segregation, and cross-platform native management scripts for Windows and Linux.

---

## 📑 Table of Contents

- [🌟 Architectural Highlights](#-architectural-highlights)
- [📝 Release Changelogs](#-release-changelogs)
- [🗄️ Enterprise Database (ER & EER Architecture)](#️-enterprise-database-er--eer-architecture)
- [👥 Admin vs User Mode Segregation (RBAC)](#-admin-vs-user-mode-segregation-rbac)
- [📁 Project Structure](#-project-structure)
- [⚙️ Prerequisites](#️-prerequisites)
- [🚀 Quick Start & Cross-Platform Runners](#-quick-start--cross-platform-runners)
  - [1. Single-Command Launch](#1-single-command-launch)
  - [2. Windows Batch Launchers](#2-windows-batch-launchers)
  - [3. Multi-Backend Python Launcher](#3-multi-backend-python-launcher)
  - [4. Automated Test Suites (38/38 Tests)](#4-automated-test-suites-3838-tests)
  - [5. Graceful Process Teardown](#5-graceful-process-teardown)
- [🔌 REST API Reference](#-rest-api-reference)
- [🔒 Security & Cryptographic Invariants](#-security--cryptographic-invariants)
- [⚙️ Environment Configuration](#️-environment-configuration)

---

## 🌟 Architectural Highlights

- **Pure MySQL 8.4 LTS InnoDB Clustered Engine**:
  - Full elimination of SQLite in favor of an ACID-compliant enterprise database with connection pooling, prepared statements, and foreign key referential integrity across 33 relational tables and 391 columns.
  - Sub-5ms query SLAs on 10,000+ seeded employee records utilizing B-Tree composite covering indexes.
- **Dual Polyglot Backends**:
  - **Node.js Express (Port 3000)**: Modular REST routing (`routes/*.js`), Helmet security, Joi schema validation, rate-limiting, and in-memory LRU caching.
  - **Java Spring Boot 3 (Port 3001)**: Enterprise microservice with Spring Security filter chains, JPA/Hibernate repositories, and Actuator telemetry.
- **Live Geolocation & OpenStreetMap (Leaflet.js)**:
  - Captures live machine latitude/longitude coordinates upon employee enrollment and attendance punches.
  - Interactive Leaflet map visualization with Haversine formula distance checks against configurable circular and polygon geofences (`/api/geofences`).
- **High-Throughput Biometric Ingestion Pipeline**:
  - Dual-tier edge buffering (`fast_punch_buffer` L1 write buffer) absorbing 20,000+ TPS burst traffic, with lock-free asynchronous draining into daily normalized attendance ledgers (`attendance` L2).
- **Advanced Shift & Roster Management**:
  - Configurable diurnal shifts, rotational shift groups (3-shift 24/7 cycles), monthly roster matrix generation (284,250 slots in < 1.2s), department shift policies, and Karnataka State 2026 Gazetted Public Holiday synchronization (53 holidays).
- **Workflow & Overtime Automation**:
  - Statutory leave policies (CL, SL, EL/PL, Maternity), fiscal quota balance ledgers, multi-level approval hierarchies, Outdoor Duty (OD) field requisitions, and automated overtime multipliers (1.5x / 2.0x).
- **100% Cross-Platform Native Parity**:
  - Tested and verified identically on **Linux (Ubuntu/Debian)** and **Windows (10/11 CMD/PowerShell)** with dedicated `.bat` scripts and pure standard-library Python 3 runners.
- **🌓 Enterprise Dual Theme Engine (Light Mode Default & Dark Mode)**:
  - Universal dual theme support across all tabs, modals, tables, forms, cards, and drawers.
  - Light Mode enabled by default on cold boots; user preferences persisted seamlessly in `localStorage`.
  - Independent interactive theme toggles located on both the Authentication Login Portal and the Application Header UI.
  - Real-time dynamic Chart.js color updates, WCAG AA compliance, and zero-FOUC early DOM initialization.

---


## 📝 Release Changelogs

Complete architectural evolutions and change histories are maintained in the [`changelog/`](./changelog/) directory and in-app modal:

- 🛡️ [**Administrator & Technical Changelog (`changelog/CHANGELOG_ADMIN.md`)**](./changelog/CHANGELOG_ADMIN.md): Complete backend changes, MySQL 8.4 DDL, 15-tier DBA benchmarks, edge buffer, and security middleware.
- 👤 [**User Release Notes (`changelog/CHANGELOG_USER.md`)**](./changelog/CHANGELOG_USER.md): Employee Self-Service (ESS) guide, live geolocation, holiday calendar, and personal data privacy.
- 📋 [**Changelog Index & Roadmap (`changelog/README.md`)**](./changelog/README.md): Version roadmap tracking through v4.1.0 Enterprise.
- 🤝 [**Collaborator & Setup Guide (`SETUP_COLLABORATOR.md`)**](./SETUP_COLLABORATOR.md): Comprehensive developer onboarding, cross-platform scripts, and troubleshooting.

---

## 🗄️ Enterprise Database (ER & EER Architecture)

The database architecture is documented in [`database/docs/ER_EER_ARCHITECTURE_GUIDE.md`](./database/docs/ER_EER_ARCHITECTURE_GUIDE.md) and accompanied by an executive Excel workbook:

📊 **Executive Specification Workbook**: [`Soukhya_Tech_Enterprise_ER_EER_Architecture.xlsx`](./Soukhya_Tech_Enterprise_ER_EER_Architecture.xlsx) (also mirrored in [`database/docs/`](./database/docs/))

```
Workbook Sheets & High-Resolution Vector/Raster Diagrams:
 ├── Sheet 1: Executive Overview       → Embedded: architecture_domain_map.png
 ├── Sheet 2: EER Class Hierarchies    → Embedded: eer_hierarchy_diagram.png
 ├── Sheet 3: Data Dictionary (33 Tbl) → All 391 Columns with Types, Keys & Invariants
 ├── Sheet 4: Relationships & FKs (32) → Embedded: er_relational_diagram.png
 ├── Sheet 5: DBA Performance & Index  → Embedded: dba_performance_chart.png
 └── Sheet 6: RBAC & Security Matrix   → 33 Tables × 5 Roles Privilege Grid
```

### Core Enterprise Domains (6 Domains)
1. **Organization Hierarchy**: `companies`, `divisions`, `branches`, `departments`, `cost_centers`, `designations`, `employment_types`, `work_codes`, `master_settings`.
2. **Workforce & Identity**: `employees` (50+ profile attributes), `users`, `employee_transfers`, `employee_cohort_groups`, `employee_cohort_members`.
3. **Scheduling & Roster**: `shifts`, `shift_groups`, `shift_group_members`, `shift_roster`, `shift_calendar_days`, `department_shifts`, `public_holidays`.
4. **Biometric Edge & Ingest**: `biometric_devices`, `fast_punch_buffer`, `attendance`, `geofences`.
5. **Workflows, Leaves & OT**: `leave_types`, `employee_leave_balances`, `employee_leave_entries`, `employee_outdoor_entries`, `ot_records`.
6. **Governance, Security & Audit**: `audit_log`, `token_blacklist`, `_schema_version`.

### The 8 Enterprise EER Hierarchies
- **EER-01 (Actor Specialization)**: `SYSTEM_ACTOR` ──(d, p)──> `users` vs `employees`
- **EER-02 (Org Tree Containment)**: `ORG_NODE` ──(d, =)──> `companies` → `divisions` → `branches` → `departments`
- **EER-03 (Attendance Exceptions)**: `TIME_OFF_EXCEPTION` ──(d, =)──> `leave_entries` vs `outdoor_entries` vs `ot_records`
- **EER-04 (Punch Processing Pipeline)**: `PUNCH_EVENT_STAGE` ──(d, =)──> `fast_punch_buffer` (L1) → `attendance` (L2)
- **EER-05 (Schedule Patterning)**: `CALENDAR_RULE` ──(d, =)──> `shifts` vs `shift_groups` vs `shift_roster` vs `public_holidays`
- **EER-06 (Spatial Presence)**: `SPATIAL_NODE` ──(d, p)──> `branches` (Physical) vs `geofences` (GPS Polygon)
- **EER-07 (Telemetry & Provenance)**: `TELEMETRY_RECORD` ──(d, =)──> `audit_log`, `token_blacklist`, `biometric_devices`
- **EER-08 (Workforce Aggregation)**: `WORKFORCE_UNIT` ──(o, =)──> `employees` (Unit) vs `cohort_groups` (Set)

---

## 👥 Admin vs User Mode Segregation (RBAC)

The UI dynamically adapts depending on caller authentication claims (`req.user.role`):

| Feature Area | 🛡️ Admin / HR Mode | 👤 Employee Self-Service (ESS) Mode |
| :--- | :--- | :--- |
| **Top Navigation Bar** | Full Governance (Dashboard, Masters, Shifts, Devices, Audit) | ESS Quick Action Bar (`📅 My Schedule`, `📝 Leave`, `🚶 OD`, `🕒 History`, `🏖️ Holidays`) |
| **Attendance & Punches** | View & regularize enterprise punches; device sync | GPS Live Web Punch with Map preview; view personal punch history |
| **Leave & Absences** | Approve / reject leave requests; adjust quotas | Submit leave applications; view real-time available balance ledger |
| **Outdoor Duty (OD)** | Verify and approve client-site visits; attendance credit | Submit OD requisitions with purpose, client location, and transit mode |
| **Organization Masters** | Manage companies, branches, departments, cost centers | Hidden |
| **Device Terminals** | Register hardware, IP whitelist, ping diagnostics, template sync | Hidden |
| **Audit & Security** | View immutable mutation logs, IP addresses, JSON diffs | Hidden |

---

## 📁 Project Structure

```
soukhya-tech/
├── Soukhya_Tech_Enterprise_ER_EER_Architecture.xlsx  ← Multi-sheet executive DB specification
├── start-all.bat                ← Windows one-click startup & port cleaner
├── stop-all.bat                 ← Windows one-click graceful shutdown
├── test-all.bat                 ← Windows one-click test runner
├── start_all.py                 ← Linux/macOS cross-platform launcher
├── stop_all.py                  ← Linux/macOS cross-platform process terminator
├── test_all.py                  ← Multi-backend test runner
├── test_integration.js          ← 38-step integration test suite (Node.js)
├── server.js                    ← Enterprise Node.js Express server
├── package.json                 ← Node.js dependencies & lifecycle scripts
├── .env                         ← Runtime configuration & cryptographic secrets
├── database/
│   ├── db.js                    ← Query layer & statement routing
│   ├── mysql_adapter.js         ← MySQL 8.4 LTS connection pool (UNIX socket & TCP)
│   ├── schema_mysql.sql         ← 3NF DDL schema with foreign keys & indexes
│   └── docs/
│       ├── ER_EER_ARCHITECTURE_GUIDE.md  ← Full ER/EER theoretical reference manual
│       ├── Soukhya_Tech_Enterprise_ER_EER_Architecture.xlsx
│       └── diagrams/            ← High-resolution 300 DPI architecture diagrams
│           ├── architecture_domain_map.png
│           ├── eer_hierarchy_diagram.png
│           ├── er_relational_diagram.png
│           └── dba_performance_chart.png
├── routes/                      ← Modular Express endpoints (≤ 500 lines each)
│   ├── attendance_routes.js     ← Punch logs, fast buffer drain, regularization
│   ├── auth_routes.js           ← JWT login, refresh tokens, blacklisting
│   ├── employee_routes.js       ← Employee profiles, biometric face descriptors
│   ├── master_routes.js         ← Companies, divisions, branches, cost centers
│   ├── shift_routes.js          ← Shifts, calendars, rotational groups, roster matrix
│   └── workflow_routes.js       ← Leave entries, balances, outdoor duty, OT register
├── scripts/
│   ├── setup_mysql.js           ← Cross-platform auto-start & database bootstrap
│   ├── generate_diagrams.py     ← Matplotlib generator for 4 high-res diagrams
│   ├── build_excel_architecture.py ← Openpyxl multi-sheet workbook builder
│   ├── seed_10000_enterprise_data.js ← High-scale enterprise data seeder
│   └── db_benchmark.js          ← Senior DBA 15-tier query benchmark harness
├── public/                      ← Frontend application & Leaflet maps
│   ├── index.html               ← Responsive UI dashboard, modal drawers & maps
│   ├── css/                     ← Modular styling (≤ 500 lines per file)
│   ├── js/                      ← Modular frontend controllers & face recognition
│   └── models/                  ← face-api.js neural weights (SSD Mobilenet, ResNet)
└── changelog/                   ← Central release documentation & index
```

---

## ⚙️ Prerequisites

- **Node.js 18+** & **npm**
- **Python 3.8+** (for cross-platform runners)
- **MySQL 8.4 LTS** or **8.0 LTS** (auto-configured via `scripts/setup_mysql.js`)
- **Java JDK 17+** & **Maven 3.8+** (optional, for Java Spring Boot backend)

---

## 🚀 Quick Start & Cross-Platform Runners

### 1. Single-Command Launch (Linux & macOS)

Initializes MySQL permissions, applies schema migrations, and boots on port `3000`:
```bash
npm install
npm start
```

### 2. Windows Batch Launchers (Windows 10/11)

Native Windows batch files configured with CRLF line endings, port conflict checking, and Windows App Execution Alias resolution:
```cmd
:: One-click start (frees port 3000, starts MySQL service, launches server)
start-all.bat

:: One-click test
test-all.bat

:: One-click shutdown (tree-kills processes cleanly)
stop-all.bat
```

### 3. Multi-Backend Python Launcher (Linux / macOS / Windows)

Runs both Node.js (Port 3000) and Java Spring Boot 3 (Port 3001) concurrently:
```bash
python3 start_all.py   # Linux / macOS
python start_all.py    # Windows
```

Once running, access the portal:
- 🌐 **Web Portal**: [`http://localhost:3000`](http://localhost:3000)
- 🛡️ **Admin Credentials**: Username `admin` | Password `admin123`
- 👤 **User Credentials**: Username `user` | Password `user123`

---

### 4. Automated Test Suites (38/38 Tests)

The comprehensive 38-step integration suite tests all enterprise modules against active MySQL:

```bash
# Run full Node.js 38-step test suite
npm run test:integration
# or directly:
node test_integration.js

# Run cross-platform Python test runner
python3 test_all.py all
```

**Verified Test Coverage**:
`Health` → `Auth / JWT` → `RBAC /me` → `Employees CRUD` → `Biometric Punch` → `Duplicate Punch Rejection (HTTP 429)` → `Audit Trail` → `Master Settings` → `Shifts CRUD` → `Shift Calendar & Weekly Offs` → `Shift Groups` → `Roster Matrix (284,250 slots)` → `Departments` → `Department Shifts` → `Karnataka 2026 Gazette (53 holidays)` → `Employment Types` → `Cohort Groups` → `Attendance Log & Regularization` → `Geofences & Coordinates` → `Work Codes` → `OT Register (1.5x/2.0x)` → `Leave Types` → `Leave Entries & Balances` → `Outdoor Duty` → `Companies` → `Designations` → `Branches` → `Indexed Search (<15ms)` → `Divisions` → `Cost Centers` → `Biometric Hardware Sync` → `Transfers & Promotions` → `Fast Buffer Ingest (1.5ms)` → `Batch Ingest (20,000 TPS)` → `Buffer Flush` → `Token Refresh` → `Logout` → `Blacklisted Token Rejection (HTTP 401)`.

---

### 5. Graceful Process Teardown

```bash
npm run stop:all
# Or directly via Python:
python3 stop_all.py   # Linux / macOS
python stop_all.py    # Windows
```

---

## 🔌 REST API Reference

All protected endpoints require an `Authorization: Bearer <access_token>` header.

| Domain / Area | Method | Endpoint | Access Tier | Description |
| :--- | :---: | :--- | :---: | :--- |
| **Auth** | `POST` | `/api/auth/login` | Public | Authenticates credentials; issues access & refresh tokens |
| **Auth** | `POST` | `/api/auth/refresh` | Public | Issues new access token via valid refresh token |
| **Auth** | `POST` | `/api/auth/logout` | Token | Revokes token and adds JTI to `token_blacklist` |
| **Employees** | `GET` | `/api/employees` | Authenticated | Paginated & indexed search (`dept_id`, `status`, name) |
| **Employees** | `POST` | `/api/employees` | Admin / HR | Registers employee with 128-d face descriptor & geolocation |
| **Attendance** | `POST` | `/api/attendance` | Authenticated | Records verified punch with cooldown throttle |
| **Attendance** | `POST` | `/api/attendance/regularize` | Admin / HR | Regularizes missed punches with audit logging |
| **Buffer Ingest** | `POST` | `/api/punch-buffer/ingest` | Edge / System | Ultra-fast L1 write ingestion (< 2ms) |
| **Buffer Ingest** | `POST` | `/api/punch-buffer/batch-ingest`| Edge / System | High-throughput batch ingestion (up to 25,000 TPS) |
| **Buffer Drain** | `POST` | `/api/punch-buffer/flush` | System / Admin | Drains queued punches into relational attendance ledger |
| **Shifts** | `GET` | `/api/shifts` | Authenticated | Retrieves diurnal shift definitions |
| **Roster** | `GET` | `/api/shift-roster/matrix` | Authenticated | Generates monthly employee shift assignment grid |
| **Holidays** | `GET` | `/api/public-holidays` | Authenticated | Karnataka 2026 Gazette statutory holiday calendar |
| **Leave** | `GET` | `/api/leave-entries/balances` | Authenticated | Real-time leave quotas and utilized balances |
| **Leave** | `POST` | `/api/leave-entries` | Authenticated | Submits formal leave request with workflow status |
| **Outdoor** | `POST` | `/api/outdoor-entries` | Authenticated | Submits on-duty client visit pass |
| **Overtime** | `GET` | `/api/ot-register` | Authenticated | Retrieves OT calculations with multipliers (1.5x / 2.0x) |
| **Geofences** | `POST` | `/api/geofences/verify` | Authenticated | Validates punch latitude/longitude coordinates |
| **Audit Logs** | `GET` | `/api/audit-logs` | Admin Only | Immutable change history with JSON diff snapshots |

---

## 🔒 Security & Cryptographic Invariants

1. **Zero-Plaintext Credential Storage**: Usernames are stored as deterministic SHA-256 hashes (`username_hash`); passwords use Bcrypt (cost 12) with per-user cryptographic salts.
2. **AES-256-GCM Hardware Encryption**: Sensitive PII columns (Aadhaar, PAN, phone, banking details) are encrypted at rest with 128-bit authentication tags.
3. **Session Revocation Blacklist**: Revoked JWT identifiers (`jti`) are persisted in `token_blacklist` to prevent replay attacks following logout.
4. **Non-Repudiation Audit Trails**: The `audit_log` records mutations immutably with actor identity, client IP, user-agent, timestamp, and full before/after JSON delta diffs.
5. **Defense-in-Depth**: Hardened Helmet security headers, CORS origin whitelisting, strict rate-limiting, and SQL prepared statement parameterization across all endpoints.

---

## ⚙️ Environment Configuration

Primary environment parameters in `.env`:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` / `NODE_PORT` | `3000` | HTTP port for Node.js Express server |
| `JAVA_PORT` | `3001` | HTTP port for Java Spring Boot server |
| `NODE_ENV` | `production` | Runtime mode (`development` / `production`) |
| `DB_DIALECT` | `mysql` | Active database dialect (`mysql`) |
| `MYSQL_HOST` | `127.0.0.1` | MySQL server host |
| `MYSQL_PORT` | `3306` | MySQL TCP port |
| `MYSQL_USER` | `soukhya_user` | Dedicated database user |
| `MYSQL_PASSWORD` | `soukhya_secure_pass_2026` | Database password |
| `MYSQL_DATABASE` | `soukhya_attendance` | MySQL database name |
| `MYSQL_CONNECTION_LIMIT`| `20` | Maximum pooled connection capacity |
| `JWT_ACCESS_SECRET` | `(64-byte hex)` | Cryptographic secret for Access Tokens |
| `JWT_REFRESH_SECRET` | `(64-byte hex)` | Cryptographic secret for Refresh Tokens |
| `PII_ENCRYPTION_KEY` | `(32-byte hex)` | 256-bit AES key for PII column encryption |
| `RATE_LIMIT_MAX_REQUESTS`| `500` | Max general requests allowed per window (1 min) |

---

## 👥 Authors & License

- **Soukhya Tech** — Enterprise Attendance, Biometrics & Workforce Management System
- Licensed under the [MIT License](LICENSE).
