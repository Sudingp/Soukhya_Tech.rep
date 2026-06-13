// Soukhya Tech Face Recognition Attendance System — Node.js + Express + SQLite

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const { db, stmts } = require('./database/db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ──────────────────────────────────────────────
// Middleware
// ──────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' })); // images can be large
app.use(express.static(path.join(__dirname, 'public')));

// ──────────────────────────────────────────────
// Helper
// ──────────────────────────────────────────────
const ok  = (res, data, status = 200) => res.status(status).json({ success: true,  ...data });
const err = (res, msg,  status = 400) => res.status(status).json({ success: false, error: msg });

// ═══════════════════════════════════════════════
// EMPLOYEE SEEDER
// ═══════════════════════════════════════════════
function seedDatabase() {
  const countObj = stmts.totalEmployees.get();
  if (countObj.total > 0) {
    console.log('  [SEEDER] Database already has employee records. Skipping seeder.');
    return;
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
    'IT': ['System Administrator', 'IT Support Specialist', 'Network Engineer', 'IT Infrastructure Manager', 'Security Analyst']
  };

  const hibernateReasons = [
    'Sabbatical for advanced higher education and professional certifications',
    'Temporary health and medical recovery period',
    'Extended personal leave for family commitments',
    'Career transition and external research secondment',
    'Relocation transition and adjustment period',
    'External incubation or startup venture exploration',
    'Military deployment or local defense training commitment'
  ];

  // We need 100 unique employees
  // Distribution target: 75 Active, 10 Hibernate, 10 On Leave, 5 Resigned
  const targetDistribution = [];
  for (let i = 0; i < 75; i++) targetDistribution.push('Active');
  for (let i = 0; i < 10; i++) targetDistribution.push('Hibernate');
  for (let i = 0; i < 10; i++) targetDistribution.push('On Leave');
  for (let i = 0; i < 5; i++) targetDistribution.push('Resigned');

  const usedNames = new Set();
  const listToInsert = [];

  for (let i = 1; i <= 100; i++) {
    const id = `EMP${String(i).padStart(3, '0')}`;
    
    // Choose unique name
    let firstName, lastName, fullName;
    do {
      firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      fullName = `${firstName} ${lastName}`;
    } while (usedNames.has(fullName));
    usedNames.add(fullName);

    const dept = depts[Math.floor(Math.random() * depts.length)];
    const deptRoles = rolesByDept[dept];
    const role = deptRoles[Math.floor(Math.random() * deptRoles.length)];
    
    const status = targetDistribution[i - 1];
    
    let hibernate_start_date = null;
    let hibernate_end_date = null;
    let hibernate_reason = null;

    if (status === 'Hibernate') {
      // Pick random month between January (01) and May (05) 2026
      const startMonth = Math.floor(Math.random() * 5) + 1;
      const startDay = Math.floor(Math.random() * 28) + 1;
      const startStr = `2026-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
      
      const durationMonths = Math.floor(Math.random() * 3) + 2; // 2 to 4 months duration
      const endMonth = startMonth + durationMonths;
      const endDay = Math.floor(Math.random() * 28) + 1;
      const endStr = `2026-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
      
      hibernate_start_date = startStr;
      hibernate_end_date = endStr;
      hibernate_reason = hibernateReasons[Math.floor(Math.random() * hibernateReasons.length)];
    }

    // Generate random mock face descriptor (128 floats)
    const descriptor = [];
    for (let j = 0; j < 128; j++) {
      descriptor.push((Math.random() - 0.5) * 0.15);
    }

    listToInsert.push({
      id,
      name: fullName,
      department: dept,
      role,
      descriptor: JSON.stringify(descriptor),
      image: null,
      status,
      hibernate_start_date,
      hibernate_end_date,
      hibernate_reason
    });
  }

  // Insert inside a transaction for maximum speed
  const runTransaction = db.transaction((empList) => {
    for (const emp of empList) {
      stmts.insertEmployee.run(emp);
    }
  });

  runTransaction(listToInsert);
  console.log(`  [SEEDER] Successfully seeded 100 employees: 75 Active, 10 Hibernate, 10 On Leave, 5 Resigned`);
}

// ═══════════════════════════════════════════════
// EMPLOYEE ROUTES
// ═══════════════════════════════════════════════

// GET  /api/employees          — list all employees
app.get('/api/employees', (req, res) => {
  try {
    const rows = stmts.getAllEmployees.all();
    const employees = rows.map(e => ({
      ...e,
      descriptor: JSON.parse(e.descriptor)
    }));
    ok(res, { employees });
  } catch (e) {
    console.error(e);
    err(res, 'Failed to fetch employees', 500);
  }
});

// GET  /api/employees/:id      — get single employee
app.get('/api/employees/:id', (req, res) => {
  try {
    const row = stmts.getEmployee.get(req.params.id);
    if (!row) return err(res, 'Employee not found', 404);
    ok(res, { employee: { ...row, descriptor: JSON.parse(row.descriptor) } });
  } catch (e) {
    console.error(e);
    err(res, 'Failed to fetch employee', 500);
  }
});

// POST /api/employees          — register new employee
app.post('/api/employees', (req, res) => {
  try {
    const { 
      id, name, department, role, descriptor, image, 
      status, hibernate_start_date, hibernate_end_date, hibernate_reason 
    } = req.body;

    if (!id || !name || !department || !role || !descriptor)
      return err(res, 'Missing required fields: id, name, department, role, descriptor');

    if (!Array.isArray(descriptor) || descriptor.length !== 128)
      return err(res, 'descriptor must be an array of 128 floats');

    if (stmts.getEmployee.get(id))
      return err(res, `Employee ID "${id}" already exists`, 409);

    const empStatus = status || 'Active';

    stmts.insertEmployee.run({
      id,
      name,
      department,
      role,
      descriptor: JSON.stringify(descriptor),
      image: image || null,
      status: empStatus,
      hibernate_start_date: empStatus === 'Hibernate' ? hibernate_start_date : null,
      hibernate_end_date: empStatus === 'Hibernate' ? hibernate_end_date : null,
      hibernate_reason: empStatus === 'Hibernate' ? hibernate_reason : null
    });

    ok(res, { message: `Employee "${name}" registered successfully`, id }, 201);
  } catch (e) {
    console.error(e);
    err(res, 'Failed to register employee', 500);
  }
});

// PUT  /api/employees/:id      — update employee info
app.put('/api/employees/:id', (req, res) => {
  try {
    const existing = stmts.getEmployee.get(req.params.id);
    if (!existing) return err(res, 'Employee not found', 404);

    const { 
      name, department, role, descriptor, image, 
      status, hibernate_start_date, hibernate_end_date, hibernate_reason 
    } = req.body;

    const finalStatus = status || existing.status;

    stmts.updateEmployee.run({
      id:         req.params.id,
      name:       name        || existing.name,
      department: department  || existing.department,
      role:       role        || existing.role,
      descriptor: descriptor  ? JSON.stringify(descriptor) : existing.descriptor,
      image:      image       !== undefined ? image : existing.image,
      status:     finalStatus,
      hibernate_start_date: finalStatus === 'Hibernate' ? (hibernate_start_date || existing.hibernate_start_date) : null,
      hibernate_end_date:   finalStatus === 'Hibernate' ? (hibernate_end_date || existing.hibernate_end_date) : null,
      hibernate_reason:     finalStatus === 'Hibernate' ? (hibernate_reason || existing.hibernate_reason) : null
    });

    ok(res, { message: 'Employee updated successfully' });
  } catch (e) {
    console.error(e);
    err(res, 'Failed to update employee', 500);
  }
});

// DELETE /api/employees/:id    — remove employee (cascades attendance)
app.delete('/api/employees/:id', (req, res) => {
  try {
    const existing = stmts.getEmployee.get(req.params.id);
    if (!existing) return err(res, 'Employee not found', 404);
    stmts.deleteEmployee.run(req.params.id);
    ok(res, { message: `Employee "${existing.name}" deleted` });
  } catch (e) {
    console.error(e);
    err(res, 'Failed to delete employee', 500);
  }
});

// ═══════════════════════════════════════════════
// ATTENDANCE ROUTES
// ═══════════════════════════════════════════════

// GET /api/attendance          — all records (optionally ?date=YYYY-MM-DD or ?emp_id=...)
app.get('/api/attendance', (req, res) => {
  try {
    let records;
    if (req.query.date) {
      records = stmts.getAttByDate.all(req.query.date);
    } else if (req.query.emp_id) {
      records = stmts.getAttByEmp.all(req.query.emp_id);
    } else {
      records = stmts.getAllAttendance.all();
    }
    ok(res, { records });
  } catch (e) {
    console.error(e);
    err(res, 'Failed to fetch attendance', 500);
  }
});

// POST /api/attendance         — log attendance for a recognized employee
app.post('/api/attendance', (req, res) => {
  try {
    const { emp_id, name, dept, role, timestamp, status } = req.body;

    if (!emp_id || !name || !dept || !role || !timestamp || !status)
      return err(res, 'Missing required fields');

    if (!['Present', 'Late'].includes(status))
      return err(res, 'status must be "Present" or "Late"');

    // ── CRITICAL: Check Hibernate Status Guard ──
    const emp = stmts.getEmployee.get(emp_id);
    if (!emp) {
      return err(res, 'Employee not registered in the system', 404);
    }
    
    if (emp.status === 'Hibernate') {
      return err(res, 'Employee currently in Hibernate Mode. Attendance disabled.', 403);
    }

    // Duplicate check — one record per employee per calendar day
    const dup = stmts.checkDuplicate.get(emp_id);
    if (dup) {
      return ok(res, { message: 'Attendance already logged today', duplicate: true, att_id: dup.att_id });
    }

    const info = stmts.insertAtt.run({ emp_id, name, dept, role, timestamp, status });
    ok(res, { message: `${status} logged for ${name}`, att_id: info.lastInsertRowid, duplicate: false }, 201);
  } catch (e) {
    console.error(e);
    err(res, 'Failed to log attendance', 500);
  }
});

// DELETE /api/attendance/:att_id  — remove a specific attendance record
app.delete('/api/attendance/:att_id', (req, res) => {
  try {
    stmts.deleteAtt.run(req.params.att_id);
    ok(res, { message: 'Record deleted' });
  } catch (e) {
    console.error(e);
    err(res, 'Failed to delete record', 500);
  }
});

// ═══════════════════════════════════════════════
// STATS ROUTE & RESET
// ═══════════════════════════════════════════════

// GET /api/stats               — dashboard summary with comprehensive status analytics
app.get('/api/stats', (req, res) => {
  try {
    const today   = stmts.statsToday.get();
    const total   = stmts.totalEmployees.get();
    const records = stmts.totalRecords.get();
    
    // Fetch employee status totals
    const sc = stmts.statusCounts.get() || { active: 0, hibernate: 0, on_leave: 0, resigned: 0 };
    const active = sc.active || 0;
    const hibernate = sc.hibernate || 0;
    const onLeave = sc.on_leave || 0;
    const resigned = sc.resigned || 0;
    const totalCount = total.total || 0;

    // Percentages
    const activePercent = totalCount > 0 ? Math.round((active / totalCount) * 100) : 0;
    const hibernatePercent = totalCount > 0 ? Math.round((hibernate / totalCount) * 100) : 0;

    // Department counts & monthly trend charts
    const deptHib = stmts.deptHibernateCounts.all();
    const trend = stmts.monthlyHibernateTrend.all();

    ok(res, {
      total_employees:  totalCount,
      present_today:    today.present_today  || 0,
      late_today:       today.late_today     || 0,
      total_records:    records.total,
      status_counts: {
        active,
        hibernate,
        on_leave: onLeave,
        resigned
      },
      active_percent: activePercent,
      hibernate_percent: hibernatePercent,
      dept_hibernate_counts: deptHib,
      monthly_hibernate_trend: trend
    });
  } catch (e) {
    console.error(e);
    err(res, 'Failed to fetch stats', 500);
  }
});

// POST /api/reset-seed          — resets SQLite and seeds 100 fresh employees
app.post('/api/reset-seed', (req, res) => {
  try {
    console.log('  [SEEDER] Manual request to Reset and Seed database...');
    
    // Clean tables
    db.prepare('DELETE FROM attendance').run();
    db.prepare('DELETE FROM employees').run();
    
    // Seed
    seedDatabase();
    
    ok(res, { message: 'Database has been reset and seeded with 100 realistic records!' });
  } catch (e) {
    console.error(e);
    err(res, 'Failed to reset and seed database: ' + e.message, 500);
  }
});

// ──────────────────────────────────────────────
// SPA fallback
// ──────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ──────────────────────────────────────────────
// Start & Seed
// ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║   SOUKHYA TECH  Server Running       ║`);
  console.log(`  ║   http://localhost:${PORT}              ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);
  
  // Seed automatically on boot if DB is empty
  try {
    seedDatabase();
  } catch (err) {
    console.error('Failed to run automatic seeder:', err);
  }
});
