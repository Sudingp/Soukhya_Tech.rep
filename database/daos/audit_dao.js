/**
 * database/daos/audit_dao.js
 * Audit Logs and Master Settings Persistence DAO (MySQL 8.4 LTS) (<500 lines)
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
    const [rows] = await pool.query('SELECT setting_key, setting_value, category, description FROM master_settings');
    const dict = {};
    for (const r of rows) {
      let val = r.setting_value;
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (!isNaN(val) && val.trim() !== '') val = Number(val);
      dict[r.setting_key] = val;
    }
    return dict;
  }

  async updateMasterSettings(data) {
    const pool = await this.getPool();
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined || v === null) continue;
      const strVal = typeof v === 'object' ? JSON.stringify(v) : String(v);
      await pool.execute(`
        INSERT INTO master_settings (setting_key, setting_value, updated_by, updated_at)
        VALUES (?, ?, 'admin', NOW())
        ON DUPLICATE KEY UPDATE
          setting_value = VALUES(setting_value),
          updated_by = 'admin',
          updated_at = NOW()
      `, [k, strVal]);
    }
    return this.getMasterSettings();
  }
}

module.exports = AuditDAO;
