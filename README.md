# Soukhya Tech — Face Recognition Attendance System

A full-stack face recognition attendance system with:
- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript (face-api.js)
- **Backend**: Node.js + Express REST API
- **Database**: SQLite (via better-sqlite3)

---

## 📁 Project Structure

```
soukhya-tech/
├── server.js              ← Express REST API server
├── package.json
├── database/
│   └── db.js              ← SQLite schema + prepared statements
│   └── attendance.db      ← auto-created on first run
└── public/
    ├── index.html         ← App shell (tabs, layout)
    ├── style.css          ← All styles
    └── app.js             ← Face recognition + API calls
```

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
cd soukhya-tech
npm install
```

### 2. Start the server
```bash
npm start
# or for live reload during development:
npm run dev
```

### 3. Open the app
Visit `http://localhost:3000` in your browser.

> ⚠️ **HTTPS / Camera**: Chrome requires HTTPS (or `localhost`) for camera access.
> The default `localhost:3000` setup works fine.

---

## 🔌 REST API Reference

### Employees

| Method | Endpoint              | Description               |
|--------|-----------------------|---------------------------|
| GET    | `/api/employees`      | List all employees        |
| GET    | `/api/employees/:id`  | Get single employee       |
| POST   | `/api/employees`      | Register new employee     |
| PUT    | `/api/employees/:id`  | Update employee info      |
| DELETE | `/api/employees/:id`  | Delete employee + records |

**POST /api/employees body:**
```json
{
  "id":         "EMP001",
  "name":       "Jane Smith",
  "department": "Engineering",
  "role":       "Software Engineer",
  "descriptor": [0.12, -0.34, ...],   // 128-element float array
  "image":      "data:image/jpeg;base64,..."
}
```

### Attendance

| Method | Endpoint                    | Description             |
|--------|-----------------------------|-------------------------|
| GET    | `/api/attendance`           | All records             |
| GET    | `/api/attendance?date=YYYY-MM-DD` | Filter by date    |
| GET    | `/api/attendance?emp_id=X`  | Filter by employee      |
| POST   | `/api/attendance`           | Log attendance          |
| DELETE | `/api/attendance/:att_id`   | Delete a record         |

**POST /api/attendance body:**
```json
{
  "emp_id":    "EMP001",
  "name":      "Jane Smith",
  "dept":      "Engineering",
  "role":      "Software Engineer",
  "timestamp": "2024-01-15T08:45:00.000Z",
  "status":    "Present"
}
```

### Stats

| Method | Endpoint     | Description            |
|--------|--------------|------------------------|
| GET    | `/api/stats` | Dashboard summary data |

---

## 🧠 How It Works

1. **Registration**: The browser uses `face-api.js` (TinyFaceDetector + ResNet) to extract a 128-dimensional face descriptor from the webcam. This descriptor and employee info are sent to the Node.js API and stored in SQLite.

2. **Attendance**: The recognition loop compares live webcam face descriptors against all stored descriptors using cosine distance (threshold: 0.55). A match triggers a POST to `/api/attendance`, which checks for duplicates before inserting.

3. **HR Dashboard**: Stats and filterable records are pulled from SQLite and rendered in real time.

---

## 🗄️ Database Schema

```sql
employees (
  id TEXT PRIMARY KEY,
  name TEXT,
  department TEXT,
  role TEXT,
  descriptor TEXT,    -- JSON array of 128 floats
  image TEXT,         -- base64 JPEG
  created_at TEXT
)

attendance (
  att_id INTEGER PRIMARY KEY AUTOINCREMENT,
  emp_id TEXT → employees(id),
  name TEXT, dept TEXT, role TEXT,
  timestamp TEXT,
  status TEXT ('Present' | 'Late')
)
```

---

## ⚙️ Environment Variables

| Variable | Default | Description          |
|----------|---------|----------------------|
| `PORT`   | `3000`  | Server port          |
