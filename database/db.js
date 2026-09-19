// database/db.js — Production MySQL 8.4 LTS Database Layer
const MySQLAdapter = require('./mysql_adapter');
const mysqlAdapter = new MySQLAdapter();

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

let mysqlReady = false;

async function checkMySQL() {
  let status = await mysqlAdapter.testConnection();
  if (!status.ok) {
    const setupScriptJs = path.resolve(__dirname, '..', 'scripts', 'setup_mysql.js');
    const setupScriptSh = path.resolve(__dirname, '..', 'scripts', 'setup_mysql.sh');
    if (fs.existsSync(setupScriptJs)) {
      try {
        console.log('[DB] MySQL offline. Auto-initiating local daemon via scripts/setup_mysql.js...');
        execSync(`node "${setupScriptJs}"`, { stdio: 'inherit' });
        await new Promise(r => setTimeout(r, 1000));
        status = await mysqlAdapter.testConnection();
      } catch (err) {
        console.warn('[DB] Auto-start attempt error:', err.message);
      }
    } else if (fs.existsSync(setupScriptSh) && process.platform !== 'win32') {
      try {
        console.log('[DB] MySQL offline. Auto-initiating local daemon via scripts/setup_mysql.sh...');
        execSync(`bash "${setupScriptSh}"`, { stdio: 'inherit' });
        await new Promise(r => setTimeout(r, 1000));
        status = await mysqlAdapter.testConnection();
      } catch (err) {
        console.warn('[DB] Auto-start attempt error:', err.message);
      }
    }
  }

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
  },

  // ── Master Settings ──
  getMasterSettings: {
    get: () => mysqlAdapter.getMasterSettings()
  },
  updateMasterSettings: {
    run: (settingsMap, updatedBy) => mysqlAdapter.updateMasterSettings(settingsMap, updatedBy)
  },

  // ── Shifts ──
  getAllShifts: {
    all: () => mysqlAdapter.getAllShifts()
  },
  getShiftById: {
    get: (id) => mysqlAdapter.getShiftById(id)
  },
  insertShift: {
    run: (shift) => mysqlAdapter.insertShift(shift)
  },
  updateShift: {
    run: (shift) => mysqlAdapter.updateShift(shift)
  },
  deleteShift: {
    run: (id) => mysqlAdapter.deleteShift(id)
  },

  // ── Shift Calendar ──
  getShiftCalendarMonth: {
    get: (year, month) => mysqlAdapter.getShiftCalendarMonth(year, month)
  },
  upsertShiftCalendarDay: {
    run: (data) => mysqlAdapter.upsertShiftCalendarDay(data)
  },
  applyShiftCalendarPattern: {
    run: (data) => mysqlAdapter.applyShiftCalendarPattern(data)
  },

  // ── Shift Groups ──
  getAllShiftGroups: {
    all: () => mysqlAdapter.getAllShiftGroups()
  },
  getShiftGroupById: {
    get: (id) => mysqlAdapter.getShiftGroupById(id)
  },
  insertShiftGroup: {
    run: (group) => mysqlAdapter.insertShiftGroup(group)
  },
  updateShiftGroup: {
    run: (group) => mysqlAdapter.updateShiftGroup(group)
  },
  deleteShiftGroup: {
    run: (id) => mysqlAdapter.deleteShiftGroup(id)
  },
  setShiftGroupMembers: {
    run: (groupId, empIds, startDate) => mysqlAdapter.setShiftGroupMembers(groupId, empIds, startDate)
  },

  // ── Shift Roster ──
  getShiftRosterMatrix: {
    get: (filter) => mysqlAdapter.getShiftRosterMatrix(filter)
  },
  assignShiftRoster: {
    run: (data) => mysqlAdapter.assignShiftRoster(data)
  },
  autoGenerateMonthlyRoster: {
    run: (data) => mysqlAdapter.autoGenerateMonthlyRoster(data)
  },

  // ── 🏢 Departments ──
  getAllDepartments: {
    all: () => mysqlAdapter.getAllDepartments()
  },
  getDepartmentById: {
    get: (id) => mysqlAdapter.getDepartmentById(id)
  },
  insertDepartment: {
    run: (dept) => mysqlAdapter.insertDepartment(dept)
  },
  updateDepartment: {
    run: (dept) => mysqlAdapter.updateDepartment(dept)
  },
  deleteDepartment: {
    run: (id) => mysqlAdapter.deleteDepartment(id)
  },

  // ── 🔄 Department Shifts ──
  getAllDepartmentShifts: {
    all: () => mysqlAdapter.getAllDepartmentShifts()
  },
  getDepartmentShiftsByDept: {
    get: (deptId) => mysqlAdapter.getDepartmentShiftsByDept(deptId)
  },
  upsertDepartmentShifts: {
    run: (data) => mysqlAdapter.upsertDepartmentShifts(data)
  },
  applyDepartmentShiftsToEmployees: {
    run: (deptId) => mysqlAdapter.applyDepartmentShiftsToEmployees(deptId)
  },

  // ── 🏖️ Public Holidays ──
  getAllPublicHolidays: {
    all: (year) => mysqlAdapter.getAllPublicHolidays(year)
  },
  getPublicHolidayById: {
    get: (id) => mysqlAdapter.getPublicHolidayById(id)
  },
  insertPublicHoliday: {
    run: (holiday) => mysqlAdapter.insertPublicHoliday(holiday)
  },
  updatePublicHoliday: {
    run: (holiday) => mysqlAdapter.updatePublicHoliday(holiday)
  },
  deletePublicHoliday: {
    run: (id) => mysqlAdapter.deletePublicHoliday(id)
  },
  importKarnatakaHolidays: {
    run: (year) => mysqlAdapter.importKarnatakaHolidays(year)
  },
  syncHolidaysWithCalendar: {
    run: (year, updatedBy) => mysqlAdapter.syncHolidaysWithCalendar(year, updatedBy)
  },

  // ── 👔 Employment Types ──
  getAllEmploymentTypes: {
    all: () => mysqlAdapter.getAllEmploymentTypes()
  },
  getEmploymentTypeById: {
    get: (id) => mysqlAdapter.getEmploymentTypeById(id)
  },
  insertEmploymentType: {
    run: (data) => mysqlAdapter.insertEmploymentType(data)
  },
  updateEmploymentType: {
    run: (id, data) => mysqlAdapter.updateEmploymentType(id, data)
  },
  deleteEmploymentType: {
    run: (id) => mysqlAdapter.deleteEmploymentType(id)
  },

  // ── 👥 Employee Cohort Groups ──
  getAllEmployeeCohortGroups: {
    all: () => mysqlAdapter.getAllEmployeeCohortGroups()
  },
  getEmployeeCohortGroupById: {
    get: (id) => mysqlAdapter.getEmployeeCohortGroupById(id)
  },
  insertEmployeeCohortGroup: {
    run: (data) => mysqlAdapter.insertEmployeeCohortGroup(data)
  },
  updateEmployeeCohortGroup: {
    run: (id, data) => mysqlAdapter.updateEmployeeCohortGroup(id, data)
  },
  deleteEmployeeCohortGroup: {
    run: (id) => mysqlAdapter.deleteEmployeeCohortGroup(id)
  },
  getEmployeeCohortGroupMembers: {
    all: (groupId) => mysqlAdapter.getEmployeeCohortGroupById(groupId)
  },
  setEmployeeCohortGroupMembers: {
    run: (groupId, empIds, roleInGroup) => mysqlAdapter.setEmployeeCohortGroupMembers(groupId, empIds, roleInGroup)
  },

  // ── 📍 Geofences ──
  getAllGeofences: {
    all: () => mysqlAdapter.getAllGeofences()
  },
  getGeofenceById: {
    get: (id) => mysqlAdapter.getGeofenceById(id)
  },
  insertGeofence: {
    run: (data) => mysqlAdapter.insertGeofence(data)
  },
  updateGeofence: {
    run: (id, data) => mysqlAdapter.updateGeofence(id, data)
  },
  deleteGeofence: {
    run: (id) => mysqlAdapter.deleteGeofence(id)
  },

  // ── 🔢 Work Codes ──
  getAllWorkCodes: {
    all: () => mysqlAdapter.getAllWorkCodes()
  },
  getWorkCodeById: {
    get: (id) => mysqlAdapter.getWorkCodeById(id)
  },
  insertWorkCode: {
    run: (data) => mysqlAdapter.insertWorkCode(data)
  },
  updateWorkCode: {
    run: (id, data) => mysqlAdapter.updateWorkCode(id, data)
  },
  deleteWorkCode: {
    run: (id) => mysqlAdapter.deleteWorkCode(id)
  },

  // ── ⏱️ OT Register ──
  getOtRegister: {
    all: (filter) => mysqlAdapter.getOtRegister(filter)
  },
  getOtRecordById: {
    get: (id) => mysqlAdapter.getOtRecordById(id)
  },
  insertOtRecord: {
    run: (data) => mysqlAdapter.insertOtRecord(data)
  },
  updateOtStatus: {
    run: (id, data) => mysqlAdapter.updateOtStatus(id, data)
  },
  bulkUpdateOtStatus: {
    run: (ids, data) => mysqlAdapter.bulkUpdateOtStatus(ids, data)
  },
  deleteOtRecord: {
    run: (id) => mysqlAdapter.deleteOtRecord(id)
  },

  // ── 📊 Attendance Log & Regularization ──
  getDetailedAttendanceLog: {
    all: (filter) => mysqlAdapter.getDetailedAttendanceLog(filter)
  },
  getAttendanceLogStats: {
    get: (date) => mysqlAdapter.getAttendanceLogStats(date)
  },
  regularizeAttendance: {
    run: (data) => mysqlAdapter.regularizeAttendance(data)
  },

  // ── 🏥 Leave Types (Organization) ──
  getAllLeaveTypes: {
    all: () => mysqlAdapter.getAllLeaveTypes()
  },
  getLeaveTypeById: {
    get: (id) => mysqlAdapter.getLeaveTypeById(id)
  },
  insertLeaveType: {
    run: (data) => mysqlAdapter.insertLeaveType(data)
  },
  updateLeaveType: {
    run: (id, data) => mysqlAdapter.updateLeaveType(id, data)
  },
  deleteLeaveType: {
    run: (id) => mysqlAdapter.deleteLeaveType(id)
  },

  // ── 📝 Employee Leave Entries ──
  getLeaveEntries: {
    all: (filter) => mysqlAdapter.getLeaveEntries(filter)
  },
  getLeaveEntryById: {
    get: (id) => mysqlAdapter.getLeaveEntryById(id)
  },
  insertLeaveEntry: {
    run: (data) => mysqlAdapter.insertLeaveEntry(data)
  },
  updateLeaveEntryStatus: {
    run: (id, data) => mysqlAdapter.updateLeaveEntryStatus(id, data)
  },
  deleteLeaveEntry: {
    run: (id) => mysqlAdapter.deleteLeaveEntry(id)
  },
  getEmployeeLeaveBalances: {
    all: (empId, year) => mysqlAdapter.getEmployeeLeaveBalances(empId, year)
  },

  // ── 🚶 Employee Outdoor Entries (On-Duty / OD) ──
  getOutdoorEntries: {
    all: (filter) => mysqlAdapter.getOutdoorEntries(filter)
  },
  getOutdoorEntryById: {
    get: (id) => mysqlAdapter.getOutdoorEntryById(id)
  },
  insertOutdoorEntry: {
    run: (data) => mysqlAdapter.insertOutdoorEntry(data)
  },
  updateOutdoorEntryStatus: {
    run: (id, data) => mysqlAdapter.updateOutdoorEntryStatus(id, data)
  },
  deleteOutdoorEntry: {
    run: (id) => mysqlAdapter.deleteOutdoorEntry(id)
  }
};



module.exports = {
  stmts,
  mysqlAdapter,
  getActiveDialect,
  checkMySQL
};