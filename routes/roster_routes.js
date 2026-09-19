/**
 * routes/roster_routes.js
 * Shift Roster Matrix Generation and Override Endpoints (<500 lines)
 */

const express = require('express');
const router = express.Router();
const { stmts } = require('../database/db');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit_logger');

router.get('/', authenticate, async (req, res) => {
  try {
    const { month, department_id, branch_id, shift_id, search, page, size } = req.query;
    const result = await stmts.getRosterMatrix.get({
      month, department_id, branch_id, shift_id, search,
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
    const { emp_id, emp_ids, start_date, end_date, shift_id, day_type = 'WORK', note = null } = req.body;
    const targetEmpIds = Array.isArray(emp_ids) && emp_ids.length > 0 ? emp_ids : (emp_id ? [emp_id] : []);
    if (targetEmpIds.length === 0 || !start_date || !shift_id) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'emp_id(s), start_date, and shift_id are required' }, request_id: req.id });
    }
    let totalSlots = 0;
    for (const id of targetEmpIds) {
      const resData = await stmts.assignEmployeeRoster.run({
        emp_id: id,
        start_date,
        end_date: end_date || start_date,
        shift_id,
        day_type,
        note,
        assigned_by: req.user?.username || 'Admin'
      });
      totalSlots += resData.slots_updated || 1;
    }
    await auditLog({ table: 'shift_roster', recordId: targetEmpIds.join(','), action: 'INSERT', newVals: req.body, req });
    res.json({ success: true, message: `Assigned roster to ${targetEmpIds.length} employees`, total_slots: totalSlots, emp_ids: targetEmpIds });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/auto-generate', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    let { month, year, department_id, overwrite = false } = req.body;
    let monthStr = '';
    if (year && month) {
      monthStr = `${year}-${String(month).padStart(2, '0')}`;
    } else if (typeof month === 'string' && month.includes('-')) {
      monthStr = month;
    } else if (month) {
      monthStr = `${new Date().getFullYear()}-${String(month).padStart(2, '0')}`;
    } else {
      monthStr = new Date().toISOString().slice(0, 7);
    }
    const result = await stmts.autoGenerateMonthlyRoster.run({
      monthStr,
      department_id: department_id || null,
      overwrite
    });
    await auditLog({ table: 'shift_roster', recordId: monthStr, action: 'INSERT', newVals: req.body, req });
    res.json({
      success: true,
      message: `Roster generated for ${result.month} (${result.createdSlots} slots assigned across ${result.employeeCount} active employees)`,
      total_slots: result.createdSlots,
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
