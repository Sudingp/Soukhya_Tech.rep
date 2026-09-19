/**
 * database/db.js — Production MySQL 8.4 LTS Database Layer & Statement Interface
 * Max file limit: < 500 lines
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const MySQLAdapter = require('./mysql_adapter');

const mysqlAdapter = new MySQLAdapter();
let mysqlReady = false;

async function checkMySQL() {
  try {
    await mysqlAdapter.testConnection();
    mysqlReady = true;
    console.log('[DB] Active Database: MySQL 8.4 LTS');
    return true;
  } catch (err) {
    const setupScriptJs = path.resolve(__dirname, '..', 'scripts', 'setup_mysql.js');
    if (fs.existsSync(setupScriptJs)) {
      try {
        console.log('[DB] MySQL offline. Auto-initiating local daemon via scripts/setup_mysql.js...');
        execSync(`node "${setupScriptJs}"`, { stdio: 'inherit' });
        await new Promise(r => setTimeout(r, 1000));
        await mysqlAdapter.testConnection();
        mysqlReady = true;
        console.log('[DB] Active Database: MySQL 8.4 LTS (Started)');
        return true;
      } catch (subErr) {
        console.warn('[DB] Auto-start attempt error:', subErr.message);
      }
    }
    console.warn('[DB] MySQL connection error:', err.message);
    return false;
  }
}

// Auto-check on boot
checkMySQL().catch(e => console.warn('[DB] MySQL connection notice:', e.message));

function getActiveDialect() {
  return 'mysql';
}

/**
 * Universal Statement Proxy Generator
 * Maps `stmts.methodName.all(...)`, `stmts.methodName.get(...)`, and `stmts.methodName.run(...)`
 * directly and cleanly to `mysqlAdapter[methodName](...)`.
 */
const stmts = new Proxy({}, {
  get(target, prop) {
    if (!target[prop]) {
      target[prop] = {
        all: (...args) => {
          if (typeof mysqlAdapter[prop] === 'function') {
            return mysqlAdapter[prop](...args);
          }
          throw new Error(`Method ${String(prop)} not found on MySQLAdapter`);
        },
        get: (...args) => {
          if (typeof mysqlAdapter[prop] === 'function') {
            return mysqlAdapter[prop](...args);
          }
          throw new Error(`Method ${String(prop)} not found on MySQLAdapter`);
        },
        run: (...args) => {
          if (typeof mysqlAdapter[prop] === 'function') {
            return mysqlAdapter[prop](...args);
          }
          throw new Error(`Method ${String(prop)} not found on MySQLAdapter`);
        }
      };
    }
    return target[prop];
  }
});

// Explicit backward compatibility aliases
stmts.getEmployees = { all: (params) => mysqlAdapter.getAllEmployees(params) };
stmts.getAttendance = { all: (limit) => mysqlAdapter.getRecentAttendance(limit) };
stmts.getAllAttendance = { all: (size, offset) => mysqlAdapter.getAttendanceLogs({ size, page: Math.floor((offset || 0) / (size || 20)) + 1 }) };
stmts.getDetailedAttendanceLog = { all: (filter) => mysqlAdapter.getAttendanceLogs(filter) };
stmts.getAttendanceLogStats = { get: (date) => mysqlAdapter.getStats() };
stmts.statsToday = { get: () => mysqlAdapter.getStats() };
stmts.totalEmployees = { get: () => mysqlAdapter.getEmployeeStats() };
stmts.totalEmployeesCount = { get: () => mysqlAdapter.getEmployeeStats() };
stmts.resetAttendanceAndEmployees = { run: () => mysqlAdapter.close() };
stmts.getEmployeeCohortGroupMembers = { all: (groupId) => mysqlAdapter.getCohortGroupMembers(groupId) };
stmts.setEmployeeCohortGroupMembers = { run: (groupId, members) => mysqlAdapter.assignCohortMembers(groupId, members) };
stmts.setShiftGroupMembers = { run: (groupId, empIds) => mysqlAdapter.assignShiftGroupMembers(groupId, empIds) };
stmts.getShiftRosterMatrix = { get: (filter) => mysqlAdapter.getRosterMatrix(filter) };
stmts.assignShiftRoster = { run: (data) => mysqlAdapter.assignEmployeeRoster(data) };
stmts.getOtRegister = { all: (filter) => mysqlAdapter.getOtRecords(filter) };
stmts.updateLeaveEntryStatus = { run: (id, data) => mysqlAdapter.updateLeaveStatus(id, data) };
stmts.updateOutdoorEntryStatus = { run: (id, data) => mysqlAdapter.updateOutdoorStatus(id, data) };
stmts.insertAudit = { run: (audit) => mysqlAdapter.insertAuditLog(audit) };

module.exports = {
  stmts,
  mysqlAdapter,
  getActiveDialect,
  checkMySQL
};