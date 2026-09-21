/**
 * database/mysql_adapter.js
 * Modular MySQL 8.4 LTS Connection Manager & DAO Aggregator
 * Max file limit: < 500 lines
 */

const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const AuthDAO = require('./daos/auth_dao');
const EmployeeDAO = require('./daos/employee_dao');
const AttendanceDAO = require('./daos/attendance_dao');
const ShiftDAO = require('./daos/shift_dao');
const RosterDAO = require('./daos/roster_dao');
const DepartmentDAO = require('./daos/department_dao');
const MasterDAO = require('./daos/master_dao');
const DeviceDAO = require('./daos/device_dao');
const TransferDAO = require('./daos/transfer_dao');
const BufferDAO = require('./daos/buffer_dao');
const WorkflowDAO = require('./daos/workflow_dao');
const AuditDAO = require('./daos/audit_dao');

class MySQLAdapter {
  constructor(config = {}) {
    this.config = {
      host: config.host || process.env.MYSQL_HOST || '127.0.0.1',
      port: parseInt(config.port || process.env.MYSQL_PORT || '3306', 10),
      user: config.user || process.env.MYSQL_USER || 'soukhya_user',
      password: config.password || process.env.MYSQL_PASSWORD || 'soukhya_secure_pass_2026',
      database: config.database || process.env.MYSQL_DATABASE || 'soukhya_attendance',
      waitForConnections: true,
      connectionLimit: parseInt(config.connectionLimit || process.env.MYSQL_CONNECTION_LIMIT || '25', 10),
      queueLimit: 0,
      charset: 'utf8mb4',
      dateStrings: true
    };

    if (process.platform !== 'win32') {
      const localSock = path.resolve(__dirname, '..', 'data', 'mysql', 'mysql.sock');
      if (fs.existsSync(localSock)) {
        this.config.socketPath = localSock;
      }
    }

    this.pool = null;
    const poolProvider = () => this.getPool();

    // Domain DAOs
    this.authDao = new AuthDAO(poolProvider);
    this.employeeDao = new EmployeeDAO(poolProvider);
    this.attendanceDao = new AttendanceDAO(poolProvider);
    this.shiftDao = new ShiftDAO(poolProvider);
    this.rosterDao = new RosterDAO(poolProvider);
    this.departmentDao = new DepartmentDAO(poolProvider);
    this.masterDao = new MasterDAO(poolProvider);
    this.deviceDao = new DeviceDAO(poolProvider);
    this.transferDao = new TransferDAO(poolProvider);
    this.bufferDao = new BufferDAO(poolProvider);
    this.workflowDao = new WorkflowDAO(poolProvider);
    this.auditDao = new AuditDAO(poolProvider);
  }

  async getPool() {
    if (!this.pool) {
      this.pool = mysql.createPool(this.config);
    }
    return this.pool;
  }

  async testConnection() {
    const pool = await this.getPool();
    const conn = await pool.getConnection();
    conn.release();
    return true;
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  // ── Auth Delegates ──
  getUserByUsername(u) { return this.authDao.getUserByUsername(u); }
  getUserById(id) { return this.authDao.getUserById(id); }
  getAllUsers() { return this.authDao.getAllUsers(); }
  insertUser(d) { return this.authDao.insertUser(d); }
  updateUserPassword(id, p) { return this.authDao.updateUserPassword(id, p); }
  deleteUser(id) { return this.authDao.deleteUser(id); }
  isTokenBlacklisted(jti) { return this.authDao.isTokenBlacklisted(jti); }
  blacklistToken(jti, exp) { return this.authDao.blacklistToken(jti, exp); }
  pruneExpiredTokens() { return this.authDao.pruneExpiredTokens(); }

  // ── Employee Delegates ──
  getEmployeeById(id) { return this.employeeDao.getEmployeeById(id); }
  getAllEmployees(opts) { return this.employeeDao.getAllEmployees(opts); }
  getAllEmployeeFaceEmbeddings() { return this.employeeDao.getAllEmployeeFaceEmbeddings(); }
  insertEmployee(emp) { return this.employeeDao.insertEmployee(emp); }
  updateEmployee(emp) { return this.employeeDao.updateEmployee(emp); }
  deleteEmployee(id) { return this.employeeDao.deleteEmployee(id); }
  bulkInsertEmployees(recs, size) { return this.employeeDao.bulkInsertEmployees(recs, size); }
  getEmployeeStats() { return this.employeeDao.getEmployeeStats(); }

  // ── Attendance Delegates ──
  insertAtt(d) { return this.attendanceDao.insertAtt(d); }
  checkDuplicate(emp_id) { return this.attendanceDao.checkDuplicate(emp_id); }
  getRecentAttendance(limit) { return this.attendanceDao.getRecentAttendance(limit); }
  getAttendanceLogs(opts) { return this.attendanceDao.getAttendanceLogs(opts); }
  getStats() { return this.attendanceDao.getStats(); }
  getStatsByRange(s, e) { return this.attendanceDao.getStatsByRange(s, e); }
  regularizeAttendance(id, d) { return this.attendanceDao.regularizeAttendance(id, d); }

  // ── Shifts & Calendar Delegates ──
  getAllShifts(opts) { return this.shiftDao.getAllShifts(opts); }
  getShiftById(id) { return this.shiftDao.getShiftById(id); }
  getShiftByCode(c) { return this.shiftDao.getShiftByCode(c); }
  insertShift(d) { return this.shiftDao.insertShift(d); }
  updateShift(d) { return this.shiftDao.updateShift(d); }
  deleteShift(id) { return this.shiftDao.deleteShift(id); }
  getShiftCalendar(opts) { return this.shiftDao.getShiftCalendar(opts); }
  setCalendarDay(d) { return this.shiftDao.setCalendarDay(d); }
  deleteCalendarDay(dt) { return this.shiftDao.deleteCalendarDay(dt); }
  applyWeeklyOffPattern(m, p) { return this.shiftDao.applyWeeklyOffPattern(m, p); }

  // ── Groups Delegates ──
  getShiftGroups(opts) { return this.shiftDao.getShiftGroups(opts); }
  getShiftGroupById(id) { return this.shiftDao.getShiftGroupById(id); }
  insertShiftGroup(d) { return this.shiftDao.insertShiftGroup(d); }
  updateShiftGroup(d) { return this.shiftDao.updateShiftGroup(d); }
  deleteShiftGroup(id) { return this.shiftDao.deleteShiftGroup(id); }
  getShiftGroupMembers(gid) { return this.shiftDao.getShiftGroupMembers(gid); }
  assignShiftGroupMembers(gid, mids) { return this.shiftDao.assignShiftGroupMembers(gid, mids); }
  removeShiftGroupMember(gid, eid) { return this.shiftDao.removeShiftGroupMember(gid, eid); }
  getCohortGroups() { return this.shiftDao.getCohortGroups(); }
  getCohortGroupById(id) { return this.shiftDao.getCohortGroupById(id); }
  insertCohortGroup(d) { return this.shiftDao.insertCohortGroup(d); }
  deleteCohortGroup(id) { return this.shiftDao.deleteCohortGroup(id); }
  getCohortGroupMembers(gid) { return this.shiftDao.getCohortGroupMembers(gid); }
  assignCohortMembers(gid, m) { return this.shiftDao.assignCohortMembers(gid, m); }
  removeCohortMember(gid, eid) { return this.shiftDao.removeCohortMember(gid, eid); }

  // ── Roster Delegates ──
  getRosterMatrix(opts) { return this.rosterDao.getRosterMatrix(opts); }
  assignEmployeeRoster(d) { return this.rosterDao.assignEmployeeRoster(d); }
  autoGenerateMonthlyRoster(opts) { return this.rosterDao.autoGenerateMonthlyRoster(opts); }
  deleteRosterEntry(id) { return this.rosterDao.deleteRosterEntry(id); }

  // ── Department Delegates ──
  getAllDepartments() { return this.departmentDao.getAllDepartments(); }
  getDepartmentById(id) { return this.departmentDao.getDepartmentById(id); }
  getDepartmentByCode(c) { return this.departmentDao.getDepartmentByCode(c); }
  insertDepartment(d) { return this.departmentDao.insertDepartment(d); }
  updateDepartment(d) { return this.departmentDao.updateDepartment(d); }
  deleteDepartment(id) { return this.departmentDao.deleteDepartment(id); }
  getDepartmentShiftPolicies() { return this.departmentDao.getDepartmentShiftPolicies(); }
  getDepartmentShiftPolicy(did) { return this.departmentDao.getDepartmentShiftPolicy(did); }
  setDepartmentShiftPolicy(d) { return this.departmentDao.setDepartmentShiftPolicy(d); }
  applyDepartmentShiftToEmployees(did, sid) { return this.departmentDao.applyDepartmentShiftToEmployees(did, sid); }

  // ── Master Entities Delegates ──
  getAllCompanies() { return this.masterDao.getAllCompanies(); }
  getCompanyById(id) { return this.masterDao.getCompanyById(id); }
  insertCompany(d) { return this.masterDao.insertCompany(d); }
  updateCompany(d) { return this.masterDao.updateCompany(d); }
  deleteCompany(id) { return this.masterDao.deleteCompany(id); }

  getAllDesignations(opts) { return this.masterDao.getAllDesignations(opts); }
  getDesignationById(id) { return this.masterDao.getDesignationById(id); }
  insertDesignation(d) { return this.masterDao.insertDesignation(d); }
  updateDesignation(d) { return this.masterDao.updateDesignation(d); }
  deleteDesignation(id) { return this.masterDao.deleteDesignation(id); }

  getAllBranches() { return this.masterDao.getAllBranches(); }
  getBranchById(id) { return this.masterDao.getBranchById(id); }
  insertBranch(d) { return this.masterDao.insertBranch(d); }
  updateBranch(d) { return this.masterDao.updateBranch(d); }
  deleteBranch(id) { return this.masterDao.deleteBranch(id); }

  getAllDivisions(opts) { return this.masterDao.getAllDivisions(opts); }
  getDivisionById(id) { return this.masterDao.getDivisionById(id); }
  getDivisionByCode(c) { return this.masterDao.getDivisionByCode(c); }
  insertDivision(d) { return this.masterDao.insertDivision(d); }
  updateDivision(d) { return this.masterDao.updateDivision(d); }
  deleteDivision(id) { return this.masterDao.deleteDivision(id); }

  getAllCostCenters(opts) { return this.masterDao.getAllCostCenters(opts); }
  getCostCenterById(id) { return this.masterDao.getCostCenterById(id); }
  getCostCenterByCode(c) { return this.masterDao.getCostCenterByCode(c); }
  insertCostCenter(d) { return this.masterDao.insertCostCenter(d); }
  updateCostCenter(d) { return this.masterDao.updateCostCenter(d); }
  deleteCostCenter(id) { return this.masterDao.deleteCostCenter(id); }

  getAllEmploymentTypes() { return this.masterDao.getAllEmploymentTypes(); }
  getEmploymentTypeById(id) { return this.masterDao.getEmploymentTypeById(id); }
  insertEmploymentType(d) { return this.masterDao.insertEmploymentType(d); }
  updateEmploymentType(d) { return this.masterDao.updateEmploymentType(d); }
  deleteEmploymentType(id) { return this.masterDao.deleteEmploymentType(id); }

  getAllGeofences() { return this.masterDao.getAllGeofences(); }
  getGeofenceById(id) { return this.masterDao.getGeofenceById(id); }
  insertGeofence(d) { return this.masterDao.insertGeofence(d); }
  deleteGeofence(id) { return this.masterDao.deleteGeofence(id); }

  getAllWorkCodes() { return this.masterDao.getAllWorkCodes(); }
  getWorkCodeById(id) { return this.masterDao.getWorkCodeById(id); }
  insertWorkCode(d) { return this.masterDao.insertWorkCode(d); }
  updateWorkCode(d) { return this.masterDao.updateWorkCode(d); }
  deleteWorkCode(id) { return this.masterDao.deleteWorkCode(id); }

  getPublicHolidays(opts) { return this.masterDao.getPublicHolidays(opts); }
  getPublicHolidayById(id) { return this.masterDao.getPublicHolidayById(id); }
  insertPublicHoliday(d) { return this.masterDao.insertPublicHoliday(d); }
  deletePublicHoliday(id) { return this.masterDao.deletePublicHoliday(id); }
  syncPublicHolidaysToCalendar(yr) { return this.masterDao.syncPublicHolidaysToCalendar(yr); }

  // ── Hardware Devices Delegates ──
  getAllDevices(opts) { return this.deviceDao.getAllDevices(opts); }
  getDeviceById(id) { return this.deviceDao.getDeviceById(id); }
  getDeviceBySerial(s) { return this.deviceDao.getDeviceBySerial(s); }
  insertDevice(d) { return this.deviceDao.insertDevice(d); }
  updateDevice(d) { return this.deviceDao.updateDevice(d); }
  deleteDevice(id) { return this.deviceDao.deleteDevice(id); }
  pingDevice(id) { return this.deviceDao.pingDevice(id); }
  syncDeviceTemplates(id) { return this.deviceDao.syncDeviceTemplates(id); }

  // ── Career Transfers Delegates ──
  getTransfers(opts) { return this.transferDao.getTransfers(opts); }
  recordEmployeeTransfer(d) { return this.transferDao.recordEmployeeTransfer(d); }

  // ── Fast Punch Buffer Delegates ──
  ingestFastPunch(d) { return this.bufferDao.ingestFastPunch(d); }
  batchIngestFastPunches(p) { return this.bufferDao.batchIngestFastPunches(p); }
  flushFastPunchBuffer(limit) { return this.bufferDao.flushFastPunchBuffer(limit); }
  getFastPunchMetrics() { return this.bufferDao.getFastPunchMetrics(); }

  // ── Workflows Delegates ──
  getOtRecords(opts) { return this.workflowDao.getOtRecords(opts); }
  getOtRecordById(id) { return this.workflowDao.getOtRecordById(id); }
  insertOtRecord(d) { return this.workflowDao.insertOtRecord(d); }
  updateOtStatus(id, d) { return this.workflowDao.updateOtStatus(id, d); }
  deleteOtRecord(id) { return this.workflowDao.deleteOtRecord(id); }
  autoCalculateDailyOt(dt) { return this.workflowDao.autoCalculateDailyOt(dt); }

  getLeaveTypes() { return this.workflowDao.getLeaveTypes(); }
  getLeaveTypeById(id) { return this.workflowDao.getLeaveTypeById(id); }
  insertLeaveType(d) { return this.workflowDao.insertLeaveType(d); }
  updateLeaveType(d) { return this.workflowDao.updateLeaveType(d); }
  deleteLeaveType(id) { return this.workflowDao.deleteLeaveType(id); }

  getLeaveEntries(opts) { return this.workflowDao.getLeaveEntries(opts); }
  getLeaveEntryById(id) { return this.workflowDao.getLeaveEntryById(id); }
  insertLeaveEntry(d) { return this.workflowDao.insertLeaveEntry(d); }
  updateLeaveStatus(id, d) { return this.workflowDao.updateLeaveStatus(id, d); }
  deleteLeaveEntry(id) { return this.workflowDao.deleteLeaveEntry(id); }
  getEmployeeLeaveBalances(eid) { return this.workflowDao.getEmployeeLeaveBalances(eid); }

  getOutdoorEntries(opts) { return this.workflowDao.getOutdoorEntries(opts); }
  getOutdoorEntryById(id) { return this.workflowDao.getOutdoorEntryById(id); }
  insertOutdoorEntry(d) { return this.workflowDao.insertOutdoorEntry(d); }
  updateOutdoorStatus(id, d) { return this.workflowDao.updateOutdoorStatus(id, d); }
  deleteOutdoorEntry(id) { return this.workflowDao.deleteOutdoorEntry(id); }

  // ── Audit & Settings Delegates ──
  insertAuditLog(d) { return this.auditDao.insertAuditLog(d); }
  getAuditLogs(opts) { return this.auditDao.getAuditLogs(opts); }
  getMasterSettings() { return this.auditDao.getMasterSettings(); }
  updateMasterSettings(d) { return this.auditDao.updateMasterSettings(d); }
}

module.exports = MySQLAdapter;
