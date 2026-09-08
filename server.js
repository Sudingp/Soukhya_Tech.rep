// server.js — Soukhya Tech Hardened Backend
// JWT Auth | AES-256-GCM PII | Rate Limiting | Helmet | Joi | LRU Cache | HMAC | Audit

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const path = require('path');
const { LRUCache } = require('./lib/dsa_cache');


require('dotenv').config();

const { db, stmts } = require('./database/db');

// ══════════════════════════════════════════════
// ENV CONFIG with safe dev fallbacks
// ══════════════════════════════════════════════
const isDev = (!process.env.NODE_ENV) || process.env.NODE_ENV === 'development';
const PORT = process.env.PORT || 3000;

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || (isDev ? 'dev-access-secret-do-not-use-in-production' : null);
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (isDev ? 'dev-refresh-secret-do-not-use-in-production' : null);
const PII_ENCRYPTION_KEY = process.env.PII_ENCRYPTION_KEY || (isDev ? 'dev-pii-key-32-bytes-long!!' : null);
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

const CORS_WHITELIST = (process.env.CORS_WHITELIST || 'http://localhost:3000,http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean);

const RATE_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000;
const RATE_MAX = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100;
const RATE_AUTH_MAX = parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) || 10;

const CACHE_TTL_EMP = parseInt(process.env.CACHE_TTL_EMPLOYEE, 10) || 300;
const CACHE_TTL_STATS = parseInt(process.env.CACHE_TTL_STATS, 10) || 60;

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (isDev ? 'admin123' : null);

if (!isDev && (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET || !PII_ENCRYPTION_KEY)) {
  console.error('FATAL: Missing required secrets in production. Set JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, PII_ENCRYPTION_KEY.');
  process.exit(1);
}

// ══════════════════════════════════════════════
// Encryption (AES-256-GCM)
// ══════════════════════════════════════════════
const PII_FIELDS = ['aadhaar_number', 'pan_number', 'phone_no', 'email', 'card_number'];

function encryptPii(plaintext) {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(PII_ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(String(plaintext), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptPii(ciphertext) {
  if (!ciphertext) return null;
  try {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(PII_ENCRYPTION_KEY, 'hex'), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

function maskPii(field, value) {
  if (!value) return null;
  if (field === 'aadhaar_number') return 'XXXX-XXXX-' + value.slice(-4);
  if (field === 'pan_number') return 'XXXXX' + value.slice(5, 9) + 'X';
  if (field === 'phone_no') return value.slice(0, 4) + ' *****-' + value.slice(-5);
  if (field === 'email') {
    const [user, domain] = value.split('@');
    return user[0] + '***@' + domain;
  }
  if (field === 'card_number') return '****' + value.slice(-4);
  return value;
}

function encryptEmployeePii(emp) {
  const out = { ...emp };
  for (const f of PII_FIELDS) {
    if (out[f]) out[f] = encryptPii(out[f]);
  }
  return out;
}

function decryptEmployeePii(emp, mask = false) {
  const out = { ...emp };
  for (const f of PII_FIELDS) {
    if (out[f]) {
      const plain = decryptPii(out[f]);
      out[f] = mask ? maskPii(f, plain) : plain;
    }
  }
  return out;
}

// ══════════════════════════════════════════════
// HMAC Request Signing
// ══════════════════════════════════════════════
function signRequest(method, path, body, timestamp, secret) {
  const payload = `${method.toUpperCase()}|${path}|${timestamp}|${JSON.stringify(body || {})}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function verifyRequestSignature(req, res, next) {
  const sig = req.headers['x-request-signature'];
  const ts = req.headers['x-request-timestamp'];
  if (!sig || !ts) return res.status(401).json({ success: false, error: { code: 'MISSING_SIGNATURE', message: 'Request signature required' } });
  const now = Date.now();
  const reqTime = parseInt(ts, 10);
  if (isNaN(reqTime) || Math.abs(now - reqTime) > 5 * 60 * 1000) {
    return res.status(401).json({ success: false, error: { code: 'STALE_REQUEST', message: 'Request timestamp too old or future-dated' } });
  }
  const expected = signRequest(req.method, req.path, req.body, ts, JWT_ACCESS_SECRET);
  if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Request signature mismatch' } });
  }
  next();
}

// ══════════════════════════════════════════════
// Cache Layer (Pure DSA Doubly-Linked LRU + TTL)
// ══════════════════════════════════════════════
const cache = new LRUCache({ capacity: 5000, defaultTTL: 300000, sweepInterval: 30000 });
const CACHE_KEYS = {
  EMP_LIST: (page, size, status) => `emp:list:${status || 'all'}:${page}:${size}`,
  EMP_BY_ID: (id) => `emp:${id}`,
  STATS: 'stats:dashboard',
  ATT_TODAY: (empId) => `att:today:${empId}`,
};

// ══════════════════════════════════════════════
// Real-Time DB Change Tracker & SSE Hub
// ══════════════════════════════════════════════
let dbRevision = 1;
const dbLastModified = {
  employees: Date.now(),
  attendance: Date.now(),
  stats: Date.now(),
  overall: Date.now()
};

const sseClients = new Set();

function notifyDbChange(table, meta = {}) {
  dbRevision++;
  const now = Date.now();
  dbLastModified.overall = now;
  if (table && dbLastModified[table] !== undefined) {
    dbLastModified[table] = now;
  }
  dbLastModified.stats = now;

  // Invalidate Cache by tags or prefixes O(1)/O(k)
  if (table === 'employees') {
    cache.invalidateTag('employees');
    cache.invalidateByPrefix('emp:');
    cache.delete(CACHE_KEYS.STATS);
  } else if (table === 'attendance') {
    cache.invalidateTag('attendance');
    cache.invalidateByPrefix('att:');
    cache.delete(CACHE_KEYS.STATS);
  } else {
    cache.clear();
  }

  // Broadcast to all connected SSE clients
  const payload = JSON.stringify({
    event: 'db_change',
    table: table || 'all',
    revision: dbRevision,
    timestamp: now,
    ...meta
  });

  for (const clientRes of Array.from(sseClients)) {
    try {
      clientRes.write(`event: db_change\ndata: ${payload}\n\n`);
    } catch {
      sseClients.delete(clientRes);
    }
  }
}

function cacheInvalidateEmployee(id) {
  notifyDbChange('employees', { action: 'invalidate', id });
}

function cacheInvalidateAttendance() {
  notifyDbChange('attendance', { action: 'invalidate' });
}

function handleETag(req, res, data, entity = 'overall') {
  const version = dbLastModified[entity] || dbRevision;
  const len = data ? (typeof data === 'string' ? data.length : JSON.stringify(data).length) : 0;
  const hash = crypto.createHash('md5').update(`${version}-${len}`).digest('hex');
  const etag = `W/"${hash}"`;

  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=10, must-revalidate');

  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return true;
  }
  return false;
}


// ══════════════════════════════════════════════
// Audit Logger
// ══════════════════════════════════════════════
function auditLog({ table, recordId, action, oldVals, newVals, req }) {
  try {
    const user = req.user?.username || req.user?.role || 'anonymous';
    stmts.insertAudit.run({
      table_name: table,
      record_id: String(recordId),
      action,
      old_values: oldVals ? JSON.stringify(oldVals) : null,
      new_values: newVals ? JSON.stringify(newVals) : null,
      performed_by: user,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'] || null,
    });
  } catch (e) {
    console.error('[AUDIT] Failed to log:', e.message);
  }
}

// ══════════════════════════════════════════════
// JWT Helpers
// ══════════════════════════════════════════════
function generateTokens(user) {
  const access = jwt.sign(
    { sub: user.username, id: user.id, username: user.username, role: user.role },
    JWT_ACCESS_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRY, jwtid: uuidv4() }
  );
  const refresh = jwt.sign(
    { sub: user.username, id: user.id, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRY, jwtid: uuidv4() }
  );
  return { access, refresh };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ══════════════════════════════════════════════
// Express App
// ══════════════════════════════════════════════
const app = express();

// ── Security Headers ──
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── CORS Whitelist ──
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || CORS_WHITELIST.includes(origin)) return callback(null, true);
    return callback(new Error('CORS policy violation'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Signature', 'X-Request-Timestamp'],
  credentials: true,
}));

// ── Body Parser ──
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Rate Limiters ──
const generalLimiter = rateLimit({
  windowMs: RATE_WINDOW,
  max: RATE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true',
  handler: (req, res) => res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } }),
});

const authLimiter = rateLimit({
  windowMs: RATE_WINDOW,
  max: isDev ? 200 : (parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) || 50),
  skip: () => process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true',
  handler: (req, res) => res.status(429).json({ success: false, error: { code: 'AUTH_RATE_LIMITED', message: 'Too many auth attempts' } }),
});

const attendanceLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 1,
  keyGenerator: (req) => req.body?.emp_id || req.ip,
  handler: (req, res) => res.status(429).json({ success: false, error: { code: 'ATTENDANCE_COOLDOWN', message: 'Attendance cooldown active' } }),
});

const resetSeedLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1,
  handler: (req, res) => res.status(429).json({ success: false, error: { code: 'RESET_COOLDOWN', message: 'Reset allowed once per hour' } }),
});

app.use(generalLimiter);

// ── Request ID for tracing ──
app.use((req, res, next) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// ── Periodic cleanup of expired blacklisted tokens ──
setInterval(() => {
  try { stmts.purgeExpiredTokens.run(Math.floor(Date.now() / 1000)); } catch {}
}, 3600 * 1000);

// ══════════════════════════════════════════════
// Auth Middleware
// ══════════════════════════════════════════════
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Bearer token required' } });
  }
  const token = auth.slice(7);
  try {
    const blacklisted = stmts.isTokenBlacklisted.get(hashToken(token));
    if (blacklisted) throw new Error('Token revoked');
    req.user = jwt.verify(token, JWT_ACCESS_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient privileges' } });
    }
    next();
  };
}

// ══════════════════════════════════════════════
// Joi Schemas
// ══════════════════════════════════════════════
const schemas = {
  login: Joi.object({
    username: Joi.string().min(3).max(50).required(),
    password: Joi.string().min(1).required(),
  }),
  registerEmployee: Joi.object({
    id: Joi.string().pattern(/^EMP\d{3,}$/).required(),
    name: Joi.string().min(2).max(100).required(),
    department: Joi.string().valid('Engineering', 'HR', 'Finance', 'Marketing', 'Operations', 'Sales', 'IT').required(),
    role: Joi.string().min(2).max(100).required(),
    descriptor: Joi.array().items(Joi.number()).length(128).required(),
    image: Joi.string().uri({ allowRelative: true }).allow(null).optional(),
    status: Joi.string().valid('Active', 'Hibernate', 'On Leave', 'Resigned').default('Active'),
    hibernate_start_date: Joi.string().isoDate().allow(null).optional(),
    hibernate_end_date: Joi.string().isoDate().allow(null).optional(),
    hibernate_reason: Joi.string().max(500).allow(null).optional(),
    company: Joi.string().max(100).allow(null).optional(),
    designation: Joi.string().max(100).allow(null).optional(),
    gender: Joi.string().valid('Male', 'Female').allow(null).optional(),
    date_of_joining: Joi.string().isoDate().allow(null).optional(),
    date_of_confirmation: Joi.string().isoDate().allow(null).optional(),
    last_working_day: Joi.string().isoDate().allow(null).optional(),
    aadhaar_number: Joi.string().pattern(/^\d{4}-\d{4}-\d{4}$/).allow(null).optional(),
    pan_number: Joi.string().pattern(/^[A-Z]{5}\d{4}[A-Z]$/).allow(null).optional(),
    card_number: Joi.string().max(50).allow(null).optional(),
    phone_no: Joi.string().pattern(/^\+91 \d{5} \d{5}$/).allow(null).optional(),
    email: Joi.string().email().max(100).allow(null).optional(),
    reporting_to: Joi.string().max(50).allow(null).optional(),
    device_code: Joi.string().max(50).allow(null).optional(),
    sub_department: Joi.string().max(100).allow(null).optional(),
    division: Joi.string().max(100).allow(null).optional(),
    grade: Joi.string().max(50).allow(null).optional(),
    team: Joi.string().max(100).allow(null).optional(),
    location: Joi.string().max(100).allow(null).optional(),
    employment_type: Joi.string().valid('Permanent', 'Contract', 'Temporary', 'Intern').allow(null).optional(),
    category: Joi.string().max(50).allow(null).optional(),
    holiday_group: Joi.string().max(100).allow(null).optional(),
    shift_group: Joi.string().max(100).allow(null).optional(),
    shift_roster: Joi.string().max(100).allow(null).optional(),
    geofence: Joi.string().max(100).allow(null).optional(),
    device_expiry_rule_applicable: Joi.boolean().allow(null).optional(),
    verification_type: Joi.string().max(100).allow(null).optional(),
    expiry_start_date: Joi.string().isoDate().allow(null).optional(),
    expiry_end_date: Joi.string().isoDate().allow(null).optional(),
  }),
  updateEmployee: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    department: Joi.string().valid('Engineering', 'HR', 'Finance', 'Marketing', 'Operations', 'Sales', 'IT').optional(),
    role: Joi.string().min(2).max(100).optional(),
    descriptor: Joi.array().items(Joi.number()).length(128).optional(),
    image: Joi.string().uri({ allowRelative: true }).allow(null).optional(),
    status: Joi.string().valid('Active', 'Hibernate', 'On Leave', 'Resigned').optional(),
    hibernate_start_date: Joi.string().isoDate().allow(null).optional(),
    hibernate_end_date: Joi.string().isoDate().allow(null).optional(),
    hibernate_reason: Joi.string().max(500).allow(null).optional(),
    company: Joi.string().max(100).allow(null).optional(),
    designation: Joi.string().max(100).allow(null).optional(),
    gender: Joi.string().valid('Male', 'Female').allow(null).optional(),
    date_of_joining: Joi.string().isoDate().allow(null).optional(),
    date_of_confirmation: Joi.string().isoDate().allow(null).optional(),
    last_working_day: Joi.string().isoDate().allow(null).optional(),
    aadhaar_number: Joi.string().pattern(/^\d{4}-\d{4}-\d{4}$/).allow(null).optional(),
    pan_number: Joi.string().pattern(/^[A-Z]{5}\d{4}[A-Z]$/).allow(null).optional(),
    card_number: Joi.string().max(50).allow(null).optional(),
    phone_no: Joi.string().pattern(/^\+91 \d{5} \d{5}$/).allow(null).optional(),
    email: Joi.string().email().max(100).allow(null).optional(),
    reporting_to: Joi.string().max(50).allow(null).optional(),
    device_code: Joi.string().max(50).allow(null).optional(),
    sub_department: Joi.string().max(100).allow(null).optional(),
    division: Joi.string().max(100).allow(null).optional(),
    grade: Joi.string().max(50).allow(null).optional(),
    team: Joi.string().max(100).allow(null).optional(),
    location: Joi.string().max(100).allow(null).optional(),
    employment_type: Joi.string().valid('Permanent', 'Contract', 'Temporary', 'Intern').allow(null).optional(),
    category: Joi.string().max(50).allow(null).optional(),
    holiday_group: Joi.string().max(100).allow(null).optional(),
    shift_group: Joi.string().max(100).allow(null).optional(),
    shift_roster: Joi.string().max(100).allow(null).optional(),
    geofence: Joi.string().max(100).allow(null).optional(),
    device_expiry_rule_applicable: Joi.boolean().allow(null).optional(),
    verification_type: Joi.string().max(100).allow(null).optional(),
    expiry_start_date: Joi.string().isoDate().allow(null).optional(),
    expiry_end_date: Joi.string().isoDate().allow(null).optional(),
  }),
  logAttendance: Joi.object({
    emp_id: Joi.string().required(),
    name: Joi.string().min(2).max(100).required(),
    dept: Joi.string().required(),
    role: Joi.string().required(),
    timestamp: Joi.string().isoDate().required(),
    status: Joi.string().valid('Present', 'Late').required(),
  }),
};

function validate(schema, body) {
  const { error, value } = schema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    const msg = error.details.map(d => d.message).join('; ');
    return { ok: false, msg, value: null };
  }
  return { ok: true, msg: null, value };
}

// ══════════════════════════════════════════════
// Response Helpers
// ══════════════════════════════════════════════
function ok(res, data, status = 200) {
  res.status(status).json({ success: true, ...data, request_id: res.req.requestId });
}

function err(res, code, message, status = 400) {
  res.status(status).json({ success: false, error: { code, message }, request_id: res.req.requestId });
}

// ══════════════════════════════════════════════
// Seeding (protected, audited, idempotent)
// ══════════════════════════════════════════════
function seedDatabase(reqUser = 'system') {
  const countObj = stmts.totalEmployeesCount.get();
  if (countObj.total > 0) {
    console.log('  [SEEDER] Database already has employee records. Skipping seeder.');
    return { seeded: false, count: countObj.total };
  }

  console.log('  [SEEDER] Seeding 100 realistic employee records...');
  const firstNames = ['John', 'Jane', 'Robert', 'Mary', 'William', 'David', 'James', 'Patricia', 'Michael', 'Linda', 'Elizabeth', 'Barbara', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'];
  const depts = ['Engineering', 'HR', 'Finance', 'Marketing', 'Operations', 'Sales', 'IT'];
  const rolesByDept = {
    'Engineering': ['Software Engineer', 'Senior Engineer', 'Engineering Manager', 'Frontend Developer', 'Backend Developer', 'QA Analyst', 'DevOps Specialist'],
    'HR': ['HR Generalist', 'Recruiter', 'HR Manager', 'Talent Acquisition Specialist', 'HR Coordinator'],
    'Finance': ['Financial Analyst', 'Accountant', 'Finance Manager', 'Billing Specialist', 'Controller'],
    'Marketing': ['Marketing Specialist', 'Content Strategist', 'Marketing Manager', 'SEO Analyst', 'Social Coordinator'],
    'Operations': ['Operations Analyst', 'Operations Manager', 'Logistics Coordinator', 'Project Manager', 'Office Administrator'],
    'Sales': ['Account Executive', 'Sales Manager', 'Sales Specialist', 'Business Representative', 'Client Partner'],
    'IT': ['System Administrator', 'IT Support Specialist', 'Network Engineer', 'IT Infrastructure Manager', 'Security Analyst'],
  };
  const hibernateReasons = [
    'Sabbatical for advanced higher education and professional certifications',
    'Temporary health and medical recovery period',
    'Extended personal leave for family commitments',
    'Career transition and external research secondment',
    'Relocation transition and adjustment period',
    'External incubation or startup venture exploration',
    'Military deployment or local defense training commitment',
  ];

  const targetDistribution = [];
  for (let i = 0; i < 75; i++) targetDistribution.push('Active');
  for (let i = 0; i < 10; i++) targetDistribution.push('Hibernate');
  for (let i = 0; i < 10; i++) targetDistribution.push('On Leave');
  for (let i = 0; i < 5; i++) targetDistribution.push('Resigned');

  const usedNames = new Set();
  const listToInsert = [];

  for (let i = 1; i <= 100; i++) {
    const id = `EMP${String(i).padStart(3, '0')}`;
    let firstName, lastName, fullName;
    do {
      firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      fullName = `${firstName} ${lastName}`;
    } while (usedNames.has(fullName));
    usedNames.add(fullName);

    const dept = depts[Math.floor(Math.random() * depts.length)];
    const role = rolesByDept[dept][Math.floor(Math.random() * rolesByDept[dept].length)];
    const status = targetDistribution[i - 1];

    let hibernate_start_date = null, hibernate_end_date = null, hibernate_reason = null;
    if (status === 'Hibernate') {
      const startMonth = Math.floor(Math.random() * 5) + 1;
      const startDay = Math.floor(Math.random() * 28) + 1;
      hibernate_start_date = `2026-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
      const endMonth = startMonth + Math.floor(Math.random() * 3) + 2;
      const endDay = Math.floor(Math.random() * 28) + 1;
      hibernate_end_date = `2026-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
      hibernate_reason = hibernateReasons[Math.floor(Math.random() * hibernateReasons.length)];
    }

    const descriptor = [];
    for (let j = 0; j < 128; j++) descriptor.push((Math.random() - 0.5) * 0.15);
    const descriptorJson = JSON.stringify(descriptor);
    const descriptorHash = crypto.createHash('sha256').update(descriptorJson).digest('hex');

    listToInsert.push(encryptEmployeePii({
      id, name: fullName, department: dept, role,
      descriptor: descriptorJson, descriptor_hash: descriptorHash, image: null,
      status, hibernate_start_date, hibernate_end_date, hibernate_reason,
      company: null,
      designation: null,
      gender: null,
      date_of_joining: null,
      date_of_confirmation: null,
      last_working_day: null,
      aadhaar_number: null,
      pan_number: null,
      card_number: null,
      phone_no: null,
      email: null,
      reporting_to: null,
      device_code: null,
      sub_department: null,
      division: null,
      grade: null,
      team: null,
      location: null,
      employment_type: null,
      category: null,
      holiday_group: null,
      shift_group: null,
      shift_roster: null,
      geofence: null,
      device_expiry_rule_applicable: null,
      verification_type: null,
      expiry_start_date: null,
      expiry_end_date: null,
      updated_by: reqUser,
    }));
  }

  const runTransaction = db.transaction((empList) => {
    for (const emp of empList) stmts.insertEmployee.run(emp);
  });
  runTransaction(listToInsert);

  console.log(`  [SEEDER] Successfully seeded 100 employees.`);
  return { seeded: true, count: 100 };
}

// ══════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════

// POST /api/auth/login
app.post('/api/auth/login', authLimiter, (req, res) => {
  const v = validate(schemas.login, req.body);
  if (!v.ok) return err(res, 'VALIDATION_ERROR', v.msg, 400);

  const user = stmts.getUserByUsername.get(v.value.username);
  if (!user || !bcrypt.compareSync(v.value.password, user.password_hash)) {
    return err(res, 'INVALID_CREDENTIALS', 'Invalid username or password', 401);
  }

  const tokens = generateTokens({ id: user.id, username: user.username, role: user.role });
  ok(res, { username: user.username, role: user.role, access_token: tokens.access, refresh_token: tokens.refresh });
});

// POST /api/auth/refresh
app.post('/api/auth/refresh', authLimiter, (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return err(res, 'MISSING_TOKEN', 'Refresh token required', 400);
  try {
    const payload = jwt.verify(refresh_token, JWT_REFRESH_SECRET);
    const user = stmts.getUserByUsername.get(payload.sub);
    if (!user) throw new Error('User not found');
    const tokens = generateTokens({ id: user.id, username: user.username, role: user.role });
    ok(res, { access_token: tokens.access, refresh_token: tokens.refresh });
  } catch {
    return err(res, 'INVALID_TOKEN', 'Invalid or expired refresh token', 401);
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', authenticate, (req, res) => {
  const auth = req.headers.authorization;
  const token = auth.slice(7);
  try {
    const decoded = jwt.decode(token);
    if (decoded?.exp) {
      stmts.blacklistToken.run(hashToken(token), decoded.exp);
    }
  } catch {}
  ok(res, { message: 'Logged out successfully' });
});

// ══════════════════════════════════════════════
// EMPLOYEE ROUTES
// ══════════════════════════════════════════════

// GET /api/employees — paginated, cached, role-aware masking
app.get('/api/employees', authenticate, (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(req.query.size, 10) || 20));
    const statusFilter = req.query.status || null;
    const isAdminOrHr = ['ADMIN', 'HR'].includes(req.user.role);

    const cacheKey = CACHE_KEYS.EMP_LIST(page, size, statusFilter);
    let rows = cache.get(cacheKey);
    if (!rows) {
      if (statusFilter) {
        rows = stmts.getEmployeeByStatus.all(statusFilter);
      } else {
        rows = stmts.getAllEmployees.all();
      }
      cache.set(cacheKey, rows, CACHE_TTL_EMP * 1000, ['employees']);
    }

    const total = rows.length;
    const paginated = rows.slice((page - 1) * size, page * size).map(e => {
      const decrypted = decryptEmployeePii(e, !isAdminOrHr);
      return {
        ...decrypted,
        descriptor: JSON.parse(decrypted.descriptor),
        // Never expose descriptor_hash to client
        descriptor_hash: undefined,
      };
    });

    const responseData = { employees: paginated, pagination: { page, size, total, pages: Math.ceil(total / size) } };
    if (handleETag(req, res, responseData, 'employees')) return;
    ok(res, responseData);
  } catch (e) {
    console.error('[GET /api/employees]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to fetch employees', 500);
  }
});

// GET /api/employees/:id
app.get('/api/employees/:id', authenticate, (req, res) => {
  try {
    const isAdminOrHr = ['ADMIN', 'HR'].includes(req.user.role);
    const cacheKey = CACHE_KEYS.EMP_BY_ID(req.params.id);
    let row = cache.get(cacheKey);
    if (!row) {
      row = stmts.getEmployee.get(req.params.id);
      if (row) cache.set(cacheKey, row, CACHE_TTL_EMP * 1000, ['employees']);
    }
    if (!row) return err(res, 'NOT_FOUND', 'Employee not found', 404);

    const decrypted = decryptEmployeePii(row, !isAdminOrHr);
    const responseData = { employee: { ...decrypted, descriptor: JSON.parse(decrypted.descriptor), descriptor_hash: undefined } };
    if (handleETag(req, res, responseData, 'employees')) return;
    ok(res, responseData);

  } catch (e) {
    console.error('[GET /api/employees/:id]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to fetch employee', 500);
  }
});

// POST /api/employees — ADMIN or HR only
app.post('/api/employees', authenticate, requireRoles('ADMIN', 'HR'), (req, res) => {
  try {
    const v = validate(schemas.registerEmployee, req.body);
    if (!v.ok) return err(res, 'VALIDATION_ERROR', v.msg, 400);

    const { id, descriptor, ...rest } = v.value;
    if (stmts.getEmployee.get(id)) return err(res, 'CONFLICT', `Employee ID "${id}" already exists`, 409);

    const descriptorJson = JSON.stringify(descriptor);
    const descriptorHash = crypto.createHash('sha256').update(descriptorJson).digest('hex');

    const emp = encryptEmployeePii({
      id, descriptor: descriptorJson, descriptor_hash: descriptorHash,
      ...rest,
      updated_by: req.user.username,
    });

    stmts.insertEmployee.run(emp);

    auditLog({ table: 'employees', recordId: id, action: 'INSERT', newVals: { name: rest.name, department: rest.department, role: rest.role }, req });
    cacheInvalidateEmployee(id);

    ok(res, { message: `Employee "${rest.name}" registered successfully`, id }, 201);
  } catch (e) {
    console.error('[POST /api/employees]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to register employee', 500);
  }
});

// PUT /api/employees/:id — ADMIN or HR only, with optimistic locking
app.put('/api/employees/:id', authenticate, requireRoles('ADMIN', 'HR'), (req, res) => {
  try {
    const existing = stmts.getEmployee.get(req.params.id);
    if (!existing) return err(res, 'NOT_FOUND', 'Employee not found', 404);

    const v = validate(schemas.updateEmployee, req.body);
    if (!v.ok) return err(res, 'VALIDATION_ERROR', v.msg, 400);

    const updates = v.value;
    const finalStatus = updates.status || existing.status;

    let descriptorJson = existing.descriptor;
    let descriptorHash = existing.descriptor_hash;
    if (updates.descriptor) {
      descriptorJson = JSON.stringify(updates.descriptor);
      descriptorHash = crypto.createHash('sha256').update(descriptorJson).digest('hex');
    }

    const oldVals = { name: existing.name, department: existing.department, role: existing.role, status: existing.status };
    const newVals = { ...updates };

    const emp = encryptEmployeePii({
      id: req.params.id,
      name: updates.name || existing.name,
      department: updates.department || existing.department,
      role: updates.role || existing.role,
      descriptor: descriptorJson,
      descriptor_hash: descriptorHash,
      image: updates.image !== undefined ? updates.image : existing.image,
      status: finalStatus,
      hibernate_start_date: finalStatus === 'Hibernate' ? (updates.hibernate_start_date || existing.hibernate_start_date) : null,
      hibernate_end_date: finalStatus === 'Hibernate' ? (updates.hibernate_end_date || existing.hibernate_end_date) : null,
      hibernate_reason: finalStatus === 'Hibernate' ? (updates.hibernate_reason || existing.hibernate_reason) : null,
      company: updates.company !== undefined ? updates.company : existing.company,
      designation: updates.designation !== undefined ? updates.designation : existing.designation,
      gender: updates.gender !== undefined ? updates.gender : existing.gender,
      date_of_joining: updates.date_of_joining !== undefined ? updates.date_of_joining : existing.date_of_joining,
      date_of_confirmation: updates.date_of_confirmation !== undefined ? updates.date_of_confirmation : existing.date_of_confirmation,
      last_working_day: updates.last_working_day !== undefined ? updates.last_working_day : existing.last_working_day,
      aadhaar_number: updates.aadhaar_number !== undefined ? updates.aadhaar_number : existing.aadhaar_number,
      pan_number: updates.pan_number !== undefined ? updates.pan_number : existing.pan_number,
      card_number: updates.card_number !== undefined ? updates.card_number : existing.card_number,
      phone_no: updates.phone_no !== undefined ? updates.phone_no : existing.phone_no,
      email: updates.email !== undefined ? updates.email : existing.email,
      reporting_to: updates.reporting_to !== undefined ? updates.reporting_to : existing.reporting_to,
      device_code: updates.device_code !== undefined ? updates.device_code : existing.device_code,
      sub_department: updates.sub_department !== undefined ? updates.sub_department : existing.sub_department,
      division: updates.division !== undefined ? updates.division : existing.division,
      grade: updates.grade !== undefined ? updates.grade : existing.grade,
      team: updates.team !== undefined ? updates.team : existing.team,
      location: updates.location !== undefined ? updates.location : existing.location,
      employment_type: updates.employment_type !== undefined ? updates.employment_type : existing.employment_type,
      category: updates.category !== undefined ? updates.category : existing.category,
      holiday_group: updates.holiday_group !== undefined ? updates.holiday_group : existing.holiday_group,
      shift_group: updates.shift_group !== undefined ? updates.shift_group : existing.shift_group,
      shift_roster: updates.shift_roster !== undefined ? updates.shift_roster : existing.shift_roster,
      geofence: updates.geofence !== undefined ? updates.geofence : existing.geofence,
      device_expiry_rule_applicable: updates.device_expiry_rule_applicable !== undefined ? updates.device_expiry_rule_applicable : existing.device_expiry_rule_applicable,
      verification_type: updates.verification_type !== undefined ? updates.verification_type : existing.verification_type,
      expiry_start_date: updates.expiry_start_date !== undefined ? updates.expiry_start_date : existing.expiry_start_date,
      expiry_end_date: updates.expiry_end_date !== undefined ? updates.expiry_end_date : existing.expiry_end_date,
      updated_by: req.user.username,
      version: existing.version,
    });

    const result = stmts.updateEmployee.run(emp);
    if (result.changes === 0) {
      // Version mismatch — optimistic locking conflict
      return err(res, 'CONFLICT', 'Employee was modified by another request. Please refresh and retry.', 409);
    }

    auditLog({ table: 'employees', recordId: req.params.id, action: 'UPDATE', oldVals, newVals, req });
    cacheInvalidateEmployee(req.params.id);

    ok(res, { message: 'Employee updated successfully' });
  } catch (e) {
    console.error('[PUT /api/employees/:id]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to update employee', 500);
  }
});

// DELETE /api/employees/:id — ADMIN only
app.delete('/api/employees/:id', authenticate, requireRoles('ADMIN'), (req, res) => {
  try {
    const existing = stmts.getEmployee.get(req.params.id);
    if (!existing) return err(res, 'NOT_FOUND', 'Employee not found', 404);

    stmts.deleteEmployee.run(req.params.id);

    auditLog({ table: 'employees', recordId: req.params.id, action: 'DELETE', oldVals: { name: existing.name }, req });
    cacheInvalidateEmployee(req.params.id);

    ok(res, { message: `Employee "${existing.name}" deleted` });
  } catch (e) {
    console.error('[DELETE /api/employees/:id]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to delete employee', 500);
  }
});

// ══════════════════════════════════════════════
// ATTENDANCE ROUTES
// ══════════════════════════════════════════════

// GET /api/attendance — paginated, role-aware
app.get('/api/attendance', authenticate, (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(req.query.size, 10) || 20));
    const dateStr = req.query.date;
    const empId = req.query.emp_id;

    let records;
    if (dateStr) {
      const start = `${dateStr}T00:00:00.000Z`;
      const end = `${dateStr}T23:59:59.999Z`;
      records = stmts.getAttByDateRange.all(start, end, size, (page - 1) * size);
    } else if (empId) {
      records = stmts.getAttByEmp.all(empId, size, (page - 1) * size);
    } else {
      records = stmts.getAllAttendance.all(size, (page - 1) * size);
    }

    ok(res, { records, pagination: { page, size } });
  } catch (e) {
    console.error('[GET /api/attendance]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to fetch attendance', 500);
  }
});

// POST /api/attendance — DEVICE role or ADMIN/HR; rate limited
app.post('/api/attendance', authenticate, requireRoles('ADMIN', 'HR', 'DEVICE'), attendanceLimiter, (req, res) => {
  try {
    const v = validate(schemas.logAttendance, req.body);
    if (!v.ok) return err(res, 'VALIDATION_ERROR', v.msg, 400);

    const { emp_id, name, dept, role, timestamp, status } = v.value;

    const emp = stmts.getEmployee.get(emp_id);
    if (!emp) return err(res, 'NOT_FOUND', 'Employee not registered in the system', 404);

    if (emp.status === 'Hibernate') {
      return err(res, 'FORBIDDEN', 'Employee currently in Hibernate Mode. Attendance disabled.', 403);
    }

    const dup = stmts.checkDuplicate.get(emp_id);
    if (dup) {
      return ok(res, { message: 'Attendance already logged today', duplicate: true, att_id: dup.att_id });
    }

    const info = stmts.insertAtt.run({
      emp_id, name, dept, role, timestamp, status,
      logged_by: req.user.username,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'] || null,
    });

    auditLog({ table: 'attendance', recordId: String(info.lastInsertRowid), action: 'INSERT', newVals: { emp_id, status }, req });
    cacheInvalidateAttendance();

    ok(res, { message: `${status} logged for ${name}`, att_id: info.lastInsertRowid, duplicate: false }, 201);
  } catch (e) {
    console.error('[POST /api/attendance]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to log attendance', 500);
  }
});

// DELETE /api/attendance/:att_id — ADMIN or HR only
app.delete('/api/attendance/:att_id', authenticate, requireRoles('ADMIN', 'HR'), (req, res) => {
  try {
    stmts.deleteAtt.run(req.params.att_id);
    auditLog({ table: 'attendance', recordId: req.params.att_id, action: 'DELETE', req });
    cacheInvalidateAttendance();
    ok(res, { message: 'Record deleted' });
  } catch (e) {
    console.error('[DELETE /api/attendance]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to delete record', 500);
  }
});

// ══════════════════════════════════════════════
// STATS ROUTE
// ══════════════════════════════════════════════
app.get('/api/stats', authenticate, requireRoles('ADMIN', 'HR'), (req, res) => {
  try {
    let data = cache.get(CACHE_KEYS.STATS);
    if (!data) {
      const today = stmts.statsToday.get();
      const total = stmts.totalEmployees.get();
      const records = stmts.totalRecords.get();
      const sc = stmts.statusCounts.get() || { active: 0, hibernate: 0, on_leave: 0, resigned: 0 };
      const totalCount = total.total || 0;

      data = {
        total_employees: totalCount,
        present_today: today.present_today || 0,
        late_today: today.late_today || 0,
        total_records: records.total,
        status_counts: {
          active: sc.active || 0,
          hibernate: sc.hibernate || 0,
          on_leave: sc.on_leave || 0,
          resigned: sc.resigned || 0,
        },
        active_percent: totalCount > 0 ? Math.round((sc.active / totalCount) * 100) : 0,
        hibernate_percent: totalCount > 0 ? Math.round((sc.hibernate / totalCount) * 100) : 0,
        dept_hibernate_counts: stmts.deptHibernateCounts.all(),
        monthly_hibernate_trend: stmts.monthlyHibernateTrend.all(),
      };
      cache.set(CACHE_KEYS.STATS, data, CACHE_TTL_STATS * 1000, ['stats']);
    }

    if (handleETag(req, res, data, 'stats')) return;
    ok(res, data);
  } catch (e) {
    console.error('[GET /api/stats]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to fetch stats', 500);
  }
});

// ══════════════════════════════════════════════
// REAL-TIME SYNC ROUTES (SSE & ETag Versioning)
// ══════════════════════════════════════════════
app.get('/api/sync/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();

  res.write(`event: connected\ndata: ${JSON.stringify({ revision: dbRevision, timestamps: dbLastModified })}\n\n`);
  sseClients.add(res);

  const pinger = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(pinger);
      sseClients.delete(res);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(pinger);
    sseClients.delete(res);
  });
});

app.get('/api/sync/version', (req, res) => {
  res.json({
    revision: dbRevision,
    timestamps: dbLastModified,
    cache: cache.getStats()
  });
});

// ══════════════════════════════════════════════
// RESET & SEED — ADMIN only, HMAC-signed, audited, rate-limited
// ══════════════════════════════════════════════
app.post('/api/reset-seed', authenticate, requireRoles('ADMIN'), resetSeedLimiter, verifyRequestSignature, (req, res) => {
  try {
    console.log('  [SEEDER] Manual request to Reset and Seed database...');

    db.prepare('DELETE FROM attendance').run();
    db.prepare('DELETE FROM employees').run();
    notifyDbChange('all', { action: 'reset_seed' });


    const result = seedDatabase(req.user.username);

    auditLog({ table: 'employees', recordId: 'ALL', action: 'RESET_SEED', req });

    ok(res, { message: 'Database has been reset and seeded with 100 realistic records!', ...result });
  } catch (e) {
    console.error('[POST /api/reset-seed]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to reset and seed database: ' + e.message, 500);
  }
});

// ══════════════════════════════════════════════
// AUDIT LOGS — ADMIN only
// ══════════════════════════════════════════════
app.get('/api/audit-logs', authenticate, requireRoles('ADMIN'), (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(req.query.size, 10) || 20));
    const offset = (page - 1) * size;

    const rows = db.prepare(
      'SELECT * FROM audit_log ORDER BY performed_at DESC LIMIT ? OFFSET ?'
    ).all(size, offset);

    const total = db.prepare('SELECT COUNT(*) as c FROM audit_log').get().c;

    ok(res, { logs: rows, pagination: { page, size, total, pages: Math.ceil(total / size) } });
  } catch (e) {
    console.error('[GET /api/audit-logs]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to fetch audit logs', 500);
  }
});

// ══════════════════════════════════════════════
// SPA fallback
// ══════════════════════════════════════════════
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ══════════════════════════════════════════════
// Global Error Handler
// ══════════════════════════════════════════════
app.use((err, req, res, next) => {
  console.error('[GLOBAL ERROR]', err);
  if (err.message === 'CORS policy violation') {
    return res.status(403).json({ success: false, error: { code: 'CORS_BLOCKED', message: 'Origin not allowed' }, request_id: req.requestId });
  }
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, request_id: req.requestId });
});

// ══════════════════════════════════════════════
// Boot
// ══════════════════════════════════════════════
function ensureAdminUser() {
  if (!ADMIN_PASSWORD) {
    console.error('FATAL: ADMIN_PASSWORD is not configured.');
    process.exit(1);
  }

  const existing = stmts.getUserByUsername.get(ADMIN_USERNAME);
  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);

  if (!existing) {
    stmts.insertUser.run({ username: ADMIN_USERNAME, password_hash: hash, role: 'ADMIN' });
    console.log(`  [AUTH] Default admin user created: ${ADMIN_USERNAME}`);
    return;
  }

  if (!bcrypt.compareSync(ADMIN_PASSWORD, existing.password_hash)) {
    stmts.updateUserPassword.run(hash, existing.id);
    console.log(`  [AUTH] Existing admin password updated to configured ADMIN_PASSWORD.`);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║   SOUKHYA TECH  Server Running       ║`);
  console.log(`  ║   http://localhost:${PORT}              ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);

  ensureAdminUser();

  try {
    seedDatabase('system');
  } catch (err) {
    console.error('Failed to run automatic seeder:', err);
  }
});