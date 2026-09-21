/**
 * routes/department_routes.js
 * Department Master and Department Shift Policies Endpoints (<500 lines)
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { stmts } = require('../database/db');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit_logger');

const deptSchema = Joi.object({
  code: Joi.string().min(2).max(20).required(),
  name: Joi.string().min(2).max(100).required(),
  division: Joi.string().allow('', null).optional(),
  head_emp_id: Joi.string().allow('', null).optional(),
  active: Joi.boolean().default(true)
}).unknown(true);

// ── Departments CRUD ──
router.get('/departments', authenticate, async (req, res) => {
  try {
    const departments = await stmts.getAllDepartments.all();
    res.json({ success: true, count: departments.length, departments });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/departments', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { error, value } = deptSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message }, request_id: req.id });
    }
    const created = await stmts.insertDepartment.run(value);
    await auditLog({ table: 'departments', recordId: created.id, action: 'INSERT', newVals: value, req });
    res.status(201).json({ success: true, message: 'Department created', id: created.id, department: created });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.put('/departments/:id', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const updated = await stmts.updateDepartment.run({ ...req.body, id: req.params.id });
    await auditLog({ table: 'departments', recordId: req.params.id, action: 'UPDATE', newVals: req.body, req });
    res.json({ success: true, message: 'Department updated', department: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.delete('/departments/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    await stmts.deleteDepartment.run(req.params.id);
    await auditLog({ table: 'departments', recordId: req.params.id, action: 'DELETE', req });
    res.json({ success: true, message: 'Department deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

// ── Department Shifts ──
router.get('/department-shifts', authenticate, async (req, res) => {
  try {
    const policies = await stmts.getDepartmentShiftPolicies.all();
    res.json({ success: true, count: policies.length, configs: policies, policies, department_shifts: policies });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

const handleSetDeptShift = async (req, res) => {
  try {
    const deptId = req.params.id || req.body.dept_id || req.body.department_id;
    const result = await stmts.setDepartmentShiftPolicy.run({ ...req.body, dept_id: deptId });
    await auditLog({ table: 'department_shifts', recordId: deptId, action: 'UPDATE', newVals: req.body, req });
    res.json({ success: true, message: 'Department shift policy saved', policy: result, config: result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
};

router.put('/department-shifts/:id', authenticate, requireRoles('ADMIN', 'HR'), handleSetDeptShift);
router.post('/department-shifts', authenticate, requireRoles('ADMIN', 'HR'), handleSetDeptShift);

const handleApplyDeptShift = async (req, res) => {
  try {
    const { dept_id, department_id, shift_id } = req.body;
    const targetDeptId = dept_id || department_id;
    const result = await stmts.applyDepartmentShiftToEmployees.run(targetDeptId, shift_id);
    await auditLog({ table: 'department_shifts', recordId: targetDeptId, action: 'UPDATE', newVals: req.body, req });
    res.json({ success: true, message: 'Applied department shift policy to employees', ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
};

router.post('/department-shifts/apply-to-employees', authenticate, requireRoles('ADMIN', 'HR'), handleApplyDeptShift);
router.post('/department-shifts/apply', authenticate, requireRoles('ADMIN', 'HR'), handleApplyDeptShift);

module.exports = router;
