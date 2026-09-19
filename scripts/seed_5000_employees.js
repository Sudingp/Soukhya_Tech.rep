#!/usr/bin/env node
/**
 * scripts/seed_5000_employees.js — High-Performance 5,000 Indian Employee Seeder
 * Normalized 3NF Relational Architecture (MySQL 8.4 LTS / MariaDB)
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const MySQLAdapter = require('../database/mysql_adapter');
const mysqlAdapter = new MySQLAdapter();

const PII_ENCRYPTION_KEY = process.env.PII_ENCRYPTION_KEY || '0673da2e3102f4ad23371a5c507736ee68f9bda316ec0e99ff9b883cc07b5693';

function encryptPii(plaintext) {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(PII_ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(String(plaintext), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

// ── Realistic Indian Name Dictionaries ──
const MALE_FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Reyansh', 'Muhammad', 'Sai', 'Ayaan', 'Krishna',
  'Ishan', 'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Advaith', 'Aryan', 'Dhruv', 'Kabir', 'Ritvik',
  'Aarush', 'Kian', 'Darsh', 'Veer', 'Harsh', 'Dev', 'Rishi', 'Ansh', 'Parth', 'Ranveer',
  'Rajesh', 'Suresh', 'Ramesh', 'Ganesh', 'Venkatesh', 'Karthik', 'Murali', 'Balaji', 'Sundar', 'Prakash',
  'Vijay', 'Ajith', 'Suriya', 'Madhavan', 'Naveen', 'Chetan', 'Raghu', 'Vinay', 'Deepak', 'Sandeep',
  'Manoj', 'Amit', 'Sumit', 'Rahul', 'Rohit', 'Sachin', 'Virat', 'Alok', 'Sanjay', 'Sunil',
  'Harish', 'Giridhar', 'Lokesh', 'Pradeep', 'Anand', 'Ashok', 'Manjunath', 'Nagaraj', 'Shiva', 'Prashanth',
  'Abhishek', 'Varun', 'Siddharth', 'Nikhil', 'Gaurav', 'Manish', 'Rohan', 'Tanmay', 'Akash', 'Mayank'
];

const FEMALE_FIRST_NAMES = [
  'Ananya', 'Diya', 'Sanvi', 'Aadhya', 'Kiara', 'Pari', 'Saanvi', 'Fatima', 'Myra', 'Samaira',
  'Riya', 'Anaya', 'Navya', 'Trisha', 'Avani', 'Siya', 'Yashvi', 'Shruti', 'Tanvi', 'Prisha',
  'Ira', 'Ahana', 'Anvi', 'Kavya', 'Pooja', 'Priya', 'Divya', 'Sneha', 'Neha', 'Swati',
  'Rashmi', 'Deepa', 'Shweta', 'Archana', 'Sunita', 'Geetha', 'Lakshmi', 'Sowmya', 'Shilpa', 'Meghana',
  'Pavithra', 'Roopa', 'Nandini', 'Meera', 'Priyanka', 'Bhavana', 'Vidya', 'Kavitha', 'Sangeetha', 'Asha',
  'Sandhya', 'Vani', 'Anitha', 'Shalini', 'Nisha', 'Radha', 'Ranjini', 'Anuradha', 'Monika', 'Kritika',
  'Ipsita', 'Pallavi', 'Ritu', 'Simran', 'Tanushree', 'Chhavi', 'Juhi', 'Namrata', 'Apeksha', 'Garima'
];

const SURNAMES = [
  'Sharma', 'Iyer', 'Patel', 'Rao', 'Deshmukh', 'Reddy', 'Nair', 'Mukherjee', 'Verma', 'Kulkarni',
  'Gupta', 'Joshi', 'Hegde', 'Bhatt', 'Chatterjee', 'Banerjee', 'Das', 'Roy', 'Bose', 'Sen',
  'Ghosh', 'Mishra', 'Pandey', 'Tiwari', 'Shukla', 'Dubey', 'Trivedi', 'Chauhan', 'Rajput', 'Singh',
  'Yadav', 'Kumar', 'Prasad', 'Patil', 'Shinde', 'Jadhav', 'Pawar', 'Sawant', 'Shetty', 'Kamath',
  'Bhat', 'Acharya', 'Gowda', 'Urs', 'Menon', 'Pillai', 'Nambiar', 'Varma', 'Kurian', 'George',
  'Thomas', 'Fernandes', 'DSouza', 'Lobo', 'Pereira', 'Naidu', 'Choudhary', 'Agarwal', 'Bansal', 'Saxena',
  'Srivastava', 'Bhardwaj', 'Malhotra', 'Kapoor', 'Khanna', 'Bhatia', 'Chawla', 'Arora', 'Mehta', 'Shah'
];

// ── Master Entities & Configurations ──
const COMPANIES = [
  { id: 'COMP_KRIDE', code: 'KRIDE', name: 'Rail Infrastructure Development Company (Karnataka) Ltd', short_name: 'KRIDE', domain: 'kride.in' },
  { id: 'COMP_BMRCL', code: 'BMRCL', name: 'Bangalore Metro Rail Corporation Limited', short_name: 'BMRCL', domain: 'bmrc.co.in' },
  { id: 'COMP_SOUKHYA', code: 'SOUKHYA', name: 'Soukhya Tech Solutions Ltd.', short_name: 'SOUKHYA', domain: 'soukhyatech.com' },
  { id: 'COMP_INFOPARK', code: 'INFOPARK', name: 'Infopark IT Enterprises Ltd.', short_name: 'INFOPARK', domain: 'infoparkit.in' }
];

const DEPARTMENTS = [
  {
    id: 'DEP_ENG', code: 'ENG', name: 'Engineering & Product', division: 'Technology',
    designations: [
      { id: 'DES_SE', code: 'SE', name: 'Software Engineer', role: 'Software Engineer', grade: 'L1' },
      { id: 'DES_SSE', code: 'SSE', name: 'Senior Software Engineer', role: 'Senior Software Engineer', grade: 'L2' },
      { id: 'DES_TL', code: 'TL', name: 'Technical Lead', role: 'Technical Lead', grade: 'L3' },
      { id: 'DES_ARCH', code: 'ARCH', name: 'Principal Architect', role: 'Principal Architect', grade: 'L4' }
    ]
  },
  {
    id: 'DEP_OPS', code: 'OPS', name: '24x7 Operations & Support', division: 'Operations',
    designations: [
      { id: 'DES_OPSE', code: 'OPSE', name: 'Operations Executive', role: 'Operations Executive', grade: 'L1' },
      { id: 'DES_OPSL', code: 'OPSL', name: 'Operations Lead', role: 'Operations Lead', grade: 'L3' }
    ]
  },
  {
    id: 'DEP_IT', code: 'IT', name: 'IT Infrastructure & SecOps', division: 'Technology',
    designations: [
      { id: 'DES_SYSADMIN', code: 'SYSADMIN', name: 'Lead Systems Administrator', role: 'Lead Systems Administrator', grade: 'L3' },
      { id: 'DES_SECOPS', code: 'SECOPS', name: 'SecOps & Security Analyst', role: 'SecOps & Security Analyst', grade: 'L2' }
    ]
  },
  {
    id: 'DEP_SALES', code: 'SALES', name: 'Sales & Marketing', division: 'Commercial',
    designations: [
      { id: 'DES_SEM', code: 'SEM', name: 'Sales Executive', role: 'Sales Executive', grade: 'L1' },
      { id: 'DES_SDIR', code: 'SDIR', name: 'Sales Director', role: 'Sales Director', grade: 'L5' }
    ]
  },
  {
    id: 'DEP_FIN', code: 'FIN', name: 'Finance & Accounts', division: 'Corporate',
    designations: [
      { id: 'DES_ACC', code: 'ACC', name: 'Senior Accountant', role: 'Senior Accountant', grade: 'L2' },
      { id: 'DES_FINM', code: 'FINM', name: 'Finance Manager', role: 'Finance Manager', grade: 'L3' }
    ]
  },
  {
    id: 'DEP_HR', code: 'HR', name: 'Human Resources', division: 'Corporate',
    designations: [
      { id: 'DES_HRE', code: 'HRE', name: 'HR Executive', role: 'HR Executive', grade: 'L1' },
      { id: 'DES_HRM', code: 'HRM', name: 'HR Manager', role: 'HR Manager', grade: 'L3' }
    ]
  }
];

const BRANCHES = [
  { id: 'BR_HQ', code: 'BLR_HQ', name: 'Bangalore Corporate Headquarters', location: 'Bangalore HQ', geofence_id: 'GEO_HQ', geofence: 'BLR_HQ' },
  { id: 'BR_WFD', code: 'WFD_PARK', name: 'Whitefield SEZ Tech Center', location: 'Whitefield Campus', geofence_id: 'GEO_WFD', geofence: 'WFD_PARK' },
  { id: 'BR_MYS', code: 'MYS_PLANT', name: 'Mysore Development & Hardware Center', location: 'Mysore R&D Center', geofence_id: 'GEO_MYS', geofence: 'MYS_PLANT' },
  { id: 'BR_REM', code: 'REMOTE_FIELD', name: 'Field & Client Sites', location: 'Field Client Site', geofence_id: 'GEO_REMOTE', geofence: 'FIELD_SALES' }
];

const EMPLOYMENT_TYPES = [
  { id: 'ET_PERM', code: 'PERM', title: 'Permanent / Full-Time' },
  { id: 'ET_PROB', code: 'PROB', title: 'Probationary Staff' },
  { id: 'ET_CONT', code: 'CONT', title: 'Fixed-Term Contract' },
  { id: 'ET_INTR', code: 'INTR', title: 'Intern / Trainee' }
];

const SHIFTS = [
  { id: 'SHIFT_GEN', name: 'General Day Shift' },
  { id: 'SHIFT_MOR', name: 'Morning Early Shift' },
  { id: 'SHIFT_EVE', name: 'Evening Afternoon Shift' },
  { id: 'SHIFT_NIT', name: 'Night Overnight Shift' }
];

function generateMockEmbedding(seed) {
  const vector = [];
  let sumSq = 0;
  for (let i = 0; i < 128; i++) {
    const val = (Math.sin(seed * (i + 1)) * 10000) % 1;
    vector.push(val);
    sumSq += val * val;
  }
  const norm = Math.sqrt(sumSq) || 1;
  return vector.map(v => parseFloat((v / norm).toFixed(4)));
}

async function seedEmployees(targetCount = 5000) {
  console.log('============================================================');
  console.log(` Soukhya Tech — Seeding ${targetCount} Realistic Indian Employees (3NF)`);
  console.log('============================================================');

  const startTime = Date.now();
  const pool = await mysqlAdapter.getPool();

  console.log('[1/3] Generating synthetic 3NF employee records...');
  const records = [];

  for (let i = 1; i <= targetCount; i++) {
    const empId = `EMP${String(i).padStart(4, '0')}`;
    const isMale = i % 2 === 0;
    const firstNameList = isMale ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES;
    const firstName = firstNameList[i % firstNameList.length];
    const surname = SURNAMES[(i * 3 + Math.floor(i / 70)) % SURNAMES.length];
    const fullName = `${firstName} ${surname}`;
    const gender = isMale ? 'Male' : 'Female';

    // Company distribution: KRIDE 40%, BMRCL 30%, SOUKHYA 20%, INFOPARK 10%
    const compIdx = i % 10 < 4 ? 0 : (i % 10 < 7 ? 1 : (i % 10 < 9 ? 2 : 3));
    const comp = COMPANIES[compIdx];

    // Department distribution: ENG 40%, OPS 25%, IT 15%, SALES 10%, FIN 5%, HR 5%
    const mod100 = i % 100;
    let deptIdx = 0;
    if (mod100 < 40) deptIdx = 0; // ENG
    else if (mod100 < 65) deptIdx = 1; // OPS
    else if (mod100 < 80) deptIdx = 2; // IT
    else if (mod100 < 90) deptIdx = 3; // SALES
    else if (mod100 < 95) deptIdx = 4; // FIN
    else deptIdx = 5; // HR
    const dept = DEPARTMENTS[deptIdx];

    // Designation within department
    const desIdx = (i % dept.designations.length);
    const des = dept.designations[desIdx];

    // Branch: HQ 60%, WFD 25%, MYS 15%
    const brIdx = (i % 20 < 12) ? 0 : ((i % 20 < 17) ? 1 : 2);
    const branch = BRANCHES[brIdx];

    // Employment Type: PERM 80%, PROB 10%, CONT 8%, INTR 2%
    const etIdx = (i % 50 < 40) ? 0 : ((i % 50 < 45) ? 1 : ((i % 50 < 49) ? 2 : 3));
    const empType = EMPLOYMENT_TYPES[etIdx];

    // Shift: General 70%, Morning 15%, Evening 10%, Night 5% (OPS/IT get more night/mor)
    let shiftIdx = 0;
    if (dept.code === 'OPS' || dept.code === 'IT') {
      shiftIdx = i % 4; // 24x7 rotation
    } else {
      shiftIdx = (i % 10 < 7) ? 0 : ((i % 10 < 9) ? 1 : 2);
    }
    const shift = SHIFTS[shiftIdx];

    // Status: Active 92%, On Leave 4%, Hibernate 2%, Resigned 2%
    let status = 'Active';
    const stMod = i % 100;
    if (stMod >= 92 && stMod < 96) status = 'On Leave';
    else if (stMod >= 96 && stMod < 98) status = 'Hibernate';
    else if (stMod >= 98) status = 'Resigned';

    // PII Fields
    const emailPlain = `${firstName.toLowerCase()}.${surname.toLowerCase()}.${i}@${comp.domain}`;
    const phonePlain = `+91 98${String((i * 7349 + 1234567) % 100000000).padStart(8, '0')}`;
    const aadhaarPlain = `${String((i * 9871 + 1000) % 9000 + 1000)}-${String((i * 5431 + 2000) % 9000 + 1000)}-${String(i).padStart(4, '0')}`;
    const panChars = 'ABCDE';
    const panPlain = `${panChars[i % 5]}P${surname[0] || 'K'}${firstName[0] || 'A'}N${String(1000 + (i % 9000))}Z`;
    const cardPlain = `CRD-${String(i).padStart(5, '0')}`;

    // 128D Embedding & SHA-256 Descriptor Hash
    const descriptor = generateMockEmbedding(i);
    const descriptorHash = crypto.createHash('sha256').update(JSON.stringify(descriptor)).digest('hex');

    records.push({
      id: empId,
      name: fullName,
      department: dept.name,
      role: des.role,
      descriptor: descriptor,
      descriptor_hash: descriptorHash,
      image: null,
      status: status,
      hibernate_start_date: status === 'Hibernate' ? '2026-01-01' : null,
      hibernate_end_date: status === 'Hibernate' ? '2026-06-30' : null,
      hibernate_reason: status === 'Hibernate' ? 'Extended Medical Leave / Sabbatical' : null,
      company: comp.short_name,
      company_id: comp.id,
      department_id: dept.id,
      designation: des.name,
      designation_id: des.id,
      branch_id: branch.id,
      employment_type_id: empType.id,
      primary_shift_id: shift.id,
      geofence_id: branch.geofence_id,
      gender: gender,
      date_of_joining: `202${(i % 5) + 1}-0${(i % 9) + 1}-15`,
      date_of_confirmation: `202${(i % 5) + 1}-0${(i % 9) + 1}-15`,
      last_working_day: status === 'Resigned' ? '2026-03-31' : null,
      aadhaar_number: encryptPii(aadhaarPlain),
      pan_number: encryptPii(panPlain),
      card_number: encryptPii(cardPlain),
      phone_no: encryptPii(phonePlain),
      email: encryptPii(emailPlain),
      reporting_to: i > 20 ? `EMP${String((i % 20) + 1).padStart(4, '0')}` : 'EMP0001',
      device_code: `DEV_${branch.code}_01`,
      sub_department: des.grade.startsWith('L1') ? 'Core Operations' : 'Leadership & Architecture',
      division: dept.division,
      grade: des.grade,
      team: `Team-${dept.code}-${(i % 4) + 1}`,
      location: branch.location,
      employment_type: empType.title,
      category: 'General Workforce',
      holiday_group: 'Karnataka State Gazette',
      shift_group: 'Corporate General Working Group',
      shift_roster: 'Standard Monthly Rotation',
      geofence: branch.geofence,
      device_expiry_rule_applicable: 0,
      verification_type: 'Face + Card PIN'
    });
  }

  console.log(`[2/3] Executing chunked batch insertion (${records.length} records in batches of 500)...`);
  const { totalInserted } = await mysqlAdapter.bulkInsertEmployees(records, 500);

  const durationMs = Date.now() - startTime;
  console.log(`[3/3] Insertion complete! Time taken: ${durationMs}ms (${(durationMs/1000).toFixed(2)}s)`);

  const [countRes] = await pool.execute('SELECT COUNT(*) as total, COUNT(DISTINCT company_id) as companies, COUNT(DISTINCT department_id) as depts, COUNT(DISTINCT designation_id) as desigs FROM employees');
  const stats = countRes[0];
  console.log('============================================================');
  console.log(` [OK] Database Verification Stats:`);
  console.log(`      - Total Employees:    ${stats.total}`);
  console.log(`      - Linked Companies:   ${stats.companies}`);
  console.log(`      - Linked Departments: ${stats.depts}`);
  console.log(`      - Linked Designations:${stats.desigs}`);
  console.log('============================================================');
  process.exit(0);
}

seedEmployees(5000).catch(err => {
  console.error('[SEED ERROR]', err.message || err);
  process.exit(1);
});
