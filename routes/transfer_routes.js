/**
 * routes/transfer_routes.js
 * Employee Career Transfers and Promotions Ledger REST Endpoints
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { stmts } = require('../database/db');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit_logger');

const transferSchema = Joi.object({
  emp_id: Joi.string().required(),
  prev_company_id: Joi.string().allow('', null).optional(),
  new_company_id: Joi.string().allow('', null).optional(),
  prev_dept_id: Joi.string().allow('', null).optional(),
  new_dept_id: Joi.string().allow('', null).optional(),
  prev_desig_id: Joi.string().allow('', null).optional(),
  new_desig_id: Joi.string().allow('', null).optional(),
  prev_branch_id: Joi.string().allow('', null).optional(),
  new_branch_id: Joi.string().allow('', null).optional(),
  transfer_type: Joi.string().valid('PROMOTION', 'DEPARTMENT_TRANSFER', 'BRANCH_RELOCATION', 'LATERAL_MOVE', 'RE_DESIGNATION').default('PROMOTION'),
  effective_date: Joi.string().regex(/^\d{4}-\d{2}-\d{2}$/).required(),
  remarks: Joi.string().allow('', null).optional(),
  approved_by: Joi.string().allow('', null).optional()
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { emp_id, limit } = req.query;
    const transfers = await stmts.getTransfers.all({
      emp_id: emp_id || null,
      limit: limit ? parseInt(limit, 10) : 50
    });
    res.json({ success: true, count: transfers.length, transfers });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { error, value } = transferSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message }, request_id: req.id });

    const result = await stmts.recordEmployeeTransfer.run({
      ...value,
      approved_by: req.user?.username || 'admin'
    });
    await auditLog({ table: 'employee_transfers', recordId: String(result.id), action: 'INSERT', newVals: value, req });
    res.status(201).json({ success: true, message: 'Employee career transfer/promotion executed and recorded', ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

module.exports = router;
