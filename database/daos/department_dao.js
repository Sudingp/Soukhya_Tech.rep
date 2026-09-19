/**
 * database/daos/department_dao.js
 * Department and Department Shift Policy Management DAO (MySQL 8.4 LTS)
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
      LEFT JOIN employees emp ON d.id = emp.department_id AND emp.status = 'Active'
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
      SELECT ds.*, d.name as department_name, d.code as department_code,
             s.name as default_shift_name, s.code as default_shift_code
      FROM department_shifts ds
      JOIN departments d ON ds.department_id = d.id
      JOIN shifts s ON ds.default_shift_id = s.id
      ORDER BY d.name ASC
    `);
    return rows;
  }

  async getDepartmentShiftPolicy(department_id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT ds.*, d.name as department_name, s.name as default_shift_name
      FROM department_shifts ds
      JOIN departments d ON ds.department_id = d.id
      JOIN shifts s ON ds.default_shift_id = s.id
      WHERE ds.department_id = ?
      LIMIT 1
    `, [department_id]);
    return rows[0] || null;
  }

  async setDepartmentShiftPolicy(data) {
    const pool = await this.getPool();
    await pool.execute(`
      INSERT INTO department_shifts (department_id, default_shift_id, allow_shift_change, requires_approval, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        default_shift_id = VALUES(default_shift_id),
        allow_shift_change = VALUES(allow_shift_change),
        requires_approval = VALUES(requires_approval),
        updated_at = NOW()
    `, [
      data.department_id, data.default_shift_id,
      data.allow_shift_change !== undefined ? (data.allow_shift_change ? 1 : 0) : 1,
      data.requires_approval !== undefined ? (data.requires_approval ? 1 : 0) : 1
    ]);
    return this.getDepartmentShiftPolicy(data.department_id);
  }

  async applyDepartmentShiftToEmployees(department_id, shift_id) {
    const pool = await this.getPool();
    const [result] = await pool.execute(`
      UPDATE employees SET
        primary_shift_id = ?,
        updated_at = NOW()
      WHERE department_id = ? AND status = 'Active'
    `, [shift_id, department_id]);
    return { department_id, shift_id, updated_employees: result.affectedRows };
  }
}

module.exports = DepartmentDAO;
