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
  // 🏢 Companies Master
  // ──────────────────────────────────────────────
  async getAllCompanies() {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM employees e WHERE e.company_id = c.id OR e.company = c.short_name OR e.company = c.name) as employee_count
      FROM companies c
      ORDER BY c.name ASC
    `);
    return rows.map(r => ({
      ...r,
      active: r.active === 1 || r.active === true,
      employee_count: parseInt(r.employee_count || 0, 10)
    }));
  }

  async getCompanyById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM employees e WHERE e.company_id = c.id OR e.company = c.short_name OR e.company = c.name) as employee_count
      FROM companies c
      WHERE c.id = ? OR c.code = ? OR c.short_name = ?
    `, [id, id, id]);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      ...r,
      active: r.active === 1 || r.active === true,
      employee_count: parseInt(r.employee_count || 0, 10)
    };
  }

  async insertCompany(c) {
    const pool = await this.getPool();
    const id = c.id || `COMP_${c.code || c.short_name || Date.now()}`.toUpperCase();
    const [result] = await pool.execute(`
      INSERT INTO companies (
        id, code, name, short_name, logo_url, address, city, state, country, pincode, email, phone, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      (c.code || c.short_name || '').toUpperCase(),
      c.name,
      c.short_name || c.code || '',
      c.logo_url || null,
      c.address || null,
      c.city || 'Bangalore',
      c.state || 'Karnataka',
      c.country || 'India',
      c.pincode || null,
      c.email || null,
      c.phone || null,
      c.active !== false ? 1 : 0
    ]);
    return { changes: result.affectedRows, id };
  }

  async updateCompany(c) {
    const pool = await this.getPool();
    const [result] = await pool.execute(`
      UPDATE companies SET
        code = ?, name = ?, short_name = ?, logo_url = ?, address = ?,
        city = ?, state = ?, country = ?, pincode = ?, email = ?, phone = ?,
        active = ?, updated_at = NOW()
      WHERE id = ?
    `, [
      (c.code || c.short_name || '').toUpperCase(),
      c.name,
      c.short_name || c.code || '',
      c.logo_url || null,
      c.address || null,
      c.city || 'Bangalore',
      c.state || 'Karnataka',
      c.country || 'India',
      c.pincode || null,
      c.email || null,
      c.phone || null,
      c.active !== false ? 1 : 0,
      c.id
    ]);
    return { changes: result.affectedRows };
  }

  async deleteCompany(id) {
    const pool = await this.getPool();
    const [result] = await pool.execute('DELETE FROM companies WHERE id = ?', [id]);
    return { changes: result.affectedRows };
  }

  // ──────────────────────────────────────────────
  // 👔 Designations Master
  // ──────────────────────────────────────────────
  async getAllDesignations() {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT d.*, dept.name as dept_name,
             (SELECT COUNT(*) FROM employees e WHERE e.designation_id = d.id OR e.designation = d.name) as employee_count
      FROM designations d
      LEFT JOIN departments dept ON d.dept_id = dept.id
      ORDER BY d.name ASC
    `);
    return rows.map(r => ({
      ...r,
      active: r.active === 1 || r.active === true,
      employee_count: parseInt(r.employee_count || 0, 10)
    }));
  }

  async getDesignationById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT d.*, dept.name as dept_name,
             (SELECT COUNT(*) FROM employees e WHERE e.designation_id = d.id OR e.designation = d.name) as employee_count
      FROM designations d
      LEFT JOIN departments dept ON d.dept_id = dept.id
      WHERE d.id = ? OR d.code = ?
    `, [id, id]);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      ...r,
      active: r.active === 1 || r.active === true,
      employee_count: parseInt(r.employee_count || 0, 10)
    };
  }

  async insertDesignation(d) {
    const pool = await this.getPool();
    const id = d.id || `DES_${d.code || Date.now()}`.toUpperCase();
    const [result] = await pool.execute(`
      INSERT INTO designations (
        id, code, name, dept_id, grade_level, description, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      (d.code || '').toUpperCase(),
      d.name,
      d.dept_id || null,
      d.grade_level || 'L1',
      d.description || null,
      d.active !== false ? 1 : 0
    ]);
    return { changes: result.affectedRows, id };
  }

  async updateDesignation(d) {
    const pool = await this.getPool();
    const [result] = await pool.execute(`
      UPDATE designations SET
        code = ?, name = ?, dept_id = ?, grade_level = ?, description = ?,
        active = ?, updated_at = NOW()
      WHERE id = ?
    `, [
      (d.code || '').toUpperCase(),
      d.name,
      d.dept_id || null,
      d.grade_level || 'L1',
      d.description || null,
      d.active !== false ? 1 : 0,
      d.id
    ]);
    return { changes: result.affectedRows };
  }

  async deleteDesignation(id) {
    const pool = await this.getPool();
    const [result] = await pool.execute('DELETE FROM designations WHERE id = ?', [id]);
    return { changes: result.affectedRows };
  }

  // ──────────────────────────────────────────────
  // 🏢 Branches Master (Locations)
  // ──────────────────────────────────────────────
  async getAllBranches() {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT b.*, g.name as geofence_name,
             (SELECT COUNT(*) FROM employees e WHERE e.branch_id = b.id OR e.location = b.name) as employee_count
      FROM branches b
      LEFT JOIN geofences g ON b.geofence_id = g.id
      ORDER BY b.name ASC
    `);
    return rows.map(r => ({
      ...r,
      active: r.active === 1 || r.active === true,
      employee_count: parseInt(r.employee_count || 0, 10)
    }));
  }

  async getBranchById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT b.*, g.name as geofence_name,
             (SELECT COUNT(*) FROM employees e WHERE e.branch_id = b.id OR e.location = b.name) as employee_count
      FROM branches b
      LEFT JOIN geofences g ON b.geofence_id = g.id
      WHERE b.id = ? OR b.code = ?
    `, [id, id]);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      ...r,
      active: r.active === 1 || r.active === true,
      employee_count: parseInt(r.employee_count || 0, 10)
    };
  }

  async insertBranch(b) {
    const pool = await this.getPool();
    const id = b.id || `BR_${b.code || Date.now()}`.toUpperCase();
    const [result] = await pool.execute(`
      INSERT INTO branches (
        id, code, name, address, city, state, country, pincode, geofence_id, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      (b.code || '').toUpperCase(),
      b.name,
      b.address || null,
      b.city || 'Bangalore',
      b.state || 'Karnataka',
      b.country || 'India',
      b.pincode || null,
      b.geofence_id || null,
      b.active !== false ? 1 : 0
    ]);
    return { changes: result.affectedRows, id };
  }

  async updateBranch(b) {
    const pool = await this.getPool();
    const [result] = await pool.execute(`
      UPDATE branches SET
        code = ?, name = ?, address = ?, city = ?, state = ?, country = ?,
        pincode = ?, geofence_id = ?, active = ?, updated_at = NOW()
      WHERE id = ?
    `, [
      (b.code || '').toUpperCase(),
      b.name,
      b.address || null,
      b.city || 'Bangalore',
      b.state || 'Karnataka',
      b.country || 'India',
      b.pincode || null,
      b.geofence_id || null,
      b.active !== false ? 1 : 0,
      b.id
    ]);
    return { changes: result.affectedRows };
  }

  async deleteBranch(id) {
    const pool = await this.getPool();
    const [result] = await pool.execute('DELETE FROM branches WHERE id = ?', [id]);
    return { changes: result.affectedRows };
  }

  // ──────────────────────────────────────────────
  // ⚡ High-Speed Paginated Employees & Batch Inserter
  // ──────────────────────────────────────────────
  async getEmployees(params = {}) {
    const pool = await this.getPool();
    let { search, department, company, status, employment_type, sortBy = 'created_at', sortOrder = 'DESC', page = 1, limit = 50 } = params;
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 50;
    if (limit < 1) limit = 50;
    if (limit > 10000) limit = 10000;
    const offset = (page - 1) * limit;

    const allowedSort = ['id', 'name', 'department', 'company', 'role', 'designation', 'status', 'created_at', 'card_number'];
    const sortCol = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const sortDir = (String(sortOrder).toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

    const whereClauses = [];
    const whereParams = [];

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      whereClauses.push('(e.id LIKE ? OR e.name LIKE ? OR e.email LIKE ? OR e.card_number LIKE ? OR e.role LIKE ? OR e.designation LIKE ?)');
      whereParams.push(s, s, s, s, s, s);
    }
    if (department && department !== 'All') {
      whereClauses.push('(e.department = ? OR e.department_id = ?)');
      whereParams.push(department, department);
    }
    if (company && company !== 'All') {
      whereClauses.push('(e.company = ? OR e.company_id = ?)');
      whereParams.push(company, company);
    }
    if (status && status !== 'All') {
      whereClauses.push('e.status = ?');
      whereParams.push(status);
    }
    if (employment_type && employment_type !== 'All') {
      whereClauses.push('(e.employment_type = ? OR e.employment_type_id = ?)');
      whereParams.push(employment_type, employment_type);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [countRows] = await pool.execute(`SELECT COUNT(*) as total FROM employees e ${whereSql}`, whereParams);
    const total = countRows[0]?.total || 0;

    const querySql = `
      SELECT e.*, c.name as company_name, d.name as department_name, des.name as designation_name, b.name as branch_name
      FROM employees e
      LEFT JOIN companies c ON e.company_id = c.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN branches b ON e.branch_id = b.id
      ${whereSql}
      ORDER BY e.${sortCol} ${sortDir}
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [rows] = await pool.execute(querySql, whereParams);
    return {
      employees: rows.map(r => this._normalizeEmployee(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async bulkInsertEmployees(records, chunkSize = 500) {
    const pool = await this.getPool();
    let totalInserted = 0;

    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const placeholders = [];
        const values = [];

        for (const emp of chunk) {
          placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
          const descriptorStr = typeof emp.descriptor === 'string' ? emp.descriptor : JSON.stringify(emp.descriptor || []);
          values.push(
            emp.id, emp.name, emp.department, emp.role, descriptorStr, emp.descriptor_hash, emp.image || null, emp.status || 'Active',
            emp.hibernate_start_date || null, emp.hibernate_end_date || null, emp.hibernate_reason || null,
            emp.company || null, emp.company_id || null, emp.department_id || null,
            emp.designation || null, emp.designation_id || null, emp.branch_id || null,
            emp.employment_type_id || null, emp.primary_shift_id || null, emp.geofence_id || null,
            emp.gender || null, emp.date_of_joining || null, emp.date_of_confirmation || null, emp.last_working_day || null,
            emp.aadhaar_number || null, emp.pan_number || null, emp.card_number || null, emp.phone_no || null, emp.email || null, emp.reporting_to || null,
            emp.device_code || null, emp.sub_department || null, emp.division || null, emp.grade || null, emp.team || null, emp.location || null,
            emp.employment_type || null, emp.category || null, emp.holiday_group || null, emp.shift_group || null, emp.shift_roster || null,
            emp.geofence || null, emp.device_expiry_rule_applicable ? 1 : 0, emp.verification_type || null
          );
        }

        const sql = `
          INSERT INTO employees (
            id, name, department, role, descriptor, descriptor_hash, image, status,
            hibernate_start_date, hibernate_end_date, hibernate_reason,
            company, company_id, department_id,
            designation, designation_id, branch_id,
            employment_type_id, primary_shift_id, geofence_id,
            gender, date_of_joining, date_of_confirmation, last_working_day,
            aadhaar_number, pan_number, card_number, phone_no, email, reporting_to,
            device_code, sub_department, division, grade, team, location,
            employment_type, category, holiday_group, shift_group, shift_roster,
            geofence, device_expiry_rule_applicable, verification_type
          ) VALUES ${placeholders.join(', ')}
          ON DUPLICATE KEY UPDATE
            name = VALUES(name), department = VALUES(department), role = VALUES(role),
            company = VALUES(company), company_id = VALUES(company_id), department_id = VALUES(department_id),
            designation = VALUES(designation), designation_id = VALUES(designation_id), branch_id = VALUES(branch_id),
            employment_type_id = VALUES(employment_type_id), primary_shift_id = VALUES(primary_shift_id),
            geofence_id = VALUES(geofence_id), status = VALUES(status), email = VALUES(email),
            phone_no = VALUES(phone_no), card_number = VALUES(card_number), location = VALUES(location),
            updated_at = NOW()
        `;

        await conn.execute(sql, values);
        await conn.commit();
        totalInserted += chunk.length;
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    return { totalInserted };
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
  // 🏢 Departments (Department Master)
  // ──────────────────────────────────────────────
  async getAllDepartments() {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT d.*, h.name as head_name, p.name as parent_name,
             (SELECT COUNT(*) FROM employees e WHERE e.department = d.name OR e.department = d.code) as employee_count
      FROM departments d
      LEFT JOIN employees h ON d.head_emp_id = h.id
      LEFT JOIN departments p ON d.parent_dept_id = p.id
      ORDER BY d.name ASC
    `);
    return rows.map(r => ({
      ...r,
      active: r.active === 1 || r.active === true,
      employee_count: parseInt(r.employee_count || 0, 10)
    }));
  }

  async getDepartmentById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT d.*, h.name as head_name, p.name as parent_name,
             (SELECT COUNT(*) FROM employees e WHERE e.department = d.name OR e.department = d.code) as employee_count
      FROM departments d
      LEFT JOIN employees h ON d.head_emp_id = h.id
      LEFT JOIN departments p ON d.parent_dept_id = p.id
      WHERE d.id = ?
    `, [id]);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      ...r,
      active: r.active === 1 || r.active === true,
      employee_count: parseInt(r.employee_count || 0, 10)
    };
  }

  async insertDepartment(d) {
    const pool = await this.getPool();
    const [result] = await pool.execute(
      `INSERT INTO departments (id, code, name, head_emp_id, parent_dept_id, division, location, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.id,
        d.code.toUpperCase(),
        d.name,
        d.head_emp_id || null,
        d.parent_dept_id || null,
        d.division || 'Corporate',
        d.location || 'Bangalore HQ',
        d.active !== false ? 1 : 0
      ]
    );

    // Auto-create default department_shifts mapping
    await pool.execute(
      `INSERT IGNORE INTO department_shifts (dept_id, default_shift_id, allowed_shifts, auto_apply, updated_by)
       VALUES (?, 'SHIFT_GEN', '["SHIFT_GEN"]', 1, 'system')`,
      [d.id]
    );

    return { changes: result.affectedRows };
  }

  async updateDepartment(d) {
    const pool = await this.getPool();
    const [result] = await pool.execute(
      `UPDATE departments SET
        name = ?, code = ?, head_emp_id = ?, parent_dept_id = ?,
        division = ?, location = ?, active = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        d.name,
        d.code.toUpperCase(),
        d.head_emp_id || null,
        d.parent_dept_id || null,
        d.division || 'Corporate',
        d.location || 'Bangalore HQ',
        d.active !== false ? 1 : 0,
        d.id
      ]
    );
    return { changes: result.affectedRows };
  }

  async deleteDepartment(id) {
    const pool = await this.getPool();
    const dept = await this.getDepartmentById(id);
    if (!dept) return { changes: 0 };
    if (dept.employee_count > 0) {
      throw new Error(`Cannot delete department "${dept.name}" because it currently has ${dept.employee_count} active employees assigned.`);
    }

    const [result] = await pool.execute('DELETE FROM departments WHERE id = ?', [id]);
    return { changes: result.affectedRows };
  }

  // ──────────────────────────────────────────────
  // 🔄 Department Shifts (Department Policies)
  // ──────────────────────────────────────────────
  async getAllDepartmentShifts() {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT ds.*, d.name as dept_name, d.code as dept_code,
             s.name as default_shift_name, s.code as default_shift_code, s.color as default_shift_color,
             s.start_time, s.end_time
      FROM department_shifts ds
      JOIN departments d ON ds.dept_id = d.id
      JOIN shifts s ON ds.default_shift_id = s.id
      ORDER BY d.name ASC
    `);
    return rows.map(r => {
      let allowed = [];
      try {
        allowed = typeof r.allowed_shifts === 'string' ? JSON.parse(r.allowed_shifts) : (r.allowed_shifts || []);
      } catch {}
      return {
        ...r,
        allowed_shifts: allowed,
        auto_apply: r.auto_apply === 1 || r.auto_apply === true
      };
    });
  }

  async getDepartmentShiftsByDept(deptId) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT ds.*, d.name as dept_name, d.code as dept_code,
             s.name as default_shift_name, s.code as default_shift_code, s.color as default_shift_color,
             s.start_time, s.end_time
      FROM department_shifts ds
      JOIN departments d ON ds.dept_id = d.id
      JOIN shifts s ON ds.default_shift_id = s.id
      WHERE ds.dept_id = ?
    `, [deptId]);
    if (!rows[0]) return null;
    const r = rows[0];
    let allowed = [];
    try {
      allowed = typeof r.allowed_shifts === 'string' ? JSON.parse(r.allowed_shifts) : (r.allowed_shifts || []);
    } catch {}
    return {
      ...r,
      allowed_shifts: allowed,
      auto_apply: r.auto_apply === 1 || r.auto_apply === true
    };
  }

  async upsertDepartmentShifts({ dept_id, default_shift_id, allowed_shifts, auto_apply, updated_by }) {
    const pool = await this.getPool();
    const allowedJson = JSON.stringify(Array.isArray(allowed_shifts) ? allowed_shifts : [default_shift_id || 'SHIFT_GEN']);
    const [result] = await pool.execute(
      `INSERT INTO department_shifts (dept_id, default_shift_id, allowed_shifts, auto_apply, updated_by)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        default_shift_id = VALUES(default_shift_id),
        allowed_shifts = VALUES(allowed_shifts),
        auto_apply = VALUES(auto_apply),
        updated_by = VALUES(updated_by),
        updated_at = NOW()`,
      [
        dept_id,
        default_shift_id || 'SHIFT_GEN',
        allowedJson,
        auto_apply !== false ? 1 : 0,
        updated_by || 'admin'
      ]
    );
    return { changes: result.affectedRows };
  }

  async applyDepartmentShiftsToEmployees(deptId) {
    const pool = await this.getPool();
    const config = await this.getDepartmentShiftsByDept(deptId);
    if (!config) throw new Error('Department shift config not found');

    const [deptRows] = await pool.execute('SELECT name, code FROM departments WHERE id = ?', [deptId]);
    if (!deptRows[0]) throw new Error('Department not found');
    const { name, code } = deptRows[0];

    // Find all active employees in this department
    const [empRows] = await pool.execute(
      'SELECT id FROM employees WHERE department = ? OR department = ?',
      [name, code]
    );

    return { employees_affected: empRows.length, default_shift_id: config.default_shift_id };
  }

  // ──────────────────────────────────────────────
  // 🏖️ Public Holidays (Karnataka Official Gazette)
  // ──────────────────────────────────────────────
  async getAllPublicHolidays(year) {
    const pool = await this.getPool();
    const y = parseInt(year || new Date().getFullYear(), 10);
    const [rows] = await pool.execute(
      `SELECT id, title, DATE_FORMAT(holiday_date, '%Y-%m-%d') as holiday_date,
              holiday_type, applicable_state, applicable_location, description, is_recurring, created_at, updated_at
       FROM public_holidays
       WHERE YEAR(holiday_date) = ?
       ORDER BY holiday_date ASC`,
      [y]
    );

    const todayStr = new Date().toISOString().slice(0, 10);
    return rows.map(r => {
      const dt = new Date(r.holiday_date);
      return {
        ...r,
        day_name: dt.toLocaleDateString('default', { weekday: 'long' }),
        is_upcoming: r.holiday_date >= todayStr,
        is_recurring: r.is_recurring === 1 || r.is_recurring === true
      };
    });
  }

  async getPublicHolidayById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(
      `SELECT id, title, DATE_FORMAT(holiday_date, '%Y-%m-%d') as holiday_date,
              holiday_type, applicable_state, applicable_location, description, is_recurring, created_at, updated_at
       FROM public_holidays
       WHERE id = ?`,
      [id]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    const dt = new Date(r.holiday_date);
    return {
      ...r,
      day_name: dt.toLocaleDateString('default', { weekday: 'long' }),
      is_recurring: r.is_recurring === 1 || r.is_recurring === true
    };
  }

  async insertPublicHoliday(h) {
    const pool = await this.getPool();
    const [result] = await pool.execute(
      `INSERT INTO public_holidays (title, holiday_date, holiday_type, applicable_state, applicable_location, description, is_recurring)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        h.title,
        h.holiday_date,
        h.holiday_type || 'MANDATORY',
        h.applicable_state || 'Karnataka',
        h.applicable_location || 'All Locations',
        h.description || null,
        h.is_recurring ? 1 : 0
      ]
    );
    return { lastInsertRowid: result.insertId, changes: result.affectedRows };
  }

  async updatePublicHoliday(h) {
    const pool = await this.getPool();
    const [result] = await pool.execute(
      `UPDATE public_holidays SET
        title = ?, holiday_date = ?, holiday_type = ?, applicable_state = ?,
        applicable_location = ?, description = ?, is_recurring = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        h.title,
        h.holiday_date,
        h.holiday_type || 'MANDATORY',
        h.applicable_state || 'Karnataka',
        h.applicable_location || 'All Locations',
        h.description || null,
        h.is_recurring ? 1 : 0,
        h.id
      ]
    );
    return { changes: result.affectedRows };
  }

  async deletePublicHoliday(id) {
    const pool = await this.getPool();
    const [result] = await pool.execute('DELETE FROM public_holidays WHERE id = ?', [id]);
    return { changes: result.affectedRows };
  }

  async importKarnatakaHolidays(targetYear) {
    const pool = await this.getPool();
    const y = parseInt(targetYear || 2026, 10);

    const karnatakaHolidays = [
      { title: 'Uttarayana Punyakala, Makara Sankranti', date: `${y}-01-15`, desc: 'Harvest Festival / Makara Sankranti (Gazetted)' },
      { title: 'Republic Day', date: `${y}-01-26`, desc: 'National Holiday - Republic Day of India' },
      { title: 'Ugadi Festival', date: `${y}-03-19`, desc: 'Kannada New Year (Gazetted)' },
      { title: 'Khutub-E-Ramzan (Eid-ul-Fitr)', date: `${y}-03-21`, desc: 'Eid-ul-Fitr Celebration (Gazetted)' },
      { title: 'Mahaveera Jayanthi', date: `${y}-03-31`, desc: 'Birth anniversary of Bhagwan Mahaveer (Gazetted)' },
      { title: 'Good Friday', date: `${y}-04-03`, desc: 'Christian Observance - Good Friday (Gazetted)' },
      { title: 'Dr. B.R. Ambedkar Jayanthi', date: `${y}-04-14`, desc: 'Birth anniversary of Dr. B.R. Ambedkar (Gazetted)' },
      { title: 'Basava Jayanthi, Akshaya Tritiya', date: `${y}-04-20`, desc: 'Birth anniversary of Jagadjyothi Basaveshwara (Gazetted)' },
      { title: 'May Day (International Labour Day)', date: `${y}-05-01`, desc: 'Labour Day / Worker Rights Day (Gazetted)' },
      { title: 'Bakrid (Eid al-Adha)', date: `${y}-05-28`, desc: 'Eid al-Adha Feast of Sacrifice (Gazetted)' },
      { title: 'Last Day of Muharram', date: `${y}-06-26`, desc: 'Muharram Observance (Gazetted)' },
      { title: 'Independence Day', date: `${y}-08-15`, desc: 'National Holiday - 79th Independence Day of India' },
      { title: 'Eid-Milad', date: `${y}-08-26`, desc: 'Milad-un-Nabi (Gazetted)' },
      { title: 'Varasiddhi Vinayaka Vrata', date: `${y}-09-14`, desc: 'Ganesh Chaturthi Festival (Gazetted)' },
      { title: 'Mahatma Gandhi Jayanthi', date: `${y}-10-02`, desc: 'National Holiday - Birth anniversary of Mahatma Gandhi' },
      { title: 'Mahanavami / Ayudha Pooja', date: `${y}-10-20`, desc: 'Ayudha Pooja Festival (Gazetted)' },
      { title: 'Vijayadashami (Dussehra)', date: `${y}-10-21`, desc: 'Vijayadashami / Mysore Dasara Festival (Gazetted)' },
      { title: 'Kannada Rajyotsava', date: `${y}-11-01`, desc: 'Karnataka State Formation Day (Gazetted)' },
      { title: 'Kanakadasa Jayanthi', date: `${y}-11-10`, desc: 'Birth anniversary of Saint Kanakadasa (Gazetted)' },
      { title: 'Guru Nanak Jayanthi', date: `${y}-11-27`, desc: 'Birth anniversary of Guru Nanak Dev (Gazetted)' },
      { title: 'Christmas Day', date: `${y}-12-25`, desc: 'Christian Festival - Christmas Day (Gazetted)' }
    ];

    let inserted = 0;
    for (const h of karnatakaHolidays) {
      const [res] = await pool.execute(
        `INSERT INTO public_holidays (title, holiday_date, holiday_type, applicable_state, applicable_location, description)
         VALUES (?, ?, 'MANDATORY', 'Karnataka', 'All Locations', ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description), updated_at = NOW()`,
        [h.title, h.date, h.desc]
      );
      if (res.affectedRows > 0) inserted++;
    }

    return { imported_count: inserted, total_holidays: karnatakaHolidays.length, year: y };
  }

  async syncHolidaysWithCalendar(targetYear, updatedBy) {
    const pool = await this.getPool();
    const y = parseInt(targetYear || 2026, 10);
    const holidays = await this.getAllPublicHolidays(y);

    let syncedCalendar = 0;
    let syncedRoster = 0;

    for (const h of holidays) {
      // 1. Upsert into shift_calendar_days
      await pool.execute(
        `INSERT INTO shift_calendar_days (cal_date, day_type, default_shift_id, title, updated_by)
         VALUES (?, 'HOLIDAY', NULL, ?, ?)
         ON DUPLICATE KEY UPDATE
          day_type = 'HOLIDAY',
          title = VALUES(title),
          updated_by = VALUES(updated_by),
          updated_at = NOW()`,
        [h.holiday_date, h.title, updatedBy || 'admin']
      );
      syncedCalendar++;

      // 2. Update shift_roster for this date
      const [rosterRes] = await pool.execute(
        `UPDATE shift_roster SET day_type = 'HOLIDAY', note = ?, updated_at = NOW()
         WHERE roster_date = ?`,
        [h.title, h.holiday_date]
      );
      syncedRoster += rosterRes.affectedRows;
    }

    return { holidays_synced: syncedCalendar, roster_slots_updated: syncedRoster, year: y };
  }

  // ──────────────────────────────────────────────
  // 16. Employment Types Master
  // ──────────────────────────────────────────────
  async getAllEmploymentTypes() {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT et.*,
        (SELECT COUNT(*) FROM employees e WHERE e.employment_type = et.code OR e.employment_type = et.id) AS headcount
      FROM employment_types et
      ORDER BY et.active DESC, et.title ASC
    `);
    return rows.map(r => ({
      ...r,
      pf_esi_eligible: Boolean(r.pf_esi_eligible),
      active: Boolean(r.active),
      headcount: Number(r.headcount || 0)
    }));
  }

  async getEmploymentTypeById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT et.*,
        (SELECT COUNT(*) FROM employees e WHERE e.employment_type = et.code OR e.employment_type = et.id) AS headcount
      FROM employment_types et
      WHERE et.id = ? OR et.code = ?
    `, [id, id]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      ...r,
      pf_esi_eligible: Boolean(r.pf_esi_eligible),
      active: Boolean(r.active),
      headcount: Number(r.headcount || 0)
    };
  }

  async insertEmploymentType(data) {
    const pool = await this.getPool();
    const id = data.id || ('ET_' + data.code.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    await pool.execute(
      `INSERT INTO employment_types (id, code, title, description, probation_days, notice_period_days, pf_esi_eligible, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.code.toUpperCase(),
        data.title,
        data.description || null,
        data.probation_days !== undefined ? data.probation_days : 90,
        data.notice_period_days !== undefined ? data.notice_period_days : 30,
        data.pf_esi_eligible ? 1 : 0,
        data.active !== undefined ? (data.active ? 1 : 0) : 1
      ]
    );
    return { id, code: data.code.toUpperCase() };
  }

  async updateEmploymentType(id, data) {
    const pool = await this.getPool();
    await pool.execute(
      `UPDATE employment_types SET
        code = ?,
        title = ?,
        description = ?,
        probation_days = ?,
        notice_period_days = ?,
        pf_esi_eligible = ?,
        active = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        data.code.toUpperCase(),
        data.title,
        data.description || null,
        data.probation_days !== undefined ? data.probation_days : 90,
        data.notice_period_days !== undefined ? data.notice_period_days : 30,
        data.pf_esi_eligible ? 1 : 0,
        data.active ? 1 : 0,
        id
      ]
    );
    return { id, updated: true };
  }

  async deleteEmploymentType(id) {
    const pool = await this.getPool();
    const [emps] = await pool.execute(
      'SELECT COUNT(*) as cnt FROM employees WHERE employment_type = ? OR employment_type = (SELECT code FROM employment_types WHERE id = ?)',
      [id, id]
    );
    if (emps[0]?.cnt > 0) {
      throw new Error(`Cannot delete employment type: ${emps[0].cnt} employee(s) currently assigned.`);
    }
    await pool.execute('DELETE FROM employment_types WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  // ──────────────────────────────────────────────
  // 17. Employee Cohort Groups Master
  // ──────────────────────────────────────────────
  async getAllEmployeeCohortGroups() {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT g.*,
        e.name AS leader_name,
        (SELECT COUNT(*) FROM employee_cohort_members m WHERE m.group_id = g.id) AS members_count
      FROM employee_cohort_groups g
      LEFT JOIN employees e ON g.leader_emp_id = e.id
      ORDER BY g.active DESC, g.name ASC
    `);
    return rows.map(r => ({
      ...r,
      active: Boolean(r.active),
      members_count: Number(r.members_count || 0)
    }));
  }

  async getEmployeeCohortGroupById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT g.*,
        e.name AS leader_name,
        (SELECT COUNT(*) FROM employee_cohort_members m WHERE m.group_id = g.id) AS members_count
      FROM employee_cohort_groups g
      LEFT JOIN employees e ON g.leader_emp_id = e.id
      WHERE g.id = ? OR g.code = ?
    `, [id, id]);
    if (rows.length === 0) return null;
    const g = rows[0];

    const [members] = await pool.execute(`
      SELECT m.emp_id, m.role_in_group, m.assigned_at, e.name, e.department, e.role, e.image, e.status
      FROM employee_cohort_members m
      JOIN employees e ON m.emp_id = e.id
      WHERE m.group_id = ?
      ORDER BY e.name ASC
    `, [g.id]);

    return {
      ...g,
      active: Boolean(g.active),
      members_count: members.length,
      members
    };
  }

  async insertEmployeeCohortGroup(data) {
    const pool = await this.getPool();
    const id = data.id || ('EGRP_' + data.code.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    await pool.execute(
      `INSERT INTO employee_cohort_groups (id, code, name, category, description, leader_emp_id, color, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.code.toUpperCase(),
        data.name,
        data.category || 'OPERATIONAL',
        data.description || null,
        data.leader_emp_id || null,
        data.color || '#4f8ef7',
        data.active !== undefined ? (data.active ? 1 : 0) : 1
      ]
    );
    return { id, code: data.code.toUpperCase() };
  }

  async updateEmployeeCohortGroup(id, data) {
    const pool = await this.getPool();
    await pool.execute(
      `UPDATE employee_cohort_groups SET
        code = ?,
        name = ?,
        category = ?,
        description = ?,
        leader_emp_id = ?,
        color = ?,
        active = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        data.code.toUpperCase(),
        data.name,
        data.category || 'OPERATIONAL',
        data.description || null,
        data.leader_emp_id || null,
        data.color || '#4f8ef7',
        data.active ? 1 : 0,
        id
      ]
    );
    return { id, updated: true };
  }

  async deleteEmployeeCohortGroup(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM employee_cohort_groups WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  async setEmployeeCohortGroupMembers(groupId, empIds, roleInGroup = 'Member') {
    const pool = await this.getPool();
    const ids = Array.isArray(empIds) ? empIds : [empIds];

    await pool.execute('DELETE FROM employee_cohort_members WHERE group_id = ?', [groupId]);

    if (ids.length > 0) {
      const placeholders = ids.map(() => '(?, ?, ?)').join(', ');
      const values = [];
      for (const eid of ids) {
        values.push(groupId, eid, roleInGroup || 'Member');
      }
      await pool.query(`INSERT INTO employee_cohort_members (group_id, emp_id, role_in_group) VALUES ${placeholders}`, values);
    }

    return { group_id: groupId, members_count: ids.length };
  }

  // ──────────────────────────────────────────────
  // 19. Geofences
  // ──────────────────────────────────────────────
  async getAllGeofences() {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM geofences ORDER BY name ASC');
    return rows.map(r => {
      if (typeof r.allowed_depts === 'string') {
        try { r.allowed_depts = JSON.parse(r.allowed_depts); } catch {}
      }
      return r;
    });
  }

  async getGeofenceById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM geofences WHERE id = ?', [id]);
    if (!rows[0]) return null;
    const r = rows[0];
    if (typeof r.allowed_depts === 'string') {
      try { r.allowed_depts = JSON.parse(r.allowed_depts); } catch {}
    }
    return r;
  }

  async insertGeofence(data) {
    const pool = await this.getPool();
    const id = data.id || `GEO_${Date.now().toString(36).toUpperCase()}`;
    const allowedDeptsJson = Array.isArray(data.allowed_depts) ? JSON.stringify(data.allowed_depts) : (typeof data.allowed_depts === 'string' ? data.allowed_depts : null);
    await pool.execute(
      `INSERT INTO geofences (id, code, name, latitude, longitude, radius_meters, enforcement_mode, allowed_depts, ip_range, wifi_bssid, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.code.toUpperCase(),
        data.name,
        parseFloat(data.latitude) || 0,
        parseFloat(data.longitude) || 0,
        parseInt(data.radius_meters || 150, 10),
        data.enforcement_mode || 'STRICT',
        allowedDeptsJson,
        data.ip_range || null,
        data.wifi_bssid || null,
        data.active !== undefined ? (data.active ? 1 : 0) : 1
      ]
    );
    return this.getGeofenceById(id);
  }

  async updateGeofence(id, data) {
    const pool = await this.getPool();
    const allowedDeptsJson = Array.isArray(data.allowed_depts) ? JSON.stringify(data.allowed_depts) : (typeof data.allowed_depts === 'string' ? data.allowed_depts : null);
    await pool.execute(
      `UPDATE geofences SET
        code = ?,
        name = ?,
        latitude = ?,
        longitude = ?,
        radius_meters = ?,
        enforcement_mode = ?,
        allowed_depts = ?,
        ip_range = ?,
        wifi_bssid = ?,
        active = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        data.code.toUpperCase(),
        data.name,
        parseFloat(data.latitude) || 0,
        parseFloat(data.longitude) || 0,
        parseInt(data.radius_meters || 150, 10),
        data.enforcement_mode || 'STRICT',
        allowedDeptsJson,
        data.ip_range || null,
        data.wifi_bssid || null,
        data.active !== undefined ? (data.active ? 1 : 0) : 1,
        id
      ]
    );
    return this.getGeofenceById(id);
  }

  async deleteGeofence(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM geofences WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  // ──────────────────────────────────────────────
  // 20. Work Codes
  // ──────────────────────────────────────────────
  async getAllWorkCodes() {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM work_codes ORDER BY category ASC, code ASC');
    return rows;
  }

  async getWorkCodeById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM work_codes WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async insertWorkCode(data) {
    const pool = await this.getPool();
    const id = data.id || `WC_${Date.now().toString(36).toUpperCase()}`;
    await pool.execute(
      `INSERT INTO work_codes (id, code, name, category, description, billing_rate_multiplier, ot_eligible, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.code.toUpperCase(),
        data.name,
        data.category || 'BILLABLE_PROJECT',
        data.description || null,
        parseFloat(data.billing_rate_multiplier || 1.00),
        data.ot_eligible !== undefined ? (data.ot_eligible ? 1 : 0) : 1,
        data.active !== undefined ? (data.active ? 1 : 0) : 1
      ]
    );
    return this.getWorkCodeById(id);
  }

  async updateWorkCode(id, data) {
    const pool = await this.getPool();
    await pool.execute(
      `UPDATE work_codes SET
        code = ?,
        name = ?,
        category = ?,
        description = ?,
        billing_rate_multiplier = ?,
        ot_eligible = ?,
        active = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        data.code.toUpperCase(),
        data.name,
        data.category || 'BILLABLE_PROJECT',
        data.description || null,
        parseFloat(data.billing_rate_multiplier || 1.00),
        data.ot_eligible !== undefined ? (data.ot_eligible ? 1 : 0) : 1,
        data.active !== undefined ? (data.active ? 1 : 0) : 1,
        id
      ]
    );
    return this.getWorkCodeById(id);
  }

  async deleteWorkCode(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM work_codes WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  // ──────────────────────────────────────────────
  // 21. Employee Overtime Register
  // ──────────────────────────────────────────────
  async getOtRegister({ emp_id, start_date, end_date, status, limit = 50, offset = 0 } = {}) {
    const pool = await this.getPool();
    let whereClauses = [];
    let params = [];

    if (emp_id) {
      whereClauses.push('o.emp_id = ?');
      params.push(emp_id);
    }
    if (start_date) {
      whereClauses.push('o.ot_date >= ?');
      params.push(start_date);
    }
    if (end_date) {
      whereClauses.push('o.ot_date <= ?');
      params.push(end_date);
    }
    if (status) {
      whereClauses.push('o.status = ?');
      params.push(status);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM ot_records o ${whereStr}`;
    const [countRows] = await pool.execute(countSql, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT o.*, e.name as employee_name, e.department, e.role as employee_role, s.name as shift_name
      FROM ot_records o
      LEFT JOIN employees e ON o.emp_id = e.id
      LEFT JOIN shifts s ON o.shift_id = s.id
      ${whereStr}
      ORDER BY o.ot_date DESC, o.id DESC
      LIMIT ? OFFSET ?
    `;
    const queryParams = [...params, String(limit), String(offset)];
    const [rows] = await pool.execute(dataSql, queryParams);

    return { total, rows };
  }

  async getOtRecordById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(
      `SELECT o.*, e.name as employee_name, e.department, e.role as employee_role, s.name as shift_name
       FROM ot_records o
       LEFT JOIN employees e ON o.emp_id = e.id
       LEFT JOIN shifts s ON o.shift_id = s.id
       WHERE o.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  async insertOtRecord(data) {
    const pool = await this.getPool();
    const [result] = await pool.execute(
      `INSERT INTO ot_records (emp_id, ot_date, shift_id, scheduled_hours, actual_hours, ot_hours, ot_multiplier, ot_rate_type, status, approved_by, approved_at, comments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        shift_id = VALUES(shift_id),
        scheduled_hours = VALUES(scheduled_hours),
        actual_hours = VALUES(actual_hours),
        ot_hours = VALUES(ot_hours),
        ot_multiplier = VALUES(ot_multiplier),
        ot_rate_type = VALUES(ot_rate_type),
        status = VALUES(status),
        comments = VALUES(comments),
        updated_at = NOW()`,
      [
        data.emp_id,
        data.ot_date,
        data.shift_id || 'SHIFT_GEN',
        parseFloat(data.scheduled_hours || 8.0),
        parseFloat(data.actual_hours || 8.0),
        parseFloat(data.ot_hours || 0.0),
        parseFloat(data.ot_multiplier || 1.5),
        data.ot_rate_type || 'STANDARD_DAY',
        data.status || 'PENDING',
        data.approved_by || null,
        data.approved_at || null,
        data.comments || null
      ]
    );
    const id = result.insertId || (await this.getOtRecordByEmpDate(data.emp_id, data.ot_date))?.id;
    return this.getOtRecordById(id);
  }

  async getOtRecordByEmpDate(empId, otDate) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM ot_records WHERE emp_id = ? AND ot_date = ?', [empId, otDate]);
    return rows[0] || null;
  }

  async updateOtStatus(id, { status, approved_by, comments }) {
    const pool = await this.getPool();
    const approvedAt = (status === 'APPROVED' || status === 'COMP_OFF') ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
    await pool.execute(
      `UPDATE ot_records SET
        status = ?,
        approved_by = ?,
        approved_at = ?,
        comments = COALESCE(?, comments),
        updated_at = NOW()
       WHERE id = ?`,
      [status, approved_by || null, approvedAt, comments || null, id]
    );
    return this.getOtRecordById(id);
  }

  async bulkUpdateOtStatus(ids, { status, approved_by, comments }) {
    const pool = await this.getPool();
    if (!ids || ids.length === 0) return { updated: 0 };
    const approvedAt = (status === 'APPROVED' || status === 'COMP_OFF') ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
    const placeholders = ids.map(() => '?').join(',');
    const [result] = await pool.execute(
      `UPDATE ot_records SET
        status = ?,
        approved_by = ?,
        approved_at = ?,
        comments = COALESCE(?, comments),
        updated_at = NOW()
       WHERE id IN (${placeholders})`,
      [status, approved_by || null, approvedAt, comments || null, ...ids]
    );
    return { updated: result.affectedRows };
  }

  async deleteOtRecord(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM ot_records WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  // ──────────────────────────────────────────────
  // 22. Attendance Log Advanced Queries & Regularization
  // ──────────────────────────────────────────────
  async getDetailedAttendanceLog({ emp_id, dept, status, start_date, end_date, search, limit = 20, offset = 0 } = {}) {
    const pool = await this.getPool();
    let whereClauses = [];
    let params = [];

    if (emp_id) {
      whereClauses.push('a.emp_id = ?');
      params.push(emp_id);
    }
    if (dept) {
      whereClauses.push('a.dept = ?');
      params.push(dept);
    }
    if (status) {
      whereClauses.push('a.status = ?');
      params.push(status);
    }
    if (start_date) {
      whereClauses.push('a.timestamp >= ?');
      params.push(start_date.includes(' ') ? start_date : `${start_date} 00:00:00`);
    }
    if (end_date) {
      whereClauses.push('a.timestamp <= ?');
      params.push(end_date.includes(' ') ? end_date : `${end_date} 23:59:59`);
    }
    if (search) {
      whereClauses.push('(a.name LIKE ? OR a.emp_id LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM attendance a ${whereStr}`;
    const [countRows] = await pool.execute(countSql, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT a.*, e.image, e.employment_type, e.designation, e.company
      FROM attendance a
      LEFT JOIN employees e ON a.emp_id = e.id
      ${whereStr}
      ORDER BY a.timestamp DESC
      LIMIT ? OFFSET ?
    `;
    const queryParams = [...params, String(limit), String(offset)];
    const [rows] = await pool.execute(dataSql, queryParams);

    return { total, rows };
  }

  async getAttendanceLogStats(date) {
    const pool = await this.getPool();
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const [rows] = await pool.execute(
      `SELECT
        COUNT(*) as total_punches,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as on_time_count,
        SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late_count,
        COUNT(DISTINCT emp_id) as unique_employees
       FROM attendance
       WHERE timestamp >= ? AND timestamp < DATE_ADD(?, INTERVAL 1 DAY)`,
      [`${targetDate} 00:00:00`, `${targetDate} 00:00:00`]
    );
    const stats = rows[0] || { total_punches: 0, on_time_count: 0, late_count: 0, unique_employees: 0 };
    stats.on_time_rate = stats.total_punches > 0
      ? Math.round((Number(stats.on_time_count) / Number(stats.total_punches)) * 100)
      : 100;
    return stats;
  }

  async regularizeAttendance({ att_id, emp_id, timestamp, status, reason, regularized_by }) {
    const pool = await this.getPool();
    const formattedTs = this._formatDatetime(timestamp);
    if (att_id) {
      await pool.execute(
        `UPDATE attendance SET
          timestamp = ?,
          status = ?,
          logged_by = CONCAT(COALESCE(logged_by, 'PUNCH'), ' [REGULARIZED by ', ?, ': ', ?, ']')
         WHERE att_id = ?`,
        [formattedTs, status || 'Present', regularized_by || 'HR Admin', reason || 'Regularization', att_id]
      );
      const [updated] = await pool.execute('SELECT * FROM attendance WHERE att_id = ?', [att_id]);
      return updated[0] || null;
    } else if (emp_id) {
      const [empRows] = await pool.execute('SELECT * FROM employees WHERE id = ?', [emp_id]);
      const emp = empRows[0];
      if (!emp) throw new Error('Employee not found');
      const [res] = await pool.execute(
        `INSERT INTO attendance (emp_id, name, dept, role, timestamp, status, logged_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          emp.id,
          emp.name,
          emp.department || 'Operations',
          emp.role || 'Staff',
          formattedTs,
          status || 'Present',
          `MANUAL_REGULARIZED (${regularized_by || 'HR Admin'}: ${reason || 'Attendance regularized'})`
        ]
      );
      const [inserted] = await pool.execute('SELECT * FROM attendance WHERE att_id = ?', [res.insertId]);
      return inserted[0] || null;
    } else {
      throw new Error('Either att_id or emp_id is required for attendance regularization');
    }
  }

  // ──────────────────────────────────────────────
  // 23. Leave Types (Organization Master)
  // ──────────────────────────────────────────────
  async getAllLeaveTypes() {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM leave_types ORDER BY paid DESC, name ASC');
    return rows;
  }

  async getLeaveTypeById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM leave_types WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async insertLeaveType(data) {
    const pool = await this.getPool();
    const id = data.id || `LT_${data.code.toUpperCase()}`;
    await pool.execute(
      `INSERT INTO leave_types (id, code, name, category, description, paid, annual_quota_days, carry_forward_max, encashable, color, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.code.toUpperCase(),
        data.name,
        data.category || 'CASUAL',
        data.description || null,
        data.paid !== undefined ? (data.paid ? 1 : 0) : 1,
        parseFloat(data.annual_quota_days || 12.0),
        parseFloat(data.carry_forward_max || 0.0),
        data.encashable ? 1 : 0,
        data.color || '#4f8ef7',
        data.active !== undefined ? (data.active ? 1 : 0) : 1
      ]
    );
    return this.getLeaveTypeById(id);
  }

  async updateLeaveType(id, data) {
    const pool = await this.getPool();
    await pool.execute(
      `UPDATE leave_types SET
        code = ?,
        name = ?,
        category = ?,
        description = ?,
        paid = ?,
        annual_quota_days = ?,
        carry_forward_max = ?,
        encashable = ?,
        color = ?,
        active = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        data.code.toUpperCase(),
        data.name,
        data.category || 'CASUAL',
        data.description || null,
        data.paid !== undefined ? (data.paid ? 1 : 0) : 1,
        parseFloat(data.annual_quota_days || 12.0),
        parseFloat(data.carry_forward_max || 0.0),
        data.encashable ? 1 : 0,
        data.color || '#4f8ef7',
        data.active !== undefined ? (data.active ? 1 : 0) : 1,
        id
      ]
    );
    return this.getLeaveTypeById(id);
  }

  async deleteLeaveType(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM leave_types WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  // ──────────────────────────────────────────────
  // 24. Employee Leave Entries (Applications & Balances)
  // ──────────────────────────────────────────────
  async getLeaveEntries({ emp_id, leave_type_id, status, start_date, end_date, limit = 50, offset = 0 } = {}) {
    const pool = await this.getPool();
    let whereClauses = [];
    let params = [];

    if (emp_id) {
      whereClauses.push('l.emp_id = ?');
      params.push(emp_id);
    }
    if (leave_type_id) {
      whereClauses.push('l.leave_type_id = ?');
      params.push(leave_type_id);
    }
    if (status) {
      whereClauses.push('l.status = ?');
      params.push(status);
    }
    if (start_date) {
      whereClauses.push('l.end_date >= ?');
      params.push(start_date);
    }
    if (end_date) {
      whereClauses.push('l.start_date <= ?');
      params.push(end_date);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM employee_leave_entries l ${whereStr}`;
    const [countRows] = await pool.execute(countSql, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT l.*, e.name as employee_name, e.department, e.role as employee_role, lt.name as leave_type_name, lt.code as leave_type_code, lt.color as leave_type_color, lt.paid as leave_type_paid
      FROM employee_leave_entries l
      LEFT JOIN employees e ON l.emp_id = e.id
      LEFT JOIN leave_types lt ON l.leave_type_id = lt.id
      ${whereStr}
      ORDER BY l.start_date DESC, l.id DESC
      LIMIT ? OFFSET ?
    `;
    const queryParams = [...params, String(limit), String(offset)];
    const [rows] = await pool.execute(dataSql, queryParams);

    return { total, rows };
  }

  async getLeaveEntryById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(
      `SELECT l.*, e.name as employee_name, e.department, e.role as employee_role, lt.name as leave_type_name, lt.code as leave_type_code, lt.color as leave_type_color, lt.paid as leave_type_paid
       FROM employee_leave_entries l
       LEFT JOIN employees e ON l.emp_id = e.id
       LEFT JOIN leave_types lt ON l.leave_type_id = lt.id
       WHERE l.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  async insertLeaveEntry(data) {
    const pool = await this.getPool();
    const [result] = await pool.execute(
      `INSERT INTO employee_leave_entries (emp_id, leave_type_id, start_date, end_date, total_days, reason, status, approved_by, approved_at, comments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.emp_id,
        data.leave_type_id,
        data.start_date,
        data.end_date,
        parseFloat(data.total_days || 1.0),
        data.reason,
        data.status || 'PENDING',
        data.approved_by || null,
        data.approved_at || null,
        data.comments || null
      ]
    );
    return this.getLeaveEntryById(result.insertId);
  }

  async updateLeaveEntryStatus(id, { status, approved_by, comments }) {
    const pool = await this.getPool();
    const approvedAt = (status === 'APPROVED') ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
    await pool.execute(
      `UPDATE employee_leave_entries SET
        status = ?,
        approved_by = ?,
        approved_at = ?,
        comments = COALESCE(?, comments),
        updated_at = NOW()
       WHERE id = ?`,
      [status, approved_by || null, approvedAt, comments || null, id]
    );
    return this.getLeaveEntryById(id);
  }

  async deleteLeaveEntry(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM employee_leave_entries WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  async getEmployeeLeaveBalances(empId, year) {
    const pool = await this.getPool();
    const targetYear = year || new Date().getFullYear();
    const leaveTypes = await this.getAllLeaveTypes();

    const [usedRows] = await pool.execute(
      `SELECT leave_type_id, SUM(total_days) as used_days
       FROM employee_leave_entries
       WHERE emp_id = ? AND status = 'APPROVED' AND YEAR(start_date) = ?
       GROUP BY leave_type_id`,
      [empId, targetYear]
    );

    const usedMap = {};
    for (const u of usedRows) {
      usedMap[u.leave_type_id] = parseFloat(u.used_days || 0);
    }

    return leaveTypes.map(lt => {
      const quota = parseFloat(lt.annual_quota_days || 0);
      const used = usedMap[lt.id] || 0;
      const available = Math.max(0, quota - used);
      return {
        leave_type_id: lt.id,
        code: lt.code,
        name: lt.name,
        color: lt.color,
        paid: !!lt.paid,
        annual_quota: quota,
        used_days: used,
        available_days: available
      };
    });
  }

  // ──────────────────────────────────────────────
  // 25. Employee Outdoor / On-Duty Entries
  // ──────────────────────────────────────────────
  async getOutdoorEntries({ emp_id, status, start_date, end_date, limit = 50, offset = 0 } = {}) {
    const pool = await this.getPool();
    let whereClauses = [];
    let params = [];

    if (emp_id) {
      whereClauses.push('o.emp_id = ?');
      params.push(emp_id);
    }
    if (status) {
      whereClauses.push('o.status = ?');
      params.push(status);
    }
    if (start_date) {
      whereClauses.push('o.od_date >= ?');
      params.push(start_date);
    }
    if (end_date) {
      whereClauses.push('o.od_date <= ?');
      params.push(end_date);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM employee_outdoor_entries o ${whereStr}`;
    const [countRows] = await pool.execute(countSql, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT o.*, e.name as employee_name, e.department, e.role as employee_role
      FROM employee_outdoor_entries o
      LEFT JOIN employees e ON o.emp_id = e.id
      ${whereStr}
      ORDER BY o.od_date DESC, o.id DESC
      LIMIT ? OFFSET ?
    `;
    const queryParams = [...params, String(limit), String(offset)];
    const [rows] = await pool.execute(dataSql, queryParams);

    return { total, rows };
  }

  async getOutdoorEntryById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(
      `SELECT o.*, e.name as employee_name, e.department, e.role as employee_role
       FROM employee_outdoor_entries o
       LEFT JOIN employees e ON o.emp_id = e.id
       WHERE o.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  async insertOutdoorEntry(data) {
    const pool = await this.getPool();
    const [result] = await pool.execute(
      `INSERT INTO employee_outdoor_entries (emp_id, od_date, start_time, end_time, destination_client, purpose, travel_allowance_eligible, status, approved_by, approved_at, comments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.emp_id,
        data.od_date,
        data.start_time || '09:00:00',
        data.end_time || '18:00:00',
        data.destination_client,
        data.purpose,
        data.travel_allowance_eligible !== undefined ? (data.travel_allowance_eligible ? 1 : 0) : 1,
        data.status || 'PENDING',
        data.approved_by || null,
        data.approved_at || null,
        data.comments || null
      ]
    );
    return this.getOutdoorEntryById(result.insertId);
  }

  async updateOutdoorEntryStatus(id, { status, approved_by, comments }) {
    const pool = await this.getPool();
    const approvedAt = (status === 'APPROVED') ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
    await pool.execute(
      `UPDATE employee_outdoor_entries SET
        status = ?,
        approved_by = ?,
        approved_at = ?,
        comments = COALESCE(?, comments),
        updated_at = NOW()
       WHERE id = ?`,
      [status, approved_by || null, approvedAt, comments || null, id]
    );
    return this.getOutdoorEntryById(id);
  }

  async deleteOutdoorEntry(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM employee_outdoor_entries WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  // ──────────────────────────────────────────────
  // 🏢 Divisions Master
  // ──────────────────────────────────────────────
  async getAllDivisions({ company_id, active } = {}) {
    const pool = await this.getPool();
    let sql = `
      SELECT d.*, c.name as company_name, c.code as company_code, e.name as head_emp_name
      FROM divisions d
      LEFT JOIN companies c ON d.company_id = c.id
      LEFT JOIN employees e ON d.head_emp_id = e.id
      WHERE 1=1
    `;
    const params = [];
    if (company_id) { sql += ' AND d.company_id = ?'; params.push(company_id); }
    if (active !== undefined && active !== null) { sql += ' AND d.active = ?'; params.push(active ? 1 : 0); }
    sql += ' ORDER BY d.name ASC';
    const [rows] = await pool.execute(sql, params);
    return rows;
  }

  async getDivisionById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT d.*, c.name as company_name, c.code as company_code, e.name as head_emp_name
      FROM divisions d
      LEFT JOIN companies c ON d.company_id = c.id
      LEFT JOIN employees e ON d.head_emp_id = e.id
      WHERE d.id = ?
    `, [id]);
    return rows[0] || null;
  }

  async getDivisionByCode(code) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM divisions WHERE code = ?', [code]);
    return rows[0] || null;
  }

  async insertDivision(data) {
    const pool = await this.getPool();
    const id = data.id || `DIV_${data.code || Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await pool.execute(
      `INSERT INTO divisions (id, code, name, company_id, head_emp_id, budget_code, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        id,
        data.code,
        data.name,
        data.company_id,
        data.head_emp_id || null,
        data.budget_code || null,
        data.active !== undefined ? (data.active ? 1 : 0) : 1
      ]
    );
    return this.getDivisionById(id);
  }

  async updateDivision(data) {
    const pool = await this.getPool();
    await pool.execute(
      `UPDATE divisions SET
         code = COALESCE(?, code),
         name = COALESCE(?, name),
         company_id = COALESCE(?, company_id),
         head_emp_id = ?,
         budget_code = COALESCE(?, budget_code),
         active = COALESCE(?, active),
         updated_at = NOW()
       WHERE id = ?`,
      [
        data.code || null,
        data.name || null,
        data.company_id || null,
        data.head_emp_id !== undefined ? (data.head_emp_id || null) : null,
        data.budget_code || null,
        data.active !== undefined ? (data.active ? 1 : 0) : null,
        data.id
      ]
    );
    return this.getDivisionById(data.id);
  }

  async deleteDivision(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM divisions WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  // ──────────────────────────────────────────────
  // 💰 Cost Centers Master
  // ──────────────────────────────────────────────
  async getAllCostCenters({ company_id, dept_id, active } = {}) {
    const pool = await this.getPool();
    let sql = `
      SELECT cc.*, c.name as company_name, c.code as company_code, d.name as dept_name
      FROM cost_centers cc
      LEFT JOIN companies c ON cc.company_id = c.id
      LEFT JOIN departments d ON cc.dept_id = d.id
      WHERE 1=1
    `;
    const params = [];
    if (company_id) { sql += ' AND cc.company_id = ?'; params.push(company_id); }
    if (dept_id) { sql += ' AND cc.dept_id = ?'; params.push(dept_id); }
    if (active !== undefined && active !== null) { sql += ' AND cc.active = ?'; params.push(active ? 1 : 0); }
    sql += ' ORDER BY cc.name ASC';
    const [rows] = await pool.execute(sql, params);
    return rows;
  }

  async getCostCenterById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT cc.*, c.name as company_name, c.code as company_code, d.name as dept_name
      FROM cost_centers cc
      LEFT JOIN companies c ON cc.company_id = c.id
      LEFT JOIN departments d ON cc.dept_id = d.id
      WHERE cc.id = ?
    `, [id]);
    return rows[0] || null;
  }

  async getCostCenterByCode(code) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM cost_centers WHERE code = ?', [code]);
    return rows[0] || null;
  }

  async insertCostCenter(data) {
    const pool = await this.getPool();
    const id = data.id || `CC_${data.code || Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await pool.execute(
      `INSERT INTO cost_centers (id, code, name, company_id, dept_id, gl_account, annual_budget, currency, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        id,
        data.code,
        data.name,
        data.company_id,
        data.dept_id || null,
        data.gl_account || null,
        data.annual_budget || 0.00,
        data.currency || 'INR',
        data.active !== undefined ? (data.active ? 1 : 0) : 1
      ]
    );
    return this.getCostCenterById(id);
  }

  async updateCostCenter(data) {
    const pool = await this.getPool();
    await pool.execute(
      `UPDATE cost_centers SET
         code = COALESCE(?, code),
         name = COALESCE(?, name),
         company_id = COALESCE(?, company_id),
         dept_id = ?,
         gl_account = COALESCE(?, gl_account),
         annual_budget = COALESCE(?, annual_budget),
         currency = COALESCE(?, currency),
         active = COALESCE(?, active),
         updated_at = NOW()
       WHERE id = ?`,
      [
        data.code || null,
        data.name || null,
        data.company_id || null,
        data.dept_id !== undefined ? (data.dept_id || null) : null,
        data.gl_account || null,
        data.annual_budget !== undefined ? data.annual_budget : null,
        data.currency || null,
        data.active !== undefined ? (data.active ? 1 : 0) : null,
        data.id
      ]
    );
    return this.getCostCenterById(data.id);
  }

  async deleteCostCenter(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM cost_centers WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  // ──────────────────────────────────────────────
  // 📟 Biometric Devices & Terminals
  // ──────────────────────────────────────────────
  async getAllDevices({ branch_id, status, active } = {}) {
    const pool = await this.getPool();
    let sql = `
      SELECT bd.*, b.name as branch_name, b.code as branch_code, b.city as branch_city
      FROM biometric_devices bd
      LEFT JOIN branches b ON bd.branch_id = b.id
      WHERE 1=1
    `;
    const params = [];
    if (branch_id) { sql += ' AND bd.branch_id = ?'; params.push(branch_id); }
    if (status) { sql += ' AND bd.status = ?'; params.push(status); }
    if (active !== undefined && active !== null) { sql += ' AND bd.active = ?'; params.push(active ? 1 : 0); }
    sql += ' ORDER BY bd.device_name ASC';
    const [rows] = await pool.execute(sql, params);
    return rows;
  }

  async getDeviceById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT bd.*, b.name as branch_name, b.code as branch_code, b.city as branch_city
      FROM biometric_devices bd
      LEFT JOIN branches b ON bd.branch_id = b.id
      WHERE bd.id = ?
    `, [id]);
    return rows[0] || null;
  }

  async getDeviceBySerial(serial) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM biometric_devices WHERE serial_number = ?', [serial]);
    return rows[0] || null;
  }

  async insertDevice(data) {
    const pool = await this.getPool();
    const id = data.id || `DEV_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await pool.execute(
      `INSERT INTO biometric_devices (id, serial_number, device_name, device_ip, device_port, device_model, protocol, branch_id, direction, status, template_count, buffer_lag_ms, active, last_heartbeat, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
      [
        id,
        data.serial_number,
        data.device_name,
        data.device_ip,
        data.device_port || 4370,
        data.device_model || 'eSSL SilkBio-101TC',
        data.protocol || 'ESSL',
        data.branch_id || null,
        data.direction || 'BOTH',
        data.status || 'ONLINE',
        data.template_count || 0,
        data.buffer_lag_ms || 10,
        data.active !== undefined ? (data.active ? 1 : 0) : 1
      ]
    );
    return this.getDeviceById(id);
  }

  async updateDevice(data) {
    const pool = await this.getPool();
    await pool.execute(
      `UPDATE biometric_devices SET
         serial_number = COALESCE(?, serial_number),
         device_name = COALESCE(?, device_name),
         device_ip = COALESCE(?, device_ip),
         device_port = COALESCE(?, device_port),
         device_model = COALESCE(?, device_model),
         protocol = COALESCE(?, protocol),
         branch_id = ?,
         direction = COALESCE(?, direction),
         status = COALESCE(?, status),
         active = COALESCE(?, active),
         updated_at = NOW()
       WHERE id = ?`,
      [
        data.serial_number || null,
        data.device_name || null,
        data.device_ip || null,
        data.device_port || null,
        data.device_model || null,
        data.protocol || null,
        data.branch_id !== undefined ? (data.branch_id || null) : null,
        data.direction || null,
        data.status || null,
        data.active !== undefined ? (data.active ? 1 : 0) : null,
        data.id
      ]
    );
    return this.getDeviceById(data.id);
  }

  async deleteDevice(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM biometric_devices WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  async pingDevice(id) {
    const pool = await this.getPool();
    const lag = Math.floor(Math.random() * 20) + 5;
    await pool.execute(
      `UPDATE biometric_devices SET last_heartbeat = NOW(), status = 'ONLINE', buffer_lag_ms = ?, updated_at = NOW() WHERE id = ?`,
      [lag, id]
    );
    return this.getDeviceById(id);
  }

  async syncDeviceTemplates(id) {
    const pool = await this.getPool();
    const [empCount] = await pool.query("SELECT COUNT(*) as count FROM employees WHERE status = 'Active'");
    const totalTemplates = empCount[0]?.count || 0;
    await pool.execute(
      `UPDATE biometric_devices SET template_count = ?, last_heartbeat = NOW(), updated_at = NOW() WHERE id = ?`,
      [totalTemplates, id]
    );
    return { id, template_count: totalTemplates, synced: true };
  }

  // ──────────────────────────────────────────────
  // 🔄 Employee Career Transfers & Promotions
  // ──────────────────────────────────────────────
  async getTransfers({ emp_id, limit = 50 } = {}) {
    const pool = await this.getPool();
    let sql = `
      SELECT t.*, e.name as emp_name,
             c_old.name as prev_company_name, c_new.name as new_company_name,
             d_old.name as prev_dept_name, d_new.name as new_dept_name,
             des_old.name as prev_desig_name, des_new.name as new_desig_name,
             b_old.name as prev_branch_name, b_new.name as new_branch_name
      FROM employee_transfers t
      LEFT JOIN employees e ON t.emp_id = e.id
      LEFT JOIN companies c_old ON t.prev_company_id = c_old.id
      LEFT JOIN companies c_new ON t.new_company_id = c_new.id
      LEFT JOIN departments d_old ON t.prev_dept_id = d_old.id
      LEFT JOIN departments d_new ON t.new_dept_id = d_new.id
      LEFT JOIN designations des_old ON t.prev_desig_id = des_old.id
      LEFT JOIN designations des_new ON t.new_desig_id = des_new.id
      LEFT JOIN branches b_old ON t.prev_branch_id = b_old.id
      LEFT JOIN branches b_new ON t.new_branch_id = b_new.id
      WHERE 1=1
    `;
    const params = [];
    if (emp_id) { sql += ' AND t.emp_id = ?'; params.push(emp_id); }
    sql += ' ORDER BY t.effective_date DESC, t.id DESC LIMIT ?';
    params.push(Number(limit));
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async recordEmployeeTransfer(data) {
    const pool = await this.getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Get current employee state
      const [empRows] = await conn.execute('SELECT * FROM employees WHERE id = ? FOR UPDATE', [data.emp_id]);
      if (empRows.length === 0) throw new Error('Employee not found: ' + data.emp_id);
      const curEmp = empRows[0];

      // 1. Insert Transfer Record
      const [res] = await conn.execute(
        `INSERT INTO employee_transfers (
           emp_id, prev_company_id, new_company_id,
           prev_dept_id, new_dept_id,
           prev_desig_id, new_desig_id,
           prev_branch_id, new_branch_id,
           transfer_type, effective_date, remarks, approved_by, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          data.emp_id,
          data.prev_company_id || curEmp.company_id || null,
          data.new_company_id || curEmp.company_id || null,
          data.prev_dept_id || curEmp.department_id || null,
          data.new_dept_id || curEmp.department_id || null,
          data.prev_desig_id || curEmp.designation_id || null,
          data.new_desig_id || curEmp.designation_id || null,
          data.prev_branch_id || curEmp.branch_id || null,
          data.new_branch_id || curEmp.branch_id || null,
          data.transfer_type || 'PROMOTION',
          data.effective_date || new Date().toISOString().slice(0, 10),
          data.remarks || null,
          data.approved_by || 'Admin'
        ]
      );

      // 2. Update Employee Profile
      await conn.execute(
        `UPDATE employees SET
           company_id = COALESCE(?, company_id),
           department_id = COALESCE(?, department_id),
           designation_id = COALESCE(?, designation_id),
           branch_id = COALESCE(?, branch_id),
           department = COALESCE((SELECT name FROM departments WHERE id = ?), department),
           role = COALESCE((SELECT name FROM designations WHERE id = ?), role),
           updated_at = NOW()
         WHERE id = ?`,
        [
          data.new_company_id || null,
          data.new_dept_id || null,
          data.new_desig_id || null,
          data.new_branch_id || null,
          data.new_dept_id || null,
          data.new_desig_id || null,
          data.emp_id
        ]
      );

      await conn.commit();
      return { id: res.insertId, emp_id: data.emp_id, success: true };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  // ──────────────────────────────────────────────
  // ⚡ High-Speed Fast Punch Buffer Pipeline
  // ──────────────────────────────────────────────
  async ingestFastPunch(data) {
    const pool = await this.getPool();
    const t0 = process.hrtime();
    const punchTime = data.punch_timestamp ? this._formatDatetime(data.punch_timestamp) : this._formatDatetime(new Date());

    const [res] = await pool.execute(
      `INSERT INTO fast_punch_buffer (
         emp_id, terminal_id, punch_timestamp, punch_state,
         verification_type, temperature, mask_detected, processed, process_latency_ms, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, NOW())`,
      [
        data.emp_id,
        data.terminal_id || 'TERMINAL_DEFAULT',
        punchTime,
        data.punch_state || 'AUTO',
        data.verification_type || 'FACE',
        data.temperature || null,
        data.mask_detected ? 1 : 0
      ]
    );

    const diff = process.hrtime(t0);
    const latencyMs = (diff[0] * 1000 + diff[1] / 1e6).toFixed(2);
    await pool.execute('UPDATE fast_punch_buffer SET process_latency_ms = ? WHERE id = ?', [latencyMs, res.insertId]);

    return {
      id: res.insertId,
      emp_id: data.emp_id,
      terminal_id: data.terminal_id,
      punch_timestamp: punchTime,
      latency_ms: parseFloat(latencyMs),
      status: 'QUEUED'
    };
  }

  async batchIngestFastPunches(punches) {
    if (!Array.isArray(punches) || punches.length === 0) return { inserted: 0, latency_ms: 0 };
    const pool = await this.getPool();
    const t0 = process.hrtime();

    const values = [];
    for (const p of punches) {
      const punchTime = p.punch_timestamp ? this._formatDatetime(p.punch_timestamp) : this._formatDatetime(new Date());
      values.push([
        p.emp_id,
        p.terminal_id || 'BATCH_TERMINAL',
        punchTime,
        p.punch_state || 'AUTO',
        p.verification_type || 'FACE',
        p.temperature || null,
        p.mask_detected ? 1 : 0,
        0,
        0
      ]);
    }

    const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const flatParams = values.flat();
    await pool.query(
      `INSERT INTO fast_punch_buffer (emp_id, terminal_id, punch_timestamp, punch_state, verification_type, temperature, mask_detected, processed, process_latency_ms)
       VALUES ${placeholders}`,
      flatParams
    );

    const diff = process.hrtime(t0);
    const latencyMs = (diff[0] * 1000 + diff[1] / 1e6).toFixed(2);

    return {
      inserted: punches.length,
      latency_ms: parseFloat(latencyMs),
      throughput_ops_sec: Math.round((punches.length / (parseFloat(latencyMs) / 1000)))
    };
  }

  async flushFastPunchBuffer(limit = 1000) {
    const pool = await this.getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [pending] = await conn.query(
        'SELECT * FROM fast_punch_buffer WHERE processed = 0 ORDER BY punch_timestamp ASC LIMIT ? FOR UPDATE',
        [Number(limit)]
      );

      let processedCount = 0;
      let duplicateCount = 0;

      for (const p of pending) {
        // Fast deduplication check within 5 min
        const [recent] = await conn.query(
          `SELECT att_id FROM attendance
           WHERE emp_id = ? AND timestamp >= DATE_SUB(?, INTERVAL 5 MINUTE) AND timestamp <= DATE_ADD(?, INTERVAL 5 MINUTE)
           LIMIT 1`,
          [p.emp_id, p.punch_timestamp, p.punch_timestamp]
        );

        if (recent.length > 0) {
          await conn.execute('UPDATE fast_punch_buffer SET processed = 2 WHERE id = ?', [p.id]);
          duplicateCount++;
        } else {
          // Write to attendance table
          await conn.execute(
            `INSERT INTO attendance (emp_id, name, dept, role, timestamp, status, logged_by, ip_address, user_agent)
             SELECT e.id, e.name, e.department, e.role, ?, 'Present', 'FastPunchEngine', '127.0.0.1', ?
             FROM employees e WHERE e.id = ?`,
            [p.punch_timestamp, p.terminal_id || 'Hardware Terminal', p.emp_id]
          );
          // Mark processed
          await conn.execute('UPDATE fast_punch_buffer SET processed = 1 WHERE id = ?', [p.id]);
          processedCount++;
        }
      }

      await conn.commit();
      return { total_drained: pending.length, processed: processedCount, duplicates: duplicateCount };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async getFastPunchMetrics() {
    const pool = await this.getPool();
    const [counts] = await pool.query(`
      SELECT
        COUNT(*) as total_ingested,
        CAST(COALESCE(SUM(CASE WHEN processed = 0 THEN 1 ELSE 0 END), 0) AS UNSIGNED) as queued_count,
        CAST(COALESCE(SUM(CASE WHEN processed = 1 THEN 1 ELSE 0 END), 0) AS UNSIGNED) as processed_count,
        CAST(COALESCE(SUM(CASE WHEN processed = 2 THEN 1 ELSE 0 END), 0) AS UNSIGNED) as duplicate_count,
        ROUND(COALESCE(AVG(process_latency_ms), 0.0), 2) as avg_latency_ms
      FROM fast_punch_buffer
    `);
    const [recent] = await pool.query(`
      SELECT b.*, e.name as emp_name
      FROM fast_punch_buffer b
      LEFT JOIN employees e ON b.emp_id = e.id
      ORDER BY b.id DESC LIMIT 15
    `);
    return {
      metrics: counts[0] || { total_ingested: 0, queued_count: 0, processed_count: 0, duplicate_count: 0, avg_latency_ms: 0 },
      recent_punches: recent
    };
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
