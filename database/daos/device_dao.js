/**
 * database/daos/device_dao.js
 * Biometric Edge Terminals and Hardware Management DAO (MySQL 8.4 LTS)
 */

class DeviceDAO {
  constructor(poolProvider) {
    this.getPool = poolProvider;
  }

  async getAllDevices({ branch_id = null, status = null, active = null } = {}) {
    const pool = await this.getPool();
    let sql = `
      SELECT d.*, b.name as branch_name, b.city as branch_city
      FROM biometric_devices d
      LEFT JOIN branches b ON d.branch_id = b.id
      WHERE 1=1
    `;
    const params = [];
    if (branch_id) { sql += ' AND d.branch_id = ?'; params.push(branch_id); }
    if (status) { sql += ' AND d.status = ?'; params.push(status); }
    if (active !== null) { sql += ' AND d.active = ?'; params.push(active ? 1 : 0); }
    sql += ' ORDER BY d.device_name ASC';
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async getDeviceById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`
      SELECT d.*, b.name as branch_name
      FROM biometric_devices d
      LEFT JOIN branches b ON d.branch_id = b.id
      WHERE d.id = ?
      LIMIT 1
    `, [id]);
    return rows[0] || null;
  }

  async getDeviceBySerial(serial) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM biometric_devices WHERE serial_number = ? LIMIT 1', [serial]);
    return rows[0] || null;
  }

  async insertDevice(data) {
    const pool = await this.getPool();
    const id = data.id || `DEV_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await pool.execute(`
      INSERT INTO biometric_devices (id, serial_number, device_name, device_ip, device_port, device_model, protocol, branch_id, direction, status, template_count, buffer_lag_ms, active, last_heartbeat, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
    `, [
      id, data.serial_number, data.device_name, data.device_ip,
      data.device_port || 4370, data.device_model || 'eSSL SilkBio-101TC',
      data.protocol || 'ESSL', data.branch_id || null,
      data.direction || 'BOTH', data.status || 'ONLINE',
      data.template_count || 0, data.buffer_lag_ms || 10,
      data.active !== undefined ? (data.active ? 1 : 0) : 1
    ]);
    return this.getDeviceById(id);
  }

  async updateDevice(data) {
    const pool = await this.getPool();
    await pool.execute(`
      UPDATE biometric_devices SET
        serial_number = COALESCE(?, serial_number),
        device_name = COALESCE(?, device_name),
        device_ip = COALESCE(?, device_ip),
        device_port = COALESCE(?, device_port),
        device_model = COALESCE(?, device_model),
        protocol = COALESCE(?, protocol),
        branch_id = ?,
        direction = COALESCE(?, direction),
        status = COALESCE(?, status),
        active = COALESCE(?, active),
        updated_at = NOW()
      WHERE id = ?
    `, [
      data.serial_number || null, data.device_name || null,
      data.device_ip || null, data.device_port || null,
      data.device_model || null, data.protocol || null,
      data.branch_id !== undefined ? (data.branch_id || null) : null,
      data.direction || null, data.status || null,
      data.active !== undefined ? (data.active ? 1 : 0) : null,
      data.id
    ]);
    return this.getDeviceById(data.id);
  }

  async deleteDevice(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM biometric_devices WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  async pingDevice(id) {
    const pool = await this.getPool();
    const lag = Math.floor(Math.random() * 20) + 5;
    await pool.execute(
      `UPDATE biometric_devices SET last_heartbeat = NOW(), status = 'ONLINE', buffer_lag_ms = ?, updated_at = NOW() WHERE id = ?`,
      [lag, id]
    );
    return this.getDeviceById(id);
  }

  async syncDeviceTemplates(id) {
    const pool = await this.getPool();
    const [empCount] = await pool.query("SELECT COUNT(*) as count FROM employees WHERE status = 'Active'");
    const totalTemplates = empCount[0]?.count || 0;
    await pool.execute(
      `UPDATE biometric_devices SET template_count = ?, last_heartbeat = NOW(), updated_at = NOW() WHERE id = ?`,
      [totalTemplates, id]
    );
    return { id, template_count: totalTemplates, synced: true };
  }
}

module.exports = DeviceDAO;
