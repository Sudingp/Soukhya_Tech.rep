/**
 * database/daos/roster_dao.js
 * Shift Roster Matrix Generation and Employee Schedule Overrides DAO (MySQL 8.4 LTS) (<500 lines)
 */

class RosterDAO {
  constructor(poolProvider) {
    this.getPool = poolProvider;
  }

  async getRosterMatrix({ month = '', department_id = '', branch_id = '', shift_id = '', search = '', page = 1, size = 50 } = {}) {
    const pool = await this.getPool();
    const currentMonth = (month && typeof month === 'string') ? month : new Date().toISOString().slice(0, 7);

    // 1. Get filtered employees
    let empSql = `
      SELECT e.id, e.id as emp_id, e.name, e.department, e.department_id, e.role, e.branch_id, e.primary_shift_id,
             b.name as branch_name, s.name as primary_shift_name
      FROM employees e
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN shifts s ON e.primary_shift_id = s.id
      WHERE e.status = 'Active'
    `;
    const empParams = [];
    if (department_id) {
      empSql += ' AND (e.department_id = ? OR e.department = ?)';
      empParams.push(department_id, department_id);
    }
    if (branch_id) {
      empSql += ' AND e.branch_id = ?';
      empParams.push(branch_id);
    }
    if (shift_id) {
      empSql += ' AND e.primary_shift_id = ?';
      empParams.push(shift_id);
    }
    if (search) {
      empSql += ' AND (e.id LIKE ? OR e.name LIKE ?)';
      empParams.push(`%${search}%`, `%${search}%`);
    }

    const countSql = `SELECT COUNT(*) as total FROM (${empSql}) as sub`;
    const [countRows] = await pool.query(countSql, empParams);
    const total = countRows[0]?.total || 0;

    const limit = Math.max(1, parseInt(size, 10) || 50);
    const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;
    empSql += ' ORDER BY e.id ASC LIMIT ? OFFSET ?';
    empParams.push(limit, offset);

    const [employees] = await pool.query(empSql, empParams);
    if (employees.length === 0) {
      return { month: currentMonth, daysInMonth: 30, roster: [], employees: [], pagination: { total: 0, page, size } };
    }

    // 2. Get roster entries for these employees in this month
    const empIds = employees.map(e => e.id);
    const placeholders = empIds.map(() => '?').join(',');
    const [rosterRows] = await pool.query(`
      SELECT r.roster_id, r.emp_id, r.roster_date, r.shift_id, r.day_type, r.source, r.note,
             s.name as shift_name, s.code as shift_code, s.color as shift_color
      FROM shift_roster r
      LEFT JOIN shifts s ON r.shift_id = s.id
      WHERE r.emp_id IN (${placeholders}) AND r.roster_date LIKE ?
      ORDER BY r.roster_date ASC
    `, [...empIds, `${currentMonth}%`]);

    const [year, mon] = currentMonth.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();

    // Map roster rows per employee
    const rosterMap = {};
    for (const r of rosterRows) {
      if (!rosterMap[r.emp_id]) rosterMap[r.emp_id] = {};
      const rawDate = r.roster_date;
      const dateStr = typeof rawDate === 'string' ? rawDate.slice(0, 10) : (rawDate instanceof Date ? rawDate.toISOString().slice(0, 10) : String(rawDate).slice(0, 10));
      const dayNum = parseInt(dateStr.slice(8, 10), 10);
      const slotData = {
        roster_id: r.roster_id,
        shift_id: r.shift_id,
        shift_code: r.shift_code || 'GEN',
        shift_name: r.shift_name || 'General Shift',
        shift_color: r.shift_color || '#4f8ef7',
        day_type: r.day_type,
        source: r.source,
        note: r.note
      };
      rosterMap[r.emp_id][dayNum] = slotData;
      rosterMap[r.emp_id][dateStr] = slotData;
    }

    const roster = employees.map(emp => ({
      id: emp.id,
      emp_id: emp.id,
      name: emp.name,
      department: emp.department,
      role: emp.role,
      branch_name: emp.branch_name,
      primary_shift_name: emp.primary_shift_name,
      schedule: rosterMap[emp.id] || {}
    }));

    return {
      month: currentMonth,
      daysInMonth,
      roster,
      employees: roster,
      pagination: { total, page: Number(page), size: Number(size), total_pages: Math.ceil(total / limit) }
    };
  }

  async assignEmployeeRoster({ emp_id, start_date, end_date, shift_id, day_type = 'WORK', note = null, assigned_by = 'Admin' }) {
    const pool = await this.getPool();
    const start = new Date(start_date);
    const end = new Date(end_date || start_date);
    let assigned = 0;

    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      const dateStr = dt.toISOString().slice(0, 10);
      await pool.execute(`
        INSERT INTO shift_roster (emp_id, roster_date, shift_id, day_type, source, note, assigned_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'MANUAL_OVERRIDE', ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          shift_id = VALUES(shift_id),
          day_type = VALUES(day_type),
          source = 'MANUAL_OVERRIDE',
          note = VALUES(note),
          assigned_by = VALUES(assigned_by),
          updated_at = NOW()
      `, [emp_id, dateStr, shift_id, day_type, note, assigned_by]);
      assigned++;
    }
    return { emp_id, start_date, end_date, shift_id, day_type, slots_updated: assigned };
  }

  async autoGenerateMonthlyRoster({ monthStr, department_id = null, overwrite = false }) {
    const pool = await this.getPool();
    let currentMonth = monthStr;
    if (!currentMonth || typeof currentMonth !== 'string' || !currentMonth.includes('-')) {
      currentMonth = new Date().toISOString().slice(0, 7);
    }
    const [year, mon] = currentMonth.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();

    // 1. Get active employees
    let empSql = "SELECT id, department_id, primary_shift_id FROM employees WHERE status = 'Active'";
    const empParams = [];
    if (department_id) {
      empSql += ' AND department_id = ?';
      empParams.push(department_id);
    }
    const [employees] = await pool.query(empSql, empParams);

    // 2. Get calendar day overrides (e.g. holidays, weekly offs)
    const [calendarDays] = await pool.query(
      'SELECT cal_date, cal_date as calendar_date, day_type, default_shift_id as shift_id, title as holiday_name FROM shift_calendar_days WHERE cal_date LIKE ?',
      [`${currentMonth}%`]
    );
    const calMap = {};
    for (const c of calendarDays) {
      const rawDate = c.cal_date || c.calendar_date;
      const dStr = typeof rawDate === 'string' ? rawDate.slice(0, 10) : (rawDate instanceof Date ? rawDate.toISOString().slice(0, 10) : String(rawDate).slice(0, 10));
      calMap[dStr] = c;
    }

    let createdSlots = 0;
    const batchSize = 1000;
    let batchValues = [];

    for (const emp of employees) {
      const defShift = emp.primary_shift_id || 'SHIFT_GEN';

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const calOverride = calMap[dateStr];
        const dayType = calOverride ? calOverride.day_type : 'WORK';
        const shiftId = (calOverride && calOverride.shift_id) ? calOverride.shift_id : defShift;
        const note = calOverride?.holiday_name || null;

        batchValues.push(emp.id, dateStr, shiftId, dayType, 'DEFAULT', note);

        if (batchValues.length >= batchSize * 6) {
          const placeholders = [];
          for (let k = 0; k < batchValues.length / 6; k++) {
            placeholders.push('(?, ?, ?, ?, ?, ?, NOW(), NOW())');
          }
          const sql = `
            INSERT INTO shift_roster (emp_id, roster_date, shift_id, day_type, source, note, created_at, updated_at)
            VALUES ${placeholders.join(', ')}
            ON DUPLICATE KEY UPDATE
              shift_id = IF(source = 'MANUAL_OVERRIDE', shift_id, VALUES(shift_id)),
              day_type = IF(source = 'MANUAL_OVERRIDE', day_type, VALUES(day_type)),
              updated_at = NOW()
          `;
          await pool.query(sql, batchValues);
          createdSlots += batchValues.length / 6;
          batchValues = [];
        }
      }
    }

    if (batchValues.length > 0) {
      const placeholders = [];
      for (let k = 0; k < batchValues.length / 6; k++) {
        placeholders.push('(?, ?, ?, ?, ?, ?, NOW(), NOW())');
      }
      const sql = `
        INSERT INTO shift_roster (emp_id, roster_date, shift_id, day_type, source, note, created_at, updated_at)
        VALUES ${placeholders.join(', ')}
        ON DUPLICATE KEY UPDATE
          shift_id = IF(source = 'MANUAL_OVERRIDE', shift_id, VALUES(shift_id)),
          day_type = IF(source = 'MANUAL_OVERRIDE', day_type, VALUES(day_type)),
          updated_at = NOW()
      `;
      await pool.query(sql, batchValues);
      createdSlots += batchValues.length / 6;
    }

    return { month: currentMonth, employeeCount: employees.length, createdSlots, total_slots: createdSlots };
  }

  async deleteRosterEntry(roster_id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM shift_roster WHERE roster_id = ?', [roster_id]);
    return { roster_id, deleted: true };
  }
}

module.exports = RosterDAO;
