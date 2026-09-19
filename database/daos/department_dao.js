/**
 * database/daos/department_dao.js
 * Department and Department Shift Policy Management DAO (MySQL 8.4 LTS) (<500 lines)
 */

class DepartmentDAO {
  constructor(poolProvider) {
    this.getPool = poolProvider;
  }

  async getAllDepartments() {
    const pool = await this.getPool();
    const [rows] = await pool.query(`
      SELECT d.*, e.name as head_name,
             COUNT(emp.id) as employee_count
      FROM departments d
      LEFT JOIN employees e ON d.head_emp_id = e.id
      LEFT JOIN employees emp ON (d.id = emp.department_id OR d.name = emp.department) AND emp.status = 'Active'
      GROUP BY d.id
      ORDER BY d.name ASC
    `);
    return rows;
  }

  async getDepartmentById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM departments WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  async getDepartmentByCode(code) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM departments WHERE code = ? LIMIT 1', [code]);
    return rows[0] || null;
  }

  async insertDepartment(data) {
    const pool = await this.getPool();
    const id = data.id || `DEP_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await pool.execute(`
      INSERT INTO departments (id, code, name, division, head_emp_id, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      id, data.code, data.name, data.division || 'Corporate',
      data.head_emp_id || null, data.active !== undefined ? (data.active ? 1 : 0) : 1
    ]);
    return this.getDepartmentById(id);
  }

  async updateDepartment(data) {
    const pool = await this.getPool();
    await pool.execute(`
      UPDATE departments SET
        name = COALESCE(?, name),
        division = COALESCE(?, division),
        head_emp_id = COALESCE(?, head_emp_id),
        active = COALESCE(?, active),
        updated_at = NOW()
      WHERE id = ?
    `, [
      data.name || null, data.division || null, data.head_emp_id || null,
      data.active !== undefined ? (data.active ? 1 : 0) : null,
      data.id
    ]);
    return this.getDepartmentById(data.id);
  }

  async deleteDepartment(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM departments WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  async getDepartmentShiftPolicies() {
    const pool = await this.getPool();
    const [rows] = await pool.query(`
      SELECT ds.*, ds.dept_id as department_id, d.name as department_name, d.code as department_code,
             s.name as default_shift_name, s.code as default_shift_code
      FROM department_shifts ds
      JOIN departments d ON ds.dept_id = d.id
      JOIN shifts s ON ds.default_shift_id = s.id
      ORDER BY d.name ASC
    `);
    return rows.map(r => {
      try {
        r.allowed_shifts = typeof r.allowed_shifts === 'string' ? JSON.parse(r.allowed_shifts) : r.allowed_shifts;
      } catch (_) {}
      return r;
    });
  }

  async getDepartmentShiftPolicy(dept_id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT ds.*, ds.dept_id as department_id, d.name as department_name, s.name as default_shift_name
      FROM department_shifts ds
      JOIN departments d ON ds.dept_id = d.id
      JOIN shifts s ON ds.default_shift_id = s.id
      WHERE ds.dept_id = ?
      LIMIT 1
    `, [dept_id]);
    if (rows[0]) {
      try {
        rows[0].allowed_shifts = typeof rows[0].allowed_shifts === 'string' ? JSON.parse(rows[0].allowed_shifts) : rows[0].allowed_shifts;
      } catch (_) {}
    }
    return rows[0] || null;
  }

  async setDepartmentShiftPolicy(data) {
    const pool = await this.getPool();
    const deptId = data.dept_id || data.department_id || data.id;
    const allowed = Array.isArray(data.allowed_shifts) ? JSON.stringify(data.allowed_shifts) : (data.allowed_shifts || JSON.stringify(['SHIFT_GEN']));
    await pool.execute(`
      INSERT INTO department_shifts (dept_id, default_shift_id, allowed_shifts, auto_apply, updated_at)
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        default_shift_id = VALUES(default_shift_id),
        allowed_shifts = VALUES(allowed_shifts),
        auto_apply = VALUES(auto_apply),
        updated_at = NOW()
    `, [
      deptId, data.default_shift_id || 'SHIFT_GEN',
      allowed,
      data.auto_apply !== undefined ? (data.auto_apply ? 1 : 0) : 1
    ]);
    return this.getDepartmentShiftPolicy(deptId);
  }

  async applyDepartmentShiftToEmployees(dept_id, shift_id) {
    const pool = await this.getPool();
    const targetDeptId = dept_id;
    let targetShift = shift_id;
    if (!targetShift) {
      const policy = await this.getDepartmentShiftPolicy(targetDeptId);
      targetShift = policy?.default_shift_id || 'SHIFT_GEN';
    }
    const [result] = await pool.execute(`
      UPDATE employees SET
        primary_shift_id = ?,
        updated_at = NOW()
      WHERE (department_id = ? OR department = (SELECT name FROM departments WHERE id = ?)) AND status = 'Active'
    `, [targetShift, targetDeptId, targetDeptId]);
    return { dept_id: targetDeptId, shift_id: targetShift, updated_employees: result.affectedRows };
  }
}

module.exports = DepartmentDAO;
