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

      // 9. Token Refresh
      console.log('9. Testing /api/auth/refresh...');
      const ref = await request('/api/auth/refresh', 'POST', {}, { refresh_token: refreshToken });
      if (ref.status !== 200 || !ref.body.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(ref));
      console.log('   [PASS] Refresh token issued new access token');

      // 10. Logout & Blacklist
      console.log('10. Testing /api/auth/logout...');
      const logout = await request('/api/auth/logout', 'POST', authHeaders);
      if (logout.status !== 200) throw new Error('Logout failed: ' + JSON.stringify(logout));
      console.log('   [PASS] Logged out successfully');

      // 11. Blacklisted token rejected
      console.log('11. Testing blacklisted token rejection...');
      const rejected = await request('/api/auth/me', 'GET', authHeaders);
      if (rejected.status !== 401) throw new Error('Blacklisted token was not rejected: ' + JSON.stringify(rejected));
      console.log('   [PASS] Blacklisted token rejected with HTTP 401:', rejected.body.error.code);

      console.log('\n=============================================');
      console.log('  ALL 11 INTEGRATION TESTS PASSED 100%!     ');
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
