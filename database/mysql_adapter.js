// database/mysql_adapter.js — Production MySQL 8.4 LTS Driver & Connection Pool
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

class MySQLAdapter {
  constructor(config = {}) {
    const defaultSock = path.resolve(__dirname, '..', 'data', 'mysql', 'mysql.sock');
    const socketPath = config.socketPath || process.env.MYSQL_SOCKET || (fs.existsSync(defaultSock) ? defaultSock : null);

    this.config = {
      ...(socketPath ? { socketPath } : {
        host: config.host || process.env.MYSQL_HOST || '127.0.0.1',
        port: parseInt(config.port || process.env.MYSQL_PORT || 3306, 10),
      }),
      user: config.user || process.env.MYSQL_USER || 'root',
      password: config.password !== undefined ? config.password : (process.env.MYSQL_PASSWORD || ''),
      database: config.database || process.env.MYSQL_DATABASE || 'soukhya_attendance',
      connectionLimit: parseInt(config.connectionLimit || process.env.MYSQL_CONNECTION_LIMIT || 20, 10),
      waitForConnections: true,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      charset: 'utf8mb4',
      dateStrings: true,
      namedPlaceholders: true
    };
    this.pool = null;
    this.initialized = false;
  }

  async getPool() {
    if (!this.pool) {
      this.pool = mysql.createPool(this.config);
    }
    return this.pool;
  }

  async testConnection() {
    try {
      const p = await this.getPool();
      const [rows] = await p.query('SELECT 1 as alive, VERSION() as version');
      return { ok: true, version: rows[0]?.version || 'Unknown' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async initSchema() {
    if (this.initialized) return;
    const pool = await this.getPool();
    const schemaPath = path.join(__dirname, 'schema_mysql.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      const cleanSql = sql
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n');

      const statements = cleanSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.toUpperCase().startsWith('USE '));

      for (const statement of statements) {
        try {
          await pool.query(statement);
        } catch (e) {
          // Ignore table exists or safe warnings
          if (!e.message.includes('already exists') && !e.message.includes('Duplicate')) {
            console.warn('[MYSQL SCHEMA WARN]', e.message);
          }
        }
      }
    }
    this.initialized = true;
  }

  // ──────────────────────────────────────────────
  // Users (Auth & Governance)
  // ──────────────────────────────────────────────
  async getUserByUsername(username) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM users WHERE username = ? AND active = 1', [username]);
    return rows[0] || null;
  }

  async getUserByUsernameHash(uHash) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM users WHERE username_hash = ? AND active = 1', [uHash]);
    return rows[0] || null;
  }

  async getUserById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(
      'SELECT id, username, username_display, role, active, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  async getAllUsers() {
    const pool = await this.getPool();
    const [rows] = await pool.execute(
      'SELECT id, username, username_display, role, active, created_at, updated_at FROM users ORDER BY id ASC'
    );
    return rows;
  }

  async insertUser({ username, username_hash, username_display, password_hash, role }) {
    const pool = await this.getPool();
    const [result] = await pool.execute(
      `INSERT INTO users (username, username_hash, username_display, password_hash, role)
       VALUES (?, ?, ?, ?, ?)`,
      [username, username_hash, username_display || username, password_hash, role || 'USER']
    );
    return { lastInsertRowid: result.insertId, changes: result.affectedRows };
  }

  async updateUserPassword(password_hash, id) {
    const pool = await this.getPool();
    const [result] = await pool.execute(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [password_hash, id]
    );
    return { changes: result.affectedRows };
  }

  async deleteUser(id) {
    const pool = await this.getPool();
    const [result] = await pool.execute(
      "DELETE FROM users WHERE id = ? AND role != 'ADMIN'",
      [id]
    );
    return { changes: result.affectedRows };
  }

  // ──────────────────────────────────────────────
  // Employees
  // ──────────────────────────────────────────────
  async getAllEmployees() {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM employees ORDER BY created_at DESC');
    return rows.map(this._normalizeEmployee);
  }

  async getEmployee(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM employees WHERE id = ?', [id]);
    return rows[0] ? this._normalizeEmployee(rows[0]) : null;
  }

  async getEmployeeByStatus(status) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM employees WHERE status = ? ORDER BY created_at DESC', [status]);
    return rows.map(this._normalizeEmployee);
  }

  async insertEmployee(emp) {
    const pool = await this.getPool();
    const descriptorStr = typeof emp.descriptor === 'string' ? emp.descriptor : JSON.stringify(emp.descriptor || []);
    const sql = `
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
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `;
    const params = [
      emp.id, emp.name, emp.department, emp.role, descriptorStr, emp.descriptor_hash, emp.image || null, emp.status || 'Active',
      emp.hibernate_start_date || null, emp.hibernate_end_date || null, emp.hibernate_reason || null,
      emp.company || null, emp.designation || null, emp.gender || null, emp.date_of_joining || null, emp.date_of_confirmation || null, emp.last_working_day || null,
      emp.aadhaar_number || null, emp.pan_number || null, emp.card_number || null, emp.phone_no || null, emp.email || null, emp.reporting_to || null,
      emp.device_code || null, emp.sub_department || null, emp.division || null, emp.grade || null, emp.team || null, emp.location || null,
      emp.employment_type || null, emp.category || null, emp.holiday_group || null, emp.shift_group || null, emp.shift_roster || null,
      emp.geofence || null, emp.device_expiry_rule_applicable ? 1 : 0, emp.verification_type || null,
      emp.expiry_start_date || null, emp.expiry_end_date || null, emp.updated_by || null
    ];
    const [result] = await pool.execute(sql, params);
    return { changes: result.affectedRows };
  }

  async updateEmployee(emp) {
    const pool = await this.getPool();
    const sql = `
      UPDATE employees SET
        name = ?, department = ?, role = ?, status = ?,
        hibernate_start_date = ?, hibernate_end_date = ?, hibernate_reason = ?,
        company = ?, designation = ?, gender = ?, date_of_joining = ?, date_of_confirmation = ?, last_working_day = ?,
        aadhaar_number = ?, pan_number = ?, card_number = ?, phone_no = ?, email = ?, reporting_to = ?,
        device_code = ?, sub_department = ?, division = ?, grade = ?, team = ?, location = ?,
        employment_type = ?, category = ?, holiday_group = ?, shift_group = ?, shift_roster = ?,
        geofence = ?, device_expiry_rule_applicable = ?, verification_type = ?,
        expiry_start_date = ?, expiry_end_date = ?, updated_by = ?,
        version = version + 1, updated_at = NOW()
      WHERE id = ?
    `;
    const params = [
      emp.name, emp.department, emp.role, emp.status || 'Active',
      emp.hibernate_start_date || null, emp.hibernate_end_date || null, emp.hibernate_reason || null,
      emp.company || null, emp.designation || null, emp.gender || null, emp.date_of_joining || null, emp.date_of_confirmation || null, emp.last_working_day || null,
      emp.aadhaar_number || null, emp.pan_number || null, emp.card_number || null, emp.phone_no || null, emp.email || null, emp.reporting_to || null,
      emp.device_code || null, emp.sub_department || null, emp.division || null, emp.grade || null, emp.team || null, emp.location || null,
      emp.employment_type || null, emp.category || null, emp.holiday_group || null, emp.shift_group || null, emp.shift_roster || null,
      emp.geofence || null, emp.device_expiry_rule_applicable ? 1 : 0, emp.verification_type || null,
      emp.expiry_start_date || null, emp.expiry_end_date || null, emp.updated_by || null,
      emp.id
    ];
    const [result] = await pool.execute(sql, params);
    return { changes: result.affectedRows };
  }

  async deleteEmployee(id) {
    const pool = await this.getPool();
    const [result] = await pool.execute('DELETE FROM employees WHERE id = ?', [id]);
    return { changes: result.affectedRows };
  }

  async employeeCount() {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT COUNT(*) as total FROM employees');
    return rows[0];
  }

  async totalEmployeesCount() {
    return this.employeeCount();
  }

  // ──────────────────────────────────────────────
  // Attendance
  // ──────────────────────────────────────────────
  async getAttendance(limit = 100) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM attendance ORDER BY timestamp DESC LIMIT ?', [String(limit)]);
    return rows;
  }

  async getAllAttendance(size = 20, offset = 0) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM attendance ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [String(size), String(offset)]
    );
    return rows;
  }

  async getAttByDateRange(start, end, size = 20, offset = 0) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM attendance WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [start, end, String(size), String(offset)]
    );
    return rows;
  }

  async getAttByEmp(empId, size = 20, offset = 0) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM attendance WHERE emp_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [empId, String(size), String(offset)]
    );
    return rows;
  }

  async insertAtt({ emp_id, name, dept, role, timestamp, status, logged_by, ip_address, user_agent }) {
    const pool = await this.getPool();
    const formattedTs = this._formatDatetime(timestamp);
    const [result] = await pool.execute(
      `INSERT INTO attendance (emp_id, name, dept, role, timestamp, status, logged_by, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [emp_id, name, dept, role, formattedTs, status || 'Present', logged_by || null, ip_address || null, user_agent || null]
    );
    return { lastInsertRowid: result.insertId, changes: result.affectedRows };
  }

  async checkDuplicate(emp_id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(
      'SELECT att_id FROM attendance WHERE emp_id = ? AND timestamp >= CURDATE() AND timestamp < DATE_ADD(CURDATE(), INTERVAL 1 DAY) LIMIT 1',
      [emp_id]
    );
    return rows[0] || null;
  }

  async deleteAtt(att_id) {
    const pool = await this.getPool();
    const [result] = await pool.execute('DELETE FROM attendance WHERE att_id = ?', [att_id]);
    return { changes: result.affectedRows };
  }

  async insertAttendance(att) {
    return this.insertAtt(att);
  }

  async deleteAttendance(att_id) {
    return this.deleteAtt(att_id);
  }

  async todayPunch(emp_id, datePrefix) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM attendance WHERE emp_id = ? AND timestamp LIKE ? LIMIT 1',
      [emp_id, `${datePrefix}%`]
    );
    return rows[0] || null;
  }

  // ──────────────────────────────────────────────
  // Stats & Dashboard
  // ──────────────────────────────────────────────
  async statsToday() {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT
        COUNT(DISTINCT emp_id) AS present_today,
        COALESCE(SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END), 0) AS late_today
      FROM attendance
      WHERE timestamp >= CURDATE() AND timestamp < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
    `);
    return rows[0] || { present_today: 0, late_today: 0 };
  }

  async totalEmployees() {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT COUNT(*) AS total FROM employees');
    return rows[0] || { total: 0 };
  }

  async totalRecords() {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT COUNT(*) AS total FROM attendance');
    return rows[0] || { total: 0 };
  }

  async statusCounts() {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END), 0) as active,
        COALESCE(SUM(CASE WHEN status = 'Hibernate' THEN 1 ELSE 0 END), 0) as hibernate,
        COALESCE(SUM(CASE WHEN status = 'On Leave' THEN 1 ELSE 0 END), 0) as on_leave,
        COALESCE(SUM(CASE WHEN status = 'Resigned' THEN 1 ELSE 0 END), 0) as resigned
      FROM employees
    `);
    return rows[0] || { active: 0, hibernate: 0, on_leave: 0, resigned: 0 };
  }

  // ──────────────────────────────────────────────
  // Analytics & Reports
  // ──────────────────────────────────────────────
  async deptHibernateCounts() {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT department, COUNT(*) as count
      FROM employees
      WHERE status = 'Hibernate'
      GROUP BY department
    `);
    return rows;
  }

  async monthlyHibernateTrend() {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT
        SUBSTRING(hibernate_start_date, 1, 7) as month,
        COUNT(*) as count
      FROM employees
      WHERE status = 'Hibernate' AND hibernate_start_date IS NOT NULL AND hibernate_start_date != ''
      GROUP BY SUBSTRING(hibernate_start_date, 1, 7)
      ORDER BY month ASC
    `);
    return rows;
  }

  async monthlyDepartmentAttendance(dept, month) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT
        e.id, e.name, e.department, e.role,
        COUNT(a.att_id) as present_days,
        SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END) as late_days
      FROM employees e
      LEFT JOIN attendance a
        ON e.id = a.emp_id AND a.timestamp LIKE ?
      WHERE e.department = ?
      GROUP BY e.id, e.name, e.department, e.role
      ORDER BY e.name ASC
    `, [`${month}%`, dept]);
    return rows;
  }

  async employeeAttendanceSummary(month) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT
        e.id, e.name, e.department, e.role, e.status, e.company,
        COUNT(a.att_id) as total_present,
        SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END) as total_late
      FROM employees e
      LEFT JOIN attendance a
        ON e.id = a.emp_id AND a.timestamp LIKE ?
      GROUP BY e.id, e.name, e.department, e.role, e.status, e.company
      ORDER BY e.department ASC, e.name ASC
    `, [`${month}%`]);
    return rows;
  }

  async dailyAttendanceOverview(date) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT
        e.department,
        COUNT(DISTINCT e.id) as total_staff,
        COUNT(DISTINCT a.emp_id) as punched_in,
        SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END) as late_count
      FROM employees e
      LEFT JOIN attendance a
        ON e.id = a.emp_id AND a.timestamp LIKE ?
      WHERE e.status = 'Active'
      GROUP BY e.department
      ORDER BY e.department ASC
    `, [`${date}%`]);
    return rows;
  }

  // ──────────────────────────────────────────────
  // Audit & Blacklist
  // ──────────────────────────────────────────────
  async insertAudit({ table_name, record_id, action, old_values, new_values, performed_by, ip_address, user_agent }) {
    const pool = await this.getPool();
    const [result] = await pool.execute(
      `INSERT INTO audit_log (
        table_name, record_id, action, old_values, new_values,
        performed_by, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        table_name,
        String(record_id),
        action,
        old_values ? JSON.stringify(old_values) : null,
        new_values ? JSON.stringify(new_values) : null,
        performed_by,
        ip_address || null,
        user_agent || null
      ]
    );
    return { lastInsertRowid: result.insertId };
  }

  async blacklistToken(token_hash, expires_at) {
    const pool = await this.getPool();
    const [result] = await pool.execute(
      'INSERT IGNORE INTO token_blacklist (token_hash, expires_at) VALUES (?, ?)',
      [token_hash, expires_at]
    );
    return { changes: result.affectedRows };
  }

  async isTokenBlacklisted(token_hash) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(
      'SELECT 1 FROM token_blacklist WHERE token_hash = ?',
      [token_hash]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async purgeExpiredTokens(nowSeconds) {
    const pool = await this.getPool();
    const [result] = await pool.execute(
      'DELETE FROM token_blacklist WHERE expires_at < ?',
      [nowSeconds]
    );
    return { changes: result.affectedRows };
  }

  async getAuditLogs(size = 20, offset = 0) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM audit_log ORDER BY performed_at DESC LIMIT ? OFFSET ?',
      [String(size), String(offset)]
    );
    return rows;
  }

  async countAuditLogs() {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT COUNT(*) as c FROM audit_log');
    return rows[0]?.c || 0;
  }

  // ──────────────────────────────────────────────
  // Reset & Clear
  // ──────────────────────────────────────────────
  async clearAll() {
    const pool = await this.getPool();
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    await pool.query('TRUNCATE TABLE attendance');
    await pool.query('TRUNCATE TABLE employees');
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  _normalizeEmployee(row) {
    if (!row) return null;
    const clone = { ...row };
    if (typeof clone.descriptor === 'string') {
      try { clone.descriptor = JSON.parse(clone.descriptor); } catch {}
    }
    clone.device_expiry_rule_applicable = clone.device_expiry_rule_applicable ? 1 : 0;
    return clone;
  }

  _formatDatetime(ts) {
    if (!ts) return new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (typeof ts === 'string') {
      const clean = ts.replace('T', ' ').replace('Z', '').split('.')[0];
      if (clean.length === 19) return clean;
    }
    try {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 19).replace('T', ' ');
      }
    } catch {}
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }
}

module.exports = MySQLAdapter;
