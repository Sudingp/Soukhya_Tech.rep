// database/db.js — Production MySQL 8.4 LTS Database Layer
const MySQLAdapter = require('./mysql_adapter');
const mysqlAdapter = new MySQLAdapter();

let mysqlReady = false;

async function checkMySQL() {
  const status = await mysqlAdapter.testConnection();
  if (status.ok) {
    mysqlReady = true;
    console.log(`[DB] Active Database: MySQL 8.4 LTS (${status.version})`);
    try {
      await mysqlAdapter.initSchema();
    } catch (err) {
      console.warn('[DB] MySQL initSchema warning:', err.message);
    }
    return true;
  } else {
    console.error(`[DB] MySQL Connection Error: ${status.error}`);
    throw new Error(`MySQL connection failed: ${status.error}`);
  }
}

// Auto-check on module load
checkMySQL().catch(e => console.warn('[DB] MySQL connection notice:', e.message));

function getActiveDialect() {
  return 'mysql';
}

const stmts = {
  // ── Users ──
  getUserByUsername: {
    get: (username) => mysqlAdapter.getUserByUsername(username)
  },
  getUserByUsernameHash: {
    get: (uHash) => mysqlAdapter.getUserByUsernameHash(uHash)
  },
  getUserById: {
    get: (id) => mysqlAdapter.getUserById(id)
  },
  getAllUsers: {
    all: () => mysqlAdapter.getAllUsers()
  },
  insertUser: {
    run: (params) => mysqlAdapter.insertUser(params)
  },
  updateUserPassword: {
    run: (pw, id) => mysqlAdapter.updateUserPassword(pw, id)
  },
  deleteUser: {
    run: (id) => mysqlAdapter.deleteUser(id)
  },

  // ── Employees ──
  getAllEmployees: {
    all: () => mysqlAdapter.getAllEmployees()
  },
  getEmployee: {
    get: (id) => mysqlAdapter.getEmployee(id)
  },
  getEmployeeByStatus: {
    all: (status) => mysqlAdapter.getEmployeeByStatus(status)
  },
  insertEmployee: {
    run: (emp) => mysqlAdapter.insertEmployee(emp)
  },
  updateEmployee: {
    run: (emp) => mysqlAdapter.updateEmployee(emp)
  },
  deleteEmployee: {
    run: (id) => mysqlAdapter.deleteEmployee(id)
  },
  employeeCount: {
    get: () => mysqlAdapter.employeeCount()
  },
  totalEmployeesCount: {
    get: () => mysqlAdapter.totalEmployeesCount()
  },

  // ── Attendance ──
  getAllAttendance: {
    all: (size, offset) => mysqlAdapter.getAllAttendance(size, offset)
  },
  getAttByDateRange: {
    all: (start, end, size, offset) => mysqlAdapter.getAttByDateRange(start, end, size, offset)
  },
  getAttByEmp: {
    all: (empId, size, offset) => mysqlAdapter.getAttByEmp(empId, size, offset)
  },
  getAttendance: {
    all: (limit) => mysqlAdapter.getAttendance(limit)
  },
  insertAtt: {
    run: (att) => mysqlAdapter.insertAtt(att)
  },
  checkDuplicate: {
    get: (emp_id) => mysqlAdapter.checkDuplicate(emp_id)
  },
  deleteAtt: {
    run: (att_id) => mysqlAdapter.deleteAtt(att_id)
  },

  // ── Stats ──
  statsToday: {
    get: () => mysqlAdapter.statsToday()
  },
  totalEmployees: {
    get: () => mysqlAdapter.totalEmployees()
  },
  totalRecords: {
    get: () => mysqlAdapter.totalRecords()
  },
  statusCounts: {
    get: () => mysqlAdapter.statusCounts()
  },
  deptHibernateCounts: {
    all: () => mysqlAdapter.deptHibernateCounts()
  },
  monthlyHibernateTrend: {
    all: () => mysqlAdapter.monthlyHibernateTrend()
  },

  // ── Audit ──
  insertAudit: {
    run: (audit) => mysqlAdapter.insertAudit(audit)
  },
  getAuditLogs: {
    all: (size, offset) => mysqlAdapter.getAuditLogs(size, offset)
  },
  countAuditLogs: {
    get: () => mysqlAdapter.countAuditLogs()
  },

  // ── Reset & Truncate ──
  resetAttendanceAndEmployees: {
    run: () => mysqlAdapter.clearAll()
  },

  // ── Token Blacklist ──
  blacklistToken: {
    run: (token, exp) => mysqlAdapter.blacklistToken(token, exp)
  },
  isTokenBlacklisted: {
    get: (token) => mysqlAdapter.isTokenBlacklisted(token)
  },
  purgeExpiredTokens: {
    run: (now) => mysqlAdapter.purgeExpiredTokens(now)
  }
};

module.exports = {
  stmts,
  mysqlAdapter,
  getActiveDialect,
  checkMySQL
};