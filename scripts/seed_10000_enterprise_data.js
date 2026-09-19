#!/usr/bin/env node
/**
 * scripts/seed_10000_enterprise_data.js — High-Performance 10,000 Indian Employee & Multi-Tab Data Ingestion
 * Max file limit: < 500 lines
 */

const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const MySQLAdapter = require('../database/mysql_adapter');
const mysqlAdapter = new MySQLAdapter();

const PII_ENCRYPTION_KEY = process.env.PII_ENCRYPTION_KEY || '0673da2e3102f4ad23371a5c507736ee68f9bda316ec0e99ff9b883cc07b5693';

function encryptPii(plaintext) {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(PII_ENCRYPTION_KEY, 'hex'), iv);
  let enc = cipher.update(String(plaintext), 'utf8', 'hex') + cipher.final('hex');
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc}`;
}

const MALE_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Reyansh', 'Muhammad', 'Sai', 'Ayaan', 'Krishna',
  'Ishan', 'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Advaith', 'Aryan', 'Dhruv', 'Kabir', 'Ritvik',
  'Aarush', 'Kian', 'Darsh', 'Veer', 'Harsh', 'Dev', 'Rishi', 'Ansh', 'Parth', 'Ranveer',
  'Rajesh', 'Suresh', 'Ramesh', 'Ganesh', 'Venkatesh', 'Karthik', 'Murali', 'Balaji', 'Sundar', 'Prakash',
  'Vijay', 'Ajith', 'Suriya', 'Madhavan', 'Naveen', 'Chetan', 'Raghu', 'Vinay', 'Deepak', 'Sandeep',
  'Manoj', 'Amit', 'Sumit', 'Rahul', 'Rohit', 'Sachin', 'Virat', 'Alok', 'Sanjay', 'Sunil'
];

const FEMALE_NAMES = [
  'Ananya', 'Diya', 'Sanvi', 'Aadhya', 'Kiara', 'Pari', 'Saanvi', 'Fatima', 'Myra', 'Samaira',
  'Riya', 'Anaya', 'Navya', 'Trisha', 'Avani', 'Siya', 'Yashvi', 'Shruti', 'Tanvi', 'Prisha',
  'Ira', 'Ahana', 'Anvi', 'Kavya', 'Pooja', 'Priya', 'Divya', 'Sneha', 'Neha', 'Swati',
  'Rashmi', 'Deepa', 'Shweta', 'Archana', 'Sunita', 'Geetha', 'Lakshmi', 'Sowmya', 'Shilpa', 'Meghana',
  'Pavithra', 'Roopa', 'Nandini', 'Meera', 'Priyanka', 'Bhavana', 'Vidya', 'Kavitha', 'Sangeetha', 'Asha'
];

const SURNAMES = [
  'Sharma', 'Iyer', 'Patel', 'Rao', 'Deshmukh', 'Reddy', 'Nair', 'Mukherjee', 'Verma', 'Kulkarni',
  'Gupta', 'Joshi', 'Hegde', 'Bhatt', 'Chatterjee', 'Banerjee', 'Das', 'Roy', 'Bose', 'Sen',
  'Ghosh', 'Mishra', 'Pandey', 'Tiwari', 'Shukla', 'Dubey', 'Trivedi', 'Chauhan', 'Rajput', 'Singh',
  'Yadav', 'Kumar', 'Prasad', 'Patil', 'Shinde', 'Jadhav', 'Pawar', 'Sawant', 'Shetty', 'Kamath',
  'Bhat', 'Acharya', 'Gowda', 'Urs', 'Menon', 'Pillai', 'Nambiar', 'Varma', 'Kurian', 'George'
];

const COMPANIES = [
  { id: 'COMP_KRIDE', code: 'KRIDE', name: 'Rail Infrastructure Development Company (Karnataka) Ltd', short_name: 'KRIDE', domain: 'kride.in' },
  { id: 'COMP_BMRCL', code: 'BMRCL', name: 'Bangalore Metro Rail Corporation Limited', short_name: 'BMRCL', domain: 'bmrc.co.in' },
  { id: 'COMP_SOUKHYA', code: 'SOUKHYA', name: 'Soukhya Tech Solutions Ltd.', short_name: 'SOUKHYA', domain: 'soukhyatech.com' },
  { id: 'COMP_INFOPARK', code: 'INFOPARK', name: 'Infopark IT Enterprises Ltd.', short_name: 'INFOPARK', domain: 'infoparkit.in' }
];

const DEPARTMENTS = [
  { id: 'DEP_ENG', code: 'ENG', name: 'Engineering & Product', division: 'Technology', designations: ['DES_SE', 'DES_SSE', 'DES_TL', 'DES_ARCH'] },
  { id: 'DEP_OPS', code: 'OPS', name: '24x7 Operations & Support', division: 'Operations', designations: ['DES_OPSE', 'DES_OPSL'] },
  { id: 'DEP_IT', code: 'IT', name: 'IT Infrastructure & SecOps', division: 'Technology', designations: ['DES_SYSADMIN', 'DES_SECOPS'] },
  { id: 'DEP_SALES', code: 'SALES', name: 'Sales & Marketing', division: 'Commercial', designations: ['DES_SEM', 'DES_SDIR'] },
  { id: 'DEP_FIN', code: 'FIN', name: 'Finance & Accounts', division: 'Corporate', designations: ['DES_ACC', 'DES_FINM'] },
  { id: 'DEP_HR', code: 'HR', name: 'Human Resources', division: 'Corporate', designations: ['DES_HRE', 'DES_HRM'] }
];

const BRANCHES = [
  { id: 'BR_HQ', code: 'BLR_HQ', name: 'Bangalore Corporate Headquarters', location: 'Bangalore HQ', geofence_id: 'GEO_HQ' },
  { id: 'BR_WFD', code: 'WFD_PARK', name: 'Whitefield SEZ Tech Center', location: 'Whitefield Campus', geofence_id: 'GEO_WFD' },
  { id: 'BR_MYS', code: 'MYS_PLANT', name: 'Mysore Development & Hardware Center', location: 'Mysore R&D Center', geofence_id: 'GEO_MYS' },
  { id: 'BR_REM', code: 'REMOTE_FIELD', name: 'Field & Client Sites', location: 'Field Client Site', geofence_id: 'GEO_REMOTE' }
];

const SHIFTS = ['SHIFT_GEN', 'SHIFT_MOR', 'SHIFT_EVE', 'SHIFT_NIT'];
const LEAVE_TYPES = ['LT_CL', 'LT_SL', 'LT_EL', 'LT_ML', 'LT_CO', 'LT_PL', 'LT_LWP'];

function mockEmbedding(seed) {
  const v = [];
  let s = 0;
  for (let i = 0; i < 128; i++) {
    const val = (Math.sin(seed * (i + 1)) * 10000) % 1;
    v.push(val);
    s += val * val;
  }
  const norm = Math.sqrt(s) || 1;
  return v.map(x => parseFloat((x / norm).toFixed(4)));
}

async function seed10KEnterprise() {
  console.log('============================================================');
  console.log(' SOUKHYA TECH — Seeding 10,000 Indian Employees & Full Data ');
  console.log('============================================================');
  const t0 = Date.now();
  const pool = await mysqlAdapter.getPool();

  // 1. Employees (10,000)
  console.log('[1/8] Generating 10,000 Indian Employee Master Records...');
  const employees = [];
  for (let i = 1; i <= 10000; i++) {
    const empId = `EMP${String(i).padStart(4, '0')}`;
    const isMale = i % 2 === 0;
    const fNameList = isMale ? MALE_NAMES : FEMALE_NAMES;
    const fName = fNameList[i % fNameList.length];
    const sName = SURNAMES[(i * 3 + Math.floor(i / 50)) % SURNAMES.length];
    const fullName = `${fName} ${sName}`;
    const comp = COMPANIES[i % COMPANIES.length];
    const dept = DEPARTMENTS[i % DEPARTMENTS.length];
    const desId = dept.designations[i % dept.designations.length];
    const branch = BRANCHES[i % BRANCHES.length];
    const shiftId = SHIFTS[i % SHIFTS.length];

    let status = 'Active';
    if (i % 100 >= 94 && i % 100 < 97) status = 'On Leave';
    else if (i % 100 >= 97 && i % 100 < 99) status = 'Hibernate';
    else if (i % 100 === 99) status = 'Resigned';

    const piiEmail = `${fName.toLowerCase()}.${sName.toLowerCase()}.${i}@${comp.domain}`;
    const piiPhone = `+91 98${String((i * 7349 + 1234567) % 100000000).padStart(8, '0')}`;
    const piiAadhaar = `${1000 + (i % 9000)}-${2000 + (i % 8000)}-${String(i).padStart(4, '0')}`;
    const piiPan = `ABCDE`[i % 5] + `P${sName[0] || 'K'}${fName[0] || 'A'}N${1000 + (i % 9000)}Z`;
    const piiCard = `CRD-${String(i).padStart(5, '0')}`;
    const descriptor = mockEmbedding(i);
    const descHash = crypto.createHash('sha256').update(JSON.stringify(descriptor)).digest('hex');

    employees.push({
      id: empId, name: fullName, department: dept.name, role: desId.replace('DES_', ''),
      descriptor, descriptor_hash: descHash, status, company: comp.short_name,
      company_id: comp.id, department_id: dept.id, designation_id: desId,
      branch_id: branch.id, primary_shift_id: shiftId, geofence_id: branch.geofence_id,
      gender: isMale ? 'Male' : 'Female', date_of_joining: `202${(i % 5) + 1}-0${(i % 9) + 1}-15`,
      aadhaar_number: encryptPii(piiAadhaar), pan_number: encryptPii(piiPan),
      card_number: encryptPii(piiCard), phone_no: encryptPii(piiPhone), email: encryptPii(piiEmail),
      reporting_to: i > 25 ? `EMP${String((i % 25) + 1).padStart(4, '0')}` : 'EMP0001',
      device_code: `DEV_${branch.code}_01`, division: dept.division, grade: `L${(i % 5) + 1}`,
      team: `Team-${dept.code}-${(i % 4) + 1}`, location: branch.location,
      employment_type: 'Permanent / Full-Time', category: 'General Workforce'
    });
  }

  await mysqlAdapter.bulkInsertEmployees(employees, 500);
  console.log('   [OK] 10,000 Employees inserted & synced');

  // 2. Attendance Logs (25,000)
  console.log('[2/8] Generating 25,000+ Attendance Check-In/Out Records...');
  const attRows = [];
  const now = new Date();
  for (let d = 25; d >= 0; d--) {
    const dayDate = new Date(now.getTime() - d * 24 * 3600 * 1000);
    const dateStr = dayDate.toISOString().slice(0, 10);
    for (let e = 1; e <= 1000; e++) {
      const emp = employees[e - 1];
      const isLate = (e + d) % 7 === 0;
      const hourIn = isLate ? '09:42:15' : '08:58:30';
      attRows.push(`('${emp.id}', '${emp.name.replace(/'/g, "''")}', '${emp.department}', '${emp.role}', '${dateStr} ${hourIn}', '${isLate ? 'Late' : 'Present'}', 'Edge Biometric Terminal 01', '192.168.10.${(e % 200) + 1}', 'eSSL Face Scanner', NOW())`);
    }
  }
  for (let c = 0; c < attRows.length; c += 2000) {
    const chunk = attRows.slice(c, c + 2000);
    await pool.query(`INSERT INTO attendance (emp_id, name, dept, role, timestamp, status, logged_by, ip_address, user_agent, created_at) VALUES ${chunk.join(', ')}`);
  }
  console.log(`   [OK] ${attRows.length} Attendance records inserted`);

  // 3. Shift Roster (10,000)
  console.log('[3/8] Generating 10,000 Shift Roster Slots...');
  const monthStr = now.toISOString().slice(0, 7);
  await mysqlAdapter.autoGenerateMonthlyRoster({ monthStr });
  console.log('   [OK] Monthly shift roster generated for active employees');

  // 4. Overtime Register (1,500)
  console.log('[4/8] Generating 1,500+ Overtime Register Records...');
  const otRows = [];
  for (let i = 1; i <= 1500; i++) {
    const emp = employees[i % employees.length];
    const otDate = `2026-09-${String((i % 28) + 1).padStart(2, '0')}`;
    const otHours = 1.5 + ((i % 5) * 0.5);
    const status = i % 10 < 7 ? 'APPROVED' : (i % 10 < 9 ? 'PENDING' : 'REJECTED');
    otRows.push(`('${emp.id}', '${otDate}', '${emp.primary_shift_id}', 8.00, ${8 + otHours}, ${otHours}, 1.50, 'STANDARD_DAY', '${status}', 'Manager approved OT for delivery milestone', NOW(), NOW())`);
  }
  for (let c = 0; c < otRows.length; c += 500) {
    const chunk = otRows.slice(c, c + 500);
    await pool.query(`INSERT INTO ot_records (emp_id, ot_date, shift_id, scheduled_hours, actual_hours, ot_hours, ot_multiplier, ot_rate_type, status, comments, created_at, updated_at) VALUES ${chunk.join(', ')} ON DUPLICATE KEY UPDATE ot_hours = VALUES(ot_hours), status = VALUES(status), updated_at = NOW()`);
  }
  console.log('   [OK] 1,500 OT records inserted');

  // 5. Leave Applications (2,000)
  console.log('[5/8] Generating 2,000+ Leave Ledger Entries...');
  const leaveRows = [];
  for (let i = 1; i <= 2000; i++) {
    const emp = employees[i % employees.length];
    const lt = LEAVE_TYPES[i % LEAVE_TYPES.length];
    const sDate = `2026-09-${String((i % 25) + 1).padStart(2, '0')}`;
    const eDate = `2026-09-${String((i % 25) + 3).padStart(2, '0')}`;
    const status = i % 10 < 8 ? 'APPROVED' : (i % 10 < 9 ? 'PENDING' : 'REJECTED');
    leaveRows.push(`('${emp.id}', '${lt}', '${sDate}', '${eDate}', 2.00, 'Personal work / Medical appointment', '${status}', 'Approved by department head', NOW(), NOW())`);
  }
  for (let c = 0; c < leaveRows.length; c += 500) {
    const chunk = leaveRows.slice(c, c + 500);
    await pool.query(`INSERT INTO employee_leave_entries (emp_id, leave_type_id, start_date, end_date, total_days, reason, status, comments, created_at, updated_at) VALUES ${chunk.join(', ')}`);
  }
  console.log('   [OK] 2,000 Leave entries inserted');

  // 6. Outdoor (OD) Entries (1,000)
  console.log('[6/8] Generating 1,000+ Outdoor Duty Records...');
  const odRows = [];
  for (let i = 1; i <= 1000; i++) {
    const emp = employees[i % employees.length];
    const odDate = `2026-09-${String((i % 28) + 1).padStart(2, '0')}`;
    const status = i % 10 < 8 ? 'APPROVED' : 'PENDING';
    odRows.push(`('${emp.id}', '${odDate}', '09:30:00', '17:30:00', 'Client Campus Site / Field Deployment', 'Onsite client installation & validation', 1, '${status}', 'Approved for travel allowance', NOW(), NOW())`);
  }
  for (let c = 0; c < odRows.length; c += 500) {
    const chunk = odRows.slice(c, c + 500);
    await pool.query(`INSERT INTO employee_outdoor_entries (emp_id, od_date, start_time, end_time, destination_client, purpose, travel_allowance_eligible, status, comments, created_at, updated_at) VALUES ${chunk.join(', ')}`);
  }
  console.log('   [OK] 1,000 Outdoor duty records inserted');

  // 7. Career Transfers (500) & Fast Buffer (2,000)
  console.log('[7/8] Generating 500+ Transfers & 2,000+ Fast Punch Buffer Streams...');
  const transRows = [];
  for (let i = 1; i <= 500; i++) {
    const emp = employees[i % employees.length];
    transRows.push(`('${emp.id}', 'COMP_KRIDE', 'COMP_KRIDE', 'DEP_ENG', 'DEP_ENG', 'DES_SE', 'DES_SSE', 'BR_HQ', 'BR_HQ', 'PROMOTION', '2026-09-01', 'Annual merit promotion based on high performance', 'Admin', NOW())`);
  }
  await pool.query(`INSERT INTO employee_transfers (emp_id, prev_company_id, new_company_id, prev_dept_id, new_dept_id, prev_desig_id, new_desig_id, prev_branch_id, new_branch_id, transfer_type, effective_date, remarks, approved_by, created_at) VALUES ${transRows.join(', ')}`);

  const bufRows = [];
  for (let i = 1; i <= 2000; i++) {
    const emp = employees[i % employees.length];
    bufRows.push(`('${emp.id}', 'DEV_BLR_HQ_01', NOW(), 'CHECK_IN', 'FACE', 36.6, 1, 1, 1.85, NOW())`);
  }
  await pool.query(`INSERT INTO fast_punch_buffer (emp_id, terminal_id, punch_timestamp, punch_state, verification_type, temperature, mask_detected, processed, process_latency_ms, created_at) VALUES ${bufRows.join(', ')}`);
  console.log('   [OK] 500 Transfers & 2,000 Fast Punch records inserted');

  // 8. Audit Logs (5,000)
  console.log('[8/8] Generating 5,000+ Structured Audit Trail Events...');
  const auditRows = [];
  for (let i = 1; i <= 5000; i++) {
    const emp = employees[i % employees.length];
    auditRows.push(`('employees', '${emp.id}', 'UPDATE', '{"status":"Active"}', '{"status":"Active","synced":true}', 'admin', '127.0.0.1', 'Audit Pipeline Runner', NOW())`);
  }
  for (let c = 0; c < auditRows.length; c += 1000) {
    const chunk = auditRows.slice(c, c + 1000);
    await pool.query(`INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, performed_by, ip_address, user_agent, performed_at) VALUES ${chunk.join(', ')}`);
  }
  console.log('   [OK] 5,000 Audit log events inserted');

  const dur = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`\n[COMPLETE] 10,000 Employees & Full Enterprise Relational Data Populated in ${dur}s!`);
  process.exit(0);
}

seed10KEnterprise().catch(e => {
  console.error('[SEED FATAL]', e);
  process.exit(1);
});
