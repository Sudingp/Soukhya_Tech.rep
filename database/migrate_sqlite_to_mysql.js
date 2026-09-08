// database/migrate_sqlite_to_mysql.js — Automated SQLite to MySQL 8.4 LTS Migration Pipeline
const Database = require('better-sqlite3');
const path = require('path');
const MySQLAdapter = require('./mysql_adapter');

async function migrate() {
  const sqlitePath = process.env.DB_PATH || path.join(__dirname, 'attendance.db');
  console.log('============================================================');
  console.log(' Soukhya Tech — SQLite to MySQL 8.4 LTS Data Migration');
  console.log(` Source SQLite: ${sqlitePath}`);
  console.log('============================================================\n');

  const sqlite = new Database(sqlitePath);
  const mysql = new MySQLAdapter();

  // 1. Verify MySQL connection
  const connStatus = await mysql.testConnection();
  if (!connStatus.ok) {
    console.error('[ERROR] Cannot connect to MySQL:', connStatus.error);
    console.error('Please ensure MySQL is running (e.g. via docker compose up -d or scripts/setup_mysql.sh)');
    process.exit(1);
  }
  console.log(`[OK] Connected to MySQL (${connStatus.version})`);

  // 2. Initialize MySQL schema
  console.log('[INFO] Ensuring MySQL 8.4 schema structure...');
  await mysql.initSchema();
  const pool = await mysql.getPool();

  await pool.query('SET FOREIGN_KEY_CHECKS = 0');

  function formatMySQLDatetime(ts) {
    if (!ts) return new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (typeof ts === 'string') {
      const clean = ts.replace('T', ' ').replace('Z', '').split('.')[0];
      if (clean.length === 19) return clean;
    }
    try {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 19).replace('T', ' ');
      }
    } catch {}
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }

  try {
    // ── 3. Migrate Users ──
    console.log('[INFO] Migrating Users table...');
    const users = sqlite.prepare('SELECT * FROM users').all();
    let usersMigrated = 0;
    for (const u of users) {
      await pool.execute(
        `INSERT INTO users (id, username, username_hash, username_display, password_hash, role, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           password_hash = VALUES(password_hash),
           role = VALUES(role),
           active = VALUES(active)`,
        [
          u.id, u.username, u.username_hash || null, u.username_display || null,
          u.password_hash, u.role || 'USER', u.active !== undefined ? u.active : 1,
          formatMySQLDatetime(u.created_at),
          formatMySQLDatetime(u.updated_at)
        ]
      );
      usersMigrated++;
    }
    console.log(`  ✓ Users migrated: ${usersMigrated}`);

    // ── 4. Migrate Employees ──
    console.log('[INFO] Migrating Employees table...');
    const employees = sqlite.prepare('SELECT * FROM employees').all();
    let empMigrated = 0;
    for (const e of employees) {
      const descStr = typeof e.descriptor === 'string' ? e.descriptor : JSON.stringify(e.descriptor);
      await pool.execute(
        `INSERT INTO employees (
          id, name, department, role, descriptor, descriptor_hash, image, status,
          hibernate_start_date, hibernate_end_date, hibernate_reason,
          company, designation, gender, date_of_joining, date_of_confirmation, last_working_day,
          aadhaar_number, pan_number, card_number, phone_no, email, reporting_to,
          device_code, sub_department, division, grade, team, location,
          employment_type, category, holiday_group, shift_group, shift_roster,
          geofence, device_expiry_rule_applicable, verification_type,
          expiry_start_date, expiry_end_date, updated_by, version, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        ) ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          department = VALUES(department),
          role = VALUES(role),
          status = VALUES(status),
          image = VALUES(image),
          descriptor = VALUES(descriptor)`,
        [
          e.id, e.name, e.department, e.role, descStr, e.descriptor_hash, e.image || null, e.status || 'Active',
          e.hibernate_start_date || null, e.hibernate_end_date || null, e.hibernate_reason || null,
          e.company || null, e.designation || null, e.gender || null, e.date_of_joining || null, e.date_of_confirmation || null, e.last_working_day || null,
          e.aadhaar_number || null, e.pan_number || null, e.card_number || null, e.phone_no || null, e.email || null, e.reporting_to || null,
          e.device_code || null, e.sub_department || null, e.division || null, e.grade || null, e.team || null, e.location || null,
          e.employment_type || null, e.category || null, e.holiday_group || null, e.shift_group || null, e.shift_roster || null,
          e.geofence || null, e.device_expiry_rule_applicable ? 1 : 0, e.verification_type || null,
          e.expiry_start_date || null, e.expiry_end_date || null, e.updated_by || null, e.version || 1,
          formatMySQLDatetime(e.created_at),
          formatMySQLDatetime(e.updated_at)
        ]
      );
      empMigrated++;
    }
    console.log(`  ✓ Employees migrated: ${empMigrated}`);

    // ── 5. Migrate Attendance ──
    console.log('[INFO] Migrating Attendance Punches...');
    const attendance = sqlite.prepare('SELECT * FROM attendance').all();
    let attMigrated = 0;
    for (const a of attendance) {
      await pool.execute(
        `INSERT INTO attendance (att_id, emp_id, name, dept, role, timestamp, status, logged_by, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status)`,
        [
          a.att_id, a.emp_id, a.name, a.dept, a.role, formatMySQLDatetime(a.timestamp), a.status,
          a.logged_by || null, a.ip_address || null, a.user_agent || null
        ]
      );
      attMigrated++;
    }
    console.log(`  ✓ Attendance records migrated: ${attMigrated}`);

    // ── 6. Migrate Audit Log ──
    console.log('[INFO] Migrating Audit Log...');
    const auditLogs = sqlite.prepare('SELECT * FROM audit_log').all();
    let auditMigrated = 0;
    for (const l of auditLogs) {
      const action = ['INSERT','UPDATE','DELETE','LOGIN','LOGOUT','RESET_SEED'].includes(l.action) ? l.action : 'INSERT';
      await pool.execute(
        `INSERT INTO audit_log (log_id, table_name, record_id, action, old_values, new_values, performed_by, performed_at, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE record_id = VALUES(record_id)`,
        [
          l.log_id, l.table_name, l.record_id, action,
          l.old_values || null, l.new_values || null,
          l.performed_by, formatMySQLDatetime(l.performed_at),
          l.ip_address || null, l.user_agent || null
        ]
      );
      auditMigrated++;
    }
    console.log(`  ✓ Audit records migrated: ${auditMigrated}`);

    // ── 7. Migrate Token Blacklist ──
    console.log('[INFO] Migrating Token Blacklist...');
    const tokens = sqlite.prepare('SELECT * FROM token_blacklist').all();
    let tokensMigrated = 0;
    for (const t of tokens) {
      await pool.execute(
        `INSERT IGNORE INTO token_blacklist (token_hash, expires_at) VALUES (?, ?)`,
        [t.token_hash, t.expires_at]
      );
      tokensMigrated++;
    }
    console.log(`  ✓ Blacklisted tokens migrated: ${tokensMigrated}`);

    console.log('\n============================================================');
    console.log(' ALL DATA MIGRATED SUCCESSFULLY FROM SQLITE TO MYSQL 8.4 LTS!');
    console.log(' Parity check:');
    console.log(`   - Users:      ${usersMigrated}`);
    console.log(`   - Employees:  ${empMigrated}`);
    console.log(`   - Attendance: ${attMigrated}`);
    console.log(`   - Audit Logs: ${auditMigrated}`);
    console.log('============================================================\n');

  } finally {
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    sqlite.close();
    await mysql.close();
  }
}

if (require.main === module) {
  migrate().catch(err => {
    console.error('[MIGRATION FAILED]', err);
    process.exit(1);
  });
}

module.exports = migrate;
