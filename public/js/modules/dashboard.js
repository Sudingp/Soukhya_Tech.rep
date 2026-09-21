// ══════════════════════════════════════════════
// Clock
// ══════════════════════════════════════════════
function tick() {
  const now = new Date();
  document.getElementById('clk').textContent =
    now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

// ══════════════════════════════════════════════
// Loading progress
// ══════════════════════════════════════════════
function sp(pct, msg) {
  document.getElementById('pf').style.width = pct + '%';
  document.getElementById('pm').textContent  = msg;
}

// ══════════════════════════════════════════════
// Tab switching
// ══════════════════════════════════════════════
function showTab(id, btn) {
  document.querySelectorAll('.tc').forEach(t => t.classList.remove('on'));
  document.querySelectorAll('.tbtn').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.mbtn').forEach(b => b.classList.remove('on'));
  
  const targetTab = document.getElementById('tab-' + id);
  if (targetTab) targetTab.classList.add('on');
  
  if (btn) btn.classList.add('on');
  
  if (id === 'hr') {
    updateStats();
    const repSubTab = document.getElementById('sub-tab-hr-reports');
    if (repSubTab && repSubTab.classList.contains('on')) {
      generateMonthlyReport();
    }
  }
  if (id === 'dbd') {
    updateDbdStats();
    renderDbdGrid();
  }
  if (id === 'company') {
    loadCompaniesFromAPI();
  }
  if (id === 'employee-list') {
    renderEmployeeGrid();
    updateEmpListFilterDropdowns();
  }
  if (id === 'reg') {
    if (typeof initLiveGeoLocation === 'function') initLiveGeoLocation();
  }
  if (id !== 'att' && aStream) stopAttCam();
}

function showSubTab(subId, btn) {
  document.querySelectorAll('.sub-tc').forEach(t => t.classList.remove('on'));
  document.querySelectorAll('.sub-tbtn').forEach(b => b.classList.remove('on'));
  document.getElementById(subId).classList.add('on');
  btn.classList.add('on');
  if (subId === 'sub-tab-hr-reports') {
    generateMonthlyReport();
  }
}

// ──────────────────────────────────────────────
// ESSL Dashboard functions
// ──────────────────────────────────────────────
function updateDbdStats() {
  const regCount = EMP.length;
  const actCount = EMP.filter(e => e.status === 'Active' || e.status === 'Working' || e.status === 'Working' || e.status === 'Working').length;
  
  // Present today
  const todayStr = new Date().toISOString().slice(0, 10);
  const presentCount = new Set(
    ATT.filter(a => new Date(a.ts).toISOString().slice(0, 10) === todayStr)
       .map(a => a.empId)
  ).size;
  
  const devOnCount = DEVICES.filter(d => d.status === 'online').length;
  const devOffCount = DEVICES.filter(d => d.status === 'offline').length;
  
  const cardReg = document.getElementById('essl-card-reg');
  const cardAct = document.getElementById('essl-card-act');
  const cardPres = document.getElementById('essl-card-pres');
  const cardDevOn = document.getElementById('essl-card-dev-on');
  const cardDevOff = document.getElementById('essl-card-dev-off');

  if (cardReg) cardReg.textContent = regCount;
  if (cardAct) cardAct.textContent = actCount;
  if (cardPres) cardPres.textContent = presentCount;
  if (cardDevOn) cardDevOn.textContent = devOnCount;
  if (cardDevOff) cardDevOff.textContent = devOffCount;
}

function renderDbdGrid() {
  const locFilter = document.getElementById('dbd-filter-loc').value;
  const statusFilter = document.getElementById('dbd-filter-status').value;
  
  let filtered = [...DEVICES];
  if (locFilter !== 'All') {
    filtered = filtered.filter(d => d.location === locFilter);
  }
  if (statusFilter !== 'All') {
    filtered = filtered.filter(d => d.status === statusFilter);
  }
  
  const tbody = document.getElementById('dbd-grid-body');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="emp" style="text-align:center; padding:12px; color:var(--mu)">No devices found matching filters.</td></tr>`;
    const gridInfo = document.getElementById('dbd-grid-info');
    if (gridInfo) gridInfo.textContent = 'Records: 0 - 0 of 0';
    return;
  }
  
  let html = '';
  filtered.forEach(d => {
    html += `
      <tr style="border-bottom:1px solid #eee">
        <td style="padding:8px; border-right:1px solid #ccc; font-weight:bold">${d.sName}</td>
        <td style="padding:8px; border-right:1px solid #ccc">${d.fName}</td>
        <td style="padding:8px; border-right:1px solid #ccc; font-family:var(--mo)">${d.serialNo}</td>
        <td style="padding:8px; border-right:1px solid #ccc">${d.location}</td>
        <td style="padding:8px; border-right:1px solid #ccc">${d.lastPing}</td>
        <td style="padding:8px; color:${d.status === 'online' ? 'green' : 'red'}; font-weight:bold">${d.status}</td>
      </tr>
    `;
  });
  
  tbody.innerHTML = html;
  const gridInfo = document.getElementById('dbd-grid-info');
  if (gridInfo) gridInfo.textContent = `Records: 1 - ${filtered.length} of ${filtered.length}`;
}

function setupAutoRefresh() {
  const intervalInput = document.getElementById('dbd-refresh-interval');
  if (!intervalInput) return;

  let seconds = parseInt(intervalInput.value);
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  if (seconds > 60) seconds = 60;
  intervalInput.value = seconds;
  
  if (dbdRefreshTimer) {
    clearInterval(dbdRefreshTimer);
    dbdRefreshTimer = null;
  }
  
  if (seconds > 0) {
    dbdRefreshTimer = setInterval(() => {
      refreshDevicePings();
    }, seconds * 1000);
  }
}

function manualRefreshDbd() {
  notify('Refreshing dashboard and terminal statuses...', 'ok');
  refreshDevicePings();
}

function refreshDevicePings() {
  const now = new Date();
  const printTimeStr = now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + 
                       now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  
  DEVICES.forEach(d => {
    if (d.status === 'online') {
      d.lastPing = printTimeStr;
    }
  });
  
  updateDbdStats();
  renderDbdGrid();
}

// ══════════════════════════════════════════════
// Notifications
// ══════════════════════════════════════════════
function notify(msg, type = 'ok', dur = 3500) {
  const el = document.createElement('div');
  el.className = 'ni n' + type.charAt(0);
  el.innerHTML = (type === 'ok' ? '✓ ' : type === 'er' ? '✕ ' : '⚠ ') + msg;
  document.getElementById('ntf').appendChild(el);
  setTimeout(() => el.remove(), dur);
}

// ══════════════════════════════════════════════
// Registration — Camera
// ══════════════════════════════════════════════
async function startRegCam() {
  try {
    rStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 480 }
    });
    document.getElementById('rv').srcObject = rStream;
    document.getElementById('rp').style.display = 'none';
    document.getElementById('rcap').disabled = false;
    const rsc = document.getElementById('rsc');
    rsc.innerHTML = '● Live';
    rsc.style.color = 'var(--ac)';
  } catch (e) {
    notify('Camera denied. Allow camera permission.', 'er');
  }
}
