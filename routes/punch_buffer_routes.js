/**
 * routes/punch_buffer_routes.js
 * High-Speed Punch Ingestion Buffer and Pipeline REST Endpoints
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { stmts } = require('../database/db');
const { authenticate, requireRoles } = require('../middleware/auth');

const punchIngestSchema = Joi.object({
  emp_id: Joi.string().required(),
  terminal_id: Joi.string().default('EDGE_TERMINAL_01'),
  punch_timestamp: Joi.string().optional(),
  punch_state: Joi.string().valid('CHECK_IN', 'CHECK_OUT', 'BREAK_IN', 'BREAK_OUT', 'AUTO').default('AUTO'),
  verification_type: Joi.string().valid('FACE', 'FINGERPRINT', 'CARD', 'PASSCODE', 'GPS_MOBILE').default('FACE'),
  temperature: Joi.number().min(30).max(45).allow(null).optional(),
  mask_detected: Joi.boolean().default(false)
});

router.post('/ingest', async (req, res) => {
  try {
    const { error, value } = punchIngestSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message }, request_id: req.id });

    const result = await stmts.ingestFastPunch.run(value);
    res.status(201).json({ success: true, message: 'Punch ingested into fast buffer', ...result });
  } catch (err) {
    console.error('[POST /api/punch-buffer/ingest]', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/batch-ingest', async (req, res) => {
  try {
    const punches = Array.isArray(req.body) ? req.body : req.body.punches;
    if (!Array.isArray(punches) || punches.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Expected a non-empty punches array' }, request_id: req.id });
    }
    const result = await stmts.batchIngestFastPunches.run(punches);
    res.status(201).json({ success: true, message: `Batch of ${result.inserted} punches ingested into buffer`, ...result });
  } catch (err) {
    console.error('[POST /api/punch-buffer/batch-ingest]', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/flush', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const limit = req.body?.limit ? parseInt(req.body.limit, 10) : 1000;
    const result = await stmts.flushFastPunchBuffer.run(limit);
    res.json({ success: true, message: 'Punch buffer drained and processed to attendance logs', ...result });
  } catch (err) {
    console.error('[POST /api/punch-buffer/flush]', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.get('/metrics', authenticate, async (req, res) => {
  try {
    const data = await stmts.getFastPunchMetrics.get();
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

module.exports = router;
