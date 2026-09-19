// tests/suites/attendance_workflow_tests.js — Attendance Log, Geofences, Work Codes, OT & Leaves (<500 lines)

async function runAttendanceWorkflowTests(request, authHeaders) {
  // 19. Attendance Log & Regularization APIs
  console.log('19. Testing /api/attendance-log & Regularization...');
  const attLogGet = await request('/api/attendance-log?page=1&limit=20', 'GET', authHeaders);
  if (attLogGet.status !== 200 || !Array.isArray(attLogGet.body.rows)) {
    throw new Error('Get Attendance Log failed: ' + JSON.stringify(attLogGet));
  }
  console.log(`   [PASS] Retrieved attendance log (Total: ${attLogGet.body.total}, Page Rows: ${attLogGet.body.rows.length})`);

  const attStatsGet = await request('/api/attendance-log/stats', 'GET', authHeaders);
  if (attStatsGet.status !== 200 || !attStatsGet.body.stats) {
    throw new Error('Get Attendance Stats failed: ' + JSON.stringify(attStatsGet));
  }
  console.log(`   [PASS] Attendance stats retrieved (Total: ${attStatsGet.body.stats.total_punches}, On-Time: ${attStatsGet.body.stats.on_time_count})`);

  // Regularize Attendance (Missed punch regularization)
  const regAtt = await request('/api/attendance-log/regularize', 'POST', authHeaders, {
    emp_id: 'EMP0002',
    timestamp: '2026-09-18 09:05:00',
    status: 'Present',
    reason: 'Integration test regularization'
  });
  if (regAtt.status !== 200 || !regAtt.body.attendance) {
    throw new Error('Attendance Regularization failed: ' + JSON.stringify(regAtt));
  }
  console.log('   [PASS] Attendance regularized for EMP0002 (att_id: ' + regAtt.body.attendance.att_id + ')');

  // 20. Geofences CRUD & Coordinate Verification
  console.log('20. Testing /api/geofences CRUD & Coordinate Verification...');
  const geoList = await request('/api/geofences', 'GET', authHeaders);
  if (geoList.status !== 200 || !Array.isArray(geoList.body.geofences)) {
    throw new Error('Get Geofences failed: ' + JSON.stringify(geoList));
  }
  console.log(`   [PASS] Retrieved ${geoList.body.total} geofences`);

  const testGeoCode = `GEO_${Math.floor(Math.random() * 8999 + 1000)}`;
  const geoCreate = await request('/api/geofences', 'POST', authHeaders, {
    code: testGeoCode,
    name: 'Test Innovation Park',
    latitude: 12.9716000,
    longitude: 77.5946000,
    radius_meters: 200,
    enforcement_mode: 'STRICT',
    allowed_depts: ['Engineering', 'Product & Design'],
    active: true
  });
  if (geoCreate.status !== 201 || !geoCreate.body.geofence) {
    throw new Error('Create Geofence failed: ' + JSON.stringify(geoCreate));
  }
  const testGeoId = geoCreate.body.geofence.id;
  console.log('   [PASS] Created geofence:', testGeoId);

  // Verify Coordinates API (Haversine distance calculation)
  const coordVerify = await request('/api/geofences/verify-coords', 'POST', authHeaders, {
    latitude: 12.9716100,
    longitude: 77.5946100,
    dept: 'Engineering'
  });
  if (coordVerify.status !== 200 || !coordVerify.body.is_valid) {
    throw new Error('Coordinate verification failed: ' + JSON.stringify(coordVerify));
  }
  console.log('   [PASS] Coordinates verified inside geofence:', coordVerify.body.matched_geofence?.name);

  // Delete Geofence
  const geoDelete = await request(`/api/geofences/${testGeoId}`, 'DELETE', authHeaders);
  if (geoDelete.status !== 200) throw new Error('Delete Geofence failed: ' + JSON.stringify(geoDelete));
  console.log('   [PASS] Cleaned up test geofence:', testGeoId);

  // 21. Work Codes CRUD
  console.log('21. Testing /api/work-codes CRUD...');
  const wcList = await request('/api/work-codes', 'GET', authHeaders);
  if (wcList.status !== 200 || !Array.isArray(wcList.body.workCodes)) {
    throw new Error('Get Work Codes failed: ' + JSON.stringify(wcList));
  }
  console.log(`   [PASS] Retrieved ${wcList.body.total} work codes`);

  const testWcCode = `WC_${Math.floor(Math.random() * 8999 + 1000)}`;
  const wcCreate = await request('/api/work-codes', 'POST', authHeaders, {
    code: testWcCode,
    name: 'AI Model Optimization Sprint',
    category: 'BILLABLE_PROJECT',
    description: 'Deep learning performance tuning and deployment',
    billing_rate_multiplier: 1.5,
    ot_eligible: true,
    active: true
  });
  if (wcCreate.status !== 201 || !wcCreate.body.workCode) {
    throw new Error('Create Work Code failed: ' + JSON.stringify(wcCreate));
  }
  const testWcId = wcCreate.body.workCode.id;
  console.log('   [PASS] Created work code:', testWcId);

  const wcUpdate = await request(`/api/work-codes/${testWcId}`, 'PUT', authHeaders, {
    code: testWcCode,
    name: 'AI Model Optimization Sprint V2',
    category: 'BILLABLE_PROJECT',
    billing_rate_multiplier: 1.75,
    ot_eligible: true,
    active: true
  });
  if (wcUpdate.status !== 200 || parseFloat(wcUpdate.body.workCode.billing_rate_multiplier) !== 1.75) {
    throw new Error('Update Work Code failed: ' + JSON.stringify(wcUpdate));
  }
  console.log('   [PASS] Updated work code multiplier to 1.75x');

  const wcDelete = await request(`/api/work-codes/${testWcId}`, 'DELETE', authHeaders);
  if (wcDelete.status !== 200) throw new Error('Delete Work Code failed: ' + JSON.stringify(wcDelete));
  console.log('   [PASS] Cleaned up test work code:', testWcId);

  // 22. OT Register, Auto-Calculate & Approvals
  console.log('22. Testing /api/ot-register CRUD, Auto-Calculation & Approvals...');
  const otList = await request('/api/ot-register?page=1&limit=50', 'GET', authHeaders);
  if (otList.status !== 200 || !Array.isArray(otList.body.rows)) {
    throw new Error('Get OT Register failed: ' + JSON.stringify(otList));
  }
  console.log(`   [PASS] Retrieved OT register (Total: ${otList.body.total})`);

  // Manual OT Entry creation
  const otCreate = await request('/api/ot-register', 'POST', authHeaders, {
    emp_id: 'EMP0001',
    ot_date: '2026-09-18',
    shift_id: 'SHIFT_GEN',
    scheduled_hours: 8.0,
    actual_hours: 10.5,
    ot_hours: 2.5,
    ot_multiplier: 1.5,
    ot_rate_type: 'STANDARD_DAY',
    status: 'PENDING',
    comments: 'Integration test manual OT entry'
  });
  if (otCreate.status !== 201 || !otCreate.body.record) {
    throw new Error('Create OT Record failed: ' + JSON.stringify(otCreate));
  }
  const testOtId = otCreate.body.record.id;
  console.log('   [PASS] Created manual OT record ID:', testOtId);

  // Update OT Status to APPROVED
  const otStatusUpdate = await request(`/api/ot-register/${testOtId}/status`, 'PUT', authHeaders, {
    status: 'APPROVED',
    comments: 'Approved by test runner'
  });
  if (otStatusUpdate.status !== 200 || otStatusUpdate.body.record.status !== 'APPROVED') {
    throw new Error('Update OT Status failed: ' + JSON.stringify(otStatusUpdate));
  }
  console.log('   [PASS] OT record approved for payroll');

  // Test Auto-Calculate OT for today
  const otCalc = await request('/api/ot-register/calculate', 'POST', authHeaders, {
    date: '2026-09-18',
    threshold_hours: 8.0
  });
  if (otCalc.status !== 200) throw new Error('OT Auto-Calculate failed: ' + JSON.stringify(otCalc));
  console.log(`   [PASS] Auto-calculated OT for 2026-09-18 (Multiplier: ${otCalc.body.multiplier}x, Type: ${otCalc.body.rate_type})`);

  // Clean up test OT Record
  const otDelete = await request(`/api/ot-register/${testOtId}`, 'DELETE', authHeaders);
  if (otDelete.status !== 200) throw new Error('Delete OT Record failed: ' + JSON.stringify(otDelete));
  console.log('   [PASS] Cleaned up test OT record:', testOtId);

  // 23. Leave Types Master CRUD
  console.log('23. Testing /api/leave-types CRUD...');
  const ltGet = await request('/api/leave-types', 'GET', authHeaders);
  if (ltGet.status !== 200 || !Array.isArray(ltGet.body.leaveTypes)) throw new Error('Get Leave Types failed: ' + JSON.stringify(ltGet));
  console.log(`   [PASS] Retrieved ${ltGet.body.leaveTypes.length} statutory leave types (e.g. CL, SL, EL, ML)`);

  const testLtCode = 'LT_TST' + Date.now().toString().slice(-3);
  const ltCreate = await request('/api/leave-types', 'POST', authHeaders, {
    code: testLtCode,
    name: 'Special Sabbatical Leave',
    category: 'OTHER',
    description: 'Test statutory sabbatical policy',
    paid: false,
    annual_quota_days: 30.0,
    carry_forward_max: 10.0,
    encashable: false,
    color: '#8b5cf6'
  });
  if (ltCreate.status !== 201 || !ltCreate.body.leaveType) throw new Error('Create Leave Type failed: ' + JSON.stringify(ltCreate));
  const testLtId = ltCreate.body.leaveType.id;
  console.log('   [PASS] Created custom leave type:', testLtId);

  const ltUpdate = await request(`/api/leave-types/${testLtId}`, 'PUT', authHeaders, {
    code: testLtCode,
    name: 'Special Sabbatical Leave (Updated)',
    category: 'OTHER',
    description: 'Updated sabbatical policy',
    paid: true,
    annual_quota_days: 35.0,
    carry_forward_max: 15.0,
    encashable: true,
    color: '#6366f1'
  });
  if (ltUpdate.status !== 200 || ltUpdate.body.leaveType.name !== 'Special Sabbatical Leave (Updated)') {
    throw new Error('Update Leave Type failed: ' + JSON.stringify(ltUpdate));
  }
  console.log('   [PASS] Updated leave type:', testLtId);

  // 24. Employee Leave Entries & Balances
  console.log('24. Testing /api/leave-entries & /balances...');
  const leaveApp = await request('/api/leave-entries', 'POST', authHeaders, {
    emp_id: 'EMP0001',
    leave_type_id: testLtId,
    start_date: '2026-10-01',
    end_date: '2026-10-05',
    total_days: 5.0,
    reason: 'Personal academic research project',
    comments: 'Will be back on Oct 6'
  });
  if (leaveApp.status !== 201 || !leaveApp.body.entry) throw new Error('Submit Leave Application failed: ' + JSON.stringify(leaveApp));
  const testLeaveId = leaveApp.body.entry.id;
  console.log('   [PASS] Submitted leave application ID:', testLeaveId);

  const leaveApprove = await request(`/api/leave-entries/${testLeaveId}/status`, 'PUT', authHeaders, {
    status: 'APPROVED',
    comments: 'Approved by HR Lead'
  });
  if (leaveApprove.status !== 200 || leaveApprove.body.entry.status !== 'APPROVED') {
    throw new Error('Approve Leave Application failed: ' + JSON.stringify(leaveApprove));
  }
  console.log('   [PASS] Leave application approved');

  // Check Balances API
  const balances = await request('/api/leave-entries/balances/EMP0001?year=2026', 'GET', authHeaders);
  if (balances.status !== 200 || !Array.isArray(balances.body.balances)) {
    throw new Error('Get Leave Balances failed: ' + JSON.stringify(balances));
  }
  const testBalance = balances.body.balances.find(b => b.leave_type_id === testLtId);
  if (!testBalance || testBalance.used_days !== 5.0 || testBalance.available_days !== 30.0) {
    throw new Error('Leave balance ledger mismatch: ' + JSON.stringify(balances));
  }
  console.log(`   [PASS] Balance ledger verified for EMP0001 (Quota: ${testBalance.annual_quota}d, Used: ${testBalance.used_days}d, Available: ${testBalance.available_days}d)`);

  // Clean up leave entry & leave type
  const leaveDelete = await request(`/api/leave-entries/${testLeaveId}`, 'DELETE', authHeaders);
  if (leaveDelete.status !== 200) throw new Error('Delete Leave Entry failed: ' + JSON.stringify(leaveDelete));
  const ltDelete = await request(`/api/leave-types/${testLtId}`, 'DELETE', authHeaders);
  if (ltDelete.status !== 200) throw new Error('Delete Leave Type failed: ' + JSON.stringify(ltDelete));
  console.log('   [PASS] Cleaned up test leave entry and leave type');

  // 25. Employee Outdoor / On-Duty Entries
  console.log('25. Testing /api/outdoor-entries CRUD & status update...');
  const odCreate = await request('/api/outdoor-entries', 'POST', authHeaders, {
    emp_id: 'EMP0001',
    od_date: '2026-09-22',
    start_time: '09:30:00',
    end_time: '17:30:00',
    destination_client: 'Wipro Electronic City Campus, Bangalore',
    purpose: 'Biometric Face Recognition terminal deployment and pilot validation',
    travel_allowance_eligible: true,
    comments: 'Cab receipts attached'
  });
  if (odCreate.status !== 201 || !odCreate.body.entry) throw new Error('Create Outdoor Entry failed: ' + JSON.stringify(odCreate));
  const testOdId = odCreate.body.entry.id;
  console.log('   [PASS] Created outdoor duty entry ID:', testOdId);

  const odStatus = await request(`/api/outdoor-entries/${testOdId}/status`, 'PUT', authHeaders, {
    status: 'APPROVED',
    comments: 'Approved by Operations Manager'
  });
  if (odStatus.status !== 200 || odStatus.body.entry.status !== 'APPROVED') {
    throw new Error('Update Outdoor Status failed: ' + JSON.stringify(odStatus));
  }
  console.log('   [PASS] Outdoor entry approved');

  const odDelete = await request(`/api/outdoor-entries/${testOdId}`, 'DELETE', authHeaders);
  if (odDelete.status !== 200) throw new Error('Delete Outdoor Entry failed: ' + JSON.stringify(odDelete));
  console.log('   [PASS] Cleaned up test outdoor entry');
}

module.exports = { runAttendanceWorkflowTests };
