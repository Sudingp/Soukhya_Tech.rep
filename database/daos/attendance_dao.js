/**
 * database/daos/attendance_dao.js
 * High-Speed Attendance Ledger, Punch Cooldown, and Stats DAO (MySQL 8.4 LTS)
 */

class AttendanceDAO {
  constructor(poolProvider) {
    this.getPool = poolProvider;
  }

  _formatDatetime(dt) {
    if (!dt) return new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (typeof dt === 'string') return dt.replace('T', ' ').slice(0, 19);
    return new Date(dt).toISOString().slice(0, 19).replace('T', ' ');
  }

  async insertAtt({ emp_id, name, dept, role, timestamp, status = 'Present', logged_by = null, ip_address = null, user_agent = null }) {
    const pool = await this.getPool();
    const formattedTs = this._formatDatetime(timestamp);
    const [result] = await pool.execute(`
      INSERT INTO attendance (emp_id, name, dept, role, timestamp, status, logged_by, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [emp_id, name, dept, role, formattedTs, status, logged_by, ip_address, user_agent]);
    return { lastInsertRowid: result.insertId, changes: result.affectedRows };
  }

  async checkDuplicate(emp_id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT att_id FROM attendance
      WHERE emp_id = ? AND (
        (timestamp >= CURDATE() AND timestamp < DATE_ADD(CURDATE(), INTERVAL 1 DAY))
        OR (timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR))
        OR (timestamp >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR))
      )
      LIMIT 1
    `, [emp_id]);
    return rows[0] || null;
  }

  async getRecentAttendance(limit = 10) {
    const pool = await this.getPool();
    const [rows] = await pool.query(`
      SELECT a.*, e.company, e.branch_id, b.name as branch_name
      FROM attendance a
      LEFT JOIN employees e ON a.emp_id = e.id
      LEFT JOIN branches b ON e.branch_id = b.id
      ORDER BY a.timestamp DESC, a.att_id DESC
      LIMIT ?
    `, [Number(limit)]);
    return rows;
  }

  async getAttendanceLogs({ page = 1, size = 20, startDate = '', endDate = '', emp_id = '', status = '', dept = '' } = {}) {
    const pool = await this.getPool();
    let sql = `
      SELECT a.att_id, a.emp_id, a.name, a.dept, a.role, a.timestamp, a.status,
             a.logged_by, a.ip_address, a.user_agent, a.created_at,
             e.company, e.branch_id, b.name as branch_name
      FROM attendance a
      LEFT JOIN employees e ON a.emp_id = e.id
      LEFT JOIN branches b ON e.branch_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      sql += ' AND a.timestamp >= ?';
      params.push(this._formatDatetime(startDate));
    }
    if (endDate) {
      sql += ' AND a.timestamp <= ?';
      params.push(this._formatDatetime(endDate) + ' 23:59:59');
    }
    if (emp_id) {
      sql += ' AND a.emp_id = ?';
      params.push(emp_id);
    }
    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }
    if (dept) {
      sql += ' AND (a.dept = ? OR e.department_id = ?)';
      params.push(dept, dept);
    }

    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    const limit = Math.max(1, parseInt(size, 10) || 20);
    const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;
    sql += ' ORDER BY a.timestamp DESC, a.att_id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    return {
      attendance_logs: rows,
      pagination: { total, page: Number(page), size: Number(size), total_pages: Math.ceil(total / limit) }
    };
  }

  async getStats() {
    const pool = await this.getPool();
    const [counts] = await pool.query(`
      SELECT
        COUNT(*) as total_employees,
        SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN status = 'Hibernate' THEN 1 ELSE 0 END) as hibernate_count,
        SUM(CASE WHEN status = 'On Leave' THEN 1 ELSE 0 END) as on_leave_count,
        SUM(CASE WHEN status = 'Resigned' THEN 1 ELSE 0 END) as resigned_count
      FROM employees
    `);
    const [todayCount] = await pool.query(`
      SELECT
        COUNT(*) as total_punches,
        COUNT(DISTINCT emp_id) as present_count,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as on_time,
        SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late_count
      FROM attendance
      WHERE timestamp >= CURDATE() AND timestamp < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
    `);

    const [deptHib] = await pool.query(`
      SELECT COALESCE(NULLIF(department, ''), 'Unassigned') as department, COUNT(*) as count
      FROM employees
      WHERE status = 'Hibernate'
      GROUP BY department
      ORDER BY count DESC
      LIMIT 10
    `);

    const [monthTrend] = await pool.query(`
      SELECT COALESCE(DATE_FORMAT(hibernate_start_date, '%Y-%m'), DATE_FORMAT(updated_at, '%Y-%m'), '2026-04') as month, COUNT(*) as count
      FROM employees
      WHERE status = 'Hibernate'
      GROUP BY month
      ORDER BY month ASC
      LIMIT 6
    `);

    const empRow = counts[0] || {};
    const totalEmp = Number(empRow.total_employees || 0);
    const activeEmp = Number(empRow.active_count || 0);
    const hibernateEmp = Number(empRow.hibernate_count || 0);
    const onLeaveEmp = Number(empRow.on_leave_count || 0);
    const resignedEmp = Number(empRow.resigned_count || 0);

    const present = Number(todayCount[0]?.present_count || 0);
    const absent = Math.max(0, activeEmp - present);

    return {
      totalEmployees: totalEmp,
      total_employees: totalEmp,
      activeEmployees: activeEmp,
      active_employees: activeEmp,
      presentToday: present,
      present_today: present,
      absentToday: absent,
      absent_today: absent,
      onTimeToday: Number(todayCount[0]?.on_time || 0),
      on_time_today: Number(todayCount[0]?.on_time || 0),
      lateToday: Number(todayCount[0]?.late_count || 0),
      late_today: Number(todayCount[0]?.late_count || 0),
      status_counts: {
        active: activeEmp,
        hibernate: hibernateEmp,
        on_leave: onLeaveEmp,
        resigned: resignedEmp
      },
      dept_hibernate_counts: deptHib.map(d => ({ department: d.department, count: Number(d.count) })),
      monthly_hibernate_trend: monthTrend.map(t => ({ month: t.month, count: Number(t.count) }))
    };
  }

  async getStatsByRange(startDate, endDate) {
    const pool = await this.getPool();
    const [rows] = await pool.query(`
      SELECT
        DATE(timestamp) as punch_date,
        COUNT(DISTINCT emp_id) as present_count,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as on_time,
        SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late_count
      FROM attendance
      WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY DATE(timestamp)
      ORDER BY punch_date ASC
    `, [this._formatDatetime(startDate), this._formatDatetime(endDate) + ' 23:59:59']);
    return rows;
  }

  async regularizeAttendance(att_id, { status, reason, regularized_by }) {
    const pool = await this.getPool();
    await pool.execute(`
      UPDATE attendance SET
        status = ?,
        logged_by = CONCAT(COALESCE(logged_by, 'Manual'), ' [Regularized by ', ?, ': ', ?, ']')
      WHERE att_id = ?
    `, [status, regularized_by || 'Admin', reason || 'Manager Regularization', att_id]);
    const [rows] = await pool.execute('SELECT * FROM attendance WHERE att_id = ?', [att_id]);
    return rows[0] || null;
  }
}

module.exports = AttendanceDAO;
