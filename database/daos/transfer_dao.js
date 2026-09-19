/**
 * database/daos/transfer_dao.js
 * Employee Career Transfers, Promotions, and Relocation Ledger DAO (MySQL 8.4 LTS)
 */

class TransferDAO {
  constructor(poolProvider) {
    this.getPool = poolProvider;
  }

  async getTransfers({ emp_id = null, limit = 50 } = {}) {
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

      // 1. Lock employee row
      const [empRows] = await conn.execute('SELECT * FROM employees WHERE id = ? FOR UPDATE', [data.emp_id]);
      if (empRows.length === 0) throw new Error('Employee not found: ' + data.emp_id);
      const curEmp = empRows[0];

      // 2. Insert Transfer Record
      const [res] = await conn.execute(`
        INSERT INTO employee_transfers (
          emp_id, prev_company_id, new_company_id,
          prev_dept_id, new_dept_id,
          prev_desig_id, new_desig_id,
          prev_branch_id, new_branch_id,
          transfer_type, effective_date, remarks, approved_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
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
      ]);

      // 3. Synchronously Update Employee Profile
      await conn.execute(`
        UPDATE employees SET
          company_id = COALESCE(?, company_id),
          department_id = COALESCE(?, department_id),
          designation_id = COALESCE(?, designation_id),
          branch_id = COALESCE(?, branch_id),
          department = COALESCE((SELECT name FROM departments WHERE id = ?), department),
          role = COALESCE((SELECT name FROM designations WHERE id = ?), role),
          updated_at = NOW()
        WHERE id = ?
      `, [
        data.new_company_id || null,
        data.new_dept_id || null,
        data.new_desig_id || null,
        data.new_branch_id || null,
        data.new_dept_id || null,
        data.new_desig_id || null,
        data.emp_id
      ]);

      await conn.commit();
      return { id: res.insertId, emp_id: data.emp_id, success: true };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
}

module.exports = TransferDAO;
