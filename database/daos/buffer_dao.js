/**
 * database/daos/buffer_dao.js
 * High-Speed Fast Punch Buffer and Asynchronous Drain Pipeline DAO (MySQL 8.4 LTS)
 */

class BufferDAO {
  constructor(poolProvider) {
    this.getPool = poolProvider;
  }

  _formatDatetime(dt) {
    if (!dt) return new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (typeof dt === 'string') return dt.replace('T', ' ').slice(0, 19);
    return new Date(dt).toISOString().slice(0, 19).replace('T', ' ');
  }

  async ingestFastPunch(data) {
    const pool = await this.getPool();
    const t0 = process.hrtime();
    const punchTs = this._formatDatetime(data.punch_timestamp);

    const [res] = await pool.execute(`
      INSERT INTO fast_punch_buffer (
        emp_id, terminal_id, punch_timestamp, punch_state,
        verification_type, temperature, mask_detected, processed, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())
    `, [
      data.emp_id,
      data.terminal_id || 'EDGE_TERMINAL_01',
      punchTs,
      data.punch_state || 'AUTO',
      data.verification_type || 'FACE',
      data.temperature || null,
      data.mask_detected ? 1 : 0
    ]);

    const diff = process.hrtime(t0);
    const latencyMs = parseFloat(((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(2));

    await pool.execute('UPDATE fast_punch_buffer SET process_latency_ms = ? WHERE id = ?', [latencyMs, res.insertId]);

    return {
      id: res.insertId,
      emp_id: data.emp_id,
      latency_ms: latencyMs,
      status: 'QUEUED'
    };
  }

  async batchIngestFastPunches(punches = []) {
    const pool = await this.getPool();
    if (!Array.isArray(punches) || punches.length === 0) {
      return { inserted: 0, latency_ms: 0 };
    }

    const t0 = process.hrtime();
    const placeholders = [];
    const values = [];

    for (const p of punches) {
      placeholders.push('(?, ?, ?, ?, ?, ?, ?, 0, NOW())');
      values.push(
        p.emp_id,
        p.terminal_id || 'BATCH_INGEST_01',
        this._formatDatetime(p.punch_timestamp),
        p.punch_state || 'AUTO',
        p.verification_type || 'FACE',
        p.temperature || null,
        p.mask_detected ? 1 : 0
      );
    }

    const sql = `
      INSERT INTO fast_punch_buffer (
        emp_id, terminal_id, punch_timestamp, punch_state,
        verification_type, temperature, mask_detected, processed, created_at
      ) VALUES ${placeholders.join(', ')}
    `;

    const [res] = await pool.query(sql, values);
    const diff = process.hrtime(t0);
    const latencyMs = parseFloat(((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(2));

    return {
      inserted: res.affectedRows,
      latency_ms: latencyMs,
      batch_size: punches.length
    };
  }

  async flushFastPunchBuffer(limit = 1000) {
    const pool = await this.getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [pending] = await conn.query(
        'SELECT * FROM fast_punch_buffer WHERE processed = 0 ORDER BY punch_timestamp ASC LIMIT ? FOR UPDATE',
        [Number(limit)]
      );

      let processedCount = 0;
      let duplicateCount = 0;

      for (const p of pending) {
        // Fast deduplication check within 5 min
        const [recent] = await conn.query(
          `SELECT att_id FROM attendance
           WHERE emp_id = ? AND timestamp >= DATE_SUB(?, INTERVAL 5 MINUTE) AND timestamp <= DATE_ADD(?, INTERVAL 5 MINUTE)
           LIMIT 1`,
          [p.emp_id, p.punch_timestamp, p.punch_timestamp]
        );

        if (recent.length > 0) {
          await conn.execute('UPDATE fast_punch_buffer SET processed = 2 WHERE id = ?', [p.id]);
          duplicateCount++;
        } else {
          // Write to attendance table
          await conn.execute(
            `INSERT INTO attendance (emp_id, name, dept, role, timestamp, status, logged_by, ip_address, user_agent)
             SELECT e.id, e.name, e.department, e.role, ?, 'Present', 'FastPunchEngine', '127.0.0.1', ?
             FROM employees e WHERE e.id = ?`,
            [p.punch_timestamp, p.terminal_id || 'Hardware Terminal', p.emp_id]
          );
          // Mark processed
          await conn.execute('UPDATE fast_punch_buffer SET processed = 1 WHERE id = ?', [p.id]);
          processedCount++;
        }
      }

      await conn.commit();
      return { total_drained: pending.length, processed: processedCount, duplicates: duplicateCount, errors: 0 };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async getFastPunchMetrics() {
    const pool = await this.getPool();
    const [counts] = await pool.query(`
      SELECT
        COUNT(*) as total_ingested,
        CAST(COALESCE(SUM(CASE WHEN processed = 0 THEN 1 ELSE 0 END), 0) AS UNSIGNED) as queued_count,
        CAST(COALESCE(SUM(CASE WHEN processed = 1 THEN 1 ELSE 0 END), 0) AS UNSIGNED) as processed_count,
        CAST(COALESCE(SUM(CASE WHEN processed = 2 THEN 1 ELSE 0 END), 0) AS UNSIGNED) as duplicate_count,
        ROUND(COALESCE(AVG(process_latency_ms), 0.0), 2) as avg_latency_ms
      FROM fast_punch_buffer
    `);
    const [recent] = await pool.query(`
      SELECT b.*, e.name as emp_name
      FROM fast_punch_buffer b
      LEFT JOIN employees e ON b.emp_id = e.id
      ORDER BY b.id DESC LIMIT 15
    `);
    return {
      metrics: counts[0] || { total_ingested: 0, queued_count: 0, processed_count: 0, duplicate_count: 0, avg_latency_ms: 0 },
      recent_punches: recent
    };
  }
}

module.exports = BufferDAO;
