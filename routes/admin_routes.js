/**
 * routes/admin_routes.js
 * Admin User Management, Audit Logs, and Master Settings Endpoints
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { stmts } = require('../database/db');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit_logger');

const userCreateSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('ADMIN', 'HR', 'MANAGER', 'USER').default('USER'),
  emp_id: Joi.string().allow('', null).optional()
});

// ── Admin User Management ──
router.get('/admin/users', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    const users = await stmts.getAllUsers.all();
    res.json({ success: true, count: users.length, users, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/admin/users', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    const { error, value } = userCreateSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message }, request_id: req.id });

    const existing = await stmts.getUserByUsername.get(value.username);
    if (existing) return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Username already taken' }, request_id: req.id });

    const passwordHash = await bcrypt.hash(value.password, 10);
    const created = await stmts.insertUser.run({
      username: value.username,
      password_hash: passwordHash,
      role: value.role || 'USER',
      emp_id: value.emp_id || null
    });

    await auditLog({ table: 'users', recordId: created.id, action: 'INSERT', newVals: { username: value.username, role: value.role }, req });
    res.status(201).json({ success: true, message: 'User created successfully', id: created.id, user: created, data: created });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/admin/users/:id/reset-password', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 6 chars' }, request_id: req.id });
    }

    const passwordHash = await bcrypt.hash(new_password, 10);
    await stmts.updateUserPassword.run(req.params.id, passwordHash);
    await auditLog({ table: 'users', recordId: req.params.id, action: 'UPDATE', newVals: { password_reset: true }, req });
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.delete('/admin/users/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    await stmts.deleteUser.run(req.params.id);
    await auditLog({ table: 'users', recordId: req.params.id, action: 'DELETE', req });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

// ── Audit Logs ──
router.get('/audit-logs', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    const { page, size, table_name, action, performed_by } = req.query;
    const result = await stmts.getAuditLogs.all({
      page: parseInt(page, 10) || 1,
      size: parseInt(size, 10) || 25,
      table_name, action, performed_by
    });
    res.json({ success: true, ...result, auditLogs: result.logs });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

// ── Master Settings ──
router.get('/settings/master', authenticate, async (req, res) => {
  try {
    const settings = await stmts.getMasterSettings.get();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.put('/settings/master', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    const updated = await stmts.updateMasterSettings.run(req.body);
    await auditLog({ table: 'master_settings', recordId: '1', action: 'UPDATE', newVals: req.body, req });
    res.json({ success: true, message: 'Settings updated successfully', settings: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

module.exports = router;
