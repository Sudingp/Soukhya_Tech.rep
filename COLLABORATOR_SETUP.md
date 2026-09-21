# Collaborator Setup & Onboarding Guide — Soukhya Tech HR Enterprise

This document is prepared for team members onboarding or continuing development on **Soukhya Tech HR Enterprise (v4.1.0 Enterprise RBAC Release)** on branch **`HR-Enterprise-Prod`** across **Windows**, **Linux**, and **macOS**.

---

## 1. Summary of Architecture Evolution (Commit `54869d6` to Current Production)

Since the baseline commit `54869d6483a4b8103f844103b7d173cf1a236a50`, the codebase has evolved from a single-machine prototype into an enterprise-grade HR & Biometric system:

### A. Core Persistence & Security Baseline (Commit `54869d6`)
- **Pure MySQL 8.4 LTS Migration**: Completely eradicated SQLite runtime dependencies and fallback logic; standard collation set to `utf8mb4_0900_ai_ci`.
- **Zero-Plaintext Authentication**: Usernames indexed as SHA-256 hashes (`username_hash`); passwords salted and hashed using Bcrypt (cost factor 12).
- **JWT Token Blacklist & Session Revocation**: Immediate token blacklisting on logout via database (`token_blacklist`) and in-memory cache.
- **Data Structures & Algorithms (DSA)**: Custom $O(1)$ doubly-linked list LRU Cache (`LRUCache`) and Prefix Search Trie (`PrefixTrie`) with Server-Sent Events (SSE) live sync (`/api/sync/events`).

### B. Relational Organization & Shift Management (v3.1.0)
- **Full Shift Subsystem**: Implemented multi-pattern Shift Calendars (`SUN_ONLY`, `SUN_AND_ALT_SAT`, `ALL_SAT_SUN`), Shift Cohort Groups, and high-speed monthly Shift Roster Matrix auto-generation (284,000+ slots in <55ms).
- **Operational HR Modules**: Attendance Log, Overtime Register (with 1.5x / 2.0x multipliers), Work Codes, and Geofences with polygon & circular coordinate validation.
- **Organization Drawer Consolidation**: Restructured Leave Types, Leave Entries, and Outdoor Duty (OD) into unified Organization configuration drawers.

### C. Karnataka 2026 Gazette & Senior DBA Performance (v4.0.0)
- **High Court of Karnataka 2026 Calendar Ingestion**: Full ingestion of all 53 official state holidays (32 Mandatory Gazetted + 21 Restricted / Optional Holidays).
- **Interactive Holiday Leave Workflow**: Added `#la-holiday-id` dynamic dropdown to the Leave Application dialog with automated leave dates population, 1.0 day quota deduction, and statutory category badges (`LT_RH` vs. `LT_CL`).
- **Senior DBA 15-Tier Benchmark Suite (`scripts/db_benchmark.js`)**:
  - 15 high-concurrency queries testing Simple (S1–S5), Medium (M1–M5), and Complex (C1–C5) performance tiers.
  - Sub-millisecond latency (0.16 ms – 0.79 ms) with throughput up to 23,000+ QPS.
  - Complex roster scan reduced from 622ms to **54.8ms** (11.3x speedup); 30-day attendance analytics reduced from 284ms to **70.0ms** (4x speedup).
- **Covering Indexes & Stored Generated Columns**:
  - `attendance`: Stored generated column `punch_date DATE GENERATED ALWAYS AS (CAST(timestamp AS DATE)) STORED` with covering index `idx_att_pdate_dept_stat_cov (punch_date, dept, status, emp_id)`.
  - `shift_roster`: Covering composite index `idx_roster_date_shift_emp_cov (roster_date, shift_id, emp_id)`.
  - `employees`: Covering composite indexes `idx_emp_comp_dept_stat_cov` and `idx_emp_div_cc_stat_cov`.
- **Relational Scale**: 10,100 active Indian employee records with 128-d AI face embeddings and AES-256-GCM encrypted PII.

### D. Role-Based Access Control (RBAC) & Employee Self-Service (v4.1.0)
- **Full Mode Segregation**: Dynamic interface bifurcation between Administrative Governance and Employee Self-Service (ESS).
- **CSS RBAC & Action Guarding**: Classes `.admin-only` and `.admin-action` automatically hide admin menus and sensitive actions (punch regularizations, weekly off pattern applications, gazette imports, leave/OD approvals) in User Mode.
- **Dedicated ESS Workspace**: Added quick-access navigation bar for staff:
  - `📅 My Schedule`: View personal monthly shift calendar and working hours.
  - `📝 Leave & Balances`: Real-time leave quotas ledger and self-service application form.
  - `🚶 Outdoor Duty (OD)`: Client site & field work duty requisitioning with automatic attendance credit synchronization.
  - `🕒 Attendance History`: Personal punch-in and punch-out scan logs.
  - `🏖️ Holidays 2026`: View the official Karnataka High Court & Government holiday calendar.
- **Backend API Scoping**: Endpoints `GET /api/attendance-log`, `GET /api/leave-entries`, and `GET /api/outdoor-entries` automatically isolate responses to `req.user.emp_id` when called by `USER` role tokens.
- **Live Machine Geolocation Engine**:
  - Integrated W3C Geolocation API in employee registration and attendance capture to acquire machine GPS coordinates.
  - Integrated Leaflet.js with OpenStreetMap tiles for real-time map preview, draggable marker, and reverse geocoding via Nominatim.
  - Persisted coordinates in MySQL schema (`employees.latitude`, `employees.longitude`, `employees.registered_location`) with Haversine polygon geofence verification.
- **Master Data Pipeline Restoration**: Restored 3NF configuration pipelines across Companies, Branches, Divisions, Cost Centers, Designations, Departments, and Department Shifts with global `window.state` resolver proxy.

### E. Cross-Platform Windows & Linux Parity
- First-class support for both native Windows batch scripts (`start-all.bat`, `stop-all.bat`, `test-all.bat`) and Python runners (`start_all.py`, `stop_all.py`, `test_all.py`).
- Windows 10/11 Microsoft Store App Execution Alias protection via `python -c "import sys"`.
- Windows process-tree cleanup (`taskkill /F /T /PID`) and listening-port conflict resolution on port 3000.
- Safe dynamic binary lookup (`shutil.which('node')` resolving `node.exe` on Windows and `/usr/bin/node` on Linux).
- UNIX domain socket isolation on Windows, ensuring reliable TCP connections on port 3306.
- **Strict Modularity Rule**: 100% of all JavaScript and CSS files are strictly $\le 500$ lines of code.
- **Integration Test Pass**: Complete 38-step automated integration test suite passing 100%.

---

## 2. What Your Collaborator Needs to Do on Their System

### Prerequisites
- **Python 3.8+** (installed on Windows or Linux; standard library only, no pip packages required)
- **Node.js** v18.0.0 or higher & **npm** v9.0.0 or higher
- **Git** installed and configured
- **MySQL 8.4 / 8.0** or **MariaDB** (or Docker). The system includes an automated setup helper (`scripts/setup_mysql.js`) that automatically creates and boots local database instances if offline.
- *(Optional)* **Java 17 / 21** & **Maven** (only required if developing the Spring Boot backend in `src/`).

---

### Step-by-Step Setup Instructions

#### Step 1: Clone or Fetch the Repository
```bash
# Fetch latest branches:
git fetch --all
git checkout HR-Enterprise-Prod
git pull origin HR-Enterprise-Prod
```

#### Step 2: Set Up Environment Configuration (`.env`)
Because `.env` contains security keys, it is ignored by Git. A ready-to-use template is provided in `.env.example`.

```bash
# On Linux / macOS:
cp .env.example .env

# On Windows (cmd / powershell):
copy .env.example .env
```

> [!IMPORTANT]
> **PII Encryption Key Requirement**:
> The `PII_ENCRYPTION_KEY` in `.env` must remain:
> ```ini
> PII_ENCRYPTION_KEY=0673da2e3102f4ad23371a5c507736ee68f9bda316ec0e99ff9b883cc07b5693
> ```
> This key is required by AES-256-GCM to decrypt employee phone numbers, emails, and card numbers. `.env.example` already contains this key.

#### Step 3: Install Node Dependencies
```bash
npm install
```

#### Step 4: Run the Application (Cross-Platform)

You can launch all backends (Node.js on 3000 + Java on 3001) using:
```bash
# Via npm:
npm run start:all

# Or directly via Python:
python start_all.py          # Windows
python3 start_all.py         # Linux / macOS

# Or on Windows via native batch runner:
start-all.bat                # Windows cmd / double-click
```

To stop all services cleanly:
```bash
npm run stop:all
# Or:
python stop_all.py           # Windows
python3 stop_all.py          # Linux / macOS
# Or on Windows:
stop-all.bat                 # Windows cmd
```

- Open your browser to: **`http://localhost:3000`**
- **Default Admin Credentials**:
  - **Username**: `admin`
  - **Password**: `admin123`
- **Default User Credentials**:
  - **Username**: `user`
  - **Password**: `user123`

#### Step 5: Verify via Automated Integration Tests
```bash
# Run comprehensive 38-step test suite:
npm test
# Or:
node test_integration.js
# Or on Windows:
test-all.bat
```
All **38 integration tests** must pass 100%.

#### Step 6: Enterprise Master Dataset & Performance Benchmarks
The production database is seeded with **10,100 realistic Indian employee records** with 128-d AI face embeddings, 3NF organization entities, and AES-256-GCM encrypted PII.
To re-seed or benchmark query latency:
```bash
# Re-seed 10,000+ enterprise dataset:
node scripts/seed_10000_enterprise_data.js

# Execute Senior DBA 15-tier benchmark suite (Simple, Medium, Complex queries):
node scripts/db_benchmark.js
```

---

## 3. Files to Send Separately (What to Send vs. What is in Git)

| File / Resource | In Git? | Need to Send Separately? | Action Required |
| :--- | :---: | :---: | :--- |
| **`.env`** | ❌ No (Git-ignored) | ⚠️ **Optional** | They can run `cp .env.example .env`, OR you can send them your `.env` directly. |
| **MySQL Database** | ❌ Runtime | ❌ **No** | Auto-created with schema & seeded records when running `npm start` or `python start_all.py`. |
| **Face Recognition AI Models** | ❌ No | ❌ **No** | Loaded dynamically in browser via CDN (`cdn.jsdelivr.net`). |
| **`data/mysql/`** | ❌ No (Git-ignored) | ❌ **DO NOT SEND** | Runtime MySQL socket/PID/database directory. Created automatically. |
| **`node_modules/`** | ❌ No (Git-ignored) | ❌ **DO NOT SEND** | Generated locally via `npm install`. |

---

## 4. Repository Structure & Directory Map

### Current Production Architecture (`HR-Enterprise-Prod`)
```text
soukhya-tech/
├── .env.example                 # [TRACKED] Sample environment configuration
├── .gitignore                   # [TRACKED] Defines files excluded from Git
├── README.md                    # [TRACKED] Architecture & system documentation
├── CHANGELOG.md                 # [TRACKED] Central release history (v4.1.0)
├── COLLABORATOR_SETUP.md        # [TRACKED] This setup guide
├── package.json                 # [TRACKED] Node dependencies and start scripts
├── start_all.py                 # [TRACKED] Cross-platform backend launcher (Windows & Linux)
├── stop_all.py                  # [TRACKED] Cross-platform backend shutdown utility
├── test_all.py                  # [TRACKED] Cross-platform test runner and health checker
├── start-all.bat                # [TRACKED] Windows native launcher batch script
├── stop-all.bat                 # [TRACKED] Windows native shutdown batch script
├── test-all.bat                 # [TRACKED] Windows native test runner batch script
├── server.js                    # [TRACKED] Express.js core API server
├── test_integration.js          # [TRACKED] 38-step automated integration test suite
├── db_optimize.py               # [TRACKED] MySQL 8.4 LTS optimizer utility
├── changelog/                   # [TRACKED] Role-aware markdown release notes
│   ├── README.md
│   ├── CHANGELOG_ADMIN.md       # Technical specs & database architecture
│   └── CHANGELOG_USER.md        # Employee self-service & UI features
├── database/
│   ├── db.js                    # [TRACKED] Pure MySQL 8.4 LTS query layer
│   ├── mysql_adapter.js         # [TRACKED] MySQL connection pool & async DAO aggregator
│   ├── schema_mysql.sql         # [TRACKED] MySQL 8.4 LTS DDL schema (InnoDB + utf8mb4)
│   └── daos/                    # [TRACKED] Modular domain DAOs (<500 lines each)
│       ├── auth_dao.js, employee_dao.js, attendance_dao.js, shift_dao.js
│       ├── roster_dao.js, department_dao.js, master_dao.js, device_dao.js
│       ├── transfer_dao.js, buffer_dao.js, workflow_dao.js, audit_dao.js
├── routes/                      # [TRACKED] Modular REST API route handlers
│   ├── admin_routes.js, attendance_routes.js, auth_routes.js, department_routes.js
│   ├── device_routes.js, employee_routes.js, master_routes.js, punch_buffer_routes.js
│   ├── roster_routes.js, shift_routes.js, sync_routes.js, workflow_routes.js
├── public/                      # [TRACKED] Frontend Single-Page Application
│   ├── index.html               # Main dashboard UI with changelog & master modals
│   ├── css/                     # [TRACKED] Modular styles (base.css, components.css)
│   └── js/
│       ├── core/                # api_sync.js, auth_state.js, changelog.js
│       └── modules/             # employee_master.js, shift_roster.js, overtime.js,
│                                # leave_types.js, geofences.js, geo_location.js, etc.
├── scripts/
│   ├── db_benchmark.js          # [TRACKED] Senior DBA 15-tier query benchmark suite
│   ├── seed_10000_enterprise_data.js # [TRACKED] 10,100 multi-company master seeder
│   ├── seed_5000_employees.js   # [TRACKED] 5,000 Indian employee bulk seeder
│   ├── setup_mysql.js           # [TRACKED] Cross-platform MySQL runner (Node.js)
│   └── setup_mysql.sh           # [TRACKED] Local MySQL daemon setup helper (Bash)
├── src/                         # [TRACKED] Spring Boot Java backend
│   └── main/java/...
│
├── .env                         # [IGNORED] Active secrets & encryption keys
├── node_modules/                # [IGNORED] Node runtime packages
├── target/                      # [IGNORED] Java build artifacts
├── data/                        # [IGNORED] MySQL runtime data directory & socket
├── *.db                         # [IGNORED] Database binary files
├── *.log                        # [IGNORED] Server log output files
└── .soukhya-pids                # [IGNORED] Process ID tracking files
```

---

## 5. What Must Stay in `.gitignore`

The `.gitignore` file strictly excludes local secrets, build output, runtime data, and operating system caches:

```gitignore
node_modules/
target/
.gemini/
*.log
.soukhya-pids
*.db
*.db-*
.idea/
.vscode/
build/
bin/
obj/
*.user
*.suo
.vs/
.env
env
Antigravity-x64
Antigravity.tar.gz
__pycache__/
*.py[cod]
.pytest_cache/
data/
*.sock
*.pid
```

