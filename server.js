/**
 * server.js — Soukhya Tech HR Enterprise Core API Gateway
 * Modular Clean Architecture (Max file limit: < 500 lines)
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
let compression;
try { compression = require('compression'); } catch (e) { compression = null; }
const crypto = require('crypto');
require('dotenv').config();

const { checkMySQL, getActiveDialect } = require('./database/db');

// Route Modules
const authRoutes = require('./routes/auth_routes');
const employeeRoutes = require('./routes/employee_routes');
const attendanceRoutes = require('./routes/attendance_routes');
const shiftRoutes = require('./routes/shift_routes');
const rosterRoutes = require('./routes/roster_routes');
const departmentRoutes = require('./routes/department_routes');
const masterRoutes = require('./routes/master_routes');
const deviceRoutes = require('./routes/device_routes');
const transferRoutes = require('./routes/transfer_routes');
const punchBufferRoutes = require('./routes/punch_buffer_routes');
const workflowRoutes = require('./routes/workflow_routes');
const adminRoutes = require('./routes/admin_routes');
const syncRoutes = require('./routes/sync_routes');
const MySQLAdapter = require('./database/mysql_adapter');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
app.locals.mysqlAdapter = new MySQLAdapter();

// ── Security & Middleware ──
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
if (compression) app.use(compression());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request ID & Performance Timing
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  res.setHeader('X-Dialect', getActiveDialect());
  next();
});

// ── API Router Mounts ──
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api', attendanceRoutes); // For /api/stats, /api/attendance-log
app.use('/api', shiftRoutes);
app.use('/api/shift-roster', rosterRoutes);
app.use('/api', departmentRoutes);
app.use('/api', masterRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/punch-buffer', punchBufferRoutes);
app.use('/api', workflowRoutes);
app.use('/api', adminRoutes);
app.use('/api', syncRoutes);

// ── Static Files ──
app.use(express.static(path.join(__dirname, 'public')));
app.use('/changelog', express.static(path.join(__dirname, 'changelog')));

// Single Page Application Fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
    request_id: req.id
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_SERVER_ERROR', message: err.message },
    request_id: req.id
  });
});

// ── Server Bootstrap & Exports ──
const bcrypt = require('bcryptjs');

async function ensureAdminUser() {
  const mysqlAdapter = app.locals.mysqlAdapter;
  if (!mysqlAdapter) return;
  const admin = await mysqlAdapter.getUserByUsername('admin');
  if (!admin) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
    await mysqlAdapter.insertUser({ username: 'admin', password_hash: hash, role: 'ADMIN' });
  }
}

async function seedDatabase(type = 'system') {
  return true;
}

let server = null;
if (require.main === module) {
  checkMySQL().then(async () => {
    await ensureAdminUser();
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n============================================================`);
      console.log(`  SOUKHYA TECH HR ENTERPRISE — API GATEWAY (Port ${PORT})`);
      console.log(`  Dialect: MySQL 8.4 LTS | Architecture: Modular Express Router`);
      console.log(`  Dashboard: http://localhost:${PORT}`);
      console.log(`============================================================\n`);
    });
  }).catch(err => {
    console.error('[FATAL] Failed to initialize database:', err);
    process.exit(1);
  });
}

module.exports = { app, ensureAdminUser, seedDatabase };