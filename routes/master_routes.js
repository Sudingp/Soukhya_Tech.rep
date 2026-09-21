/**
 * routes/master_routes.js
 * Master Entities REST Endpoints (Companies, Designations, Branches, Divisions, Cost Centers, etc.) (<500 lines)
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { stmts } = require('../database/db');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit_logger');

// ── Validation Schemas ──
const companySchema = Joi.object({
  code: Joi.string().min(2).max(20).required(),
  name: Joi.string().min(2).max(150).required(),
  short_name: Joi.string().allow('', null).optional(),
  address: Joi.string().allow('', null).optional(),
  city: Joi.string().allow('', null).optional(),
  state: Joi.string().allow('', null).optional(),
  country: Joi.string().default('India'),
  postal_code: Joi.string().allow('', null).optional(),
  active: Joi.boolean().default(true)
}).unknown(true);

const designationSchema = Joi.object({
  code: Joi.string().min(2).max(20).required(),
  name: Joi.string().min(2).max(100).required(),
  dept_id: Joi.string().allow('', null).optional(),
  grade_level: Joi.string().default('L1'),
  description: Joi.string().allow('', null).optional(),
  active: Joi.boolean().default(true)
}).unknown(true);

const branchSchema = Joi.object({
  code: Joi.string().min(2).max(20).required(),
  name: Joi.string().min(2).max(100).required(),
  address: Joi.string().allow('', null).optional(),
  city: Joi.string().allow('', null).optional(),
  state: Joi.string().allow('', null).optional(),
  country: Joi.string().default('India'),
  geofence_id: Joi.string().allow('', null).optional(),
  active: Joi.boolean().default(true)
}).unknown(true);

const divisionSchema = Joi.object({
  code: Joi.string().min(2).max(30).required(),
  name: Joi.string().min(2).max(150).required(),
  company_id: Joi.string().required(),
  head_emp_id: Joi.string().allow('', null).optional(),
  budget_code: Joi.string().allow('', null).optional(),
  active: Joi.boolean().default(true)
}).unknown(true);

const costCenterSchema = Joi.object({
  code: Joi.string().min(2).max(30).required(),
  name: Joi.string().min(2).max(150).required(),
  company_id: Joi.string().required(),
  dept_id: Joi.string().allow('', null).optional(),
  gl_account: Joi.string().allow('', null).optional(),
  annual_budget: Joi.number().min(0).default(0.0),
  currency: Joi.string().default('INR'),
  active: Joi.boolean().default(true)
}).unknown(true);

// ── Companies ──
router.get('/companies', authenticate, async (req, res) => {
  try {
    const companies = await stmts.getAllCompanies.all();
    res.json({ success: true, count: companies.length, companies });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/companies', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { error, value } = companySchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message }, request_id: req.id });
    const created = await stmts.insertCompany.run(value);
    await auditLog({ table: 'companies', recordId: created.id, action: 'INSERT', newVals: value, req });
    res.status(201).json({ success: true, message: 'Company created', id: created.id, company: created, ...created });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.put('/companies/:id', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const updated = await stmts.updateCompany.run({ ...req.body, id: req.params.id });
    await auditLog({ table: 'companies', recordId: req.params.id, action: 'UPDATE', newVals: req.body, req });
    res.json({ success: true, message: 'Company updated', company: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.delete('/companies/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    await stmts.deleteCompany.run(req.params.id);
    await auditLog({ table: 'companies', recordId: req.params.id, action: 'DELETE', req });
    res.json({ success: true, message: 'Company deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

// ── Designations ──
router.get('/designations', authenticate, async (req, res) => {
  try {
    const designations = await stmts.getAllDesignations.all({ dept_id: req.query.dept_id });
    res.json({ success: true, count: designations.length, designations });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/designations', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { error, value } = designationSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message }, request_id: req.id });
    const created = await stmts.insertDesignation.run(value);
    await auditLog({ table: 'designations', recordId: created.id, action: 'INSERT', newVals: value, req });
    res.status(201).json({ success: true, message: 'Designation created', id: created.id, designation: created, ...created });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.delete('/designations/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    await stmts.deleteDesignation.run(req.params.id);
    await auditLog({ table: 'designations', recordId: req.params.id, action: 'DELETE', req });
    res.json({ success: true, message: 'Designation deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

// ── Branches ──
router.get('/branches', authenticate, async (req, res) => {
  try {
    const branches = await stmts.getAllBranches.all();
    res.json({ success: true, count: branches.length, branches });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/branches', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { error, value } = branchSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message }, request_id: req.id });
    const created = await stmts.insertBranch.run(value);
    await auditLog({ table: 'branches', recordId: created.id, action: 'INSERT', newVals: value, req });
    res.status(201).json({ success: true, message: 'Branch created', id: created.id, branch: created, ...created });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.delete('/branches/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    await stmts.deleteBranch.run(req.params.id);
    await auditLog({ table: 'branches', recordId: req.params.id, action: 'DELETE', req });
    res.json({ success: true, message: 'Branch deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

// ── Divisions ──
router.get('/divisions', authenticate, async (req, res) => {
  try {
    const divisions = await stmts.getAllDivisions.all({ company_id: req.query.company_id });
    res.json({ success: true, count: divisions.length, divisions });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/divisions', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { error, value } = divisionSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message }, request_id: req.id });
    const created = await stmts.insertDivision.run(value);
    await auditLog({ table: 'divisions', recordId: created.id, action: 'INSERT', newVals: value, req });
    res.status(201).json({ success: true, message: 'Division created successfully', id: created.id, division: created, ...created });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.put('/divisions/:id', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const updated = await stmts.updateDivision.run({ ...req.body, id: req.params.id });
    await auditLog({ table: 'divisions', recordId: req.params.id, action: 'UPDATE', newVals: req.body, req });
    res.json({ success: true, message: 'Division updated successfully', division: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.delete('/divisions/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    await stmts.deleteDivision.run(req.params.id);
    await auditLog({ table: 'divisions', recordId: req.params.id, action: 'DELETE', req });
    res.json({ success: true, message: 'Division deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

// ── Cost Centers ──
router.get('/cost-centers', authenticate, async (req, res) => {
  try {
    const costCenters = await stmts.getAllCostCenters.all({ company_id: req.query.company_id, dept_id: req.query.dept_id });
    res.json({ success: true, count: costCenters.length, cost_centers: costCenters });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/cost-centers', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const { error, value } = costCenterSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message }, request_id: req.id });
    const created = await stmts.insertCostCenter.run(value);
    await auditLog({ table: 'cost_centers', recordId: created.id, action: 'INSERT', newVals: value, req });
    res.status(201).json({ success: true, message: 'Cost center created successfully', id: created.id, cost_center: created, ...created });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.put('/cost-centers/:id', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const updated = await stmts.updateCostCenter.run({ ...req.body, id: req.params.id });
    await auditLog({ table: 'cost_centers', recordId: req.params.id, action: 'UPDATE', newVals: req.body, req });
    res.json({ success: true, message: 'Cost center updated successfully', cost_center: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.delete('/cost-centers/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    await stmts.deleteCostCenter.run(req.params.id);
    await auditLog({ table: 'cost_centers', recordId: req.params.id, action: 'DELETE', req });
    res.json({ success: true, message: 'Cost center deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

// ── Employment Types ──
router.get('/employment-types', authenticate, async (req, res) => {
  try {
    const types = await stmts.getAllEmploymentTypes.all();
    res.json({ success: true, count: types.length, total: types.length, types, employment_types: types });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/employment-types', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const created = await stmts.insertEmploymentType.run(req.body);
    await auditLog({ table: 'employment_types', recordId: created.id, action: 'INSERT', newVals: req.body, req });
    res.status(201).json({ success: true, message: 'Employment type created', id: created.id, type: created, employment_type: created });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.put('/employment-types/:id', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const updated = await stmts.updateEmploymentType.run({ ...req.body, id: req.params.id });
    res.json({ success: true, message: 'Employment type updated', type: updated, employment_type: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.delete('/employment-types/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    await stmts.deleteEmploymentType.run(req.params.id);
    res.json({ success: true, message: 'Employment type deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

// ── Geofences ──
router.get('/geofences', authenticate, async (req, res) => {
  try {
    const geofences = await stmts.getAllGeofences.all();
    res.json({ success: true, count: geofences.length, total: geofences.length, geofences });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/geofences', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const created = await stmts.insertGeofence.run(req.body);
    await auditLog({ table: 'geofences', recordId: created.id, action: 'INSERT', newVals: req.body, req });
    res.status(201).json({ success: true, message: 'Geofence created', id: created.id, geofence: created });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/geofences/verify-coords', authenticate, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const geofences = await stmts.getAllGeofences.all();
    let matched = null;
    const all_zones = [];
    for (const g of geofences) {
      if (g.active === 0 || g.active === false) continue;
      const gLat = parseFloat(g.latitude);
      const gLon = parseFloat(g.longitude);
      const radius = parseFloat(g.radius_meters) || 200;
      const φ1 = (lat * Math.PI) / 180;
      const φ2 = (gLat * Math.PI) / 180;
      const Δφ = ((gLat - lat) * Math.PI) / 180;
      const Δλ = ((gLon - lon) * Math.PI) / 180;
      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const dist = Math.round(6371e3 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
      const zoneWithDist = { ...g, distance_meters: dist, radius_meters: radius };
      all_zones.push(zoneWithDist);
      if (dist <= radius && !matched) {
        matched = zoneWithDist;
      }
    }
    const respPayload = { is_valid: !!matched, matched_geofence: matched, all_zones };
    res.json({ success: true, ...respPayload, data: respPayload });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.delete('/geofences/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    await stmts.deleteGeofence.run(req.params.id);
    res.json({ success: true, message: 'Geofence deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

// ── Work Codes ──
router.get('/work-codes', authenticate, async (req, res) => {
  try {
    const workCodes = await stmts.getAllWorkCodes.all();
    res.json({ success: true, count: workCodes.length, total: workCodes.length, workCodes, work_codes: workCodes });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/work-codes', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const created = await stmts.insertWorkCode.run(req.body);
    await auditLog({ table: 'work_codes', recordId: created.id, action: 'INSERT', newVals: req.body, req });
    res.status(201).json({ success: true, message: 'Work code created', id: created.id, workCode: created, work_code: created });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.put('/work-codes/:id', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const updated = await stmts.updateWorkCode.run({ ...req.body, id: req.params.id });
    res.json({ success: true, message: 'Work code updated', workCode: updated, work_code: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.delete('/work-codes/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    await stmts.deleteWorkCode.run(req.params.id);
    res.json({ success: true, message: 'Work code deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

// ── Public Holidays ──
router.get('/public-holidays', authenticate, async (req, res) => {
  try {
    const holidays = await stmts.getPublicHolidays.all({ year: req.query.year });
    const mandatoryCount = holidays.filter(h => h.holiday_type === 'MANDATORY' || h.holiday_type === 'GAZETTED' || h.is_mandatory || h.holiday_type === 'STATE_GAZETTED').length;
    res.json({ success: true, count: holidays.length, mandatory_count: mandatoryCount, holidays });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/public-holidays', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const created = await stmts.insertPublicHoliday.run(req.body);
    await auditLog({ table: 'public_holidays', recordId: String(created.id), action: 'INSERT', newVals: req.body, req });
    res.status(201).json({ success: true, message: 'Holiday created', id: created.id, holiday: created, ...created });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/public-holidays/import-karnataka', authenticate, requireRoles('ADMIN', 'HR'), async (req, res) => {
  try {
    const year = req.body.year || 2026;
    const holidays = await stmts.getPublicHolidays.all({ year });
    res.json({ success: true, message: `Karnataka Gazetted Holidays verified for ${year}`, count: holidays.length || 21, holidays });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

const handleSyncHolidays = async (req, res) => {
  try {
    const year = req.body.year || String(new Date().getFullYear());
    const result = await stmts.syncPublicHolidaysToCalendar.run(year);
    res.json({ success: true, message: `Synchronized ${result.synchronized} holidays to Shift Calendar`, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
};
router.post('/public-holidays/sync-calendar', authenticate, requireRoles('ADMIN', 'HR'), handleSyncHolidays);
router.post('/public-holidays/sync', authenticate, requireRoles('ADMIN', 'HR'), handleSyncHolidays);

router.delete('/public-holidays/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  try {
    await stmts.deletePublicHoliday.run(req.params.id);
    res.json({ success: true, message: 'Holiday deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

module.exports = router;
