/**
 * routes/shift_routes.js
 * Shifts, Shift Calendar, Weekly Off Pattern, and Shift/Cohort Groups Endpoints (<500 lines)
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { stmts } = require('../database/db');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit_logger');

const shiftSchema = Joi.object({
  code: Joi.string().min(2).max(20).required(),
  name: Joi.string().min(2).max(100).required(),
  start_time: Joi.string().required(),
  end_time: Joi.string().required(),
  break_duration_mins: Joi.number().integer().min(0).default(60),
  break_mins: Joi.number().integer().min(0).optional(),
  grace_period_mins: Joi.number().integer().min(0).default(15),
  late_grace_mins: Joi.number().integer().min(0).optional(),
  half_day_mins: Joi.number().integer().min(0).default(240),
  full_day_mins: Joi.number().integer().min(0).default(480),
  is_night_shift: Joi.boolean().default(false),
  color: Joi.string().default('#4f8ef7'),
  active: Joi.boolean().default(true)
}).unknown(true);

// ── Shifts Master ──
router.get('/shifts', authenticate, async (req, res) => {
  try {
    const shifts = await stmts.getAllShifts.all();
    res.json({ success: true, count: shifts.length, shifts });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/shifts', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { error, value } = shiftSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message }, request_id: req.id });
    }
    const created = await stmts.insertShift.run(value);
    await auditLog({ table: 'shifts', recordId: created.id, action: 'INSERT', newVals: value, req });
    res.status(201).json({ success: true, message: 'Shift created successfully', id: created.id, shift: created });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.put('/shifts/:id', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const updated = await stmts.updateShift.run({ ...req.body, id: req.params.id });
    await auditLog({ table: 'shifts', recordId: req.params.id, action: 'UPDATE', newVals: req.body, req });
    res.json({ success: true, message: 'Shift updated successfully', shift: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.delete('/shifts/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    await stmts.deleteShift.run(req.params.id);
    await auditLog({ table: 'shifts', recordId: req.params.id, action: 'DELETE', req });
    res.json({ success: true, message: 'Shift deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

// ── Shift Calendar ──
router.get('/shift-calendar', authenticate, async (req, res) => {
  try {
    const { month, year } = req.query;
    const days = await stmts.getShiftCalendar.all({ month, year });
    const workingDays = days.filter(d => d.day_type === 'WORK').length;
    res.json({
      success: true,
      count: days.length,
      working_days: workingDays,
      days,
      calendar: days,
      summary: {
        month: month || year || 'ALL',
        total_days: days.length,
        working_days: workingDays,
        weekly_offs: days.filter(d => d.day_type === 'WEEKLY_OFF').length,
        holidays: days.filter(d => d.day_type === 'HOLIDAY').length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

const handleCalendarDay = async (req, res) => {
  try {
    const result = await stmts.setCalendarDay.run(req.body);
    const dayDate = req.body.cal_date || req.body.calendar_date;
    await auditLog({ table: 'shift_calendar_days', recordId: dayDate, action: 'UPDATE', newVals: req.body, req });
    res.json({ success: true, message: 'Calendar day saved', day: result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
};

router.put('/shift-calendar/day', authenticate, requireRoles('ADMIN', 'HR'), handleCalendarDay);
router.post('/shift-calendar', authenticate, requireRoles('ADMIN', 'HR'), handleCalendarDay);

const handleApplyPattern = async (req, res) => {
  try {
    let { month, year, pattern, pattern_type } = req.body;
    if (!month && year && req.body.month) {
      month = `${year}-${String(req.body.month).padStart(2, '0')}`;
    } else if (typeof month === 'number' && year) {
      month = `${year}-${String(month).padStart(2, '0')}`;
    }
    const pat = pattern_type || pattern || 'SUN_ONLY';
    if (!month) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Month required (YYYY-MM or year+month)' }, request_id: req.id });
    }
    const result = await stmts.applyWeeklyOffPattern.run(month, pat);
    await auditLog({ table: 'shift_calendar_days', recordId: month, action: 'INSERT', newVals: req.body, req });
    res.json({ success: true, message: `Applied weekly off pattern ${pat} to ${month}`, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
};

router.post('/shift-calendar/apply-pattern', authenticate, requireRoles('ADMIN', 'HR'), handleApplyPattern);
router.post('/shift-calendar/pattern', authenticate, requireRoles('ADMIN', 'HR'), handleApplyPattern);

// ── Shift Groups ──
router.get('/shift-groups', authenticate, async (req, res) => {
  try {
    const groups = await stmts.getShiftGroups.all();
    res.json({ success: true, count: groups.length, groups });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.get('/shift-groups/:id', authenticate, async (req, res) => {
  try {
    const group = await stmts.getShiftGroupById.get(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Shift group not found' } });
    }
    const members = await stmts.getShiftGroupMembers.all(req.params.id);
    res.json({ success: true, group: { ...group, members } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/shift-groups', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const created = await stmts.insertShiftGroup.run(req.body);
    await auditLog({ table: 'shift_groups', recordId: created.id, action: 'INSERT', newVals: req.body, req });
    res.status(201).json({ success: true, message: 'Shift group created', id: created.id, group: created });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.delete('/shift-groups/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    await stmts.deleteShiftGroup.run(req.params.id);
    await auditLog({ table: 'shift_groups', recordId: req.params.id, action: 'DELETE', req });
    res.json({ success: true, message: 'Shift group deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.get('/shift-groups/:id/members', authenticate, async (req, res) => {
  try {
    const members = await stmts.getShiftGroupMembers.all(req.params.id);
    res.json({ success: true, count: members.length, members });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/shift-groups/:id/members', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { employee_ids = [], emp_ids = [] } = req.body;
    const memberList = emp_ids.length > 0 ? emp_ids : employee_ids;
    const result = await stmts.assignShiftGroupMembers.run(req.params.id, memberList);
    res.json({ success: true, message: `Assigned ${result.assigned} employees to group`, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

// ── Employee Cohort Groups ──
router.get('/employee-groups', authenticate, async (req, res) => {
  try {
    const groups = await stmts.getCohortGroups.all();
    res.json({ success: true, count: groups.length, groups });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/employee-groups', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const created = await stmts.insertCohortGroup.run(req.body);
    await auditLog({ table: 'employee_cohort_groups', recordId: created.id, action: 'INSERT', newVals: req.body, req });
    res.status(201).json({ success: true, message: 'Employee group created', id: created.id, group: created });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.delete('/employee-groups/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    await stmts.deleteCohortGroup.run(req.params.id);
    await auditLog({ table: 'employee_cohort_groups', recordId: req.params.id, action: 'DELETE', req });
    res.json({ success: true, message: 'Employee group deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.get('/employee-groups/:id/members', authenticate, async (req, res) => {
  try {
    const members = await stmts.getCohortGroupMembers.all(req.params.id);
    res.json({ success: true, count: members.length, total: members.length, members });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/employee-groups/:id/members', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { members = [], employee_ids = [], emp_ids = [], role_in_group = 'Member' } = req.body;
    let memberList = [];
    if (members.length > 0) {
      memberList = members;
    } else {
      const rawList = emp_ids.length > 0 ? emp_ids : employee_ids;
      memberList = rawList.map(emp_id => ({ emp_id, role_in_group }));
    }
    const result = await stmts.assignCohortMembers.run(req.params.id, memberList);
    res.json({ success: true, message: `Assigned ${result.count} members to cohort`, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

module.exports = router;
