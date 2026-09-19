/**
 * database/daos/audit_dao.js
 * Audit Logs and Master Settings Persistence DAO (MySQL 8.4 LTS)
 */

class AuditDAO {
  constructor(poolProvider) {
    this.getPool = poolProvider;
  }

  async insertAuditLog({ table_name, record_id, action, old_values = null, new_values = null, performed_by = 'system', ip_address = null, user_agent = null }) {
    const pool = await this.getPool();
    const oldValStr = old_values ? (typeof old_values === 'string' ? old_values : JSON.stringify(old_values)) : null;
    const newValStr = new_values ? (typeof new_values === 'string' ? new_values : JSON.stringify(new_values)) : null;

    const [res] = await pool.execute(`
      INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, performed_by, ip_address, user_agent, performed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [table_name, String(record_id), action, oldValStr, newValStr, performed_by, ip_address, user_agent]);
    return { log_id: res.insertId, table_name, action };
  }

  async getAuditLogs({ page = 1, size = 25, table_name = '', action = '', performed_by = '' } = {}) {
    const pool = await this.getPool();
    let sql = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];

    if (table_name) { sql += ' AND table_name = ?'; params.push(table_name); }
    if (action) { sql += ' AND action = ?'; params.push(action); }
    if (performed_by) { sql += ' AND performed_by = ?'; params.push(performed_by); }

    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as sub`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    const limit = Math.max(1, parseInt(size, 10) || 25);
    const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;
    sql += ' ORDER BY performed_at DESC, log_id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    return {
      logs: rows,
      pagination: { total, page: Number(page), size: Number(size), total_pages: Math.ceil(total / limit) }
    };
  }

  async getMasterSettings() {
    const pool = await this.getPool();
    const [rows] = await pool.query('SELECT * FROM master_settings ORDER BY id ASC LIMIT 1');
    if (rows.length > 0) return rows[0];

    // Seed default settings if empty
    await pool.execute(`
      INSERT INTO master_settings (id, company_name, auto_approval_enabled, daily_ot_cap_hours, late_grace_minutes, weekly_off_pattern, ip_whitelist_enabled, biometric_threshold, active, created_at, updated_at)
      VALUES (1, 'Soukhya Tech Enterprise HQ', 1, 4.00, 15, 'SUN_ONLY', 0, 0.60, 1, NOW(), NOW())
      ON DUPLICATE KEY UPDATE id=1
    `);
    const [defRows] = await pool.query('SELECT * FROM master_settings WHERE id = 1');
    return defRows[0];
  }

  async updateMasterSettings(data) {
    const pool = await this.getPool();
    await pool.execute(`
      UPDATE master_settings SET
        company_name = COALESCE(?, company_name),
        auto_approval_enabled = COALESCE(?, auto_approval_enabled),
        daily_ot_cap_hours = COALESCE(?, daily_ot_cap_hours),
        late_grace_minutes = COALESCE(?, late_grace_minutes),
        weekly_off_pattern = COALESCE(?, weekly_off_pattern),
        ip_whitelist_enabled = COALESCE(?, ip_whitelist_enabled),
        biometric_threshold = COALESCE(?, biometric_threshold),
        updated_at = NOW()
      WHERE id = 1
    `, [
      data.company_name || null,
      data.auto_approval_enabled !== undefined ? (data.auto_approval_enabled ? 1 : 0) : null,
      data.daily_ot_cap_hours !== undefined ? data.daily_ot_cap_hours : null,
      data.late_grace_minutes !== undefined ? data.late_grace_minutes : null,
      data.weekly_off_pattern || null,
      data.ip_whitelist_enabled !== undefined ? (data.ip_whitelist_enabled ? 1 : 0) : null,
      data.biometric_threshold !== undefined ? data.biometric_threshold : null
    ]);
    return this.getMasterSettings();
  }
}

module.exports = AuditDAO;
