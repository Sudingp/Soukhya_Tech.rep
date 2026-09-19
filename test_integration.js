// test_integration.js — Modular End-to-End API Integration Orchestrator (<500 lines)
const { app, ensureAdminUser, seedDatabase } = require('./server');
const { checkMySQL } = require('./database/db');
const { createHttpClient } = require('./tests/helpers/http_client');
const { runAuthEmployeeTests } = require('./tests/suites/auth_employee_tests');
const { runShiftRosterTests } = require('./tests/suites/shift_roster_tests');
const { runAttendanceWorkflowTests } = require('./tests/suites/attendance_workflow_tests');
const { runMastersAdminTests } = require('./tests/suites/masters_admin_tests');

async function runTests() {
  await checkMySQL();
  await ensureAdminUser();
  await seedDatabase('system');

  const server = app.listen(0, '127.0.0.1', async () => {
    const port = server.address().port;
    console.log('[TEST] Server listening on dynamic port:', port);

    const request = createHttpClient(port);

    try {
      // Suite 1: Authentication, Employees, Stats & Audit
      const { authHeaders, refreshToken } = await runAuthEmployeeTests(request);

      // Suite 2: Shifts, Groups, Calendar & Shift Roster Matrix
      await runShiftRosterTests(request, authHeaders);

      // Suite 3: Attendance Log, Geofences, Work Codes, OT, Leaves & OD
      await runAttendanceWorkflowTests(request, authHeaders);

      // Suite 4: Organization Masters, Devices, Fast Punch Buffer, Token Lifecycle
      await runMastersAdminTests(request, authHeaders, refreshToken);

      console.log('\n=============================================');
      console.log('  ALL 38 INTEGRATION TESTS PASSED 100%!     ');
      console.log('=============================================\n');

      server.close();
      process.exit(0);
    } catch (e) {
      console.error('[TEST ERROR]', e);
      server.close();
      process.exit(1);
    }
  });
}

runTests();
