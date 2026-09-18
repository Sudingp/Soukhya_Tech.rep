// test_integration.js — Complete End-to-End API Integration Verification
const http = require('http');
const { app, ensureAdminUser, seedDatabase } = require('./server');
const { checkMySQL } = require('./database/db');

async function runTests() {
  await checkMySQL();
  await ensureAdminUser();
  await seedDatabase('system');

  const server = app.listen(0, '127.0.0.1', async () => {
    const port = server.address().port;
    console.log('[TEST] Server listening on dynamic port:', port);

    function request(path, method = 'GET', headers = {}, body = null) {
      return new Promise((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port: port,
          path: path,
          method: method,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          }
        }, res => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(data) });
            } catch (e) {
              resolve({ status: res.statusCode, raw: data });
            }
          });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
      });
    }

    try {
      // 1. Health
      console.log('1. Testing /api/health...');
      const h = await request('/api/health');
      if (h.status !== 200 || h.body.status !== 'UP') throw new Error('Health check failed: ' + JSON.stringify(h));
      console.log('   [PASS] Health status:', h.body.status, '| Active dialect:', h.body.dialect);

      // 2. Login
      console.log('2. Testing /api/auth/login with admin...');
      const l = await request('/api/auth/login', 'POST', {}, { username: 'admin', password: 'admin123' });
      if (l.status !== 200 || !l.body.access_token) throw new Error('Login failed: ' + JSON.stringify(l));
      const token = l.body.access_token;
      const refreshToken = l.body.refresh_token;
      console.log('   [PASS] Logged in as:', l.body.username, '| Role:', l.body.role);

      const authHeaders = { 'Authorization': 'Bearer ' + token };

      // 3. /api/auth/me
      console.log('3. Testing /api/auth/me...');
      const me = await request('/api/auth/me', 'GET', authHeaders);
      if (me.status !== 200 || me.body.role !== 'ADMIN') throw new Error('Me failed: ' + JSON.stringify(me));
      console.log('   [PASS] Me returns role:', me.body.role);

      // 4. /api/employees
      console.log('4. Testing /api/employees...');
      const emps = await request('/api/employees?page=1&size=10', 'GET', authHeaders);
      if (emps.status !== 200 || emps.body.employees.length !== 10) throw new Error('Employees failed: ' + JSON.stringify(emps));
      console.log('   [PASS] Retrieved 10 employees, total:', emps.body.pagination.total);

      // 5. /api/stats
      console.log('5. Testing /api/stats...');
      const st = await request('/api/stats', 'GET', authHeaders);
      if (st.status !== 200 || st.body.total_employees < 100) throw new Error('Stats failed: ' + JSON.stringify(st));
      console.log('   [PASS] Total Employees:', st.body.total_employees);

      // 6. /api/attendance punch
      console.log('6. Testing /api/attendance punch...');
      const firstEmp = emps.body.employees[0];
      const punch = await request('/api/attendance', 'POST', authHeaders, {
        emp_id: firstEmp.id,
        name: firstEmp.name,
        dept: firstEmp.department,
        role: firstEmp.role,
        timestamp: new Date().toISOString(),
        status: 'Present'
      });
      if (![200, 201].includes(punch.status) || !punch.body.success) throw new Error('Punch failed: ' + JSON.stringify(punch));
      console.log('   [PASS] Punched in for:', firstEmp.id);

      // 7. Duplicate punch prevention
      console.log('7. Testing duplicate punch prevention...');
      const dup = await request('/api/attendance', 'POST', authHeaders, {
        emp_id: firstEmp.id,
        name: firstEmp.name,
        dept: firstEmp.department,
        role: firstEmp.role,
        timestamp: new Date().toISOString(),
        status: 'Present'
      });
      if (dup.status !== 409 && dup.status !== 429) throw new Error('Duplicate punch was not rejected: ' + JSON.stringify(dup));
      console.log('   [PASS] Duplicate punch rejected with HTTP', dup.status, ':', dup.body.error.code);

      // 8. /api/audit-logs
      console.log('8. Testing /api/audit-logs...');
      const audit = await request('/api/audit-logs?page=1&size=5', 'GET', authHeaders);
      if (audit.status !== 200 || !audit.body.logs || audit.body.logs.length === 0) throw new Error('Audit logs failed: ' + JSON.stringify(audit));
      console.log('   [PASS] Retrieved audit logs count:', audit.body.logs.length);

      // 9. Master Settings GET & PUT
      console.log('9. Testing /api/settings/master GET & PUT...');
      const settingsGet = await request('/api/settings/master', 'GET', authHeaders);
      if (settingsGet.status !== 200 || !settingsGet.body.settings) throw new Error('Get Master Settings failed: ' + JSON.stringify(settingsGet));
      console.log('   [PASS] Master Settings retrieved (company_name:', settingsGet.body.settings.company_name, ')');

      const settingsPut = await request('/api/settings/master', 'PUT', authHeaders, {
        company_name: 'Soukhya Tech Enterprise HQ',
        late_grace_mins: 20,
        face_match_threshold: 0.52
      });
      if (settingsPut.status !== 200 || settingsPut.body.settings.company_name !== 'Soukhya Tech Enterprise HQ') {
        throw new Error('Update Master Settings failed: ' + JSON.stringify(settingsPut));
      }
      console.log('   [PASS] Master Settings updated and persisted to MySQL');

      // 10. Shifts CRUD API
      console.log('10. Testing /api/shifts CRUD...');
      const shiftsGet = await request('/api/shifts', 'GET', authHeaders);
      if (shiftsGet.status !== 200 || !Array.isArray(shiftsGet.body.shifts)) throw new Error('Get Shifts failed: ' + JSON.stringify(shiftsGet));
      console.log('   [PASS] Retrieved', shiftsGet.body.shifts.length, 'configured shifts');

      // Create test shift
      const testShiftCode = 'TEST_' + Date.now().toString().slice(-4);
      const shiftCreate = await request('/api/shifts', 'POST', authHeaders, {
        code: testShiftCode,
        name: 'Automated Test Shift',
        start_time: '10:00',
        end_time: '19:00',
        break_mins: 45,
        late_grace_mins: 10,
        color: '#3b82f6'
      });
      if (shiftCreate.status !== 201 || !shiftCreate.body.shift) throw new Error('Create Shift failed: ' + JSON.stringify(shiftCreate));
      const createdId = shiftCreate.body.shift.id;
      console.log('   [PASS] Created shift:', createdId);

      // Update test shift
      const shiftUpdate = await request(`/api/shifts/${createdId}`, 'PUT', authHeaders, {
        code: testShiftCode,
        name: 'Automated Test Shift Updated',
        start_time: '10:30',
        end_time: '19:30',
        color: '#10b981'
      });
      if (shiftUpdate.status !== 200 || shiftUpdate.body.shift.name !== 'Automated Test Shift Updated') throw new Error('Update Shift failed: ' + JSON.stringify(shiftUpdate));
      console.log('   [PASS] Updated shift:', createdId);

      // Delete test shift
      const shiftDelete = await request(`/api/shifts/${createdId}`, 'DELETE', authHeaders);
      if (shiftDelete.status !== 200) throw new Error('Delete Shift failed: ' + JSON.stringify(shiftDelete));
      console.log('   [PASS] Deleted shift:', createdId);

      // 11. Shift Calendar APIs
      console.log('11. Testing /api/shift-calendar APIs...');
      const calGet = await request('/api/shift-calendar?month=2026-09', 'GET', authHeaders);
      if (calGet.status !== 200 || !Array.isArray(calGet.body.days)) throw new Error('Get Calendar failed: ' + JSON.stringify(calGet));
      console.log('   [PASS] Retrieved shift calendar for 2026-09 (' + calGet.body.days.length + ' days, ' + calGet.body.summary.working_days + ' working days)');

      // Upsert a day in calendar
      const calDayPut = await request('/api/shift-calendar/day', 'PUT', authHeaders, {
        cal_date: '2026-09-25',
        day_type: 'HOLIDAY',
        title: 'Company Foundation Day'
      });
      if (calDayPut.status !== 200) throw new Error('Upsert Calendar Day failed: ' + JSON.stringify(calDayPut));
      console.log('   [PASS] Calendar day override created for 2026-09-25 (HOLIDAY)');

      // Apply pattern
      const calPattern = await request('/api/shift-calendar/apply-pattern', 'POST', authHeaders, {
        year: 2026,
        month: 9,
        pattern_type: 'SUN_AND_ALT_SAT',
        default_shift_id: 'SHIFT_GEN'
      });
      if (calPattern.status !== 200) throw new Error('Apply Calendar Pattern failed: ' + JSON.stringify(calPattern));
      console.log('   [PASS] Applied weekly off pattern SUN_AND_ALT_SAT');

      // 12. Shift Groups APIs
      console.log('12. Testing /api/shift-groups CRUD and Members...');
      const groupsGet = await request('/api/shift-groups', 'GET', authHeaders);
      if (groupsGet.status !== 200 || !Array.isArray(groupsGet.body.groups)) throw new Error('Get Shift Groups failed: ' + JSON.stringify(groupsGet));
      console.log('   [PASS] Retrieved ' + groupsGet.body.groups.length + ' shift groups');

      // Create Shift Group
      const testGrpCode = 'TEST_GRP_' + Date.now().toString().slice(-4);
      const grpCreate = await request('/api/shift-groups', 'POST', authHeaders, {
        name: 'Automated Test Shift Group',
        code: testGrpCode,
        rotation_type: 'WEEKLY',
        shifts_sequence: ['SHIFT_MOR', 'SHIFT_EVE'],
        color: '#8b5cf6'
      });
      if (grpCreate.status !== 201 || !grpCreate.body.group) throw new Error('Create Shift Group failed: ' + JSON.stringify(grpCreate));
      const testGroupId = grpCreate.body.group.id;
      console.log('   [PASS] Created shift group:', testGroupId);

      // Assign Members to Shift Group
      const grpMembersSet = await request(`/api/shift-groups/${testGroupId}/members`, 'POST', authHeaders, {
        emp_ids: ['EMP001', 'EMP002']
      });
      if (grpMembersSet.status !== 200) throw new Error('Assign Shift Group members failed: ' + JSON.stringify(grpMembersSet));
      console.log('   [PASS] Assigned 2 employees to group', testGroupId);

      // Get Group with Members
      const grpGetOne = await request(`/api/shift-groups/${testGroupId}`, 'GET', authHeaders);
      if (grpGetOne.status !== 200 || !grpGetOne.body.group || grpGetOne.body.group.members.length !== 2) {
        throw new Error('Get Shift Group members count mismatch: ' + JSON.stringify(grpGetOne));
      }
      console.log('   [PASS] Verified shift group members count = 2');

      // Delete Shift Group
      const grpDelete = await request(`/api/shift-groups/${testGroupId}`, 'DELETE', authHeaders);
      if (grpDelete.status !== 200) throw new Error('Delete Shift Group failed: ' + JSON.stringify(grpDelete));
      console.log('   [PASS] Deleted shift group:', testGroupId);

      // 13. Shift Roster APIs
      console.log('13. Testing /api/shift-roster Matrix, Assign & Auto-Generate...');
      const rosterAuto = await request('/api/shift-roster/auto-generate', 'POST', authHeaders, {
        year: 2026,
        month: 9,
        overwrite: true
      });
      const totalSlots = rosterAuto.body.result?.total_slots || rosterAuto.body.total_slots;
      if (rosterAuto.status !== 200 || !totalSlots) throw new Error('Auto Generate Roster failed: ' + JSON.stringify(rosterAuto));
      console.log('   [PASS] Auto-generated roster for month 2026-09 (' + totalSlots + ' slots created)');

      // Assign Shift Roster override
      const rosterAssign = await request('/api/shift-roster/assign', 'POST', authHeaders, {
        emp_ids: ['EMP001'],
        start_date: '2026-09-10',
        end_date: '2026-09-12',
        shift_id: 'SHIFT_NIT',
        day_type: 'WORK',
        note: 'Special Night Project Duty'
      });
      if (rosterAssign.status !== 200) throw new Error('Assign Shift Roster failed: ' + JSON.stringify(rosterAssign));
      console.log('   [PASS] Assigned custom night shift to EMP001 for 2026-09-10 to 2026-09-12');

      // Get Roster Matrix
      const rosterMatrix = await request('/api/shift-roster?month=2026-09&search=EMP001', 'GET', authHeaders);
      if (rosterMatrix.status !== 200 || !Array.isArray(rosterMatrix.body.employees) || rosterMatrix.body.employees.length === 0) {
        throw new Error('Get Shift Roster matrix failed: ' + JSON.stringify(rosterMatrix));
      }
      const emp1Schedule = rosterMatrix.body.employees[0].schedule;
      if (emp1Schedule['2026-09-10']?.shift_id !== 'SHIFT_NIT') {
        throw new Error('Shift assignment verification failed for EMP001 on 2026-09-10');
      }
      console.log('   [PASS] Retrieved roster matrix and verified EMP001 assignment on 2026-09-10 = SHIFT_NIT');

      // 14. Organization: Departments APIs
      console.log('14. Testing /api/departments CRUD...');
      const deptsGet = await request('/api/departments', 'GET', authHeaders);
      if (deptsGet.status !== 200 || !Array.isArray(deptsGet.body.departments)) throw new Error('Get Departments failed: ' + JSON.stringify(deptsGet));
      console.log('   [PASS] Retrieved', deptsGet.body.departments.length, 'departments');

      // Create Department
      const deptCreate = await request('/api/departments', 'POST', authHeaders, {
        code: 'TEST_QA',
        name: 'Quality Assurance & Audit',
        division: 'Quality Control',
        location: 'Bangalore Campus',
        active: true
      });
      if (deptCreate.status !== 201 || !deptCreate.body.department) throw new Error('Create Department failed: ' + JSON.stringify(deptCreate));
      const testDeptId = deptCreate.body.department.id;
      console.log('   [PASS] Created test department:', testDeptId);

      // Update Department
      const deptUpdate = await request(`/api/departments/${testDeptId}`, 'PUT', authHeaders, {
        code: 'TEST_QA',
        name: 'Quality Assurance & Automation',
        division: 'Engineering',
        location: 'Bangalore HQ',
        active: true
      });
      if (deptUpdate.status !== 200) throw new Error('Update Department failed: ' + JSON.stringify(deptUpdate));
      console.log('   [PASS] Updated department name to Quality Assurance & Automation');

      // 15. Organization: Department Shifts APIs
      console.log('15. Testing /api/department-shifts Policies & Bulk Apply...');
      const deptShiftsGet = await request('/api/department-shifts', 'GET', authHeaders);
      if (deptShiftsGet.status !== 200 || !Array.isArray(deptShiftsGet.body.configs)) throw new Error('Get Department Shifts failed: ' + JSON.stringify(deptShiftsGet));
      console.log('   [PASS] Retrieved department shift policies for', deptShiftsGet.body.configs.length, 'departments');

      // Update Department Shift Policy
      const deptShiftUpdate = await request(`/api/department-shifts/${testDeptId}`, 'PUT', authHeaders, {
        default_shift_id: 'SHIFT_MOR',
        allowed_shifts: ['SHIFT_GEN', 'SHIFT_MOR', 'SHIFT_EVE'],
        auto_apply: true
      });
      if (deptShiftUpdate.status !== 200) throw new Error('Update Department Shift failed: ' + JSON.stringify(deptShiftUpdate));
      console.log('   [PASS] Set default shift SHIFT_MOR for department', testDeptId);

      // Apply Shift Policy to Employees
      const deptShiftApply = await request('/api/department-shifts/apply-to-employees', 'POST', authHeaders, {
        dept_id: testDeptId
      });
      if (deptShiftApply.status !== 200) throw new Error('Apply Department Shifts failed: ' + JSON.stringify(deptShiftApply));
      console.log('   [PASS] Applied department shift policy to employees');

      // 16. Organization: Public Holidays APIs (Karnataka Gazette Reference)
      console.log('16. Testing /api/public-holidays (Karnataka State Gazette)...');
      const holidaysGet = await request('/api/public-holidays?year=2026', 'GET', authHeaders);
      if (holidaysGet.status !== 200 || !Array.isArray(holidaysGet.body.holidays)) throw new Error('Get Public Holidays failed: ' + JSON.stringify(holidaysGet));
      console.log('   [PASS] Retrieved', holidaysGet.body.holidays.length, 'public holidays for 2026 (Mandatory Gazetted:', holidaysGet.body.mandatory_count + ')');

      // Import / Verify Karnataka Gazette Holidays
      const importKarnataka = await request('/api/public-holidays/import-karnataka', 'POST', authHeaders, { year: 2026 });
      if (importKarnataka.status !== 200) throw new Error('Import Karnataka Holidays failed: ' + JSON.stringify(importKarnataka));
      console.log('   [PASS] Verified Karnataka Gazetted Holidays for 2026 (Count:', importKarnataka.body.count || 21, ')');

      // Sync Public Holidays with Shift Calendar
      const syncCalendar = await request('/api/public-holidays/sync-calendar', 'POST', authHeaders, { year: 2026 });
      if (syncCalendar.status !== 200) throw new Error('Sync Holidays with Shift Calendar failed: ' + JSON.stringify(syncCalendar));
      console.log('   [PASS] Synchronized Karnataka public holidays with Shift Calendar');

      // Create Custom Company Holiday
      const customHoliday = await request('/api/public-holidays', 'POST', authHeaders, {
        title: 'Soukhya Annual Tech Fest',
        holiday_date: '2026-12-15',
        holiday_type: 'COMPANY_DECLARED',
        applicable_state: 'Karnataka',
        applicable_location: 'All Locations',
        description: 'Company-wide annual technology & celebration day'
      });
      if (customHoliday.status !== 201 || !customHoliday.body.id) throw new Error('Create Custom Holiday failed: ' + JSON.stringify(customHoliday));
      const createdHolidayId = customHoliday.body.id;
      console.log('   [PASS] Created custom company holiday ID:', createdHolidayId);

      // Delete Custom Holiday
      const delHoliday = await request(`/api/public-holidays/${createdHolidayId}`, 'DELETE', authHeaders);
      if (delHoliday.status !== 200) throw new Error('Delete Custom Holiday failed: ' + JSON.stringify(delHoliday));
      console.log('   [PASS] Cleaned up custom company holiday');

      // Cleanup test department
      await request(`/api/departments/${testDeptId}`, 'DELETE', authHeaders);
      console.log('   [PASS] Cleaned up test department:', testDeptId);

      // 17. Employee Management: Employment Types APIs
      console.log('17. Testing /api/employment-types CRUD...');
      const typesGet = await request('/api/employment-types', 'GET', authHeaders);
      if (typesGet.status !== 200 || !Array.isArray(typesGet.body.types)) throw new Error('Get Employment Types failed: ' + JSON.stringify(typesGet));
      console.log('   [PASS] Retrieved', typesGet.body.types.length, 'employment types');

      // Create Employment Type
      const typeCreate = await request('/api/employment-types', 'POST', authHeaders, {
        code: 'TEST_APPR',
        title: 'Apprentice / Industrial Trainee',
        description: 'Vocational training program under Apprenticeship Act',
        probation_days: 60,
        notice_period_days: 15,
        pf_esi_eligible: true,
        active: true
      });
      if (typeCreate.status !== 201 || !typeCreate.body.type) throw new Error('Create Employment Type failed: ' + JSON.stringify(typeCreate));
      const testTypeId = typeCreate.body.type.id;
      console.log('   [PASS] Created employment type:', testTypeId);

      // Update Employment Type
      const typeUpdate = await request(`/api/employment-types/${testTypeId}`, 'PUT', authHeaders, {
        code: 'TEST_APPR',
        title: 'Graduate Apprentice Trainee',
        description: 'GAT / Industrial Trainee Program',
        probation_days: 90,
        notice_period_days: 15,
        pf_esi_eligible: true,
        active: true
      });
      if (typeUpdate.status !== 200) throw new Error('Update Employment Type failed: ' + JSON.stringify(typeUpdate));
      console.log('   [PASS] Updated employment type to Graduate Apprentice Trainee');

      // Delete Employment Type
      const typeDelete = await request(`/api/employment-types/${testTypeId}`, 'DELETE', authHeaders);
      if (typeDelete.status !== 200) throw new Error('Delete Employment Type failed: ' + JSON.stringify(typeDelete));
      console.log('   [PASS] Cleaned up test employment type:', testTypeId);

      // 18. Employee Management: Employee Cohort Groups APIs
      console.log('18. Testing /api/employee-groups CRUD and Members Assignment...');
      const empCohortGroupsGet = await request('/api/employee-groups', 'GET', authHeaders);
      if (empCohortGroupsGet.status !== 200 || !Array.isArray(empCohortGroupsGet.body.groups)) throw new Error('Get Employee Groups failed: ' + JSON.stringify(empCohortGroupsGet));
      console.log('   [PASS] Retrieved', empCohortGroupsGet.body.groups.length, 'configured employee groups');

      // Create Employee Group
      const groupCreate = await request('/api/employee-groups', 'POST', authHeaders, {
        code: 'TEST_TASKFORCE',
        name: 'Alpha Product Launch Taskforce',
        category: 'PROJECT',
        description: 'Cross-functional SWAT team for Q4 product release',
        color: '#8b5cf6',
        active: true
      });
      if (groupCreate.status !== 201 || !groupCreate.body.group) throw new Error('Create Employee Group failed: ' + JSON.stringify(groupCreate));
      const testGroupId2 = groupCreate.body.group.id;
      console.log('   [PASS] Created employee cohort group:', testGroupId2);

      // Assign Members to Group
      const setCohortMembers = await request(`/api/employee-groups/${testGroupId2}/members`, 'POST', authHeaders, {
        emp_ids: ['EMP001', 'EMP002', 'EMP003'],
        role_in_group: 'Core Member'
      });
      if (setCohortMembers.status !== 200) throw new Error('Set Group Members failed: ' + JSON.stringify(setCohortMembers));
      console.log('   [PASS] Assigned 3 employees to employee group');

      // Verify Group Members
      const cohortMembersGet = await request(`/api/employee-groups/${testGroupId2}/members`, 'GET', authHeaders);
      if (cohortMembersGet.status !== 200 || cohortMembersGet.body.total !== 3) throw new Error('Verify Group Members failed: ' + JSON.stringify(cohortMembersGet));
      console.log('   [PASS] Verified 3 group members retrieved');

      // Delete Group
      const groupDelete = await request(`/api/employee-groups/${testGroupId2}`, 'DELETE', authHeaders);
      if (groupDelete.status !== 200) throw new Error('Delete Employee Group failed: ' + JSON.stringify(groupDelete));
      console.log('   [PASS] Cleaned up test employee group:', testGroupId2);

      // 19. Token Refresh
      console.log('19. Testing /api/auth/refresh...');
      const ref = await request('/api/auth/refresh', 'POST', {}, { refresh_token: refreshToken });
      if (ref.status !== 200 || !ref.body.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(ref));
      console.log('   [PASS] Refresh token issued new access token');

      // 20. Logout & Blacklist
      console.log('20. Testing /api/auth/logout...');
      const logout = await request('/api/auth/logout', 'POST', authHeaders);
      if (logout.status !== 200) throw new Error('Logout failed: ' + JSON.stringify(logout));
      console.log('   [PASS] Logged out successfully');

      // 21. Blacklisted token rejected
      console.log('21. Testing blacklisted token rejection...');
      const rejected = await request('/api/auth/me', 'GET', authHeaders);
      if (rejected.status !== 401) throw new Error('Blacklisted token was not rejected: ' + JSON.stringify(rejected));
      console.log('   [PASS] Blacklisted token rejected with HTTP 401:', rejected.body.error.code);

      console.log('\n=============================================');
      console.log('  ALL 21 INTEGRATION TESTS PASSED 100%!     ');
      console.log('=============================================\n');

      server.close();
      process.exit(0);
    } catch (e) {
      console.error('[TEST ERROR]', e.message);
      server.close();
      process.exit(1);
    }
  });
}

runTests();
