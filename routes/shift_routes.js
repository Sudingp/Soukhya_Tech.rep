/**
 * routes/shift_routes.js
 * Shifts, Shift Calendar, Weekly Off Pattern, and Shift/Cohort Groups Endpoints
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
  grace_period_mins: Joi.number().integer().min(0).default(15),
  half_day_mins: Joi.number().integer().min(0).default(240),
  full_day_mins: Joi.number().integer().min(0).default(480),
  is_night_shift: Joi.boolean().default(false),
  color: Joi.string().default('#4f8ef7'),
  active: Joi.boolean().default(true)
});

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
    res.json({ success: true, count: days.length, working_days: workingDays, calendar: days });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/shift-calendar', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const result = await stmts.setCalendarDay.run(req.body);
    await auditLog({ table: 'shift_calendar_days', recordId: req.body.calendar_date, action: 'INSERT', newVals: req.body, req });
    res.status(201).json({ success: true, message: 'Calendar day saved', day: result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/shift-calendar/pattern', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { month, pattern = 'SUN_ONLY' } = req.body;
    if (!month) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Month required (YYYY-MM)' }, request_id: req.id });
    }
    const result = await stmts.applyWeeklyOffPattern.run(month, pattern);
    await auditLog({ table: 'shift_calendar_days', recordId: month, action: 'INSERT', newVals: req.body, req });
    res.json({ success: true, message: `Applied weekly off pattern ${pattern} to ${month}`, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

// ── Shift Groups ──
router.get('/shift-groups', authenticate, async (req, res) => {
  try {
    const groups = await stmts.getShiftGroups.all();
    res.json({ success: true, count: groups.length, groups });
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
    const { employee_ids = [] } = req.body;
    const result = await stmts.assignShiftGroupMembers.run(req.params.id, employee_ids);
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
    res.json({ success: true, count: members.length, members });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/employee-groups/:id/members', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { members = [], employee_ids = [] } = req.body;
    const memberList = members.length > 0 ? members : employee_ids;
    const result = await stmts.assignCohortMembers.run(req.params.id, memberList);
    res.json({ success: true, message: `Assigned ${result.count} members to cohort`, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

module.exports = router;
