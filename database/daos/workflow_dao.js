/**
 * database/daos/workflow_dao.js
 * Workflow DAO (Overtime Register, Leave Ledger & Balances, Outdoor Duty) (MySQL 8.4 LTS)
 */

class WorkflowDAO {
  constructor(poolProvider) {
    this.getPool = poolProvider;
  }

  // ── Overtime Register ──
  async getOtRecords({ emp_id = '', ot_date = '', status = '', page = 1, size = 20 } = {}) {
    const pool = await this.getPool();
    let sql = `
      SELECT o.*, e.name as emp_name, e.department, s.name as shift_name
      FROM ot_records o
      LEFT JOIN employees e ON o.emp_id = e.id
      LEFT JOIN shifts s ON o.shift_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (emp_id) { sql += ' AND o.emp_id = ?'; params.push(emp_id); }
    if (ot_date) { sql += ' AND o.ot_date = ?'; params.push(ot_date); }
    if (status) { sql += ' AND o.status = ?'; params.push(status); }

    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    const limit = Math.max(1, parseInt(size, 10) || 20);
    const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;
    sql += ' ORDER BY o.ot_date DESC, o.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    return {
      records: rows,
      pagination: { total, page: Number(page), size: Number(size), total_pages: Math.ceil(total / limit) }
    };
  }

  async getOtRecordById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT o.*, e.name as emp_name, e.department
      FROM ot_records o
      LEFT JOIN employees e ON o.emp_id = e.id
      WHERE o.id = ? LIMIT 1
    `, [id]);
    return rows[0] || null;
  }

  async insertOtRecord(data) {
    const pool = await this.getPool();
    const [res] = await pool.execute(`
      INSERT INTO ot_records (emp_id, ot_date, shift_id, scheduled_hours, actual_hours, ot_hours, ot_multiplier, ot_rate_type, status, comments, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      data.emp_id, data.ot_date, data.shift_id || 'SHIFT_GEN',
      data.scheduled_hours || 8.0, data.actual_hours || 8.0,
      data.ot_hours || 0.0, data.ot_multiplier || 1.5,
      data.ot_rate_type || 'STANDARD_DAY', data.status || 'PENDING',
      data.comments || null
    ]);
    return this.getOtRecordById(res.insertId);
  }

  async updateOtStatus(id, { status, comments, approved_by }) {
    const pool = await this.getPool();
    await pool.execute(`
      UPDATE ot_records SET
        status = ?, comments = COALESCE(?, comments),
        approved_by = ?, approved_at = NOW(), updated_at = NOW()
      WHERE id = ?
    `, [status, comments || null, approved_by || 'Admin', id]);
    return this.getOtRecordById(id);
  }

  async deleteOtRecord(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM ot_records WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  async autoCalculateDailyOt(targetDate) {
    const pool = await this.getPool();
    const [punches] = await pool.query(`
      SELECT emp_id, MIN(timestamp) as first_in, MAX(timestamp) as last_out
      FROM attendance
      WHERE DATE(timestamp) = ?
      GROUP BY emp_id
    `, [targetDate]);

    let calculated = 0;
    for (const p of punches) {
      if (!p.first_in || !p.last_out) continue;
      const durationHours = (new Date(p.last_out) - new Date(p.first_in)) / (1000 * 60 * 60);
      if (durationHours > 8.5) {
        const otHours = parseFloat((durationHours - 8.0).toFixed(2));
        await pool.execute(`
          INSERT INTO ot_records (emp_id, ot_date, scheduled_hours, actual_hours, ot_hours, ot_multiplier, ot_rate_type, status, comments, created_at, updated_at)
          VALUES (?, ?, 8.0, ?, ?, 1.5, 'STANDARD_DAY', 'PENDING', 'Auto-calculated from biometric attendance punch duration', NOW(), NOW())
          ON DUPLICATE KEY UPDATE actual_hours = VALUES(actual_hours), ot_hours = VALUES(ot_hours), updated_at = NOW()
        `, [p.emp_id, targetDate, parseFloat(durationHours.toFixed(2)), otHours]);
        calculated++;
      }
    }
    return { targetDate, calculated };
  }

  // ── Leave Types ──
  async getLeaveTypes() {
    const pool = await this.getPool();
    const [rows] = await pool.query('SELECT * FROM leave_types ORDER BY code ASC');
    return rows;
  }

  async getLeaveTypeById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM leave_types WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  async insertLeaveType(data) {
    const pool = await this.getPool();
    const id = data.id || `LT_${data.code.toUpperCase()}`;
    await pool.execute(`
      INSERT INTO leave_types (id, code, name, annual_quota, carry_forward_max, is_encashable, is_paid, color, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      id, data.code, data.name, data.annual_quota || 12.0,
      data.carry_forward_max || 0.0, data.is_encashable ? 1 : 0,
      data.is_paid ? 1 : 0, data.color || '#4f8ef7',
      data.active !== undefined ? (data.active ? 1 : 0) : 1
    ]);
    return this.getLeaveTypeById(id);
  }

  async updateLeaveType(data) {
    const pool = await this.getPool();
    await pool.execute(`
      UPDATE leave_types SET
        name = COALESCE(?, name),
        annual_quota = COALESCE(?, annual_quota),
        carry_forward_max = COALESCE(?, carry_forward_max),
        is_encashable = COALESCE(?, is_encashable),
        is_paid = COALESCE(?, is_paid),
        color = COALESCE(?, color),
        active = COALESCE(?, active),
        updated_at = NOW()
      WHERE id = ?
    `, [data.name || null, data.annual_quota !== undefined ? data.annual_quota : null, data.carry_forward_max !== undefined ? data.carry_forward_max : null, data.is_encashable !== undefined ? (data.is_encashable ? 1 : 0) : null, data.is_paid !== undefined ? (data.is_paid ? 1 : 0) : null, data.color || null, data.active !== undefined ? (data.active ? 1 : 0) : null, data.id]);
    return this.getLeaveTypeById(data.id);
  }

  async deleteLeaveType(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM leave_types WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  // ── Employee Leave Entries ──
  async getLeaveEntries({ emp_id = '', status = '', page = 1, size = 20 } = {}) {
    const pool = await this.getPool();
    let sql = `
      SELECT l.*, e.name as emp_name, e.department, lt.name as leave_type_name, lt.code as leave_type_code, lt.color as leave_color
      FROM employee_leave_entries l
      LEFT JOIN employees e ON l.emp_id = e.id
      LEFT JOIN leave_types lt ON l.leave_type_id = lt.id
      WHERE 1=1
    `;
    const params = [];
    if (emp_id) { sql += ' AND l.emp_id = ?'; params.push(emp_id); }
    if (status) { sql += ' AND l.status = ?'; params.push(status); }

    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    const limit = Math.max(1, parseInt(size, 10) || 20);
    const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;
    sql += ' ORDER BY l.start_date DESC, l.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    return {
      leaves: rows,
      pagination: { total, page: Number(page), size: Number(size), total_pages: Math.ceil(total / limit) }
    };
  }

  async getLeaveEntryById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT l.*, e.name as emp_name, lt.name as leave_type_name
      FROM employee_leave_entries l
      LEFT JOIN employees e ON l.emp_id = e.id
      LEFT JOIN leave_types lt ON l.leave_type_id = lt.id
      WHERE l.id = ? LIMIT 1
    `, [id]);
    return rows[0] || null;
  }

  async insertLeaveEntry(data) {
    const pool = await this.getPool();
    const [res] = await pool.execute(`
      INSERT INTO employee_leave_entries (emp_id, leave_type_id, start_date, end_date, total_days, reason, status, comments, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      data.emp_id, data.leave_type_id, data.start_date, data.end_date,
      data.total_days || 1.0, data.reason, data.status || 'PENDING',
      data.comments || null
    ]);
    return this.getLeaveEntryById(res.insertId);
  }

  async updateLeaveStatus(id, { status, comments, approved_by }) {
    const pool = await this.getPool();
    await pool.execute(`
      UPDATE employee_leave_entries SET
        status = ?, comments = COALESCE(?, comments),
        approved_by = ?, approved_at = NOW(), updated_at = NOW()
      WHERE id = ?
    `, [status, comments || null, approved_by || 'Admin', id]);
    return this.getLeaveEntryById(id);
  }

  async deleteLeaveEntry(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM employee_leave_entries WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  async getEmployeeLeaveBalances(emp_id) {
    const pool = await this.getPool();
    const [leaveTypes] = await pool.query('SELECT * FROM leave_types WHERE active = 1');
    const [usedLeaves] = await pool.query(`
      SELECT leave_type_id, SUM(total_days) as used_days
      FROM employee_leave_entries
      WHERE emp_id = ? AND status = 'APPROVED'
      GROUP BY leave_type_id
    `, [emp_id]);

    const usedMap = {};
    for (const u of usedLeaves) {
      usedMap[u.leave_type_id] = parseFloat(u.used_days) || 0.0;
    }

    return leaveTypes.map(lt => {
      const used = usedMap[lt.id] || 0.0;
      const quota = parseFloat(lt.annual_quota) || 0.0;
      return {
        leave_type_id: lt.id,
        code: lt.code,
        name: lt.name,
        color: lt.color,
        annual_quota: quota,
        used_days: used,
        available_days: Math.max(0.0, quota - used)
      };
    });
  }

  // ── Outdoor / On-Duty Entries ──
  async getOutdoorEntries({ emp_id = '', status = '', page = 1, size = 20 } = {}) {
    const pool = await this.getPool();
    let sql = `
      SELECT od.*, e.name as emp_name, e.department
      FROM employee_outdoor_entries od
      LEFT JOIN employees e ON od.emp_id = e.id
      WHERE 1=1
    `;
    const params = [];
    if (emp_id) { sql += ' AND od.emp_id = ?'; params.push(emp_id); }
    if (status) { sql += ' AND od.status = ?'; params.push(status); }

    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    const limit = Math.max(1, parseInt(size, 10) || 20);
    const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;
    sql += ' ORDER BY od.od_date DESC, od.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    return {
      entries: rows,
      pagination: { total, page: Number(page), size: Number(size), total_pages: Math.ceil(total / limit) }
    };
  }

  async getOutdoorEntryById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT od.*, e.name as emp_name, e.department
      FROM employee_outdoor_entries od
      LEFT JOIN employees e ON od.emp_id = e.id
      WHERE od.id = ? LIMIT 1
    `, [id]);
    return rows[0] || null;
  }

  async insertOutdoorEntry(data) {
    const pool = await this.getPool();
    const [res] = await pool.execute(`
      INSERT INTO employee_outdoor_entries (emp_id, od_date, start_time, end_time, destination_client, purpose, travel_allowance_eligible, status, comments, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      data.emp_id, data.od_date, data.start_time || '09:00:00',
      data.end_time || '18:00:00', data.destination_client, data.purpose,
      data.travel_allowance_eligible !== undefined ? (data.travel_allowance_eligible ? 1 : 0) : 1,
      data.status || 'PENDING', data.comments || null
    ]);
    return this.getOutdoorEntryById(res.insertId);
  }

  async updateOutdoorStatus(id, { status, comments, approved_by }) {
    const pool = await this.getPool();
    await pool.execute(`
      UPDATE employee_outdoor_entries SET
        status = ?, comments = COALESCE(?, comments),
        approved_by = ?, approved_at = NOW(), updated_at = NOW()
      WHERE id = ?
    `, [status, comments || null, approved_by || 'Admin', id]);
    return this.getOutdoorEntryById(id);
  }

  async deleteOutdoorEntry(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM employee_outdoor_entries WHERE id = ?', [id]);
    return { id, deleted: true };
  }
}

module.exports = WorkflowDAO;
