/**
 * routes/roster_routes.js
 * Shift Roster Matrix Generation and Override Endpoints
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { stmts } = require('../database/db');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit_logger');

const assignRosterSchema = Joi.object({
  emp_id: Joi.string().required(),
  start_date: Joi.string().required(),
  end_date: Joi.string().allow('', null).optional(),
  shift_id: Joi.string().required(),
  day_type: Joi.string().valid('WORK', 'WEEKLY_OFF', 'HOLIDAY', 'LEAVE', 'OUTDOOR').default('WORK'),
  note: Joi.string().allow('', null).optional()
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { month, department_id, branch_id, shift_id, page, size } = req.query;
    const result = await stmts.getRosterMatrix.get({
      month, department_id, branch_id, shift_id,
      page: parseInt(page, 10) || 1,
      size: parseInt(size, 10) || 50
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/assign', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { error, value } = assignRosterSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message }, request_id: req.id });
    }
    const result = await stmts.assignEmployeeRoster.run({
      ...value,
      assigned_by: req.user?.username || 'Admin'
    });
    await auditLog({ table: 'shift_roster', recordId: value.emp_id, action: 'INSERT', newVals: value, req });
    res.json({ success: true, message: 'Custom shift assignment saved', ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/auto-generate', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { month, department_id, overwrite = false } = req.body;
    const result = await stmts.autoGenerateMonthlyRoster.run({
      monthStr: month,
      department_id: department_id || null,
      overwrite
    });
    await auditLog({ table: 'shift_roster', recordId: month, action: 'INSERT', newVals: req.body, req });
    res.json({
      success: true,
      message: `Roster generated for ${result.month} (${result.createdSlots} slots assigned across ${result.employeeCount} active employees)`,
      ...result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.delete('/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    await stmts.deleteRosterEntry.run(req.params.id);
    await auditLog({ table: 'shift_roster', recordId: req.params.id, action: 'DELETE', req });
    res.json({ success: true, message: 'Roster entry deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

module.exports = router;
