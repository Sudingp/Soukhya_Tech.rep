# Collaborator Setup & Onboarding Guide — Soukhya Tech HR Enterprise

This document is prepared for team members onboarding or continuing development on **Soukhya Tech HR Enterprise (v2.0 LTS / Dev-V4)** across **Windows**, **Linux**, and **macOS**.

---

## 1. Summary of Recent Merges & Architecture Updates

The project history includes major architecture upgrades:
- **PR #2 (`54869d6`)**: Ported backend services from C# (.NET) to Java Spring Boot with MySQL 8.4 LTS persistence.
- **PR #3 (`434a4c2`)**: Merged 10 enterprise feature commits adding 17 new HR modules (Shifts, Roster, Geofences, Overtime, Leave ledger, Outdoor duty).
- **PR #4 (Masters Subsystem & 3NF DBA Normalization)**:
  1. **Normalized 3NF Schema**: Applied strict relational normalization (1NF, 2NF, 3NF) for `companies`, `departments`, `designations`, `branches` (locations), `geofences`, `shifts`, `employment_types`, and `employees` with foreign key integrity.
  2. **5,000 Indian Employee Master Seeder**: Added high-performance chunked bulk seeder generating 5,000 realistic Indian employee records with AES-256-GCM encrypted PII, 128-dimensional AI facial embeddings, and SHA-256 verification hashes.
  3. **High-Speed Paginated API & UI Wiring**: Fast multi-column indexed queries (<35ms on 5,000+ records) and full frontend master modal wiring for Companies, Designations, and Branches.
- **PR #5 (High-Speed OLTP Architecture & Real-Time Buffer Pipeline)**:
  1. **Enterprise Master Subsystems**: Added normalized 3NF structures for `divisions` (Business Units), `cost_centers` (GL Accounts & Budget Allocations), `biometric_devices` (Hardware Terminal Management), and `employee_transfers` (Career Progression & Promotion Ledger with ACID locks).
  2. **Fast Punch Ingestion Buffer (`fast_punch_buffer`)**: Sub-millisecond write-optimized buffer decoupling edge IoT terminals from attendance calculation engines (>15,000 TPS burst throughput, <5ms DB insert latency, background asynchronous batch drain).
  3. **Real-Time Transaction HUD & Hardware Device Manager**: Live monitoring heads-up display and CRUD modals for all master entities.
  4. **38-Step Integration Test Suite**: Complete automated testing covering all 38 endpoints, transfer transactions, punch buffer ingestion benchmarks, and drain mechanics.

> [!NOTE]
> **Cross-Platform Scripting (Windows & Linux)**:
> All Windows-only `.bat` files (`start-all.bat`, `stop-all.bat`) have been removed and replaced with unified, zero-dependency Python runners (`start_all.py`, `stop_all.py`, `test_all.py`).
> - **Windows Users**: `python start_all.py` automatically detects Eclipse Adoptium JDK 21 (`C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot`) and other common Windows JDK paths, configures `JAVA_HOME`/`PATH`, boots MySQL, launches backends, and verifies endpoints.
> - **Linux/macOS Users**: `python3 start_all.py` works out of the box with standard OpenJDK / Maven installations.

---

## 2. What Your Collaborator Needs to Do on Their System

### Prerequisites
- **Python 3.8+** (installed on both Windows and Linux; standard library only, no pip packages required)
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
git checkout HR-Enterprise-Dev-V4
git pull origin HR-Enterprise-Dev-V4
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
npm run test:integration
```
All **38 integration tests** must pass 100%.

#### Step 6: (Optional) Seed 5,000 Realistic Indian Employee Master Records
To benchmark system performance with 5,000 realistic records with 128D AI facial embeddings and AES-256-GCM encryption:
```bash
node scripts/seed_5000_employees.js
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

## 4. Repository Structure & `.gitignore` Rules

### Folder Structure
```text
soukhya-tech/
├── .env.example                 # [TRACKED] Sample environment configuration
├── .gitignore                   # [TRACKED] Defines files excluded from Git
├── README.md                    # [TRACKED] Comprehensive architectural docs
├── COLLABORATOR_SETUP.md        # [TRACKED] This setup guide
├── package.json                 # [TRACKED] Node dependencies and start scripts
├── start_all.py                 # [TRACKED] Cross-platform backend launcher (Windows & Linux)
├── stop_all.py                  # [TRACKED] Cross-platform backend shutdown utility
├── test_all.py                  # [TRACKED] Cross-platform test runner and health checker
├── server.js                    # [TRACKED] Express.js core API server
├── test_integration.js          # [TRACKED] 32-step integration test suite
├── db_optimize.py               # [TRACKED] MySQL 8.4 LTS optimizer & latency benchmark
├── changelog/                   # [TRACKED] Role-aware markdown release notes
│   ├── README.md
│   ├── CHANGELOG_ADMIN.md
│   └── CHANGELOG_USER.md
├── database/
│   ├── db.js                    # [TRACKED] Pure MySQL 8.4 LTS query layer
│   ├── mysql_adapter.js         # [TRACKED] MySQL connection pool & async DAO
│   └── schema_mysql.sql         # [TRACKED] MySQL 8.4 LTS DDL schema (InnoDB + utf8mb4)
├── public/                      # [TRACKED] Frontend Single-Page Application
│   ├── index.html               # Main dashboard UI with changelog modal
│   ├── style.css                # Enterprise styling & theme
│   ├── app.js                   # Client controller logic
│   └── dsa_cache.js             # Client-side LRU cache & prefix trie
├── scripts/
│   ├── seed_5000_employees.js   # [TRACKED] 5,000 Indian employee master bulk seeder
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
├── *.bat                        # [IGNORED] OS-specific batch scripts
└── .soukhya-pids                # [IGNORED] Process ID tracking files
```

---

## 5. What Must Stay in `.gitignore`

The `.gitignore` file excludes local environments, runtime caches, OS-specific batch files, and sensitive keys:

```gitignore
# Dependencies & Build
node_modules/
target/
build/
bin/
obj/

# Environment & Secrets (NEVER COMMIT)
.env
*.user
*.suo

# Local Database Runtime & Caches (NEVER COMMIT)
data/
*.sock
*.pid
.soukhya-pids
*.db
*.db-*

# OS-Specific Scripts & Logs
*.bat
*.log
.idea/
.vscode/
.vs/
.gemini/
__pycache__/
*.py[cod]
```

