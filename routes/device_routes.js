/**
 * routes/device_routes.js
 * Biometric Edge Hardware Terminals REST Endpoints
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { stmts } = require('../database/db');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit_logger');

const deviceSchema = Joi.object({
  serial_number: Joi.string().min(2).max(50).required(),
  device_name: Joi.string().min(2).max(100).required(),
  device_ip: Joi.string().max(45).required(),
  device_port: Joi.number().integer().min(1).max(65535).default(4370),
  device_model: Joi.string().max(50).default('eSSL SilkBio-101TC'),
  protocol: Joi.string().valid('ZKEM', 'HIKVISION', 'ESSL', 'ANVIZ', 'REST_API').default('ESSL'),
  branch_id: Joi.string().allow('', null).optional(),
  direction: Joi.string().valid('IN', 'OUT', 'BOTH').default('BOTH'),
  status: Joi.string().valid('ONLINE', 'OFFLINE', 'SYNCING', 'ERROR').default('ONLINE'),
  active: Joi.boolean().default(true)
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { branch_id, status, active } = req.query;
    const devices = await stmts.getAllDevices.all({
      branch_id: branch_id || null,
      status: status || null,
      active: active !== undefined ? active === 'true' || active === '1' : null
    });
    res.json({ success: true, count: devices.length, devices });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    const { error, value } = deviceSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message }, request_id: req.id });

    const existing = await stmts.getDeviceBySerial.get(value.serial_number);
    if (existing) return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Device with this serial number already exists' }, request_id: req.id });

    const result = await stmts.insertDevice.run(value);
    await auditLog({ table: 'biometric_devices', recordId: result.id, action: 'INSERT', newVals: value, req });
    res.status(201).json({ success: true, message: 'Biometric device registered successfully', id: result.id, device: result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.put('/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    const { error, value } = deviceSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message }, request_id: req.id });

    const updated = await stmts.updateDevice.run({ ...value, id: req.params.id });
    await auditLog({ table: 'biometric_devices', recordId: req.params.id, action: 'UPDATE', newVals: value, req });
    res.json({ success: true, message: 'Biometric device updated successfully', device: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.delete('/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    await stmts.deleteDevice.run(req.params.id);
    await auditLog({ table: 'biometric_devices', recordId: req.params.id, action: 'DELETE', req });
    res.json({ success: true, message: 'Biometric device removed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/:id/ping', authenticate, async (req, res) => {
  try {
    const pinged = await stmts.pingDevice.run(req.params.id);
    res.json({ success: true, message: 'Device ping successful', device: pinged });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/:id/sync-templates', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const synced = await stmts.syncDeviceTemplates.run(req.params.id);
    res.json({ success: true, message: 'Templates synchronized successfully to device memory', ...synced });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

module.exports = router;
