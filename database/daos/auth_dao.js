/**
 * database/daos/auth_dao.js
 * User Authentication, RBAC, and Token Blacklist DAO (MySQL 8.4 LTS) (<500 lines)
 */

const crypto = require('crypto');

class AuthDAO {
  constructor(poolProvider) {
    this.getPool = poolProvider;
  }

  async getUserByUsername(username) {
    const pool = await this.getPool();
    const uHash = crypto.createHash('sha256').update(String(username).toLowerCase()).digest('hex');
    const [rows] = await pool.execute(
      'SELECT id, username, username_display, password_hash, role, active, created_at FROM users WHERE username = ? OR username_hash = ? LIMIT 1',
      [username, uHash]
    );
    return rows[0] || null;
  }

  async getUserById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(
      'SELECT id, username, username_display, role, active, created_at FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  }

  async getAllUsers() {
    const pool = await this.getPool();
    const [rows] = await pool.execute(
      'SELECT id, username, username_display, role, active, created_at FROM users ORDER BY id ASC'
    );
    return rows;
  }

  async insertUser({ username, password_hash, role = 'USER' }) {
    const pool = await this.getPool();
    const uHash = crypto.createHash('sha256').update(String(username).toLowerCase()).digest('hex');
    const [result] = await pool.execute(
      'INSERT INTO users (username, username_hash, username_display, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [username, uHash, username, password_hash, role]
    );
    return { id: result.insertId, username, role };
  }

  async updateUserPassword(id, password_hash) {
    const pool = await this.getPool();
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, id]);
    return { id, updated: true };
  }

  async deleteUser(id) {
    const pool = await this.getPool();
    await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    return { id, deleted: true };
  }

  async isTokenBlacklisted(tokenJti) {
    const pool = await this.getPool();
    const hash = crypto.createHash('sha256').update(String(tokenJti)).digest('hex');
    const [rows] = await pool.execute(
      'SELECT token_hash FROM token_blacklist WHERE token_hash = ? AND expires_at > ? LIMIT 1',
      [hash, Date.now()]
    );
    return rows.length > 0;
  }

  async blacklistToken(tokenJti, expiresAt) {
    const pool = await this.getPool();
    const hash = crypto.createHash('sha256').update(String(tokenJti)).digest('hex');
    const exp = typeof expiresAt === 'number' ? expiresAt : (new Date(expiresAt).getTime() || (Date.now() + 86400000));
    await pool.execute(
      'INSERT INTO token_blacklist (token_hash, expires_at) VALUES (?, ?) ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)',
      [hash, exp]
    );
    return { blacklisted: true };
  }

  async pruneExpiredTokens() {
    const pool = await this.getPool();
    const [result] = await pool.execute('DELETE FROM token_blacklist WHERE expires_at <= ?', [Date.now()]);
    return { deleted: result.affectedRows };
  }
}

module.exports = AuthDAO;
