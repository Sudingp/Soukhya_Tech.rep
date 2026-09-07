// database/db.js — Hardened SQLite layer with migrations, audit trail, and optimized indexes

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// ──────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'attendance.db');
const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

// ──────────────────────────────────────────────
// Connection
// ──────────────────────────────────────────────
const db = new Database(DB_PATH, {
  verbose: isDev ? console.log : undefined
});

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 268435456'); // 256MB mmap for read perf

// ──────────────────────────────────────────────
// Migration System (replaces blind ALTER TABLE)
// ──────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS _schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

function getSchemaVersion() {
  const row = db.prepare("SELECT MAX(version) as v FROM _schema_version").get();
  return row?.v || 0;
}

function setSchemaVersion(v) {
  db.prepare("INSERT INTO _schema_version(version) VALUES (?)").run(v);
}

const currentVersion = getSchemaVersion();

// ── Migration 1: Base Schema ──
if (currentVersion < 1) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'EMPLOYEE' CHECK(role IN ('ADMIN','HR','EMPLOYEE','DEVICE')),
      active BOOLEAN NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      created_at TIMESTAMP NOT NULL DEFAULT (datetime('now')),
      updated_at TIMESTAMP NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      role TEXT NOT NULL,
      descriptor TEXT NOT NULL,
      descriptor_hash TEXT NOT NULL,
      image TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT (datetime('now')),
      updated_at TIMESTAMP NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Hibernate','On Leave','Resigned')),
      hibernate_start_date TEXT,
      hibernate_end_date TEXT,
      hibernate_reason TEXT,
      company TEXT,
      designation TEXT,
      gender TEXT,
      date_of_joining TEXT,
      date_of_confirmation TEXT,
      last_working_day TEXT,
      aadhaar_number TEXT,
      pan_number TEXT,
      card_number TEXT,
      phone_no TEXT,
      email TEXT,
      reporting_to TEXT,
      device_code TEXT,
      sub_department TEXT,
      division TEXT,
      grade TEXT,
      team TEXT,
      location TEXT,
      employment_type TEXT,
      category TEXT,
      holiday_group TEXT,
      shift_group TEXT,
      shift_roster TEXT,
      geofence TEXT,
      device_expiry_rule_applicable INTEGER,
      verification_type TEXT,
      expiry_start_date TEXT,
      expiry_end_date TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance (
      att_id INTEGER PRIMARY KEY AUTOINCREMENT,
      emp_id TEXT NOT NULL,
      name TEXT NOT NULL,
      dept TEXT NOT NULL,
      role TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Present','Late')),
      logged_by TEXT,
      ip_address TEXT,
      user_agent TEXT,
      FOREIGN KEY(emp_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      log_id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('INSERT','UPDATE','DELETE','LOGIN','LOGOUT','RESET_SEED')),
      old_values TEXT,
      new_values TEXT,
      performed_by TEXT NOT NULL,
      performed_at TIMESTAMP NOT NULL DEFAULT (datetime('now')),
      ip_address TEXT,
      user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS token_blacklist (
      token_hash TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );
  `);
  setSchemaVersion(1);
}

// ── Migration 2: Optimized Indexes ──
if (currentVersion < 2) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_att_emp_ts ON attendance(emp_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_att_ts ON attendance(timestamp);
    CREATE INDEX IF NOT EXISTS idx_emp_status_dept ON employees(status, department);
    CREATE INDEX IF NOT EXISTS idx_emp_company ON employees(company);
    CREATE INDEX IF NOT EXISTS idx_audit_performed_at ON audit_log(performed_at);
    CREATE INDEX IF NOT EXISTS idx_blacklist_expires ON token_blacklist(expires_at);
  `);
  setSchemaVersion(2);
}

// ── Migration 3: Cleanup old blind-migration columns if they exist from v1 ──
if (currentVersion < 3) {
  // Columns already created in v1 base schema; this migration is reserved
  // for future schema additions without dropping data.
  setSchemaVersion(3);
}

// ── Migration 4: Align audit_log timestamp type with JPA/Hibernate schema validation ──
if (currentVersion < 4) {
  const tableInfo = db.prepare("PRAGMA table_info('audit_log')").all();
  const performedAtColumn = tableInfo.find((col) => col.name === 'performed_at');
  if (performedAtColumn && performedAtColumn.type.toUpperCase() !== 'TIMESTAMP') {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE audit_log_new (
          log_id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_name TEXT NOT NULL,
          record_id TEXT NOT NULL,
          action TEXT NOT NULL CHECK(action IN ('INSERT','UPDATE','DELETE','LOGIN','LOGOUT','RESET_SEED')),
          old_values TEXT,
          new_values TEXT,
          performed_by TEXT NOT NULL,
          performed_at TIMESTAMP NOT NULL DEFAULT (datetime('now')),
          ip_address TEXT,
          user_agent TEXT
        );
      `);
      db.exec(`
        INSERT INTO audit_log_new (
          log_id, table_name, record_id, action, old_values, new_values,
          performed_by, performed_at, ip_address, user_agent
        )
        SELECT log_id, table_name, record_id, action, old_values, new_values,
               performed_by, performed_at, ip_address, user_agent
        FROM audit_log;
      `);
      db.exec('DROP TABLE audit_log;');
      db.exec('ALTER TABLE audit_log_new RENAME TO audit_log;');
      db.exec('CREATE INDEX IF NOT EXISTS idx_audit_performed_at ON audit_log(performed_at);');
    })();
  }
  setSchemaVersion(4);
}

// ── Migration 5: Align users and employees timestamp columns with JPA/Hibernate schema validation ──
if (currentVersion < 5) {
  const formatDefaultValue = (dflt_value) => {
    if (!dflt_value) return '';
    const trimmed = dflt_value.trim();
    if (/^\(.*\)$/.test(trimmed)) {
      return ` DEFAULT ${trimmed}`;
    }
    if (/^[0-9]+$/.test(trimmed) || /^'.*'$/.test(trimmed) || /^".*"$/.test(trimmed)) {
      return ` DEFAULT ${trimmed}`;
    }
    return ` DEFAULT (${trimmed})`;
  };

  const alignTable = (tableName, columns) => {
    const raw = db.prepare(`PRAGMA table_info('${tableName}')`).all();
    const needsRecreate = raw.some(col => columns.includes(col.name) && col.type.toUpperCase() !== 'TIMESTAMP');
    if (!needsRecreate) return;

    const columnDefs = raw.map(col => {
      if (columns.includes(col.name)) {
        return `${col.name} TIMESTAMP${col.notnull ? ' NOT NULL' : ''}${formatDefaultValue(col.dflt_value)}`;
      }
      return `${col.name} ${col.type}${col.notnull ? ' NOT NULL' : ''}${formatDefaultValue(col.dflt_value)}`;
    }).join(',\n      ');

    const columnNames = raw.map(col => col.name).join(', ');
    db.transaction(() => {
      db.exec(`CREATE TABLE ${tableName}_new (${columnDefs});`);
      db.exec(`INSERT INTO ${tableName}_new (${columnNames}) SELECT ${columnNames} FROM ${tableName};`);
      db.exec(`DROP TABLE ${tableName};`);
      db.exec(`ALTER TABLE ${tableName}_new RENAME TO ${tableName};`);
    })();
  };

  alignTable('users', ['created_at', 'updated_at']);
  alignTable('employees', ['created_at', 'updated_at']);
  setSchemaVersion(5);
}

// ── Migration 6: Align users.active column type with Hibernate Boolean mapping ──
if (currentVersion < 6) {
  const tableName = 'users';
  const raw = db.prepare(`PRAGMA table_info('${tableName}')`).all();
  const activeColumn = raw.find((col) => col.name === 'active');

  if (activeColumn && activeColumn.type.toUpperCase() !== 'BOOLEAN') {
      const formatDefaultValue = (dflt_value) => {
        if (!dflt_value) return '';
        const trimmed = dflt_value.trim();
        if (/^\(.*\)$/.test(trimmed)) {
          return ` DEFAULT ${trimmed}`;
        }
        if (/^[0-9]+$/.test(trimmed) || /^'.*'$/.test(trimmed) || /^".*"$/.test(trimmed)) {
          return ` DEFAULT ${trimmed}`;
        }
        return ` DEFAULT (${trimmed})`;
      };

      const columnDefs = raw.map(col => {
        if (col.name === 'active') {
          return `${col.name} BOOLEAN${col.notnull ? ' NOT NULL' : ''}${formatDefaultValue(col.dflt_value)}`;
        }
        return `${col.name} ${col.type}${col.notnull ? ' NOT NULL' : ''}${formatDefaultValue(col.dflt_value)}`;
      }).join(',\n      ');

      const columnNames = raw.map(col => col.name).join(', ');
      db.transaction(() => {
        db.exec(`CREATE TABLE ${tableName}_new (${columnDefs});`);
        db.exec(`INSERT INTO ${tableName}_new (${columnNames}) SELECT ${columnNames} FROM ${tableName};`);
        db.exec(`DROP TABLE ${tableName};`);
        db.exec(`ALTER TABLE ${tableName}_new RENAME TO ${tableName};`);
      })();
  }

  setSchemaVersion(6);
}

console.log(`[DB] SQLite ready at ${DB_PATH} | Schema v${getSchemaVersion()}`);

// ──────────────────────────────────────────────
// Prepared Statements
// ──────────────────────────────────────────────
const stmts = {
  // ── Users (Auth) ──
  getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ? AND active = 1'),
  insertUser: db.prepare(`
    INSERT INTO users (username, password_hash, role)
    VALUES (@username, @password_hash, @role)
  `),
  updateUserPassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),

  // ── Employees ──
  getAllEmployees: db.prepare('SELECT * FROM employees ORDER BY created_at DESC'),
  getEmployee: db.prepare('SELECT * FROM employees WHERE id = ?'),
  getEmployeeByStatus: db.prepare('SELECT * FROM employees WHERE status = ? ORDER BY created_at DESC'),
  insertEmployee: db.prepare(`
    INSERT INTO employees (
      id, name, department, role, descriptor, descriptor_hash, image, status,
      hibernate_start_date, hibernate_end_date, hibernate_reason,
      company, designation, gender, date_of_joining, date_of_confirmation, last_working_day,
      aadhaar_number, pan_number, card_number, phone_no, email, reporting_to,
      device_code, sub_department, division, grade, team, location,
      employment_type, category, holiday_group, shift_group, shift_roster,
      geofence, device_expiry_rule_applicable, verification_type,
      expiry_start_date, expiry_end_date, updated_by
    ) VALUES (
      @id, @name, @department, @role, @descriptor, @descriptor_hash, @image, @status,
      @hibernate_start_date, @hibernate_end_date, @hibernate_reason,
      @company, @designation, @gender, @date_of_joining, @date_of_confirmation, @last_working_day,
      @aadhaar_number, @pan_number, @card_number, @phone_no, @email, @reporting_to,
      @device_code, @sub_department, @division, @grade, @team, @location,
      @employment_type, @category, @holiday_group, @shift_group, @shift_roster,
      @geofence, @device_expiry_rule_applicable, @verification_type,
      @expiry_start_date, @expiry_end_date, @updated_by
    )
  `),
  deleteEmployee: db.prepare('DELETE FROM employees WHERE id = ?'),
  updateEmployee: db.prepare(`
    UPDATE employees SET
      name = @name, department = @department, role = @role,
      descriptor = @descriptor, descriptor_hash = @descriptor_hash, image = @image,
      status = @status, version = version + 1, updated_at = datetime('now'), updated_by = @updated_by,
      hibernate_start_date = @hibernate_start_date, hibernate_end_date = @hibernate_end_date,
      hibernate_reason = @hibernate_reason,
      company = @company, designation = @designation, gender = @gender,
      date_of_joining = @date_of_joining, date_of_confirmation = @date_of_confirmation,
      last_working_day = @last_working_day,
      aadhaar_number = @aadhaar_number, pan_number = @pan_number,
      card_number = @card_number, phone_no = @phone_no, email = @email, reporting_to = @reporting_to,
      device_code = @device_code, sub_department = @sub_department, division = @division,
      grade = @grade, team = @team, location = @location,
      employment_type = @employment_type, category = @category,
      holiday_group = @holiday_group, shift_group = @shift_group, shift_roster = @shift_roster,
      geofence = @geofence, device_expiry_rule_applicable = @device_expiry_rule_applicable,
      verification_type = @verification_type,
      expiry_start_date = @expiry_start_date, expiry_end_date = @expiry_end_date
    WHERE id = @id AND version = @version
  `),
  updateEmployeeNoVersionCheck: db.prepare(`
    UPDATE employees SET
      name = @name, department = @department, role = @role,
      descriptor = @descriptor, descriptor_hash = @descriptor_hash, image = @image,
      status = @status, version = version + 1, updated_at = datetime('now'), updated_by = @updated_by,
      hibernate_start_date = @hibernate_start_date, hibernate_end_date = @hibernate_end_date,
      hibernate_reason = @hibernate_reason,
      company = @company, designation = @designation, gender = @gender,
      date_of_joining = @date_of_joining, date_of_confirmation = @date_of_confirmation,
      last_working_day = @last_working_day,
      aadhaar_number = @aadhaar_number, pan_number = @pan_number,
      card_number = @card_number, phone_no = @phone_no, email = @email, reporting_to = @reporting_to,
      device_code = @device_code, sub_department = @sub_department, division = @division,
      grade = @grade, team = @team, location = @location,
      employment_type = @employment_type, category = @category,
      holiday_group = @holiday_group, shift_group = @shift_group, shift_roster = @shift_roster,
      geofence = @geofence, device_expiry_rule_applicable = @device_expiry_rule_applicable,
      verification_type = @verification_type,
      expiry_start_date = @expiry_start_date, expiry_end_date = @expiry_end_date
    WHERE id = @id
  `),

  // ── Attendance ──
  getAllAttendance: db.prepare('SELECT * FROM attendance ORDER BY timestamp DESC LIMIT ? OFFSET ?'),
  getAttByDateRange: db.prepare(`
    SELECT * FROM attendance
    WHERE timestamp >= ? AND timestamp < ?
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `),
  getAttByEmp: db.prepare('SELECT * FROM attendance WHERE emp_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?'),
  insertAtt: db.prepare(`
    INSERT INTO attendance (
      emp_id, name, dept, role, timestamp, status, logged_by, ip_address, user_agent
    ) VALUES (
      @emp_id, @name, @dept, @role, @timestamp, @status, @logged_by, @ip_address, @user_agent
    )
  `),
  checkDuplicate: db.prepare(`
    SELECT att_id FROM attendance
    WHERE emp_id = ? AND timestamp >= date('now','localtime') AND timestamp < datetime('now','localtime','+1 day')
    LIMIT 1
  `),
  deleteAtt: db.prepare('DELETE FROM attendance WHERE att_id = ?'),

  // ── Stats ──
  statsToday: db.prepare(`
    SELECT
      COUNT(DISTINCT emp_id) AS present_today,
      COALESCE(SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END), 0) AS late_today
    FROM attendance
    WHERE timestamp >= date('now','localtime') AND timestamp < datetime('now','localtime','+1 day')
  `),
  totalEmployees: db.prepare('SELECT COUNT(*) AS total FROM employees'),
  totalRecords: db.prepare('SELECT COUNT(*) AS total FROM attendance'),
  statusCounts: db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'Hibernate' THEN 1 ELSE 0 END) as hibernate,
      SUM(CASE WHEN status = 'On Leave' THEN 1 ELSE 0 END) as on_leave,
      SUM(CASE WHEN status = 'Resigned' THEN 1 ELSE 0 END) as resigned
    FROM employees
  `),
  deptHibernateCounts: db.prepare(`
    SELECT department, COUNT(*) as count
    FROM employees
    WHERE status = 'Hibernate'
    GROUP BY department
  `),
  monthlyHibernateTrend: db.prepare(`
    SELECT
      substr(hibernate_start_date, 1, 7) as month,
      COUNT(*) as count
    FROM employees
    WHERE status = 'Hibernate' AND hibernate_start_date IS NOT NULL AND hibernate_start_date != ''
    GROUP BY month
    ORDER BY month ASC
  `),

  // ── Audit ──
  insertAudit: db.prepare(`
    INSERT INTO audit_log (
      table_name, record_id, action, old_values, new_values,
      performed_by, ip_address, user_agent
    ) VALUES (
      @table_name, @record_id, @action, @old_values, @new_values,
      @performed_by, @ip_address, @user_agent
    )
  `),

  // ── Token Blacklist ──
  blacklistToken: db.prepare('INSERT OR IGNORE INTO token_blacklist (token_hash, expires_at) VALUES (?, ?)'),
  isTokenBlacklisted: db.prepare('SELECT 1 FROM token_blacklist WHERE token_hash = ?'),
  purgeExpiredTokens: db.prepare('DELETE FROM token_blacklist WHERE expires_at < ?'),

  // ── Seeder Guard ──
  totalEmployeesCount: db.prepare('SELECT COUNT(*) as total FROM employees')
};

module.exports = { db, stmts };