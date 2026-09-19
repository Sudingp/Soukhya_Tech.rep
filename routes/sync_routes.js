/**
 * routes/sync_routes.js
 * System Health, Real-Time Sync Versioning, and Cache Status Endpoints
 */

const express = require('express');
const router = express.Router();
const { getActiveDialect } = require('../database/db');

let serverRevision = Date.now();

router.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    active_dialect: getActiveDialect(),
    timestamp: new Date().toISOString(),
    revision: serverRevision
  });
});

router.get('/sync/version', (req, res) => {
  res.json({
    success: true,
    revision: serverRevision,
    server_time: new Date().toISOString()
  });
});

router.get('/sync/changes', (req, res) => {
  const clientRev = parseInt(req.query.since, 10) || 0;
  res.json({
    success: true,
    has_changes: clientRev < serverRevision,
    current_revision: serverRevision
  });
});

module.exports = router;
