# Collaborator Setup & Onboarding Guide — Soukhya Tech HR Enterprise

This document is prepared for team members onboarding or continuing development on **Soukhya Tech HR Enterprise (v2.0 LTS / Dev-V4)** across **Windows**, **Linux**, and **macOS**.

---

## 1. Summary of Recent Merges & Architecture Updates

The project history includes two major merged pull requests:
- **PR #2 (`54869d6`)**: Ported backend services from C# (.NET) to Java Spring Boot with MySQL 8.4 LTS persistence.
- **PR #3 (`434a4c2`)**: Merged 10 enterprise feature commits adding 17 new HR modules:
  1. **Master Configurations & Settings** (`/api/settings/master`)
  2. **Full Shift Subsystem**: Shift details, 30-day Shift Calendar, Shift Groups, Roster Matrix with auto-generation (`/api/shifts`, `/api/shift-calendar`, `/api/shift-groups`, `/api/shift-roster`)
  3. **Organization Management**: Departments, Department Shifts, and 2026 Karnataka State Gazette Public Holidays (`/api/departments`, `/api/department-shifts`, `/api/public-holidays`)
  4. **Workforce Structure**: Employment Types, Employee Groups / Task Forces (`/api/employment-types`, `/api/employee-groups`)
  5. **Attendance Operations**: Attendance Log with regularization, Geofences with radial distance validation, Work Codes, and Overtime (OT) Register with auto-calculation (`/api/attendance-log`, `/api/geofences`, `/api/work-codes`, `/api/ot-register`)
  6. **Leave & Duty Administration**: Statutory Leave Types, Leave Applications & Balances Ledger, Outdoor Duty Entries (`/api/leave-types`, `/api/leave-entries`, `/api/outdoor-entries`)

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
```

To stop all services cleanly:
```bash
npm run stop:all
# Or:
python stop_all.py           # Windows
python3 stop_all.py          # Linux / macOS
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
# Run comprehensive 28-step test suite:
npm test
# Or:
npm run test:integration
```
All **28 integration tests** must pass 100%.

---

## 3. Files to Send Separately (What to Send vs. What is in Git)

| File / Resource | In Git? | Need to Send Separately? | Action Required |
| :--- | :---: | :---: | :--- |
| **`.env`** | ❌ No (Git-ignored) | ⚠️ **Optional** | They can run `cp .env.example .env`, OR you can send them your `.env` directly. |
| **MySQL Database** | ❌ Runtime | ❌ **No** | Auto-created with schema & 100 seeded records when running `npm start` or `python start_all.py`. |
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
├── test_integration.js          # [TRACKED] 28-step integration test suite
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

