// tests/suites/auth_employee_tests.js — Authentication, Employee CRUD, Stats & Punch Tests (<500 lines)

async function runAuthEmployeeTests(request) {
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
  const testEmp = emps.body.employees[0];
  const MySQLAdapter = require('../../database/mysql_adapter');
  const mysqlAdapter = new MySQLAdapter();
  const dbPool = await mysqlAdapter.getPool();
  await dbPool.execute('DELETE FROM attendance WHERE emp_id = ?', [testEmp.id]);

  const punch = await request('/api/attendance', 'POST', authHeaders, {
    emp_id: testEmp.id,
    name: testEmp.name,
    dept: testEmp.department,
    role: testEmp.role,
    timestamp: new Date().toISOString(),
    status: 'Present'
  });
  if (![200, 201].includes(punch.status) || !punch.body.success) throw new Error('Punch failed: ' + JSON.stringify(punch));
  console.log('   [PASS] Punched in for:', testEmp.id);

  // 7. Duplicate punch prevention
  console.log('7. Testing duplicate punch prevention...');
  const dup = await request('/api/attendance', 'POST', authHeaders, {
    emp_id: testEmp.id,
    name: testEmp.name,
    dept: testEmp.department,
    role: testEmp.role,
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

  return { token, refreshToken, authHeaders };
}

module.exports = { runAuthEmployeeTests };
