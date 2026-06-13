// database/db.js
// SQLite database setup using better-sqlite3 with Hibernate Mode columns

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure the database directory exists
const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.join(dbDir, 'attendance.db'), {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
});

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ──────────────────────────────────────────────
// Schema Creation
// ──────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    department            TEXT NOT NULL,
    role                  TEXT NOT NULL,
    descriptor            TEXT NOT NULL,   -- JSON array of 128 floats
    image                 TEXT,            -- base64 JPEG data URL
    created_at            TEXT NOT NULL DEFAULT (datetime('now')),
    status                TEXT DEFAULT 'Active',
    hibernate_start_date  TEXT,
    hibernate_end_date    TEXT,
    hibernate_reason      TEXT
  );

  CREATE TABLE IF NOT EXISTS attendance (
    att_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id    TEXT NOT NULL,
    name      TEXT NOT NULL,
    dept      TEXT NOT NULL,
    role      TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    status    TEXT NOT NULL CHECK(status IN ('Present','Late')),
    FOREIGN KEY(emp_id) REFERENCES employees(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_att_emp   ON attendance(emp_id);
  CREATE INDEX IF NOT EXISTS idx_att_ts    ON attendance(timestamp);
`);

// ──────────────────────────────────────────────
// DB Migrations: Safely add new columns to existing schema
// ──────────────────────────────────────────────
try {
  db.exec("ALTER TABLE employees ADD COLUMN status TEXT DEFAULT 'Active'");
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec("ALTER TABLE employees ADD COLUMN hibernate_start_date TEXT");
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec("ALTER TABLE employees ADD COLUMN hibernate_end_date TEXT");
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec("ALTER TABLE employees ADD COLUMN hibernate_reason TEXT");
} catch (e) {
  // Column already exists, ignore
}

// ──────────────────────────────────────────────
// Prepared statements
// ──────────────────────────────────────────────
const stmts = {
  // Employees
  getAllEmployees:   db.prepare('SELECT * FROM employees ORDER BY created_at DESC'),
  getEmployee:      db.prepare('SELECT * FROM employees WHERE id = ?'),
  insertEmployee:   db.prepare(`
    INSERT INTO employees (
      id, name, department, role, descriptor, image, status, 
      hibernate_start_date, hibernate_end_date, hibernate_reason
    )
    VALUES (
      @id, @name, @department, @role, @descriptor, @image, @status, 
      @hibernate_start_date, @hibernate_end_date, @hibernate_reason
    )
  `),
  deleteEmployee:   db.prepare('DELETE FROM employees WHERE id = ?'),
  updateEmployee:   db.prepare(`
    UPDATE employees SET 
      name=@name, 
      department=@department, 
      role=@role,
      descriptor=@descriptor, 
      image=@image, 
      status=@status,
      hibernate_start_date=@hibernate_start_date, 
      hibernate_end_date=@hibernate_end_date,
      hibernate_reason=@hibernate_reason
    WHERE id = @id
  `),

  // Attendance
  getAllAttendance:  db.prepare('SELECT * FROM attendance ORDER BY timestamp DESC'),
  getAttByDate:     db.prepare("SELECT * FROM attendance WHERE date(timestamp)=date(?) ORDER BY timestamp DESC"),
  getAttByEmp:      db.prepare('SELECT * FROM attendance WHERE emp_id=? ORDER BY timestamp DESC'),
  insertAtt:        db.prepare(`
    INSERT INTO attendance (emp_id, name, dept, role, timestamp, status)
    VALUES (@emp_id, @name, @dept, @role, @timestamp, @status)
  `),
  checkDuplicate:   db.prepare(`
    SELECT att_id FROM attendance
    WHERE emp_id=? AND date(timestamp)=date('now','localtime')
    LIMIT 1
  `),
  deleteAtt:        db.prepare('DELETE FROM attendance WHERE att_id = ?'),
  statsToday: db.prepare(`
    SELECT
      COUNT(DISTINCT emp_id)              AS present_today,
      SUM(CASE WHEN status='Late' THEN 1 ELSE 0 END) AS late_today
    FROM attendance
    WHERE date(timestamp) = date('now','localtime')
  `),
  totalEmployees:   db.prepare('SELECT COUNT(*) AS total FROM employees'),
  totalRecords:     db.prepare('SELECT COUNT(*) AS total FROM attendance'),
  
  // Roster status analytics
  statusCounts: db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'Hibernate' THEN 1 ELSE 0 END) as hibernate,
      SUM(CASE WHEN status = 'On Leave' THEN 1 ELSE 0 END) as on_leave,
      SUM(CASE WHEN status = 'Resigned' THEN 1 ELSE 0 END) as resigned
    FROM employees
  `),
  
  // Department-wise Hibernate counts
  deptHibernateCounts: db.prepare(`
    SELECT department, COUNT(*) as count 
    FROM employees 
    WHERE status = 'Hibernate' 
    GROUP BY department
  `),

  // Monthly Hibernate trend (using substr for YYYY-MM extraction from start date)
  monthlyHibernateTrend: db.prepare(`
    SELECT 
      substr(hibernate_start_date, 1, 7) as month, 
      COUNT(*) as count 
    FROM employees 
    WHERE status = 'Hibernate' AND hibernate_start_date IS NOT NULL AND hibernate_start_date != ''
    GROUP BY month 
    ORDER BY month ASC
  `)
};

module.exports = { db, stmts };
