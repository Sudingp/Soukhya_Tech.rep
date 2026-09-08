# Soukhya Tech — Enterprise Face Recognition Attendance System

[![Branch](https://img.shields.io/badge/Branch-HR--Enterprise--Dev--V2-blue.svg)](https://github.com/Sudingp/Soukhya_Tech.rep)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Java](https://img.shields.io/badge/Java-17%2B-orange.svg)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.3-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![Python](https://img.shields.io/badge/Python-3.8%2B-blue.svg)](https://www.python.org/)
[![Database](https://img.shields.io/badge/Database-MySQL%208.4%20LTS-blue.svg)](https://www.mysql.com/)

An enterprise-grade, hardened face recognition attendance system featuring pure **MySQL 8.4 LTS** persistence, dual polyglot backends (**Node.js Express** and **Java Spring Boot 3**), client-side neural face recognition via `face-api.js`, zero-plaintext credential storage (SHA-256 username hash + Bcrypt password hash), real-time role mode switching, AES-256-GCM PII encryption, JWT authentication with token rotation, rate limiting, and unified cross-platform management runners.

---

## 📑 Table of Contents

- [Key Features & Hardening](#-key-features--hardening)
- [📝 Release Changelogs](#-release-changelogs)
- [📁 Project Structure](#-project-structure)
- [⚙️ Prerequisites](#️-prerequisites)
- [🚀 Quick Start](#-quick-start)
  - [1. Single-Command Launch (Recommended)](#1-single-command-launch-recommended)
  - [2. Multi-Backend Launcher](#2-multi-backend-launcher)
  - [3. Run Endpoint Tests](#3-run-endpoint-tests)
- [🔌 REST API Reference](#-rest-api-reference)
- [🗄️ Enterprise Database (MySQL 8.4 LTS)](#️-enterprise-database-mysql-84-lts)
- [🔒 Security & Architecture](#-security--architecture)
- [⚙️ Environment Configuration](#️-environment-configuration)

---

## 📝 Release Changelogs

Comprehensive change documentation is maintained in the [`changelog/`](./changelog/) directory:

- 🛡️ [**Administrator & Technical Changelog (`changelog/CHANGELOG_ADMIN.md`)**](./changelog/CHANGELOG_ADMIN.md): Full backend, MySQL 8.4 LTS migration, schema DDL, indexing, DSA cache, and API changes.
- 👤 [**User Release Notes (`changelog/CHANGELOG_USER.md`)**](./changelog/CHANGELOG_USER.md): Frontend user features, full-screen viewport layout, interactive login modal, mode switcher, and security policies.
- 📋 [**Changelog Index & Roadmap (`changelog/README.md`)**](./changelog/README.md): Cross-branch version roadmap across `HR-Enterprise-Dev-V2`, `HR-Enterprise-Dev-V1`, and `HR-Enterprise-Prod`.

---

## 🌟 Key Features & Hardening

- **Polyglot Backends**: 
  - **Node.js Express** (Port `3000`): Fast, lightweight API with Helmet, Joi validation, and in-memory LRU caching.
  - **Java Spring Boot 3** (Port `3001`): Robust enterprise backend with Spring Security, JPA/Hibernate, Caffeine cache, and Actuator metrics.
- **Biometric Recognition**: Client-side face detection and 128-dimensional descriptor extraction via `face-api.js` (SSD Mobilenet / TinyFaceDetector + ResNet) with cosine/Euclidean distance matching.
- **Enterprise Security**:
  - **JWT Authentication**: Short-lived Access Tokens (`15m`) and revocable Refresh Tokens (`7d`) with automatic rotation.
  - **PII Encryption**: Hardware-accelerated **AES-256-GCM** encryption for sensitive data (Aadhaar, PAN, phone, email).
  - **Rate Limiting & DoS Protection**: Configurable request limits per IP window for general and authentication routes.
  - **Comprehensive Audit Trail**: Non-repudiation logging for all CRUD operations, logins, and attendance scans.
- **Cross-Platform Python Runners**:
  - Standard-library-only Python 3 runners (`start_all.py`, `stop_all.py`, `test_all.py`) that run identically on **Windows** (CMD/PowerShell) and **Ubuntu/Linux/macOS** without any `pip` dependencies.

---

## 📁 Project Structure

```
soukhya-tech/
├── start_all.py                 ← Cross-platform backend launcher & auto-builder
├── stop_all.py                  ← Cross-platform process & port cleanup utility
├── test_all.py                  ← Pure Python endpoint test suite (15 assertions)
├── server.js                    ← Hardened Node.js Express server
├── pom.xml                      ← Maven build descriptor for Java Spring Boot
├── package.json                 ← Node.js dependencies & npm runner scripts
├── .env                         ← Runtime configuration & cryptographic secrets
├── database/
│   ├── db.js                    ← Pure MySQL 8.4 LTS query layer & statement delegation
│   ├── mysql_adapter.js         ← MySQL connection pool & async DAO
│   └── schema_mysql.sql         ← MySQL 8.4 LTS DDL schema (InnoDB + utf8mb4)
├── src/                         ← Java Spring Boot 3 backend source
│   └── main/java/com/soukhyatech/faceattendance/
│       ├── controller/          ← Auth, Employee, Attendance, Stats REST controllers
│       ├── service/             ← Business logic, PII encryption, audit logger
│       ├── security/            ← Spring Security filter chain, JWT validator
│       ├── repository/          ← Spring Data JPA repositories
│       └── model/               ← JPA entity models
├── public/                      ← Frontend application
│   ├── index.html               ← Responsive UI dashboard & webcam canvas
│   ├── app.js                   ← Face recognition engine & API integration
│   ├── style.css                ← UI stylesheet
│   └── models/                  ← face-api.js pre-trained neural network weights
└── csharp/                      ← Optional .NET 8 Face Attendance service
```

---

## ⚙️ Prerequisites

Ensure the following runtimes are installed on your machine:

- **Python 3.8+** (`python3` or `python`)
- **Node.js 18+** & **npm**
- **Java JDK 17+** & **Maven 3.8+** (for Java Spring Boot backend)

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd soukhya-tech
npm install
```

### 2. Single-Command Launch (Recommended)

Starts the local **MySQL 8.4 LTS** daemon (if not running), initializes database permissions, and boots both the **Frontend UI** and **Backend APIs** on port `3000`:

```bash
npm start
```

Once started, open your browser:
- 🌐 **Web UI & API**: [`http://localhost:3000`](http://localhost:3000)
- 🛡️ **Admin Account**: Username `admin` | Password `admin123`
- 👤 **User Account**: Username `user` | Password `user123`

### 3. Multi-Backend Launcher (Node + Java Spring Boot)

To run both Node.js and Java Spring Boot 3 concurrently with auto-port freeing and log streaming:

```bash
npm run start:all
# Or directly with Python:
python3 start_all.py   # Linux / macOS
python start_all.py    # Windows
```

---

### 4. Run Endpoint Tests

Run the automated 11-step integration suite verifying authentication, biometrics, attendance punches, and database operations:

```bash
npm run test:integration    # End-to-end integration test against active database
npm test                    # Cross-platform Python endpoint test suite
```

#### Or directly via Python:
```bash
# Linux/macOS
python3 test_all.py all
python3 test_all.py node
python3 test_all.py java

# Windows
python test_all.py all
python test_all.py node
python test_all.py java
```

---

### 4. Stop Services

To terminate all running processes and release ports 3000 and 3001:

```bash
# Cross-platform via npm
npm run stop:all

# Or via Python
python3 stop_all.py   # Linux/macOS
python stop_all.py    # Windows
```

---

## 🔌 REST API Reference

All protected endpoints require an `Authorization: Bearer <access_token>` header.

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Authenticates credentials, returns `access_token` and `refresh_token` |
| `POST` | `/api/auth/refresh` | Public | Exchanges a valid `refresh_token` for a new `access_token` |
| `POST` | `/api/auth/logout` | Token | Revokes the current session refresh token |
| `GET` | `/api/auth/verify` | Token | Verifies token validity and returns caller identity |

### Employees

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/employees` | List all employees (decrypted metadata) |
| `GET` | `/api/employees/:id` | Get employee profile and face descriptor |
| `POST` | `/api/employees` | Register employee with 128-d descriptor & encrypted PII |
| `PUT` | `/api/employees/:id` | Update employee information |
| `DELETE` | `/api/employees/:id` | Delete employee and associated attendance history |

**Sample POST `/api/employees` Payload:**
```json
{
  "id": "EMP001",
  "name": "Alex Morgan",
  "department": "Engineering",
  "role": "Lead Architect",
  "email": "alex.morgan@soukhyatech.com",
  "phone_no": "+91 98765 43210",
  "aadhaar_number": "1234-5678-9012",
  "pan_number": "ABCDE1234F",
  "descriptor": [0.045, -0.128, 0.089, ...],
  "image": "data:image/jpeg;base64,..."
}
```

### Attendance

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/attendance` | List attendance records (supports `?date=YYYY-MM-DD` and `?emp_id=ID`) |
| `POST` | `/api/attendance` | Mark attendance log (anti-duplicate throttled) |
| `DELETE` | `/api/attendance/:att_id` | Delete specific attendance entry |

**Sample POST `/api/attendance` Payload:**
```json
{
  "emp_id": "EMP001",
  "name": "Alex Morgan",
  "dept": "Engineering",
  "role": "Lead Architect",
  "status": "Present",
  "confidence": 0.94
}
```

### Analytics & Health

| Method | Endpoint | Port | Description |
|---|---|---|---|
| `GET` | `/api/stats` | 3000 / 3001 | Dashboard metrics (present count, dept breakdown, daily totals) |
| `GET` | `/actuator/health` | 3001 | Spring Boot Actuator application health check |

---

## 🗄️ Enterprise Database (MySQL 8.4 LTS)

The persistence tier utilizes pure **MySQL 8.4 LTS / 8.0 LTS** (`InnoDB`, `utf8mb4_0900_ai_ci`) with dedicated connection pooling:

- **Optimized DDL Schema**: [`database/schema_mysql.sql`](database/schema_mysql.sql)
- **High-Throughput Pool Adapter**: [`database/mysql_adapter.js`](database/mysql_adapter.js)
- **Database Query Layer**: [`database/db.js`](database/db.js)

### Key Database Tables:
1. `users`: Indexed SHA-256 `username_hash`, display usernames, Bcrypt `password_hash`, and expanded role check (`ADMIN`, `HR`, `EMPLOYEE`, `USER`, `DEVICE`).
2. `employees`: 100 seeded enterprise profiles, 40+ HR attributes, encrypted PII columns, and native `JSON` facial descriptors with companion SHA-256 descriptor hashes.
3. `attendance`: High-speed time-clock records with foreign key cascade (`fk_attendance_employee`) and composite indexes (`idx_att_emp_ts`, `idx_att_ts_status`).
4. `audit_log`: Non-repudiation security audit trail logging every insert, update, deletion, login, and password reset.
5. `token_blacklist`: Revoked JWT hashes for immediate session invalidation upon log off.

---

## 🔒 Security & Architecture

1. **Zero-Plaintext Credential Storage**: Usernames are stored as SHA-256 hashes (`username_hash`) preventing username enumeration; passwords are encrypted with Bcrypt (cost 12).
2. **Real-Time Role Switching & Governance**: Clean separation between `[🛡️ ADMIN MODE]` and `[👤 USER MODE]`. Sensitive master drawers, employee configurations, and system user management tools are strictly hidden in User Mode.
3. **Admin-Governed Password Resets**: Self-service "Forgot Password" is permanently disabled to prevent social-engineering attacks. Credentials can only be reset by authorized System Administrators via `/api/admin/users`.
4. **AES-256-GCM Hardware Encryption**: Sensitive PII fields (Aadhaar, PAN, phone, email) are encrypted at rest with 128-bit authentication tags.
5. **DSA Caching & Live Sync**: In-memory Doubly-Linked-List LRU cache (`lib/dsa_cache.js`) with Server-Sent Events (SSE) `/api/sync/events` invalidation.
6. **Defense-in-Depth**: Helmet security headers, CORS origin allowlisting, brute-force rate limiters, and token revocation blacklists.

---

## ⚙️ Environment Configuration

Configuration variables can be customized in `.env`:

| Parameter | Default | Purpose |
|---|---|---|
| `PORT` / `NODE_PORT` | `3000` | Port for Node.js Express server |
| `JAVA_PORT` | `3001` | Port for Java Spring Boot server |
| `NODE_ENV` | `production` | Environment mode (`development` / `production`) |
| `DB_DIALECT` | `mysql` | Active database dialect (`mysql`) |
| `MYSQL_HOST` | `127.0.0.1` | MySQL server host address |
| `MYSQL_PORT` | `3306` | MySQL server port |
| `MYSQL_USER` | `soukhya_user` | MySQL username |
| `MYSQL_PASSWORD` | `soukhya_secure_pass_2026` | MySQL password |
| `MYSQL_DATABASE` | `soukhya_attendance` | MySQL database name |
| `MYSQL_CONNECTION_LIMIT` | `20` | Max pooled connections |
| `JWT_ACCESS_SECRET` | `(64-byte hex)` | Secret key for signing Access Tokens |
| `JWT_REFRESH_SECRET`| `(64-byte hex)` | Secret key for signing Refresh Tokens |
| `PII_ENCRYPTION_KEY`| `(32-byte hex)` | 256-bit AES key for PII column encryption |
| `JWT_ACCESS_EXPIRY` | `15m` | Lifetime of access tokens |
| `JWT_REFRESH_EXPIRY`| `7d` | Lifetime of refresh tokens |
| `CORS_WHITELIST` | `http://localhost:3000,http://localhost:5173` | Allowed origin domains |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limiter window in milliseconds (1 min) |
| `RATE_LIMIT_MAX_REQUESTS` | `500` | Max general requests allowed per window |
| `RATE_LIMIT_AUTH_MAX` | `100` | Max login attempts allowed per window |
| `ADMIN_USERNAME` | `admin` | Default administrator username |
| `ADMIN_PASSWORD` | `admin123` | Default administrator password |

---

## 👥 Authors & License

- **Soukhya Tech** — Enterprise Attendance & Biometrics System
- Licensed under the [MIT License](LICENSE).
