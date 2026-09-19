#!/usr/bin/env node
/**
 * scripts/db_benchmark.js — Enterprise MySQL 8.4 LTS Performance & Stress Benchmark
 * Evaluates Simple, Medium, and Complex Queries across 10,100+ Employees & 156,000+ Records
 * Max file limit: < 500 lines
 */

const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const DB_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'soukhya_user',
  password: process.env.MYSQL_PASSWORD || 'soukhya_secure_pass_2026',
  database: process.env.MYSQL_DATABASE || 'soukhya_attendance',
  socketPath: path.resolve(__dirname, '..', 'data', 'mysql', 'mysql.sock'),
  waitForConnections: true,
  connectionLimit: 30,
  dateStrings: true
};

const BENCHMARK_SUITES = [
  // ── 1. SIMPLE QUERIES (Point Lookups & Single Index Scans) ──
  {
    tier: 'SIMPLE',
    id: 'S1_EMP_PK',
    name: 'Single Employee PK Lookup',
    sql: 'SELECT * FROM employees WHERE id = ?',
    params: () => ['EMP' + String(Math.floor(Math.random() * 10000) + 1).padStart(4, '0')],
    iterations: 200,
    concurrency: 5
  },
  {
    tier: 'SIMPLE',
    id: 'S2_EMP_EMAIL',
    name: 'Employee Lookup by Indexed Email',
    sql: 'SELECT id, name, department, role, status FROM employees WHERE email = ?',
    params: () => [`emp${Math.floor(Math.random() * 10000) + 1}@soukhyatech.com`],
    iterations: 150,
    concurrency: 5
  },
  {
    tier: 'SIMPLE',
    id: 'S3_ACTIVE_SHIFTS',
    name: 'All Configured Active Shifts',
    sql: 'SELECT * FROM shifts WHERE active = 1 ORDER BY code ASC',
    params: () => [],
    iterations: 150,
    concurrency: 5
  },
  {
    tier: 'SIMPLE',
    id: 'S4_MASTER_SETTINGS',
    name: 'Master System Settings Fetch',
    sql: 'SELECT * FROM master_settings WHERE setting_key = ?',
    params: () => ['company_name'],
    iterations: 200,
    concurrency: 5
  },
  {
    tier: 'SIMPLE',
    id: 'S5_ATTENDANCE_PK',
    name: 'Single Attendance Punch Lookup',
    sql: 'SELECT * FROM attendance WHERE att_id = ?',
    params: () => [Math.floor(Math.random() * 150000) + 1],
    iterations: 150,
    concurrency: 5
  },

  // ── 2. MEDIUM QUERIES (Filtered Range Scans, Multi-Condition Search & Aggregations) ──
  {
    tier: 'MEDIUM',
    id: 'M1_EMP_PAGINATED_SEARCH',
    name: 'Paginated Employee Search (Dept + Status + Division)',
    sql: `SELECT id, name, department, role, division_id, cost_center_id, branch_id, status 
          FROM employees 
          WHERE status = "Active" AND department = ? AND division_id = ?
          ORDER BY id ASC LIMIT 20 OFFSET 40`,
    params: () => ['Engineering', 'DIV_TECH'],
    iterations: 100,
    concurrency: 4
  },
  {
    tier: 'MEDIUM',
    id: 'M2_ATT_DATE_RANGE_DEPT',
    name: '15-Day Attendance Log Range by Department',
    sql: `SELECT att_id, emp_id, name, dept, role, timestamp, status 
          FROM attendance 
          WHERE dept = ? AND timestamp >= "2026-09-01 00:00:00" AND timestamp <= "2026-09-15 23:59:59"
          ORDER BY timestamp DESC LIMIT 50`,
    params: () => ['Engineering'],
    iterations: 80,
    concurrency: 4
  },
  {
    tier: 'MEDIUM',
    id: 'M3_LEAVE_BALANCES_LEDGER',
    name: 'Employee Statutory Leave Balance Ledger',
    sql: `SELECT elb.*, lt.name as leave_name, lt.code as leave_code, lt.color, lt.paid
          FROM employee_leave_balances elb
          JOIN leave_types lt ON elb.leave_type_id = lt.id
          WHERE elb.emp_id = ? AND elb.financial_year = 2026`,
    params: () => ['EMP' + String(Math.floor(Math.random() * 5000) + 1).padStart(4, '0')],
    iterations: 100,
    concurrency: 4
  },
  {
    tier: 'MEDIUM',
    id: 'M4_DEPT_SHIFT_POLICIES',
    name: 'Department Shift Policies & Default Shift Resolution',
    sql: `SELECT ds.*, d.name as dept_name, d.code as dept_code, s.code as shift_code, s.name as shift_name, s.start_time, s.end_time
          FROM department_shifts ds
          JOIN departments d ON ds.dept_id = d.id
          LEFT JOIN shifts s ON ds.default_shift_id = s.id
          WHERE d.active = 1`,
    params: () => [],
    iterations: 100,
    concurrency: 4
  },
  {
    tier: 'MEDIUM',
    id: 'M5_PUBLIC_HOLIDAYS_GAZETTE',
    name: 'Official 2026 Karnataka Gazetted & Restricted Holidays',
    sql: `SELECT id, title, holiday_date, holiday_type, applicable_state, applicable_location
          FROM public_holidays 
          WHERE holiday_date >= "2026-01-01" AND holiday_date <= "2026-12-31"
          ORDER BY holiday_date ASC`,
    params: () => [],
    iterations: 120,
    concurrency: 4
  },

  // ── 3. COMPLEX QUERIES (Multi-Join Enterprise Rollups, Roster Aggregations & Analytics) ──
  {
    tier: 'COMPLEX',
    id: 'C1_ORG_HIERARCHY_ROLLUP',
    name: 'Multi-Entity Organization & Headcount Aggregations',
    sql: `SELECT 
            c.id as company_id, c.short_name,
            d.id as dept_id, d.name as dept_name,
            COUNT(DISTINCT e.id) as total_employees,
            COUNT(DISTINCT CASE WHEN e.status = "Active" THEN e.id END) as active_employees,
            COUNT(DISTINCT CASE WHEN e.gender = "Female" THEN e.id END) as female_employees,
            COUNT(DISTINCT CASE WHEN e.employment_type_id = "ET_PERM" THEN e.id END) as permanent_employees
          FROM companies c
          JOIN departments d
          LEFT JOIN employees e ON (c.id = e.company_id AND d.name = e.department)
          GROUP BY c.id, c.short_name, d.id, d.name
          ORDER BY c.short_name ASC, total_employees DESC`,
    params: () => [],
    iterations: 40,
    concurrency: 2
  },
  {
    tier: 'COMPLEX',
    id: 'C2_ATTENDANCE_ANALYTICS_30D',
    name: '30-Day Attendance Analytics Rollup (156K+ records)',
    sql: `SELECT 
            a.dept,
            a.punch_date,
            COUNT(*) as total_punches,
            COUNT(DISTINCT a.emp_id) as unique_employees,
            SUM(CASE WHEN a.status = "PRESENT" THEN 1 ELSE 0 END) as present_count,
            SUM(CASE WHEN a.status = "LATE" THEN 1 ELSE 0 END) as late_count,
            SUM(CASE WHEN a.status = "ON_DUTY" THEN 1 ELSE 0 END) as od_count
          FROM attendance a
          WHERE a.punch_date >= "2026-09-01" AND a.punch_date <= "2026-09-20"
          GROUP BY a.dept, a.punch_date
          ORDER BY a.punch_date DESC, a.dept ASC`,
    params: () => [],
    iterations: 30,
    concurrency: 2
  },
  {
    tier: 'COMPLEX',
    id: 'C3_MONTHLY_ROSTER_GRID',
    name: 'Shift Roster 30-Day Matrix Schedule (284K+ slots)',
    sql: `SELECT 
            sr.roster_date,
            s.code as shift_code, s.color as shift_color,
            sr.scheduled_count,
            sr.total_employees
          FROM (
            SELECT roster_date, shift_id, COUNT(*) as scheduled_count, COUNT(DISTINCT emp_id) as total_employees
            FROM shift_roster
            WHERE roster_date BETWEEN "2026-09-01" AND "2026-09-30"
            GROUP BY roster_date, shift_id
          ) sr
          JOIN shifts s ON sr.shift_id = s.id
          ORDER BY sr.roster_date ASC, sr.scheduled_count DESC`,
    params: () => [],
    iterations: 35,
    concurrency: 2
  },
  {
    tier: 'COMPLEX',
    id: 'C4_EMP_360_FULL_PROFILE',
    name: 'Employee 360° Profile (Demographics + Transfers + Leave + OT)',
    sql: `SELECT 
            e.id, e.name, e.department, e.role, e.status,
            c.name as company_name, divn.name as division_name, cc.name as cost_center_name,
            b.name as branch_name, et.title as emp_type_name,
            (SELECT COUNT(*) FROM employee_transfers WHERE emp_id = e.id) as career_moves,
            (SELECT COALESCE(SUM(available_balance), 0) FROM employee_leave_balances WHERE emp_id = e.id AND financial_year = 2026) as total_leave_avail,
            (SELECT COUNT(*) FROM attendance WHERE emp_id = e.id) as total_punches_logged,
            (SELECT COALESCE(SUM(ot_hours), 0) FROM ot_records WHERE emp_id = e.id AND status = "APPROVED") as approved_ot_hours
          FROM employees e
          LEFT JOIN companies c ON e.company_id = c.id
          LEFT JOIN divisions divn ON e.division_id = divn.id
          LEFT JOIN cost_centers cc ON e.cost_center_id = cc.id
          LEFT JOIN branches b ON e.branch_id = b.id
          LEFT JOIN employment_types et ON e.employment_type_id = et.id
          WHERE e.id = ?`,
    params: () => ['EMP' + String(Math.floor(Math.random() * 5000) + 1).padStart(4, '0')],
    iterations: 40,
    concurrency: 3
  },
  {
    tier: 'COMPLEX',
    id: 'C5_DIVISIONS_COSTCENTERS_AGG',
    name: 'Enterprise Divisions & Cost Centers Relational Audit',
    sql: `SELECT 
            divn.code as division_code, divn.name as division_name,
            cc.code as cost_center_code, cc.name as cost_center_name,
            COUNT(DISTINCT e.id) as assigned_employees,
            AVG(CASE WHEN e.status = "Active" THEN 1 ELSE 0 END) * 100 as active_rate_pct
          FROM divisions divn
          LEFT JOIN employees e ON divn.id = e.division_id
          LEFT JOIN cost_centers cc ON e.cost_center_id = cc.id
          GROUP BY divn.code, divn.name, cc.code, cc.name
          ORDER BY assigned_employees DESC`,
    params: () => [],
    iterations: 40,
    concurrency: 2
  }
];

function calculatePercentiles(latencies) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.50)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
  const avg = sorted.reduce((a, b) => a + b, 0) / (sorted.length || 1);
  const min = sorted[0] || 0;
  const max = sorted[sorted.length - 1] || 0;
  return { min, max, avg, p50, p95, p99 };
}

function getPerformanceGrade(avgLatencyMs) {
  if (avgLatencyMs < 2.0) return '\x1b[32m[A+ EXCELLENT]\x1b[0m';
  if (avgLatencyMs < 8.0) return '\x1b[32m[A OPTIMAL]\x1b[0m';
  if (avgLatencyMs < 25.0) return '\x1b[33m[B GOOD]\x1b[0m';
  if (avgLatencyMs < 60.0) return '\x1b[33m[C MODERATE]\x1b[0m';
  return '\x1b[31m[D NEEDS OPTIMIZATION]\x1b[0m';
}

async function runSingleBenchmark(pool, test) {
  const latencies = [];
  let rowCount = 0;
  const totalQueries = test.iterations;
  const startTime = process.hrtime.bigint();

  const worker = async (batchCount) => {
    for (let i = 0; i < batchCount; i++) {
      const qParams = test.params();
      const qStart = process.hrtime.bigint();
      const [rows] = await pool.query(test.sql, qParams);
      const qEnd = process.hrtime.bigint();
      const durMs = Number(qEnd - qStart) / 1e6;
      latencies.push(durMs);
      if (rows && rows.length !== undefined) {
        rowCount = rows.length;
      }
    }
  };

  const concurrency = test.concurrency || 1;
  const perWorker = Math.ceil(totalQueries / concurrency);
  const workers = [];
  for (let c = 0; c < concurrency; c++) {
    workers.push(worker(perWorker));
  }
  await Promise.all(workers);

  const endTime = process.hrtime.bigint();
  const totalDurationSec = Number(endTime - startTime) / 1e9;
  const qps = latencies.length / (totalDurationSec || 0.001);
  const stats = calculatePercentiles(latencies);

  return {
    ...test,
    totalExecutions: latencies.length,
    totalDurationSec,
    qps,
    rowCount,
    stats
  };
}

async function runExplainPlan(pool, test) {
  try {
    const qParams = test.params();
    const [explain] = await pool.query(`EXPLAIN ${test.sql}`, qParams);
    return explain.map(r => ({
      table: r.table,
      type: r.type,
      possible_keys: r.possible_keys,
      key: r.key,
      rows: r.rows,
      filtered: r.filtered,
      extra: r.Extra
    }));
  } catch (err) {
    return [{ error: err.message }];
  }
}

async function main() {
  console.log('\n========================================================================');
  console.log('   SOUKHYA ENTERPRISE — MYSQL 8.4 LTS DATABASE BENCHMARK SUITE');
  console.log('   Dataset: 10,100 Employees | 156,000+ Attendance | 284,000+ Roster Slots');
  console.log('========================================================================\n');

  const pool = mysql.createPool(DB_CONFIG);

  try {
    const [dbInfo] = await pool.query('SELECT VERSION() as version, DATABASE() as db_name, @@innodb_buffer_pool_size / 1024 / 1024 as buffer_pool_mb');
    console.log(`[DB Engine] MySQL Version: ${dbInfo[0].version} | Database: ${dbInfo[0].db_name} | Buffer Pool: ${dbInfo[0].buffer_pool_mb} MB\n`);

    const results = [];
    let currentTier = '';

    for (const test of BENCHMARK_SUITES) {
      if (test.tier !== currentTier) {
        currentTier = test.tier;
        console.log(`\n─── [TIER: ${currentTier} QUERIES] ───────────────────────────────────────────────`);
      }

      process.stdout.write(` Running ${test.id.padEnd(26)} : ${test.name.padEnd(52)} `);
      const res = await runSingleBenchmark(pool, test);
      results.push(res);

      const grade = getPerformanceGrade(res.stats.avg);
      console.log(`-> Avg: ${res.stats.avg.toFixed(2).padStart(6)} ms | P95: ${res.stats.p95.toFixed(2).padStart(6)} ms | QPS: ${Math.round(res.qps).toString().padStart(5)} ${grade}`);
    }

    // ── SUMMARY REPORT ──
    console.log('\n========================================================================');
    console.log('                 DATABASE BENCHMARK EXECUTION SUMMARY');
    console.log('========================================================================');
    console.log(' ID                  | Query Name                           | Avg (ms) | P50 (ms) | P95 (ms) | QPS     | Grade');
    console.log('---------------------+--------------------------------------+----------+----------+----------+---------+------------');
    for (const r of results) {
      const id = r.id.padEnd(20);
      const name = (r.name.length > 36 ? r.name.slice(0, 33) + '...' : r.name).padEnd(36);
      const avg = r.stats.avg.toFixed(2).padStart(8);
      const p50 = r.stats.p50.toFixed(2).padStart(8);
      const p95 = r.stats.p95.toFixed(2).padStart(8);
      const qps = Math.round(r.qps).toString().padStart(7);
      const grade = getPerformanceGrade(r.stats.avg);
      console.log(` ${id}| ${name} | ${avg} | ${p50} | ${p95} | ${qps} | ${grade}`);
    }
    console.log('========================================================================\n');

    const totalOps = results.reduce((a, b) => a + b.totalExecutions, 0);
    const overallAvg = results.reduce((a, b) => a + b.stats.avg, 0) / results.length;
    console.log(`[Summary] Total Executed Benchmark Queries: ${totalOps.toLocaleString()} queries`);
    console.log(`[Summary] Overall Average Query Latency  : ${overallAvg.toFixed(2)} ms`);
    console.log(`[Summary] Database Performance Rating    : ${getPerformanceGrade(overallAvg)}\n`);

  } catch (err) {
    console.error('[BENCHMARK ERROR]', err);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}

module.exports = { BENCHMARK_SUITES, runSingleBenchmark, runExplainPlan };
