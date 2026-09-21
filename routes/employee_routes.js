/**
 * routes/employee_routes.js
 * Employee Master REST Endpoints (Indexed Pagination, Multi-Filter, Biometrics)
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { stmts } = require('../database/db');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit_logger');

const employeeSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().min(2).max(100).required(),
  department: Joi.string().allow('', null).optional(),
  department_id: Joi.string().allow('', null).optional(),
  role: Joi.string().allow('', null).optional(),
  designation_id: Joi.string().allow('', null).optional(),
  company: Joi.string().allow('', null).optional(),
  company_id: Joi.string().allow('', null).optional(),
  branch_id: Joi.string().allow('', null).optional(),
  status: Joi.string().valid('Active', 'Hibernate', 'On Leave', 'Resigned').default('Active'),
  gender: Joi.string().allow('', null).optional(),
  date_of_joining: Joi.string().allow('', null).optional(),
  phone_no: Joi.string().allow('', null).optional(),
  email: Joi.string().allow('', null).optional(),
  card_number: Joi.string().allow('', null).optional(),
  primary_shift_id: Joi.string().allow('', null).optional(),
  location: Joi.string().allow('', null).optional(),
  latitude: Joi.number().allow(null).optional(),
  longitude: Joi.number().allow(null).optional(),
  descriptor: Joi.alternatives().try(Joi.array(), Joi.string()).optional(),
  descriptor_hash: Joi.string().allow('', null).optional(),
  image: Joi.string().allow('', null).optional()
}).unknown(true);

router.get('/', authenticate, async (req, res) => {
  try {
    const { search, department, company, status, branch_id, page, size } = req.query;
    const result = await stmts.getAllEmployees.all({
      search, department, company, status, branch_id,
      page: parseInt(page, 10) || 1,
      size: parseInt(size, 10) || 20
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[GET /api/employees]', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.get('/face/descriptors', authenticate, async (req, res) => {
  try {
    const descriptors = await stmts.getAllEmployeeFaceEmbeddings.all();
    res.json({ success: true, count: descriptors.length, descriptors });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const employee = await stmts.getEmployeeById.get(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' }, request_id: req.id });
    }
    res.json({ success: true, employee });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { error, value } = employeeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message }, request_id: req.id });
    }

    const existing = await stmts.getEmployeeById.get(value.id);
    if (existing) {
      return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Employee with this ID already exists' }, request_id: req.id });
    }

    const created = await stmts.insertEmployee.run(value);
    await auditLog({ table: 'employees', recordId: value.id, action: 'INSERT', newVals: value, req });
    res.status(201).json({ success: true, message: 'Employee created successfully', employee: created });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.put('/:id', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const existing = await stmts.getEmployeeById.get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' }, request_id: req.id });
    }

    const updated = await stmts.updateEmployee.run({ ...req.body, id: req.params.id });
    await auditLog({ table: 'employees', recordId: req.params.id, action: 'UPDATE', oldVals: existing, newVals: req.body, req });
    res.json({ success: true, message: 'Employee updated successfully', employee: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.delete('/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    const existing = await stmts.getEmployeeById.get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' }, request_id: req.id });
    }

    await stmts.deleteEmployee.run(req.params.id);
    await auditLog({ table: 'employees', recordId: req.params.id, action: 'DELETE', oldVals: existing, req });
    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/bulk/import', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    const records = Array.isArray(req.body) ? req.body : req.body.employees;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Expected non-empty employees array' }, request_id: req.id });
    }

    const { totalInserted } = await stmts.bulkInsertEmployees.run(records, 500);
    await auditLog({ table: 'employees', recordId: 'BULK', action: 'INSERT', newVals: { count: records.length }, req });
    res.status(201).json({ success: true, message: `Imported ${totalInserted} employees`, count: totalInserted });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

module.exports = router;
