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

// SSE endpoint for real-time push notifications
const sseClients = new Set();

router.get('/sync/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(':\n\n'); // SSE comment to flush headers

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));

  // Heartbeat every 30s to keep connection alive
  const hb = setInterval(() => res.write(':\n\n'), 30000);
  req.on('close', () => clearInterval(hb));
});

function broadcastDbChange(table, action) {
  const payload = JSON.stringify({ table, action, timestamp: Date.now() });
  serverRevision = Date.now();
  for (const client of sseClients) {
    client.write(`event: db_change\ndata: ${payload}\n\n`);
  }
}

module.exports = router;
module.exports.broadcastDbChange = broadcastDbChange;
