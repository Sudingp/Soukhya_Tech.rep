/**
 * routes/attendance_routes.js
 * Attendance Punch, Real-Time Stats, Cooldown, and Regularization Endpoints (<500 lines)
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { stmts } = require('../database/db');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit_logger');

const punchSchema = Joi.object({
  emp_id: Joi.string().required(),
  name: Joi.string().allow('', null).optional(),
  dept: Joi.string().allow('', null).optional(),
  role: Joi.string().allow('', null).optional(),
  status: Joi.string().valid('Present', 'Late').default('Present'),
  timestamp: Joi.string().optional()
}).unknown(true);

// Single punch check-in
router.post('/', async (req, res) => {
  try {
    const { error, value } = punchSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message }, request_id: req.id });
    }

    // Check duplicate cooldown
    const existing = await stmts.checkDuplicate.get(value.emp_id);
    if (existing) {
      return res.status(429).json({
        success: false,
        error: { code: 'ATTENDANCE_COOLDOWN', message: `Attendance already recorded today for ${value.emp_id}` },
        request_id: req.id
      });
    }

    // Lookup employee metadata if missing
    let emp = null;
    if (!value.name || !value.dept || !value.role) {
      emp = await stmts.getEmployeeById.get(value.emp_id);
    }

    const name = value.name || emp?.name || value.emp_id;
    const dept = value.dept || emp?.department || 'Operations';
    const role = value.role || emp?.role || 'Staff';

    const result = await stmts.insertAtt.run({
      emp_id: value.emp_id,
      name,
      dept,
      role,
      timestamp: value.timestamp,
      status: value.status || 'Present',
      logged_by: req.user?.username || 'WebPunch',
      ip_address: req.ip || '127.0.0.1',
      user_agent: req.headers['user-agent'] || 'Browser'
    });

    await auditLog({ table: 'attendance', recordId: String(result.lastInsertRowid), action: 'INSERT', newVals: value, req });

    res.status(201).json({
      success: true,
      message: `Punched in for: ${value.emp_id}`,
      data: { id: result.lastInsertRowid, emp_id: value.emp_id, name, dept, role, status: value.status || 'Present' },
      record: { id: result.lastInsertRowid, emp_id: value.emp_id, name, dept, role }
    });
  } catch (err) {
    console.error('[POST /api/attendance]', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

// GET /api/attendance — Return recent attendance records
router.get('/', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || req.query.size, 10) || 20;
    const rows = await stmts.getRecentAttendance.all(limit);
    res.json({
      success: true,
      total: rows.length,
      count: rows.length,
      attendance: rows,
      attendance_logs: rows
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.get('/recent', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const rows = await stmts.getRecentAttendance.all(limit);
    res.json({ success: true, count: rows.length, attendance: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

const handleGetLogs = async (req, res) => {
  try {
    let { page, size, limit, startDate, endDate, emp_id, status, dept } = req.query;
    if (req.user?.role === 'USER' && req.user?.emp_id) {
      emp_id = req.user.emp_id;
    }
    const result = await stmts.getAttendanceLogs.all({
      page: parseInt(page, 10) || 1,
      size: parseInt(limit || size, 10) || 20,
      startDate, endDate, emp_id, status, dept
    });
    res.json({
      success: true,
      total: result.pagination.total,
      count: result.attendance_logs.length,
      rows: result.attendance_logs,
      attendance_logs: result.attendance_logs,
      pagination: result.pagination
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
};

router.get('/log', authenticate, handleGetLogs);
router.get('/attendance-log', authenticate, handleGetLogs);

router.get('/attendance-log/stats', authenticate, async (req, res) => {
  try {
    const stats = await stmts.getStats.get();
    res.json({
      success: true,
      stats: {
        total_punches: stats.total_employees || stats.totalEmployees,
        on_time_count: stats.on_time_today || stats.onTimeToday,
        late_count: stats.late_today || stats.lateToday,
        present_count: stats.present_today || stats.presentToday,
        absent_count: stats.absent_today || stats.absentToday,
        total_employees: stats.total_employees || stats.totalEmployees
      },
      ...stats
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

const handleRegularizePunch = async (req, res) => {
  try {
    const { emp_id, timestamp, status = 'Present', reason = 'Regularized' } = req.body;
    let emp = await stmts.getEmployeeById.get(emp_id);
    const name = emp?.name || emp_id;
    const dept = emp?.department || 'Operations';
    const role = emp?.role || 'Staff';

    const result = await stmts.insertAtt.run({
      emp_id,
      name,
      dept,
      role,
      timestamp,
      status,
      logged_by: `Regularized: ${reason}`,
      ip_address: req.ip || '127.0.0.1',
      user_agent: req.headers['user-agent'] || 'System'
    });
    await auditLog({ table: 'attendance', recordId: String(result.lastInsertRowid), action: 'INSERT', newVals: req.body, req });
    res.json({
      success: true,
      message: 'Attendance regularized successfully',
      attendance: { att_id: result.lastInsertRowid, id: result.lastInsertRowid, emp_id, status, timestamp, reason }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
};

router.post('/attendance-log/regularize', authenticate, requireRoles('ADMIN', 'HR'), handleRegularizePunch);
router.post('/regularize', authenticate, requireRoles('ADMIN', 'HR'), handleRegularizePunch);

const handleUpdateRegularize = async (req, res) => {
  try {
    const { status = 'Present', reason = 'Regularized by Manager' } = req.body;
    const updated = await stmts.regularizeAttendance.run(req.params.id, {
      status,
      reason,
      regularized_by: req.user?.username || 'Admin'
    });
    await auditLog({ table: 'attendance', recordId: req.params.id, action: 'UPDATE', newVals: req.body, req });
    res.json({ success: true, message: 'Attendance regularized successfully', attendance: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
};

router.put('/log/:id/regularize', authenticate, requireRoles('ADMIN', 'HR'), handleUpdateRegularize);
router.put('/attendance-log/:id/regularize', authenticate, requireRoles('ADMIN', 'HR'), handleUpdateRegularize);

router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = await stmts.getStats.get();
    res.json({ success: true, ...stats });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.get('/stats/range', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'startDate and endDate required' }, request_id: req.id });
    }
    const data = await stmts.getStatsByRange.all(startDate, endDate);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

module.exports = router;
