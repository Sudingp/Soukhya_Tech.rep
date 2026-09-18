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
      WHERE status = 'Hibernate' AND hibernate_start_date IS NOT NULL
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
  // Master Settings
  // ──────────────────────────────────────────────
  async getMasterSettings() {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT setting_key, setting_value, category, description, updated_by, updated_at FROM master_settings');
    const settingsMap = {};
    for (const row of rows) {
      settingsMap[row.setting_key] = row.setting_value;
    }
    return {
      settings: settingsMap,
      details: rows
    };
  }

  async updateMasterSettings(settingsMap, updatedBy = 'system') {
    const pool = await this.getPool();
    let updatedCount = 0;
    for (const [key, value] of Object.entries(settingsMap)) {
      if (typeof value === 'undefined' || value === null) continue;
      const strVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
      const [result] = await pool.execute(
        `INSERT INTO master_settings (setting_key, setting_value, updated_by, updated_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by), updated_at = NOW()`,
        [key, strVal, updatedBy]
      );
      if (result.affectedRows > 0) updatedCount++;
    }
    return { updatedCount };
  }

  // ──────────────────────────────────────────────
  // Shifts
  // ──────────────────────────────────────────────
  async getAllShifts() {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM shifts WHERE active = 1 ORDER BY start_time ASC');
    return rows.map(r => ({
      ...r,
      is_night_shift: !!r.is_night_shift,
      active: !!r.active
    }));
  }

  async getShiftById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM shifts WHERE id = ?', [id]);
    if (!rows[0]) return null;
    return {
      ...rows[0],
      is_night_shift: !!rows[0].is_night_shift,
      active: !!rows[0].active
    };
  }

  async insertShift(s) {
    const pool = await this.getPool();
    const [result] = await pool.execute(
      `INSERT INTO shifts (
        id, name, code, start_time, end_time, break_start, break_end, break_mins,
        early_in_mins, late_grace_mins, early_out_mins, min_half_day_hrs, min_full_day_hrs,
        is_night_shift, color, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id, s.name, s.code.toUpperCase(), s.start_time, s.end_time,
        s.break_start || null, s.break_end || null, parseInt(s.break_mins || 60, 10),
        parseInt(s.early_in_mins || 30, 10), parseInt(s.late_grace_mins || 15, 10), parseInt(s.early_out_mins || 15, 10),
        parseFloat(s.min_half_day_hrs || 4.0), parseFloat(s.min_full_day_hrs || 8.0),
        s.is_night_shift ? 1 : 0, s.color || '#00d4aa', s.active !== false ? 1 : 0
      ]
    );
    return { changes: result.affectedRows };
  }

  async updateShift(s) {
    const pool = await this.getPool();
    const [result] = await pool.execute(
      `UPDATE shifts SET
        name = ?, code = ?, start_time = ?, end_time = ?,
        break_start = ?, break_end = ?, break_mins = ?,
        early_in_mins = ?, late_grace_mins = ?, early_out_mins = ?,
        min_half_day_hrs = ?, min_full_day_hrs = ?,
        is_night_shift = ?, color = ?, active = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        s.name, s.code.toUpperCase(), s.start_time, s.end_time,
        s.break_start || null, s.break_end || null, parseInt(s.break_mins || 60, 10),
        parseInt(s.early_in_mins || 30, 10), parseInt(s.late_grace_mins || 15, 10), parseInt(s.early_out_mins || 15, 10),
        parseFloat(s.min_half_day_hrs || 4.0), parseFloat(s.min_full_day_hrs || 8.0),
        s.is_night_shift ? 1 : 0, s.color || '#00d4aa', s.active !== false ? 1 : 0,
        s.id
      ]
    );
    return { changes: result.affectedRows };
  }

  async deleteShift(id) {
    const pool = await this.getPool();
    const [result] = await pool.execute('DELETE FROM shifts WHERE id = ?', [id]);
    return { changes: result.affectedRows };
  }

  // ──────────────────────────────────────────────
  // Shift Calendar Days & Patterns
  // ──────────────────────────────────────────────
  async getShiftCalendarMonth(year, month) {
    const pool = await this.getPool();
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const daysInMonth = new Date(y, m, 0).getDate();
    const mStr = String(m).padStart(2, '0');
    const startDate = `${y}-${mStr}-01`;
    const endDate = `${y}-${mStr}-${String(daysInMonth).padStart(2, '0')}`;

    // Get active shifts map
    const [shiftRows] = await pool.execute('SELECT * FROM shifts WHERE active = 1');
    const shiftMap = {};
    for (const s of shiftRows) {
      shiftMap[s.id] = s;
    }
    const defaultShift = shiftMap['SHIFT_GEN'] || shiftRows[0] || { id: 'SHIFT_GEN', name: 'General Shift', code: 'GEN', color: '#00d4aa' };

    // Get existing overrides
    const [overrides] = await pool.execute(
      `SELECT DATE_FORMAT(cal_date, '%Y-%m-%d') as cal_date, day_type, default_shift_id, title, is_recurring, updated_by
       FROM shift_calendar_days
       WHERE cal_date BETWEEN ? AND ?`,
      [startDate, endDate]
    );
    const overrideMap = {};
    for (const ov of overrides) {
      overrideMap[ov.cal_date] = ov;
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const resultDays = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = String(d).padStart(2, '0');
      const dateKey = `${y}-${mStr}-${dStr}`;
      const dt = new Date(y, m - 1, d);
      const dayOfWeek = dt.getDay(); // 0 = Sunday
      const dayName = dayNames[dayOfWeek];

      if (overrideMap[dateKey]) {
        const ov = overrideMap[dateKey];
        const shiftObj = shiftMap[ov.default_shift_id] || defaultShift;
        resultDays.push({
          date: dateKey,
          day_number: d,
          day_name: dayName,
          day_type: ov.day_type,
          default_shift_id: ov.default_shift_id || (ov.day_type === 'WORK' ? defaultShift.id : null),
          shift_code: shiftObj ? shiftObj.code : 'GEN',
          shift_name: shiftObj ? shiftObj.name : 'General Shift',
          shift_color: shiftObj ? shiftObj.color : '#00d4aa',
          title: ov.title || (ov.day_type === 'WEEKLY_OFF' ? 'Weekly Off' : ov.day_type === 'HOLIDAY' ? 'Holiday' : 'Regular Workday'),
          is_override: true,
          updated_by: ov.updated_by
        });
      } else {
        // Default rule: Sunday is Weekly Off, Monday-Saturday are Work
        const isSunday = dayOfWeek === 0;
        const dayType = isSunday ? 'WEEKLY_OFF' : 'WORK';
        resultDays.push({
          date: dateKey,
          day_number: d,
          day_name: dayName,
          day_type: dayType,
          default_shift_id: isSunday ? null : defaultShift.id,
          shift_code: isSunday ? 'WO' : defaultShift.code,
          shift_name: isSunday ? 'Weekly Off' : defaultShift.name,
          shift_color: isSunday ? '#64748b' : defaultShift.color,
          title: isSunday ? 'Sunday Weekly Off' : 'Regular Workday',
          is_override: false,
          updated_by: null
        });
      }
    }

    return {
      year: y,
      month: m,
      month_name: new Date(y, m - 1, 1).toLocaleString('default', { month: 'long' }),
      total_days: daysInMonth,
      days: resultDays,
      summary: {
        working_days: resultDays.filter(d => d.day_type === 'WORK').length,
        weekly_offs: resultDays.filter(d => d.day_type === 'WEEKLY_OFF').length,
        holidays: resultDays.filter(d => d.day_type === 'HOLIDAY').length,
        half_days: resultDays.filter(d => d.day_type === 'HALF_DAY').length
      }
    };
  }

  async upsertShiftCalendarDay({ cal_date, day_type, default_shift_id, title, is_recurring, updated_by }) {
    const pool = await this.getPool();
    const [result] = await pool.execute(
      `INSERT INTO shift_calendar_days (cal_date, day_type, default_shift_id, title, is_recurring, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        day_type = VALUES(day_type),
        default_shift_id = VALUES(default_shift_id),
        title = VALUES(title),
        is_recurring = VALUES(is_recurring),
        updated_by = VALUES(updated_by),
        updated_at = NOW()`,
      [
        cal_date,
        day_type || 'WORK',
        default_shift_id || null,
        title || null,
        is_recurring ? 1 : 0,
        updated_by || 'admin'
      ]
    );
    return { changes: result.affectedRows };
  }

  async applyShiftCalendarPattern({ year, month, pattern_type, default_shift_id, updated_by }) {
    const pool = await this.getPool();
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const daysInMonth = new Date(y, m, 0).getDate();
    const mStr = String(m).padStart(2, '0');

    // pattern_type: 'SUN_ONLY', 'SUN_AND_ALT_SAT', 'SUN_AND_ALL_SAT'
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(y, m - 1, d);
      const dayOfWeek = dt.getDay(); // 0 = Sun, 6 = Sat
      const dStr = String(d).padStart(2, '0');
      const dateKey = `${y}-${mStr}-${dStr}`;

      let isOff = false;
      let title = 'Regular Workday';
      let dayType = 'WORK';

      if (dayOfWeek === 0) {
        isOff = true;
        title = 'Sunday Weekly Off';
        dayType = 'WEEKLY_OFF';
      } else if (dayOfWeek === 6) {
        if (pattern_type === 'SUN_AND_ALL_SAT') {
          isOff = true;
          title = 'Saturday Weekly Off';
          dayType = 'WEEKLY_OFF';
        } else if (pattern_type === 'SUN_AND_ALT_SAT') {
          // 2nd and 4th Saturday off
          const saturdayNum = Math.ceil(d / 7);
          if (saturdayNum === 2 || saturdayNum === 4) {
            isOff = true;
            title = `${saturdayNum === 2 ? '2nd' : '4th'} Saturday Weekly Off`;
            dayType = 'WEEKLY_OFF';
          }
        }
      }

      await pool.execute(
        `INSERT INTO shift_calendar_days (cal_date, day_type, default_shift_id, title, updated_by)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          day_type = VALUES(day_type),
          default_shift_id = VALUES(default_shift_id),
          title = VALUES(title),
          updated_by = VALUES(updated_by),
          updated_at = NOW()`,
        [dateKey, dayType, isOff ? null : (default_shift_id || 'SHIFT_GEN'), title, updated_by || 'admin']
      );
      count++;
    }
    return { count };
  }

  // ──────────────────────────────────────────────
  // Shift Groups & Members
  // ──────────────────────────────────────────────
  async getAllShiftGroups() {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT g.*, COUNT(m.id) as member_count
      FROM shift_groups g
      LEFT JOIN shift_group_members m ON g.id = m.group_id AND m.active = 1
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `);
    return rows.map(r => {
      let seq = [];
      try {
        seq = typeof r.shifts_sequence === 'string' ? JSON.parse(r.shifts_sequence) : (r.shifts_sequence || []);
      } catch {}
      return {
        ...r,
        shifts_sequence: seq,
        member_count: parseInt(r.member_count || 0, 10),
        active: r.active === 1 || r.active === true
      };
    });
  }

  async getShiftGroupById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM shift_groups WHERE id = ?', [id]);
    if (!rows[0]) return null;
    const group = rows[0];
    try {
      group.shifts_sequence = typeof group.shifts_sequence === 'string' ? JSON.parse(group.shifts_sequence) : (group.shifts_sequence || []);
    } catch {
      group.shifts_sequence = [];
    }
    group.active = group.active === 1 || group.active === true;

    // Get group members
    const [members] = await pool.execute(`
      SELECT m.id as membership_id, m.emp_id, DATE_FORMAT(m.start_date, '%Y-%m-%d') as start_date,
             e.name, e.department as dept, e.role, e.status, e.image as avatar
      FROM shift_group_members m
      JOIN employees e ON m.emp_id = e.id
      WHERE m.group_id = ? AND m.active = 1
      ORDER BY e.name ASC
    `, [id]);
    group.members = members;
    return group;
  }

  async insertShiftGroup(g) {
    const pool = await this.getPool();
    const seqJson = JSON.stringify(Array.isArray(g.shifts_sequence) ? g.shifts_sequence : [g.shifts_sequence || 'SHIFT_GEN']);
    const [result] = await pool.execute(
      `INSERT INTO shift_groups (id, name, code, rotation_type, description, color, shifts_sequence, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        g.id,
        g.name,
        g.code.toUpperCase(),
        g.rotation_type || 'FIXED',
        g.description || null,
        g.color || '#4f8ef7',
        seqJson,
        g.active !== false ? 1 : 0
      ]
    );
    return { changes: result.affectedRows };
  }

  async updateShiftGroup(g) {
    const pool = await this.getPool();
    const seqJson = JSON.stringify(Array.isArray(g.shifts_sequence) ? g.shifts_sequence : [g.shifts_sequence || 'SHIFT_GEN']);
    const [result] = await pool.execute(
      `UPDATE shift_groups SET
        name = ?, code = ?, rotation_type = ?, description = ?, color = ?,
        shifts_sequence = ?, active = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        g.name,
        g.code.toUpperCase(),
        g.rotation_type || 'FIXED',
        g.description || null,
        g.color || '#4f8ef7',
        seqJson,
        g.active !== false ? 1 : 0,
        g.id
      ]
    );
    return { changes: result.affectedRows };
  }

  async deleteShiftGroup(id) {
    const pool = await this.getPool();
    const [result] = await pool.execute('DELETE FROM shift_groups WHERE id = ?', [id]);
    return { changes: result.affectedRows };
  }

  async setShiftGroupMembers(groupId, empIds, startDate) {
    const pool = await this.getPool();
    const start = startDate || new Date().toISOString().slice(0, 10);
    // Delete existing members for this group
    await pool.execute('DELETE FROM shift_group_members WHERE group_id = ?', [groupId]);

    if (Array.isArray(empIds) && empIds.length > 0) {
      const values = [];
      const placeholders = empIds.map(empId => {
        values.push(groupId, empId, start, 1);
        return '(?, ?, ?, ?)';
      }).join(', ');

      await pool.execute(
        `INSERT INTO shift_group_members (group_id, emp_id, start_date, active) VALUES ${placeholders}`,
        values
      );
    }
    return { count: Array.isArray(empIds) ? empIds.length : 0 };
  }

  // ──────────────────────────────────────────────
  // Shift Roster Matrix & Operations
  // ──────────────────────────────────────────────
  async getShiftRosterMatrix({ year, month, dept, groupId, search }) {
    const pool = await this.getPool();
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const daysInMonth = new Date(y, m, 0).getDate();
    const mStr = String(m).padStart(2, '0');
    const startDate = `${y}-${mStr}-01`;
    const endDate = `${y}-${mStr}-${String(daysInMonth).padStart(2, '0')}`;

    // 1. Fetch Calendar config for headers & fallback
    const calendar = await this.getShiftCalendarMonth(y, m);

    // 2. Fetch Employees
    let empQuery = `
      SELECT e.id, e.name, e.department as dept, e.role, e.image as avatar, gm.group_id, sg.name as group_name, sg.color as group_color
      FROM employees e
      LEFT JOIN shift_group_members gm ON e.id = gm.emp_id AND gm.active = 1
      LEFT JOIN shift_groups sg ON gm.group_id = sg.id
      WHERE e.status = 'Active'
    `;
    const empParams = [];
    if (dept) {
      empQuery += ' AND e.department = ?';
      empParams.push(dept);
    }
    if (groupId) {
      empQuery += ' AND gm.group_id = ?';
      empParams.push(groupId);
    }
    if (search) {
      empQuery += ' AND (e.name LIKE ? OR e.id LIKE ? OR e.department LIKE ?)';
      const term = `%${search}%`;
      empParams.push(term, term, term);
    }
    empQuery += ' ORDER BY e.department ASC, e.name ASC';

    const [employees] = await pool.execute(empQuery, empParams);

    // 3. Fetch Roster Records for Month
    const [rosterRows] = await pool.execute(
      `SELECT r.emp_id, DATE_FORMAT(r.roster_date, '%Y-%m-%d') as roster_date, r.shift_id, r.day_type, r.source, r.note,
              s.name as shift_name, s.code as shift_code, s.color as shift_color, s.start_time, s.end_time
       FROM shift_roster r
       LEFT JOIN shifts s ON r.shift_id = s.id
       WHERE r.roster_date BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    const rosterMap = {};
    for (const row of rosterRows) {
      if (!rosterMap[row.emp_id]) rosterMap[row.emp_id] = {};
      rosterMap[row.emp_id][row.roster_date] = row;
    }

    // 4. Build Matrix
    const matrix = [];
    for (const emp of employees) {
      const schedule = {};
      let workingCount = 0;
      let offCount = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const dStr = String(d).padStart(2, '0');
        const dateKey = `${y}-${mStr}-${dStr}`;
        const calDay = calendar.days[d - 1];

        let cell = rosterMap[emp.id]?.[dateKey];
        if (!cell) {
          // Fallback to calendar day
          cell = {
            emp_id: emp.id,
            roster_date: dateKey,
            shift_id: calDay.default_shift_id || 'SHIFT_GEN',
            shift_code: calDay.shift_code,
            shift_name: calDay.shift_name,
            shift_color: calDay.shift_color,
            day_type: calDay.day_type,
            source: 'DEFAULT',
            note: null
          };
        }

        if (cell.day_type === 'WORK') workingCount++;
        else offCount++;

        schedule[dateKey] = cell;
      }

      matrix.push({
        employee: emp,
        schedule,
        stats: { working_days: workingCount, off_days: offCount }
      });
    }

    return {
      year: y,
      month: m,
      total_days: daysInMonth,
      calendar_days: calendar.days,
      employees: matrix,
      total_employees: matrix.length
    };
  }

  async assignShiftRoster({ emp_ids, start_date, end_date, shift_id, day_type, source, note, assigned_by }) {
    const pool = await this.getPool();
    const ids = Array.isArray(emp_ids) ? emp_ids : [emp_ids];
    const sDate = new Date(start_date);
    const eDate = new Date(end_date || start_date);
    const resolvedShiftId = shift_id || 'SHIFT_GEN';
    const resolvedDayType = day_type || 'WORK';
    const resolvedSource = source || 'MANUAL_OVERRIDE';

    let affected = 0;
    const values = [];
    const placeholders = [];

    for (const empId of ids) {
      for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().slice(0, 10);
        placeholders.push('(?, ?, ?, ?, ?, ?, ?)');
        values.push(empId, dateStr, resolvedShiftId, resolvedDayType, resolvedSource, note || null, assigned_by || 'admin');
      }
    }

    if (placeholders.length > 0) {
      const sql = `
        INSERT INTO shift_roster (emp_id, roster_date, shift_id, day_type, source, note, assigned_by)
        VALUES ${placeholders.join(', ')}
        ON DUPLICATE KEY UPDATE
          shift_id = VALUES(shift_id),
          day_type = VALUES(day_type),
          source = VALUES(source),
          note = VALUES(note),
          assigned_by = VALUES(assigned_by),
          updated_at = NOW()
      `;
      const [result] = await pool.query(sql, values);
      affected = result.affectedRows;
    }

    return { records_processed: placeholders.length, affected_rows: affected };
  }

  async autoGenerateMonthlyRoster({ year, month, dept, groupId, overwrite, assigned_by }) {
    const pool = await this.getPool();
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const daysInMonth = new Date(y, m, 0).getDate();
    const mStr = String(m).padStart(2, '0');
    const startDate = `${y}-${mStr}-01`;
    const endDate = `${y}-${mStr}-${String(daysInMonth).padStart(2, '0')}`;

    // 1. Get calendar days
    const calendar = await this.getShiftCalendarMonth(y, m);

    // 2. Get all shifts mapping
    const [shifts] = await pool.execute('SELECT * FROM shifts WHERE active = 1');
    const shiftIds = new Set(shifts.map(s => s.id));

    // 3. Get groups with rotation sequences
    const groups = await this.getAllShiftGroups();
    const groupMap = {};
    for (const g of groups) {
      groupMap[g.id] = g;
    }

    // 4. Get active employees
    let empSql = `
      SELECT e.id, e.department as dept, gm.group_id
      FROM employees e
      LEFT JOIN shift_group_members gm ON e.id = gm.emp_id AND gm.active = 1
      WHERE e.status = 'Active'
    `;
    const empParams = [];
    if (dept) {
      empSql += ' AND e.department = ?';
      empParams.push(dept);
    }
    if (groupId) {
      empSql += ' AND gm.group_id = ?';
      empParams.push(groupId);
    }
    const [employees] = await pool.execute(empSql, empParams);


    if (overwrite) {
      // Clear current month records for these employees
      const empIds = employees.map(e => e.id);
      if (empIds.length > 0) {
        const inClause = empIds.map(() => '?').join(',');
        await pool.query(
          `DELETE FROM shift_roster WHERE roster_date BETWEEN ? AND ? AND emp_id IN (${inClause})`,
          [startDate, endDate, ...empIds]
        );
      }
    }

    const placeholders = [];
    const values = [];

    for (const emp of employees) {
      const empGroup = emp.group_id ? groupMap[emp.group_id] : null;

      for (let d = 1; d <= daysInMonth; d++) {
        const dStr = String(d).padStart(2, '0');
        const dateKey = `${y}-${mStr}-${dStr}`;
        const calDay = calendar.days[d - 1];

        let assignedShift = 'SHIFT_GEN';
        let dayType = calDay.day_type;
        let source = 'DEFAULT';

        if (dayType === 'WORK') {
          if (empGroup && Array.isArray(empGroup.shifts_sequence) && empGroup.shifts_sequence.length > 0) {
            source = 'GROUP_ROTATION';
            const seq = empGroup.shifts_sequence;
            if (empGroup.rotation_type === 'WEEKLY') {
              const weekIdx = Math.floor((d - 1) / 7) % seq.length;
              assignedShift = seq[weekIdx] || seq[0];
            } else if (empGroup.rotation_type === 'BI_WEEKLY') {
              const biWeekIdx = Math.floor((d - 1) / 14) % seq.length;
              assignedShift = seq[biWeekIdx] || seq[0];
            } else {
              assignedShift = seq[0];
            }
          } else if (calDay.default_shift_id) {
            assignedShift = calDay.default_shift_id;
          }
        } else {
          assignedShift = calDay.default_shift_id || 'SHIFT_GEN';
        }

        if (!shiftIds.has(assignedShift)) {
          assignedShift = 'SHIFT_GEN';
        }

        placeholders.push('(?, ?, ?, ?, ?, ?, ?)');
        values.push(emp.id, dateKey, assignedShift, dayType, source, 'Auto-generated schedule', assigned_by || 'admin');
      }
    }

    if (placeholders.length > 0) {
      // Chunk inserts in batches of 500
      const batchSize = 500;
      for (let i = 0; i < placeholders.length; i += batchSize) {
        const pSlice = placeholders.slice(i, i + batchSize);
        const vSlice = values.slice(i * 7, (i + pSlice.length) * 7);
        const sql = `
          INSERT INTO shift_roster (emp_id, roster_date, shift_id, day_type, source, note, assigned_by)
          VALUES ${pSlice.join(', ')}
          ON DUPLICATE KEY UPDATE
            shift_id = VALUES(shift_id),
            day_type = VALUES(day_type),
            source = VALUES(source),
            note = VALUES(note),
            assigned_by = VALUES(assigned_by),
            updated_at = NOW()
        `;
        await pool.query(sql, vSlice);
      }
    }

    return { employees_count: employees.length, total_days: daysInMonth, total_slots: placeholders.length };
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
