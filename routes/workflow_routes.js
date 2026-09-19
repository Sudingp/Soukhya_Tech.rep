/**
 * routes/workflow_routes.js
 * Workflow REST Endpoints (Overtime Register, Leave Ledger, Outdoor Duty)
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { stmts } = require('../database/db');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit_logger');

const otSchema = Joi.object({
  emp_id: Joi.string().required(),
  ot_date: Joi.string().regex(/^\d{4}-\d{2}-\d{2}$/).required(),
  shift_id: Joi.string().allow('', null).optional(),
  scheduled_hours: Joi.number().default(8.0),
  actual_hours: Joi.number().default(8.0),
  ot_hours: Joi.number().min(0).required(),
  ot_multiplier: Joi.number().default(1.5),
  ot_rate_type: Joi.string().valid('STANDARD_DAY', 'WEEKLY_OFF', 'PUBLIC_HOLIDAY').default('STANDARD_DAY'),
  status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED', 'COMP_OFF').default('PENDING'),
  comments: Joi.string().allow('', null).optional()
});

const leaveTypeSchema = Joi.object({
  code: Joi.string().min(2).max(20).required(),
  name: Joi.string().min(2).max(100).required(),
  annual_quota: Joi.number().min(0).default(12.0),
  carry_forward_max: Joi.number().min(0).default(0.0),
  is_encashable: Joi.boolean().default(false),
  is_paid: Joi.boolean().default(true),
  color: Joi.string().default('#4f8ef7'),
  active: Joi.boolean().default(true)
});

const leaveEntrySchema = Joi.object({
  emp_id: Joi.string().required(),
  leave_type_id: Joi.string().required(),
  start_date: Joi.string().regex(/^\d{4}-\d{2}-\d{2}$/).required(),
  end_date: Joi.string().regex(/^\d{4}-\d{2}-\d{2}$/).required(),
  total_days: Joi.number().min(0.5).default(1.0),
  reason: Joi.string().min(2).max(255).required(),
  comments: Joi.string().allow('', null).optional()
});

const outdoorSchema = Joi.object({
  emp_id: Joi.string().required(),
  od_date: Joi.string().regex(/^\d{4}-\d{2}-\d{2}$/).required(),
  start_time: Joi.string().default('09:00:00'),
  end_time: Joi.string().default('18:00:00'),
  destination_client: Joi.string().min(2).max(150).required(),
  purpose: Joi.string().min(2).max(255).required(),
  travel_allowance_eligible: Joi.boolean().default(true),
  comments: Joi.string().allow('', null).optional()
});

// ── Overtime Register ──
router.get('/ot-register', authenticate, async (req, res) => {
  try {
    const { emp_id, ot_date, status, page, size } = req.query;
    const result = await stmts.getOtRecords.all({
      emp_id, ot_date, status,
      page: parseInt(page, 10) || 1,
      size: parseInt(size, 10) || 20
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/ot-register', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { error, value } = otSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message }, request_id: req.id });

    const created = await stmts.insertOtRecord.run(value);
    await auditLog({ table: 'ot_records', recordId: created.id, action: 'INSERT', newVals: value, req });
    res.status(201).json({ success: true, message: 'OT record created', id: created.id, record: created });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.put('/ot-register/:id/status', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { status, comments } = req.body;
    const updated = await stmts.updateOtStatus.run(req.params.id, {
      status, comments, approved_by: req.user?.username || 'Admin'
    });
    await auditLog({ table: 'ot_records', recordId: req.params.id, action: 'UPDATE', newVals: req.body, req });
    res.json({ success: true, message: 'OT status updated', record: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/ot-register/auto-calculate', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { target_date } = req.body;
    const date = target_date || new Date().toISOString().slice(0, 10);
    const result = await stmts.autoCalculateDailyOt.run(date);
    res.json({ success: true, message: `Auto-calculated OT for ${result.targetDate} (${result.calculated} records)`, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.delete('/ot-register/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    await stmts.deleteOtRecord.run(req.params.id);
    await auditLog({ table: 'ot_records', recordId: req.params.id, action: 'DELETE', req });
    res.json({ success: true, message: 'OT record deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

// ── Leave Types ──
router.get('/leave-types', authenticate, async (req, res) => {
  try {
    const leaveTypes = await stmts.getLeaveTypes.all();
    res.json({ success: true, count: leaveTypes.length, leave_types: leaveTypes });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/leave-types', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { error, value } = leaveTypeSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message }, request_id: req.id });

    const created = await stmts.insertLeaveType.run(value);
    await auditLog({ table: 'leave_types', recordId: created.id, action: 'INSERT', newVals: value, req });
    res.status(201).json({ success: true, message: 'Leave type created', id: created.id, leave_type: created });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.put('/leave-types/:id', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const updated = await stmts.updateLeaveType.run({ ...req.body, id: req.params.id });
    res.json({ success: true, message: 'Leave type updated', leave_type: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.delete('/leave-types/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    await stmts.deleteLeaveType.run(req.params.id);
    res.json({ success: true, message: 'Leave type deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

// ── Leave Entries & Balances ──
router.get('/leave-entries', authenticate, async (req, res) => {
  try {
    const { emp_id, status, page, size } = req.query;
    const result = await stmts.getLeaveEntries.all({
      emp_id, status,
      page: parseInt(page, 10) || 1,
      size: parseInt(size, 10) || 20
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/leave-entries', authenticate, async (req, res) => {
  try {
    const { error, value } = leaveEntrySchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message }, request_id: req.id });

    const created = await stmts.insertLeaveEntry.run(value);
    await auditLog({ table: 'employee_leave_entries', recordId: created.id, action: 'INSERT', newVals: value, req });
    res.status(201).json({ success: true, message: 'Leave application submitted', id: created.id, entry: created });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.put('/leave-entries/:id/status', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { status, comments } = req.body;
    const updated = await stmts.updateLeaveStatus.run(req.params.id, {
      status, comments, approved_by: req.user?.username || 'Admin'
    });
    await auditLog({ table: 'employee_leave_entries', recordId: req.params.id, action: 'UPDATE', newVals: req.body, req });
    res.json({ success: true, message: 'Leave status updated', entry: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.delete('/leave-entries/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    await stmts.deleteLeaveEntry.run(req.params.id);
    res.json({ success: true, message: 'Leave entry deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.get('/leave-balances/:emp_id', authenticate, async (req, res) => {
  try {
    const balances = await stmts.getEmployeeLeaveBalances.all(req.params.emp_id);
    res.json({ success: true, emp_id: req.params.emp_id, balances });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

// ── Outdoor / On-Duty Entries ──
router.get('/outdoor-entries', authenticate, async (req, res) => {
  try {
    const { emp_id, status, page, size } = req.query;
    const result = await stmts.getOutdoorEntries.all({
      emp_id, status,
      page: parseInt(page, 10) || 1,
      size: parseInt(size, 10) || 20
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/outdoor-entries', authenticate, async (req, res) => {
  try {
    const { error, value } = outdoorSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message }, request_id: req.id });

    const created = await stmts.insertOutdoorEntry.run(value);
    await auditLog({ table: 'employee_outdoor_entries', recordId: created.id, action: 'INSERT', newVals: value, req });
    res.status(201).json({ success: true, message: 'Outdoor duty entry created', id: created.id, entry: created });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.put('/outdoor-entries/:id/status', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { status, comments } = req.body;
    const updated = await stmts.updateOutdoorStatus.run(req.params.id, {
      status, comments, approved_by: req.user?.username || 'Admin'
    });
    await auditLog({ table: 'employee_outdoor_entries', recordId: req.params.id, action: 'UPDATE', newVals: req.body, req });
    res.json({ success: true, message: 'Outdoor status updated', entry: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.delete('/outdoor-entries/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    await stmts.deleteOutdoorEntry.run(req.params.id);
    res.json({ success: true, message: 'Outdoor entry deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

module.exports = router;
