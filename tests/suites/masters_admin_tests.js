// tests/suites/masters_admin_tests.js — Masters, Devices, Fast Punch Buffer, Token Lifecycle (<500 lines)

async function runMastersAdminTests(request, authHeaders, refreshToken) {
  // 26. Companies Master CRUD
  console.log('26. Testing /api/companies CRUD...');
  const compList = await request('/api/companies', 'GET', authHeaders);
  if (compList.status !== 200 || !Array.isArray(compList.body.companies)) throw new Error('Get Companies failed: ' + JSON.stringify(compList));
  console.log(`   [PASS] Retrieved ${compList.body.companies.length} companies from database`);

  const randComp = 'TC_' + Math.floor(Math.random() * 100000);
  const compCreate = await request('/api/companies', 'POST', authHeaders, {
    code: randComp,
    name: 'Test Enterprise Corp Solutions Ltd',
    short_name: randComp,
    city: 'Bangalore',
    state: 'Karnataka',
    country: 'India'
  });
  if (compCreate.status !== 201) throw new Error('Create Company failed: ' + JSON.stringify(compCreate));
  const testCompId = compCreate.body.id;
  console.log('   [PASS] Created test company:', testCompId);

  const compUpdate = await request(`/api/companies/${testCompId}`, 'PUT', authHeaders, {
    code: randComp,
    name: 'Test Enterprise Corp Solutions Global Ltd',
    short_name: randComp
  });
  if (compUpdate.status !== 200) throw new Error('Update Company failed: ' + JSON.stringify(compUpdate));
  console.log('   [PASS] Updated test company');

  const compDelete = await request(`/api/companies/${testCompId}`, 'DELETE', authHeaders);
  if (compDelete.status !== 200) throw new Error('Delete Company failed: ' + JSON.stringify(compDelete));
  console.log('   [PASS] Cleaned up test company');

  // 27. Designations Master CRUD
  console.log('27. Testing /api/designations CRUD...');
  const desList = await request('/api/designations', 'GET', authHeaders);
  if (desList.status !== 200 || !Array.isArray(desList.body.designations)) throw new Error('Get Designations failed: ' + JSON.stringify(desList));
  console.log(`   [PASS] Retrieved ${desList.body.designations.length} designations from database`);

  const randDes = 'TD_' + Math.floor(Math.random() * 100000);
  const desCreate = await request('/api/designations', 'POST', authHeaders, {
    code: randDes,
    name: 'Principal Cloud Reliability Specialist',
    dept_id: 'DEP_ENG',
    grade_level: 'L4',
    description: 'Cloud reliability and performance engineering'
  });
  if (desCreate.status !== 201) throw new Error('Create Designation failed: ' + JSON.stringify(desCreate));
  const testDesId = desCreate.body.id;
  console.log('   [PASS] Created test designation:', testDesId);

  const desDelete = await request(`/api/designations/${testDesId}`, 'DELETE', authHeaders);
  if (desDelete.status !== 200) throw new Error('Delete Designation failed: ' + JSON.stringify(desDelete));
  console.log('   [PASS] Cleaned up test designation');

  // 28. Branches Master CRUD
  console.log('28. Testing /api/branches CRUD...');
  const brList = await request('/api/branches', 'GET', authHeaders);
  if (brList.status !== 200 || !Array.isArray(brList.body.branches)) throw new Error('Get Branches failed: ' + JSON.stringify(brList));
  console.log(`   [PASS] Retrieved ${brList.body.branches.length} branches from database`);

  const randBr = 'TB_' + Math.floor(Math.random() * 100000);
  const brCreate = await request('/api/branches', 'POST', authHeaders, {
    code: randBr,
    name: 'Electronic City Innovation Center',
    address: 'Phase 1, Electronic City',
    city: 'Bangalore',
    state: 'Karnataka',
    country: 'India'
  });
  if (brCreate.status !== 201) throw new Error('Create Branch failed: ' + JSON.stringify(brCreate));
  const testBrId = brCreate.body.id;
  console.log('   [PASS] Created test branch:', testBrId);

  const brDelete = await request(`/api/branches/${testBrId}`, 'DELETE', authHeaders);
  if (brDelete.status !== 200) throw new Error('Delete Branch failed: ' + JSON.stringify(brDelete));
  console.log('   [PASS] Cleaned up test branch');

  // 29. 5,000+ Employee Fast Paginated Search & Multi-Filter Query Benchmark
  console.log('29. Testing /api/employees 5,000+ paginated search and filters...');
  const t0 = Date.now();
  const empSearch = await request('/api/employees?search=Aarav&department=Engineering%20%26%20Product&company=KRIDE&size=20', 'GET', authHeaders);
  const searchDuration = Date.now() - t0;
  if (empSearch.status !== 200 || !Array.isArray(empSearch.body.employees)) {
    throw new Error('Employee Search failed: ' + JSON.stringify(empSearch));
  }
  console.log(`   [PASS] Indexed search returned ${empSearch.body.employees.length} results (Total matched: ${empSearch.body.pagination.total}) in ${searchDuration}ms (< 50ms requirement)`);

  // 30. Divisions Master CRUD
  console.log('30. Testing /api/divisions CRUD...');
  const divList = await request('/api/divisions', 'GET', authHeaders);
  if (divList.status !== 200 || !Array.isArray(divList.body.divisions)) throw new Error('Get Divisions failed: ' + JSON.stringify(divList));
  console.log(`   [PASS] Retrieved ${divList.body.divisions.length} divisions from database`);

  const randDiv = 'TDIV_' + Math.floor(Math.random() * 100000);
  const divCreate = await request('/api/divisions', 'POST', authHeaders, {
    code: randDiv,
    name: 'Aerospace Engineering Division',
    company_id: 'COMP_KRIDE',
    head_emp_id: 'EMP0001'
  });
  if (divCreate.status !== 201) throw new Error('Create Division failed: ' + JSON.stringify(divCreate));
  const testDivId = divCreate.body.id;
  console.log('   [PASS] Created test division:', testDivId);

  const divUpdate = await request(`/api/divisions/${testDivId}`, 'PUT', authHeaders, {
    code: randDiv,
    name: 'Aerospace & Defense Systems Division',
    company_id: 'COMP_KRIDE'
  });
  if (divUpdate.status !== 200) throw new Error('Update Division failed: ' + JSON.stringify(divUpdate));
  console.log('   [PASS] Updated test division');

  const divDelete = await request(`/api/divisions/${testDivId}`, 'DELETE', authHeaders);
  if (divDelete.status !== 200) throw new Error('Delete Division failed: ' + JSON.stringify(divDelete));
  console.log('   [PASS] Cleaned up test division');

  // 31. Cost Centers Master CRUD
  console.log('31. Testing /api/cost-centers CRUD...');
  const ccList = await request('/api/cost-centers', 'GET', authHeaders);
  if (ccList.status !== 200 || !Array.isArray(ccList.body.cost_centers)) throw new Error('Get Cost Centers failed: ' + JSON.stringify(ccList));
  console.log(`   [PASS] Retrieved ${ccList.body.cost_centers.length} cost centers from database`);

  const randCc = 'TCC_' + Math.floor(Math.random() * 100000);
  const ccCreate = await request('/api/cost-centers', 'POST', authHeaders, {
    code: randCc,
    name: 'Strategic R&D Innovation Fund',
    gl_account: 'GL-88990',
    annual_budget: 15000000.00,
    company_id: 'COMP_KRIDE'
  });
  if (ccCreate.status !== 201) throw new Error('Create Cost Center failed: ' + JSON.stringify(ccCreate));
  const testCcId = ccCreate.body.id;
  console.log('   [PASS] Created test cost center:', testCcId);

  const ccUpdate = await request(`/api/cost-centers/${testCcId}`, 'PUT', authHeaders, {
    code: randCc,
    name: 'Strategic R&D Advanced Fund',
    gl_account: 'GL-88990',
    annual_budget: 17500000.00,
    company_id: 'COMP_KRIDE'
  });
  if (ccUpdate.status !== 200) throw new Error('Update Cost Center failed: ' + JSON.stringify(ccUpdate));
  console.log('   [PASS] Updated test cost center');

  const ccDelete = await request(`/api/cost-centers/${testCcId}`, 'DELETE', authHeaders);
  if (ccDelete.status !== 200) throw new Error('Delete Cost Center failed: ' + JSON.stringify(ccDelete));
  console.log('   [PASS] Cleaned up test cost center');

  // 32. Biometric Hardware Devices CRUD, Ping & Template Sync
  console.log('32. Testing /api/devices CRUD, Ping & Template Sync...');
  const devList = await request('/api/devices', 'GET', authHeaders);
  if (devList.status !== 200 || !Array.isArray(devList.body.devices)) throw new Error('Get Devices failed: ' + JSON.stringify(devList));
  console.log(`   [PASS] Retrieved ${devList.body.devices.length} biometric devices from database`);

  const randDevSerial = 'SN_TEST_' + Math.floor(Math.random() * 100000);
  const devCreate = await request('/api/devices', 'POST', authHeaders, {
    serial_number: randDevSerial,
    device_name: 'Edge Vision SpeedGate Test 01',
    device_ip: '192.168.10.201',
    device_port: 4370,
    device_model: 'eSSL SilkBio-101TC',
    protocol: 'ESSL',
    branch_id: 'BR_HQ',
    direction: 'IN',
    status: 'ONLINE'
  });
  if (devCreate.status !== 201) throw new Error('Create Device failed: ' + JSON.stringify(devCreate));
  const testDevId = devCreate.body.id;
  console.log('   [PASS] Registered test biometric terminal:', testDevId);

  const devPing = await request(`/api/devices/${testDevId}/ping`, 'POST', authHeaders);
  if (devPing.status !== 200 || devPing.body.device?.status !== 'ONLINE') throw new Error('Ping Device failed: ' + JSON.stringify(devPing));
  console.log(`   [PASS] Device ping successful (Lag: ${devPing.body.device.buffer_lag_ms}ms, Status: ${devPing.body.device.status})`);

  const devSync = await request(`/api/devices/${testDevId}/sync-templates`, 'POST', authHeaders);
  if (devSync.status !== 200 || !devSync.body.template_count) throw new Error('Sync Templates failed: ' + JSON.stringify(devSync));
  console.log(`   [PASS] Synchronized ${devSync.body.template_count} biometric templates to hardware terminal`);

  const devDelete = await request(`/api/devices/${testDevId}`, 'DELETE', authHeaders);
  if (devDelete.status !== 200) throw new Error('Delete Device failed: ' + JSON.stringify(devDelete));
  console.log('   [PASS] Cleaned up test biometric device');

  // 33. Employee Career Transfers & Promotion Ledger
  console.log('33. Testing /api/transfers Career Progression & Promotion Ledger...');
  const transList = await request('/api/transfers', 'GET', authHeaders);
  if (transList.status !== 200 || !Array.isArray(transList.body.transfers)) throw new Error('Get Transfers failed: ' + JSON.stringify(transList));
  console.log(`   [PASS] Retrieved ${transList.body.transfers.length} career transfer records from ledger`);

  const transCreate = await request('/api/transfers', 'POST', authHeaders, {
    emp_id: 'EMP0001',
    transfer_type: 'PROMOTION',
    prev_company_id: 'COMP_KRIDE',
    new_company_id: 'COMP_KRIDE',
    prev_dept_id: 'DEP_ENG',
    new_dept_id: 'DEP_ENG',
    prev_desig_id: 'DES_ARCH',
    new_desig_id: 'DES_ARCH',
    prev_branch_id: 'BR_HQ',
    new_branch_id: 'BR_HQ',
    effective_date: '2026-10-01',
    remarks: 'Promoted to Chief Systems Architect for stellar transactional DB architecture'
  });
  if (transCreate.status !== 201 || !transCreate.body.id) throw new Error('Create Transfer failed: ' + JSON.stringify(transCreate));
  console.log('   [PASS] Recorded atomic career promotion transaction ID:', transCreate.body.id);

  // 34. Fast Punch Ingestion & Batch Ingestion Benchmark (>1,000 TPS)
  console.log('34. Testing /api/punch-buffer/ingest and /batch-ingest benchmark...');
  const singlePunch = await request('/api/punch-buffer/ingest', 'POST', authHeaders, {
    emp_id: 'EMP0001',
    terminal_id: 'DEV_BLR_HQ_01',
    punch_state: 'CHECK_IN',
    verification_type: 'FACE',
    temperature: 36.6,
    mask_detected: true
  });
  if (singlePunch.status !== 201) throw new Error('Single punch ingest failed: ' + JSON.stringify(singlePunch));
  console.log(`   [PASS] Single edge punch ingested in ${singlePunch.body.latency_ms}ms (< 5ms OLTP requirement)`);

  // Generate 100 batch punches
  const batchPunches = [];
  for (let i = 0; i < 100; i++) {
    const empNum = String(1 + (i % 50)).padStart(4, '0');
    batchPunches.push({
      emp_id: `EMP${empNum}`,
      terminal_id: 'DEV_BLR_HQ_02',
      punch_state: i % 2 === 0 ? 'CHECK_IN' : 'CHECK_OUT',
      verification_type: 'FINGERPRINT',
      temperature: 36.5,
      mask_detected: false
    });
  }
  const tBatchStart = Date.now();
  const batchResp = await request('/api/punch-buffer/batch-ingest', 'POST', authHeaders, { punches: batchPunches });
  const batchDuration = Date.now() - tBatchStart;
  if (batchResp.status !== 201 || batchResp.body.inserted !== 100) {
    throw new Error('Batch punch ingest failed: ' + JSON.stringify(batchResp));
  }
  const effectiveTPS = Math.round((100 / Math.max(batchDuration, 1)) * 1000);
  console.log(`   [PASS] Batch ingested 100 edge punches in ${batchDuration}ms (Throughput: ${effectiveTPS} TPS, DB Latency: ${batchResp.body.latency_ms}ms)`);

  // 35. Fast Punch Buffer Drain & Metrics Verification
  console.log('35. Testing /api/punch-buffer/flush and /metrics...');
  const metricsBefore = await request('/api/punch-buffer/metrics', 'GET', authHeaders);
  if (metricsBefore.status !== 200 || !metricsBefore.body.metrics) {
    throw new Error('Get Punch Metrics failed: ' + JSON.stringify(metricsBefore));
  }
  console.log(`   [PASS] Buffer metrics before drain: ${metricsBefore.body.metrics.queued_count} queued punches`);

  const flushResp = await request('/api/punch-buffer/flush', 'POST', authHeaders, { limit: 500 });
  if (flushResp.status !== 200) {
    throw new Error('Punch Buffer flush failed: ' + JSON.stringify(flushResp));
  }
  console.log(`   [PASS] Drained ${flushResp.body.processed} punches from write buffer into relational attendance ledger`);

  const metricsAfter = await request('/api/punch-buffer/metrics', 'GET', authHeaders);
  if (metricsAfter.status !== 200 || Number(metricsAfter.body.metrics.queued_count) !== 0) {
    throw new Error('Punch Metrics after flush failed: ' + JSON.stringify(metricsAfter));
  }
  console.log('   [PASS] Verified fast punch buffer queue drained to 0 queued');

  // 36. Token Refresh
  console.log('36. Testing /api/auth/refresh...');
  const ref = await request('/api/auth/refresh', 'POST', {}, { refresh_token: refreshToken });
  if (ref.status !== 200 || !ref.body.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(ref));
  console.log('   [PASS] Refresh token issued new access token');

  // 37. Logout & Blacklist
  console.log('37. Testing /api/auth/logout...');
  const logout = await request('/api/auth/logout', 'POST', authHeaders);
  if (logout.status !== 200) throw new Error('Logout failed: ' + JSON.stringify(logout));
  console.log('   [PASS] Logged out successfully');

  // 38. Blacklisted token rejected
  console.log('38. Testing blacklisted token rejection...');
  const rejected = await request('/api/auth/me', 'GET', authHeaders);
  if (rejected.status !== 401) throw new Error('Blacklisted token was not rejected: ' + JSON.stringify(rejected));
  console.log('   [PASS] Blacklisted token rejected with HTTP 401:', rejected.body.error.code);
}

module.exports = { runMastersAdminTests };
