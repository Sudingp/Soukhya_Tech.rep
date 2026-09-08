# Collaborator Setup & Onboarding Guide — Soukhya Tech HR Enterprise

This document is prepared for team members onboarding or continuing development on **Soukhya Tech HR Enterprise (v2.0 LTS)**.

---

## 1. Summary of Recent Production Merge

The last merge into the production branch (`HR-Enterprise-Prod`) was:
- **Commit**: `54869d6` (*Merge pull request #2 from Sudingp/HR-Enterprise-Dev-V1-clone*)
- **Author**: Sudingp (`sudingp2003@gmail.com`)
- **Key Changes Merged**:
  1. Ported backend services from C# (.NET) to Java Spring Boot.
  2. Removed legacy `csharp/` solution and added Java source tree (`src/main/java/`).
  3. Added baseline test and start runner scripts (`start-all.sh`, `test.sh`).
  4. Tracked the seeded SQLite database (`database/attendance.db`) directly in Git with 100 test employees.

> [!NOTE]
> The current active development branch is **`HR-Enterprise-Dev-V2`**, which is branched directly on top of `54869d6` and features **Pure Enterprise MySQL 8.4 LTS persistence (InnoDB + utf8mb4), complete elimination of SQLite, hash-based auth, role-aware changelog modal, and edge-to-edge UI layout**.

---

## 2. What Your Collaborator Needs to Do on Their System

### Prerequisites
- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher
- **Git** installed and configured
- **MySQL 8.4 / 8.0** or **MariaDB** (or Docker). The project uses MySQL as its exclusive production database engine.
- *(Optional)* **Java 17+** & **Maven** (only required if working on the Spring Boot backend in `src/`).

---

### Step-by-Step Setup Instructions

#### Step 1: Clone or Fetch the Repository
```bash
# If already cloned:
git fetch --all
git checkout HR-Enterprise-Dev-V2
git pull origin HR-Enterprise-Dev-V2
```

#### Step 2: Set Up Environment Configuration (`.env`)
Because `.env` contains security keys, it is ignored by Git. A ready-to-use template is provided in `.env.example`.

```bash
# Copy example configuration to active .env
cp .env.example .env
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

#### Step 4: Run the Application
You only need a single command to start the entire application:
```bash
npm start
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
npm run test:integration
```
All **11 integration tests** should pass 100%.

---

## 3. Files to Send Separately (What to Send vs. What is in Git)

| File / Resource | In Git? | Need to Send Separately? | Action Required |
| :--- | :---: | :---: | :--- |
| **`.env`** | ❌ No (Git-ignored) | ⚠️ **Optional** | They can run `cp .env.example .env`, OR you can send them your `.env` directly. |
| **MySQL Database** | ❌ Runtime | ❌ **No** | Auto-created with schema & 100 seeded records when running `npm start`. |
| **Face Recognition AI Models** | ❌ No | ❌ **No** | Loaded dynamically in browser via CDN (`cdn.jsdelivr.net`). |
| **`data/mysql/`** | ❌ No (Git-ignored) | ❌ **DO NOT SEND** | Runtime MySQL socket/PID/database directory. Created automatically. |
| **`node_modules/`** | ❌ No (Git-ignored) | ❌ **DO NOT SEND** | Generated locally via `npm install`. |

---

## 4. Recommended Repository Structure & `.gitignore` Rules

### Folder Structure
```text
soukhya-tech/
├── .env.example                 # [TRACKED] Sample environment configuration
├── .gitignore                   # [TRACKED] Defines files excluded from Git
├── README.md                    # [TRACKED] Comprehensive architectural docs
├── COLLABORATOR_SETUP.md        # [TRACKED] This setup guide
├── package.json                 # [TRACKED] Node dependencies and start scripts
├── server.js                    # [TRACKED] Express.js core API server
├── test_integration.js          # [TRACKED] 11-step integration test suite
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
│   └── setup_mysql.sh           # [TRACKED] Local MySQL daemon setup helper
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

The `.gitignore` file should always exclude local environments, runtime caches, and sensitive keys:

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

# Logs & IDE Configs
*.log
.idea/
.vscode/
.vs/
.gemini/
__pycache__/
*.py[cod]
```
