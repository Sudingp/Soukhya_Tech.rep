/**
 * database/daos/master_dao.js
 * Master Entities DAO (Companies, Designations, Branches, Divisions, Cost Centers, Geofences, Holidays, Types)
 */

class MasterDAO {
  constructor(poolProvider) {
    this.getPool = poolProvider;
  }

  // ── Companies ──
  async getAllCompanies() {
    const pool = await this.getPool();
    const [rows] = await pool.query('SELECT * FROM companies ORDER BY name ASC');
    return rows;
  }

  async getCompanyById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM companies WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  async insertCompany(data) {
    const pool = await this.getPool();
    const id = data.id || `COMP_${data.code.toUpperCase()}`;
    await pool.execute(`
      INSERT INTO companies (id, code, name, short_name, address, city, state, country, postal_code, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      id, data.code, data.name, data.short_name || data.code,
      data.address || null, data.city || null, data.state || null,
      data.country || 'India', data.postal_code || null,
      data.active !== undefined ? (data.active ? 1 : 0) : 1
    ]);
    return this.getCompanyById(id);
  }

  async updateCompany(data) {
    const pool = await this.getPool();
    await pool.execute(`
      UPDATE companies SET
        name = COALESCE(?, name),
        short_name = COALESCE(?, short_name),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        active = COALESCE(?, active),
        updated_at = NOW()
      WHERE id = ?
    `, [data.name || null, data.short_name || null, data.address || null, data.city || null, data.state || null, data.active !== undefined ? (data.active ? 1 : 0) : null, data.id]);
    return this.getCompanyById(data.id);
  }

  async deleteCompany(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM companies WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  // ── Designations ──
  async getAllDesignations({ dept_id = null } = {}) {
    const pool = await this.getPool();
    let sql = `
      SELECT des.*, d.name as department_name
      FROM designations des
      LEFT JOIN departments d ON des.dept_id = d.id
      WHERE 1=1
    `;
    const params = [];
    if (dept_id) {
      sql += ' AND des.dept_id = ?';
      params.push(dept_id);
    }
    sql += ' ORDER BY des.grade_level ASC, des.name ASC';
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async getDesignationById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM designations WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  async insertDesignation(data) {
    const pool = await this.getPool();
    const id = data.id || `DES_${data.code.toUpperCase()}`;
    await pool.execute(`
      INSERT INTO designations (id, code, name, dept_id, grade_level, description, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      id, data.code, data.name, data.dept_id || null,
      data.grade_level || 'L1', data.description || null,
      data.active !== undefined ? (data.active ? 1 : 0) : 1
    ]);
    return this.getDesignationById(id);
  }

  async updateDesignation(data) {
    const pool = await this.getPool();
    await pool.execute(`
      UPDATE designations SET
        name = COALESCE(?, name),
        dept_id = COALESCE(?, dept_id),
        grade_level = COALESCE(?, grade_level),
        description = COALESCE(?, description),
        active = COALESCE(?, active),
        updated_at = NOW()
      WHERE id = ?
    `, [data.name || null, data.dept_id || null, data.grade_level || null, data.description || null, data.active !== undefined ? (data.active ? 1 : 0) : null, data.id]);
    return this.getDesignationById(data.id);
  }

  async deleteDesignation(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM designations WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  // ── Branches / Work Locations ──
  async getAllBranches() {
    const pool = await this.getPool();
    const [rows] = await pool.query(`
      SELECT b.*, g.name as geofence_name,
             COUNT(e.id) as employee_count
      FROM branches b
      LEFT JOIN geofences g ON b.geofence_id = g.id
      LEFT JOIN employees e ON b.id = e.branch_id AND e.status = 'Active'
      GROUP BY b.id
      ORDER BY b.name ASC
    `);
    return rows;
  }

  async getBranchById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM branches WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  async insertBranch(data) {
    const pool = await this.getPool();
    const id = data.id || `BR_${data.code.toUpperCase()}`;
    await pool.execute(`
      INSERT INTO branches (id, code, name, address, city, state, country, postal_code, geofence_id, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      id, data.code, data.name, data.address || null,
      data.city || null, data.state || null, data.country || 'India',
      data.postal_code || null, data.geofence_id || null,
      data.active !== undefined ? (data.active ? 1 : 0) : 1
    ]);
    return this.getBranchById(id);
  }

  async updateBranch(data) {
    const pool = await this.getPool();
    await pool.execute(`
      UPDATE branches SET
        name = COALESCE(?, name),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        geofence_id = COALESCE(?, geofence_id),
        active = COALESCE(?, active),
        updated_at = NOW()
      WHERE id = ?
    `, [data.name || null, data.address || null, data.city || null, data.state || null, data.geofence_id || null, data.active !== undefined ? (data.active ? 1 : 0) : null, data.id]);
    return this.getBranchById(data.id);
  }

  async deleteBranch(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM branches WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  // ── Divisions ──
  async getAllDivisions({ company_id = null, active = null } = {}) {
    const pool = await this.getPool();
    let sql = `
      SELECT d.*, c.name as company_name, e.name as head_emp_name
      FROM divisions d
      LEFT JOIN companies c ON d.company_id = c.id
      LEFT JOIN employees e ON d.head_emp_id = e.id
      WHERE 1=1
    `;
    const params = [];
    if (company_id) { sql += ' AND d.company_id = ?'; params.push(company_id); }
    if (active !== null) { sql += ' AND d.active = ?'; params.push(active ? 1 : 0); }
    sql += ' ORDER BY d.name ASC';
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async getDivisionById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM divisions WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  async getDivisionByCode(code) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM divisions WHERE code = ? LIMIT 1', [code]);
    return rows[0] || null;
  }

  async insertDivision(data) {
    const pool = await this.getPool();
    const id = data.id || `DIV_${data.code.toUpperCase()}`;
    await pool.execute(`
      INSERT INTO divisions (id, code, name, company_id, head_emp_id, budget_code, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      id, data.code, data.name, data.company_id,
      data.head_emp_id || null, data.budget_code || null,
      data.active !== undefined ? (data.active ? 1 : 0) : 1
    ]);
    return this.getDivisionById(id);
  }

  async updateDivision(data) {
    const pool = await this.getPool();
    await pool.execute(`
      UPDATE divisions SET
        name = COALESCE(?, name),
        company_id = COALESCE(?, company_id),
        head_emp_id = COALESCE(?, head_emp_id),
        budget_code = COALESCE(?, budget_code),
        active = COALESCE(?, active),
        updated_at = NOW()
      WHERE id = ?
    `, [data.name || null, data.company_id || null, data.head_emp_id || null, data.budget_code || null, data.active !== undefined ? (data.active ? 1 : 0) : null, data.id]);
    return this.getDivisionById(data.id);
  }

  async deleteDivision(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM divisions WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  // ── Cost Centers ──
  async getAllCostCenters({ company_id = null, dept_id = null, active = null } = {}) {
    const pool = await this.getPool();
    let sql = `
      SELECT cc.*, c.name as company_name, d.name as dept_name
      FROM cost_centers cc
      LEFT JOIN companies c ON cc.company_id = c.id
      LEFT JOIN departments d ON cc.dept_id = d.id
      WHERE 1=1
    `;
    const params = [];
    if (company_id) { sql += ' AND cc.company_id = ?'; params.push(company_id); }
    if (dept_id) { sql += ' AND cc.dept_id = ?'; params.push(dept_id); }
    if (active !== null) { sql += ' AND cc.active = ?'; params.push(active ? 1 : 0); }
    sql += ' ORDER BY cc.name ASC';
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async getCostCenterById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM cost_centers WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  async getCostCenterByCode(code) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM cost_centers WHERE code = ? LIMIT 1', [code]);
    return rows[0] || null;
  }

  async insertCostCenter(data) {
    const pool = await this.getPool();
    const id = data.id || `CC_${data.code.toUpperCase()}`;
    await pool.execute(`
      INSERT INTO cost_centers (id, code, name, company_id, dept_id, gl_account, annual_budget, currency, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      id, data.code, data.name, data.company_id,
      data.dept_id || null, data.gl_account || null,
      data.annual_budget || 0.0, data.currency || 'INR',
      data.active !== undefined ? (data.active ? 1 : 0) : 1
    ]);
    return this.getCostCenterById(id);
  }

  async updateCostCenter(data) {
    const pool = await this.getPool();
    await pool.execute(`
      UPDATE cost_centers SET
        name = COALESCE(?, name),
        company_id = COALESCE(?, company_id),
        dept_id = COALESCE(?, dept_id),
        gl_account = COALESCE(?, gl_account),
        annual_budget = COALESCE(?, annual_budget),
        currency = COALESCE(?, currency),
        active = COALESCE(?, active),
        updated_at = NOW()
      WHERE id = ?
    `, [data.name || null, data.company_id || null, data.dept_id || null, data.gl_account || null, data.annual_budget !== undefined ? data.annual_budget : null, data.currency || null, data.active !== undefined ? (data.active ? 1 : 0) : null, data.id]);
    return this.getCostCenterById(data.id);
  }

  async deleteCostCenter(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM cost_centers WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  // ── Employment Types ──
  async getAllEmploymentTypes() {
    const pool = await this.getPool();
    const [rows] = await pool.query('SELECT * FROM employment_types ORDER BY title ASC');
    return rows;
  }

  async getEmploymentTypeById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM employment_types WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  async insertEmploymentType(data) {
    const pool = await this.getPool();
    const id = data.id || `ET_${data.code.toUpperCase()}`;
    await pool.execute(`
      INSERT INTO employment_types (id, code, title, is_probationary, notice_period_days, leaves_eligible, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      id, data.code, data.title,
      data.is_probationary ? 1 : 0, data.notice_period_days || 30,
      data.leaves_eligible ? 1 : 0, data.active !== undefined ? (data.active ? 1 : 0) : 1
    ]);
    return this.getEmploymentTypeById(id);
  }

  async updateEmploymentType(data) {
    const pool = await this.getPool();
    await pool.execute(`
      UPDATE employment_types SET
        title = COALESCE(?, title),
        is_probationary = COALESCE(?, is_probationary),
        notice_period_days = COALESCE(?, notice_period_days),
        leaves_eligible = COALESCE(?, leaves_eligible),
        active = COALESCE(?, active),
        updated_at = NOW()
      WHERE id = ?
    `, [data.title || null, data.is_probationary !== undefined ? (data.is_probationary ? 1 : 0) : null, data.notice_period_days || null, data.leaves_eligible !== undefined ? (data.leaves_eligible ? 1 : 0) : null, data.active !== undefined ? (data.active ? 1 : 0) : null, data.id]);
    return this.getEmploymentTypeById(data.id);
  }

  async deleteEmploymentType(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM employment_types WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  // ── Geofences ──
  async getAllGeofences() {
    const pool = await this.getPool();
    const [rows] = await pool.query('SELECT * FROM geofences ORDER BY name ASC');
    return rows;
  }

  async getGeofenceById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM geofences WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  async insertGeofence(data) {
    const pool = await this.getPool();
    const id = data.id || `GEO_${data.code.toUpperCase()}`;
    await pool.execute(`
      INSERT INTO geofences (id, code, name, latitude, longitude, radius_meters, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      id, data.code, data.name, data.latitude, data.longitude,
      data.radius_meters || 100, data.active !== undefined ? (data.active ? 1 : 0) : 1
    ]);
    return this.getGeofenceById(id);
  }

  async deleteGeofence(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM geofences WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  // ── Work Codes ──
  async getAllWorkCodes() {
    const pool = await this.getPool();
    const [rows] = await pool.query('SELECT * FROM work_codes ORDER BY code ASC');
    return rows;
  }

  async getWorkCodeById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM work_codes WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  async insertWorkCode(data) {
    const pool = await this.getPool();
    const id = data.id || `WC_${data.code.toUpperCase()}`;
    await pool.execute(`
      INSERT INTO work_codes (id, code, name, description, multiplier, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      id, data.code, data.name, data.description || null,
      data.multiplier || 1.0, data.active !== undefined ? (data.active ? 1 : 0) : 1
    ]);
    return this.getWorkCodeById(id);
  }

  async updateWorkCode(data) {
    const pool = await this.getPool();
    await pool.execute(`
      UPDATE work_codes SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        multiplier = COALESCE(?, multiplier),
        active = COALESCE(?, active),
        updated_at = NOW()
      WHERE id = ?
    `, [data.name || null, data.description || null, data.multiplier || null, data.active !== undefined ? (data.active ? 1 : 0) : null, data.id]);
    return this.getWorkCodeById(data.id);
  }

  async deleteWorkCode(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM work_codes WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  // ── Public Holidays ──
  async getPublicHolidays({ year = '' } = {}) {
    const pool = await this.getPool();
    let sql = 'SELECT * FROM public_holidays WHERE 1=1';
    const params = [];
    if (year) {
      sql += ' AND holiday_date LIKE ?';
      params.push(`${year}%`);
    }
    sql += ' ORDER BY holiday_date ASC';
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async getPublicHolidayById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM public_holidays WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  async insertPublicHoliday(data) {
    const pool = await this.getPool();
    const [res] = await pool.execute(`
      INSERT INTO public_holidays (holiday_date, name, state, is_mandatory, description, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [data.holiday_date, data.name, data.state || 'Karnataka', data.is_mandatory ? 1 : 0, data.description || null]);
    return this.getPublicHolidayById(res.insertId);
  }

  async deletePublicHoliday(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM public_holidays WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  async syncPublicHolidaysToCalendar(yearStr) {
    const pool = await this.getPool();
    const holidays = await this.getPublicHolidays({ year: yearStr });
    let count = 0;
    for (const h of holidays) {
      const dStr = typeof h.holiday_date === 'string' ? h.holiday_date.slice(0, 10) : h.holiday_date.toISOString().slice(0, 10);
      await pool.execute(`
        INSERT INTO shift_calendar_days (calendar_date, day_type, holiday_name, note, created_at, updated_at)
        VALUES (?, 'HOLIDAY', ?, 'Karnataka Gazetted Public Holiday', NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          day_type = 'HOLIDAY',
          holiday_name = VALUES(holiday_name),
          updated_at = NOW()
      `, [dStr, h.name]);
      count++;
    }
    return { year: yearStr, synchronized: count };
  }
}

module.exports = MasterDAO;
