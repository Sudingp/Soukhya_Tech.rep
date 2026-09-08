# Soukhya Tech — Enterprise Face Recognition Attendance System

[![Branch](https://img.shields.io/badge/Branch-HR--Enterprise--Dev--V2-blue.svg)](https://github.com/Sudingp/Soukhya_Tech.rep)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Java](https://img.shields.io/badge/Java-17%2B-orange.svg)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.3-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![Python](https://img.shields.io/badge/Python-3.8%2B-blue.svg)](https://www.python.org/)
[![Database](https://img.shields.io/badge/Database-SQLite%20v6-lightgrey.svg)](https://www.sqlite.org/)

An enterprise-grade, hardened face recognition attendance system featuring dual polyglot backends (**Node.js Express** and **Java Spring Boot 3**), client-side neural face recognition via `face-api.js`, AES-256-GCM PII encryption, JWT authentication with token rotation, rate limiting, and unified cross-platform Python management runners for **Windows** and **Ubuntu/Linux**.

---

## 📑 Table of Contents

- [Key Features & Hardening](#-key-features--hardening)
- [📁 Project Structure](#-project-structure)
- [⚙️ Prerequisites](#️-prerequisites)
- [🚀 Quick Start](#-quick-start)
  - [1. Install Dependencies](#1-install-dependencies)
  - [2. Start Backends](#2-start-backends)
  - [3. Run Endpoint Tests](#3-run-endpoint-tests)
  - [4. Stop Services](#4-stop-services)
- [🔌 REST API Reference](#-rest-api-reference)
  - [Authentication](#authentication)
  - [Employees](#employees)
  - [Attendance](#attendance)
  - [Analytics & Health](#analytics--health)
- [🗄️ Database Schema (v6)](#️-database-schema-v6)
- [🔒 Security & Architecture](#-security--architecture)
- [⚙️ Environment Configuration](#️-environment-configuration)

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
│   ├── db.js                    ← SQLite schema migration (v1→v6) & prepared statements
│   └── attendance.db            ← Shared SQLite database
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

### 2. Start Backends

Run the cross-platform launcher, which frees ports, auto-builds the Java JAR if needed, starts Node.js & Java Spring Boot, verifies endpoints, and streams logs:

#### Using npm:
```bash
npm run start:all
```

#### Or directly via Python:
- **Ubuntu / Linux / macOS**:
  ```bash
  python3 start_all.py
  ```
- **Windows (CMD / PowerShell)**:
  ```cmd
  python start_all.py
  ```

Once started:
- **Web App / Node.js API**: [`http://localhost:3000`](http://localhost:3000)
- **Java Spring Boot API**: [`http://localhost:3001`](http://localhost:3001)
- **Default Credentials**: Username `admin` | Password `admin123`

> 💡 *Press `Ctrl+C` in the terminal to gracefully stop all running backends.*

---

### 3. Run Endpoint Tests

You can test all REST endpoints against the running backends at any time from another terminal:

#### Using npm:
```bash
npm test              # Tests both Node.js and Java backends
npm run test:node     # Tests only Node.js (port 3000)
npm run test:java     # Tests only Java Spring Boot (port 3001)
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

## 🗄️ Database Schema (v6)

The SQLite database (`database/attendance.db`) employs hardened relations and automated indexing:

```sql
-- Application users and administrative accounts
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'USER',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Revocable JWT Refresh Tokens
CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Employee records with encrypted PII columns
CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  role TEXT NOT NULL,
  descriptor TEXT NOT NULL,           -- JSON 128-element float array
  image TEXT,                        -- Base64 compressed image
  email_encrypted TEXT,              -- AES-256-GCM ciphertext
  phone_encrypted TEXT,              -- AES-256-GCM ciphertext
  aadhaar_encrypted TEXT,            -- AES-256-GCM ciphertext
  pan_encrypted TEXT,                -- AES-256-GCM ciphertext
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Attendance event history
CREATE TABLE attendance (
  att_id INTEGER PRIMARY KEY AUTOINCREMENT,
  emp_id TEXT NOT NULL,
  name TEXT NOT NULL,
  dept TEXT NOT NULL,
  role TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  verified_by TEXT DEFAULT 'FACE_RECOGNITION',
  FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Immutable audit logs
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  target_id TEXT,
  details TEXT,
  ip_address TEXT,
  timestamp TEXT NOT NULL
);
```

---

## 🔒 Security & Architecture

1. **AES-256-GCM Encryption**: High-security PII fields (Aadhaar, PAN, phone, email) are encrypted at rest with authenticated encryption (128-bit authentication tag) preventing tampering and data leakage.
2. **JWT with Auto-Refresh**: Tokens are signed with HMAC-SHA256. Access tokens expire in 15 minutes; refresh tokens are stored hashed in SQLite and rotated upon use.
3. **Defense-in-Depth Protection**:
   - HTTP response hardening via Helmet (HSTS, Content Security Policy, X-Content-Type-Options).
   - Strict CORS origin allowlisting.
   - Brute-force throttling on login endpoints.
4. **Resilient Port & Process Lifecycle**: `start_all.py` and `stop_all.py` manage process cleanup across Windows and Unix without leaving orphaned background services.

---

## ⚙️ Environment Configuration

Configuration variables can be customized in `.env`:

| Parameter | Default | Purpose |
|---|---|---|
| `PORT` / `NODE_PORT` | `3000` | Port for Node.js Express server |
| `JAVA_PORT` | `3001` | Port for Java Spring Boot server |
| `NODE_ENV` | `development` | Environment mode (`development` / `production`) |
| `JWT_ACCESS_SECRET` | `(32-byte hex)` | Secret key for signing Access Tokens |
| `JWT_REFRESH_SECRET`| `(32-byte hex)` | Secret key for signing Refresh Tokens |
| `PII_ENCRYPTION_KEY`| `(32-byte hex)` | 256-bit AES key for PII column encryption |
| `JWT_ACCESS_EXPIRY` | `15m` | Lifetime of access tokens |
| `JWT_REFRESH_EXPIRY`| `7d` | Lifetime of refresh tokens |
| `CORS_WHITELIST` | `http://localhost:3000,http://localhost:5173` | Allowed origin domains |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limiter window in milliseconds (1 min) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max general requests allowed per window |
| `RATE_LIMIT_AUTH_MAX` | `10` | Max login attempts allowed per window |
| `ADMIN_USERNAME` | `admin` | Default administrator username |
| `ADMIN_PASSWORD` | `admin123` | Default administrator password |

---

## 👥 Authors & License

- **Soukhya Tech** — Enterprise Attendance & Biometrics System
- Licensed under the [MIT License](LICENSE).
