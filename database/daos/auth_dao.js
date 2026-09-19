/**
 * database/daos/auth_dao.js
 * User Authentication, RBAC, and Token Blacklist DAO (MySQL 8.4 LTS)
 */

class AuthDAO {
  constructor(poolProvider) {
    this.getPool = poolProvider;
  }

  async getUserByUsername(username) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
    return rows[0] || null;
  }

  async getUserById(id) {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT id, username, role, emp_id, created_at FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async getAllUsers() {
    const pool = await this.getPool();
    const [rows] = await pool.execute('SELECT id, username, role, emp_id, created_at FROM users ORDER BY id ASC');
    return rows;
  }

  async insertUser({ username, password_hash, role = 'USER', emp_id = null }) {
    const pool = await this.getPool();
    const [result] = await pool.execute(
      'INSERT INTO users (username, password_hash, role, emp_id) VALUES (?, ?, ?, ?)',
      [username, password_hash, role, emp_id]
    );
    return { id: result.insertId, username, role, emp_id };
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
    const [rows] = await pool.execute(
      'SELECT id FROM token_blacklist WHERE token_jti = ? AND expires_at > NOW() LIMIT 1',
      [tokenJti]
    );
    return rows.length > 0;
  }

  async blacklistToken(tokenJti, expiresAt) {
    const pool = await this.getPool();
    await pool.execute(
      'INSERT INTO token_blacklist (token_jti, expires_at) VALUES (?, ?) ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)',
      [tokenJti, expiresAt]
    );
    return { blacklisted: true };
  }

  async pruneExpiredTokens() {
    const pool = await this.getPool();
    const [result] = await pool.execute('DELETE FROM token_blacklist WHERE expires_at <= NOW()');
    return { deleted: result.affectedRows };
  }
}

module.exports = AuthDAO;
