/**
 * database/daos/master_dao.js
 * Master Entities DAO (Companies, Designations, Branches, Divisions, Cost Centers, Geofences, Holidays, Types)
 * Max file limit: < 500 lines
 */

class MasterDAO {
  constructor(poolProvider) {
    this.getPool = poolProvider;
  }

  // ── Companies ──
  async getAllCompanies() {
    const pool = await this.getPool();
    const [rows] = await pool.query(`
      SELECT c.*, COUNT(e.id) as employee_count
      FROM companies c
      LEFT JOIN employees e ON c.id = e.company_id AND e.status = "Active"
      GROUP BY c.id ORDER BY c.name ASC
    `);
    return rows;
  }

  async getCompanyById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute("SELECT * FROM companies WHERE id = ? LIMIT 1", [id]);
    return rows[0] || null;
  }

  async insertCompany(data) {
    const pool = await this.getPool();
    const id = data.id || ("COMP_" + data.code.toUpperCase());
    await pool.execute(
      "INSERT INTO companies (id, code, name, short_name, address, city, state, country, pincode, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [id, data.code, data.name, data.short_name || data.code, data.address || null, data.city || "Bangalore", data.state || "Karnataka", data.country || "India", data.pincode || data.postal_code || null, data.active !== undefined ? (data.active ? 1 : 0) : 1]
    );
    return this.getCompanyById(id);
  }

  async updateCompany(data) {
    const pool = await this.getPool();
    await pool.execute(
      "UPDATE companies SET name = COALESCE(?, name), short_name = COALESCE(?, short_name), address = COALESCE(?, address), city = COALESCE(?, city), state = COALESCE(?, state), active = COALESCE(?, active), updated_at = NOW() WHERE id = ?",
      [data.name || null, data.short_name || null, data.address || null, data.city || null, data.state || null, data.active !== undefined ? (data.active ? 1 : 0) : null, data.id]
    );
    return this.getCompanyById(data.id);
  }

  async deleteCompany(id) {
    const pool = await this.getPool();
    await pool.execute("DELETE FROM companies WHERE id = ?", [id]);
    return { id, deleted: true };
  }

  // ── Designations ──
  async getAllDesignations({ dept_id = null } = {}) {
    const pool = await this.getPool();
    let sql = "SELECT des.*, d.name as department_name, COUNT(e.id) as employee_count FROM designations des LEFT JOIN departments d ON des.dept_id = d.id LEFT JOIN employees e ON des.id = e.designation_id AND e.status = \"Active\" WHERE 1=1";
    const params = [];
    if (dept_id) { sql += " AND des.dept_id = ?"; params.push(dept_id); }
    sql += " GROUP BY des.id ORDER BY des.grade_level ASC, des.name ASC";
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async getDesignationById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute("SELECT * FROM designations WHERE id = ? LIMIT 1", [id]);
    return rows[0] || null;
  }

  async insertDesignation(data) {
    const pool = await this.getPool();
    const id = data.id || ("DES_" + data.code.toUpperCase());
    await pool.execute(
      "INSERT INTO designations (id, code, name, dept_id, grade_level, description, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [id, data.code, data.name, data.dept_id || null, data.grade_level || "L1", data.description || null, data.active !== undefined ? (data.active ? 1 : 0) : 1]
    );
    return this.getDesignationById(id);
  }

  async updateDesignation(data) {
    const pool = await this.getPool();
    await pool.execute(
      "UPDATE designations SET name = COALESCE(?, name), dept_id = COALESCE(?, dept_id), grade_level = COALESCE(?, grade_level), description = COALESCE(?, description), active = COALESCE(?, active), updated_at = NOW() WHERE id = ?",
      [data.name || null, data.dept_id || null, data.grade_level || null, data.description || null, data.active !== undefined ? (data.active ? 1 : 0) : null, data.id]
    );
    return this.getDesignationById(data.id);
  }

  async deleteDesignation(id) {
    const pool = await this.getPool();
    await pool.execute("DELETE FROM designations WHERE id = ?", [id]);
    return { id, deleted: true };
  }

  // ── Branches / Work Locations ──
  async getAllBranches() {
    const pool = await this.getPool();
    const [rows] = await pool.query(`
      SELECT b.*, g.name as geofence_name, COUNT(e.id) as employee_count
      FROM branches b
      LEFT JOIN geofences g ON b.geofence_id = g.id
      LEFT JOIN employees e ON b.id = e.branch_id AND e.status = "Active"
      GROUP BY b.id ORDER BY b.name ASC
    `);
    return rows;
  }

  async getBranchById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute("SELECT * FROM branches WHERE id = ? LIMIT 1", [id]);
    return rows[0] || null;
  }

  async insertBranch(data) {
    const pool = await this.getPool();
    const id = data.id || ("BR_" + data.code.toUpperCase());
    await pool.execute(
      "INSERT INTO branches (id, code, name, address, city, state, country, pincode, geofence_id, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [id, data.code, data.name, data.address || null, data.city || "Bangalore", data.state || "Karnataka", data.country || "India", data.pincode || data.postal_code || null, data.geofence_id || null, data.active !== undefined ? (data.active ? 1 : 0) : 1]
    );
    return this.getBranchById(id);
  }

  async updateBranch(data) {
    const pool = await this.getPool();
    await pool.execute(
      "UPDATE branches SET name = COALESCE(?, name), address = COALESCE(?, address), city = COALESCE(?, city), state = COALESCE(?, state), geofence_id = COALESCE(?, geofence_id), active = COALESCE(?, active), updated_at = NOW() WHERE id = ?",
      [data.name || null, data.address || null, data.city || null, data.state || null, data.geofence_id || null, data.active !== undefined ? (data.active ? 1 : 0) : null, data.id]
    );
    return this.getBranchById(data.id);
  }

  async deleteBranch(id) {
    const pool = await this.getPool();
    await pool.execute("DELETE FROM branches WHERE id = ?", [id]);
    return { id, deleted: true };
  }

  // ── Divisions ──
  async getAllDivisions({ company_id = null, active = null } = {}) {
    const pool = await this.getPool();
    let sql = "SELECT d.*, c.name as company_name, c.code as company_code, e_head.name as head_emp_name, COUNT(e.id) as employee_count FROM divisions d LEFT JOIN companies c ON d.company_id = c.id LEFT JOIN employees e_head ON d.head_emp_id = e_head.id LEFT JOIN employees e ON d.id = e.division_id AND e.status = \"Active\" WHERE 1=1";
    const params = [];
    if (company_id) { sql += " AND d.company_id = ?"; params.push(company_id); }
    if (active !== null) { sql += " AND d.active = ?"; params.push(active ? 1 : 0); }
    sql += " GROUP BY d.id ORDER BY d.name ASC";
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async getDivisionById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute("SELECT * FROM divisions WHERE id = ? LIMIT 1", [id]);
    return rows[0] || null;
  }

  async insertDivision(data) {
    const pool = await this.getPool();
    const id = data.id || ("DIV_" + data.code.toUpperCase());
    await pool.execute(
      "INSERT INTO divisions (id, code, name, company_id, head_emp_id, budget_code, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [id, data.code, data.name, data.company_id, data.head_emp_id || null, data.budget_code || null, data.active !== undefined ? (data.active ? 1 : 0) : 1]
    );
    return this.getDivisionById(id);
  }

  async updateDivision(data) {
    const pool = await this.getPool();
    await pool.execute(
      "UPDATE divisions SET name = COALESCE(?, name), company_id = COALESCE(?, company_id), head_emp_id = COALESCE(?, head_emp_id), budget_code = COALESCE(?, budget_code), active = COALESCE(?, active), updated_at = NOW() WHERE id = ?",
      [data.name || null, data.company_id || null, data.head_emp_id || null, data.budget_code || null, data.active !== undefined ? (data.active ? 1 : 0) : null, data.id]
    );
    return this.getDivisionById(data.id);
  }

  async deleteDivision(id) {
    const pool = await this.getPool();
    await pool.execute("DELETE FROM divisions WHERE id = ?", [id]);
    return { id, deleted: true };
  }

  // ── Cost Centers ──
  async getAllCostCenters({ company_id = null, dept_id = null, active = null } = {}) {
    const pool = await this.getPool();
    let sql = "SELECT cc.*, c.name as company_name, d.name as dept_name, COUNT(e.id) as employee_count FROM cost_centers cc LEFT JOIN companies c ON cc.company_id = c.id LEFT JOIN departments d ON cc.dept_id = d.id LEFT JOIN employees e ON cc.id = e.cost_center_id AND e.status = \"Active\" WHERE 1=1";
    const params = [];
    if (company_id) { sql += " AND cc.company_id = ?"; params.push(company_id); }
    if (dept_id) { sql += " AND cc.dept_id = ?"; params.push(dept_id); }
    if (active !== null) { sql += " AND cc.active = ?"; params.push(active ? 1 : 0); }
    sql += " GROUP BY cc.id ORDER BY cc.name ASC";
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async getCostCenterById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute("SELECT * FROM cost_centers WHERE id = ? LIMIT 1", [id]);
    return rows[0] || null;
  }

  async insertCostCenter(data) {
    const pool = await this.getPool();
    const id = data.id || ("CC_" + data.code.toUpperCase());
    await pool.execute(
      "INSERT INTO cost_centers (id, code, name, company_id, dept_id, gl_account, annual_budget, currency, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [id, data.code, data.name, data.company_id, data.dept_id || null, data.gl_account || null, data.annual_budget || 0.0, data.currency || "INR", data.active !== undefined ? (data.active ? 1 : 0) : 1]
    );
    return this.getCostCenterById(id);
  }

  async updateCostCenter(data) {
    const pool = await this.getPool();
    await pool.execute(
      "UPDATE cost_centers SET name = COALESCE(?, name), company_id = COALESCE(?, company_id), dept_id = COALESCE(?, dept_id), gl_account = COALESCE(?, gl_account), annual_budget = COALESCE(?, annual_budget), currency = COALESCE(?, currency), active = COALESCE(?, active), updated_at = NOW() WHERE id = ?",
      [data.name || null, data.company_id || null, data.dept_id || null, data.gl_account || null, data.annual_budget !== undefined ? data.annual_budget : null, data.currency || null, data.active !== undefined ? (data.active ? 1 : 0) : null, data.id]
    );
    return this.getCostCenterById(data.id);
  }

  async deleteCostCenter(id) {
    const pool = await this.getPool();
    await pool.execute("DELETE FROM cost_centers WHERE id = ?", [id]);
    return { id, deleted: true };
  }

  // ── Employment Types ──
  async getAllEmploymentTypes() {
    const pool = await this.getPool();
    const [rows] = await pool.query(`
      SELECT et.*, COUNT(e.id) as employee_count
      FROM employment_types et
      LEFT JOIN employees e ON et.id = e.employment_type_id AND e.status = "Active"
      GROUP BY et.id ORDER BY et.title ASC
    `);
    return rows;
  }

  async getEmploymentTypeById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute("SELECT * FROM employment_types WHERE id = ? LIMIT 1", [id]);
    return rows[0] || null;
  }

  async insertEmploymentType(data) {
    const pool = await this.getPool();
    const id = data.id || ("ET_" + data.code.toUpperCase());
    await pool.execute(
      "INSERT INTO employment_types (id, code, title, description, probation_days, notice_period_days, pf_esi_eligible, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [id, data.code, data.title, data.description || null, data.probation_days !== undefined ? data.probation_days : 90, data.notice_period_days !== undefined ? data.notice_period_days : 30, data.pf_esi_eligible !== undefined ? (data.pf_esi_eligible ? 1 : 0) : 1, data.active !== undefined ? (data.active ? 1 : 0) : 1]
    );
    return this.getEmploymentTypeById(id);
  }

  async updateEmploymentType(data) {
    const pool = await this.getPool();
    await pool.execute(
      "UPDATE employment_types SET title = COALESCE(?, title), description = COALESCE(?, description), probation_days = COALESCE(?, probation_days), notice_period_days = COALESCE(?, notice_period_days), pf_esi_eligible = COALESCE(?, pf_esi_eligible), active = COALESCE(?, active), updated_at = NOW() WHERE id = ?",
      [data.title || null, data.description || null, data.probation_days !== undefined ? data.probation_days : null, data.notice_period_days !== undefined ? data.notice_period_days : null, data.pf_esi_eligible !== undefined ? (data.pf_esi_eligible ? 1 : 0) : null, data.active !== undefined ? (data.active ? 1 : 0) : null, data.id]
    );
    return this.getEmploymentTypeById(data.id);
  }

  async deleteEmploymentType(id) {
    const pool = await this.getPool();
    await pool.execute("DELETE FROM employment_types WHERE id = ?", [id]);
    return { id, deleted: true };
  }

  // ── Geofences ──
  async getAllGeofences() {
    const pool = await this.getPool();
    const [rows] = await pool.query(`
      SELECT g.*, COUNT(DISTINCT b.id) as branch_count, COUNT(DISTINCT e.id) as employee_count
      FROM geofences g
      LEFT JOIN branches b ON g.id = b.geofence_id
      LEFT JOIN employees e ON g.id = e.geofence_id AND e.status = "Active"
      GROUP BY g.id ORDER BY g.name ASC
    `);
    return rows;
  }

  async getGeofenceById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute("SELECT * FROM geofences WHERE id = ? LIMIT 1", [id]);
    return rows[0] || null;
  }

  async insertGeofence(data) {
    const pool = await this.getPool();
    const id = data.id || ("GEO_" + data.code.toUpperCase());
    const depts = Array.isArray(data.allowed_depts) ? JSON.stringify(data.allowed_depts) : (data.allowed_depts || null);
    await pool.execute(
      "INSERT INTO geofences (id, code, name, latitude, longitude, radius_meters, enforcement_mode, allowed_depts, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [id, data.code, data.name, data.latitude, data.longitude, data.radius_meters || 150, data.enforcement_mode || "STRICT", depts, data.active !== undefined ? (data.active ? 1 : 0) : 1]
    );
    return this.getGeofenceById(id);
  }

  async deleteGeofence(id) {
    const pool = await this.getPool();
    await pool.execute("DELETE FROM geofences WHERE id = ?", [id]);
    return { id, deleted: true };
  }

  // ── Work Codes ──
  async getAllWorkCodes() {
    const pool = await this.getPool();
    const [rows] = await pool.query(`
      SELECT wc.*, COUNT(DISTINCT e.id) as employee_count, COUNT(DISTINCT e.id) as usage_count
      FROM work_codes wc
      LEFT JOIN employees e ON (wc.id = e.work_code_id OR wc.code = e.work_code_id) AND e.status = "Active"
      GROUP BY wc.id ORDER BY wc.code ASC
    `);
    return rows;
  }

  async getWorkCodeById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute("SELECT * FROM work_codes WHERE id = ? LIMIT 1", [id]);
    return rows[0] || null;
  }

  async insertWorkCode(data) {
    const pool = await this.getPool();
    const id = data.id || ("WC_" + data.code.toUpperCase());
    const mult = data.billing_rate_multiplier !== undefined ? data.billing_rate_multiplier : (data.multiplier || 1.0);
    const cat = data.category || "BILLABLE_PROJECT";
    const ot = data.ot_eligible !== undefined ? (data.ot_eligible ? 1 : 0) : 1;
    await pool.execute(
      "INSERT INTO work_codes (id, code, name, category, description, billing_rate_multiplier, ot_eligible, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [id, data.code, data.name, cat, data.description || null, mult, ot, data.active !== undefined ? (data.active ? 1 : 0) : 1]
    );
    return this.getWorkCodeById(id);
  }

  async updateWorkCode(data) {
    const pool = await this.getPool();
    const mult = data.billing_rate_multiplier !== undefined ? data.billing_rate_multiplier : (data.multiplier !== undefined ? data.multiplier : null);
    await pool.execute(
      "UPDATE work_codes SET name = COALESCE(?, name), category = COALESCE(?, category), description = COALESCE(?, description), billing_rate_multiplier = COALESCE(?, billing_rate_multiplier), ot_eligible = COALESCE(?, ot_eligible), active = COALESCE(?, active), updated_at = NOW() WHERE id = ?",
      [data.name || null, data.category || null, data.description || null, mult, data.ot_eligible !== undefined ? (data.ot_eligible ? 1 : 0) : null, data.active !== undefined ? (data.active ? 1 : 0) : null, data.id]
    );
    return this.getWorkCodeById(data.id);
  }

  async deleteWorkCode(id) {
    const pool = await this.getPool();
    await pool.execute("DELETE FROM work_codes WHERE id = ?", [id]);
    return { id, deleted: true };
  }

  // ── Public Holidays ──
  async getPublicHolidays({ year = "" } = {}) {
    const pool = await this.getPool();
    let sql = "SELECT id, title, title as name, holiday_date, holiday_type, applicable_state, applicable_state as state, applicable_location, description, is_recurring, (holiday_type = \"MANDATORY\") as is_mandatory, created_at, updated_at FROM public_holidays WHERE 1=1";
    const params = [];
    if (year) {
      sql += " AND holiday_date LIKE ?";
      params.push(year + "%");
    }
    sql += " ORDER BY holiday_date ASC";
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async getPublicHolidayById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute("SELECT id, title, title as name, holiday_date, holiday_type, applicable_state, applicable_state as state, applicable_location, description, is_recurring, (holiday_type = \"MANDATORY\") as is_mandatory, created_at, updated_at FROM public_holidays WHERE id = ? LIMIT 1", [id]);
    return rows[0] || null;
  }

  async insertPublicHoliday(data) {
    const pool = await this.getPool();
    const title = data.title || data.name || "Holiday";
    const state = data.applicable_state || data.state || "Karnataka";
    const location = data.applicable_location || "All Locations";
    let hType = data.holiday_type || "MANDATORY";
    if (hType === "GAZETTED") hType = "MANDATORY";
    if (hType === "RESTRICTED_OPTIONAL") hType = "RESTRICTED";
    const [res] = await pool.execute(
      "INSERT INTO public_holidays (holiday_date, title, holiday_type, applicable_state, applicable_location, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [data.holiday_date, title, hType, state, location, data.description || null]
    );
    return this.getPublicHolidayById(res.insertId);
  }

  async deletePublicHoliday(id) {
    const pool = await this.getPool();
    await pool.execute("DELETE FROM public_holidays WHERE id = ?", [id]);
    return { id, deleted: true };
  }

  async syncPublicHolidaysToCalendar(yearStr) {
    const pool = await this.getPool();
    const holidays = await this.getPublicHolidays({ year: yearStr });
    let count = 0;
    for (const h of holidays) {
      const dStr = typeof h.holiday_date === "string" ? h.holiday_date.slice(0, 10) : h.holiday_date.toISOString().slice(0, 10);
      const title = h.title || h.name || "Public Holiday";
      await pool.execute(
        "INSERT INTO shift_calendar_days (cal_date, day_type, title, updated_at) VALUES (?, \"HOLIDAY\", ?, NOW()) ON DUPLICATE KEY UPDATE day_type = \"HOLIDAY\", title = VALUES(title), updated_at = NOW()",
        [dStr, title]
      );
      count++;
    }
    return { year: yearStr, synchronized: count };
  }
}

module.exports = MasterDAO;
