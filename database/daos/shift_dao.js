/**
 * database/daos/shift_dao.js
 * Shifts, Shift Calendar, Weekly Off Patterns, and Cohort Groups DAO (MySQL 8.4 LTS)
 */

class ShiftDAO {
  constructor(poolProvider) {
    this.getPool = poolProvider;
  }

  // ── Shifts Master ──
  async getAllShifts({ active = null } = {}) {
    const pool = await this.getPool();
    let sql = 'SELECT * FROM shifts WHERE 1=1';
    const params = [];
    if (active !== null) {
      sql += ' AND active = ?';
      params.push(active ? 1 : 0);
    }
    sql += ' ORDER BY start_time ASC';
    const [rows] = await pool.execute(sql, params);
    return rows;
  }

  async getShiftById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM shifts WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  async getShiftByCode(code) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM shifts WHERE code = ? LIMIT 1', [code]);
    return rows[0] || null;
  }

  async insertShift(data) {
    const pool = await this.getPool();
    const id = data.id || `SHIFT_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await pool.execute(`
      INSERT INTO shifts (
        id, code, name, start_time, end_time, break_mins,
        late_grace_mins, min_half_day_hrs, min_full_day_hrs, is_night_shift,
        color, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      id, data.code, data.name, data.start_time, data.end_time,
      data.break_mins || data.break_duration_mins || 60,
      data.late_grace_mins || data.grace_period_mins || 15,
      data.min_half_day_hrs || 4.0, data.min_full_day_hrs || 8.0,
      data.is_night_shift ? 1 : 0, data.color || '#4f8ef7',
      data.active !== undefined ? (data.active ? 1 : 0) : 1
    ]);
    return this.getShiftById(id);
  }

  async updateShift(data) {
    const pool = await this.getPool();
    await pool.execute(`
      UPDATE shifts SET
        name = COALESCE(?, name),
        start_time = COALESCE(?, start_time),
        end_time = COALESCE(?, end_time),
        break_mins = COALESCE(?, break_mins),
        late_grace_mins = COALESCE(?, late_grace_mins),
        min_half_day_hrs = COALESCE(?, min_half_day_hrs),
        min_full_day_hrs = COALESCE(?, min_full_day_hrs),
        is_night_shift = COALESCE(?, is_night_shift),
        color = COALESCE(?, color),
        active = COALESCE(?, active),
        updated_at = NOW()
      WHERE id = ?
    `, [
      data.name || null, data.start_time || null, data.end_time || null,
      data.break_mins !== undefined ? data.break_mins : (data.break_duration_mins !== undefined ? data.break_duration_mins : null),
      data.late_grace_mins !== undefined ? data.late_grace_mins : (data.grace_period_mins !== undefined ? data.grace_period_mins : null),
      data.min_half_day_hrs !== undefined ? data.min_half_day_hrs : null,
      data.min_full_day_hrs !== undefined ? data.min_full_day_hrs : null,
      data.is_night_shift !== undefined ? (data.is_night_shift ? 1 : 0) : null,
      data.color || null, data.active !== undefined ? (data.active ? 1 : 0) : null,
      data.id
    ]);
    return this.getShiftById(data.id);
  }

  async deleteShift(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM shifts WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  // ── Shift Calendar Days ──
  async getShiftCalendar({ month = '', year = '' } = {}) {
    const pool = await this.getPool();
    let sql = `
      SELECT c.cal_id, c.cal_date, c.cal_date as calendar_date, c.day_type,
             c.default_shift_id, c.default_shift_id as shift_id,
             c.title, c.title as holiday_name, c.is_recurring, c.updated_by, c.updated_at,
             s.name as shift_name, s.code as shift_code, s.color as shift_color
      FROM shift_calendar_days c
      LEFT JOIN shifts s ON c.default_shift_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (month) {
      sql += ' AND c.cal_date LIKE ?';
      params.push(`${month}%`);
    } else if (year) {
      sql += ' AND c.cal_date LIKE ?';
      params.push(`${year}%`);
    }
    sql += ' ORDER BY c.cal_date ASC';
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async setCalendarDay(data) {
    const pool = await this.getPool();
    const calDate = data.cal_date || data.calendar_date;
    const shiftId = data.default_shift_id || data.shift_id || null;
    const title = data.title || data.holiday_name || data.note || null;
    await pool.execute(`
      INSERT INTO shift_calendar_days (cal_date, day_type, default_shift_id, title, updated_at)
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        day_type = VALUES(day_type),
        default_shift_id = VALUES(default_shift_id),
        title = VALUES(title),
        updated_at = NOW()
    `, [calDate, data.day_type || 'WORK', shiftId, title]);
    const [rows] = await pool.execute('SELECT *, cal_date as calendar_date FROM shift_calendar_days WHERE cal_date = ?', [calDate]);
    return rows[0] || null;
  }

  async deleteCalendarDay(calendar_date) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM shift_calendar_days WHERE cal_date = ?', [calendar_date]);
    return { calendar_date, deleted: true };
  }

  async applyWeeklyOffPattern(monthStr, pattern = 'SUN_ONLY') {
    const pool = await this.getPool();
    const [year, month] = monthStr.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    let satCount = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month - 1, d);
      const dayOfWeek = dt.getDay(); // 0 = Sun, 6 = Sat
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      let isOff = false;
      if (dayOfWeek === 0) {
        isOff = true;
      } else if (dayOfWeek === 6) {
        satCount++;
        if (pattern === 'ALL_SAT_SUN') {
          isOff = true;
        } else if (pattern === 'SUN_AND_ALT_SAT' && (satCount === 2 || satCount === 4)) {
          isOff = true;
        }
      }

      if (isOff) {
        await this.setCalendarDay({
          calendar_date: dateStr,
          day_type: 'WEEKLY_OFF',
          note: dayOfWeek === 0 ? 'Sunday Weekly Off' : `Saturday Off (#${satCount})`
        });
      }
    }
    return { month: monthStr, pattern, daysInMonth, applied: true };
  }

  // ── Shift Groups ──
  async getShiftGroups({ active = null } = {}) {
    const pool = await this.getPool();
    let sql = `
      SELECT g.*,
             COUNT(m.emp_id) as member_count
      FROM shift_groups g
      LEFT JOIN shift_group_members m ON g.id = m.group_id AND m.active = 1
      WHERE 1=1
    `;
    const params = [];
    if (active !== null) {
      sql += ' AND g.active = ?';
      params.push(active ? 1 : 0);
    }
    sql += ' GROUP BY g.id ORDER BY g.name ASC';
    const [rows] = await pool.query(sql, params);
    return rows.map(r => {
      try {
        r.shifts_sequence = typeof r.shifts_sequence === 'string' ? JSON.parse(r.shifts_sequence) : r.shifts_sequence;
      } catch (_) {}
      return r;
    });
  }

  async getShiftGroupById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM shift_groups WHERE id = ? LIMIT 1', [id]);
    if (rows[0]) {
      try {
        rows[0].shifts_sequence = typeof rows[0].shifts_sequence === 'string' ? JSON.parse(rows[0].shifts_sequence) : rows[0].shifts_sequence;
      } catch (_) {}
    }
    return rows[0] || null;
  }

  async insertShiftGroup(data) {
    const pool = await this.getPool();
    const id = data.id || `GRP_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const seq = Array.isArray(data.shifts_sequence) ? JSON.stringify(data.shifts_sequence) : (data.shifts_sequence || JSON.stringify(['SHIFT_GEN']));
    await pool.execute(`
      INSERT INTO shift_groups (id, code, name, description, rotation_type, color, shifts_sequence, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      id, data.code, data.name, data.description || null,
      data.rotation_type || 'FIXED', data.color || '#4f8ef7',
      seq,
      data.active !== undefined ? (data.active ? 1 : 0) : 1
    ]);
    return this.getShiftGroupById(id);
  }

  async updateShiftGroup(data) {
    const pool = await this.getPool();
    const seq = Array.isArray(data.shifts_sequence) ? JSON.stringify(data.shifts_sequence) : (data.shifts_sequence !== undefined ? data.shifts_sequence : null);
    await pool.execute(`
      UPDATE shift_groups SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        rotation_type = COALESCE(?, rotation_type),
        color = COALESCE(?, color),
        shifts_sequence = COALESCE(?, shifts_sequence),
        active = COALESCE(?, active),
        updated_at = NOW()
      WHERE id = ?
    `, [
      data.name || null, data.description || null,
      data.rotation_type || null, data.color || null,
      seq,
      data.active !== undefined ? (data.active ? 1 : 0) : null,
      data.id
    ]);
    return this.getShiftGroupById(data.id);
  }

  async deleteShiftGroup(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM shift_groups WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  async getShiftGroupMembers(groupId) {
    const pool = await this.getPool();
    const [rows] = await pool.query(`
      SELECT m.*, e.name as emp_name, e.department, e.role, e.status
      FROM shift_group_members m
      JOIN employees e ON m.emp_id = e.id
      WHERE m.group_id = ? AND m.active = 1
      ORDER BY e.name ASC
    `, [groupId]);
    return rows;
  }

  async assignShiftGroupMembers(groupId, memberIds) {
    const pool = await this.getPool();
    let assigned = 0;
    for (const empId of memberIds) {
      await pool.execute(`
        INSERT INTO shift_group_members (group_id, emp_id, start_date, active, created_at)
        VALUES (?, ?, CURDATE(), 1, NOW())
        ON DUPLICATE KEY UPDATE active = 1
      `, [groupId, empId]);
      assigned++;
    }
    return { groupId, assigned };
  }

  async removeShiftGroupMember(groupId, empId) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM shift_group_members WHERE group_id = ? AND emp_id = ?', [groupId, empId]);
    return { groupId, empId, removed: true };
  }

  // ── Employee Cohort Groups ──
  async getCohortGroups() {
    const pool = await this.getPool();
    const [rows] = await pool.query(`
      SELECT g.*, e.name as leader_name, COUNT(m.emp_id) as member_count
      FROM employee_cohort_groups g
      LEFT JOIN employees e ON g.leader_emp_id = e.id
      LEFT JOIN employee_cohort_members m ON g.id = m.group_id
      GROUP BY g.id ORDER BY g.name ASC
    `);
    return rows;
  }

  async getCohortGroupById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM employee_cohort_groups WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  async insertCohortGroup(data) {
    const pool = await this.getPool();
    const id = data.id || `EGRP_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await pool.execute(`
      INSERT INTO employee_cohort_groups (id, code, name, category, description, leader_emp_id, color, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      id, data.code, data.name, data.category || 'OPERATIONAL',
      data.description || null, data.leader_emp_id || null,
      data.color || '#4f8ef7', data.active !== undefined ? (data.active ? 1 : 0) : 1
    ]);
    return this.getCohortGroupById(id);
  }

  async deleteCohortGroup(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM employee_cohort_groups WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  async getCohortGroupMembers(groupId) {
    const pool = await this.getPool();
    const [rows] = await pool.query(`
      SELECT m.*, e.name as emp_name, e.department, e.role, e.company
      FROM employee_cohort_members m
      JOIN employees e ON m.emp_id = e.id
      WHERE m.group_id = ?
      ORDER BY e.name ASC
    `, [groupId]);
    return rows;
  }

  async assignCohortMembers(groupId, members) {
    const pool = await this.getPool();
    let count = 0;
    for (const item of members) {
      const empId = typeof item === 'string' ? item : item.emp_id;
      const role = typeof item === 'object' ? item.role_in_group || 'Member' : 'Member';
      await pool.execute(`
        INSERT INTO employee_cohort_members (group_id, emp_id, role_in_group, assigned_at)
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE role_in_group = VALUES(role_in_group)
      `, [groupId, empId, role]);
      count++;
    }
    return { groupId, count };
  }

  async removeCohortMember(groupId, empId) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM employee_cohort_members WHERE group_id = ? AND emp_id = ?', [groupId, empId]);
    return { groupId, empId, removed: true };
  }
}

module.exports = ShiftDAO;
