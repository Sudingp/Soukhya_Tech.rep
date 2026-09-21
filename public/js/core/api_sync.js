// ══════════════════════════════════════════════
// Real-Time DB Change Synchronization (SSE + Polling)
// ══════════════════════════════════════════════
let sseConnection = null;

function initRealtimeSync() {
  if (typeof EventSource === 'undefined') {
    setInterval(pollDbVersion, 15000);
    return;
  }

  try {
    if (sseConnection) sseConnection.close();
    sseConnection = new EventSource('/api/sync/events');

    sseConnection.addEventListener('db_change', async (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log('[SYNC] Live database change event received:', data);

        // Invalidate matching keys in local client cache
        if (clientCache) {
          if (data.table === 'employees') {
            clientCache.invalidateByPrefix('/api/employees');
            clientCache.delete('/api/stats');
          } else if (data.table === 'attendance') {
            clientCache.invalidateByPrefix('/api/attendance');
            clientCache.delete('/api/stats');
          } else {
            clientCache.clear();
          }
        }
        eTags.clear();

        // Refresh components in real-time
        if (data.table === 'employees' || data.table === 'all') {
          await refreshEmployeesFromDB();
        }
        if (data.table === 'attendance' || data.table === 'all') {
          await refreshAttendanceFromDB();
        }

        // Live update whichever tab the user currently has open
        const activeTab = document.querySelector('.tc.on');
        if (activeTab) {
          if (activeTab.id === 'tab-dbd') {
            updateDbdStats();
            renderDbdGrid();
          } else if (activeTab.id === 'tab-hr') {
            updateStats();
          } else if (activeTab.id === 'tab-employee-list') {
            renderEmployeeGrid();
          } else if (activeTab.id === 'tab-company') {
            renderCompanyGrid();
          }
        }

        notify(`Real-Time Sync: ${data.table.toUpperCase()} updated`, 'ok');
      } catch (err) {
        console.error('[SYNC] Error processing change event:', err);
      }
    });

    sseConnection.onerror = () => {
      if (sseConnection.readyState === EventSource.CLOSED) {
        setTimeout(initRealtimeSync, 6000);
      }
    };
  } catch (err) {
    console.warn('[SYNC] SSE failed, starting heartbeat polling fallback:', err);
    setInterval(pollDbVersion, 15000);
  }
}

let lastKnownRevision = 1;
async function pollDbVersion() {
  try {
    const res = await fetch('/api/sync/version');
    if (!res.ok) return;
    const info = await res.json();
    if (info.revision && info.revision > lastKnownRevision) {
      lastKnownRevision = info.revision;
      if (clientCache) clientCache.clear();
      eTags.clear();
      await loadFromDB();
    }
  } catch {
    // Ignore polling network glitches
  }
}

async function refreshEmployeesFromDB() {
  const empRes = await apiFetch('/api/employees');
  if (empRes && empRes.success && Array.isArray(empRes.employees)) {
    EMP = empRes.employees.map(e => ({
      ...e,
      descriptor: new Float32Array(e.descriptor)
    }));
    // Re-index into Prefix Trie for O(L) fast search
    if (employeeTrie) {
      employeeTrie.clear();
      for (const emp of EMP) {
        employeeTrie.insert(emp.name, emp);
        employeeTrie.insert(emp.id, emp);
        employeeTrie.insert(emp.department, emp);
      }
    }
    renderEL();
  }
}

async function refreshAttendanceFromDB() {
  const attRes = await apiFetch('/api/attendance');
  if (attRes && attRes.success) {
    const attRows = attRes.attendance || attRes.attendance_logs || attRes.records;
    if (Array.isArray(attRows)) {
      ATT = attRows.map(r => ({
        empId:  r.emp_id,
        name:   r.name,
        dept:   r.dept,
        role:   r.role,
        ts:     r.timestamp,
        status: r.status,
        att_id: r.att_id
      }));
      renderLog();
      updateStats();
      updateDbdStats();
    }
  }
}


// ══════════════════════════════════════════════
// Initialisation
// ══════════════════════════════════════════════
async function init() {
  tick();
  setInterval(tick, 1000);

  try {
    await ensureAuth();
    sp(10, 'Loading SsdMobilenetv1...');
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MU);
    sp(30, 'Loading FaceLandmarks68...');
    await faceapi.nets.faceLandmark68Net.loadFromUri(MU);
    sp(50, 'Loading TinyFaceDetector...');
    await faceapi.nets.tinyFaceDetector.loadFromUri(MU);
    sp(65, 'Loading FaceLandmarks68Tiny...');
    await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MU);
    sp(80, 'Loading FaceRecognitionNet...');
    await faceapi.nets.faceRecognitionNet.loadFromUri(MU);
    sp(90, 'Loading employee data from database...');
    await loadFromDB();
    sp(100, 'All systems ready!');
    loaded = true;

    document.getElementById('mdot').className = 'mdot ok';
    document.getElementById('mst').textContent = 'AI Ready · DB Connected';

    await new Promise(r => setTimeout(r, 600));
    document.getElementById('ld').style.display = 'none';
    const ma = document.getElementById('ma');
    ma.style.display       = 'flex';
    ma.style.flexDirection = 'column';
    ma.style.flex          = '1';
    ma.style.overflow      = 'hidden';

    // Route to Mark Attendance tab if in user mode
    if (currentUser && currentUser.role === 'USER') {
      const attBtn = document.querySelector('button[data-tab="att"]');
      showTab('att', attBtn);
    }

    // Populate registration form date dropdowns on boot
    populateDateDropdowns('r-join-date-grp', null);
    populateDateDropdowns('r-confirm-date-grp', null);
    populateDateDropdowns('r-last-working-grp', '3000-01-01');
    populateDateDropdowns('r-exp-start-grp', '2000-01-01');
    populateDateDropdowns('r-exp-end-grp', '2030-12-31');

    // Populate company selects
    if (typeof updateCompanySelects === 'function') updateCompanySelects();

    // Start real-time database synchronization
    initRealtimeSync();

  } catch (e) {
    const pm = document.getElementById('pm');
    pm.textContent = 'Error: ' + e.message;
    pm.style.color = 'var(--err)';
    console.error(e);
  }
}

// ── Load all data from DB on startup ──────────
async function loadFromDB() {
  // Load companies
  if (typeof loadCompaniesFromAPI === 'function') {
    await loadCompaniesFromAPI();
  } else if (typeof window !== 'undefined' && typeof window.loadCompaniesFromAPI === 'function') {
    await window.loadCompaniesFromAPI();
  } else {
    try {
      const compRes = await apiFetch('/api/companies');
      if (compRes && compRes.success && Array.isArray(compRes.companies)) {
        COMPANIES = compRes.companies.map(c => ({
          id: c.id,
          code: c.code,
          name: c.name,
          short: c.short_name || c.short || c.code,
          short_name: c.short_name || c.short || c.code,
          address: c.address,
          city: c.city,
          employee_count: c.employee_count || 0,
          active: c.active
        }));
        if (typeof updateCompanySelects === 'function') updateCompanySelects();
      }
    } catch (e) {
      console.warn('[LOAD COMPANIES FALLBACK]', e.message);
    }
  }

  // Load employees
  const empRes = await apiGet('/api/employees?size=10000');
  if (empRes && empRes.success && Array.isArray(empRes.employees)) {
    EMP = empRes.employees.map(e => ({
      ...e,
      // Restore Float32Array from plain array stored as JSON
      descriptor: new Float32Array(e.descriptor)
    }));

    // Index into PrefixTrie for instant O(L) directory searches
    if (employeeTrie) {
      employeeTrie.clear();
      for (const emp of EMP) {
        employeeTrie.insert(emp.name, emp);
        employeeTrie.insert(emp.id, emp);
        employeeTrie.insert(emp.department, emp);
      }
    }
    renderEL();
  }


  // Load attendance records
  const attRes = await apiGet('/api/attendance');
  const attRows = attRes && attRes.success && (attRes.attendance || attRes.attendance_logs || attRes.records);
  if (Array.isArray(attRows)) {
    ATT = attRows.map(r => ({
      empId:  r.emp_id,
      name:   r.name,
      dept:   r.dept,
      role:   r.role,
      ts:     r.timestamp,
      status: r.status,
      att_id: r.att_id
    }));
    renderLog();
    updateStats();

    // ESSL Dashboard initialization
    updateDbdStats();
    renderDbdGrid();
    setupAutoRefresh();
  }
}
