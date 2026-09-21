/**
 * database/daos/employee_dao.js
 * High-Speed 10,000+ Employee Master Data Access Object (MySQL 8.4 LTS)
 */

class EmployeeDAO {
  constructor(poolProvider) {
    this.getPool = poolProvider;
  }

  async getEmployeeById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT e.*,
             c.name as company_name, c.code as company_code,
             d.name as department_name, d.code as department_code,
             des.name as designation_name, des.grade_level,
             b.name as branch_name, b.city as branch_city,
             s.name as primary_shift_name,
             et.title as employment_type_name
      FROM employees e
      LEFT JOIN companies c ON e.company_id = c.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN shifts s ON e.primary_shift_id = s.id
      LEFT JOIN employment_types et ON e.employment_type_id = et.id
      WHERE e.id = ?
      LIMIT 1
    `, [id]);
    return rows[0] || null;
  }

  async getAllEmployees({ search = '', department = '', company = '', status = '', branch_id = '', page = 1, size = 20 } = {}) {
    const pool = await this.getPool();
    let sql = `
      SELECT e.id, e.name, e.department, e.role, e.status, e.company,
             e.company_id, e.department_id, e.designation_id, e.branch_id,
             e.employment_type_id, e.primary_shift_id, e.geofence_id,
             e.gender, e.date_of_joining, e.phone_no, e.email, e.card_number,
              e.reporting_to, e.division, e.grade, e.team, e.location,
              e.latitude, e.longitude,
              e.employment_type, e.category, e.created_at, e.updated_at,
              c.name as company_name, d.name as department_name, des.name as designation_name,
              b.name as branch_name
      FROM employees e
      LEFT JOIN companies c ON e.company_id = c.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN branches b ON e.branch_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ' AND (e.name LIKE ? OR e.id LIKE ? OR e.department LIKE ? OR e.role LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (department) {
      sql += ' AND (e.department_id = ? OR e.department = ?)';
      params.push(department, department);
    }
    if (company) {
      sql += ' AND (e.company_id = ? OR e.company = ?)';
      params.push(company, company);
    }
    if (status) {
      sql += ' AND e.status = ?';
      params.push(status);
    }
    if (branch_id) {
      sql += ' AND e.branch_id = ?';
      params.push(branch_id);
    }

    // Count query
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    // Pagination
    const limit = Math.max(1, parseInt(size, 10) || 20);
    const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;
    sql += ' ORDER BY e.id ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    return {
      employees: rows,
      pagination: { total, page: Number(page), size: Number(size), total_pages: Math.ceil(total / limit) }
    };
  }

  async getAllEmployeeFaceEmbeddings() {
    const pool = await this.getPool();
    const [rows] = await pool.query(`
      SELECT id, name, department, role, status, descriptor, descriptor_hash
      FROM employees
      WHERE status = 'Active' AND descriptor IS NOT NULL
    `);
    return rows;
  }

  async insertEmployee(emp) {
    const pool = await this.getPool();
    const crypto = require('crypto');
    const descStr = typeof emp.descriptor === 'string' ? emp.descriptor : JSON.stringify(emp.descriptor || []);
    const descHash = emp.descriptor_hash || crypto.createHash('sha256').update(descStr || emp.id).digest('hex');
    await pool.execute(`
      INSERT INTO employees (
        id, name, department, role, descriptor, descriptor_hash, image, status,
        hibernate_start_date, hibernate_end_date, hibernate_reason, company,
        company_id, department_id, designation, designation_id, branch_id,
        employment_type_id, primary_shift_id, geofence_id, gender, date_of_joining,
        date_of_confirmation, last_working_day, aadhaar_number, pan_number,
        card_number, phone_no, email, reporting_to, device_code, sub_department,
        division, grade, team, location, latitude, longitude, employment_type, category, holiday_group,
        shift_group, shift_roster, geofence, device_expiry_rule_applicable,
        verification_type, expiry_start_date, expiry_end_date, version, updated_by,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?,
        NOW(), NOW()
      )
    `, [
      emp.id, emp.name, emp.department || 'Engineering', emp.role || 'Staff', descStr, descHash,
      emp.image || null, emp.status || 'Active', emp.hibernate_start_date || null, emp.hibernate_end_date || null,
      emp.hibernate_reason || null, emp.company || 'SOUKHYA', emp.company_id || null, emp.department_id || null,
      emp.designation || null, emp.designation_id || null, emp.branch_id || null, emp.employment_type_id || null,
      emp.primary_shift_id || null, emp.geofence_id || null, emp.gender || null, emp.date_of_joining || null,
      emp.date_of_confirmation || null, emp.last_working_day || null, emp.aadhaar_number || null,
      emp.pan_number || null, emp.card_number || null, emp.phone_no || null, emp.email || null,
      emp.reporting_to || null, emp.device_code || null, emp.sub_department || null, emp.division || null,
      emp.grade || null, emp.team || null, emp.location || null, emp.latitude || null, emp.longitude || null,
      emp.employment_type || null, emp.category || null, emp.holiday_group || null, emp.shift_group || null,
      emp.shift_roster || null, emp.geofence || null, emp.device_expiry_rule_applicable ? 1 : 0,
      emp.verification_type || null, emp.expiry_start_date || null, emp.expiry_end_date || null,
      emp.updated_by || 'system'
    ]);
    return this.getEmployeeById(emp.id);
  }

  async updateEmployee(emp) {
    const pool = await this.getPool();
    const descStr = emp.descriptor !== undefined ? (typeof emp.descriptor === 'string' ? emp.descriptor : JSON.stringify(emp.descriptor)) : null;
    await pool.execute(`
      UPDATE employees SET
        name = COALESCE(?, name),
        department = COALESCE(?, department),
        role = COALESCE(?, role),
        descriptor = COALESCE(?, descriptor),
        descriptor_hash = COALESCE(?, descriptor_hash),
        image = COALESCE(?, image),
        status = COALESCE(?, status),
        company_id = COALESCE(?, company_id),
        department_id = COALESCE(?, department_id),
        designation_id = COALESCE(?, designation_id),
        branch_id = COALESCE(?, branch_id),
        primary_shift_id = COALESCE(?, primary_shift_id),
        location = COALESCE(?, location),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        phone_no = COALESCE(?, phone_no),
        email = COALESCE(?, email),
        card_number = COALESCE(?, card_number),
        updated_at = NOW()
      WHERE id = ?
    `, [
      emp.name || null, emp.department || null, emp.role || null, descStr, emp.descriptor_hash || null,
      emp.image || null, emp.status || null, emp.company_id || null, emp.department_id || null,
      emp.designation_id || null, emp.branch_id || null, emp.primary_shift_id || null,
      emp.location || null, emp.latitude || null, emp.longitude || null,
      emp.phone_no || null, emp.email || null, emp.card_number || null,
      emp.id
    ]);
    return this.getEmployeeById(emp.id);
  }

  async deleteEmployee(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM employees WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  async bulkInsertEmployees(records, batchSize = 500) {
    const pool = await this.getPool();
    let totalInserted = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const chunk = records.slice(i, i + batchSize);
      const placeholders = [];
      const values = [];

      for (const emp of chunk) {
        placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW())');
        const descStr = typeof emp.descriptor === 'string' ? emp.descriptor : JSON.stringify(emp.descriptor || []);
        values.push(
          emp.id, emp.name, emp.department || 'Engineering', emp.role || 'Staff', descStr, emp.descriptor_hash || null,
          emp.image || null, emp.status || 'Active', emp.hibernate_start_date || null, emp.hibernate_end_date || null,
          emp.hibernate_reason || null, emp.company || 'SOUKHYA', emp.company_id || null, emp.department_id || null,
          emp.designation || null, emp.designation_id || null, emp.branch_id || null, emp.employment_type_id || null,
          emp.primary_shift_id || null, emp.geofence_id || null, emp.gender || null, emp.date_of_joining || null,
          emp.date_of_confirmation || null, emp.last_working_day || null, emp.aadhaar_number || null,
          emp.pan_number || null, emp.card_number || null, emp.phone_no || null, emp.email || null,
          emp.reporting_to || null, emp.device_code || null, emp.sub_department || null, emp.division || null,
          emp.grade || null, emp.team || null, emp.location || null, emp.employment_type || null,
          emp.category || null, emp.holiday_group || null, emp.shift_group || null, emp.shift_roster || null,
          emp.geofence || null, emp.device_expiry_rule_applicable ? 1 : 0, emp.verification_type || null,
          emp.expiry_start_date || null, emp.expiry_end_date || null, emp.updated_by || 'seeder'
        );
      }

      const sql = `
        INSERT INTO employees (
          id, name, department, role, descriptor, descriptor_hash, image, status,
          hibernate_start_date, hibernate_end_date, hibernate_reason, company,
          company_id, department_id, designation, designation_id, branch_id,
          employment_type_id, primary_shift_id, geofence_id, gender, date_of_joining,
          date_of_confirmation, last_working_day, aadhaar_number, pan_number,
          card_number, phone_no, email, reporting_to, device_code, sub_department,
          division, grade, team, location, employment_type, category, holiday_group,
          shift_group, shift_roster, geofence, device_expiry_rule_applicable,
          verification_type, expiry_start_date, expiry_end_date, version, updated_by,
          created_at, updated_at
        ) VALUES ${placeholders.join(', ')}
        ON DUPLICATE KEY UPDATE
          name = VALUES(name), department = VALUES(department), role = VALUES(role),
          descriptor = VALUES(descriptor), descriptor_hash = VALUES(descriptor_hash),
          status = VALUES(status), company_id = VALUES(company_id), department_id = VALUES(department_id),
          designation_id = VALUES(designation_id), branch_id = VALUES(branch_id),
          updated_at = NOW()
      `;

      const [res] = await pool.query(sql, values);
      totalInserted += res.affectedRows;
    }
    return { totalInserted };
  }

  async getEmployeeStats() {
    const pool = await this.getPool();
    const [counts] = await pool.query(`
      SELECT
        COUNT(*) as total_employees,
        SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active_employees,
        SUM(CASE WHEN status = 'On Leave' THEN 1 ELSE 0 END) as on_leave,
        SUM(CASE WHEN status = 'Hibernate' THEN 1 ELSE 0 END) as hibernate,
        SUM(CASE WHEN status = 'Resigned' THEN 1 ELSE 0 END) as resigned,
        COUNT(DISTINCT company_id) as total_companies,
        COUNT(DISTINCT department_id) as total_departments,
        COUNT(DISTINCT designation_id) as total_designations,
        COUNT(DISTINCT branch_id) as total_branches
      FROM employees
    `);
    return counts[0];
  }
}

module.exports = EmployeeDAO;
