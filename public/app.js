// public/app.js — Soukhya Tech Face Attendance System with Hibernate Mode Support
// All face recognition runs in the browser (face-api.js).
// Employee data and attendance records are persisted via the Node.js REST API.

// ══════════════════════════════════════════════
// Config
// ══════════════════════════════════════════════
const API   = '';           // empty → same origin (served by Express)
const MU    = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

// ══════════════════════════════════════════════
// State
// ══════════════════════════════════════════════
let EMP     = [];           // [{id, name, department, role, descriptor, image, status, ...}]
let ATT     = [];           // [{att_id, emp_id, name, dept, role, timestamp, status}]
let rStream = null;
let aStream = null;
let aLoop   = null;
let loaded  = false;
let busy    = false;

// Directory Filter
let currentDirFilter = 'All';

// Company List State
let COMPANIES = [
  { name: 'Default', short: 'Default' },
  { name: 'GC', short: 'GC' },
  { name: 'Rail Infrastructure Development Company Ltd', short: 'KRIDE' }
];
let companySortField = 'name';
let companySortAsc = true;
let companyPage = 1;

// Employee List Grid State
let empListSortField = 'id';
let empListSortAsc = true;
let empListPage = 1;

// Chart.js instances
let rosterChart = null;
let deptChart = null;
let trendChart = null;

// Biometric Terminals Mock Data
let DEVICES = [
  { sName: 'KRIDE', fName: 'KRIDE', serialNo: 'TFEE260300053', location: 'BLR_RAJKUMAR', lastPing: '21-Apr-2026 11:57', status: 'online' },
  { sName: 'HQ Gate 1', fName: 'HQ Main Entrance', serialNo: 'TFEE260300054', location: 'HQ - Bangalore', lastPing: '21-Apr-2026 11:57', status: 'online' },
  { sName: 'IT Lab Gate', fName: 'IT Lab Entrance', serialNo: 'TFEE260300055', location: 'HQ - Bangalore', lastPing: '21-Apr-2026 11:57', status: 'online' },
  { sName: 'Delhi Reader', fName: 'Delhi Office Main', serialNo: 'TFEE260300056', location: 'Delhi Office', lastPing: '21-Apr-2026 08:30', status: 'offline' }
];
let dbdRefreshTimer = null;

// ══════════════════════════════════════════════
// API helpers
// ══════════════════════════════════════════════
let currentUser = null;
let authPendingResolve = null;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function ensureAuth() {
  const saved = localStorage.getItem('authToken');
  if (saved) {
    try {
      const meResp = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${saved}` }
      });
      if (meResp.ok) {
        const meData = await meResp.json();
        if (meData.success && meData.data) {
          currentUser = meData.data;
          applyRoleUI(currentUser.role);
          return saved;
        }
      }
    } catch (e) {
      console.warn('[AUTH] Token verification error:', e);
    }
    localStorage.removeItem('authToken');
  }

  // Not logged in: hide loading screen so login modal is displayed clearly
  const ld = document.getElementById('ld');
  if (ld) ld.style.display = 'none';

  showLoginModal();

  return new Promise((resolve) => {
    authPendingResolve = resolve;
  });
}

function showLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.style.display = 'flex';
    setTimeout(() => {
      const uInput = document.getElementById('login-username');
      if (uInput) uInput.focus();
    }, 50);
  }
}

async function handleLoginFormSubmit(e) {
  e.preventDefault();
  const uInput = document.getElementById('login-username');
  const pInput = document.getElementById('login-password');
  const errBox = document.getElementById('login-error-msg');
  const btn = document.getElementById('btn-login-submit');

  const username = uInput.value.trim();
  const password = pInput.value;
  if (!username || !password) return;

  btn.disabled = true;
  btn.textContent = 'Verifying Credentials...';
  errBox.style.display = 'none';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error?.message || 'Invalid username or password');
    }

    localStorage.setItem('authToken', data.data.access_token);
    if (data.data.refresh_token) localStorage.setItem('authRefreshToken', data.data.refresh_token);
    currentUser = { username: data.data.username, role: data.data.role };

    document.getElementById('login-modal').style.display = 'none';
    applyRoleUI(currentUser.role);
    notify(`Signed in as ${currentUser.username} (${currentUser.role} Mode)`, 'ok');

    if (authPendingResolve) {
      const resFn = authPendingResolve;
      authPendingResolve = null;
      if (!loaded) {
        const ld = document.getElementById('ld');
        if (ld) ld.style.display = 'flex';
      }
      resFn(data.data.access_token);
    } else {
      const ma = document.getElementById('ma');
      if (ma) ma.style.display = 'flex';
    }
  } catch (err) {
    errBox.textContent = err.message;
    errBox.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

function fillPresetCredentials(type) {
  const uInput = document.getElementById('login-username');
  const pInput = document.getElementById('login-password');
  const badge = document.getElementById('login-badge-mode');
  if (type === 'admin') {
    uInput.value = 'admin';
    pInput.value = 'admin123';
    badge.className = 'mode-badge admin';
    badge.textContent = '🛡️ ADMIN MODE';
  } else {
    uInput.value = 'user';
    pInput.value = 'user123';
    badge.className = 'mode-badge user';
    badge.textContent = '👤 USER MODE';
  }
  document.getElementById('login-error-msg').style.display = 'none';
}

function applyRoleUI(role) {
  const modeBadge = document.getElementById('mode-badge');
  const userDisplay = document.getElementById('user-display-tag');
  const switchCurrentLabel = document.getElementById('switch-current-mode-label');

  if (['ADMIN', 'HR'].includes(role)) {
    document.body.classList.remove('user-mode');
    if (modeBadge) {
      modeBadge.className = 'mode-badge admin';
      modeBadge.textContent = '🛡️ ADMIN MODE';
    }
    if (userDisplay) {
      userDisplay.textContent = `👤 ${currentUser?.username || 'admin'}`;
    }
    if (switchCurrentLabel) {
      switchCurrentLabel.textContent = 'ADMIN MODE';
      switchCurrentLabel.style.color = 'var(--ac)';
    }
  } else {
    document.body.classList.add('user-mode');
    if (modeBadge) {
      modeBadge.className = 'mode-badge user';
      modeBadge.textContent = '👤 USER MODE';
    }
    if (userDisplay) {
      userDisplay.textContent = `👤 ${currentUser?.username || 'user'}`;
    }
    if (switchCurrentLabel) {
      switchCurrentLabel.textContent = 'USER MODE';
      switchCurrentLabel.style.color = 'var(--ac2)';
    }
    const regTab = document.getElementById('tab-reg');
    const compTab = document.getElementById('tab-company');
    const empListTab = document.getElementById('tab-employee-list');
    if (regTab?.classList.contains('on') || compTab?.classList.contains('on') || empListTab?.classList.contains('on')) {
      const attBtn = document.querySelector('button[data-tab="att"]');
      showTab('att', attBtn);
    }
  }
  checkAutoShowChangelog();
}

function promptSwitchMode() {
  const modal = document.getElementById('switch-mode-modal');
  if (modal) {
    modal.style.display = 'flex';
    document.getElementById('switch-username').value = '';
    document.getElementById('switch-password').value = '';
    document.getElementById('switch-error-msg').style.display = 'none';
  }
}

function closeSwitchModeModal() {
  const modal = document.getElementById('switch-mode-modal');
  if (modal) modal.style.display = 'none';
}

function presetSwitchForm(type) {
  if (type === 'admin') {
    document.getElementById('switch-username').value = 'admin';
    document.getElementById('switch-password').value = 'admin123';
  } else {
    document.getElementById('switch-username').value = 'user';
    document.getElementById('switch-password').value = 'user123';
  }
}

async function doSwitchMode() {
  const username = document.getElementById('switch-username').value.trim();
  const password = document.getElementById('switch-password').value;
  const errBox = document.getElementById('switch-error-msg');

  if (!username || !password) {
    errBox.textContent = 'Please enter both username and password';
    errBox.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error?.message || 'Invalid username or password');
    }

    localStorage.setItem('authToken', data.data.access_token);
    if (data.data.refresh_token) localStorage.setItem('authRefreshToken', data.data.refresh_token);
    currentUser = { username: data.data.username, role: data.data.role };

    closeSwitchModeModal();
    applyRoleUI(currentUser.role);
    notify(`Switched account to ${currentUser.username} (${currentUser.role} Mode)`, 'ok');

    if (currentUser.role === 'USER') {
      const attBtn = document.querySelector('button[data-tab="att"]');
      showTab('att', attBtn);
    } else {
      const dbdBtn = document.querySelector('button[onclick*="tab-dbd"], button[data-tab="dbd"], .mbtn.on');
      showTab('dbd', dbdBtn);
    }
  } catch (err) {
    errBox.textContent = err.message;
    errBox.style.display = 'block';
  }
}

async function doLogOff() {
  notify('Logging off session...', 'wn');
  try {
    const token = localStorage.getItem('authToken');
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    }
  } catch (e) {
    console.warn('[AUTH] Logout request error:', e);
  }

  localStorage.removeItem('authToken');
  localStorage.removeItem('authRefreshToken');
  currentUser = null;

  if (aStream) stopAttCam();
  if (rStream) stopRegCam();

  document.getElementById('ma').style.display = 'none';
  showLoginModal();
}

function openUserMgmtModal() {
  if (currentUser && !['ADMIN', 'HR'].includes(currentUser.role)) {
    notify('Access denied: Administrator privileges required', 'er');
    return;
  }
  const modal = document.getElementById('user-mgmt-modal');
  if (modal) {
    modal.style.display = 'flex';
    loadSystemUsers();
  }
}

function closeUserMgmtModal() {
  const modal = document.getElementById('user-mgmt-modal');
  if (modal) modal.style.display = 'none';
}

// ══════════════════════════════════════════════
// CHANGELOG MODAL CONTROLLER (v2.0)
// ══════════════════════════════════════════════
function openChangelogModal(forceTab) {
  const modal = document.getElementById('changelog-modal');
  if (!modal) return;

  const isAdmin = ['ADMIN', 'HR'].includes(currentUser?.role) || !document.body.classList.contains('user-mode');
  const targetTab = forceTab || (isAdmin ? 'admin' : 'user');
  switchChangelogTab(targetTab);

  const roleIndicator = document.getElementById('cl-role-indicator');
  if (roleIndicator) {
    const roleName = currentUser?.role || (isAdmin ? 'ADMIN' : 'USER');
    roleIndicator.textContent = `ROLE: ${roleName}`;
  }

  const dontShowChk = document.getElementById('cl-dont-show-chk');
  if (dontShowChk) {
    dontShowChk.checked = localStorage.getItem('changelog_dismiss_v2') === 'true';
  }

  modal.style.display = 'flex';
}

function closeChangelogModal(e) {
  if (e && e.target && e.target.id !== 'changelog-modal') return;
  const modal = document.getElementById('changelog-modal');
  if (modal) modal.style.display = 'none';
}

function switchChangelogTab(tab) {
  const userBtn = document.getElementById('cl-tab-user-btn');
  const adminBtn = document.getElementById('cl-tab-admin-btn');
  const userView = document.getElementById('cl-view-user');
  const adminView = document.getElementById('cl-view-admin');
  const roleIndicator = document.getElementById('cl-role-indicator');

  if (tab === 'admin') {
    adminBtn?.classList.add('active');
    userBtn?.classList.remove('active');
    if (adminView) adminView.style.display = 'block';
    if (userView) userView.style.display = 'none';
    if (roleIndicator) roleIndicator.textContent = 'VIEW: ADMIN TECHNICAL';
  } else {
    userBtn?.classList.add('active');
    adminBtn?.classList.remove('active');
    if (userView) userView.style.display = 'block';
    if (adminView) adminView.style.display = 'none';
    if (roleIndicator) roleIndicator.textContent = 'VIEW: USER HIGHLIGHTS';
  }
}

function toggleChangelogPref(checked) {
  localStorage.setItem('changelog_dismiss_v2', checked ? 'true' : 'false');
}

let changelogAutoShown = false;
function checkAutoShowChangelog() {
  if (changelogAutoShown) return;
  const dismissed = localStorage.getItem('changelog_dismiss_v2');
  if (dismissed !== 'true') {
    changelogAutoShown = true;
    setTimeout(() => {
      openChangelogModal();
    }, 600);
  }
}

async function loadSystemUsers() {
  const tbody = document.getElementById('user-mgmt-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="padding:12px; text-align:center; color:var(--mu)">Loading system accounts...</td></tr>';

  try {
    const res = await apiGet('/api/admin/users', false);
    const users = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="padding:12px; text-align:center; color:var(--mu)">No users registered</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => {
      const isSelf = currentUser && currentUser.username === u.username;
      const isAdmin = u.role === 'ADMIN';
      const roleColor = isAdmin ? 'var(--ac)' : (u.role === 'HR' ? 'var(--warn)' : 'var(--ac2)');
      return `
        <tr style="border-bottom:1px solid var(--br)">
          <td style="padding:8px 12px; font-family:var(--mo); color:var(--mu)">#${u.id}</td>
          <td style="padding:8px 12px; font-weight:600; color:var(--tx)">${escapeHtml(u.username)} ${isSelf ? '<span style="font-size:10px; color:var(--ac)">(You)</span>' : ''}</td>
          <td style="padding:8px 12px"><span style="color:${roleColor}; font-weight:600; font-size:11px">${u.role}</span></td>
          <td style="padding:8px 12px; font-size:11px; color:var(--mu)">${u.created_at ? u.created_at.slice(0, 16) : '-'}</td>
          <td style="padding:8px 12px; text-align:right">
            <button class="btn bsm" style="margin-right:6px; font-size:11px; padding:2px 8px" onclick="resetUserPasswordPrompt(${u.id}, '${escapeHtml(u.username)}')">Reset Password</button>
            ${(!isSelf && !isAdmin) ? `<button class="btn bsm" style="color:var(--err); border-color:var(--err); font-size:11px; padding:2px 8px" onclick="deleteUserPrompt(${u.id}, '${escapeHtml(u.username)}')">Delete</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:12px; text-align:center; color:var(--err)">Error: ${err.message}</td></tr>`;
  }
}

async function createSystemUser() {
  const uInput = document.getElementById('new-user-name');
  const pInput = document.getElementById('new-user-pass');
  const rInput = document.getElementById('new-user-role');

  const username = uInput.value.trim();
  const password = pInput.value;
  const role = rInput.value;

  if (!username || !password) {
    notify('Please enter both username and password', 'er');
    return;
  }
  if (password.length < 6) {
    notify('Password must be at least 6 characters', 'wn');
    return;
  }

  try {
    const res = await apiPost('/api/admin/users', { username, password, role });
    if (res && (res.success || res.id || res.data?.id)) {
      notify(`User ${username} created successfully with role ${role}`, 'ok');
      uInput.value = '';
      pInput.value = '';
      loadSystemUsers();
    } else {
      throw new Error(res?.error?.message || 'Failed to create user');
    }
  } catch (err) {
    notify(`Create user failed: ${err.message}`, 'er');
  }
}

async function resetUserPasswordPrompt(userId, username) {
  const newPass = prompt(`Enter new password for user '${username}' (min 6 characters):`);
  if (!newPass) return;
  if (newPass.length < 6) {
    notify('Password must be at least 6 characters', 'wn');
    return;
  }

  try {
    const res = await apiPost(`/api/admin/users/${userId}/reset-password`, { new_password: newPass });
    const msg = res?.data?.message || res?.message || `Password reset successfully for ${username}`;
    notify(msg, 'ok');
  } catch (err) {
    notify(`Password reset failed: ${err.message}`, 'er');
  }
}

async function deleteUserPrompt(userId, username) {
  if (!confirm(`Are you sure you want to delete user '${username}'? This cannot be undone.`)) {
    return;
  }

  try {
    await apiDelete(`/api/admin/users/${userId}`);
    notify(`User '${username}' deleted successfully`, 'ok');
    loadSystemUsers();
  } catch (err) {
    notify(`Failed to delete user: ${err.message}`, 'er');
  }
}

// ══════════════════════════════════════════════
// DSA Engine & Client Caching Layer
// ══════════════════════════════════════════════
const clientCache = (typeof LRUCache !== 'undefined')
  ? new LRUCache({ capacity: 500, defaultTTL: 60000, sweepInterval: 15000 })
  : null;

const employeeTrie = (typeof PrefixTrie !== 'undefined')
  ? new PrefixTrie()
  : null;

const eTags = new Map();

async function apiFetch(path, opts = {}) {
  let token = localStorage.getItem('authToken');
  if (!token && path !== '/api/auth/login') {
    token = await ensureAuth();
  }

  const method = (opts.method || 'GET').toUpperCase();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(opts.headers || {})
  };

  // Conditional GET via ETag (O(1) HTTP 304 Not Modified validation)
  if (method === 'GET' && eTags.has(path)) {
    headers['If-None-Match'] = eTags.get(path);
  }

  try {
    const res = await fetch(API + path, { ...opts, headers });

    // HTTP 304 Not Modified -> Serve instantaneously from local LRU cache
    if (res.status === 304 && clientCache && clientCache.has(path)) {
      return clientCache.get(path);
    }

    if (res.status === 401 && path !== '/api/auth/login') {
      localStorage.removeItem('authToken');
      const freshToken = await ensureAuth();
      const retryHeaders = {
        ...headers,
        Authorization: `Bearer ${freshToken}`
      };
      const retry = await fetch(API + path, { ...opts, headers: retryHeaders });
      return retry.json();
    }

    // Capture and index server ETag
    const responseETag = res.headers.get('ETag');
    if (responseETag) {
      eTags.set(path, responseETag);
    }

    const data = await res.json();

    // Cache successful GET responses in client-side LRU Cache with TTL
    if (method === 'GET' && res.ok && clientCache) {
      const ttl = path.includes('/api/stats') ? 30000 : 120000;
      clientCache.set(path, data, ttl, [path.split('?')[0]]);
    }

    return data;
  } catch (err) {
    if (method === 'GET' && clientCache && clientCache.has(path)) {
      console.warn('[CACHE] Offline fallback, serving from local LRU cache:', path);
      return clientCache.get(path);
    }
    throw err;
  }
}

const apiGet    = (path, useCache = true) => {
  if (useCache && clientCache && clientCache.has(path)) {
    return Promise.resolve(clientCache.get(path));
  }
  return apiFetch(path);
};
const apiPost   = (path, body)   => apiFetch(path, { method: 'POST',   body: JSON.stringify(body) });
const apiPut    = (path, body)   => apiFetch(path, { method: 'PUT',    body: JSON.stringify(body) });
const apiDelete = (path)         => apiFetch(path, { method: 'DELETE' });

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
  if (empRes && empRes.success) {
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
    ATT = attRes.records.map(r => ({
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
    updateCompanySelects();

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
  await loadCompaniesFromAPI();

  // Load employees
  const empRes = await apiGet('/api/employees?size=10000');
  if (empRes && empRes.success) {
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
  if (attRes.success) {
    ATT = attRes.records.map(r => ({
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

// ══════════════════════════════════════════════
// Registration — Form conditional fields
// ══════════════════════════════════════════════
function toggleHibFields(status) {
  const hFields = document.getElementById('r-hib-fields');
  if (status === 'Hibernate') {
    hFields.style.display = 'block';
  } else {
    hFields.style.display = 'none';
    // Clear values
    document.getElementById('r-hib-start').value = '';
    document.getElementById('r-hib-end').value = '';
    document.getElementById('r-hib-reason').value = '';
  }
}

// ── Toggle optional registration form fields ──
function toggleOptionalFormFields() {
  const fields = document.getElementById('r-opt-fields');
  const btn = document.getElementById('toggle-opt-btn');
  if (!fields || !btn) return;
  
  if (fields.style.display === 'none') {
    fields.style.display = 'block';
    btn.innerHTML = '➖ Hide Enterprise Details (Optional)';
  } else {
    fields.style.display = 'none';
    btn.innerHTML = '➕ Show Enterprise Details (Optional)';
  }
}

// ══════════════════════════════════════════════
// Registration — Capture & Save
// ══════════════════════════════════════════════
// ── Register form status toggle ──
function toggleRegHibFields(status) {
  const hRow = document.getElementById('r-hib-fields-row');
  if (status === 'Not Working') {
    hRow.style.display = 'grid';
  } else {
    hRow.style.display = 'none';
    document.getElementById('r-hib-start').value = '';
    document.getElementById('r-hib-end').value = '';
    document.getElementById('r-hib-reason').value = '';
  }
}

// ── Reset Register Form ──
function resetRegForm() {
  document.getElementById('r-id').value = '';
  document.getElementById('r-name').value = '';
  document.getElementById('r-device-code').value = '';
  document.getElementById('r-role').value = '';
  document.getElementById('r-card-number').value = '';
  document.getElementById('r-aadhaar').value = '';
  document.getElementById('r-pan').value = '';
  document.getElementById('r-phone').value = '';
  document.getElementById('r-email').value = '';
  document.getElementById('r-reporting-to').value = '';
  document.getElementById('r-expiry-rule').checked = false;
  document.getElementById('r-status').value = 'Working';
  toggleRegHibFields('Working');
  
  // reset date select dropdowns
  populateDateDropdowns('r-join-date-grp', null);
  populateDateDropdowns('r-confirm-date-grp', null);
  populateDateDropdowns('r-last-working-grp', '3000-01-01');
  populateDateDropdowns('r-exp-start-grp', '2000-01-01');
  populateDateDropdowns('r-exp-end-grp', '2030-12-31');

  // Clear canvas and photo previews
  const c = document.getElementById('rc');
  if (c) c.getContext('2d').clearRect(0,0,c.width,c.height);
  const p = document.getElementById('cprev');
  if (p) p.style.display = 'none';
  
  notify('Registration form cleared.', 'wn');
}

// Simulated Sync actions for register form
function syncRegFormDevices() {
  const name = document.getElementById('r-name').value.trim() || 'New Employee';
  notify(`Syncing "${name}" registration to 5 terminals...`, 'wn');
  setTimeout(() => {
    notify('Device sync complete. Ready to receive biometric logs.', 'ok');
  }, 1800);
}

function unsyncRegFormDevices() {
  const name = document.getElementById('r-name').value.trim() || 'New Employee';
  notify(`Removing active reader sync registry for "${name}"...`, 'wn');
  setTimeout(() => {
    notify('Terminals unregistered successfully.', 'ok');
  }, 1800);
}

// ══════════════════════════════════════════════
// Face Detection Helpers
// ══════════════════════════════════════════════
function drawCorners(ctx, box, color) {
  const { x, y, width, height } = box;
  const len = Math.min(width, height) * 0.2; // length of corner lines
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  
  // Top-left
  ctx.moveTo(x, y + len);
  ctx.lineTo(x, y);
  ctx.lineTo(x + len, y);
  
  // Top-right
  ctx.moveTo(x + width - len, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + len);
  
  // Bottom-left
  ctx.moveTo(x, y + height - len);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x + len, y + height);
  
  // Bottom-right
  ctx.moveTo(x + width - len, y + height);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + width, y + height - len);
  
  ctx.stroke();
}

async function detectFaceWithFallback(vid) {
  // 1. Primary: Try SsdMobilenetv1 first (robust to varied lighting & rotation)
  let det = await faceapi
    .detectSingleFace(vid, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 }))
    .withFaceLandmarks(false) // use standard faceLandmark68Net
    .withFaceDescriptor();

  if (det) {
    return det;
  }

  // 2. Fallback: Try TinyFaceDetector with lenient configuration
  det = await faceapi
    .detectSingleFace(vid, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
    .withFaceLandmarks(true) // use faceLandmark68TinyNet
    .withFaceDescriptor();

  return det;
}

// ══════════════════════════════════════════════
// Registration — Capture & Save
// ══════════════════════════════════════════════
async function doRegister() {
  if (!loaded) { notify('AI not ready yet.', 'wn'); return; }

  const id        = document.getElementById('r-id').value.trim();
  const name      = document.getElementById('r-name').value.trim();
  const dept      = document.getElementById('r-dept').value;
  const role      = document.getElementById('r-role').value.trim();
  const statusVal = document.getElementById('r-status').value; // 'Working' or 'Not Working'

  // Harvest new eTimeTrackLite inputs
  const deviceCode   = document.getElementById('r-device-code').value.trim();
  const subDept      = document.getElementById('r-sub-dept').value;
  const grade        = document.getElementById('r-grade').value;
  const loc          = document.getElementById('r-location').value;
  const category     = document.getElementById('r-category').value;
  const shiftGroup   = document.getElementById('r-shift-group').value;
  
  const isMale       = document.getElementById('r-sex-male').checked;
  const gender       = isMale ? 'Male' : 'Female';

  const cardNumber   = document.getElementById('r-card-number').value.trim();
  const expiryRule   = document.getElementById('r-expiry-rule').checked;

  const company      = document.getElementById('r-company').value;
  const division     = document.getElementById('r-division').value;
  const team         = document.getElementById('r-team').value;
  const empType      = document.getElementById('r-emp-type').value;
  const holidayGroup = document.getElementById('r-holiday-group').value;
  const shiftRoster  = document.getElementById('r-shift-roster').value;
  const aadhaar      = document.getElementById('r-aadhaar').value.trim();
  const geofence     = document.getElementById('r-geofence').value;
  const verType      = document.getElementById('r-verification-type').value;

  // Compliance
  const pan          = document.getElementById('r-pan').value.trim();
  const phone        = document.getElementById('r-phone').value.trim();
  const email        = document.getElementById('r-email').value.trim();
  const reportingTo  = document.getElementById('r-reporting-to').value.trim();

  // Date selects
  const joinDate     = getISOFromDateDropdowns('r-join-date-grp');
  const confirmDate  = getISOFromDateDropdowns('r-confirm-date-grp');
  const lastWorkingDay = getISOFromDateDropdowns('r-last-working-grp');
  const expStart     = getISOFromDateDropdowns('r-exp-start-grp');
  const expEnd       = getISOFromDateDropdowns('r-exp-end-grp');

  // Hibernate conditions
  const hibStart  = document.getElementById('r-hib-start').value;
  const hibEnd    = document.getElementById('r-hib-end').value;
  const hibReason = document.getElementById('r-hib-reason').value.trim();

  if (!id || !name || !role) { notify('Please fill all mandatory core fields: Employee Code, Name, Designation.', 'wn'); return; }

  // Map Employment status to Active/Resigned or Hibernate
  let mappedStatus = 'Active';
  if (statusVal === 'Not Working') {
    if (hibStart && hibEnd && hibReason) {
      mappedStatus = 'Hibernate';
    } else {
      mappedStatus = 'Resigned';
    }
  }

  if (EMP.find(e => e.id === id)) { notify('Employee Code already exists.', 'er'); return; }
  if (!rStream) { notify('Start camera first to capture biometric face encoding.', 'wn'); return; }

  const vid  = document.getElementById('rv');
  const rst  = document.getElementById('rst');
  rst.innerHTML = '<div class="det" style="margin:0">Detecting face encoding...</div>';
  
  // Disable button
  const capBtn = document.getElementById('rcap-lnk');
  if (capBtn) capBtn.disabled = true;

  try {
    const det = await detectFaceWithFallback(vid);

    if (!det) {
      rst.innerHTML = '<div style="color:var(--err);font-size:11px">⚠ No face detected. Centre your face in the frame.</div>';
      if (capBtn) capBtn.disabled = false;
      return;
    }

    // Draw bounding box on canvas
    const cv  = document.getElementById('rc');
    cv.width  = vid.videoWidth  || 640;
    cv.height = vid.videoHeight || 480;
    const ctx = cv.getContext('2d');
    ctx.drawImage(vid, 0, 0, cv.width, cv.height);
    const b = det.detection.box;
    ctx.strokeStyle = '#00d4aa'; ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.width, b.height);
    drawCorners(ctx, b, '#00d4aa');

    const imgData = cv.toDataURL('image/jpeg', .8);
    const prev    = document.getElementById('cprev');
    prev.src      = imgData;
    prev.style.display = 'block';

    // ── POST to database ──────────────────────
    const payload = {
      id,
      name,
      department: dept,
      role,
      descriptor: Array.from(det.descriptor),   
      image:      imgData,
      status:     mappedStatus,
      hibernate_start_date: mappedStatus === 'Hibernate' ? hibStart : null,
      hibernate_end_date: mappedStatus === 'Hibernate' ? hibEnd : null,
      hibernate_reason: mappedStatus === 'Hibernate' ? hibReason : null,
      
      company,
      designation: role,
      gender,
      date_of_joining: joinDate,
      date_of_confirmation: confirmDate,
      last_working_day: lastWorkingDay,
      aadhaar_number: aadhaar,
      pan_number: pan || null,
      card_number: cardNumber || null,
      phone_no: phone || null,
      email: email || null,
      reporting_to: reportingTo || null,

      // Replica fields
      device_code: deviceCode || null,
      sub_department: subDept,
      division,
      grade,
      team,
      location: loc,
      employment_type: empType,
      category,
      holiday_group: holidayGroup,
      shift_group: shiftGroup,
      shift_roster: shiftRoster,
      geofence,
      device_expiry_rule_applicable: expiryRule,
      verification_type: verType,
      expiry_start_date: expStart,
      expiry_end_date: expEnd
    };

    const apiRes = await apiPost('/api/employees', payload);

    if (!apiRes.success) {
      rst.innerHTML = `<div style="color:var(--err);font-size:11px">✕ ${apiRes.error}</div>`;
      if (capBtn) capBtn.disabled = false;
      return;
    }

    // Update local state
    EMP.push({ 
      id, 
      name, 
      department: dept, 
      role, 
      descriptor: det.descriptor, 
      image: imgData,
      status: mappedStatus,
      hibernate_start_date: mappedStatus === 'Hibernate' ? hibStart : null,
      hibernate_end_date: mappedStatus === 'Hibernate' ? hibEnd : null,
      hibernate_reason: mappedStatus === 'Hibernate' ? hibReason : null,
      company,
      designation: role,
      gender,
      dateOfJoining: joinDate,
      dateOfConfirmation: confirmDate,
      lastWorkingDay,
      aadhaarNumber: aadhaar,
      panNumber: pan || null,
      cardNumber,
      phoneNo: phone || null,
      email: email || null,
      reportingTo: reportingTo || null,

      deviceCode,
      subDepartment: subDept,
      division,
      grade,
      team,
      location: loc,
      employmentType: empType,
      category,
      holidayGroup,
      shiftGroup,
      shiftRoster,
      geofence,
      deviceExpiryRuleApplicable: expiryRule,
      verificationType: verType,
      expiryStartDate: expStart,
      expiryEndDate: expEnd
    });
    
    rst.innerHTML = `<div style="color:var(--ok);font-size:11px">✓ ${name} registered successfully.</div>`;
    renderEL();
    updateStats();
    notify(name + ' registered successfully! <span class="db-badge">DB</span>', 'ok');

    // Reset Form completely
    resetRegForm();

  } catch (e) {
    console.error(e);
    rst.innerHTML = '<div style="color:var(--err);font-size:11px">Detection error. Try again.</div>';
  }

  if (capBtn) capBtn.disabled = false;
}

// ══════════════════════════════════════════════
// Roster Filtering (Employee list)
// ══════════════════════════════════════════════
function filterEmpDirectory(status, btn) {
  currentDirFilter = status;
  
  // Toggle active class on selection pills
  document.querySelectorAll('.ef-pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  
  renderEL();
}

// ── Toggle detailed profile accordion drawer in list ──
function toggleEmployeeDetails(id, event) {
  const details = document.getElementById(id);
  if (!details) return;
  
  // Don't trigger if click occurred on the delete button
  if (event.target.closest('button')) return;
  
  if (details.style.display === 'none') {
    details.style.display = 'block';
    details.parentElement.classList.add('selected-item');
  } else {
    details.style.display = 'none';
    details.parentElement.classList.remove('selected-item');
  }
}

// ══════════════════════════════════════════════
// Render Employee List
// ══════════════════════════════════════════════
function renderEL() {
  const el = document.getElementById('elist');
  const searchInput = document.getElementById('emp-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  
  // Apply directory filters
  let filtered = [...EMP];
  if (currentDirFilter !== 'All') {
    filtered = EMP.filter(e => e.status === currentDirFilter);
  }

  // Apply search query filter
  if (query) {
    filtered = filtered.filter(e => 
      (e.name || '').toLowerCase().includes(query) ||
      (e.id || '').toLowerCase().includes(query) ||
      (e.department || e.dept || '').toLowerCase().includes(query) ||
      (e.role || '').toLowerCase().includes(query)
    );
  }

  document.getElementById('ecnt').textContent = filtered.length + ' employee' + (filtered.length !== 1 ? 's' : '');

  if (!filtered.length) {
    el.innerHTML = `<div class="emp">No employees match filters.</div>`;
    return;
  }

  el.innerHTML = filtered.map(e => {
    let chipClass = 'cp'; // Active
    if (e.status === 'Hibernate') chipClass = 'cl';
    if (e.status === 'On Leave') chipClass = 'cb';
    if (e.status === 'Resigned') chipClass = 'cu';

    const hTitle = e.status === 'Hibernate' 
      ? `title="Reason: ${e.hibernate_reason || 'N/A'}\nDates: ${e.hibernate_start_date} to ${e.hibernate_end_date}"` 
      : '';

    // Standardize database properties loaded via Spring API vs newly pushed
    const company = e.company || 'N/A';
    const gender = e.gender || 'N/A';
    const cardNo = e.cardNumber || e.card_number || 'N/A';
    const phone = e.phoneNo || e.phone_no || 'N/A';
    const email = e.email || 'N/A';
    const reporting = e.reportingTo || e.reporting_to || 'N/A';
    const aadhaar = e.aadhaarNumber || e.aadhaar_number || 'N/A';
    const pan = e.panNumber || e.pan_number || 'N/A';
    const joined = e.dateOfJoining || e.date_of_joining || 'N/A';
    const confirmed = e.dateOfConfirmation || e.date_of_confirmation || 'N/A';
    const exited = e.lastWorkingDay || e.last_working_day || 'N/A';
    const loc = e.location || 'N/A';
    const empType = e.employmentType || e.employment_type || 'N/A';

    return `
      <div class="eit eit-clickable" onclick="toggleEmployeeDetails('details-${e.id}', event)">
        <div style="display:flex;align-items:center;width:100%;gap:9px">
          <div class="eav">
            ${e.image || e.img ? `<img src="${e.image || e.img}" alt="${e.name}">` : ''}
          </div>
          <div class="eii">
            <div class="ein">${e.name}</div>
            <div class="eim">${e.id} · ${e.department || e.dept} · ${e.role}</div>
          </div>
          <span class="chip ${chipClass}" ${hTitle}>${e.status || 'Active'}</span>
        </div>
        
        <!-- Expandable Details Drawer -->
        <div id="details-${e.id}" class="eit-details" style="display:none">
          <div class="details-grid">
            <div><strong>Company:</strong> ${company}</div>
            <div><strong>Sex:</strong> ${gender}</div>
            <div><strong>Phone:</strong> ${phone}</div>
            <div><strong>Email:</strong> ${email}</div>
            <div><strong>Card No:</strong> ${cardNo}</div>
            <div><strong>Reporting To:</strong> ${reporting}</div>
            <div><strong>Aadhaar:</strong> ${aadhaar}</div>
            <div><strong>PAN:</strong> ${pan}</div>
            <div><strong>Grade:</strong> ${e.grade || 'N/A'}</div>
            <div><strong>Location:</strong> ${loc}</div>
            <div><strong>Emp Type:</strong> ${empType}</div>
            <div><strong>Category:</strong> ${e.category || 'N/A'}</div>
          </div>
          <div class="details-dates">
            <div><strong>Joined:</strong> ${joined}</div>
            <div><strong>Confirmed:</strong> ${confirmed}</div>
            <div><strong>Last Day:</strong> ${exited}</div>
          </div>
          
          <!-- eTimeTrackLite action link buttons -->
          <div class="details-actions">
            <button class="act-lnk" onclick="event.stopPropagation(); showLeaveSummary('${e.id}')">Leave Summary</button>
            <span class="act-sep">|</span>
            <button class="act-lnk" onclick="event.stopPropagation(); showShiftDetails('${e.id}')">Shift Details</button>
            <span class="act-sep">|</span>
            <button class="act-lnk" onclick="event.stopPropagation(); showOtherDetails('${e.id}')">Other Details</button>
            <span class="act-sep">|</span>
            <button class="act-lnk" onclick="event.stopPropagation(); showPayDetails('${e.id}')">Pay Details</button>
            <span class="act-sep">|</span>
            <button class="act-lnk" onclick="event.stopPropagation(); toggleEmployeePhoto('${e.id}', event)">Photo</button>
            <span class="act-sep">|</span>
            <button class="act-lnk danger" onclick="event.stopPropagation(); deleteEmployee('${e.id}')">Delete</button>
            <span class="act-sep">|</span>
            <button class="act-lnk edit-btn" onclick="event.stopPropagation(); openEmpModal('${e.id}')">Edit</button>
            <span class="act-sep">|</span>
            <button class="act-lnk" onclick="event.stopPropagation(); enrollFinger('${e.id}')">Finger | Bio</button>
          </div>
          
          <!-- Photo Container -->
          <div id="photo-preview-${e.id}" class="drawer-photo-preview" style="display:none">
            ${e.image || e.img ? `<img src="${e.image || e.img}" alt="Face encoding snapshot">` : '<div class="no-img-text">No camera image stored</div>'}
          </div>
        </div>
      </div>`;
  }).join('');

  // Keep full Employee List grid in sync
  if (typeof renderEmployeeGrid === 'function') {
    renderEmployeeGrid();
    updateEmpListFilterDropdowns();
  }
}

// ── Delete employee ────────────────────────────
async function deleteEmployee(id) {
  if (!confirm(`Remove employee ${id} from the system? Their attendance records will also be deleted.`)) return;
  const res = await apiDelete('/api/employees/' + id);
  if (res.success) {
    EMP = EMP.filter(e => e.id !== id);
    ATT = ATT.filter(a => a.empId !== id);
    renderEL();
    renderLog();
    updateStats();
    notify('Employee removed from database.', 'wn');
  } else {
    notify(res.error || 'Failed to delete employee.', 'er');
  }
}

// ══════════════════════════════════════════════
// Attendance — Camera
// ══════════════════════════════════════════════
async function startAttCam() {
  if (!EMP.length) { notify('Register employees first.', 'wn'); return; }
  try {
    aStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 480 }
    });
    const vid = document.getElementById('av');
    vid.srcObject = aStream;
    document.getElementById('ap').style.display   = 'none';
    document.getElementById('asc').style.display  = 'none';
    document.getElementById('asto').style.display = 'inline-flex';
    document.getElementById('det').style.display  = 'block';
    vid.addEventListener('loadeddata', () => { aLoop = setInterval(recognize, 1500); }, { once: true });
  } catch (e) {
    notify('Camera access denied.', 'er');
  }
}

// ── Stop Attendance Camera ────────────────────
function stopAttCam() {
  if (aStream) { aStream.getTracks().forEach(t => t.stop()); aStream = null; }
  if (aLoop)   { clearInterval(aLoop); aLoop = null; }
  const vid = document.getElementById('av');
  vid.srcObject = null;
  document.getElementById('ap').style.display   = 'flex';
  document.getElementById('asc').style.display  = 'inline-flex';
  document.getElementById('asto').style.display = 'none';
  document.getElementById('det').style.display  = 'none';
  const c = document.getElementById('ac');
  c.getContext('2d').clearRect(0, 0, c.width, c.height);
  setRes('', '');
}

// ══════════════════════════════════════════════
// Face recognition loop
// ══════════════════════════════════════════════
async function recognize() {
  if (!loaded || busy || !EMP.length) return;
  const vid = document.getElementById('av');
  if (!vid.srcObject || vid.paused || vid.ended) return;
  busy = true;

  try {
    const det = await detectFaceWithFallback(vid);

    const cv  = document.getElementById('ac');
    cv.width  = vid.videoWidth  || 640;
    cv.height = vid.videoHeight || 480;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);

    if (!det) { setRes('', ''); busy = false; return; }

    const b       = det.detection.box;
    const matcher = new faceapi.FaceMatcher(
      EMP.map(e => new faceapi.LabeledFaceDescriptors(e.id, [e.descriptor])),
      0.55
    );
    const match  = matcher.findBestMatch(det.descriptor);
    const isUnk  = match.label === 'unknown';

    ctx.strokeStyle = isUnk ? '#ef4444' : '#00d4aa';
    ctx.lineWidth   = 2;
    ctx.strokeRect(b.x, b.y, b.width, b.height);
    drawCorners(ctx, b, isUnk ? '#ef4444' : '#00d4aa');

    if (isUnk) {
      setRes('unk', `
        <div class="remp">
          <div class="ravi" style="border-color:var(--err);color:var(--err)">?</div>
          <div>
            <div class="rn" style="color:var(--err)">Unknown Person</div>
            <div class="rm">Not registered in system</div>
          </div>
        </div>`, 10);
    } else {
      const emp  = EMP.find(e => e.id === match.label);
      if (emp) {
        const conf  = Math.round((1 - match.distance) * 100);
        
        // ── ATTENDANCE RULES: Guard for Hibernate Mode ──
        if (emp.status === 'Hibernate') {
          const html = `
            <div class="remp hiber-alert animate-shake">
              <div class="ravi" style="border-color:#f59e0b;color:#f59e0b;background:rgba(245,158,11,0.1)">⬡</div>
              <div>
                <div class="rn" style="color:#f59e0b">${emp.name}</div>
                <div class="rm">${emp.id} · ${emp.department || emp.dept} · ${emp.role}</div>
                <div class="hib-text-alert animate-pulse" style="margin-top:8px;font-size:12px;color:var(--err);font-weight:600;line-height:1.4">
                  Employee currently in Hibernate Mode<br>
                  Attendance disabled
                </div>
                <div style="font-size:10px;color:var(--mu);margin-top:4px">
                  Reason: "${emp.hibernate_reason || 'Not specified'}"
                </div>
              </div>
            </div>`;
          
          setRes('unk', html, conf);
          busy = false;
          return;
        }

        const today = new Date().toDateString();
        const dup   = ATT.find(a => a.empId === emp.id && new Date(a.ts).toDateString() === today);

        const badge = dup
          ? '<span class="chip cb" style="margin-left:4px">Already logged</span>'
          : '<span class="chip cp" style="margin-left:4px">✓ Logged</span>';

        const html = `
          <div class="remp">
            ${(emp.image || emp.img)
              ? `<div class="rav"><img src="${emp.image || emp.img}" alt="${emp.name}"></div>`
              : `<div class="ravi">${emp.name.charAt(0)}</div>`}
            <div>
              <div class="rn">${emp.name}</div>
              <div class="rm">${emp.id} · ${emp.department || emp.dept} · ${emp.role}</div>
              <div style="margin-top:5px">
                <span class="chip cp">✓ Recognized ${conf}%</span>${badge}
              </div>
            </div>
          </div>`;

        setRes('ok', html, conf);
        if (!dup) { await logAtt(emp); }
      }
    }
  } catch (e) {
    console.error(e);
  }

  busy = false;
}

// ══════════════════════════════════════════════
// Log attendance to DB
// ══════════════════════════════════════════════
async function logAtt(emp) {
  const now  = new Date();
  const late = new Date(); late.setHours(9, 0, 0, 0);
  const status = now > late ? 'Late' : 'Present';

  const payload = {
    emp_id:    emp.id,
    name:      emp.name,
    dept:      emp.department || emp.dept,
    role:      emp.role,
    timestamp: now.toISOString(),
    status
  };

  const res = await apiPost('/api/attendance', payload);

  if (res.success && !res.duplicate) {
    const record = { empId: emp.id, name: emp.name, dept: payload.dept, role: emp.role, ts: now.toISOString(), status, att_id: res.att_id };
    ATT.push(record);
    renderLog();
    updateStats();
    notify(`${emp.name} marked ${status} <span class="db-badge">DB</span>`);
  } else if (!res.success) {
    notify(res.error || 'Failed to record attendance.', 'er');
  }
}

// ══════════════════════════════════════════════
// UI helpers
// ══════════════════════════════════════════════
function setRes(cls, html, conf) {
  const rb = document.getElementById('rb');
  rb.className = 'res ' + (cls || '');
  rb.innerHTML = html || '<div style="color:var(--mu);font-size:12px;text-align:center;padding:12px">Position face in frame to mark attendance</div>';

  const cb = document.getElementById('cbr2');
  const cf = document.getElementById('cfll');
  if (conf) {
    cb.style.display    = 'block';
    cf.style.width      = conf + '%';
    cf.style.background = conf > 70 ? 'var(--ac)' : conf > 50 ? 'var(--warn)' : 'var(--err)';
  } else {
    cb.style.display = 'none';
  }
}

function renderLog() {
  const el    = document.getElementById('alog');
  const today = new Date().toDateString();
  const todays = ATT.filter(a => new Date(a.ts).toDateString() === today).slice().reverse();

  if (!todays.length) {
    el.innerHTML = '<div class="emp">No attendance logged yet today.</div>';
    return;
  }

  el.innerHTML = todays.map(a => {
    const t = new Date(a.ts);
    return `<div class="li">
      <div class="lt">${t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
      <div class="ln">${a.name}</div>
      <div style="font-family:var(--mo);font-size:10px;color:var(--mu);margin-right:4px">${a.dept}</div>
      <span class="chip ${a.status === 'Present' ? 'cp' : 'cl'}">${a.status}</span>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════
// Update Stats and Dashboard Analytics Charts
// ══════════════════════════════════════════════
async function updateStats() {
  try {
    const res = await apiGet('/api/stats');
    if (!res.success) return;

    const today = new Date().toDateString();
    const td    = ATT.filter(a => new Date(a.ts).toDateString() === today);

    // Populate default logs stats
    document.getElementById('st').textContent   = res.total_employees;
    document.getElementById('spd').textContent  = td.length;
    document.getElementById('slt').textContent  = td.filter(a => a.status === 'Late').length;
    document.getElementById('sall').textContent = ATT.length;

    // Populate Roster Status stats
    document.getElementById('s-active').textContent = res.status_counts.active;
    document.getElementById('s-hibernate').textContent = res.status_counts.hibernate;
    document.getElementById('s-leave').textContent = res.status_counts.on_leave;
    document.getElementById('s-resigned').textContent = res.status_counts.resigned;

    // Initialize/Update interactive charts
    updateCharts(res);

  } catch (err) {
    console.error('Failed to update stats:', err);
  }

  filt();
}

// ── Chart.js updates ──────────────────────────
function updateCharts(stats) {
  if (!window.Chart) {
    console.warn('[CHARTS] Chart.js library is not available.');
    return;
  }

  // Curated Harmonies Theme Color tokens
  const textClr = '#dde2f0';
  const gridClr = '#2d3650';
  const tooltipBg = '#1e2438';

  // 1. Doughnut Chart: Roster Distribution %
  const rosterCtx = document.getElementById('rosterChart')?.getContext('2d');
  if (rosterCtx) {
    const sc = stats.status_counts || { active: 0, hibernate: 0, on_leave: 0, resigned: 0 };
    const chartData = [sc.active, sc.hibernate, sc.on_leave, sc.resigned];
    
    if (rosterChart) {
      rosterChart.data.datasets[0].data = chartData;
      rosterChart.update();
    } else {
      rosterChart = new Chart(rosterCtx, {
        type: 'doughnut',
        data: {
          labels: ['Active', 'Hibernate', 'On Leave', 'Resigned'],
          datasets: [{
            data: chartData,
            backgroundColor: ['#10b981', '#f59e0b', '#4f8ef7', '#6b7691'],
            borderColor: '#161b27',
            borderWidth: 2,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                color: textClr,
                boxWidth: 10,
                font: { family: 'IBM Plex Sans', size: 10 }
              }
            },
            tooltip: {
              backgroundColor: tooltipBg,
              titleColor: textClr,
              bodyColor: textClr,
              borderWidth: 1,
              borderColor: '#2d3650'
            }
          },
          cutout: '70%'
        }
      });
    }
  }

  // 2. Bar Chart: Hibernate count by Department
  const deptCtx = document.getElementById('deptChart')?.getContext('2d');
  if (deptCtx) {
    const labels = stats.dept_hibernate_counts.map(d => d.department);
    const data = stats.dept_hibernate_counts.map(d => d.count);
    
    if (deptChart) {
      deptChart.data.labels = labels.length ? labels : ['None'];
      deptChart.data.datasets[0].data = data.length ? data : [0];
      deptChart.update();
    } else {
      deptChart = new Chart(deptCtx, {
        type: 'bar',
        data: {
          labels: labels.length ? labels : ['None'],
          datasets: [{
            label: 'Hibernate Count',
            data: data.length ? data : [0],
            backgroundColor: 'rgba(245, 158, 11, 0.7)',
            borderColor: '#f59e0b',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: tooltipBg, titleColor: textClr, bodyColor: textClr }
          },
          scales: {
            x: { 
              ticks: { color: textClr, font: { family: 'IBM Plex Sans', size: 9 } }, 
              grid: { display: false } 
            },
            y: { 
              ticks: { color: textClr, font: { family: 'IBM Plex Sans', size: 9 }, stepSize: 1 }, 
              grid: { color: gridClr } 
            }
          }
        }
      });
    }
  }

  // 3. Area Trend Chart: Monthly Hibernate Entry Trends
  const trendCtx = document.getElementById('trendChart')?.getContext('2d');
  if (trendCtx) {
    const labels = stats.monthly_hibernate_trend.map(t => t.month);
    const data = stats.monthly_hibernate_trend.map(t => t.count);

    if (trendChart) {
      trendChart.data.labels = labels.length ? labels : ['No Data'];
      trendChart.data.datasets[0].data = data.length ? data : [0];
      trendChart.update();
    } else {
      trendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
          labels: labels.length ? labels : ['No Data'],
          datasets: [{
            label: 'New Hibernate Entries',
            data: data.length ? data : [0],
            borderColor: '#4f8ef7',
            backgroundColor: 'rgba(79, 142, 247, 0.15)',
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#4f8ef7',
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: tooltipBg, titleColor: textClr, bodyColor: textClr }
          },
          scales: {
            x: { 
              ticks: { color: textClr, font: { family: 'IBM Plex Sans', size: 9 } }, 
              grid: { display: false } 
            },
            y: { 
              ticks: { color: textClr, font: { family: 'IBM Plex Sans', size: 9 }, stepSize: 1 }, 
              grid: { color: gridClr } 
            }
          }
        }
      });
    }
  }
}

// ── Reset & Seed DB Trigger ───────────────────
async function resetSeedDatabase() {
  if (!confirm('Are you sure you want to reset the database? This will clear all attendance logs and re-seed exactly 100 realistic employee records.')) return;
  notify('Resetting database...', 'wn');
  try {
    const res = await apiPost('/api/reset-seed', {});
    if (res.success) {
      notify('Database reset & seeded successfully!', 'ok');
      await loadFromDB();
    } else {
      notify(res.error || 'Failed to reset and seed', 'er');
    }
  } catch (e) {
    console.error(e);
    notify('Reset & seed failed.', 'er');
  }
}

// ══════════════════════════════════════════════
// HR Dashboard filtering
// ══════════════════════════════════════════════
function filt() {
  const s  = (document.getElementById('fs')?.value  || '').toLowerCase();
  const d  =  document.getElementById('fd')?.value;
  const dd =  document.getElementById('fdd')?.value;
  const st =  document.getElementById('fst')?.value;

  let r = [...ATT];
  if (s)  r = r.filter(a => a.name.toLowerCase().includes(s) || a.empId.toLowerCase().includes(s));
  if (d)  r = r.filter(a => a.ts.startsWith(d));
  if (dd) r = r.filter(a => a.dept === dd);
  if (st) r = r.filter(a => a.status === st);
  r.sort((a, b) => new Date(b.ts) - new Date(a.ts));

  const tb = document.getElementById('atb');
  const tc = document.getElementById('tc2');

  if (!r.length) {
    tb.innerHTML = `<tr><td colspan="7" class="emp">${ATT.length ? 'No records match filters.' : 'No records yet.'}</td></tr>`;
    if (tc) tc.textContent = '';
    return;
  }

  tb.innerHTML = r.map(a => {
    const ts = new Date(a.ts);
    return `<tr>
      <td class="tid">${a.empId}</td>
      <td style="font-weight:500">${a.name}</td>
      <td>${a.dept}</td>
      <td style="color:var(--mu)">${a.role}</td>
      <td class="tts">${ts.toLocaleDateString()}</td>
      <td class="tts">${ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</td>
      <td><span class="chip ${a.status === 'Present' ? 'cp' : 'cl'}">${a.status}</span></td>
    </tr>`;
  }).join('');

  if (tc) tc.textContent = r.length + ' record' + (r.length !== 1 ? 's' : '');
}

function clrFilt() {
  ['fs', 'fd', 'fdd', 'fst'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  filt();
}

// ══════════════════════════════════════════════
// CSV Export
// ══════════════════════════════════════════════
function exportCSV() {
  if (!ATT.length) { notify('No records to export.', 'wn'); return; }

  const hdrs = ['Employee ID', 'Name', 'Department', 'Role', 'Date', 'Time', 'Status'];
  const rows = ATT.map(a => {
    const ts = new Date(a.ts);
    return [a.empId, a.name, a.dept, a.role, ts.toLocaleDateString(), ts.toLocaleTimeString(), a.status];
  });

  const csv = [hdrs, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href     = url;
  link.download = 'attendance_' + new Date().toISOString().slice(0, 10) + '.csv';
  link.click();
  URL.revokeObjectURL(url);
  notify('CSV exported successfully!');
}

// ══════════════════════════════════════════════
// eTimeTrackLite Dialog & Action Link Controls
// ══════════════════════════════════════════════

// Date dropdown helpers
function populateDateDropdowns(containerId, dateStr) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  let valDate = new Date();
  if (dateStr && dateStr !== 'N/A' && dateStr !== 'null') {
    valDate = new Date(dateStr);
  } else if (containerId.includes('last-working')) {
    valDate = new Date("3000-01-01");
  } else if (containerId.includes('exp-start')) {
    valDate = new Date("2000-01-01");
  } else if (containerId.includes('exp-end')) {
    valDate = new Date("2030-12-31");
  } else if (containerId.includes('confirm-date')) {
    valDate = new Date();
    valDate.setMonth(valDate.getMonth() + 6);
  }

  const d = valDate.getDate();
  const m = valDate.getMonth(); // 0-11
  const y = valDate.getFullYear();

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let daysHtml = `<select class="fs date-sel-d" style="width: 32%; display: inline-block; margin-right: 2%">`;
  for (let i = 1; i <= 31; i++) {
    const val = String(i).padStart(2, '0');
    daysHtml += `<option value="${val}" ${i === d ? 'selected' : ''}>${val}</option>`;
  }
  daysHtml += `</select>`;

  let monthsHtml = `<select class="fs date-sel-m" style="width: 32%; display: inline-block; margin-right: 2%">`;
  for (let i = 0; i < 12; i++) {
    monthsHtml += `<option value="${String(i+1).padStart(2, '0')}" ${i === m ? 'selected' : ''}>${months[i]}</option>`;
  }
  monthsHtml += `</select>`;

  let yearsHtml = `<select class="fs date-sel-y" style="width: 32%; display: inline-block">`;
  const startYr = Math.min(y - 10, 2000);
  const endYr = Math.max(y + 10, 2035);
  
  let yrs = [];
  for (let i = startYr; i <= endYr; i++) {
    yrs.push(i);
  }
  if (!yrs.includes(3000)) yrs.push(3000);
  if (!yrs.includes(y)) yrs.push(y);
  yrs.sort((a,b) => a-b);

  yrs.forEach(yr => {
    yearsHtml += `<option value="${yr}" ${yr === y ? 'selected' : ''}>${yr}</option>`;
  });
  yearsHtml += `</select>`;

  container.innerHTML = daysHtml + monthsHtml + yearsHtml;
}

function getISOFromDateDropdowns(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  const d = container.querySelector('.date-sel-d').value;
  const m = container.querySelector('.date-sel-m').value;
  const y = container.querySelector('.date-sel-y').value;
  return `${y}-${m}-${d}`;
}

// Modal open
function openEmpModal(id) {
  const emp = EMP.find(e => e.id === id);
  if (!emp) return;

  // Set text fields
  document.getElementById('m-id').value = emp.id;
  document.getElementById('m-name').value = emp.name || '';
  document.getElementById('m-device-code').value = emp.deviceCode || emp.device_code || emp.id;
  document.getElementById('m-dept').value = emp.department || emp.dept || 'Engineering';
  document.getElementById('m-sub-dept').value = emp.subDepartment || emp.sub_department || 'None';
  document.getElementById('m-grade').value = emp.grade || 'G1';
  document.getElementById('m-location').value = emp.location || 'HQ - Bangalore';
  document.getElementById('m-category').value = emp.category || 'Default';
  document.getElementById('m-shift-group').value = emp.shiftGroup || emp.shift_group || 'None';
  document.getElementById('m-status').value = emp.status || 'Active';
  
  // Sex (radio)
  const isMale = (emp.gender || '').toLowerCase() !== 'female';
  document.getElementById('m-sex-male').checked = isMale;
  document.getElementById('m-sex-female').checked = !isMale;

  document.getElementById('m-card-number').value = emp.cardNumber || emp.card_number || '';
  document.getElementById('m-expiry-rule').checked = emp.deviceExpiryRuleApplicable || emp.device_expiry_rule_applicable || false;

  document.getElementById('m-company').value = emp.company || 'Default';
  document.getElementById('m-role').value = emp.role || '';
  document.getElementById('m-division').value = emp.division || 'None';
  document.getElementById('m-team').value = emp.team || 'None';
  document.getElementById('m-emp-type').value = emp.employmentType || emp.employment_type || 'Permanent';
  document.getElementById('m-holiday-group').value = emp.holidayGroup || emp.holiday_group || 'None';
  document.getElementById('m-shift-roster').value = emp.shiftRoster || emp.shift_roster || 'None';
  document.getElementById('m-aadhaar').value = emp.aadhaarNumber || emp.aadhaar_number || '';
  document.getElementById('m-geofence').value = emp.geofence || '--Select--';
  document.getElementById('m-verification-type').value = emp.verificationType || emp.verification_type || 'Finger or Face or Card or Pin';

  // Compliance fields
  document.getElementById('m-pan').value = emp.panNumber || emp.pan_number || '';
  document.getElementById('m-phone').value = emp.phoneNo || emp.phone_no || '';
  document.getElementById('m-email').value = emp.email || '';
  document.getElementById('m-reporting-to').value = emp.reportingTo || emp.reporting_to || '';

  // Dates
  populateDateDropdowns('m-join-date-grp', emp.dateOfJoining || emp.date_of_joining);
  populateDateDropdowns('m-confirm-date-grp', emp.dateOfConfirmation || emp.date_of_confirmation);
  populateDateDropdowns('m-last-working-grp', emp.lastWorkingDay || emp.last_working_day);
  populateDateDropdowns('m-exp-start-grp', emp.expiryStartDate || emp.expiry_start_date);
  populateDateDropdowns('m-exp-end-grp', emp.expiryEndDate || emp.expiry_end_date);

  // Hibernate fields
  toggleModalHibFields(emp.status || 'Active');
  if (emp.status === 'Hibernate') {
    document.getElementById('m-hib-start').value = emp.hibernateStartDate || emp.hibernate_start_date || '';
    document.getElementById('m-hib-end').value = emp.hibernateEndDate || emp.hibernate_end_date || '';
    document.getElementById('m-hib-reason').value = emp.hibernateReason || emp.hibernate_reason || '';
  }

  // Display modal
  document.getElementById('emp-modal').style.display = 'flex';
}

function closeEmpModal() {
  document.getElementById('emp-modal').style.display = 'none';
}

function toggleModalHibFields(status) {
  const hRow = document.getElementById('m-hib-fields-row');
  if (status === 'Hibernate') {
    hRow.style.display = 'grid';
  } else {
    hRow.style.display = 'none';
  }
}

// Modal save
async function saveEmpModal() {
  const id = document.getElementById('m-id').value;
  const name = document.getElementById('m-name').value.trim();
  const role = document.getElementById('m-role').value.trim();
  const status = document.getElementById('m-status').value;

  if (!name || !role) {
    notify('Name and Designation cannot be empty.', 'wn');
    return;
  }

  const payload = {
    name,
    department: document.getElementById('m-dept').value,
    role,
    status,
    device_code: document.getElementById('m-device-code').value.trim(),
    sub_department: document.getElementById('m-sub-dept').value,
    grade: document.getElementById('m-grade').value,
    location: document.getElementById('m-location').value,
    category: document.getElementById('m-category').value,
    shift_group: document.getElementById('m-shift-group').value,
    gender: document.querySelector('input[name="m-sex"]:checked').value,
    card_number: document.getElementById('m-card-number').value.trim(),
    device_expiry_rule_applicable: document.getElementById('m-expiry-rule').checked,
    
    company: document.getElementById('m-company').value,
    division: document.getElementById('m-division').value,
    team: document.getElementById('m-team').value,
    employment_type: document.getElementById('m-emp-type').value,
    holiday_group: document.getElementById('m-holiday-group').value,
    shift_roster: document.getElementById('m-shift-roster').value,
    aadhaar_number: document.getElementById('m-aadhaar').value.trim(),
    geofence: document.getElementById('m-geofence').value,
    verification_type: document.getElementById('m-verification-type').value,

    // Dates
    date_of_joining: getISOFromDateDropdowns('m-join-date-grp'),
    date_of_confirmation: getISOFromDateDropdowns('m-confirm-date-grp'),
    last_working_day: getISOFromDateDropdowns('m-last-working-grp'),
    expiry_start_date: getISOFromDateDropdowns('m-exp-start-grp'),
    expiry_end_date: getISOFromDateDropdowns('m-exp-end-grp'),

    // Compliance
    pan_number: document.getElementById('m-pan').value.trim(),
    phone_no: document.getElementById('m-phone').value.trim(),
    email: document.getElementById('m-email').value.trim(),
    reporting_to: document.getElementById('m-reporting-to').value.trim(),
  };

  if (status === 'Hibernate') {
    payload.hibernate_start_date = document.getElementById('m-hib-start').value;
    payload.hibernate_end_date = document.getElementById('m-hib-end').value;
    payload.hibernate_reason = document.getElementById('m-hib-reason').value.trim();

    if (!payload.hibernate_start_date || !payload.hibernate_end_date || !payload.hibernate_reason) {
      notify('Please fill all Hibernate details.', 'wn');
      return;
    }
  }

  notify('Updating employee record...', 'wn');

  try {
    const res = await apiPut('/api/employees/' + id, payload);
    if (res.success) {
      notify('Employee saved successfully! <span class="db-badge">DB</span>', 'ok');
      
      // Update local state directly
      const idx = EMP.findIndex(e => e.id === id);
      if (idx !== -1) {
        EMP[idx] = {
          ...EMP[idx],
          name: payload.name,
          department: payload.department,
          role: payload.role,
          status: payload.status,
          deviceCode: payload.device_code,
          subDepartment: payload.sub_department,
          grade: payload.grade,
          location: payload.location,
          category: payload.category,
          shiftGroup: payload.shift_group,
          gender: payload.gender,
          cardNumber: payload.card_number,
          deviceExpiryRuleApplicable: payload.device_expiry_rule_applicable,
          company: payload.company,
          division: payload.division,
          team: payload.team,
          employmentType: payload.employment_type,
          holidayGroup: payload.holiday_group,
          shiftRoster: payload.shift_roster,
          aadhaarNumber: payload.aadhaar_number,
          geofence: payload.geofence,
          verificationType: payload.verification_type,
          dateOfJoining: payload.date_of_joining,
          dateOfConfirmation: payload.date_of_confirmation,
          lastWorkingDay: payload.last_working_day,
          expiryStartDate: payload.expiry_start_date,
          expiryEndDate: payload.expiry_end_date,
          panNumber: payload.pan_number,
          phoneNo: payload.phone_no,
          email: payload.email,
          reportingTo: payload.reporting_to,
          hibernateStartDate: payload.hibernate_start_date || null,
          hibernateEndDate: payload.hibernate_end_date || null,
          hibernateReason: payload.hibernate_reason || null
        };
      }
      
      closeEmpModal();
      renderEL();
      updateStats();
    } else {
      notify(res.error || 'Failed to save updates.', 'er');
    }
  } catch (err) {
    console.error(err);
    notify('Communication error occurred.', 'er');
  }
}

// Simulated Sync actions
function syncAllDevices() {
  const name = document.getElementById('m-name').value;
  notify(`Syncing "${name}" credentials to 5 facial readers...`, 'wn');
  setTimeout(() => {
    notify('Reader Synchronization complete! Verified on: KCC-Lobby, KCC-Server, HQ-Entrance.', 'ok');
  }, 1800);
}

function unsyncAllDevices() {
  const name = document.getElementById('m-name').value;
  notify(`Revoking credentials for "${name}" from all terminals...`, 'wn');
  setTimeout(() => {
    notify('Credentials deleted from 5 active face readers successfully.', 'ok');
  }, 1800);
}

// Popup Info Drawer helpers
function openInfoDrawer(title, html) {
  document.getElementById('dr-title').textContent = title;
  document.getElementById('dr-body').innerHTML = html;
  document.getElementById('info-drawer').style.display = 'flex';
}

function closeInfoDrawer() {
  document.getElementById('info-drawer').style.display = 'none';
}

function toggleMasterSubmenu(id, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const el = document.getElementById(id);
  const arrow = document.getElementById(id + '-arrow');
  if (!el) return;
  const isHidden = el.style.display === 'none' || !el.style.display;
  el.style.display = isHidden ? 'block' : 'none';
  if (arrow) {
    arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
    arrow.style.color = isHidden ? 'var(--ac)' : 'var(--mu)';
  }
}
window.toggleMasterSubmenu = toggleMasterSubmenu;

// Horizontal Navigation Menu Drawer Content Generators
function openMenuDrawer(section) {
  let title = 'System Details';
  let html = '';

  switch (section) {
    case 'database':
      title = 'Database Manager';
      html = `
        <div style="font-family:var(--sa); font-size:12px; color:var(--tx); line-height:1.6">
          <div style="background:var(--s2); border:1px solid var(--br); border-radius:6px; padding:12px; margin-bottom:12px">
            <div style="font-weight:600; color:var(--ac); margin-bottom:6px">Database Engine Status</div>
            <div>Engine: MySQL 8.4 LTS (InnoDB)</div>
            <div>Database: <code style="color:var(--ac2); font-family:var(--mo)">soukhya_attendance</code></div>
            <div>Collation: utf8mb4_0900_ai_ci</div>
            <div>Mode: High-Throughput Connection Pool (ACID Compliant)</div>
          </div>
          <div style="margin-bottom:12px">
            <div style="font-weight:600; margin-bottom:6px">Available Backups</div>
            <table style="width:100%; border-collapse:collapse; font-size:11px">
              <thead>
                <tr style="border-bottom:1px solid var(--br); color:var(--mu)">
                  <th style="text-align:left; padding:4px 0">File Name</th>
                  <th style="text-align:right; padding:4px 0">Size</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding:4px 0">backup_2026_06_12_0900.db</td>
                  <td style="text-align:right; padding:4px 0">245 KB</td>
                </tr>
                <tr>
                  <td style="padding:4px 0">backup_2026_06_11_0900.db</td>
                  <td style="text-align:right; padding:4px 0">240 KB</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style="display:flex; gap:8px">
            <button class="btn btnp bsm" onclick="notify('Generating hot database backup...', 'ok')">Backup Now</button>
            <button class="btn bsm" onclick="notify('Select a backup file to restore.', 'wn')">Restore</button>
          </div>
        </div>
      `;
      break;

    case 'masters':
      title = 'Master Configs';
      html = `
        <div style="font-family:var(--sa); font-size:12px; color:var(--tx)">
          <div style="font-weight:600; color:var(--ac); margin-bottom:10px">Enterprise Configuration Masters</div>
          <div class="menu-list-vertical">
            <div class="menu-list-item" onclick="closeInfoDrawer(); showTab('company', null)">
              <span class="menu-icon">🏢</span> <span class="menu-text">Companies</span>
            </div>

            <!-- Settings Dropdown / Submenu Option -->
            <div class="menu-list-item has-sub" onclick="toggleMasterSubmenu('sub-settings', event)" style="display:flex; justify-content:space-between; align-items:center">
              <div style="display:flex; align-items:center; gap:10px">
                <span class="menu-icon">⚙️</span> <span class="menu-text" style="font-weight:600">Settings</span>
              </div>
              <span id="sub-settings-arrow" style="font-size:10px; color:var(--mu); transition:transform 0.2s">▶</span>
            </div>
            <div id="sub-settings" class="menu-submenu" style="display:none; padding-left:14px; margin-left:12px; border-left:2px solid var(--ac); margin-top:2px; margin-bottom:4px">
              <div class="menu-list-item" onclick="closeInfoDrawer(); openMasterSettingsModal()">
                <span class="menu-icon">⚙️</span> <span class="menu-text">Master Settings</span>
              </div>
              <div class="menu-list-item" onclick="notify('Mail Settings config loaded.', 'ok')">
                <span class="menu-icon">✉️</span> <span class="menu-text">Mail Settings</span>
              </div>
            </div>

            <!-- Shift Dropdown / Submenu Option -->
            <div class="menu-list-item has-sub" onclick="toggleMasterSubmenu('sub-shift', event)" style="display:flex; justify-content:space-between; align-items:center">
              <div style="display:flex; align-items:center; gap:10px">
                <span class="menu-icon">⏱️</span> <span class="menu-text" style="font-weight:600">Shift</span>
              </div>
              <span id="sub-shift-arrow" style="font-size:10px; color:var(--mu); transition:transform 0.2s">▶</span>
            </div>
            <div id="sub-shift" class="menu-submenu" style="display:none; padding-left:14px; margin-left:12px; border-left:2px solid var(--ac); margin-top:2px; margin-bottom:4px">
              <div class="menu-list-item" onclick="closeInfoDrawer(); openShiftDetailsModal()">
                <span class="menu-icon">⏱️</span> <span class="menu-text">Shift Details</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openShiftCalendarModal()">
                <span class="menu-icon">📅</span> <span class="menu-text">Shift Calendar</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openShiftRosterModal()">
                <span class="menu-icon">📋</span> <span class="menu-text">Shift Roster</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openShiftGroupModal()">
                <span class="menu-icon">👥</span> <span class="menu-text">Shift Group</span>
              </div>
            </div>

            <!-- Organization Dropdown / Submenu Option -->
            <div class="menu-list-item has-sub" onclick="toggleMasterSubmenu('sub-org', event)" style="display:flex; justify-content:space-between; align-items:center">
              <div style="display:flex; align-items:center; gap:10px">
                <span class="menu-icon">🏢</span> <span class="menu-text" style="font-weight:600">Organization</span>
              </div>
              <span id="sub-org-arrow" style="font-size:10px; color:var(--mu); transition:transform 0.2s">▶</span>
            </div>
            <div id="sub-org" class="menu-submenu" style="display:none; padding-left:14px; margin-left:12px; border-left:2px solid var(--ac); margin-top:2px; margin-bottom:4px">
              <div class="menu-list-item" onclick="closeInfoDrawer(); openDepartmentsModal()">
                <span class="menu-icon">🏢</span> <span class="menu-text">Departments</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openDeptShiftsModal()">
                <span class="menu-icon">🔄</span> <span class="menu-text">Departments Shifts</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openPublicHolidaysModal()">
                <span class="menu-icon">🏖️</span> <span class="menu-text">Public Holidays</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openLeaveTypesModal()">
                <span class="menu-icon">🏥</span> <span class="menu-text">Leave Types</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openLeaveEntriesModal()">
                <span class="menu-icon">📝</span> <span class="menu-text">Employee Leave Entries</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openOutdoorEntriesModal()">
                <span class="menu-icon">🚶</span> <span class="menu-text">Employee Outdoor Entries</span>
              </div>
            </div>

            <!-- Employee Management Dropdown / Submenu Option -->
            <div class="menu-list-item has-sub" onclick="toggleMasterSubmenu('sub-emp', event)" style="display:flex; justify-content:space-between; align-items:center">
              <div style="display:flex; align-items:center; gap:10px">
                <span class="menu-icon">👥</span> <span class="menu-text" style="font-weight:600">Employee Management</span>
              </div>
              <span id="sub-emp-arrow" style="font-size:10px; color:var(--mu); transition:transform 0.2s">▶</span>
            </div>
            <div id="sub-emp" class="menu-submenu" style="display:none; padding-left:14px; margin-left:12px; border-left:2px solid var(--ac); margin-top:2px; margin-bottom:4px">
              <div class="menu-list-item" onclick="closeInfoDrawer(); showTab('employee-list', null)">
                <span class="menu-icon">👤</span> <span class="menu-text">Employees</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openEmploymentTypesModal()">
                <span class="menu-icon">👔</span> <span class="menu-text">Employment Types</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openEmployeeGroupsModal()">
                <span class="menu-icon">👥</span> <span class="menu-text">Employee Groups</span>
              </div>
            </div>

            <!-- Attendance & Time Dropdown / Submenu Option -->
            <div class="menu-list-item has-sub" onclick="toggleMasterSubmenu('sub-att', event)" style="display:flex; justify-content:space-between; align-items:center">
              <div style="display:flex; align-items:center; gap:10px">
                <span class="menu-icon">🕐</span> <span class="menu-text" style="font-weight:600">Attendance & Time</span>
              </div>
              <span id="sub-att-arrow" style="font-size:10px; color:var(--mu); transition:transform 0.2s">▶</span>
            </div>
            <div id="sub-att" class="menu-submenu" style="display:none; padding-left:14px; margin-left:12px; border-left:2px solid var(--ac); margin-top:2px; margin-bottom:4px">
              <div class="menu-list-item" onclick="closeInfoDrawer(); openAttendanceLogModal()">
                <span class="menu-icon">📊</span> <span class="menu-text">Attendance Log</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openGeofencesModal()">
                <span class="menu-icon">📍</span> <span class="menu-text">Geofences</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openWorkCodesModal()">
                <span class="menu-icon">🔢</span> <span class="menu-text">Manage Work Code</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openOtRegisterModal()">
                <span class="menu-icon">⏱️</span> <span class="menu-text">Employee OT Register</span>
              </div>
            </div>
          </div>
        </div>
      `;
      break;

    case 'devices':
      title = 'Biometric Device Manager';
      html = `
        <div style="font-family:var(--sa); font-size:12px; color:var(--tx)">
          <div style="font-weight:600; color:var(--ac); margin-bottom:10px">Connected Biometric Terminal Status</div>
          <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:12px">
            <thead>
              <tr style="border-bottom:1px solid var(--br); color:var(--mu)">
                <th style="text-align:left; padding:6px 0">Terminal</th>
                <th style="text-align:center; padding:6px 0">IP</th>
                <th style="text-align:right; padding:6px 0">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom:1px dashed var(--br)">
                <td style="padding:6px 0">HQ Main Gate #1</td>
                <td style="text-align:center; padding:6px 0">192.168.1.15</td>
                <td style="text-align:right; color:var(--ok); font-weight:600; padding:6px 0">ONLINE</td>
              </tr>
              <tr style="border-bottom:1px dashed var(--br)">
                <td style="padding:6px 0">IT Lab Gate #2</td>
                <td style="text-align:center; padding:6px 0">192.168.1.16</td>
                <td style="text-align:right; color:var(--ok); font-weight:600; padding:6px 0">ONLINE</td>
              </tr>
              <tr>
                <td style="padding:6px 0">HR Office Entrance</td>
                <td style="text-align:center; padding:6px 0">192.168.1.17</td>
                <td style="text-align:right; color:var(--err); font-weight:600; padding:6px 0">OFFLINE</td>
              </tr>
            </tbody>
          </table>
          <div style="display:flex; gap:8px">
            <button class="btn btnp bsm" onclick="notify('Pinging all readers...', 'ok')">Ping Devices</button>
            <button class="btn bsm" onclick="notify('Syncing template databases to reader memory...', 'ok')">Sync Templates</button>
          </div>
        </div>
      `;
      break;

    case 'utilities':
      title = 'System Utilities';
      html = `
        <div style="font-family:var(--sa); font-size:12px; color:var(--tx); line-height:1.6">
          <div style="font-weight:600; color:var(--ac); margin-bottom:12px">Administrative System Utilities</div>
          <div style="display:flex; flex-direction:column; gap:10px">
            <div style="background:var(--s2); border:1px solid var(--br); border-radius:6px; padding:10px; display:flex; justify-content:space-between; align-items:center">
              <div>
                <div style="font-weight:600">Recalculate Work Hours</div>
                <div style="font-size:10px; color:var(--mu)">Recalculate total duration from raw punches</div>
              </div>
              <button class="btn bsm" onclick="notify('Initiating log recalculation batch...', 'ok')">Run</button>
            </div>
            <div style="background:var(--s2); border:1px solid var(--br); border-radius:6px; padding:10px; display:flex; justify-content:space-between; align-items:center">
              <div>
                <div style="font-weight:600">Database VACUUM</div>
                <div style="font-size:10px; color:var(--mu)">Rebuild database file to reclaim free space</div>
              </div>
              <button class="btn bsm" onclick="notify('Database vacuuming completed.', 'ok')">Run</button>
            </div>
            <div style="background:var(--s2); border:1px solid var(--br); border-radius:6px; padding:10px; display:flex; justify-content:space-between; align-items:center">
              <div>
                <div style="font-weight:600">Flush Roster Cache</div>
                <div style="font-size:10px; color:var(--mu)">Clear temporary session files and charts cache</div>
              </div>
              <button class="btn bsm" onclick="notify('Session cache cleared successfully.', 'ok')">Run</button>
            </div>
          </div>
        </div>
      `;
      break;

    case 'payroll':
      title = 'Payroll System';
      html = `
        <div style="font-family:var(--sa); font-size:12px; color:var(--tx)">
          <div style="font-weight:600; color:var(--ac); margin-bottom:10px">Enterprise Payroll Summary (June 2026)</div>
          <div style="background:var(--s2); border:1px solid var(--br); border-radius:6px; padding:12px; display:flex; flex-direction:column; gap:8px; margin-bottom:12px">
            <div style="display:flex; justify-content:space-between"><span>Active Roster count:</span><span style="font-weight:600; color:var(--ac2)">75 Employees</span></div>
            <div style="display:flex; justify-content:space-between"><span>Basic Payroll processed:</span><span style="font-weight:600; color:var(--ok)">₹12,45,000</span></div>
            <div style="display:flex; justify-content:space-between"><span>TDS & Provident Fund:</span><span style="font-weight:600">₹1,85,000</span></div>
            <div style="display:flex; justify-content:space-between"><span>Pending Approvals:</span><span style="font-weight:600; color:var(--warn)">5 batches</span></div>
          </div>
          <div style="display:flex; gap:8px">
            <button class="btn btnp bsm" onclick="notify('Generating monthly payroll slips...', 'ok')">Process Slip Batch</button>
            <button class="btn bsm" onclick="notify('Exporting bank transfer file...', 'ok')">Export Bank File</button>
          </div>
        </div>
      `;
      break;

    case 'canteen':
      title = 'Canteen Terminal Summary';
      html = `
        <div style="font-family:var(--sa); font-size:12px; color:var(--tx)">
          <div style="font-weight:600; color:var(--ac); margin-bottom:10px">Canteen Facility Usage Summary</div>
          <div style="background:var(--s2); border:1px solid var(--br); border-radius:6px; padding:12px; display:flex; flex-direction:column; gap:8px; margin-bottom:12px">
            <div style="display:flex; justify-content:space-between"><span>Breakfast punches today:</span><span style="font-weight:600">42 Punches</span></div>
            <div style="display:flex; justify-content:space-between"><span>Lunch punches today:</span><span style="font-weight:600; color:var(--ac2)">68 Punches</span></div>
            <div style="display:flex; justify-content:space-between"><span>Dinner punches today:</span><span style="font-weight:600">15 Punches</span></div>
          </div>
          <div style="display:flex; gap:8px">
            <button class="btn btnp bsm" onclick="notify('Exporting Canteen Billing file...', 'ok')">Export Bills</button>
            <button class="btn bsm" onclick="notify('Canteen terminal list refreshed.', 'ok')">Refresh Terminals</button>
          </div>
        </div>
      `;
      break;

    case 'users':
      closeInfoDrawer();
      openUserMgmtModal();
      return;

    case 'audit':
      title = 'System Audit Trail';
      html = `
        <div style="font-family:var(--sa); font-size:12px; color:var(--tx); line-height:1.6">
          <div style="font-weight:600; color:var(--ac); margin-bottom:10px">Security &amp; Action Logs (Last 5 events)</div>
          <div style="background:var(--s2); border:1px solid var(--br); border-radius:6px; padding:10px; font-family:var(--mo); font-size:10px; color:var(--mu)">
            <div>[2026-06-12 14:02:15] admin: Registered employee Saurabh Sharma (EMP031)</div>
            <div style="margin-top:6px">[2026-06-12 11:30:10] system: Terminals synchronized successfully</div>
            <div style="margin-top:6px">[2026-06-12 09:28:00] admin: Clean database tables &amp; seed database</div>
            <div style="margin-top:6px">[2026-06-11 18:45:00] admin: Updated status of EMP010 to On Leave</div>
            <div style="margin-top:6px">[2026-06-11 14:15:32] operator: Biometric terminal #2 pinged successfully</div>
          </div>
          <button class="btn bsm" style="margin-top:12px" onclick="notify('Exporting security audit trail to CSV...', 'ok')">Export Audit Logs</button>
        </div>
      `;
      break;

    case 'db-settings':
      title = 'Database Settings';
      html = `
        <div style="font-family:var(--sa); font-size:12px; color:var(--tx); line-height:1.6">
          <div style="font-weight:600; color:var(--ac); margin-bottom:10px">MySQL 8.4 LTS Engine Configurations</div>
          <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:12px">
            <div class="fg" style="margin:0">
              <label class="fl">Max Connection Pool Size</label>
              <input class="fi" value="20" id="cfg-pool-size" style="padding:6px 10px; font-size:11px" />
            </div>
            <div class="fg" style="margin:0">
              <label class="fl">Keep-Alive Initial Delay (ms)</label>
              <input class="fi" value="10000" id="cfg-keepalive" style="padding:6px 10px; font-size:11px" />
            </div>
            <div class="fg" style="margin:0; display:flex; gap:8px; align-items:center">
              <input type="checkbox" checked disabled id="cfg-innodb" />
              <label style="font-size:11px; margin:0">InnoDB ACID Transactions & UTF8MB4 Collation</label>
            </div>
          </div>
          <button class="btn btnp bsm" onclick="notify('Database configuration updated.', 'ok')">Save Settings</button>
        </div>
      `;
      break;

    case 'password':
      title = 'Security Center';
      html = `
        <div style="font-family:var(--sa); font-size:12px; color:var(--tx); line-height:1.6">
          <div style="font-weight:600; color:var(--ac); margin-bottom:10px">Update System Password</div>
          <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:12px">
            <div class="fg" style="margin:0">
              <label class="fl">Current Password</label>
              <input class="fi" type="password" placeholder="••••••••" style="padding:6px 10px; font-size:11px" />
            </div>
            <div class="fg" style="margin:0">
              <label class="fl">New Password</label>
              <input class="fi" type="password" placeholder="••••••••" style="padding:6px 10px; font-size:11px" />
            </div>
            <div class="fg" style="margin:0">
              <label class="fl">Confirm New Password</label>
              <input class="fi" type="password" placeholder="••••••••" style="padding:6px 10px; font-size:11px" />
            </div>
          </div>
          <button class="btn btnp bsm" onclick="notify('Password updated successfully.', 'ok')">Change Password</button>
        </div>
      `;
      break;

    case 'about':
      title = 'About HR Enterprise';
      html = `
        <div style="font-family:var(--sa); font-size:12px; color:var(--tx); line-height:1.6; text-align:center; padding:10px 0">
          <div style="font-size:16px; font-weight:600; color:var(--ac); font-family:var(--mo); margin-bottom:6px">SOUKHYA TECH</div>
          <div style="font-size:11px; font-weight:bold; color:var(--ac2); margin-bottom:12px">HR Enterprise Suite v2.0</div>
          <div style="background:var(--s2); border:1px solid var(--br); border-radius:6px; padding:10px; font-size:11px; text-align:left; color:var(--mu)">
            <div style="margin-bottom:4px">✓ Biometric Fingerprint Sync Engine</div>
            <div style="margin-bottom:4px">✓ AI Face Recognition Engine</div>
            <div style="margin-bottom:4px">✓ RFID Card Punch Sync Engine</div>
            <div>✓ WAL Transaction Logger enabled</div>
          </div>
          <div style="margin-top:15px; font-size:10px; color:var(--mu)">
            Developed by Soukhya Tech Ltd. © 2026. All rights reserved.
          </div>
        </div>
      `;
      break;
  }

  openInfoDrawer(title, html);
}

function goToReportsMenu() {
  const hrBtn = document.querySelector('button[data-tab="hr"]');
  if (hrBtn) showTab('hr', hrBtn);
  const subRepBtn = document.querySelector('button[onclick*="sub-tab-hr-reports"]');
  if (subRepBtn) showSubTab('sub-tab-hr-reports', subRepBtn);
}


// Interactive Link Details Drawer triggers
function showLeaveSummary(id) {
  const emp = EMP.find(e => e.id === id);
  if (!emp) return;
  
  const randAllocated = 12 + Math.floor(Math.random() * 15);
  const randTaken = Math.floor(Math.random() * 8);
  const randBal = randAllocated - randTaken;

  const html = `
    <div style="font-family:var(--sa); font-size:12px; line-height:1.6">
      <div style="font-size:14px; font-weight:600; margin-bottom:12px; color:var(--ac)">Leave Details for ${emp.name}</div>
      <table style="width:100%; border:1px solid var(--br); margin-bottom:12px">
        <thead>
          <tr>
            <th style="background:var(--s2)">Leave Type</th>
            <th style="background:var(--s2)">Allocated</th>
            <th style="background:var(--s2)">Availed</th>
            <th style="background:var(--s2)">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Earned Leaves (EL)</td>
            <td>${randAllocated}</td>
            <td>${randTaken}</td>
            <td style="color:var(--ok); font-weight:600">${randBal}</td>
          </tr>
          <tr>
            <td>Casual Leaves (CL)</td>
            <td>12</td>
            <td>3</td>
            <td style="color:var(--ok); font-weight:600">9</td>
          </tr>
          <tr>
            <td>Sick Leaves (SL)</td>
            <td>8</td>
            <td>1</td>
            <td style="color:var(--ok); font-weight:600">7</td>
          </tr>
        </tbody>
      </table>
      <div style="color:var(--mu); font-size:10px">✓ Updated from HR Portal: eTimeTrackLite Sync v2.0</div>
    </div>`;
  
  openInfoDrawer('Leave Summary — ' + emp.id, html);
}

function showShiftDetails(id) {
  const emp = EMP.find(e => e.id === id);
  if (!emp) return;

  const group = emp.shiftGroup || 'General Shift Group';
  const roster = emp.shiftRoster || 'Standard Roster';

  const html = `
    <div style="font-family:var(--sa); font-size:12px; line-height:1.6">
      <div style="font-size:14px; font-weight:600; margin-bottom:12px; color:var(--ac)">Shift Schedule: ${emp.name}</div>
      <div style="margin-bottom:8px"><strong>Active Shift Group:</strong> ${group}</div>
      <div style="margin-bottom:8px"><strong>Shift Roster Profile:</strong> ${roster}</div>
      <table style="width:100%; border:1px solid var(--br); margin-bottom:12px">
        <thead>
          <tr>
            <th style="background:var(--s2)">Day</th>
            <th style="background:var(--s2)">In Time</th>
            <th style="background:var(--s2)">Out Time</th>
            <th style="background:var(--s2)">Grace Period</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Monday - Friday</td>
            <td>09:00 AM</td>
            <td>05:30 PM</td>
            <td>15 Mins</td>
          </tr>
          <tr>
            <td>Saturday</td>
            <td>09:00 AM</td>
            <td>01:30 PM</td>
            <td>15 Mins</td>
          </tr>
          <tr>
            <td>Sunday</td>
            <td colspan="3" style="text-align:center; color:var(--err)">Weekly Off</td>
          </tr>
        </tbody>
      </table>
    </div>`;

  openInfoDrawer('Shift Details — ' + emp.id, html);
}

function showOtherDetails(id) {
  const emp = EMP.find(e => e.id === id);
  if (!emp) return;

  const html = `
    <div style="font-family:var(--sa); font-size:12px; line-height:1.6">
      <div style="font-size:14px; font-weight:600; margin-bottom:12px; color:var(--ac)">Organizational Tree Details</div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:12px">
        <div><strong>Sub Department:</strong> ${emp.subDepartment || 'None'}</div>
        <div><strong>Division:</strong> ${emp.division || 'None'}</div>
        <div><strong>Grade:</strong> ${emp.grade || 'G1'}</div>
        <div><strong>Team:</strong> ${emp.team || 'None'}</div>
        <div><strong>Location:</strong> ${emp.location || 'HQ - Bangalore'}</div>
        <div><strong>Employment Type:</strong> ${emp.employmentType || 'Permanent'}</div>
        <div><strong>Holiday Group:</strong> ${emp.holidayGroup || 'None'}</div>
        <div><strong>Geofence Zone:</strong> ${emp.geofence || 'None'}</div>
      </div>
    </div>`;

  openInfoDrawer('Other Details — ' + emp.id, html);
}

function showPayDetails(id) {
  const emp = EMP.find(e => e.id === id);
  if (!emp) return;

  const basic = 25000 + Math.floor(Math.random() * 50000);
  const hra = Math.round(basic * 0.4);
  const pf = Math.round(basic * 0.12);
  const total = basic + hra - pf;

  const html = `
    <div style="font-family:var(--sa); font-size:12px; line-height:1.6">
      <div style="font-size:14px; font-weight:600; margin-bottom:12px; color:var(--ac)">Compensation Summary: ${emp.name}</div>
      <div style="margin-bottom:10px"><strong>Salary Structure Grade:</strong> ${emp.grade || 'G1'}</div>
      <table style="width:100%; border:1px solid var(--br); margin-bottom:12px">
        <tbody>
          <tr>
            <td>Basic Salary</td>
            <td style="text-align:right">₹ ${basic.toLocaleString()}</td>
          </tr>
          <tr>
            <td>HRA Allowance</td>
            <td style="text-align:right">₹ ${hra.toLocaleString()}</td>
          </tr>
          <tr>
            <td>Provident Fund (PF) Deduct</td>
            <td style="text-align:right; color:var(--err)">- ₹ ${pf.toLocaleString()}</td>
          </tr>
          <tr style="font-weight:600; border-top:1px solid var(--br)">
            <td>Net Monthly Pay (Est.)</td>
            <td style="text-align:right; color:var(--ok)">₹ ${total.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>`;

  openInfoDrawer('Pay Details — ' + emp.id, html);
}

function toggleEmployeePhoto(id, event) {
  const photoDiv = document.getElementById(`photo-preview-${id}`);
  if (!photoDiv) return;

  if (photoDiv.style.display === 'none') {
    photoDiv.style.display = 'block';
  } else {
    photoDiv.style.display = 'none';
  }
}

function enrollFinger(id) {
  const emp = EMP.find(e => e.id === id);
  if (!emp) return;

  const html = `
    <div style="text-align:center; padding:15px; font-family:var(--sa)">
      <div style="font-size:14px; font-weight:600; margin-bottom:15px; color:var(--ac)">Biometric Fingerprint Enrollment</div>
      <div style="margin: 20px 0; position: relative; display: inline-block">
        <!-- fingerprint scanner icon -->
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--ac); animation: pulse-glow 1s infinite ease-in-out">
          <path d="M12 2a10 10 0 0 0-8 8.18M12 2a10 10 0 0 1 8 8.18M12 6a6 6 0 0 0-4.8 5M12 6a6 6 0 0 1 4.8 5M8 12.5a4 4 0 0 1 8 0M9.5 15a2.5 2.5 0 0 1 5 0M11.5 18a.5.5 0 0 1 1 0" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div id="scan-status" style="margin-top:15px; font-size:12px; color:var(--mu)">
        Please place finger on USB biometric reader scanner...
      </div>
    </div>`;

  openInfoDrawer('Biometric Enrollment — ' + emp.id, html);

  // Set timeout to simulate scan steps
  setTimeout(() => {
    const status = document.getElementById('scan-status');
    if (status) status.innerHTML = '<span style="color:var(--warn)">Scanning finger pattern... 50%</span>';
  }, 1000);

  setTimeout(() => {
    const status = document.getElementById('scan-status');
    if (status) status.innerHTML = '<span style="color:var(--ok); font-weight:600">✓ Fingerprint enrolled successfully! (Templates saved)</span>';
    notify(`Biometrics enrolled for ${emp.name}!`, 'ok');
  }, 2300);
}

// ══════════════════════════════════════════════
// Monthly Status Report Generator
// ══════════════════════════════════════════════
function generateMonthlyReport() {
  const fromVal = document.getElementById('rep-from').value;
  const toVal = document.getElementById('rep-to').value;
  const companyFilter = document.getElementById('rep-company').value;
  const deptFilter = document.getElementById('rep-dept').value;

  if (!fromVal || !toVal) {
    notify('Please select both From and To dates.', 'wn');
    return;
  }

  const startDate = new Date(fromVal);
  const endDate = new Date(toVal);

  if (startDate > endDate) {
    notify('From Date cannot be after To Date.', 'wn');
    return;
  }

  // Calculate list of dates in the range
  const dates = [];
  let curr = new Date(startDate);
  while (curr <= endDate) {
    dates.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }

  if (dates.length > 31) {
    notify('Maximum date range is 31 days.', 'wn');
    return;
  }

  // Filter employees
  let filteredEmps = [...EMP];
  if (companyFilter !== 'All') {
    filteredEmps = filteredEmps.filter(e => e.company === companyFilter);
  }
  if (deptFilter !== 'All') {
    filteredEmps = filteredEmps.filter(e => (e.department || e.dept) === deptFilter);
  }

  // Group employees by department
  const empsByDept = {};
  filteredEmps.forEach(e => {
    const d = e.department || e.dept || 'Unassigned';
    if (!empsByDept[d]) empsByDept[d] = [];
    empsByDept[d].push(e);
  });

  // Calculate day headers
  // Saturday is "St" and Sunday is "S", others are standard: M, T, W, Th, F
  const dayLetters = ["S", "M", "T", "W", "Th", "F", "St"];
  
  let headerDaysHtml = '';
  dates.forEach(d => {
    const dayNum = d.getDate();
    const dayName = dayLetters[d.getDay()];
    headerDaysHtml += `<th>${dayNum} ${dayName}</th>`;
  });

  // Compile Printed On timestamp
  const now = new Date();
  const printMonth = now.toLocaleDateString('en-US', { month: 'short' });
  const printDay = String(now.getDate()).padStart(2, '0');
  const printYr = now.getFullYear();
  const printTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const printedOnStr = `${printMonth} ${printDay} ${printYr} ${printTime}`;

  // Format title dates
  const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
  const startDay = String(startDate.getDate()).padStart(2, '0');
  const startYr = startDate.getFullYear();
  
  const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
  const endDay = String(endDate.getDate()).padStart(2, '0');
  const endYr = endDate.getFullYear();
  
  const dateRangeStr = `${startMonth} ${startDay} ${startYr} To ${endMonth} ${endDay} ${endYr}`;

  let reportHtml = `
    <div class="rep-title">Monthly Status Report (Basic Work Duration)</div>
    <div class="rep-range">${dateRangeStr}</div>
    
    <table class="rep-meta-table">
      <tr>
        <td>Company: ${companyFilter === 'All' ? 'KRIDE / GC / Default' : companyFilter}</td>
        <td style="text-align:right">Printed On : ${printedOnStr}</td>
      </tr>
    </table>
  `;

  if (filteredEmps.length === 0) {
    reportHtml += `
      <div style="text-align:center; padding:50px; color:#666; border:1px solid #000">
        No employees found matching the filters.
      </div>
    `;
    document.getElementById('report-sheet').innerHTML = reportHtml;
    return;
  }

  let tableHtml = `
    <table>
      <thead>
        <tr>
          <th style="width:80px; text-align:left">Days</th>
          ${headerDaysHtml}
        </tr>
      </thead>
      <tbody>
  `;

  // For each department
  Object.keys(empsByDept).sort().forEach(deptName => {
    tableHtml += `
      <tr class="rep-dept-row">
        <td colspan="${dates.length + 1}">Department: ${deptName}</td>
      </tr>
    `;

    // For each employee in this department
    empsByDept[deptName].forEach(emp => {
      tableHtml += `
        <tr class="rep-emp-row">
          <td colspan="${dates.length + 1}">Emp. Code:&nbsp;&nbsp;&nbsp;&nbsp;${emp.id}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Emp. Name:&nbsp;&nbsp;&nbsp;&nbsp;${emp.name}</td>
        </tr>
      `;

      // Calculate status, inTime, outTime, total for each date
      const rowStatus = [];
      const rowIn = [];
      const rowOut = [];
      const rowTotal = [];

      dates.forEach(date => {
        const dateStr = date.toISOString().slice(0, 10);
        const dayOfWeek = date.getDay(); // 0 is Sunday
        
        // Check real logs from ATT
        const realLogs = ATT.filter(a => a.empId === emp.id && new Date(a.ts).toISOString().slice(0, 10) === dateStr);

        if (realLogs.length > 0) {
          // Present via database logs
          realLogs.sort((a,b) => new Date(a.ts) - new Date(b.ts));
          const firstPunch = new Date(realLogs[0].ts);
          const inTimeStr = firstPunch.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
          
          let outTimeStr = '';
          let totalMinutes = 0;
          
          if (realLogs.length > 1) {
            const lastPunch = new Date(realLogs[realLogs.length - 1].ts);
            outTimeStr = lastPunch.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            totalMinutes = Math.round((lastPunch - firstPunch) / 1000 / 60);
          } else {
            // Only one punch recorded, let's mock the out punch as 8.5 hours later to avoid leaving total as 00:00
            const mockOut = new Date(firstPunch.getTime() + (8.5 * 60 * 60 * 1000));
            outTimeStr = mockOut.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            totalMinutes = 510; // 8.5 hours
          }

          const hours = Math.floor(totalMinutes / 60);
          const mins = totalMinutes % 60;
          const totalStr = `${hours}:${String(mins).padStart(2, '0')}`;

          rowStatus.push({ text: 'P', cls: 'rep-pres-cell' });
          rowIn.push(inTimeStr);
          rowOut.push(outTimeStr);
          rowTotal.push(totalStr);
        } else {
          // Deterministic mock generation based on Employee ID and Date
          if (dayOfWeek === 0) {
            // Sunday is Weekly Off
            rowStatus.push({ text: 'WO', cls: 'rep-wo-cell' });
            rowIn.push('');
            rowOut.push('');
            rowTotal.push('00:00');
          } else if (emp.status === 'Hibernate' || emp.status === 'Resigned') {
            // Hibernated or Resigned shows Absent
            rowStatus.push({ text: 'A', cls: 'rep-abs-cell' });
            rowIn.push('');
            rowOut.push('');
            rowTotal.push('00:00');
          } else {
            // Working employee: generate attendance deterministically based on date and ID
            const hashVal = hashStringToInteger(emp.id + dateStr);
            const isPresent = (hashVal % 100) < 85; // 85% attendance rate

            if (isPresent) {
              // Generate realistic in-time (e.g. between 09:30 and 10:15)
              const inHour = 9;
              const inMin = 30 + (hashVal % 45); // 9:30 to 10:15
              const inTimeStr = `${String(inHour).padStart(2, '0')}:${String(inMin).padStart(2, '0')}`;

              // Generate realistic duration (e.g. between 8 hours and 9 hours 15 mins)
              const durationMins = 480 + (hashVal % 75); // 8h to 9h15m
              const totalHours = Math.floor(durationMins / 60);
              const totalMins = durationMins % 60;
              const totalStr = `${totalHours}:${String(totalMins).padStart(2, '0')}`;

              // OutTime calculation
              let outHour = inHour + totalHours;
              let outMin = inMin + totalMins;
              if (outMin >= 60) {
                outHour += 1;
                outMin -= 60;
              }
              const outTimeStr = `${String(outHour).padStart(2, '0')}:${String(outMin).padStart(2, '0')}`;

              rowStatus.push({ text: 'P', cls: 'rep-pres-cell' });
              rowIn.push(inTimeStr);
              rowOut.push(outTimeStr);
              rowTotal.push(totalStr);
            } else {
              // Absent
              rowStatus.push({ text: 'A', cls: 'rep-abs-cell' });
              rowIn.push('');
              rowOut.push('');
              rowTotal.push('00:00');
            }
          }
        }
      });

      // Render rows
      tableHtml += `
        <tr>
          <td class="rep-label-col">Status</td>
          ${rowStatus.map(s => `<td class="${s.cls}">${s.text}</td>`).join('')}
        </tr>
        <tr>
          <td class="rep-label-col">InTime</td>
          ${rowIn.map(t => `<td>${t}</td>`).join('')}
        </tr>
        <tr>
          <td class="rep-label-col">OutTime</td>
          ${rowOut.map(t => `<td>${t}</td>`).join('')}
        </tr>
        <tr>
          <td class="rep-label-col">Total</td>
          ${rowTotal.map(t => `<td>${t}</td>`).join('')}
        </tr>
      `;
    });
  });

  tableHtml += `
      </tbody>
    </table>
  `;

  reportHtml += tableHtml;
  document.getElementById('report-sheet').innerHTML = reportHtml;
  notify('Monthly status report generated successfully.', 'ok');
}

// Deterministic helper
function hashStringToInteger(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

// Client side search highlight
function findInReport() {
  const sheet = document.getElementById('report-sheet');
  const query = document.getElementById('rep-find').value.trim();

  // Clear previous highlights
  removeHighlights(sheet);

  if (!query) return;

  // Walk text nodes and wrap matches in <mark> tags
  const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT, null, false);
  const nodesToReplace = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentNode.nodeName !== 'SCRIPT' && node.parentNode.nodeName !== 'STYLE' && node.nodeValue.toLowerCase().includes(query.toLowerCase())) {
      nodesToReplace.push(node);
    }
  }

  if (nodesToReplace.length === 0) {
    notify(`Text "${query}" not found in report.`, 'wn');
    return;
  }

  nodesToReplace.forEach(node => {
    const val = node.nodeValue;
    const parent = node.parentNode;
    const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
    const html = val.replace(regex, '<mark style="background:yellow; color:black">$1</mark>');
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    while (tempDiv.firstChild) {
      parent.insertBefore(tempDiv.firstChild, node);
    }
    parent.removeChild(node);
  });

  notify(`Found matches for "${query}".`, 'ok');
}

function removeHighlights(container) {
  const marks = container.querySelectorAll('mark');
  marks.forEach(mark => {
    const parent = mark.parentNode;
    const textNode = document.createTextNode(mark.textContent);
    parent.replaceChild(textNode, mark);
    parent.normalize();
  });
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ══════════════════════════════════════════════
// Company List Configuration Management
// ══════════════════════════════════════════════
function renderCompanyGrid() {
  const limitInput = document.getElementById('company-records-limit');
  let limit = limitInput ? parseInt(limitInput.value) : 10;
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > 10000) limit = 10000;
  if (limitInput) limitInput.value = limit;

  // 1. Sort
  const sorted = [...COMPANIES].sort((a, b) => {
    let valA = (a[companySortField] || '').toLowerCase();
    let valB = (b[companySortField] || '').toLowerCase();
    if (valA < valB) return companySortAsc ? -1 : 1;
    if (valA > valB) return companySortAsc ? 1 : -1;
    return 0;
  });

  // 2. Pagination
  const totalRecords = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
  if (companyPage > totalPages) companyPage = totalPages;
  if (companyPage < 1) companyPage = 1;

  const startIndex = (companyPage - 1) * limit;
  const endIndex = Math.min(startIndex + limit, totalRecords);
  const pageRecords = sorted.slice(startIndex, endIndex);

  // Update headers arrows dynamically
  const headers = document.querySelectorAll('#tab-company thead th');
  if (headers.length >= 2) {
    headers[0].innerHTML = `Company Name ${companySortField === 'name' ? (companySortAsc ? '▲' : '▼') : '⇅'}`;
    headers[1].innerHTML = `Short Name ${companySortField === 'short' ? (companySortAsc ? '▲' : '▼') : '⇅'}`;
  }

  // Render rows
  const tbody = document.getElementById('company-grid-body');
  if (!tbody) return;

  if (pageRecords.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="emp" style="text-align:center; padding:12px; color:var(--mu)">No companies registered.</td></tr>`;
    const gridInfo = document.getElementById('company-grid-info');
    if (gridInfo) gridInfo.textContent = 'Records: 0 - 0 of 0';
    const pageNum = document.getElementById('company-page-num');
    if (pageNum) pageNum.textContent = '1';
    return;
  }

  let html = '';
  pageRecords.forEach((c) => {
    const origIndex = COMPANIES.findIndex(comp => comp.name === c.name && comp.short === c.short);
    html += `
      <tr style="border-bottom:1px solid #eee">
        <td style="padding:8px; border-right:1px solid #ccc; font-weight:bold">${c.name}</td>
        <td style="padding:8px; border-right:1px solid #ccc">${c.short}</td>
        <td style="padding:8px; border-right:1px solid #ccc; text-align:center">
          <a href="#" style="color:#0055aa; text-decoration:none" onclick="event.preventDefault(); notify('Logo link clicked for ${c.short}', 'ok')">Logo</a>
        </td>
        <td style="padding:8px; border-right:1px solid #ccc; text-align:center">
          <a href="#" style="color:#0055aa; text-decoration:none" onclick="event.preventDefault(); openEditCompanyModal(${origIndex})">Edit</a>
        </td>
        <td style="padding:8px; text-align:center">
          <a href="#" style="color:#cc0000; text-decoration:none" onclick="event.preventDefault(); deleteCompanyItem(${origIndex})">Delete</a>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;

  // Update pagination UI
  const gridInfo = document.getElementById('company-grid-info');
  if (gridInfo) {
    if (totalRecords === 0) {
      gridInfo.textContent = 'Records: 0 - 0 of 0';
    } else {
      gridInfo.textContent = `Records: ${startIndex + 1} - ${endIndex} of ${totalRecords}`;
    }
  }

  const pageNum = document.getElementById('company-page-num');
  if (pageNum) {
    pageNum.textContent = companyPage;
  }
}

function sortCompanies(field) {
  if (companySortField === field) {
    companySortAsc = !companySortAsc;
  } else {
    companySortField = field;
    companySortAsc = true;
  }
  renderCompanyGrid();
}

function updateCompanyPagination() {
  companyPage = 1;
  renderCompanyGrid();
}

function prevCompanyPage() {
  if (companyPage > 1) {
    companyPage--;
    renderCompanyGrid();
  }
}

function nextCompanyPage() {
  const limitInput = document.getElementById('company-records-limit');
  let limit = limitInput ? parseInt(limitInput.value) : 10;
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > 10000) limit = 10000;
  
  const totalPages = Math.ceil(COMPANIES.length / limit);
  if (companyPage < totalPages) {
    companyPage++;
    renderCompanyGrid();
  }
}

function openAddCompanyModal() {
  document.getElementById('comp-modal-title').textContent = 'Add Company';
  document.getElementById('comp-edit-index').value = '';
  document.getElementById('comp-name').value = '';
  document.getElementById('comp-short').value = '';
  document.getElementById('company-modal').style.display = 'flex';
}

function openEditCompanyModal(idx) {
  const c = COMPANIES[idx];
  if (!c) return;
  document.getElementById('comp-modal-title').textContent = 'Edit Company';
  document.getElementById('comp-edit-index').value = idx;
  document.getElementById('comp-name').value = c.name;
  document.getElementById('comp-short').value = c.short;
  document.getElementById('company-modal').style.display = 'flex';
}

function closeCompanyModal() {
  document.getElementById('company-modal').style.display = 'none';
}

async function loadCompaniesFromAPI() {
  try {
    const res = await apiFetch('/api/companies');
    if (res && res.success && Array.isArray(res.companies)) {
      COMPANIES = res.companies.map(c => ({
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
      updateCompanySelects();
      renderCompanyGrid();
    }
  } catch (e) {
    console.warn('[LOAD COMPANIES]', e.message);
  }
}

async function saveCompanyModal() {
  const idxVal = document.getElementById('comp-edit-index').value;
  const name = document.getElementById('comp-name').value.trim();
  const short = document.getElementById('comp-short').value.trim();

  if (!name || !short) {
    notify('Company Name and Short Name are required.', 'wn');
    return;
  }

  const payload = {
    name,
    code: short.toUpperCase(),
    short_name: short
  };

  if (idxVal === '') {
    // Add
    const res = await apiPost('/api/companies', payload);
    if (res && res.success) {
      notify(`Company "${name}" registered successfully.`, 'ok');
      closeCompanyModal();
      await loadCompaniesFromAPI();
    } else {
      notify((res && res.error && res.error.message) || 'Failed to register company', 'er');
    }
  } else {
    // Edit
    const idx = parseInt(idxVal);
    const c = COMPANIES[idx];
    if (!c) return;
    const compId = c.id || c.code || short;
    const res = await apiPut(`/api/companies/${compId}`, payload);
    if (res && res.success) {
      notify(`Company details updated.`, 'ok');
      closeCompanyModal();
      await loadCompaniesFromAPI();
    } else {
      notify((res && res.error && res.error.message) || 'Failed to update company', 'er');
    }
  }
}

async function deleteCompanyItem(idx) {
  const c = COMPANIES[idx];
  if (!c) return;
  if (!confirm(`Are you sure you want to delete company "${c.name}"?`)) return;

  const compId = c.id || c.code || c.short;
  const res = await apiDelete(`/api/companies/${compId}`);
  if (res && res.success) {
    notify(`Company deleted successfully.`, 'wn');
    await loadCompaniesFromAPI();
  } else {
    notify((res && res.error && res.error.message) || 'Failed to delete company', 'er');
  }
}

function updateCompanySelects() {
  const selects = ['r-company', 'm-company', 'rep-company', 'emp-list-filter-company'];
  selects.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    
    const currentVal = select.value;
    select.innerHTML = '';
    
    if (id === 'rep-company' || id === 'emp-list-filter-company') {
      const optAll = document.createElement('option');
      optAll.value = 'All';
      optAll.textContent = 'All Companies';
      select.appendChild(optAll);
    }
    
    COMPANIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.short || c.code;
      opt.textContent = `${c.short || c.code} - ${c.name}`;
      select.appendChild(opt);
    });
    
    if (Array.from(select.options).some(o => o.value === currentVal)) {
      select.value = currentVal;
    } else {
      if (select.options.length > 0) {
        select.selectedIndex = 0;
      }
    }
  });
}

// ══════════════════════════════════════════════
// Employee List Grid Management
// ══════════════════════════════════════════════
function renderEmployeeGrid() {
  const limitInput = document.getElementById('emp-list-records-limit');
  let limit = limitInput ? parseInt(limitInput.value) : 20;
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 10000) limit = 10000;
  if (limitInput) limitInput.value = limit;

  // Retrieve filter values
  const compFilter = document.getElementById('emp-list-filter-company')?.value || 'All';
  const desFilter  = document.getElementById('emp-list-filter-designation')?.value || 'All';
  const statFilter = document.getElementById('emp-list-filter-status')?.value || 'All';
  const typeFilter = document.getElementById('emp-list-filter-emptype')?.value || 'All';

  // 1. Filter
  let filtered = EMP.filter(e => {
    const eComp = e.company || 'Default';
    if (compFilter !== 'All' && eComp !== compFilter) return false;

    const eRole = e.role || '';
    if (desFilter !== 'All' && eRole !== desFilter) return false;

    const eStat = e.status || 'Active';
    if (statFilter !== 'All' && eStat !== statFilter) return false;

    const eType = e.employmentType || e.employment_type || 'Permanent';
    if (typeFilter !== 'All' && eType !== typeFilter) return false;

    return true;
  });

  // 2. Sort
  filtered.sort((a, b) => {
    let valA, valB;
    if (empListSortField === 'id') {
      valA = a.id || '';
      valB = b.id || '';
      const numA = parseInt(valA.replace(/\D/g, ''));
      const numB = parseInt(valB.replace(/\D/g, ''));
      if (!isNaN(numA) && !isNaN(numB)) {
        return empListSortAsc ? numA - numB : numB - numA;
      }
    } else if (empListSortField === 'name') {
      valA = a.name || '';
      valB = b.name || '';
    } else if (empListSortField === 'company') {
      valA = a.company || 'Default';
      valB = b.company || 'Default';
    } else if (empListSortField === 'department') {
      valA = a.department || a.dept || '';
      valB = b.department || b.dept || '';
    } else if (empListSortField === 'role') {
      valA = a.role || '';
      valB = b.role || '';
    } else if (empListSortField === 'location') {
      valA = a.location || 'HQ - Bangalore';
      valB = b.location || 'HQ - Bangalore';
    } else if (empListSortField === 'category') {
      valA = a.category || 'Default';
      valB = b.category || 'Default';
    } else {
      valA = a[empListSortField] || '';
      valB = b[empListSortField] || '';
    }

    valA = String(valA).toLowerCase();
    valB = String(valB).toLowerCase();
    if (valA < valB) return empListSortAsc ? -1 : 1;
    if (valA > valB) return empListSortAsc ? 1 : -1;
    return 0;
  });

  // 3. Paginate
  const totalRecords = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
  if (empListPage > totalPages) empListPage = totalPages;
  if (empListPage < 1) empListPage = 1;

  const startIndex = (empListPage - 1) * limit;
  const endIndex = Math.min(startIndex + limit, totalRecords);
  const pageRecords = filtered.slice(startIndex, endIndex);

  // Update headers indicators dynamically
  const headers = document.querySelectorAll('#tab-employee-list thead th');
  const sortFields = ['id', 'name', 'company', 'department', 'role', 'location', 'category'];
  sortFields.forEach((f, idx) => {
    if (headers[idx]) {
      const colName = headers[idx].textContent.replace(/[⇅▲▼]/g, '').trim();
      const indicator = empListSortField === f ? (empListSortAsc ? '▲' : '▼') : '⇅';
      headers[idx].innerHTML = `${colName} ${indicator}`;
    }
  });

  // Render rows
  const tbody = document.getElementById('emp-list-grid-body');
  if (!tbody) return;

  if (pageRecords.length === 0) {
    tbody.innerHTML = `<tr><td colspan="15" class="emp" style="text-align:center; padding:12px; color:var(--mu)">No employees found matching filters.</td></tr>`;
    const gridInfo = document.getElementById('emp-list-grid-info');
    if (gridInfo) gridInfo.textContent = 'Records: 0 - 0 of 0';
    const pageNum = document.getElementById('emp-list-page-num');
    if (pageNum) pageNum.textContent = '1';
    return;
  }

  let html = '';
  pageRecords.forEach(e => {
    const company = e.company || 'Default';
    const dept = e.department || e.dept || 'N/A';
    const role = e.role || 'N/A';
    const loc = e.location || 'HQ - Bangalore';
    const cat = e.category || 'Default';

    html += `
      <tr style="border-bottom:1px solid #eee">
        <td style="padding:8px; border-right:1px solid #ccc; font-family:var(--mo); font-weight:bold">${e.id}</td>
        <td style="padding:8px; border-right:1px solid #ccc; font-weight:bold">${e.name}</td>
        <td style="padding:8px; border-right:1px solid #ccc">${company}</td>
        <td style="padding:8px; border-right:1px solid #ccc">${dept}</td>
        <td style="padding:8px; border-right:1px solid #ccc">${role}</td>
        <td style="padding:8px; border-right:1px solid #ccc">${loc}</td>
        <td style="padding:8px; border-right:1px solid #ccc">${cat}</td>
        <td style="padding:8px; border-right:1px solid #ccc; text-align:center">
          <a href="#" style="color:#0055aa; text-decoration:none" onclick="event.preventDefault(); showLeaveSummary('${e.id}')">Leave Summary</a>
        </td>
        <td style="padding:8px; border-right:1px solid #ccc; text-align:center">
          <a href="#" style="color:#0055aa; text-decoration:none" onclick="event.preventDefault(); showShiftDetails('${e.id}')">Shift Details</a>
        </td>
        <td style="padding:8px; border-right:1px solid #ccc; text-align:center">
          <a href="#" style="color:#0055aa; text-decoration:none" onclick="event.preventDefault(); showOtherDetails('${e.id}')">Other Details</a>
        </td>
        <td style="padding:8px; border-right:1px solid #ccc; text-align:center">
          <a href="#" style="color:#0055aa; text-decoration:none" onclick="event.preventDefault(); showPayDetails('${e.id}')">Pay Details</a>
        </td>
        <td style="padding:8px; border-right:1px solid #ccc; text-align:center">
          <a href="#" style="color:#0055aa; text-decoration:none" onclick="event.preventDefault(); showEmployeePhoto('${e.id}')">Photo</a>
        </td>
        <td style="padding:8px; border-right:1px solid #ccc; text-align:center">
          <a href="#" style="color:#cc0000; text-decoration:none; font-weight:bold" onclick="event.preventDefault(); deleteEmployeeList('${e.id}')">Delete</a>
        </td>
        <td style="padding:8px; border-right:1px solid #ccc; text-align:center">
          <a href="#" style="color:#0055aa; text-decoration:none; font-weight:bold" onclick="event.preventDefault(); openEmpModal('${e.id}')">Edit</a>
        </td>
        <td style="padding:8px; text-align:center">
          <a href="#" style="color:#0055aa; text-decoration:none" onclick="event.preventDefault(); enrollFinger('${e.id}')">Finger</a>
          <span style="color:#ccc; margin:0 3px">|</span>
          <a href="#" style="color:#0055aa; text-decoration:none" onclick="event.preventDefault(); showEmployeePhoto('${e.id}')">BioPhoto</a>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;

  // Update paginator label
  const gridInfo = document.getElementById('emp-list-grid-info');
  if (gridInfo) {
    gridInfo.textContent = `Records: ${startIndex + 1} - ${endIndex} of ${totalRecords}`;
  }

  const pageNum = document.getElementById('emp-list-page-num');
  if (pageNum) {
    pageNum.textContent = empListPage;
  }
}

function filterEmployeeGrid() {
  empListPage = 1;
  renderEmployeeGrid();
  notify('Employee list refreshed.', 'ok');
}

function sortEmployeesList(field) {
  if (empListSortField === field) {
    empListSortAsc = !empListSortAsc;
  } else {
    empListSortField = field;
    empListSortAsc = true;
  }
  renderEmployeeGrid();
}

function updateEmpListPagination() {
  empListPage = 1;
  renderEmployeeGrid();
}

function prevEmpListPage() {
  if (empListPage > 1) {
    empListPage--;
    renderEmployeeGrid();
  }
}

function nextEmpListPage() {
  const limitInput = document.getElementById('emp-list-records-limit');
  let limit = limitInput ? parseInt(limitInput.value) : 20;
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 10000) limit = 10000;
  
  const compFilter = document.getElementById('emp-list-filter-company')?.value || 'All';
  const desFilter  = document.getElementById('emp-list-filter-designation')?.value || 'All';
  const statFilter = document.getElementById('emp-list-filter-status')?.value || 'All';
  const typeFilter = document.getElementById('emp-list-filter-emptype')?.value || 'All';

  const count = EMP.filter(e => {
    const eComp = e.company || 'Default';
    if (compFilter !== 'All' && eComp !== compFilter) return false;
    const eRole = e.role || '';
    if (desFilter !== 'All' && eRole !== desFilter) return false;
    const eStat = e.status || 'Active';
    if (statFilter !== 'All' && eStat !== statFilter) return false;
    const eType = e.employmentType || e.employment_type || 'Permanent';
    if (typeFilter !== 'All' && eType !== typeFilter) return false;
    return true;
  }).length;

  const totalPages = Math.ceil(count / limit);
  if (empListPage < totalPages) {
    empListPage++;
    renderEmployeeGrid();
  }
}

function updateEmpListFilterDropdowns() {
  // 1. Company Filter
  const compSelect = document.getElementById('emp-list-filter-company');
  if (compSelect) {
    const currentVal = compSelect.value || 'All';
    compSelect.innerHTML = '<option value="All">All</option>';
    COMPANIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.short;
      opt.textContent = c.short;
      compSelect.appendChild(opt);
    });
    if (Array.from(compSelect.options).some(o => o.value === currentVal)) {
      compSelect.value = currentVal;
    }
  }

  // 2. Designation Filter
  const desSelect = document.getElementById('emp-list-filter-designation');
  if (desSelect) {
    const currentVal = desSelect.value || 'All';
    desSelect.innerHTML = '<option value="All">All</option>';
    
    // Get unique non-empty designations
    const designations = [...new Set(EMP.map(e => e.role).filter(Boolean))].sort();
    designations.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      desSelect.appendChild(opt);
    });
    if (Array.from(desSelect.options).some(o => o.value === currentVal)) {
      desSelect.value = currentVal;
    }
  }
}

function showEmployeePhoto(id) {
  const emp = EMP.find(e => e.id === id);
  if (!emp) return;
  const html = `
    <div style="text-align:center; padding:15px">
      <div style="font-size:14px; font-weight:600; margin-bottom:12px; color:var(--ac); font-family:var(--sa)">Employee Photo — ${emp.name}</div>
      ${emp.image || emp.img ? `<img src="${emp.image || emp.img}" style="max-width:100%; max-height:300px; border-radius:8px; border:2px solid var(--ac)">` : '<div style="color:var(--mu); font-size:12px; font-family:var(--sa)">No face camera snapshot registered.</div>'}
    </div>
  `;
  openInfoDrawer('Photo Preview', html);
}

async function deleteEmployeeList(id) {
  if (!confirm(`Remove employee ${id} from the system? Their attendance records will also be deleted.`)) return;
  const res = await apiDelete('/api/employees/' + id);
  if (res.success) {
    EMP = EMP.filter(e => e.id !== id);
    ATT = ATT.filter(a => a.empId !== id);
    renderEL();
    renderLog();
    updateStats();
    notify('Employee removed from database.', 'wn');
  } else {
    notify(res.error || 'Failed to delete employee.', 'er');
  }
}

// ══════════════════════════════════════════════
// Expose global window variables/triggers
// ══════════════════════════════════════════════
window.generateMonthlyReport = generateMonthlyReport;
window.findInReport = findInReport;
window.showSubTab = showSubTab;
window.renderDbdGrid = renderDbdGrid;
window.setupAutoRefresh = setupAutoRefresh;
window.manualRefreshDbd = manualRefreshDbd;
window.goToReportsMenu = goToReportsMenu;
window.doLogOff = doLogOff;
window.openMenuDrawer = openMenuDrawer;
window.toggleHibFields = toggleHibFields;
window.toggleOptionalFormFields = toggleOptionalFormFields;
window.toggleEmployeeDetails = toggleEmployeeDetails;
window.filterEmpDirectory = filterEmpDirectory;
window.deleteEmployee = deleteEmployee;
window.resetSeedDatabase = resetSeedDatabase;
window.showTab = showTab;
window.startRegCam = startRegCam;
window.doRegister = doRegister;
window.startAttCam = startAttCam;
window.stopAttCam = stopAttCam;
window.filt = filt;
window.clrFilt = clrFilt;
window.exportCSV = exportCSV;

window.openEmpModal = openEmpModal;
window.closeEmpModal = closeEmpModal;
window.saveEmpModal = saveEmpModal;
window.toggleModalHibFields = toggleModalHibFields;
window.syncAllDevices = syncAllDevices;
window.unsyncAllDevices = unsyncAllDevices;
window.showLeaveSummary = showLeaveSummary;
window.showShiftDetails = showShiftDetails;
window.showOtherDetails = showOtherDetails;
window.showPayDetails = showPayDetails;
window.toggleEmployeePhoto = toggleEmployeePhoto;
window.enrollFinger = enrollFinger;
window.closeInfoDrawer = closeInfoDrawer;

// Registration form helpers
window.toggleRegHibFields = toggleRegHibFields;
window.resetRegForm = resetRegForm;
window.syncRegFormDevices = syncRegFormDevices;
window.unsyncRegFormDevices = unsyncRegFormDevices;

// Company List helpers
window.loadCompaniesFromAPI = loadCompaniesFromAPI;
window.renderCompanyGrid = renderCompanyGrid;
window.sortCompanies = sortCompanies;
window.updateCompanyPagination = updateCompanyPagination;
window.prevCompanyPage = prevCompanyPage;
window.nextCompanyPage = nextCompanyPage;
window.openAddCompanyModal = openAddCompanyModal;
window.openEditCompanyModal = openEditCompanyModal;
window.closeCompanyModal = closeCompanyModal;
window.saveCompanyModal = saveCompanyModal;
window.deleteCompanyItem = deleteCompanyItem;
window.updateCompanySelects = updateCompanySelects;

// Employee List Grid helpers
window.renderEmployeeGrid = renderEmployeeGrid;
window.filterEmployeeGrid = filterEmployeeGrid;
window.sortEmployeesList = sortEmployeesList;
window.updateEmpListPagination = updateEmpListPagination;
window.prevEmpListPage = prevEmpListPage;
window.nextEmpListPage = nextEmpListPage;
window.updateEmpListFilterDropdowns = updateEmpListFilterDropdowns;
window.showEmployeePhoto = showEmployeePhoto;
window.deleteEmployeeList = deleteEmployeeList;

// Auth & User Management helpers
window.handleLoginFormSubmit = handleLoginFormSubmit;
window.fillPresetCredentials = fillPresetCredentials;
window.promptSwitchMode = promptSwitchMode;
window.closeSwitchModeModal = closeSwitchModeModal;
window.presetSwitchForm = presetSwitchForm;
window.doSwitchMode = doSwitchMode;
window.openUserMgmtModal = openUserMgmtModal;
window.closeUserMgmtModal = closeUserMgmtModal;
window.loadSystemUsers = loadSystemUsers;
window.createSystemUser = createSystemUser;
window.resetUserPasswordPrompt = resetUserPasswordPrompt;
window.deleteUserPrompt = deleteUserPrompt;
window.openChangelogModal = openChangelogModal;
window.closeChangelogModal = closeChangelogModal;
window.switchChangelogTab = switchChangelogTab;
window.toggleChangelogPref = toggleChangelogPref;

// Master Settings Modal Helpers
window.openMasterSettingsModal = openMasterSettingsModal;
window.closeMasterSettingsModal = closeMasterSettingsModal;
window.switchMasterSettingsTab = switchMasterSettingsTab;
window.saveMasterSettings = saveMasterSettings;
window.resetMasterSettingsDefaults = resetMasterSettingsDefaults;

// Shift Details Modal Helpers
window.openShiftDetailsModal = openShiftDetailsModal;
window.closeShiftDetailsModal = closeShiftDetailsModal;
window.loadShiftsList = loadShiftsList;
window.renderShiftsTable = renderShiftsTable;
window.openAddShiftModal = openAddShiftModal;
window.openEditShiftModal = openEditShiftModal;
window.closeShiftFormModal = closeShiftFormModal;
window.saveShiftForm = saveShiftForm;
window.deleteShiftPrompt = deleteShiftPrompt;

// ══════════════════════════════════════════════
// ⏱️ SHIFT DETAILS CONTROLLER
// ══════════════════════════════════════════════
let activeShiftsCache = [];

async function openShiftDetailsModal() {
  const modal = document.getElementById('shift-details-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  await loadShiftsList();
}

function closeShiftDetailsModal() {
  const modal = document.getElementById('shift-details-modal');
  if (modal) modal.style.display = 'none';
}

async function loadShiftsList() {
  const tbody = document.getElementById('shifts-tbody');
  const countLabel = document.getElementById('shifts-count-label');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--mu)">Loading shifts...</td></tr>';

  try {
    const res = await api('/shifts');
    if (res && res.success && Array.isArray(res.data?.shifts)) {
      activeShiftsCache = res.data.shifts;
      renderShiftsTable(activeShiftsCache);
      if (countLabel) countLabel.textContent = `Total configured shifts: ${activeShiftsCache.length}`;
    } else {
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--er)">Failed to load shifts.</td></tr>';
    }
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--er)">Error: ${err.message}</td></tr>`;
  }
}

function renderShiftsTable(shifts) {
  const tbody = document.getElementById('shifts-tbody');
  if (!tbody) return;

  if (!shifts || shifts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--mu)">No active shifts configured yet. Click "+ Add New Shift" to create one.</td></tr>';
    return;
  }

  tbody.innerHTML = shifts.map(s => {
    const formatTime = (t) => t ? String(t).slice(0, 5) : '--:--';
    const color = s.color || '#00d4aa';
    return `
      <tr style="border-bottom:1px solid var(--br); transition:background 0.15s">
        <td style="padding:10px">
          <span class="shift-code-badge" style="background:${color}20; color:${color}; border:1px solid ${color}40">
            <span class="shift-dot" style="background:${color}"></span>
            ${escapeHtml(s.code)}
          </span>
        </td>
        <td style="padding:10px; font-weight:600; color:var(--tx)">
          ${escapeHtml(s.name)}
        </td>
        <td style="padding:10px; text-align:center">
          <span class="shift-time-pill">${formatTime(s.start_time)} – ${formatTime(s.end_time)}</span>
        </td>
        <td style="padding:10px; text-align:center; color:var(--mu)">
          ${s.break_mins ? `${s.break_mins}m` : 'None'}
          ${s.break_start ? `<span style="font-size:10px; display:block">(${formatTime(s.break_start)} - ${formatTime(s.break_end)})</span>` : ''}
        </td>
        <td style="padding:10px; text-align:center; color:var(--ac)">
          +${s.late_grace_mins || 0}m
        </td>
        <td style="padding:10px; text-align:center">
          ${s.is_night_shift ? '<span class="status-badge" style="background:#a855f720; color:#a855f7; border:1px solid #a855f740">🌙 Overnight</span>' : '<span style="color:var(--mu)">Day</span>'}
        </td>
        <td style="padding:10px; text-align:right; white-space:nowrap">
          <button class="btn bsm" onclick="openEditShiftModal('${s.id}')" style="padding:3px 8px; font-size:11px">Edit</button>
          <button class="btn bsm" onclick="deleteShiftPrompt('${s.id}', '${s.code}')" style="padding:3px 8px; font-size:11px; color:var(--er); border-color:rgba(255,75,75,0.3)">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddShiftModal() {
  document.getElementById('shift-form-title').textContent = 'Add New Shift';
  document.getElementById('sf-id').value = '';
  document.getElementById('sf-code').value = '';
  document.getElementById('sf-code').disabled = false;
  document.getElementById('sf-name').value = '';
  document.getElementById('sf-start_time').value = '09:00';
  document.getElementById('sf-end_time').value = '18:00';
  document.getElementById('sf-break_start').value = '13:00';
  document.getElementById('sf-break_end').value = '14:00';
  document.getElementById('sf-break_mins').value = '60';
  document.getElementById('sf-early_in_mins').value = '30';
  document.getElementById('sf-late_grace_mins').value = '15';
  document.getElementById('sf-early_out_mins').value = '15';
  document.getElementById('sf-min_full_day_hrs').value = '8.0';
  document.getElementById('sf-min_half_day_hrs').value = '4.0';
  document.getElementById('sf-is_night_shift').checked = false;
  document.getElementById('sf-color').value = '#00d4aa';
  document.getElementById('sf-color-preview').textContent = '#00d4aa';

  document.getElementById('shift-form-modal').style.display = 'flex';
}

function openEditShiftModal(id) {
  const shift = activeShiftsCache.find(s => s.id === id);
  if (!shift) return;

  document.getElementById('shift-form-title').textContent = 'Edit Shift — ' + shift.code;
  document.getElementById('sf-id').value = shift.id;
  document.getElementById('sf-code').value = shift.code;
  document.getElementById('sf-code').disabled = true;
  document.getElementById('sf-name').value = shift.name;
  document.getElementById('sf-start_time').value = String(shift.start_time).slice(0, 5);
  document.getElementById('sf-end_time').value = String(shift.end_time).slice(0, 5);
  document.getElementById('sf-break_start').value = shift.break_start ? String(shift.break_start).slice(0, 5) : '';
  document.getElementById('sf-break_end').value = shift.break_end ? String(shift.break_end).slice(0, 5) : '';
  document.getElementById('sf-break_mins').value = shift.break_mins || 60;
  document.getElementById('sf-early_in_mins').value = shift.early_in_mins || 30;
  document.getElementById('sf-late_grace_mins').value = shift.late_grace_mins || 15;
  document.getElementById('sf-early_out_mins').value = shift.early_out_mins || 15;
  document.getElementById('sf-min_full_day_hrs').value = shift.min_full_day_hrs || 8.0;
  document.getElementById('sf-min_half_day_hrs').value = shift.min_half_day_hrs || 4.0;
  document.getElementById('sf-is_night_shift').checked = !!shift.is_night_shift;
  const col = shift.color || '#00d4aa';
  document.getElementById('sf-color').value = col;
  document.getElementById('sf-color-preview').textContent = col;

  document.getElementById('shift-form-modal').style.display = 'flex';
}

function closeShiftFormModal() {
  const modal = document.getElementById('shift-form-modal');
  if (modal) modal.style.display = 'none';
}

async function saveShiftForm(event) {
  if (event) event.preventDefault();

  const id = document.getElementById('sf-id').value.trim();
  const code = document.getElementById('sf-code').value.trim().toUpperCase();
  const name = document.getElementById('sf-name').value.trim();
  const start_time = document.getElementById('sf-start_time').value;
  const end_time = document.getElementById('sf-end_time').value;

  if (!code || !name || !start_time || !end_time) {
    notify('Shift Code, Name, Start Time, and End Time are required.', 'wn');
    return;
  }

  const payload = {
    code,
    name,
    start_time,
    end_time,
    break_start: document.getElementById('sf-break_start').value || null,
    break_end: document.getElementById('sf-break_end').value || null,
    break_mins: parseInt(document.getElementById('sf-break_mins').value, 10) || 60,
    early_in_mins: parseInt(document.getElementById('sf-early_in_mins').value, 10) || 30,
    late_grace_mins: parseInt(document.getElementById('sf-late_grace_mins').value, 10) || 15,
    early_out_mins: parseInt(document.getElementById('sf-early_out_mins').value, 10) || 15,
    min_full_day_hrs: parseFloat(document.getElementById('sf-min_full_day_hrs').value) || 8.0,
    min_half_day_hrs: parseFloat(document.getElementById('sf-min_half_day_hrs').value) || 4.0,
    is_night_shift: !!document.getElementById('sf-is_night_shift').checked,
    color: document.getElementById('sf-color').value || '#00d4aa'
  };

  const saveBtn = document.getElementById('sf-save-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }

  try {
    let res;
    if (id) {
      res = await api(`/shifts/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      res = await api('/shifts', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    if (res && res.success) {
      notify(`Shift "${name}" saved successfully!`, 'ok');
      closeShiftFormModal();
      await loadShiftsList();
    } else {
      notify(`Error saving shift: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Failed to save shift: ${err.message}`, 'er');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Shift';
    }
  }
}

async function deleteShiftPrompt(id, code) {
  if (!confirm(`Are you sure you want to delete shift "${code}"?`)) return;

  try {
    const res = await api(`/shifts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res && res.success) {
      notify(`Shift "${code}" deleted successfully.`, 'ok');
      await loadShiftsList();
    } else {
      notify(`Failed to delete shift: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error deleting shift: ${err.message}`, 'er');
  }
}

// Color picker listener
document.addEventListener('DOMContentLoaded', () => {
  const colPicker = document.getElementById('sf-color');
  const colPrev = document.getElementById('sf-color-preview');
  if (colPicker && colPrev) {
    colPicker.addEventListener('input', () => {
      colPrev.textContent = colPicker.value;
    });
  }
});

// ══════════════════════════════════════════════
// ⚙️ MASTER CONFIGURATION SETTINGS CONTROLLER
// ══════════════════════════════════════════════
let currentMasterSettings = {};

const MASTER_SETTINGS_DEFAULTS = {
  company_name: 'Soukhya Tech Solutions Ltd.',
  hq_location: 'Bangalore Headquarters, India',
  timezone: 'Asia/Kolkata',
  date_format: 'DD/MM/YYYY',
  currency: 'INR (₹)',
  late_grace_mins: 15,
  punch_cooldown_mins: 5,
  full_day_hrs: 8.0,
  half_day_hrs: 4.0,
  ot_threshold_mins: 30,
  face_match_threshold: 0.55,
  liveness_detection_enabled: true,
  multi_factor_required: false,
  session_timeout_mins: 30,
  audit_retention_days: 180,
  pii_masking_enabled: true
};

async function openMasterSettingsModal() {
  const modal = document.getElementById('master-settings-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  switchMasterSettingsTab('general');

  try {
    const res = await api('/settings/master');
    if (res && res.success && res.data && res.data.settings) {
      currentMasterSettings = res.data.settings;
      populateMasterSettingsForm(currentMasterSettings);
    } else {
      populateMasterSettingsForm(MASTER_SETTINGS_DEFAULTS);
    }
  } catch (e) {
    console.warn('[SETTINGS] Could not fetch remote master settings, using defaults:', e);
    populateMasterSettingsForm(MASTER_SETTINGS_DEFAULTS);
  }
}

function closeMasterSettingsModal() {
  const modal = document.getElementById('master-settings-modal');
  if (modal) modal.style.display = 'none';
}

function switchMasterSettingsTab(tabName) {
  const tabs = ['general', 'attendance', 'biometrics', 'security'];
  tabs.forEach(t => {
    const btn = document.getElementById('ms-tab-btn-' + t);
    const content = document.getElementById('ms-tab-' + t);
    if (btn) btn.classList.toggle('active', t === tabName);
    if (content) content.style.display = (t === tabName) ? 'block' : 'none';
  });
}

function populateMasterSettingsForm(data) {
  const getVal = (k, def) => (typeof data[k] !== 'undefined' ? data[k] : def);

  const setInput = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  const setCheck = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = (val === true || val === 'true' || val === 1 || val === '1');
  };

  setInput('ms-company_name', getVal('company_name', MASTER_SETTINGS_DEFAULTS.company_name));
  setInput('ms-hq_location', getVal('hq_location', MASTER_SETTINGS_DEFAULTS.hq_location));
  setInput('ms-timezone', getVal('timezone', MASTER_SETTINGS_DEFAULTS.timezone));
  setInput('ms-date_format', getVal('date_format', MASTER_SETTINGS_DEFAULTS.date_format));
  setInput('ms-currency', getVal('currency', MASTER_SETTINGS_DEFAULTS.currency));

  setInput('ms-late_grace_mins', getVal('late_grace_mins', MASTER_SETTINGS_DEFAULTS.late_grace_mins));
  setInput('ms-punch_cooldown_mins', getVal('punch_cooldown_mins', MASTER_SETTINGS_DEFAULTS.punch_cooldown_mins));
  setInput('ms-full_day_hrs', getVal('full_day_hrs', MASTER_SETTINGS_DEFAULTS.full_day_hrs));
  setInput('ms-half_day_hrs', getVal('half_day_hrs', MASTER_SETTINGS_DEFAULTS.half_day_hrs));
  setInput('ms-ot_threshold_mins', getVal('ot_threshold_mins', MASTER_SETTINGS_DEFAULTS.ot_threshold_mins));

  const faceThresh = parseFloat(getVal('face_match_threshold', MASTER_SETTINGS_DEFAULTS.face_match_threshold)) || 0.55;
  setInput('ms-face_match_threshold', faceThresh);
  const faceValEl = document.getElementById('ms-face_match_val');
  if (faceValEl) faceValEl.textContent = faceThresh.toFixed(2);

  setCheck('ms-liveness_detection_enabled', getVal('liveness_detection_enabled', MASTER_SETTINGS_DEFAULTS.liveness_detection_enabled));
  setCheck('ms-multi_factor_required', getVal('multi_factor_required', MASTER_SETTINGS_DEFAULTS.multi_factor_required));

  setInput('ms-session_timeout_mins', getVal('session_timeout_mins', MASTER_SETTINGS_DEFAULTS.session_timeout_mins));
  setInput('ms-audit_retention_days', getVal('audit_retention_days', MASTER_SETTINGS_DEFAULTS.audit_retention_days));
  setCheck('ms-pii_masking_enabled', getVal('pii_masking_enabled', MASTER_SETTINGS_DEFAULTS.pii_masking_enabled));
}

function resetMasterSettingsDefaults() {
  populateMasterSettingsForm(MASTER_SETTINGS_DEFAULTS);
  notify('Restored default master settings values. Click Save to apply.', 'ok');
}

async function saveMasterSettings(event) {
  if (event) event.preventDefault();

  const payload = {
    company_name: document.getElementById('ms-company_name')?.value?.trim() || '',
    hq_location: document.getElementById('ms-hq_location')?.value?.trim() || '',
    timezone: document.getElementById('ms-timezone')?.value || 'Asia/Kolkata',
    date_format: document.getElementById('ms-date_format')?.value || 'DD/MM/YYYY',
    currency: document.getElementById('ms-currency')?.value?.trim() || 'INR (₹)',

    late_grace_mins: parseInt(document.getElementById('ms-late_grace_mins')?.value, 10) || 15,
    punch_cooldown_mins: parseInt(document.getElementById('ms-punch_cooldown_mins')?.value, 10) || 5,
    full_day_hrs: parseFloat(document.getElementById('ms-full_day_hrs')?.value) || 8.0,
    half_day_hrs: parseFloat(document.getElementById('ms-half_day_hrs')?.value) || 4.0,
    ot_threshold_mins: parseInt(document.getElementById('ms-ot_threshold_mins')?.value, 10) || 30,

    face_match_threshold: parseFloat(document.getElementById('ms-face_match_threshold')?.value) || 0.55,
    liveness_detection_enabled: !!document.getElementById('ms-liveness_detection_enabled')?.checked,
    multi_factor_required: !!document.getElementById('ms-multi_factor_required')?.checked,

    session_timeout_mins: parseInt(document.getElementById('ms-session_timeout_mins')?.value, 10) || 30,
    audit_retention_days: parseInt(document.getElementById('ms-audit_retention_days')?.value, 10) || 180,
    pii_masking_enabled: !!document.getElementById('ms-pii_masking_enabled')?.checked
  };

  const saveBtn = document.getElementById('ms-save-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }

  try {
    const res = await api('/settings/master', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (res && res.success) {
      currentMasterSettings = res.data?.settings || payload;
      notify('Master Settings updated and persisted to database successfully!', 'ok');
      closeMasterSettingsModal();
    } else {
      const errMsg = res?.error?.message || 'Failed to update settings';
      notify(`Settings update error: ${errMsg}`, 'er');
    }
  } catch (err) {
    notify(`Failed to save settings: ${err.message}`, 'er');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Changes';
    }
  }
}

// ══════════════════════════════════════════════
// 📅 SHIFT CALENDAR CONTROLLER
// ══════════════════════════════════════════════
let activeCalendarYear = new Date().getFullYear();
let activeCalendarMonth = new Date().getMonth() + 1;
let cachedShiftsList = [];

async function getCachedShifts() {
  if (cachedShiftsList.length === 0) {
    try {
      const res = await api('/shifts');
      if (res && res.success && Array.isArray(res.data?.shifts)) {
        cachedShiftsList = res.data.shifts;
      }
    } catch (e) {
      console.warn('[SHIFTS] Failed to fetch cached shifts:', e);
    }
  }
  return cachedShiftsList;
}

async function openShiftCalendarModal() {
  const modal = document.getElementById('shift-calendar-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  const mSelect = document.getElementById('cal-month-select');
  const ySelect = document.getElementById('cal-year-select');
  if (mSelect) mSelect.value = activeCalendarMonth;
  if (ySelect) ySelect.value = activeCalendarYear;

  await loadCalendarMonth();
}

function closeShiftCalendarModal() {
  const modal = document.getElementById('shift-calendar-modal');
  if (modal) modal.style.display = 'none';
}

function navCalendarMonth(delta) {
  let m = parseInt(document.getElementById('cal-month-select')?.value || activeCalendarMonth, 10);
  let y = parseInt(document.getElementById('cal-year-select')?.value || activeCalendarYear, 10);

  m += delta;
  if (m < 1) {
    m = 12;
    y -= 1;
  } else if (m > 12) {
    m = 1;
    y += 1;
  }

  activeCalendarMonth = m;
  activeCalendarYear = y;

  const mSelect = document.getElementById('cal-month-select');
  const ySelect = document.getElementById('cal-year-select');
  if (mSelect) mSelect.value = m;
  if (ySelect) ySelect.value = y;

  loadCalendarMonth();
}

function setCalendarToToday() {
  const now = new Date();
  activeCalendarYear = now.getFullYear();
  activeCalendarMonth = now.getMonth() + 1;

  const mSelect = document.getElementById('cal-month-select');
  const ySelect = document.getElementById('cal-year-select');
  if (mSelect) mSelect.value = activeCalendarMonth;
  if (ySelect) ySelect.value = activeCalendarYear;

  loadCalendarMonth();
}

async function loadCalendarMonth() {
  const mSelect = document.getElementById('cal-month-select');
  const ySelect = document.getElementById('cal-year-select');
  const y = ySelect ? parseInt(ySelect.value, 10) : activeCalendarYear;
  const m = mSelect ? parseInt(mSelect.value, 10) : activeCalendarMonth;
  activeCalendarYear = y;
  activeCalendarMonth = m;

  const mStr = String(m).padStart(2, '0');
  const gridEl = document.getElementById('cal-days-grid');
  if (gridEl) gridEl.innerHTML = '<div style="grid-column:span 7; text-align:center; padding:30px; color:var(--mu)">Loading monthly schedule...</div>';

  try {
    const res = await api(`/shift-calendar?month=${y}-${mStr}`);
    if (res && res.success && res.data) {
      renderCalendarGrid(res.data);
    } else {
      notify('Failed to load shift calendar', 'er');
    }
  } catch (err) {
    notify(`Error loading calendar: ${err.message}`, 'er');
  }
}

function renderCalendarGrid(data) {
  const gridEl = document.getElementById('cal-days-grid');
  const statsEl = document.getElementById('cal-stats-summary');
  if (!gridEl) return;

  // Stats bar
  if (statsEl && data.summary) {
    statsEl.innerHTML = `
      <span style="color:#00d4aa; font-weight:600">💼 Workdays: <strong>${data.summary.working_days}</strong></span>
      <span style="color:#64748b; font-weight:600">☕ Off Days: <strong>${data.summary.weekly_offs}</strong></span>
      <span style="color:#ef4444; font-weight:600">🎉 Holidays: <strong>${data.summary.holidays}</strong></span>
    `;
  }

  const days = data.days || [];
  if (days.length === 0) return;

  const firstDayOfWeek = new Date(data.year, data.month - 1, 1).getDay(); // 0 = Sun
  const todayStr = new Date().toISOString().slice(0, 10);

  let html = '';

  // Leading empty placeholders
  for (let i = 0; i < firstDayOfWeek; i++) {
    html += '<div class="cal-day-card other-month"></div>';
  }

  // Days cards
  days.forEach(d => {
    const isToday = d.date === todayStr;
    const isOff = d.day_type === 'WEEKLY_OFF';
    const isHol = d.day_type === 'HOLIDAY';
    const isHalf = d.day_type === 'HALF_DAY';

    let cardClass = 'cal-day-card';
    if (isToday) cardClass += ' is-today';
    if (isOff) cardClass += ' type-off';
    if (isHol) cardClass += ' type-holiday';

    let badgeBg = isOff ? '#64748b' : (isHol ? '#ef4444' : (isHalf ? '#f59e0b' : (d.shift_color || '#00d4aa')));
    let badgeText = isOff ? 'WO' : (isHol ? 'HOL' : (isHalf ? 'HD' : d.shift_code));

    html += `
      <div class="${cardClass}" onclick="openShiftDayModal('${d.date}', '${d.day_type}', '${d.default_shift_id || 'SHIFT_GEN'}', '${escapeHtml(d.title || '')}')">
        <div class="cal-day-hdr">
          <span class="cal-day-num">${d.day_number}</span>
          <span class="cal-shift-pill" style="background:${badgeBg}22; color:${badgeBg}; border:1px solid ${badgeBg}55">
            <span style="width:6px; height:6px; border-radius:50%; background:${badgeBg}"></span>
            ${badgeText}
          </span>
        </div>
        <div>
          <div style="font-size:10.5px; font-weight:600; color:var(--tx)">${isOff ? 'Weekly Off' : (isHol ? 'Public Holiday' : d.shift_name)}</div>
          <div class="cal-day-title" title="${escapeHtml(d.title || '')}">${escapeHtml(d.title || '')}</div>
        </div>
      </div>
    `;
  });

  gridEl.innerHTML = html;
}

async function openShiftDayModal(dateStr, currentDayType, currentShiftId, currentTitle) {
  const modal = document.getElementById('shift-day-modal');
  if (!modal) return;

  document.getElementById('sd-date').value = dateStr;
  document.getElementById('sd-date-display').value = `${dateStr} (${new Date(dateStr).toLocaleDateString('default', { weekday: 'long' })})`;
  document.getElementById('sd-day-type').value = currentDayType || 'WORK';
  document.getElementById('sd-title').value = currentTitle || '';

  // Populate shifts dropdown
  const shifts = await getCachedShifts();
  const shiftSelect = document.getElementById('sd-shift-select');
  if (shiftSelect) {
    shiftSelect.innerHTML = shifts.map(s => `
      <option value="${s.id}" ${s.id === currentShiftId ? 'selected' : ''}>${s.code} - ${s.name} (${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)})</option>
    `).join('');
  }

  onShiftDayTypeChange();
  modal.style.display = 'flex';
}

function closeShiftDayModal() {
  const modal = document.getElementById('shift-day-modal');
  if (modal) modal.style.display = 'none';
}

function onShiftDayTypeChange() {
  const dayType = document.getElementById('sd-day-type')?.value;
  const shiftGroup = document.getElementById('sd-shift-group');
  if (shiftGroup) {
    shiftGroup.style.display = (dayType === 'WORK' || dayType === 'HALF_DAY') ? 'block' : 'none';
  }
}

async function saveShiftDayOverride(event) {
  if (event) event.preventDefault();

  const cal_date = document.getElementById('sd-date').value;
  const day_type = document.getElementById('sd-day-type').value;
  const default_shift_id = (day_type === 'WORK' || day_type === 'HALF_DAY') ? document.getElementById('sd-shift-select').value : null;
  const title = document.getElementById('sd-title').value.trim();

  try {
    const res = await api('/shift-calendar/day', {
      method: 'PUT',
      body: JSON.stringify({ cal_date, day_type, default_shift_id, title })
    });

    if (res && res.success) {
      notify(`Calendar day ${cal_date} updated successfully!`, 'ok');
      closeShiftDayModal();
      await loadCalendarMonth();
    } else {
      notify(`Failed to update calendar day: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error updating day: ${err.message}`, 'er');
  }
}

async function openShiftCalendarPatternModal() {
  const modal = document.getElementById('shift-pattern-modal');
  if (!modal) return;

  const mSelect = document.getElementById('sp-month');
  const ySelect = document.getElementById('sp-year');
  if (mSelect) {
    mSelect.innerHTML = [
      'January','February','March','April','May','June','July','August','September','October','November','December'
    ].map((name, i) => `<option value="${i + 1}" ${i + 1 === activeCalendarMonth ? 'selected' : ''}>${name}</option>`).join('');
  }
  if (ySelect) {
    ySelect.innerHTML = [2025, 2026, 2027, 2028].map(y => `<option value="${y}" ${y === activeCalendarYear ? 'selected' : ''}>${y}</option>`).join('');
  }

  const shifts = await getCachedShifts();
  const shiftSelect = document.getElementById('sp-default-shift');
  if (shiftSelect) {
    shiftSelect.innerHTML = shifts.map(s => `<option value="${s.id}">${s.code} - ${s.name}</option>`).join('');
  }

  modal.style.display = 'flex';
}

function closeShiftPatternModal() {
  const modal = document.getElementById('shift-pattern-modal');
  if (modal) modal.style.display = 'none';
}

async function applyCalendarPatternSubmit(event) {
  if (event) event.preventDefault();

  const year = parseInt(document.getElementById('sp-year').value, 10);
  const month = parseInt(document.getElementById('sp-month').value, 10);
  const pattern_type = document.getElementById('sp-pattern-type').value;
  const default_shift_id = document.getElementById('sp-default-shift').value;

  try {
    const res = await api('/shift-calendar/apply-pattern', {
      method: 'POST',
      body: JSON.stringify({ year, month, pattern_type, default_shift_id })
    });

    if (res && res.success) {
      notify(`Weekly off pattern applied to ${month}/${year} (${res.data?.result?.count || 0} days configured)!`, 'ok');
      closeShiftPatternModal();
      activeCalendarYear = year;
      activeCalendarMonth = month;
      const mSelect = document.getElementById('cal-month-select');
      const ySelect = document.getElementById('cal-year-select');
      if (mSelect) mSelect.value = month;
      if (ySelect) ySelect.value = year;
      await loadCalendarMonth();
    } else {
      notify(`Failed to apply pattern: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error applying pattern: ${err.message}`, 'er');
  }
}

// ══════════════════════════════════════════════
// 👥 SHIFT GROUP CONTROLLER
// ══════════════════════════════════════════════
let allShiftGroupsList = [];
let activeManagingGroupId = null;
let allEmployeesCache = [];

async function openShiftGroupModal() {
  const modal = document.getElementById('shift-group-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  await loadShiftGroups();
}

function closeShiftGroupModal() {
  const modal = document.getElementById('shift-group-modal');
  if (modal) modal.style.display = 'none';
}

async function loadShiftGroups() {
  const container = document.getElementById('shift-groups-container');
  const countLabel = document.getElementById('shift-groups-count-label');
  if (container) container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--mu)">Loading shift groups...</div>';

  try {
    const res = await api('/shift-groups');
    if (res && res.success && Array.isArray(res.data?.groups)) {
      allShiftGroupsList = res.data.groups;
      if (countLabel) countLabel.textContent = `Showing ${allShiftGroupsList.length} configured shift group(s)`;
      renderShiftGroups(allShiftGroupsList);
    } else {
      notify('Failed to load shift groups', 'er');
    }
  } catch (err) {
    notify(`Error loading shift groups: ${err.message}`, 'er');
  }
}

async function renderShiftGroups(groups) {
  const container = document.getElementById('shift-groups-container');
  if (!container) return;

  if (groups.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:40px; background:var(--s2); border-radius:8px; border:1px solid var(--br)">
        <div style="font-size:28px; margin-bottom:10px">👥</div>
        <div style="font-size:13px; font-weight:600; color:var(--tx)">No Shift Groups Configured</div>
        <div style="font-size:11px; color:var(--mu); margin-top:4px">Create a group to configure team shift rotation cycles.</div>
        <button class="btn btnp bsm" style="margin-top:12px" onclick="openAddShiftGroupModal()">+ Add Shift Group</button>
      </div>
    `;
    return;
  }

  const shifts = await getCachedShifts();
  const shiftMap = {};
  shifts.forEach(s => { shiftMap[s.id] = s; });

  const html = groups.map(g => {
    const seq = Array.isArray(g.shifts_sequence) ? g.shifts_sequence : [];
    const seqBadges = seq.map((sId, idx) => {
      const s = shiftMap[sId] || { code: sId, name: sId, color: '#4f8ef7' };
      const arrow = idx < seq.length - 1 ? '<span class="sg-seq-arrow">→</span>' : '';
      return `
        <span class="sg-seq-item" style="background:${s.color || '#4f8ef7'}22; color:${s.color || '#4f8ef7'}; border:1px solid ${s.color || '#4f8ef7'}44">
          ${s.code || sId}
        </span>
        ${arrow}
      `;
    }).join(' ');

    return `
      <div class="shift-group-card">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px">
            <div style="display:flex; align-items:center; gap:8px">
              <span style="width:10px; height:10px; border-radius:50%; background:${g.color || '#4f8ef7'}"></span>
              <strong style="font-size:13px; color:var(--tx)">${escapeHtml(g.name)}</strong>
            </div>
            <span class="sg-badge-mode">${g.rotation_type}</span>
          </div>

          <div style="font-size:10.5px; font-family:var(--mo); color:var(--mu); margin-bottom:8px">
            Code: <strong style="color:var(--ac)">${escapeHtml(g.code)}</strong>
          </div>

          <div style="margin-bottom:10px">
            <div style="font-size:10px; color:var(--mu); margin-bottom:4px">Rotation Shift Sequence:</div>
            <div class="sg-seq-flow">${seqBadges || '<span style="font-size:10px; color:var(--mu)">No sequence</span>'}</div>
          </div>

          <div style="font-size:11px; color:var(--mu); line-height:1.4">
            ${escapeHtml(g.description || 'No description provided.')}
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--br); padding-top:10px; margin-top:4px">
          <span style="font-size:11px; font-weight:600; color:var(--tx); display:flex; align-items:center; gap:4px">
            👥 <span>${g.member_count || 0} Members</span>
          </span>
          <div style="display:flex; gap:6px">
            <button class="btn bsm" style="font-size:10.5px; padding:3px 8px" onclick="openShiftGroupMembersModal('${g.id}', '${escapeHtml(g.name)}')">👥 Members</button>
            <button class="btn bsm" style="font-size:10.5px; padding:3px 8px" onclick="openEditShiftGroupModal('${g.id}')">✏️ Edit</button>
            <button class="btn bsm" style="font-size:10.5px; padding:3px 8px; color:var(--err)" onclick="deleteShiftGroupPrompt('${g.id}', '${escapeHtml(g.name)}')">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

async function openAddShiftGroupModal() {
  const modal = document.getElementById('shift-group-form-modal');
  if (!modal) return;

  document.getElementById('sg-form-title').textContent = 'Add New Shift Group';
  document.getElementById('sg-id').value = '';
  document.getElementById('sg-name').value = '';
  document.getElementById('sg-code').value = '';
  document.getElementById('sg-code').disabled = false;
  document.getElementById('sg-desc').value = '';
  document.getElementById('sg-rotation-type').value = 'WEEKLY';
  document.getElementById('sg-color').value = '#4f8ef7';
  document.getElementById('sg-color-preview').textContent = '#4f8ef7';
  document.getElementById('sg-active').checked = true;

  await renderShiftGroupSequenceSelector(['SHIFT_MOR', 'SHIFT_EVE', 'SHIFT_NIT']);
  modal.style.display = 'flex';
}

async function openEditShiftGroupModal(id) {
  const modal = document.getElementById('shift-group-form-modal');
  if (!modal) return;

  try {
    const res = await api(`/shift-groups/${encodeURIComponent(id)}`);
    if (res && res.success && res.data?.group) {
      const g = res.data.group;
      document.getElementById('sg-form-title').textContent = `Edit Shift Group (${g.code})`;
      document.getElementById('sg-id').value = g.id;
      document.getElementById('sg-name').value = g.name;
      document.getElementById('sg-code').value = g.code;
      document.getElementById('sg-code').disabled = true;
      document.getElementById('sg-desc').value = g.description || '';
      document.getElementById('sg-rotation-type').value = g.rotation_type || 'FIXED';
      document.getElementById('sg-color').value = g.color || '#4f8ef7';
      document.getElementById('sg-color-preview').textContent = g.color || '#4f8ef7';
      document.getElementById('sg-active').checked = g.active !== false;

      await renderShiftGroupSequenceSelector(g.shifts_sequence || ['SHIFT_GEN']);
      modal.style.display = 'flex';
    } else {
      notify('Failed to load group details', 'er');
    }
  } catch (err) {
    notify(`Error opening group: ${err.message}`, 'er');
  }
}

async function renderShiftGroupSequenceSelector(selectedShiftIds) {
  const container = document.getElementById('sg-sequence-selector');
  if (!container) return;

  const shifts = await getCachedShifts();
  const selectedSet = new Set(selectedShiftIds || []);

  container.innerHTML = shifts.map(s => {
    const checked = selectedSet.has(s.id) ? 'checked' : '';
    return `
      <label style="display:inline-flex; align-items:center; gap:6px; background:var(--s1); padding:4px 10px; border-radius:4px; border:1px solid var(--br); font-size:11px; cursor:pointer">
        <input type="checkbox" name="sg-shift-seq" value="${s.id}" ${checked} />
        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${s.color}"></span>
        <span><strong>${s.code}</strong> (${s.name})</span>
      </label>
    `;
  }).join('');
}

function closeShiftGroupFormModal() {
  const modal = document.getElementById('shift-group-form-modal');
  if (modal) modal.style.display = 'none';
}

async function saveShiftGroupForm(event) {
  if (event) event.preventDefault();

  const id = document.getElementById('sg-id').value;
  const name = document.getElementById('sg-name').value.trim();
  const code = document.getElementById('sg-code').value.trim().toUpperCase();
  const rotation_type = document.getElementById('sg-rotation-type').value;
  const description = document.getElementById('sg-desc').value.trim();
  const color = document.getElementById('sg-color').value;
  const active = !!document.getElementById('sg-active').checked;

  const checkedBoxes = Array.from(document.querySelectorAll('input[name="sg-shift-seq"]:checked'));
  const shifts_sequence = checkedBoxes.map(cb => cb.value);

  if (shifts_sequence.length === 0) {
    notify('Please select at least one shift in the rotation sequence', 'wn');
    return;
  }

  const payload = { name, code, rotation_type, description, color, shifts_sequence, active };

  try {
    let res;
    if (id) {
      res = await api(`/shift-groups/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      res = await api('/shift-groups', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    if (res && res.success) {
      notify(`Shift Group "${name}" saved successfully!`, 'ok');
      closeShiftGroupFormModal();
      await loadShiftGroups();
    } else {
      notify(`Failed to save shift group: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error saving group: ${err.message}`, 'er');
  }
}

async function deleteShiftGroupPrompt(id, name) {
  if (!confirm(`Are you sure you want to delete shift group "${name}"? Assigned members will be unlinked.`)) return;

  try {
    const res = await api(`/shift-groups/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res && res.success) {
      notify(`Shift group "${name}" deleted successfully.`, 'ok');
      await loadShiftGroups();
    } else {
      notify(`Failed to delete group: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error deleting group: ${err.message}`, 'er');
  }
}

// ── Manage Shift Group Members ──
async function openShiftGroupMembersModal(groupId, groupName) {
  activeManagingGroupId = groupId;
  const modal = document.getElementById('shift-group-members-modal');
  if (!modal) return;

  document.getElementById('sgm-title').textContent = `Manage Members: ${groupName}`;
  document.getElementById('sgm-subtitle').textContent = `Assign employees to shift group ${groupId}`;

  // Fetch employees
  try {
    const [empRes, grpRes] = await Promise.all([
      api('/employees?pageSize=500'),
      api(`/shift-groups/${encodeURIComponent(groupId)}`)
    ]);

    allEmployeesCache = empRes?.data?.employees || [];
    const assignedMemberIds = new Set((grpRes?.data?.group?.members || []).map(m => m.emp_id));

    // Populate department filter
    const depts = Array.from(new Set(allEmployeesCache.map(e => e.dept || e.department).filter(Boolean)));
    const deptSelect = document.getElementById('sgm-dept-filter');
    if (deptSelect) {
      deptSelect.innerHTML = '<option value="">All Departments</option>' + depts.map(d => `<option value="${d}">${d}</option>`).join('');
    }

    renderGroupMembersList(allEmployeesCache, assignedMemberIds);
    modal.style.display = 'flex';
  } catch (err) {
    notify(`Error loading members: ${err.message}`, 'er');
  }
}

function renderGroupMembersList(employees, assignedMemberIds) {
  const tbody = document.getElementById('sgm-tbody');
  if (!tbody) return;

  const html = employees.map(emp => {
    const isChecked = assignedMemberIds.has(emp.id) ? 'checked' : '';
    const dept = emp.dept || emp.department || 'General';
    return `
      <tr class="sgm-row" data-emp-id="${emp.id}" data-dept="${escapeHtml(dept)}" data-name="${escapeHtml(emp.name.toLowerCase())}" style="border-bottom:1px solid var(--br)">
        <td style="padding:6px; text-align:center">
          <input type="checkbox" class="sgm-chk" value="${emp.id}" ${isChecked} onchange="updateGroupMemberCount()" />
        </td>
        <td style="padding:6px; font-family:var(--mo); font-weight:600; color:var(--ac)">${emp.id}</td>
        <td style="padding:6px; font-weight:600; color:var(--tx)">${escapeHtml(emp.name)}</td>
        <td style="padding:6px; color:var(--mu)">${escapeHtml(dept)}</td>
        <td style="padding:6px; color:var(--mu)">${escapeHtml(emp.role || 'Staff')}</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = html;
  updateGroupMemberCount();
}

function filterGroupMembersList() {
  const search = document.getElementById('sgm-search')?.value?.trim().toLowerCase() || '';
  const dept = document.getElementById('sgm-dept-filter')?.value || '';
  const rows = document.querySelectorAll('.sgm-row');

  rows.forEach(row => {
    const empId = (row.getAttribute('data-emp-id') || '').toLowerCase();
    const name = (row.getAttribute('data-name') || '').toLowerCase();
    const rowDept = row.getAttribute('data-dept') || '';

    const matchSearch = !search || empId.includes(search) || name.includes(search);
    const matchDept = !dept || rowDept === dept;

    row.style.display = (matchSearch && matchDept) ? '' : 'none';
  });
}

function selectAllGroupMembers(check) {
  const visibleCheckboxes = document.querySelectorAll('.sgm-row:not([style*="display: none"]) .sgm-chk');
  visibleCheckboxes.forEach(cb => { cb.checked = check; });
  updateGroupMemberCount();
}

function updateGroupMemberCount() {
  const totalChecked = document.querySelectorAll('.sgm-chk:checked').length;
  const countEl = document.getElementById('sgm-selected-count');
  if (countEl) countEl.textContent = `${totalChecked} employee(s) assigned`;
}

async function saveShiftGroupMembers() {
  if (!activeManagingGroupId) return;

  const checkedBoxes = Array.from(document.querySelectorAll('.sgm-chk:checked'));
  const emp_ids = checkedBoxes.map(cb => cb.value);

  try {
    const res = await api(`/shift-groups/${encodeURIComponent(activeManagingGroupId)}/members`, {
      method: 'POST',
      body: JSON.stringify({ emp_ids })
    });

    if (res && res.success) {
      notify(`Successfully assigned ${emp_ids.length} employees to group!`, 'ok');
      closeShiftGroupMembersModal();
      await loadShiftGroups();
    } else {
      notify(`Failed to assign group members: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error saving group assignments: ${err.message}`, 'er');
  }
}

function closeShiftGroupMembersModal() {
  const modal = document.getElementById('shift-group-members-modal');
  if (modal) modal.style.display = 'none';
  activeManagingGroupId = null;
}

// ══════════════════════════════════════════════
// 📋 SHIFT ROSTER CONTROLLER
// ══════════════════════════════════════════════
let rosterSearchTimer = null;

async function openShiftRosterModal() {
  const modal = document.getElementById('shift-roster-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  // Initialize Month Picker
  const monthPicker = document.getElementById('roster-month-picker');
  if (monthPicker && !monthPicker.value) {
    const now = new Date();
    monthPicker.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  // Populate Dept and Group Filters
  try {
    const [empRes, grpRes] = await Promise.all([
      api('/employees?pageSize=500'),
      api('/shift-groups')
    ]);

    const employees = empRes?.data?.employees || [];
    const depts = Array.from(new Set(employees.map(e => e.dept || e.department).filter(Boolean)));
    const deptSelect = document.getElementById('roster-dept-filter');
    if (deptSelect) {
      deptSelect.innerHTML = '<option value="">All Departments</option>' + depts.map(d => `<option value="${d}">${d}</option>`).join('');
    }

    const groups = grpRes?.data?.groups || [];
    const grpSelect = document.getElementById('roster-group-filter');
    if (grpSelect) {
      grpSelect.innerHTML = '<option value="">All Groups</option>' + groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    }
  } catch (e) {
    console.warn('[ROSTER] Error loading filter options:', e);
  }

  await loadShiftRosterMatrix();
}

function closeShiftRosterModal() {
  const modal = document.getElementById('shift-roster-modal');
  if (modal) modal.style.display = 'none';
}

function debounceRosterSearch() {
  clearTimeout(rosterSearchTimer);
  rosterSearchTimer = setTimeout(() => {
    loadShiftRosterMatrix();
  }, 300);
}

async function loadShiftRosterMatrix() {
  const monthVal = document.getElementById('roster-month-picker')?.value || new Date().toISOString().slice(0, 7);
  const dept = document.getElementById('roster-dept-filter')?.value || '';
  const groupId = document.getElementById('roster-group-filter')?.value || '';
  const search = document.getElementById('roster-search-input')?.value?.trim() || '';

  const tbody = document.getElementById('roster-table-tbody');
  const thead = document.getElementById('roster-table-thead');
  const statsLabel = document.getElementById('roster-footer-stats');

  if (tbody) tbody.innerHTML = '<tr><td colspan="35" style="text-align:center; padding:40px; color:var(--mu)">Loading monthly roster matrix...</td></tr>';

  try {
    const query = new URLSearchParams({ month: monthVal, dept, groupId, search }).toString();
    const res = await api(`/shift-roster?${query}`);

    if (res && res.success && res.data) {
      renderShiftRosterTable(res.data);
      if (statsLabel) statsLabel.textContent = `Showing ${res.data.total_employees} employee schedules for ${res.data.month}/${res.data.year}`;
    } else {
      notify('Failed to load shift roster matrix', 'er');
    }
  } catch (err) {
    notify(`Error loading roster: ${err.message}`, 'er');
  }
}

function renderShiftRosterTable(data) {
  const thead = document.getElementById('roster-table-thead');
  const tbody = document.getElementById('roster-table-tbody');
  if (!thead || !tbody) return;

  const days = data.calendar_days || [];
  const employees = data.employees || [];

  // Header
  let headerHtml = '<tr>';
  headerHtml += '<th class="roster-emp-sticky" style="padding:8px 10px">Employee Details</th>';
  days.forEach(d => {
    const isWeekend = d.day_name === 'Sun' || d.day_name === 'Sat';
    headerHtml += `
      <th style="padding:6px 4px; min-width:34px; color:${isWeekend ? '#f59e0b' : 'inherit'}">
        <div style="font-size:11px">${d.day_number}</div>
        <div style="font-size:9px; color:var(--mu)">${d.day_name}</div>
      </th>
    `;
  });
  headerHtml += '<th style="padding:6px 8px; color:#00d4aa">Work</th>';
  headerHtml += '<th style="padding:6px 8px; color:#64748b">Off</th>';
  headerHtml += '</tr>';
  thead.innerHTML = headerHtml;

  // Body
  if (employees.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${days.length + 3}" style="text-align:center; padding:30px; color:var(--mu)">No active employees match the selected criteria.</td></tr>`;
    return;
  }

  let bodyHtml = '';
  employees.forEach(row => {
    const emp = row.employee;
    const sched = row.schedule;
    const stats = row.stats;

    bodyHtml += '<tr>';
    bodyHtml += `
      <td class="roster-emp-sticky" style="padding:6px 10px">
        <div style="display:flex; align-items:center; gap:8px">
          <div style="width:24px; height:24px; border-radius:50%; background:var(--s3); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:var(--ac); flex-shrink:0">
            ${emp.name.charAt(0)}
          </div>
          <div style="overflow:hidden">
            <div style="font-weight:600; color:var(--tx); white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${escapeHtml(emp.name)}</div>
            <div style="font-size:10px; color:var(--mu)">${emp.id} · <span style="color:var(--ac)">${escapeHtml(emp.dept || 'Staff')}</span></div>
          </div>
        </div>
      </td>
    `;

    days.forEach(d => {
      const cell = sched[d.date] || { shift_code: d.shift_code, shift_color: d.shift_color, day_type: d.day_type };
      const isOff = cell.day_type === 'WEEKLY_OFF';
      const isHol = cell.day_type === 'HOLIDAY';
      const isLeave = cell.day_type === 'LEAVE';
      const isOd = cell.day_type === 'OUTDOOR';

      let bg = cell.shift_color || '#00d4aa';
      let text = cell.shift_code || 'GEN';

      if (isOff) { bg = '#64748b'; text = 'WO'; }
      else if (isHol) { bg = '#ef4444'; text = 'HOL'; }
      else if (isLeave) { bg = '#ec4899'; text = 'LV'; }
      else if (isOd) { bg = '#8b5cf6'; text = 'OD'; }

      bodyHtml += `
        <td style="padding:4px 2px">
          <span class="roster-cell-chip" style="background:${bg}22; color:${bg}; border:1px solid ${bg}55"
                title="${escapeHtml(emp.name)} - ${d.date} (${text})\nClick to change shift"
                onclick="quickChangeRosterShift('${emp.id}', '${d.date}', '${cell.shift_id || 'SHIFT_GEN'}')">
            ${text}
          </span>
        </td>
      `;
    });

    bodyHtml += `<td style="font-weight:700; color:#00d4aa; font-family:var(--mo)">${stats.working_days}</td>`;
    bodyHtml += `<td style="font-weight:700; color:#64748b; font-family:var(--mo)">${stats.off_days}</td>`;
    bodyHtml += '</tr>';
  });

  tbody.innerHTML = bodyHtml;
}

async function quickChangeRosterShift(empId, dateStr, currentShiftId) {
  const shifts = await getCachedShifts();
  const options = [
    ...shifts.map(s => `[${s.code}] ${s.name}`),
    '[WO] Weekly Off',
    '[HOL] Public Holiday',
    '[LV] On Leave'
  ];

  const choice = prompt(`Change shift for employee ${empId} on date ${dateStr}:\nEnter option code (e.g. GEN, MOR, EVE, NIT, WO, HOL, LV):`, 'GEN');
  if (!choice) return;

  const clean = choice.trim().toUpperCase();
  let shift_id = 'SHIFT_GEN';
  let day_type = 'WORK';

  if (clean === 'WO') {
    day_type = 'WEEKLY_OFF';
  } else if (clean === 'HOL') {
    day_type = 'HOLIDAY';
  } else if (clean === 'LV') {
    day_type = 'LEAVE';
  } else {
    const matchedShift = shifts.find(s => s.code === clean || s.id === clean);
    if (matchedShift) {
      shift_id = matchedShift.id;
    } else {
      notify(`Unknown shift code "${clean}". Valid shifts: ${shifts.map(s => s.code).join(', ')}`, 'wn');
      return;
    }
  }

  try {
    const res = await api('/shift-roster/assign', {
      method: 'POST',
      body: JSON.stringify({
        emp_ids: [empId],
        start_date: dateStr,
        shift_id,
        day_type,
        note: 'Quick interactive roster update'
      })
    });

    if (res && res.success) {
      notify(`Updated shift for ${empId} on ${dateStr}`, 'ok');
      await loadShiftRosterMatrix();
    } else {
      notify(`Failed to update roster: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error assigning shift: ${err.message}`, 'er');
  }
}

// ── Auto Generate Roster Modal ──
async function openShiftRosterAutoModal() {
  const modal = document.getElementById('shift-roster-auto-modal');
  if (!modal) return;

  const currentMonthVal = document.getElementById('roster-month-picker')?.value || new Date().toISOString().slice(0, 7);
  document.getElementById('sra-month').value = currentMonthVal;

  const [empRes, grpRes] = await Promise.all([
    api('/employees?pageSize=500'),
    api('/shift-groups')
  ]);

  const employees = empRes?.data?.employees || [];
  const depts = Array.from(new Set(employees.map(e => e.dept || e.department).filter(Boolean)));
  const deptSelect = document.getElementById('sra-dept');
  if (deptSelect) {
    deptSelect.innerHTML = '<option value="">All Departments</option>' + depts.map(d => `<option value="${d}">${d}</option>`).join('');
  }

  const groups = grpRes?.data?.groups || [];
  const grpSelect = document.getElementById('sra-group');
  if (grpSelect) {
    grpSelect.innerHTML = '<option value="">All Groups</option>' + groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
  }

  modal.style.display = 'flex';
}

function closeShiftRosterAutoModal() {
  const modal = document.getElementById('shift-roster-auto-modal');
  if (modal) modal.style.display = 'none';
}

async function executeAutoGenerateRoster(event) {
  if (event) event.preventDefault();

  const monthStr = document.getElementById('sra-month').value;
  if (!monthStr) return;
  const parts = monthStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const dept = document.getElementById('sra-dept').value || null;
  const groupId = document.getElementById('sra-group').value || null;
  const overwrite = !!document.getElementById('sra-overwrite').checked;

  try {
    const res = await api('/shift-roster/auto-generate', {
      method: 'POST',
      body: JSON.stringify({ year, month, dept, groupId, overwrite })
    });

    if (res && res.success) {
      notify(`Auto-generated roster for ${res.data?.employees_count || 0} employees (${res.data?.total_slots || 0} date slots created)!`, 'ok');
      closeShiftRosterAutoModal();
      document.getElementById('roster-month-picker').value = monthStr;
      await loadShiftRosterMatrix();
    } else {
      notify(`Failed to generate roster: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error generating roster: ${err.message}`, 'er');
  }
}

// ── Bulk Assign Shift Modal ──
async function openShiftRosterAssignModal() {
  const modal = document.getElementById('shift-roster-assign-modal');
  if (!modal) return;

  const todayStr = new Date().toISOString().slice(0, 10);
  document.getElementById('sras-start-date').value = todayStr;
  document.getElementById('sras-end-date').value = todayStr;
  document.getElementById('sras-day-type').value = 'WORK';
  document.getElementById('sras-note').value = '';

  const [empRes, shifts] = await Promise.all([
    api('/employees?pageSize=500'),
    getCachedShifts()
  ]);

  const employees = empRes?.data?.employees || [];
  const empSelect = document.getElementById('sras-emp-select');
  if (empSelect) {
    empSelect.innerHTML = employees.map(e => `
      <option value="${e.id}">${e.name} (${e.id}) - ${e.dept || 'Staff'}</option>
    `).join('');
  }

  const shiftSelect = document.getElementById('sras-shift-id');
  if (shiftSelect) {
    shiftSelect.innerHTML = shifts.map(s => `
      <option value="${s.id}">${s.code} - ${s.name} (${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)})</option>
    `).join('');
  }

  onRosterBulkDayTypeChange();
  modal.style.display = 'flex';
}

function closeShiftRosterAssignModal() {
  const modal = document.getElementById('shift-roster-assign-modal');
  if (modal) modal.style.display = 'none';
}

function onRosterBulkDayTypeChange() {
  const dayType = document.getElementById('sras-day-type')?.value;
  const shiftWrap = document.getElementById('sras-shift-wrap');
  if (shiftWrap) {
    shiftWrap.style.display = (dayType === 'WORK') ? 'block' : 'none';
  }
}

async function executeBulkAssignRoster(event) {
  if (event) event.preventDefault();

  const selectedEmpOptions = Array.from(document.getElementById('sras-emp-select').selectedOptions);
  const emp_ids = selectedEmpOptions.map(opt => opt.value);
  if (emp_ids.length === 0) {
    notify('Please select at least one employee', 'wn');
    return;
  }

  const start_date = document.getElementById('sras-start-date').value;
  const end_date = document.getElementById('sras-end-date').value;
  const day_type = document.getElementById('sras-day-type').value;
  const shift_id = (day_type === 'WORK') ? document.getElementById('sras-shift-id').value : 'SHIFT_GEN';
  const note = document.getElementById('sras-note').value.trim();

  try {
    const res = await api('/shift-roster/assign', {
      method: 'POST',
      body: JSON.stringify({ emp_ids, start_date, end_date, shift_id, day_type, note })
    });

    if (res && res.success) {
      notify(`Shift assigned successfully to ${emp_ids.length} employees (${res.data?.result?.records_processed || 0} date records)!`, 'ok');
      closeShiftRosterAssignModal();
      await loadShiftRosterMatrix();
    } else {
      notify(`Failed to assign shifts: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error bulk assigning shifts: ${err.message}`, 'er');
  }
}

// Window exports
window.openShiftCalendarModal = openShiftCalendarModal;
window.closeShiftCalendarModal = closeShiftCalendarModal;
window.navCalendarMonth = navCalendarMonth;
window.setCalendarToToday = setCalendarToToday;
window.loadCalendarMonth = loadCalendarMonth;
window.openShiftDayModal = openShiftDayModal;
window.closeShiftDayModal = closeShiftDayModal;
window.onShiftDayTypeChange = onShiftDayTypeChange;
window.saveShiftDayOverride = saveShiftDayOverride;
window.openShiftCalendarPatternModal = openShiftCalendarPatternModal;
window.closeShiftPatternModal = closeShiftPatternModal;
window.applyCalendarPatternSubmit = applyCalendarPatternSubmit;

window.openShiftGroupModal = openShiftGroupModal;
window.closeShiftGroupModal = closeShiftGroupModal;
window.loadShiftGroups = loadShiftGroups;
window.openAddShiftGroupModal = openAddShiftGroupModal;
window.openEditShiftGroupModal = openEditShiftGroupModal;
window.closeShiftGroupFormModal = closeShiftGroupFormModal;
window.saveShiftGroupForm = saveShiftGroupForm;
window.deleteShiftGroupPrompt = deleteShiftGroupPrompt;
window.openShiftGroupMembersModal = openShiftGroupMembersModal;
window.closeShiftGroupMembersModal = closeShiftGroupMembersModal;
window.filterGroupMembersList = filterGroupMembersList;
window.selectAllGroupMembers = selectAllGroupMembers;
window.updateGroupMemberCount = updateGroupMemberCount;
window.saveShiftGroupMembers = saveShiftGroupMembers;

window.openShiftRosterModal = openShiftRosterModal;
window.closeShiftRosterModal = closeShiftRosterModal;
window.debounceRosterSearch = debounceRosterSearch;
window.loadShiftRosterMatrix = loadShiftRosterMatrix;
window.quickChangeRosterShift = quickChangeRosterShift;
window.openShiftRosterAutoModal = openShiftRosterAutoModal;
window.closeShiftRosterAutoModal = closeShiftRosterAutoModal;
window.executeAutoGenerateRoster = executeAutoGenerateRoster;
window.openShiftRosterAssignModal = openShiftRosterAssignModal;
window.closeShiftRosterAssignModal = closeShiftRosterAssignModal;
window.onRosterBulkDayTypeChange = onRosterBulkDayTypeChange;
window.executeBulkAssignRoster = executeBulkAssignRoster;

// ═══════════════════════════════════════════════════════════════
// ORGANIZATION SUBSYSTEM CONTROLLERS
// 1. Departments Master
// 2. Department Shifts Mapping
// 3. Public Holidays Master (Karnataka Gazette Reference)
// ═══════════════════════════════════════════════════════════════

let cachedDepartments = [];
let cachedPublicHolidays = [];

// ─────────────────────────────────────────────────────────────
// 1. DEPARTMENTS MASTER
// ─────────────────────────────────────────────────────────────
async function openDepartmentsModal() {
  const modal = document.getElementById('departments-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  await loadDepartments();
}

function closeDepartmentsModal() {
  const modal = document.getElementById('departments-modal');
  if (modal) modal.style.display = 'none';
}

async function loadDepartments() {
  const tbody = document.getElementById('departments-tbody');
  const countLabel = document.getElementById('departments-count-label');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--mu)">Loading departments...</td></tr>';

  try {
    const res = await api('/departments');
    if (res && res.success && Array.isArray(res.data?.departments)) {
      cachedDepartments = res.data.departments;
      renderDepartmentsTable(cachedDepartments);
      if (countLabel) countLabel.textContent = `Total Departments: ${cachedDepartments.length}`;
    } else {
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--er)">Failed to load departments.</td></tr>';
    }
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--er)">Error: ${err.message}</td></tr>`;
  }
}

function renderDepartmentsTable(depts) {
  const tbody = document.getElementById('departments-tbody');
  if (!tbody) return;

  if (!depts || depts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--mu)">No departments configured. Click "+ Add Department" to create one.</td></tr>';
    return;
  }

  tbody.innerHTML = depts.map(d => {
    const headText = d.head_name ? `${escapeHtml(d.head_name)} <span style="font-size:10px; color:var(--mu)">(${escapeHtml(d.head_emp_id)})</span>` : '<span style="color:var(--mu); font-style:italic">Unassigned</span>';
    const statusBadge = d.is_active ? 
      '<span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); font-size:10px; padding:2px 6px">Active</span>' : 
      '<span class="badge" style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); font-size:10px; padding:2px 6px">Inactive</span>';

    return `
      <tr style="border-bottom:1px solid var(--br)">
        <td style="padding:10px">
          <span style="font-weight:700; font-family:var(--mo); color:var(--ac); background:rgba(0,212,170,0.08); padding:3px 8px; border-radius:4px; border:1px solid rgba(0,212,170,0.2)">
            ${escapeHtml(d.code)}
          </span>
        </td>
        <td style="padding:10px; font-weight:600; color:var(--tx)">
          ${escapeHtml(d.name)} ${statusBadge}
        </td>
        <td style="padding:10px; color:var(--mu)">
          ${escapeHtml(d.division || 'General')}
        </td>
        <td style="padding:10px; color:var(--tx)">
          ${headText}
        </td>
        <td style="padding:10px; color:var(--mu)">
          ${escapeHtml(d.location || 'HQ')}
        </td>
        <td style="padding:10px; text-align:center">
          <span class="badge" style="background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); font-weight:600; font-size:11px">
            👥 ${d.headcount || 0}
          </span>
        </td>
        <td style="padding:10px; text-align:right">
          <button class="btn bsm" style="font-size:11px; padding:2px 8px; margin-right:4px" onclick="openEditDepartmentModal(${d.id})">✏️ Edit</button>
          <button class="btn bsm" style="font-size:11px; padding:2px 8px; color:var(--err); border-color:var(--err)" onclick="deleteDepartmentPrompt(${d.id}, '${escapeHtml(d.name)}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function populateDepartmentHeadDropdown(selectedHeadId = '') {
  const select = document.getElementById('df-head-emp');
  if (!select) return;
  select.innerHTML = '<option value="">None / Unassigned</option>';

  try {
    let emps = S.employees;
    if (!emps || emps.length === 0) {
      const res = await api('/employees');
      if (res && res.success && Array.isArray(res.data?.employees)) {
        emps = res.data.employees;
      }
    }
    if (Array.isArray(emps)) {
      emps.forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id;
        opt.textContent = `${emp.id} - ${emp.name} (${emp.department || emp.dept || 'Staff'})`;
        if (emp.id === selectedHeadId) opt.selected = true;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Failed to populate department head dropdown', err);
  }
}

async function openAddDepartmentModal() {
  document.getElementById('dept-form-title').textContent = 'Add Department';
  document.getElementById('df-id').value = '';
  document.getElementById('df-code').value = '';
  document.getElementById('df-name').value = '';
  document.getElementById('df-division').value = 'Technology';
  document.getElementById('df-location').value = 'Bangalore HQ';
  document.getElementById('df-active').checked = true;

  await populateDepartmentHeadDropdown();
  const modal = document.getElementById('dept-form-modal');
  if (modal) modal.style.display = 'flex';
}

async function openEditDepartmentModal(deptId) {
  const dept = cachedDepartments.find(d => d.id === deptId);
  if (!dept) return;

  document.getElementById('dept-form-title').textContent = 'Edit Department';
  document.getElementById('df-id').value = dept.id;
  document.getElementById('df-code').value = dept.code;
  document.getElementById('df-name').value = dept.name;
  document.getElementById('df-division').value = dept.division || '';
  document.getElementById('df-location').value = dept.location || '';
  document.getElementById('df-active').checked = Boolean(dept.is_active);

  await populateDepartmentHeadDropdown(dept.head_emp_id);
  const modal = document.getElementById('dept-form-modal');
  if (modal) modal.style.display = 'flex';
}

function closeDeptFormModal() {
  const modal = document.getElementById('dept-form-modal');
  if (modal) modal.style.display = 'none';
}

async function saveDepartmentForm(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('df-id').value;
  const code = document.getElementById('df-code').value.trim().toUpperCase();
  const name = document.getElementById('df-name').value.trim();
  const division = document.getElementById('df-division').value.trim();
  const location = document.getElementById('df-location').value.trim();
  const head_emp_id = document.getElementById('df-head-emp').value || null;
  const is_active = document.getElementById('df-active').checked ? 1 : 0;

  if (!code || !name) {
    notify('Department Code and Name are required.', 'wn');
    return;
  }

  const payload = { code, name, division, location, head_emp_id, is_active };

  try {
    let res;
    if (id) {
      res = await api(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      res = await api('/departments', { method: 'POST', body: JSON.stringify(payload) });
    }

    if (res && res.success) {
      notify(`Department "${name}" saved successfully!`, 'ok');
      closeDeptFormModal();
      await loadDepartments();
    } else {
      notify(`Failed to save department: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error saving department: ${err.message}`, 'er');
  }
}

async function deleteDepartmentPrompt(id, name) {
  if (!confirm(`Are you sure you want to delete department "${name}"?\n\nNote: If employees are currently assigned to this department, consider marking it inactive instead.`)) {
    return;
  }

  try {
    const res = await api(`/departments/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      notify(`Department "${name}" removed.`, 'ok');
      await loadDepartments();
    } else {
      notify(`Could not delete department: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error deleting department: ${err.message}`, 'er');
  }
}


// ─────────────────────────────────────────────────────────────
// 2. DEPARTMENT SHIFTS POLICY
// ─────────────────────────────────────────────────────────────
let cachedDeptShifts = [];

async function openDeptShiftsModal() {
  const modal = document.getElementById('dept-shifts-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  await loadDeptShifts();
}

function closeDeptShiftsModal() {
  const modal = document.getElementById('dept-shifts-modal');
  if (modal) modal.style.display = 'none';
}

async function loadDeptShifts() {
  const tbody = document.getElementById('dept-shifts-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--mu)">Loading department shifts configuration...</td></tr>';

  try {
    if (!activeShiftsCache || activeShiftsCache.length === 0) {
      const sRes = await api('/shifts');
      if (sRes && sRes.success && Array.isArray(sRes.data?.shifts)) {
        activeShiftsCache = sRes.data.shifts;
      }
    }

    const res = await api('/department-shifts');
    if (res && res.success && Array.isArray(res.data?.department_shifts)) {
      cachedDeptShifts = res.data.department_shifts;
      renderDeptShiftsTable(cachedDeptShifts, activeShiftsCache);
    } else {
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--er)">Failed to load department shifts.</td></tr>';
    }
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--er)">Error: ${err.message}</td></tr>`;
  }
}

function renderDeptShiftsTable(deptShifts, shifts) {
  const tbody = document.getElementById('dept-shifts-tbody');
  if (!tbody) return;

  if (!deptShifts || deptShifts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--mu)">No departments found. Create departments in Departments Master first.</td></tr>';
    return;
  }

  const shiftOptionsHtml = (selectedId) => {
    return shifts.map(s => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${escapeHtml(s.code)} - ${escapeHtml(s.name)}</option>`).join('');
  };

  tbody.innerHTML = deptShifts.map(ds => {
    let allowedList = [];
    if (Array.isArray(ds.allowed_shifts)) {
      allowedList = ds.allowed_shifts;
    } else if (typeof ds.allowed_shifts === 'string') {
      try { allowedList = JSON.parse(ds.allowed_shifts); } catch(e) { allowedList = []; }
    }

    const allowedCheckboxes = shifts.map(s => {
      const isChecked = allowedList.length === 0 || allowedList.includes(s.id);
      return `
        <label style="display:inline-flex; align-items:center; gap:4px; font-size:11px; margin-right:8px; cursor:pointer; background:var(--s1); padding:2px 6px; border-radius:4px; border:1px solid var(--br)">
          <input type="checkbox" class="ds-allowed-chk-${ds.dept_id}" value="${s.id}" ${isChecked ? 'checked' : ''} />
          <span style="font-weight:600; color:${s.color || 'var(--ac)'}">${escapeHtml(s.code)}</span>
        </label>
      `;
    }).join('');

    return `
      <tr style="border-bottom:1px solid var(--br); transition:background 0.15s">
        <td style="padding:12px 10px">
          <div style="font-weight:700; color:var(--tx)">${escapeHtml(ds.dept_name)}</div>
          <div style="font-size:10.5px; color:var(--mu); font-family:var(--mo)">Code: ${escapeHtml(ds.dept_code)}</div>
        </td>
        <td style="padding:12px 10px; vertical-align:middle">
          <select class="fs" id="ds-default-shift-${ds.dept_id}" style="padding:5px 8px; font-size:11.5px; width:100%; max-width:210px">
            ${shiftOptionsHtml(ds.default_shift_id || 'SHIFT_GEN')}
          </select>
        </td>
        <td style="padding:12px 10px; vertical-align:middle">
          <div style="display:flex; flex-wrap:wrap; gap:4px; max-width:320px">
            ${allowedCheckboxes}
          </div>
        </td>
        <td style="padding:12px 10px; text-align:center; vertical-align:middle">
          <label class="switch" style="transform:scale(0.85)">
            <input type="checkbox" id="ds-auto-apply-${ds.dept_id}" ${ds.auto_apply_default ? 'checked' : ''} />
            <span class="slider round"></span>
          </label>
        </td>
        <td style="padding:12px 10px; text-align:right; vertical-align:middle">
          <div style="display:flex; gap:6px; justify-content:flex-end">
            <button class="btn btnp bsm" style="font-size:11px; padding:3px 10px" onclick="saveDeptShiftPolicy(${ds.dept_id})">💾 Save</button>
            <button class="btn bsm" style="font-size:11px; padding:3px 8px; border-color:var(--ac); color:var(--ac)" onclick="applyDeptShiftsToEmployees(${ds.dept_id}, '${escapeHtml(ds.dept_name)}')">⚡ Apply</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function saveDeptShiftPolicy(deptId) {
  const default_shift_id = document.getElementById(`ds-default-shift-${deptId}`)?.value || 'SHIFT_GEN';
  const auto_apply_default = document.getElementById(`ds-auto-apply-${deptId}`)?.checked ? 1 : 0;
  
  const chks = document.querySelectorAll(`.ds-allowed-chk-${deptId}:checked`);
  const allowed_shifts = Array.from(chks).map(c => c.value);

  try {
    const res = await api(`/department-shifts/${deptId}`, {
      method: 'PUT',
      body: JSON.stringify({ default_shift_id, allowed_shifts, auto_apply_default })
    });

    if (res && res.success) {
      notify('Department shift policy updated successfully!', 'ok');
    } else {
      notify(`Failed to update department shift policy: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error updating department shifts: ${err.message}`, 'er');
  }
}

async function applyDeptShiftsToEmployees(deptId, deptName) {
  if (!confirm(`Apply the default shift policy to all active employees in department "${deptName}"?`)) {
    return;
  }

  try {
    const res = await api('/department-shifts/apply-to-employees', {
      method: 'POST',
      body: JSON.stringify({ dept_id: deptId, overwrite_manual: false })
    });

    if (res && res.success) {
      notify(`Department shift applied! ${res.data?.employees_updated || 0} employees updated.`, 'ok');
    } else {
      notify(`Failed to apply shift policy: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error applying shift policy: ${err.message}`, 'er');
  }
}


// ─────────────────────────────────────────────────────────────
// 3. PUBLIC HOLIDAYS MASTER (KARNATAKA GAZETTE REFERENCE)
// ─────────────────────────────────────────────────────────────
async function openPublicHolidaysModal() {
  const modal = document.getElementById('public-holidays-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  await loadPublicHolidays();
}

function closePublicHolidaysModal() {
  const modal = document.getElementById('public-holidays-modal');
  if (modal) modal.style.display = 'none';
}

async function loadPublicHolidays() {
  const yearSelect = document.getElementById('ph-year-select');
  const year = yearSelect ? yearSelect.value : '2026';
  const tbody = document.getElementById('public-holidays-tbody');
  const countLabel = document.getElementById('ph-count-label');
  const chipsContainer = document.getElementById('ph-summary-chips');

  if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--mu)">Loading public holidays for ' + year + '...</td></tr>';

  try {
    const res = await api(`/public-holidays?year=${year}`);
    if (res && res.success && Array.isArray(res.data?.holidays)) {
      cachedPublicHolidays = res.data.holidays;
      filterHolidaysTable();
      
      const total = cachedPublicHolidays.length;
      const mandatory = cachedPublicHolidays.filter(h => h.holiday_type === 'MANDATORY').length;
      const restricted = cachedPublicHolidays.filter(h => h.holiday_type === 'RESTRICTED').length;
      const company = cachedPublicHolidays.filter(h => h.holiday_type === 'COMPANY_DECLARED').length;

      if (chipsContainer) {
        chipsContainer.innerHTML = `
          <span style="background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3); padding:3px 8px; border-radius:4px; font-weight:600">🏛️ Mandatory Gazetted: ${mandatory}</span>
          <span style="background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); padding:3px 8px; border-radius:4px; font-weight:600">🌴 Restricted: ${restricted}</span>
          <span style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); padding:3px 8px; border-radius:4px; font-weight:600">🏢 Company: ${company}</span>
        `;
      }
      if (countLabel) countLabel.textContent = `Total Public Holidays in ${year}: ${total} (Karnataka Gazette Reference)`;
    } else {
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--er)">Failed to load public holidays.</td></tr>';
    }
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--er)">Error: ${err.message}</td></tr>`;
  }
}

function filterHolidaysTable() {
  const typeFilter = document.getElementById('ph-type-filter')?.value;
  let filtered = cachedPublicHolidays;
  if (typeFilter) {
    filtered = filtered.filter(h => h.holiday_type === typeFilter);
  }
  renderPublicHolidaysTable(filtered);
}

function renderPublicHolidaysTable(holidays) {
  const tbody = document.getElementById('public-holidays-tbody');
  if (!tbody) return;

  if (!holidays || holidays.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--mu)">No public holidays found for this filter. Click "⚡ Import Karnataka Gazette" to load standard 2026 gazette holidays.</td></tr>';
    return;
  }

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  tbody.innerHTML = holidays.map(h => {
    const d = new Date(h.holiday_date + 'T00:00:00');
    const dayName = daysOfWeek[d.getDay()];
    const dateFormatted = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    const isWeekend = (d.getDay() === 0 || d.getDay() === 6);

    let typeBadge = '';
    if (h.holiday_type === 'MANDATORY') {
      typeBadge = '<span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3); font-size:10.5px">Gazetted</span>';
    } else if (h.holiday_type === 'RESTRICTED') {
      typeBadge = '<span class="badge" style="background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); font-size:10.5px">Restricted</span>';
    } else {
      typeBadge = '<span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); font-size:10.5px">Company</span>';
    }

    return `
      <tr style="border-bottom:1px solid var(--br); transition:background 0.15s">
        <td style="padding:9px 10px; font-weight:700; font-family:var(--mo); color:var(--tx)">
          ${dateFormatted}
        </td>
        <td style="padding:9px 10px; color:${isWeekend ? '#ef4444' : 'var(--tx)'}; font-weight:600">
          ${dayName} ${isWeekend ? '<span style="font-size:10px; color:#ef4444">(Weekend)</span>' : ''}
        </td>
        <td style="padding:9px 10px; font-weight:600; color:var(--tx)">
          ${escapeHtml(h.title)}
        </td>
        <td style="padding:9px 10px; text-align:center">
          ${typeBadge}
        </td>
        <td style="padding:9px 10px; color:var(--mu); font-size:11px">
          ${escapeHtml(h.state || 'Karnataka')}
        </td>
        <td style="padding:9px 10px; color:var(--mu); font-size:11px">
          ${escapeHtml(h.description || 'Gazetted Holiday under N.I. Act')}
        </td>
        <td style="padding:9px 10px; text-align:right">
          <button class="btn bsm" style="font-size:11px; padding:2px 8px; margin-right:4px" onclick="openEditHolidayModal(${h.id})">✏️</button>
          <button class="btn bsm" style="font-size:11px; padding:2px 8px; color:var(--err); border-color:var(--err)" onclick="deleteHolidayPrompt(${h.id}, '${escapeHtml(h.title)}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddHolidayModal() {
  const year = document.getElementById('ph-year-select')?.value || '2026';
  document.getElementById('hf-form-title').textContent = 'Add Public Holiday';
  document.getElementById('hf-id').value = '';
  document.getElementById('hf-title').value = '';
  document.getElementById('hf-date').value = `${year}-01-01`;
  document.getElementById('hf-type').value = 'MANDATORY';
  document.getElementById('hf-state').value = 'Karnataka';
  document.getElementById('hf-location').value = 'All Locations';
  document.getElementById('hf-desc').value = 'Official Gazetted Holiday under N.I. Act';

  const modal = document.getElementById('holiday-form-modal');
  if (modal) modal.style.display = 'flex';
}

function openEditHolidayModal(id) {
  const h = cachedPublicHolidays.find(item => item.id === id);
  if (!h) return;

  document.getElementById('hf-form-title').textContent = 'Edit Public Holiday';
  document.getElementById('hf-id').value = h.id;
  document.getElementById('hf-title').value = h.title;
  document.getElementById('hf-date').value = h.holiday_date;
  document.getElementById('hf-type').value = h.holiday_type;
  document.getElementById('hf-state').value = h.state || 'Karnataka';
  document.getElementById('hf-location').value = h.location || 'All Locations';
  document.getElementById('hf-desc').value = h.description || '';

  const modal = document.getElementById('holiday-form-modal');
  if (modal) modal.style.display = 'flex';
}

function closeHolidayFormModal() {
  const modal = document.getElementById('holiday-form-modal');
  if (modal) modal.style.display = 'none';
}

async function saveHolidayForm(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('hf-id').value;
  const title = document.getElementById('hf-title').value.trim();
  const holiday_date = document.getElementById('hf-date').value;
  const holiday_type = document.getElementById('hf-type').value;
  const state = document.getElementById('hf-state').value.trim();
  const location = document.getElementById('hf-location').value.trim();
  const description = document.getElementById('hf-desc').value.trim();

  if (!title || !holiday_date) {
    notify('Holiday title and date are required.', 'wn');
    return;
  }

  const payload = { title, holiday_date, holiday_type, state, location, description };

  try {
    let res;
    if (id) {
      res = await api(`/public-holidays/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      res = await api('/public-holidays', { method: 'POST', body: JSON.stringify(payload) });
    }

    if (res && res.success) {
      notify(`Public Holiday "${title}" saved successfully!`, 'ok');
      closeHolidayFormModal();
      await loadPublicHolidays();
    } else {
      notify(`Failed to save public holiday: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error saving holiday: ${err.message}`, 'er');
  }
}

async function deleteHolidayPrompt(id, title) {
  if (!confirm(`Are you sure you want to delete public holiday "${title}"?`)) {
    return;
  }

  try {
    const res = await api(`/public-holidays/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      notify(`Holiday "${title}" removed.`, 'ok');
      await loadPublicHolidays();
    } else {
      notify(`Could not delete holiday: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error deleting holiday: ${err.message}`, 'er');
  }
}

async function importKarnatakaGazetteHolidays() {
  const yearSelect = document.getElementById('ph-year-select');
  const year = parseInt(yearSelect ? yearSelect.value : '2026', 10);

  if (!confirm(`Import official Karnataka State Gazetted Public Holidays for year ${year}? (Reference: india.gov.in Karnataka Gazette Calendar)`)) {
    return;
  }

  try {
    const res = await api('/public-holidays/import-karnataka', {
      method: 'POST',
      body: JSON.stringify({ year })
    });

    if (res && res.success) {
      notify(`Karnataka Gazetted Holidays (${res.data?.count || 21} holidays) imported / verified successfully!`, 'ok');
      await loadPublicHolidays();
    } else {
      notify(`Import failed: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error importing Karnataka holidays: ${err.message}`, 'er');
  }
}

async function syncHolidaysWithShiftCalendar() {
  const yearSelect = document.getElementById('ph-year-select');
  const year = parseInt(yearSelect ? yearSelect.value : '2026', 10);

  if (!confirm(`Synchronize all Public Holidays for year ${year} into the Shift Calendar as official HOLIDAY overrides?`)) {
    return;
  }

  try {
    const res = await api('/public-holidays/sync-calendar', {
      method: 'POST',
      body: JSON.stringify({ year, overwrite_workdays: true })
    });

    if (res && res.success) {
      notify(`Synchronized ${res.data?.days_synced || 0} holidays into the Shift Calendar!`, 'ok');
    } else {
      notify(`Sync failed: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error syncing holidays: ${err.message}`, 'er');
  }
}

// Window exports for Organization subsystem
window.openDepartmentsModal = openDepartmentsModal;
window.closeDepartmentsModal = closeDepartmentsModal;
window.loadDepartments = loadDepartments;
window.openAddDepartmentModal = openAddDepartmentModal;
window.openEditDepartmentModal = openEditDepartmentModal;
window.closeDeptFormModal = closeDeptFormModal;
window.saveDepartmentForm = saveDepartmentForm;
window.deleteDepartmentPrompt = deleteDepartmentPrompt;

window.openDeptShiftsModal = openDeptShiftsModal;
window.closeDeptShiftsModal = closeDeptShiftsModal;
window.loadDeptShifts = loadDeptShifts;
window.saveDeptShiftPolicy = saveDeptShiftPolicy;
window.applyDeptShiftsToEmployees = applyDeptShiftsToEmployees;

window.openPublicHolidaysModal = openPublicHolidaysModal;
window.closePublicHolidaysModal = closePublicHolidaysModal;
window.loadPublicHolidays = loadPublicHolidays;
window.filterHolidaysTable = filterHolidaysTable;
window.openAddHolidayModal = openAddHolidayModal;
window.openEditHolidayModal = openEditHolidayModal;
window.closeHolidayFormModal = closeHolidayFormModal;
window.saveHolidayForm = saveHolidayForm;
window.deleteHolidayPrompt = deleteHolidayPrompt;
window.importKarnatakaGazetteHolidays = importKarnatakaGazetteHolidays;
window.syncHolidaysWithShiftCalendar = syncHolidaysWithShiftCalendar;

// ═══════════════════════════════════════════════════════════════
// EMPLOYEE MANAGEMENT SUBSYSTEM CONTROLLERS
// 1. Employment Types Master
// 2. Employee Cohort Groups Master
// ═══════════════════════════════════════════════════════════════

let cachedEmploymentTypes = [];
let cachedEmployeeCohortGroups = [];
let currentCohortGroupId = null;

// ─────────────────────────────────────────────────────────────
// 1. EMPLOYMENT TYPES MASTER
// ─────────────────────────────────────────────────────────────
async function openEmploymentTypesModal() {
  const modal = document.getElementById('employment-types-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  await loadEmploymentTypes();
}

function closeEmploymentTypesModal() {
  const modal = document.getElementById('employment-types-modal');
  if (modal) modal.style.display = 'none';
}

async function loadEmploymentTypes() {
  const tbody = document.getElementById('employment-types-tbody');
  const countLabel = document.getElementById('et-count-label');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--mu)">Loading employment types...</td></tr>';

  try {
    const res = await api('/employment-types');
    if (res && res.success && Array.isArray(res.data?.types)) {
      cachedEmploymentTypes = res.data.types;
      renderEmploymentTypesTable(cachedEmploymentTypes);
      if (countLabel) countLabel.textContent = `Total Employment Types: ${cachedEmploymentTypes.length}`;
    } else {
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--er)">Failed to load employment types.</td></tr>';
    }
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--er)">Error: ${err.message}</td></tr>`;
  }
}

function renderEmploymentTypesTable(types) {
  const tbody = document.getElementById('employment-types-tbody');
  if (!tbody) return;

  if (!types || types.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--mu)">No employment types configured. Click "+ Add Employment Type" to create one.</td></tr>';
    return;
  }

  tbody.innerHTML = types.map(t => {
    const statusBadge = t.active ? 
      '<span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); font-size:10px; padding:2px 6px">Active</span>' : 
      '<span class="badge" style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); font-size:10px; padding:2px 6px">Inactive</span>';

    const pfBadge = t.pf_esi_eligible ?
      '<span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; font-size:10.5px">Eligible</span>' :
      '<span class="badge" style="background:rgba(107,118,145,0.15); color:var(--mu); font-size:10.5px">N/A</span>';

    return `
      <tr style="border-bottom:1px solid var(--br); transition:background 0.15s">
        <td style="padding:10px">
          <span style="font-weight:700; font-family:var(--mo); color:var(--ac); background:rgba(0,212,170,0.08); padding:3px 8px; border-radius:4px; border:1px solid rgba(0,212,170,0.2)">
            ${escapeHtml(t.code)}
          </span>
        </td>
        <td style="padding:10px; font-weight:600; color:var(--tx)">
          ${escapeHtml(t.title)} ${statusBadge}
        </td>
        <td style="padding:10px; color:var(--mu); font-size:11px">
          ${escapeHtml(t.description || 'Standard classification')}
        </td>
        <td style="padding:10px; text-align:center; font-weight:600; color:var(--tx)">
          ${t.probation_days ? `${t.probation_days}d` : '<span style="color:var(--mu)">None</span>'}
        </td>
        <td style="padding:10px; text-align:center; font-weight:600; color:var(--tx)">
          ${t.notice_period_days ? `${t.notice_period_days}d` : '<span style="color:var(--mu)">None</span>'}
        </td>
        <td style="padding:10px; text-align:center">
          ${pfBadge}
        </td>
        <td style="padding:10px; text-align:center">
          <span class="badge" style="background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); font-weight:600; font-size:11px">
            👥 ${t.headcount || 0}
          </span>
        </td>
        <td style="padding:10px; text-align:right">
          <button class="btn bsm" style="font-size:11px; padding:2px 8px; margin-right:4px" onclick="openEditEmploymentTypeModal('${t.id}')">✏️ Edit</button>
          <button class="btn bsm" style="font-size:11px; padding:2px 8px; color:var(--err); border-color:var(--err)" onclick="deleteEmploymentTypePrompt('${t.id}', '${escapeHtml(t.title)}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddEmploymentTypeModal() {
  document.getElementById('et-form-title').textContent = 'Add Employment Type';
  document.getElementById('et-id').value = '';
  document.getElementById('et-code').value = '';
  document.getElementById('et-title').value = '';
  document.getElementById('et-desc').value = '';
  document.getElementById('et-probation').value = 90;
  document.getElementById('et-notice').value = 30;
  document.getElementById('et-pf-esi').checked = true;
  document.getElementById('et-active').checked = true;

  const modal = document.getElementById('employment-type-form-modal');
  if (modal) modal.style.display = 'flex';
}

function openEditEmploymentTypeModal(id) {
  const t = cachedEmploymentTypes.find(item => item.id === id);
  if (!t) return;

  document.getElementById('et-form-title').textContent = 'Edit Employment Type';
  document.getElementById('et-id').value = t.id;
  document.getElementById('et-code').value = t.code;
  document.getElementById('et-title').value = t.title;
  document.getElementById('et-desc').value = t.description || '';
  document.getElementById('et-probation').value = t.probation_days || 0;
  document.getElementById('et-notice').value = t.notice_period_days || 0;
  document.getElementById('et-pf-esi').checked = Boolean(t.pf_esi_eligible);
  document.getElementById('et-active').checked = Boolean(t.active);

  const modal = document.getElementById('employment-type-form-modal');
  if (modal) modal.style.display = 'flex';
}

function closeEmploymentTypeFormModal() {
  const modal = document.getElementById('employment-type-form-modal');
  if (modal) modal.style.display = 'none';
}

async function saveEmploymentTypeForm(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('et-id').value;
  const code = document.getElementById('et-code').value.trim().toUpperCase();
  const title = document.getElementById('et-title').value.trim();
  const description = document.getElementById('et-desc').value.trim();
  const probation_days = parseInt(document.getElementById('et-probation').value || 0, 10);
  const notice_period_days = parseInt(document.getElementById('et-notice').value || 0, 10);
  const pf_esi_eligible = document.getElementById('et-pf-esi').checked;
  const active = document.getElementById('et-active').checked;

  if (!code || !title) {
    notify('Type Code and Title are required.', 'wn');
    return;
  }

  const payload = { code, title, description, probation_days, notice_period_days, pf_esi_eligible, active };

  try {
    let res;
    if (id) {
      res = await api(`/employment-types/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      res = await api('/employment-types', { method: 'POST', body: JSON.stringify(payload) });
    }

    if (res && res.success) {
      notify(`Employment Type "${title}" saved successfully!`, 'ok');
      closeEmploymentTypeFormModal();
      await loadEmploymentTypes();
    } else {
      notify(`Failed to save employment type: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error saving employment type: ${err.message}`, 'er');
  }
}

async function deleteEmploymentTypePrompt(id, title) {
  if (!confirm(`Are you sure you want to delete employment type "${title}"?`)) {
    return;
  }

  try {
    const res = await api(`/employment-types/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      notify(`Employment Type "${title}" removed.`, 'ok');
      await loadEmploymentTypes();
    } else {
      notify(`Could not delete: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error deleting employment type: ${err.message}`, 'er');
  }
}


// ─────────────────────────────────────────────────────────────
// 2. EMPLOYEE GROUPS MASTER (COHORTS & TEAMS)
// ─────────────────────────────────────────────────────────────
async function openEmployeeGroupsModal() {
  const modal = document.getElementById('employee-groups-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  await loadEmployeeGroups();
}

function closeEmployeeGroupsModal() {
  const modal = document.getElementById('employee-groups-modal');
  if (modal) modal.style.display = 'none';
}

async function loadEmployeeGroups() {
  const container = document.getElementById('employee-groups-cards');
  const countLabel = document.getElementById('egrp-count-label');
  if (container) container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--mu)">Loading employee groups...</div>';

  try {
    const res = await api('/employee-groups');
    if (res && res.success && Array.isArray(res.data?.groups)) {
      cachedEmployeeCohortGroups = res.data.groups;
      renderEmployeeGroupsCards(cachedEmployeeCohortGroups);
      if (countLabel) countLabel.textContent = `Total Configured Groups: ${cachedEmployeeCohortGroups.length}`;
    } else {
      if (container) container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--er)">Failed to load employee groups.</div>';
    }
  } catch (err) {
    if (container) container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--er)">Error: ${err.message}</div>`;
  }
}

function renderEmployeeGroupsCards(groups) {
  const container = document.getElementById('employee-groups-cards');
  if (!container) return;

  if (!groups || groups.length === 0) {
    container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--mu)">No employee groups configured. Click "+ Add Employee Group" to create one.</div>';
    return;
  }

  container.innerHTML = groups.map(g => {
    const color = g.color || '#4f8ef7';
    const leaderText = g.leader_name ? `${escapeHtml(g.leader_name)} (${escapeHtml(g.leader_emp_id)})` : '<span style="color:var(--mu); font-style:italic">Unassigned</span>';

    return `
      <div style="background:var(--s1); border:1px solid var(--br); border-top:3px solid ${color}; border-radius:8px; padding:14px; display:flex; flex-direction:column; justify-content:space-between; transition:transform 0.15s, box-shadow 0.15s" class="shift-group-card">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px">
            <div style="font-weight:700; font-size:13px; color:var(--tx)">${escapeHtml(g.name)}</div>
            <span class="badge" style="background:${color}20; color:${color}; border:1px solid ${color}40; font-size:10px">
              ${escapeHtml(g.code)}
            </span>
          </div>

          <div style="font-size:10.5px; color:var(--ac); font-weight:600; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px">
            📂 ${escapeHtml(g.category || 'OPERATIONAL')}
          </div>

          <div style="font-size:11px; color:var(--mu); line-height:1.4; margin-bottom:10px; min-height:32px">
            ${escapeHtml(g.description || 'General employee operational cohort.')}
          </div>

          <div style="font-size:11px; color:var(--tx); margin-bottom:12px; background:var(--s2); padding:6px 10px; border-radius:4px; border:1px solid var(--br)">
            <span style="color:var(--mu)">Leader:</span> <strong>${leaderText}</strong>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--br); padding-top:10px; margin-top:6px">
          <span class="badge" style="background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); font-weight:600; font-size:11px">
            👥 ${g.members_count || 0} Members
          </span>

          <div style="display:flex; gap:6px">
            <button class="btn bsm" style="font-size:10.5px; padding:3px 8px" onclick="openEmployeeGroupMembersModal('${g.id}', '${escapeHtml(g.name)}')">👥 Members</button>
            <button class="btn bsm" style="font-size:10.5px; padding:3px 8px" onclick="openEditEmployeeGroupModal('${g.id}')">✏️</button>
            <button class="btn bsm" style="font-size:10.5px; padding:3px 8px; color:var(--err); border-color:var(--err)" onclick="deleteEmployeeGroupPrompt('${g.id}', '${escapeHtml(g.name)}')">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function populateGroupLeaderDropdown(selectedLeaderId = '') {
  const select = document.getElementById('egrp-leader-emp');
  if (!select) return;
  select.innerHTML = '<option value="">None / Unassigned</option>';

  try {
    let emps = S.employees;
    if (!emps || emps.length === 0) {
      const res = await api('/employees');
      if (res && res.success && Array.isArray(res.data?.employees)) {
        emps = res.data.employees;
      }
    }
    if (Array.isArray(emps)) {
      emps.forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id;
        opt.textContent = `${emp.id} - ${emp.name} (${emp.department || emp.dept || 'Staff'})`;
        if (emp.id === selectedLeaderId) opt.selected = true;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Failed to populate group leader dropdown', err);
  }
}

async function openAddEmployeeGroupModal() {
  document.getElementById('egrp-form-title').textContent = 'Add Employee Group';
  document.getElementById('egrp-id').value = '';
  document.getElementById('egrp-code').value = '';
  document.getElementById('egrp-name').value = '';
  document.getElementById('egrp-category').value = 'OPERATIONAL';
  document.getElementById('egrp-color').value = '#4f8ef7';
  document.getElementById('egrp-desc').value = '';
  document.getElementById('egrp-active').checked = true;

  await populateGroupLeaderDropdown();
  const modal = document.getElementById('employee-group-form-modal');
  if (modal) modal.style.display = 'flex';
}

async function openEditEmployeeGroupModal(id) {
  const g = cachedEmployeeCohortGroups.find(item => item.id === id);
  if (!g) return;

  document.getElementById('egrp-form-title').textContent = 'Edit Employee Group';
  document.getElementById('egrp-id').value = g.id;
  document.getElementById('egrp-code').value = g.code;
  document.getElementById('egrp-name').value = g.name;
  document.getElementById('egrp-category').value = g.category || 'OPERATIONAL';
  document.getElementById('egrp-color').value = g.color || '#4f8ef7';
  document.getElementById('egrp-desc').value = g.description || '';
  document.getElementById('egrp-active').checked = Boolean(g.active);

  await populateGroupLeaderDropdown(g.leader_emp_id);
  const modal = document.getElementById('employee-group-form-modal');
  if (modal) modal.style.display = 'flex';
}

function closeEmployeeGroupFormModal() {
  const modal = document.getElementById('employee-group-form-modal');
  if (modal) modal.style.display = 'none';
}

async function saveEmployeeGroupForm(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('egrp-id').value;
  const code = document.getElementById('egrp-code').value.trim().toUpperCase();
  const name = document.getElementById('egrp-name').value.trim();
  const category = document.getElementById('egrp-category').value;
  const color = document.getElementById('egrp-color').value;
  const leader_emp_id = document.getElementById('egrp-leader-emp').value || null;
  const description = document.getElementById('egrp-desc').value.trim();
  const active = document.getElementById('egrp-active').checked;

  if (!code || !name) {
    notify('Group Code and Name are required.', 'wn');
    return;
  }

  const payload = { code, name, category, color, leader_emp_id, description, active };

  try {
    let res;
    if (id) {
      res = await api(`/employee-groups/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      res = await api('/employee-groups', { method: 'POST', body: JSON.stringify(payload) });
    }

    if (res && res.success) {
      notify(`Employee Group "${name}" saved successfully!`, 'ok');
      closeEmployeeGroupFormModal();
      await loadEmployeeGroups();
    } else {
      notify(`Failed to save group: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error saving employee group: ${err.message}`, 'er');
  }
}

async function deleteEmployeeGroupPrompt(id, name) {
  if (!confirm(`Are you sure you want to delete employee group "${name}"?`)) {
    return;
  }

  try {
    const res = await api(`/employee-groups/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      notify(`Employee Group "${name}" removed.`, 'ok');
      await loadEmployeeGroups();
    } else {
      notify(`Could not delete group: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error deleting employee group: ${err.message}`, 'er');
  }
}

async function openEmployeeGroupMembersModal(groupId, groupName) {
  currentCohortGroupId = groupId;
  document.getElementById('egrpm-title').textContent = `Assign Members to: ${groupName}`;
  const modal = document.getElementById('employee-group-members-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  const tbody = document.getElementById('egrpm-members-tbody');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--mu)">Loading group members...</td></tr>';

  try {
    let allEmps = S.employees;
    if (!allEmps || allEmps.length === 0) {
      const eRes = await api('/employees');
      if (eRes && eRes.success && Array.isArray(eRes.data?.employees)) {
        allEmps = eRes.data.employees;
      }
    }

    const gRes = await api(`/employee-groups/${groupId}`);
    const memberIds = new Set((gRes.data?.group?.members || []).map(m => m.emp_id));

    const deptSelect = document.getElementById('egrpm-dept-filter');
    const depts = Array.from(new Set((allEmps || []).map(e => e.department || e.dept || 'General'))).sort();
    deptSelect.innerHTML = '<option value="">All Departments</option>' + depts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');

    tbody.innerHTML = (allEmps || []).map(emp => {
      const isChecked = memberIds.has(emp.id);
      const dept = emp.department || emp.dept || 'Staff';
      return `
        <tr class="egrpm-row" data-emp-id="${emp.id}" data-dept="${escapeHtml(dept)}" data-name="${escapeHtml(emp.name.toLowerCase())}" style="border-bottom:1px solid var(--br)">
          <td style="padding:6px; text-align:center">
            <input type="checkbox" class="egrpm-chk" value="${emp.id}" ${isChecked ? 'checked' : ''} onchange="updateEmployeeCohortSelectedCount()" />
          </td>
          <td style="padding:6px; font-weight:600; color:var(--tx)">${escapeHtml(emp.name)} <span style="font-size:10px; color:var(--mu)">(${emp.id})</span></td>
          <td style="padding:6px; color:var(--mu)">${escapeHtml(dept)}</td>
          <td style="padding:6px; color:var(--mu)">${escapeHtml(emp.role || 'Staff')}</td>
        </tr>
      `;
    }).join('');

    updateEmployeeCohortSelectedCount();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--er)">Error: ${err.message}</td></tr>`;
  }
}

function closeEmployeeGroupMembersModal() {
  const modal = document.getElementById('employee-group-members-modal');
  if (modal) modal.style.display = 'none';
  currentCohortGroupId = null;
}

function filterEmployeeCohortMembersList() {
  const search = (document.getElementById('egrpm-search')?.value || '').toLowerCase();
  const dept = document.getElementById('egrpm-dept-filter')?.value || '';
  const rows = document.querySelectorAll('.egrpm-row');

  rows.forEach(r => {
    const rName = r.dataset.name || '';
    const rId = r.dataset.empId?.toLowerCase() || '';
    const rDept = r.dataset.dept || '';

    const matchSearch = !search || rName.includes(search) || rId.includes(search);
    const matchDept = !dept || rDept === dept;

    r.style.display = (matchSearch && matchDept) ? '' : 'none';
  });
}

function selectAllEmployeeCohortMembers(checked) {
  const chks = document.querySelectorAll('.egrpm-row:not([style*="display: none"]) .egrpm-chk');
  chks.forEach(c => c.checked = checked);
  updateEmployeeCohortSelectedCount();
}

function updateEmployeeCohortSelectedCount() {
  const count = document.querySelectorAll('.egrpm-chk:checked').length;
  const label = document.getElementById('egrpm-selected-count');
  if (label) label.textContent = `${count} employee(s) selected`;
}

async function saveEmployeeCohortGroupMembers() {
  if (!currentCohortGroupId) return;

  const chks = document.querySelectorAll('.egrpm-chk:checked');
  const emp_ids = Array.from(chks).map(c => c.value);

  try {
    const res = await api(`/employee-groups/${currentCohortGroupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ emp_ids, role_in_group: 'Member' })
    });

    if (res && res.success) {
      notify(`Group membership updated (${emp_ids.length} employees)!`, 'ok');
      closeEmployeeGroupMembersModal();
      await loadEmployeeGroups();
    } else {
      notify(`Failed to update group members: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error updating members: ${err.message}`, 'er');
  }
}

// Window exports for Employee Management
window.openEmploymentTypesModal = openEmploymentTypesModal;
window.closeEmploymentTypesModal = closeEmploymentTypesModal;
window.loadEmploymentTypes = loadEmploymentTypes;
window.openAddEmploymentTypeModal = openAddEmploymentTypeModal;
window.openEditEmploymentTypeModal = openEditEmploymentTypeModal;
window.closeEmploymentTypeFormModal = closeEmploymentTypeFormModal;
window.saveEmploymentTypeForm = saveEmploymentTypeForm;
window.deleteEmploymentTypePrompt = deleteEmploymentTypePrompt;

window.openEmployeeGroupsModal = openEmployeeGroupsModal;
window.closeEmployeeGroupsModal = closeEmployeeGroupsModal;
window.loadEmployeeGroups = loadEmployeeGroups;
window.openAddEmployeeGroupModal = openAddEmployeeGroupModal;
window.openEditEmployeeGroupModal = openEditEmployeeGroupModal;
window.closeEmployeeGroupFormModal = closeEmployeeGroupFormModal;
window.saveEmployeeGroupForm = saveEmployeeGroupForm;
window.deleteEmployeeGroupPrompt = deleteEmployeeGroupPrompt;
window.openEmployeeGroupMembersModal = openEmployeeGroupMembersModal;
window.closeEmployeeGroupMembersModal = closeEmployeeGroupMembersModal;
window.filterEmployeeCohortMembersList = filterEmployeeCohortMembersList;
window.selectAllEmployeeCohortMembers = selectAllEmployeeCohortMembers;
window.updateEmployeeCohortSelectedCount = updateEmployeeCohortSelectedCount;
window.saveEmployeeCohortGroupMembers = saveEmployeeCohortGroupMembers;

// ══════════════════════════════════════════════
// 📊 ATTENDANCE LOG & AUDIT LEDGER CONTROLLERS
// ══════════════════════════════════════════════
let currentAttLogPage = 1;
const attLogLimit = 20;

async function openAttendanceLogModal() {
  const m = document.getElementById('attendance-log-modal');
  if (!m) return;
  m.style.display = 'flex';

  populateAttendanceLogDeptFilter();
  populateRegularizeEmployeeDropdown();
  await loadAttendanceLogStats();
  await loadAttendanceLogGrid(1);
}

function closeAttendanceLogModal() {
  const m = document.getElementById('attendance-log-modal');
  if (m) m.style.display = 'none';
}

function populateAttendanceLogDeptFilter() {
  const sel = document.getElementById('attlog-dept-filter');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">All Departments</option>';
  const depts = state.departments || [];
  depts.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.name;
    opt.textContent = d.name;
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
}

function populateRegularizeEmployeeDropdown() {
  const sel = document.getElementById('reg-emp-id');
  if (!sel) return;
  sel.innerHTML = '<option value="">Select Employee...</option>';
  const emps = state.employees || [];
  emps.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = `${e.name} (${e.id}) - ${e.department || 'Operations'}`;
    sel.appendChild(opt);
  });
}

async function loadAttendanceLogStats() {
  try {
    const res = await api('/attendance-log/stats');
    if (res && res.success && res.data?.stats) {
      const s = res.data.stats;
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
      setVal('attlog-stat-total', s.total_punches || 0);
      setVal('attlog-stat-ontime', s.on_time_count || 0);
      setVal('attlog-stat-late', s.late_count || 0);
      setVal('attlog-stat-unique', s.unique_employees || 0);
      setVal('attlog-stat-rate', `${s.on_time_rate || 100}%`);
    }
  } catch (err) {
    console.warn('[loadAttendanceLogStats]', err);
  }
}

async function loadAttendanceLogGrid(page = 1) {
  currentAttLogPage = page;
  const search = document.getElementById('attlog-search')?.value.trim() || '';
  const startDate = document.getElementById('attlog-start-date')?.value || '';
  const endDate = document.getElementById('attlog-end-date')?.value || '';
  const dept = document.getElementById('attlog-dept-filter')?.value || '';
  const status = document.getElementById('attlog-status-filter')?.value || '';

  const tbody = document.getElementById('attlog-tbody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--mu)">Loading attendance logs...</td></tr>';
  }

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(attLogLimit)
  });
  if (search) queryParams.append('search', search);
  if (startDate) queryParams.append('start_date', startDate);
  if (endDate) queryParams.append('end_date', endDate);
  if (dept) queryParams.append('dept', dept);
  if (status) queryParams.append('status', status);

  try {
    const res = await api(`/attendance-log?${queryParams.toString()}`);
    if (res && res.success) {
      renderAttendanceLogRows(res.data?.rows || []);
      renderAttendanceLogPagination(res.data?.total || 0, page, attLogLimit);
    } else {
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--er)">Failed to load attendance logs: ${res?.error?.message || 'Error'}</td></tr>`;
    }
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--er)">Network error: ${err.message}</td></tr>`;
  }
}

function renderAttendanceLogRows(logs) {
  const tbody = document.getElementById('attlog-tbody');
  if (!tbody) return;

  if (!logs || logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--mu)">No attendance punch records found matching current filters.</td></tr>';
    return;
  }

  tbody.innerHTML = logs.map(l => {
    const isLate = l.status === 'Late';
    const statusBadge = isLate
      ? `<span class="mode-badge er" style="font-size:10px; padding:2px 8px">⏰ Late</span>`
      : `<span class="mode-badge ok" style="font-size:10px; padding:2px 8px">✓ Present</span>`;

    const tsDisplay = l.timestamp ? new Date(l.timestamp).toLocaleString('en-IN', {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }) : '—';

    const safeNotes = escapeHtml(l.logged_by || 'FACIAL_RECOGNITION');
    const safeEmpId = escapeHtml(l.emp_id);
    const safeName = escapeHtml(l.name);
    const safeDept = escapeHtml(l.dept || '—');
    const safeRole = escapeHtml(l.role || 'Staff');

    return `
      <tr style="border-bottom:1px solid var(--br); transition:background 0.15s" onmouseover="this.style.background='var(--s1)'" onmouseout="this.style.background=''">
        <td style="padding:8px 12px; font-family:var(--mo); font-weight:600; color:var(--ac)">${safeEmpId}</td>
        <td style="padding:8px 12px">
          <div style="font-weight:600; color:var(--tx)">${safeName}</div>
        </td>
        <td style="padding:8px 12px">
          <div style="color:var(--tx); font-size:11.5px">${safeDept}</div>
          <div style="color:var(--mu); font-size:10.5px">${safeRole}</div>
        </td>
        <td style="padding:8px 12px; font-family:var(--mo); font-size:11.5px; color:var(--tx)">${tsDisplay}</td>
        <td style="padding:8px 12px; text-align:center">${statusBadge}</td>
        <td style="padding:8px 12px; font-size:11px; color:var(--mu); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="${safeNotes}">
          ${safeNotes}
        </td>
        <td style="padding:8px 12px; text-align:center">
          <button type="button" class="btn bsm" style="padding:2px 6px; font-size:10.5px" onclick="openRegularizeAttendanceModal(${l.att_id}, '${safeEmpId}', '${l.timestamp}', '${l.status}')">✏️ Regularize</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderAttendanceLogPagination(total, page, limit) {
  const lbl = document.getElementById('attlog-pagination-label');
  const ctrl = document.getElementById('attlog-pagination-controls');
  if (lbl) {
    const start = total === 0 ? 0 : (page - 1) * limit + 1;
    const end = Math.min(total, page * limit);
    lbl.textContent = `Showing ${start}-${end} of ${total} entries`;
  }
  if (!ctrl) return;

  const totalPages = Math.ceil(total / limit) || 1;
  let html = `
    <button type="button" class="btn bsm" ${page <= 1 ? 'disabled' : ''} onclick="loadAttendanceLogGrid(${page - 1})">◀ Prev</button>
    <span style="font-size:11px; color:var(--tx); padding:0 6px">Page ${page} of ${totalPages}</span>
    <button type="button" class="btn bsm" ${page >= totalPages ? 'disabled' : ''} onclick="loadAttendanceLogGrid(${page + 1})">Next ▶</button>
  `;
  ctrl.innerHTML = html;
}

function resetAttendanceLogFilters() {
  const s = document.getElementById('attlog-search');
  const sd = document.getElementById('attlog-start-date');
  const ed = document.getElementById('attlog-end-date');
  const d = document.getElementById('attlog-dept-filter');
  const st = document.getElementById('attlog-status-filter');
  if (s) s.value = '';
  if (sd) sd.value = '';
  if (ed) ed.value = '';
  if (d) d.value = '';
  if (st) st.value = '';
  loadAttendanceLogGrid(1);
}

function exportAttendanceLogCsv() {
  const search = document.getElementById('attlog-search')?.value.trim() || '';
  const startDate = document.getElementById('attlog-start-date')?.value || '';
  const endDate = document.getElementById('attlog-end-date')?.value || '';
  const dept = document.getElementById('attlog-dept-filter')?.value || '';
  const status = document.getElementById('attlog-status-filter')?.value || '';

  const queryParams = new URLSearchParams({ page: '1', limit: '5000' });
  if (search) queryParams.append('search', search);
  if (startDate) queryParams.append('start_date', startDate);
  if (endDate) queryParams.append('end_date', endDate);
  if (dept) queryParams.append('dept', dept);
  if (status) queryParams.append('status', status);

  api(`/attendance-log?${queryParams.toString()}`).then(res => {
    if (!res || !res.success || !res.data?.rows?.length) {
      notify('No attendance data to export', 'wn');
      return;
    }
    const rows = res.data.rows;
    let csv = 'Emp ID,Employee Name,Department,Role,Timestamp,Status,Notes\n';
    rows.forEach(r => {
      csv += `"${r.emp_id}","${(r.name || '').replace(/"/g, '""')}","${(r.dept || '').replace(/"/g, '""')}","${(r.role || '').replace(/"/g, '""')}","${r.timestamp}","${r.status}","${(r.logged_by || '').replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soukhya_attendance_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Attendance log exported successfully', 'ok');
  }).catch(err => {
    notify(`Export failed: ${err.message}`, 'er');
  });
}

function openRegularizeAttendanceModal(attId = null, empId = '', timestamp = '', status = 'Present') {
  const m = document.getElementById('regularize-modal');
  if (!m) return;
  m.style.display = 'flex';

  populateRegularizeEmployeeDropdown();

  document.getElementById('reg-att-id').value = attId || '';
  if (empId) document.getElementById('reg-emp-id').value = empId;
  document.getElementById('reg-status').value = status || 'Present';
  document.getElementById('reg-reason').value = '';

  let dtVal = '';
  if (timestamp) {
    const d = new Date(timestamp);
    dtVal = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  } else {
    const now = new Date();
    dtVal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  document.getElementById('reg-timestamp').value = dtVal;
}

function closeRegularizeAttendanceModal() {
  const m = document.getElementById('regularize-modal');
  if (m) m.style.display = 'none';
}

async function saveRegularizeAttendance(event) {
  if (event) event.preventDefault();
  const attId = document.getElementById('reg-att-id')?.value || null;
  const empId = document.getElementById('reg-emp-id')?.value;
  const timestamp = document.getElementById('reg-timestamp')?.value;
  const status = document.getElementById('reg-status')?.value;
  const reason = document.getElementById('reg-reason')?.value.trim();

  if (!empId) {
    notify('Please select an employee', 'wn');
    return;
  }
  if (!reason) {
    notify('Please provide a regularization reason', 'wn');
    return;
  }

  try {
    const payload = {
      emp_id: empId,
      timestamp,
      status,
      reason
    };
    if (attId) payload.att_id = parseInt(attId, 10);

    const res = await api('/attendance-log/regularize', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res && res.success) {
      notify('Attendance punch regularized successfully!', 'ok');
      closeRegularizeAttendanceModal();
      await loadAttendanceLogStats();
      await loadAttendanceLogGrid(currentAttLogPage);
    } else {
      notify(`Regularization failed: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error regularizing attendance: ${err.message}`, 'er');
  }
}

// ══════════════════════════════════════════════
// 📍 GEOFENCES CONTROLLERS
// ══════════════════════════════════════════════
let geofencesData = [];

async function openGeofencesModal() {
  const m = document.getElementById('geofences-modal');
  if (!m) return;
  m.style.display = 'flex';
  await loadGeofencesList();
}

function closeGeofencesModal() {
  const m = document.getElementById('geofences-modal');
  if (m) m.style.display = 'none';
}

async function loadGeofencesList() {
  const container = document.getElementById('geofences-cards');
  const countLabel = document.getElementById('geofence-count-label');
  if (container) container.innerHTML = '<div style="color:var(--mu); padding:20px">Loading geofences...</div>';

  try {
    const res = await api('/geofences');
    if (res && res.success) {
      geofencesData = res.data?.geofences || [];
      if (countLabel) countLabel.textContent = `${geofencesData.length} Geofence boundary zone(s) configured`;
      renderGeofencesCards(geofencesData);
    } else {
      if (container) container.innerHTML = `<div style="color:var(--er); padding:20px">Failed to load geofences: ${res?.error?.message}</div>`;
    }
  } catch (err) {
    if (container) container.innerHTML = `<div style="color:var(--er); padding:20px">Error: ${err.message}</div>`;
  }
}

function renderGeofencesCards(fences) {
  const container = document.getElementById('geofences-cards');
  if (!container) return;

  if (!fences || fences.length === 0) {
    container.innerHTML = '<div style="color:var(--mu); padding:20px; grid-column:1/-1">No geofences found. Click "+ Add Geofence" to create one.</div>';
    return;
  }

  container.innerHTML = fences.map(g => {
    const isActive = !!g.active;
    const isStrict = g.enforcement_mode === 'STRICT';
    const depts = Array.isArray(g.allowed_depts) ? g.allowed_depts : [];
    const deptsBadges = depts.length > 0
      ? depts.map(d => `<span style="font-size:10px; background:var(--s1); border:1px solid var(--br); padding:1px 6px; border-radius:4px">${escapeHtml(d)}</span>`).join(' ')
      : `<span style="font-size:10px; color:var(--mu)">All Departments</span>`;

    return `
      <div style="background:var(--s2); border:1px solid var(--br); border-radius:8px; padding:14px; display:flex; flex-direction:column; justify-content:space-between; position:relative">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px">
            <div>
              <span class="mode-badge" style="font-size:10px; font-weight:700; background:rgba(79,142,247,0.15); color:#4f8ef7; border:1px solid rgba(79,142,247,0.3)">
                ${escapeHtml(g.code)}
              </span>
              <h4 style="margin:6px 0 2px 0; font-size:13.5px; font-weight:700; color:var(--tx)">${escapeHtml(g.name)}</h4>
            </div>
            <span class="mode-badge ${isActive ? 'ok' : 'er'}" style="font-size:9.5px">
              ${isActive ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; background:var(--s1); padding:8px; border-radius:6px; margin-bottom:8px; font-size:11px">
            <div>
              <span style="color:var(--mu)">Latitude:</span>
              <div style="font-family:var(--mo); font-weight:600; color:var(--tx)">${Number(g.latitude).toFixed(5)}</div>
            </div>
            <div>
              <span style="color:var(--mu)">Longitude:</span>
              <div style="font-family:var(--mo); font-weight:600; color:var(--tx)">${Number(g.longitude).toFixed(5)}</div>
            </div>
            <div>
              <span style="color:var(--mu)">Radius:</span>
              <div style="font-weight:600; color:var(--ac)">${g.radius_meters} meters</div>
            </div>
            <div>
              <span style="color:var(--mu)">Mode:</span>
              <div style="font-weight:600; color:${isStrict ? 'var(--er)' : 'var(--wn)'}">${g.enforcement_mode}</div>
            </div>
          </div>

          <div style="margin-bottom:8px">
            <span style="font-size:10.5px; color:var(--mu); display:block; margin-bottom:3px">Allowed Departments:</span>
            <div style="display:flex; flex-wrap:wrap; gap:4px">${deptsBadges}</div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:6px; border-top:1px solid var(--br); padding-top:10px; margin-top:6px">
          <button type="button" class="btn bsm" onclick="openEditGeofenceModal('${g.id}')">✏️ Edit</button>
          <button type="button" class="btn bsm" style="color:var(--er); border-color:var(--er)" onclick="deleteGeofenceAction('${g.id}', '${escapeHtml(g.name)}')">🗑️ Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

function openAddGeofenceModal() {
  const m = document.getElementById('geofence-form-modal');
  if (!m) return;
  document.getElementById('geofence-form-title').textContent = 'Add Geofence Boundary';
  document.getElementById('geo-id').value = '';
  document.getElementById('geo-code').value = '';
  document.getElementById('geo-code').readOnly = false;
  document.getElementById('geo-name').value = '';
  document.getElementById('geo-lat').value = '12.9716000';
  document.getElementById('geo-lon').value = '77.5946000';
  document.getElementById('geo-radius').value = '150';
  document.getElementById('geo-enforcement').value = 'STRICT';
  document.getElementById('geo-ip').value = '';
  document.getElementById('geo-wifi').value = '';
  document.getElementById('geo-active').checked = true;

  populateGeofenceAllowedDeptsSelect();
  m.style.display = 'flex';
}

function populateGeofenceAllowedDeptsSelect(selected = []) {
  const sel = document.getElementById('geo-allowed-depts');
  if (!sel) return;
  sel.innerHTML = '';
  const depts = state.departments || [];
  depts.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.name;
    opt.textContent = d.name;
    if (selected.includes(d.name)) opt.selected = true;
    sel.appendChild(opt);
  });
}

function openEditGeofenceModal(id) {
  const g = geofencesData.find(x => x.id === id);
  if (!g) return;

  const m = document.getElementById('geofence-form-modal');
  if (!m) return;
  document.getElementById('geofence-form-title').textContent = 'Edit Geofence Boundary';
  document.getElementById('geo-id').value = g.id;
  document.getElementById('geo-code').value = g.code;
  document.getElementById('geo-code').readOnly = true;
  document.getElementById('geo-name').value = g.name;
  document.getElementById('geo-lat').value = g.latitude;
  document.getElementById('geo-lon').value = g.longitude;
  document.getElementById('geo-radius').value = g.radius_meters;
  document.getElementById('geo-enforcement').value = g.enforcement_mode || 'STRICT';
  document.getElementById('geo-ip').value = g.ip_range || '';
  document.getElementById('geo-wifi').value = g.wifi_bssid || '';
  document.getElementById('geo-active').checked = !!g.active;

  populateGeofenceAllowedDeptsSelect(Array.isArray(g.allowed_depts) ? g.allowed_depts : []);
  m.style.display = 'flex';
}

function closeGeofenceFormModal() {
  const m = document.getElementById('geofence-form-modal');
  if (m) m.style.display = 'none';
}

async function saveGeofenceForm(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('geo-id').value;
  const code = document.getElementById('geo-code').value.trim();
  const name = document.getElementById('geo-name').value.trim();
  const latitude = parseFloat(document.getElementById('geo-lat').value);
  const longitude = parseFloat(document.getElementById('geo-lon').value);
  const radius_meters = parseInt(document.getElementById('geo-radius').value, 10);
  const enforcement_mode = document.getElementById('geo-enforcement').value;
  const ip_range = document.getElementById('geo-ip').value.trim() || null;
  const wifi_bssid = document.getElementById('geo-wifi').value.trim() || null;
  const active = document.getElementById('geo-active').checked;

  const deptsSel = document.getElementById('geo-allowed-depts');
  const allowed_depts = deptsSel ? Array.from(deptsSel.selectedOptions).map(o => o.value) : [];

  const payload = {
    code,
    name,
    latitude,
    longitude,
    radius_meters,
    enforcement_mode,
    allowed_depts,
    ip_range,
    wifi_bssid,
    active
  };

  try {
    const url = id ? `/geofences/${id}` : '/geofences';
    const method = id ? 'PUT' : 'POST';
    const res = await api(url, { method, body: JSON.stringify(payload) });

    if (res && res.success) {
      notify(`Geofence ${id ? 'updated' : 'created'} successfully!`, 'ok');
      closeGeofenceFormModal();
      await loadGeofencesList();
    } else {
      notify(`Failed to save geofence: ${res?.error?.message || 'Error'}`, 'er');
    }
  } catch (err) {
    notify(`Error saving geofence: ${err.message}`, 'er');
  }
}

async function deleteGeofenceAction(id, name) {
  if (!confirm(`Are you sure you want to delete geofence "${name}"?`)) return;
  try {
    const res = await api(`/geofences/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      notify('Geofence deleted successfully', 'ok');
      await loadGeofencesList();
    } else {
      notify(`Failed to delete: ${res?.error?.message || 'Error'}`, 'er');
    }
  } catch (err) {
    notify(`Error deleting geofence: ${err.message}`, 'er');
  }
}

function openTestCoordsModal() {
  const m = document.getElementById('geofence-test-modal');
  if (m) m.style.display = 'flex';
}

function closeTestCoordsModal() {
  const m = document.getElementById('geofence-test-modal');
  if (m) m.style.display = 'none';
}

function setTestCoordPreset(lat, lon) {
  document.getElementById('test-geo-lat').value = lat;
  document.getElementById('test-geo-lon').value = lon;
}

async function runGeofenceVerificationTest() {
  const lat = parseFloat(document.getElementById('test-geo-lat')?.value);
  const lon = parseFloat(document.getElementById('test-geo-lon')?.value);
  const resBox = document.getElementById('test-geo-result');
  if (!resBox) return;

  resBox.style.display = 'block';
  resBox.innerHTML = 'Verifying with GPS boundary engine...';

  try {
    const res = await api('/geofences/verify-coords', {
      method: 'POST',
      body: JSON.stringify({ latitude: lat, longitude: lon })
    });

    if (res && res.success) {
      const data = res.data;
      if (data.is_valid && data.matched_geofence) {
        const mg = data.matched_geofence;
        resBox.innerHTML = `
          <div style="color:var(--ok); font-weight:700; margin-bottom:4px">✓ INSIDE VALID GEOFENCE</div>
          <div>Matched Zone: <strong>${escapeHtml(mg.name)}</strong> (${escapeHtml(mg.code)})</div>
          <div>Distance from Zone Center: <strong>${mg.distance_meters}m</strong> (Allowed Radius: ${mg.radius_meters}m)</div>
          <div>Enforcement: <strong>${mg.enforcement_mode}</strong></div>
        `;
      } else {
        const nearest = (data.all_zones || []).sort((a, b) => a.distance_meters - b.distance_meters)[0];
        resBox.innerHTML = `
          <div style="color:var(--er); font-weight:700; margin-bottom:4px">❌ OUTSIDE ALL ACTIVE GEOFENCES</div>
          <div>Nearest Zone: <strong>${escapeHtml(nearest?.name || 'None')}</strong></div>
          <div>Distance: <strong>${nearest?.distance_meters || '—'}m</strong> away (Radius: ${nearest?.radius_meters || '—'}m)</div>
          <div style="color:var(--wn); margin-top:4px">Punches from these coordinates will be flagged or rejected according to zone policy.</div>
        `;
      }
    } else {
      resBox.innerHTML = `<span style="color:var(--er)">Verification failed: ${res?.error?.message}</span>`;
    }
  } catch (err) {
    resBox.innerHTML = `<span style="color:var(--er)">Error: ${err.message}</span>`;
  }
}

// ══════════════════════════════════════════════
// 🔢 WORK CODES CONTROLLERS
// ══════════════════════════════════════════════
let workCodesData = [];

async function openWorkCodesModal() {
  const m = document.getElementById('work-codes-modal');
  if (!m) return;
  m.style.display = 'flex';
  await loadWorkCodesList();
}

function closeWorkCodesModal() {
  const m = document.getElementById('work-codes-modal');
  if (m) m.style.display = 'none';
}

async function loadWorkCodesList() {
  const container = document.getElementById('work-codes-cards');
  const countLabel = document.getElementById('work-code-count-label');
  if (container) container.innerHTML = '<div style="color:var(--mu); padding:20px">Loading work codes...</div>';

  try {
    const res = await api('/work-codes');
    if (res && res.success) {
      workCodesData = res.data?.workCodes || [];
      if (countLabel) countLabel.textContent = `${workCodesData.length} Work Code(s) configured`;
      renderWorkCodesCards(workCodesData);
    } else {
      if (container) container.innerHTML = `<div style="color:var(--er); padding:20px">Failed to load work codes: ${res?.error?.message}</div>`;
    }
  } catch (err) {
    if (container) container.innerHTML = `<div style="color:var(--er); padding:20px">Error: ${err.message}</div>`;
  }
}

function renderWorkCodesCards(codes) {
  const container = document.getElementById('work-codes-cards');
  if (!container) return;

  if (!codes || codes.length === 0) {
    container.innerHTML = '<div style="color:var(--mu); padding:20px; grid-column:1/-1">No work codes found. Click "+ Add Work Code" to create one.</div>';
    return;
  }

  container.innerHTML = codes.map(w => {
    const isActive = !!w.active;
    const isOtEligible = !!w.ot_eligible;

    const catLabels = {
      BILLABLE_PROJECT: 'Billable Client Project',
      CLIENT_ONSITE: 'Client Onsite / Field',
      INTERNAL_OPS: 'Internal Operations',
      TRAINING_LD: 'Learning & Dev',
      FACILITY_MAINT: 'Facility Maintenance'
    };

    return `
      <div style="background:var(--s2); border:1px solid var(--br); border-radius:8px; padding:14px; display:flex; flex-direction:column; justify-content:space-between">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px">
            <div>
              <span class="mode-badge" style="font-size:10px; font-weight:700; background:rgba(0,212,170,0.15); color:#00d4aa; border:1px solid rgba(0,212,170,0.3)">
                ${escapeHtml(w.code)}
              </span>
              <h4 style="margin:6px 0 2px 0; font-size:13.5px; font-weight:700; color:var(--tx)">${escapeHtml(w.name)}</h4>
            </div>
            <span class="mode-badge ${isActive ? 'ok' : 'er'}" style="font-size:9.5px">
              ${isActive ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>

          <div style="font-size:11px; color:var(--mu); margin-bottom:10px; min-height:30px">
            ${escapeHtml(w.description || 'No description provided')}
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; background:var(--s1); padding:8px; border-radius:6px; margin-bottom:8px; font-size:11px">
            <div>
              <span style="color:var(--mu)">Category:</span>
              <div style="font-weight:600; color:var(--tx)">${catLabels[w.category] || w.category}</div>
            </div>
            <div>
              <span style="color:var(--mu)">Billing Multiplier:</span>
              <div style="font-weight:600; color:var(--ac)">${Number(w.billing_rate_multiplier).toFixed(2)}x</div>
            </div>
            <div>
              <span style="color:var(--mu)">OT Eligible:</span>
              <div style="font-weight:600; color:${isOtEligible ? 'var(--ok)' : 'var(--mu)'}">${isOtEligible ? '✓ Yes' : '✕ No'}</div>
            </div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:6px; border-top:1px solid var(--br); padding-top:10px; margin-top:6px">
          <button type="button" class="btn bsm" onclick="openEditWorkCodeModal('${w.id}')">✏️ Edit</button>
          <button type="button" class="btn bsm" style="color:var(--er); border-color:var(--er)" onclick="deleteWorkCodeAction('${w.id}', '${escapeHtml(w.name)}')">🗑️ Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

function openAddWorkCodeModal() {
  const m = document.getElementById('work-code-form-modal');
  if (!m) return;
  document.getElementById('wc-form-title').textContent = 'Add Work Code';
  document.getElementById('wc-id').value = '';
  document.getElementById('wc-code').value = '';
  document.getElementById('wc-code').readOnly = false;
  document.getElementById('wc-name').value = '';
  document.getElementById('wc-category').value = 'BILLABLE_PROJECT';
  document.getElementById('wc-multiplier').value = '1.00';
  document.getElementById('wc-desc').value = '';
  document.getElementById('wc-ot-eligible').checked = true;
  document.getElementById('wc-active').checked = true;
  m.style.display = 'flex';
}

function openEditWorkCodeModal(id) {
  const w = workCodesData.find(x => x.id === id);
  if (!w) return;

  const m = document.getElementById('work-code-form-modal');
  if (!m) return;
  document.getElementById('wc-form-title').textContent = 'Edit Work Code';
  document.getElementById('wc-id').value = w.id;
  document.getElementById('wc-code').value = w.code;
  document.getElementById('wc-code').readOnly = true;
  document.getElementById('wc-name').value = w.name;
  document.getElementById('wc-category').value = w.category || 'BILLABLE_PROJECT';
  document.getElementById('wc-multiplier').value = w.billing_rate_multiplier || 1.0;
  document.getElementById('wc-desc').value = w.description || '';
  document.getElementById('wc-ot-eligible').checked = !!w.ot_eligible;
  document.getElementById('wc-active').checked = !!w.active;
  m.style.display = 'flex';
}

function closeWorkCodeFormModal() {
  const m = document.getElementById('work-code-form-modal');
  if (m) m.style.display = 'none';
}

async function saveWorkCodeForm(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('wc-id').value;
  const code = document.getElementById('wc-code').value.trim();
  const name = document.getElementById('wc-name').value.trim();
  const category = document.getElementById('wc-category').value;
  const billing_rate_multiplier = parseFloat(document.getElementById('wc-multiplier').value);
  const description = document.getElementById('wc-desc').value.trim() || null;
  const ot_eligible = document.getElementById('wc-ot-eligible').checked;
  const active = document.getElementById('wc-active').checked;

  const payload = {
    code,
    name,
    category,
    billing_rate_multiplier,
    description,
    ot_eligible,
    active
  };

  try {
    const url = id ? `/work-codes/${id}` : '/work-codes';
    const method = id ? 'PUT' : 'POST';
    const res = await api(url, { method, body: JSON.stringify(payload) });

    if (res && res.success) {
      notify(`Work code ${id ? 'updated' : 'created'} successfully!`, 'ok');
      closeWorkCodeFormModal();
      await loadWorkCodesList();
    } else {
      notify(`Failed to save work code: ${res?.error?.message || 'Error'}`, 'er');
    }
  } catch (err) {
    notify(`Error saving work code: ${err.message}`, 'er');
  }
}

async function deleteWorkCodeAction(id, name) {
  if (!confirm(`Are you sure you want to delete work code "${name}"?`)) return;
  try {
    const res = await api(`/work-codes/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      notify('Work code deleted successfully', 'ok');
      await loadWorkCodesList();
    } else {
      notify(`Failed to delete: ${res?.error?.message || 'Error'}`, 'er');
    }
  } catch (err) {
    notify(`Error deleting work code: ${err.message}`, 'er');
  }
}

// ══════════════════════════════════════════════
// ⏱️ EMPLOYEE OVERTIME (OT) REGISTER CONTROLLERS
// ══════════════════════════════════════════════
let currentOtPage = 1;
const otLimit = 25;
let otRecordsData = [];

async function openOtRegisterModal() {
  const m = document.getElementById('ot-register-modal');
  if (!m) return;
  m.style.display = 'flex';
  await loadOtRegisterGrid(1);
}

function closeOtRegisterModal() {
  const m = document.getElementById('ot-register-modal');
  if (m) m.style.display = 'none';
}

async function loadOtRegisterGrid(page = 1) {
  currentOtPage = page;
  const startDate = document.getElementById('ot-start-date')?.value || '';
  const endDate = document.getElementById('ot-end-date')?.value || '';
  const status = document.getElementById('ot-status-filter')?.value || '';

  const tbody = document.getElementById('ot-tbody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px; color:var(--mu)">Loading overtime records...</td></tr>';
  }

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(otLimit)
  });
  if (startDate) queryParams.append('start_date', startDate);
  if (endDate) queryParams.append('end_date', endDate);
  if (status) queryParams.append('status', status);

  try {
    const res = await api(`/ot-register?${queryParams.toString()}`);
    if (res && res.success) {
      otRecordsData = res.data?.rows || [];
      renderOtRegisterRows(otRecordsData);
      renderOtRegisterPagination(res.data?.total || 0, page, otLimit);
    } else {
      if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:20px; color:var(--er)">Failed to load OT records: ${res?.error?.message}</td></tr>`;
    }
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:20px; color:var(--er)">Network error: ${err.message}</td></tr>`;
  }
}

function renderOtRegisterRows(records) {
  const tbody = document.getElementById('ot-tbody');
  if (!tbody) return;

  if (!records || records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:24px; color:var(--mu)">No overtime records found matching current filters.</td></tr>';
    return;
  }

  tbody.innerHTML = records.map(r => {
    const statusClass = {
      PENDING: 'wn',
      APPROVED: 'ok',
      COMP_OFF: 'admin',
      REJECTED: 'er'
    }[r.status] || 'mu';

    const rateBadges = {
      STANDARD_DAY: `<span style="font-size:10px; color:#4f8ef7; font-weight:600">${r.ot_multiplier}x (Std Day)</span>`,
      WEEKLY_OFF: `<span style="font-size:10px; color:#f59e0b; font-weight:600">${r.ot_multiplier}x (Weekly Off)</span>`,
      PUBLIC_HOLIDAY: `<span style="font-size:10px; color:#ef4444; font-weight:600">${r.ot_multiplier}x (Holiday)</span>`
    }[r.ot_rate_type] || `<span style="font-size:10px">${r.ot_multiplier}x</span>`;

    const safeComments = escapeHtml(r.comments || '—');
    const safeEmpName = escapeHtml(r.employee_name || 'Staff');
    const safeDept = escapeHtml(r.department || 'Operations');

    return `
      <tr style="border-bottom:1px solid var(--br); transition:background 0.15s" onmouseover="this.style.background='var(--s1)'" onmouseout="this.style.background=''">
        <td style="padding:8px 10px; text-align:center">
          <input type="checkbox" class="ot-row-chk" value="${r.id}" />
        </td>
        <td style="padding:8px 10px; font-family:var(--mo); font-size:11.5px; font-weight:600; color:var(--tx)">${r.ot_date}</td>
        <td style="padding:8px 10px">
          <div style="font-weight:600; color:var(--tx)">${safeEmpName}</div>
          <div style="font-family:var(--mo); font-size:10.5px; color:var(--ac)">${r.emp_id}</div>
        </td>
        <td style="padding:8px 10px; font-size:11.5px; color:var(--tx)">${safeDept}</td>
        <td style="padding:8px 10px; text-align:center; font-size:11.5px">
          ${Number(r.scheduled_hours).toFixed(1)}h / <strong>${Number(r.actual_hours).toFixed(1)}h</strong>
        </td>
        <td style="padding:8px 10px; text-align:center; font-family:var(--mo); font-weight:700; color:var(--wn); font-size:13px">
          +${Number(r.ot_hours).toFixed(1)}h
        </td>
        <td style="padding:8px 10px; text-align:center">${rateBadges}</td>
        <td style="padding:8px 10px; text-align:center">
          <span class="mode-badge ${statusClass}" style="font-size:9.5px; padding:2px 6px">${r.status}</span>
        </td>
        <td style="padding:8px 10px; font-size:11px; color:var(--mu); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="${safeComments}">
          ${r.approved_by ? `<div style="color:var(--ok); font-size:10px">✓ ${escapeHtml(r.approved_by)}</div>` : ''}
          ${safeComments}
        </td>
        <td style="padding:8px 10px; text-align:center">
          <div style="display:flex; gap:4px; justify-content:center">
            ${r.status === 'PENDING' ? `
              <button type="button" class="btn bsm" style="padding:2px 6px; font-size:10px; color:var(--ok); border-color:var(--ok)" title="Approve for Payroll" onclick="approveSingleOtRecord(${r.id})">✓</button>
              <button type="button" class="btn bsm" style="padding:2px 6px; font-size:10px; color:var(--ac); border-color:var(--ac)" title="Grant Compensatory Off" onclick="compOffSingleOtRecord(${r.id})">🏖️</button>
              <button type="button" class="btn bsm" style="padding:2px 6px; font-size:10px; color:var(--er); border-color:var(--er)" title="Reject" onclick="rejectSingleOtRecord(${r.id})">✕</button>
            ` : `
              <button type="button" class="btn bsm" style="padding:2px 6px; font-size:10px" title="Reset to Pending" onclick="updateOtStatusAction(${r.id}, 'PENDING')">↺</button>
            `}
            <button type="button" class="btn bsm" style="padding:2px 6px; font-size:10px; color:var(--er)" title="Delete Record" onclick="deleteOtRecordAction(${r.id})">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderOtRegisterPagination(total, page, limit) {
  const lbl = document.getElementById('ot-pagination-label');
  const ctrl = document.getElementById('ot-pagination-controls');
  if (lbl) {
    const start = total === 0 ? 0 : (page - 1) * limit + 1;
    const end = Math.min(total, page * limit);
    lbl.textContent = `Showing ${start}-${end} of ${total} OT records`;
  }
  if (!ctrl) return;

  const totalPages = Math.ceil(total / limit) || 1;
  ctrl.innerHTML = `
    <button type="button" class="btn bsm" ${page <= 1 ? 'disabled' : ''} onclick="loadOtRegisterGrid(${page - 1})">◀ Prev</button>
    <span style="font-size:11px; color:var(--tx); padding:0 6px">Page ${page} of ${totalPages}</span>
    <button type="button" class="btn bsm" ${page >= totalPages ? 'disabled' : ''} onclick="loadOtRegisterGrid(${page + 1})">Next ▶</button>
  `;
}

function toggleSelectAllOtRecords(checked) {
  const chks = document.querySelectorAll('.ot-row-chk');
  chks.forEach(c => c.checked = checked);
}

function resetOtFilters() {
  const sd = document.getElementById('ot-start-date');
  const ed = document.getElementById('ot-end-date');
  const st = document.getElementById('ot-status-filter');
  if (sd) sd.value = '';
  if (ed) ed.value = '';
  if (st) st.value = '';
  loadOtRegisterGrid(1);
}

async function approveSingleOtRecord(id) {
  await updateOtStatusAction(id, 'APPROVED', 'Approved for monthly payroll disbursement');
}

async function rejectSingleOtRecord(id) {
  const reason = prompt('Please enter reason for overtime rejection:') || 'Overtime not pre-approved';
  await updateOtStatusAction(id, 'REJECTED', reason);
}

async function compOffSingleOtRecord(id) {
  await updateOtStatusAction(id, 'COMP_OFF', 'Converted to Compensatory Off leave credit');
}

async function updateOtStatusAction(id, status, comments = '') {
  try {
    const res = await api(`/ot-register/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, comments })
    });
    if (res && res.success) {
      notify(`OT record updated to ${status}!`, 'ok');
      await loadOtRegisterGrid(currentOtPage);
    } else {
      notify(`Failed to update status: ${res?.error?.message}`, 'er');
    }
  } catch (err) {
    notify(`Error updating OT status: ${err.message}`, 'er');
  }
}

async function bulkApproveSelectedOt() {
  const chks = document.querySelectorAll('.ot-row-chk:checked');
  const ids = Array.from(chks).map(c => parseInt(c.value, 10));
  if (ids.length === 0) {
    notify('Please select at least one OT record to approve', 'wn');
    return;
  }

  try {
    const res = await api('/ot-register/bulk-status', {
      method: 'POST',
      body: JSON.stringify({
        ids,
        status: 'APPROVED',
        comments: 'Bulk approved by HR Admin'
      })
    });

    if (res && res.success) {
      notify(`Bulk approved ${res.data?.updated || ids.length} OT records!`, 'ok');
      await loadOtRegisterGrid(currentOtPage);
    } else {
      notify(`Bulk approve failed: ${res?.error?.message}`, 'er');
    }
  } catch (err) {
    notify(`Error in bulk approval: ${err.message}`, 'er');
  }
}

async function deleteOtRecordAction(id) {
  if (!confirm('Are you sure you want to delete this overtime record?')) return;
  try {
    const res = await api(`/ot-register/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      notify('OT record deleted', 'ok');
      await loadOtRegisterGrid(currentOtPage);
    } else {
      notify(`Failed to delete: ${res?.error?.message}`, 'er');
    }
  } catch (err) {
    notify(`Error deleting OT record: ${err.message}`, 'er');
  }
}

function openAddOtManualModal() {
  const m = document.getElementById('ot-entry-modal');
  if (!m) return;
  m.style.display = 'flex';

  const sel = document.getElementById('otm-emp-id');
  if (sel) {
    sel.innerHTML = '<option value="">Select Employee...</option>';
    (state.employees || []).forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.name} (${e.id}) - ${e.department || 'Operations'}`;
      sel.appendChild(opt);
    });
  }

  document.getElementById('otm-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('otm-shift').value = 'SHIFT_GEN';
  document.getElementById('otm-sched-hrs').value = '8.0';
  document.getElementById('otm-actual-hrs').value = '10.5';
  document.getElementById('otm-ot-hrs').value = '2.5';
  document.getElementById('otm-multiplier').value = '1.5';
  document.getElementById('otm-rate-type').value = 'STANDARD_DAY';
  document.getElementById('otm-comments').value = '';
}

function closeAddOtManualModal() {
  const m = document.getElementById('ot-entry-modal');
  if (m) m.style.display = 'none';
}

function autoCalculateOtDiff() {
  const sched = parseFloat(document.getElementById('otm-sched-hrs')?.value || 8.0);
  const actual = parseFloat(document.getElementById('otm-actual-hrs')?.value || 8.0);
  const ot = Math.max(0, Math.round((actual - sched) * 10) / 10);
  const otEl = document.getElementById('otm-ot-hrs');
  if (otEl) otEl.value = ot.toFixed(1);
}

async function saveOtManualEntry(event) {
  if (event) event.preventDefault();
  const emp_id = document.getElementById('otm-emp-id')?.value;
  const ot_date = document.getElementById('otm-date')?.value;
  const shift_id = document.getElementById('otm-shift')?.value || 'SHIFT_GEN';
  const scheduled_hours = parseFloat(document.getElementById('otm-sched-hrs')?.value || 8.0);
  const actual_hours = parseFloat(document.getElementById('otm-actual-hrs')?.value || 8.0);
  const ot_hours = parseFloat(document.getElementById('otm-ot-hrs')?.value || 0.0);
  const ot_multiplier = parseFloat(document.getElementById('otm-multiplier')?.value || 1.5);
  const ot_rate_type = document.getElementById('otm-rate-type')?.value || 'STANDARD_DAY';
  const comments = document.getElementById('otm-comments')?.value.trim() || null;

  if (!emp_id) {
    notify('Please select an employee', 'wn');
    return;
  }
  if (!ot_date) {
    notify('Please select an OT date', 'wn');
    return;
  }

  const payload = {
    emp_id,
    ot_date,
    shift_id,
    scheduled_hours,
    actual_hours,
    ot_hours,
    ot_multiplier,
    ot_rate_type,
    status: 'PENDING',
    comments
  };

  try {
    const res = await api('/ot-register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res && res.success) {
      notify('Overtime record submitted successfully!', 'ok');
      closeAddOtManualModal();
      await loadOtRegisterGrid(1);
    } else {
      notify(`Failed to save OT entry: ${res?.error?.message || 'Error'}`, 'er');
    }
  } catch (err) {
    notify(`Error saving OT entry: ${err.message}`, 'er');
  }
}

function openOtAutoCalcModal() {
  const m = document.getElementById('ot-calc-modal');
  if (!m) return;
  m.style.display = 'flex';
  document.getElementById('ot-calc-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('ot-calc-threshold').value = '8.0';
  const box = document.getElementById('ot-calc-result-box');
  if (box) box.style.display = 'none';
}

function closeOtAutoCalcModal() {
  const m = document.getElementById('ot-calc-modal');
  if (m) m.style.display = 'none';
}

async function runOtAutoCalculation() {
  const date = document.getElementById('ot-calc-date')?.value;
  const threshold_hours = parseFloat(document.getElementById('ot-calc-threshold')?.value || 8.0);
  const box = document.getElementById('ot-calc-result-box');

  if (!date) {
    notify('Please select a calculation date', 'wn');
    return;
  }

  if (box) {
    box.style.display = 'block';
    box.innerHTML = '<span style="color:var(--mu)">Calculating daily overtime spans...</span>';
  }

  try {
    const res = await api('/ot-register/calculate', {
      method: 'POST',
      body: JSON.stringify({ date, threshold_hours })
    });

    if (res && res.success) {
      const d = res.data;
      if (box) {
        box.innerHTML = `
          <div style="color:var(--ok); font-weight:700; margin-bottom:4px">✓ Auto-Calculation Complete</div>
          <div>Date: <strong>${d.date}</strong> (${d.rate_type} - ${d.multiplier}x)</div>
          <div>Generated OT Records: <strong>${d.generated_count}</strong></div>
        `;
      }
      notify(`Generated ${d.generated_count} OT records for ${d.date}!`, 'ok');
      await loadOtRegisterGrid(1);
    } else {
      if (box) box.innerHTML = `<span style="color:var(--er)">Calculation failed: ${res?.error?.message}</span>`;
    }
  } catch (err) {
    if (box) box.innerHTML = `<span style="color:var(--er)">Error: ${err.message}</span>`;
  }
}

// Window exports for Attendance & Time
window.openAttendanceLogModal = openAttendanceLogModal;
window.closeAttendanceLogModal = closeAttendanceLogModal;
window.loadAttendanceLogStats = loadAttendanceLogStats;
window.loadAttendanceLogGrid = loadAttendanceLogGrid;
window.resetAttendanceLogFilters = resetAttendanceLogFilters;
window.exportAttendanceLogCsv = exportAttendanceLogCsv;
window.openRegularizeAttendanceModal = openRegularizeAttendanceModal;
window.closeRegularizeAttendanceModal = closeRegularizeAttendanceModal;
window.saveRegularizeAttendance = saveRegularizeAttendance;

window.openGeofencesModal = openGeofencesModal;
window.closeGeofencesModal = closeGeofencesModal;
window.loadGeofencesList = loadGeofencesList;
window.openAddGeofenceModal = openAddGeofenceModal;
window.openEditGeofenceModal = openEditGeofenceModal;
window.closeGeofenceFormModal = closeGeofenceFormModal;
window.saveGeofenceForm = saveGeofenceForm;
window.deleteGeofenceAction = deleteGeofenceAction;
window.openTestCoordsModal = openTestCoordsModal;
window.closeTestCoordsModal = closeTestCoordsModal;
window.setTestCoordPreset = setTestCoordPreset;
window.runGeofenceVerificationTest = runGeofenceVerificationTest;

window.openWorkCodesModal = openWorkCodesModal;
window.closeWorkCodesModal = closeWorkCodesModal;
window.loadWorkCodesList = loadWorkCodesList;
window.openAddWorkCodeModal = openAddWorkCodeModal;
window.openEditWorkCodeModal = openEditWorkCodeModal;
window.closeWorkCodeFormModal = closeWorkCodeFormModal;
window.saveWorkCodeForm = saveWorkCodeForm;
window.deleteWorkCodeAction = deleteWorkCodeAction;

window.openOtRegisterModal = openOtRegisterModal;
window.closeOtRegisterModal = closeOtRegisterModal;
window.loadOtRegisterGrid = loadOtRegisterGrid;
window.toggleSelectAllOtRecords = toggleSelectAllOtRecords;
window.resetOtFilters = resetOtFilters;
window.approveSingleOtRecord = approveSingleOtRecord;
window.rejectSingleOtRecord = rejectSingleOtRecord;
window.compOffSingleOtRecord = compOffSingleOtRecord;
window.updateOtStatusAction = updateOtStatusAction;
window.bulkApproveSelectedOt = bulkApproveSelectedOt;
window.deleteOtRecordAction = deleteOtRecordAction;
window.openAddOtManualModal = openAddOtManualModal;
window.closeAddOtManualModal = closeAddOtManualModal;
window.autoCalculateOtDiff = autoCalculateOtDiff;
window.saveOtManualEntry = saveOtManualEntry;
window.openOtAutoCalcModal = openOtAutoCalcModal;
window.closeOtAutoCalcModal = closeOtAutoCalcModal;
window.runOtAutoCalculation = runOtAutoCalculation;

// ══════════════════════════════════════════════
// 🏥 1. LEAVE TYPES MASTER (ORGANIZATION)
// ══════════════════════════════════════════════
let cachedLeaveTypes = [];
let isEditingLeaveType = false;
let editingLeaveTypeId = null;

async function openLeaveTypesModal() {
  const modal = document.getElementById('leave-types-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  await loadLeaveTypesGrid();
}

function closeLeaveTypesModal() {
  const modal = document.getElementById('leave-types-modal');
  if (modal) modal.style.display = 'none';
}

async function loadLeaveTypesGrid() {
  const tbody = document.getElementById('leave-types-tbody');
  const countLabel = document.getElementById('lt-count-label');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--mu)">Loading statutory leave types...</td></tr>';

  try {
    const res = await api('/leave-types');
    if (res && res.success && Array.isArray(res.data?.leaveTypes)) {
      cachedLeaveTypes = res.data.leaveTypes;
      renderLeaveTypesTable(cachedLeaveTypes);
      if (countLabel) countLabel.textContent = `Total Leave Types: ${cachedLeaveTypes.length} (Statutory & Custom)`;
    } else {
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--er)">Failed to load leave types.</td></tr>';
    }
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--er)">Error: ${err.message}</td></tr>`;
  }
}

function renderLeaveTypesTable(types) {
  const tbody = document.getElementById('leave-types-tbody');
  if (!tbody) return;

  if (!types || types.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--mu)">No leave types configured. Click "+ Add Leave Type" to create one.</td></tr>';
    return;
  }

  tbody.innerHTML = types.map(lt => {
    const statusBadge = lt.active ? 
      '<span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); font-size:10px; padding:2px 6px">Active</span>' : 
      '<span class="badge" style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); font-size:10px; padding:2px 6px">Inactive</span>';

    const paidBadge = lt.paid ?
      '<span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; font-size:10.5px">Paid</span>' :
      '<span class="badge" style="background:rgba(239,68,68,0.15); color:#ef4444; font-size:10.5px">Unpaid</span>';

    const encashBadge = lt.encashable ?
      '<span class="badge" style="background:rgba(59,130,246,0.15); color:#60a5fa; font-size:10.5px">Yes</span>' :
      '<span class="badge" style="background:rgba(107,118,145,0.15); color:var(--mu); font-size:10.5px">No</span>';

    const colorDot = `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${escapeHtml(lt.color || '#00d4aa')}; margin-right:6px"></span>`;

    return `
      <tr style="border-bottom:1px solid var(--br); transition:background 0.15s">
        <td style="padding:10px">
          <span style="font-weight:700; font-family:var(--mo); color:var(--ac); background:rgba(0,212,170,0.08); padding:3px 8px; border-radius:4px; border:1px solid rgba(0,212,170,0.2)">
            ${escapeHtml(lt.code)}
          </span>
        </td>
        <td style="padding:10px; font-weight:600; color:var(--tx)">
          ${colorDot}${escapeHtml(lt.name)} ${statusBadge}
        </td>
        <td style="padding:10px; color:var(--mu); font-size:11px">
          <span class="badge" style="background:rgba(124,58,237,0.15); color:#a78bfa; font-size:10.5px">${escapeHtml(lt.category)}</span>
        </td>
        <td style="padding:10px; text-align:center">${paidBadge}</td>
        <td style="padding:10px; text-align:center; font-weight:700; color:var(--tx)">
          ${lt.annual_quota_days} days
        </td>
        <td style="padding:10px; text-align:center; font-weight:600; color:var(--tx)">
          ${lt.carry_forward_max ? `${lt.carry_forward_max}d` : '<span style="color:var(--mu)">0d</span>'}
        </td>
        <td style="padding:10px; text-align:center">${encashBadge}</td>
        <td style="padding:10px; text-align:right">
          <button class="btn bsm" style="font-size:11px; padding:2px 8px; margin-right:4px" onclick="openEditLeaveTypeModal('${escapeHtml(lt.id)}')">✏️ Edit</button>
          <button class="btn bsm" style="font-size:11px; padding:2px 8px; color:var(--err); border-color:var(--err)" onclick="deleteLeaveTypeAction('${escapeHtml(lt.id)}', '${escapeHtml(lt.name)}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddLeaveTypeModal() {
  isEditingLeaveType = false;
  editingLeaveTypeId = null;
  const form = document.getElementById('leave-type-form');
  if (form) form.reset();
  const title = document.getElementById('lt-form-title');
  if (title) title.textContent = 'Add Statutory Leave Type';
  document.getElementById('lt-color').value = '#00d4aa';
  document.getElementById('lt-active').checked = true;
  document.getElementById('lt-paid').checked = true;
  document.getElementById('lt-encashable').checked = false;
  document.getElementById('lt-code').disabled = false;
  const modal = document.getElementById('leave-type-form-modal');
  if (modal) modal.style.display = 'flex';
}

function openEditLeaveTypeModal(id) {
  const lt = cachedLeaveTypes.find(x => String(x.id) === String(id));
  if (!lt) return;

  isEditingLeaveType = true;
  editingLeaveTypeId = id;
  const title = document.getElementById('lt-form-title');
  if (title) title.textContent = `Edit Leave Type: ${lt.name}`;

  document.getElementById('lt-code').value = lt.code;
  document.getElementById('lt-code').disabled = true;
  document.getElementById('lt-name').value = lt.name;
  document.getElementById('lt-category').value = lt.category;
  document.getElementById('lt-description').value = lt.description || '';
  document.getElementById('lt-annual-quota').value = lt.annual_quota_days;
  document.getElementById('lt-carry-forward').value = lt.carry_forward_max || 0;
  document.getElementById('lt-color').value = lt.color || '#00d4aa';
  document.getElementById('lt-paid').checked = Boolean(lt.paid);
  document.getElementById('lt-encashable').checked = Boolean(lt.encashable);
  document.getElementById('lt-active').checked = Boolean(lt.active);

  const modal = document.getElementById('leave-type-form-modal');
  if (modal) modal.style.display = 'flex';
}

function closeLeaveTypeFormModal() {
  const modal = document.getElementById('leave-type-form-modal');
  if (modal) modal.style.display = 'none';
}

async function saveLeaveTypeForm(e) {
  if (e) e.preventDefault();
  const code = document.getElementById('lt-code').value.trim();
  const name = document.getElementById('lt-name').value.trim();
  const category = document.getElementById('lt-category').value;
  const description = document.getElementById('lt-description').value.trim();
  const annual_quota_days = parseFloat(document.getElementById('lt-annual-quota').value) || 0;
  const carry_forward_max = parseFloat(document.getElementById('lt-carry-forward').value) || 0;
  const color = document.getElementById('lt-color').value.trim() || '#00d4aa';
  const paid = document.getElementById('lt-paid').checked;
  const encashable = document.getElementById('lt-encashable').checked;
  const active = document.getElementById('lt-active').checked;

  if (!name) return notify('Leave Type Name is required.', 'warn');
  if (!code && !isEditingLeaveType) return notify('Leave Type Code is required.', 'warn');

  const payload = {
    code,
    name,
    category,
    description,
    annual_quota_days,
    carry_forward_max,
    encashable,
    paid,
    color,
    active
  };

  try {
    let res;
    if (isEditingLeaveType) {
      res = await api(`/leave-types/${editingLeaveTypeId}`, { method: 'PUT', body: payload });
    } else {
      res = await api('/leave-types', { method: 'POST', body: payload });
    }

    if (res && res.success) {
      notify(`Leave Type ${isEditingLeaveType ? 'updated' : 'created'} successfully!`, 'ok');
      closeLeaveTypeFormModal();
      await loadLeaveTypesGrid();
    } else {
      notify(res?.error?.message || 'Failed to save leave type.', 'err');
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}

async function deleteLeaveTypeAction(id, name) {
  if (!confirm(`Are you sure you want to delete leave type "${name}" (${id})?`)) return;

  try {
    const res = await api(`/leave-types/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      notify(`Leave type ${name} deleted successfully!`, 'ok');
      await loadLeaveTypesGrid();
    } else {
      notify(res?.error?.message || 'Failed to delete leave type.', 'err');
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}

// ══════════════════════════════════════════════
// 📝 2. EMPLOYEE LEAVE ENTRIES & BALANCES
// ══════════════════════════════════════════════
let currentLeavePage = 1;

async function openLeaveEntriesModal() {
  const modal = document.getElementById('leave-entries-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  if (cachedLeaveTypes.length === 0) {
    try {
      const ltRes = await api('/leave-types');
      if (ltRes && ltRes.success && Array.isArray(ltRes.data?.leaveTypes)) {
        cachedLeaveTypes = ltRes.data.leaveTypes;
      }
    } catch (_) {}
  }

  populateLeaveFilterDropdowns();
  await loadLeaveEntriesGrid(1);
}

function closeLeaveEntriesModal() {
  const modal = document.getElementById('leave-entries-modal');
  if (modal) modal.style.display = 'none';
}

function populateLeaveFilterDropdowns() {
  const empSel = document.getElementById('le-emp-filter');
  if (empSel) {
    const prevVal = empSel.value;
    empSel.innerHTML = '<option value="">All Employees</option>';
    (state.employees || []).forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.name} (${e.id})`;
      empSel.appendChild(opt);
    });
    empSel.value = prevVal;
  }

  const ltSel = document.getElementById('le-type-filter');
  if (ltSel) {
    const prevVal = ltSel.value;
    ltSel.innerHTML = '<option value="">All Leave Types</option>';
    cachedLeaveTypes.forEach(lt => {
      const opt = document.createElement('option');
      opt.value = lt.id;
      opt.textContent = `${lt.name} (${lt.code})`;
      ltSel.appendChild(opt);
    });
    ltSel.value = prevVal;
  }
}

async function loadLeaveEntriesGrid(page = 1) {
  currentLeavePage = page;
  const tbody = document.getElementById('leave-entries-tbody');
  const pageLabel = document.getElementById('le-pagination-label');
  const paginationControls = document.getElementById('le-pagination-controls');

  if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--mu)">Loading leave entries...</td></tr>';

  const emp_id = document.getElementById('le-emp-filter')?.value || '';
  const leave_type_id = document.getElementById('le-type-filter')?.value || '';
  const status = document.getElementById('le-status-filter')?.value || '';
  const start_date = document.getElementById('le-start-date')?.value || '';
  const end_date = document.getElementById('le-end-date')?.value || '';

  const params = new URLSearchParams({
    page: String(page),
    limit: '25'
  });
  if (emp_id) params.append('emp_id', emp_id);
  if (leave_type_id) params.append('leave_type_id', leave_type_id);
  if (status) params.append('status', status);
  if (start_date) params.append('start_date', start_date);
  if (end_date) params.append('end_date', end_date);

  try {
    const res = await api(`/leave-entries?${params.toString()}`);
    if (res && res.success && res.data) {
      const { entries, total, limit } = res.data;
      renderLeaveEntriesTable(entries);

      const totalPages = Math.ceil(total / limit) || 1;
      if (pageLabel) pageLabel.textContent = `Showing ${entries.length} of ${total} leave applications (Page ${page} of ${totalPages})`;

      if (paginationControls) {
        paginationControls.innerHTML = `
          <button class="btn bsm" ${page <= 1 ? 'disabled' : ''} onclick="loadLeaveEntriesGrid(${page - 1})">◀ Prev</button>
          <span style="font-size:11px; font-weight:600; color:var(--tx); padding:0 4px">${page} / ${totalPages}</span>
          <button class="btn bsm" ${page >= totalPages ? 'disabled' : ''} onclick="loadLeaveEntriesGrid(${page + 1})">Next ▶</button>
        `;
      }
    } else {
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--er)">Failed to load leave entries.</td></tr>';
    }
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--er)">Error: ${err.message}</td></tr>`;
  }
}

function renderLeaveEntriesTable(entries) {
  const tbody = document.getElementById('leave-entries-tbody');
  if (!tbody) return;

  if (!entries || entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--mu)">No leave applications found matching criteria.</td></tr>';
    return;
  }

  tbody.innerHTML = entries.map(le => {
    let statusBadge = '';
    if (le.status === 'APPROVED') {
      statusBadge = '<span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); font-size:10px; padding:2px 6px">✓ APPROVED</span>';
    } else if (le.status === 'PENDING') {
      statusBadge = '<span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3); font-size:10px; padding:2px 6px">⏳ PENDING</span>';
    } else if (le.status === 'REJECTED') {
      statusBadge = '<span class="badge" style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); font-size:10px; padding:2px 6px">✕ REJECTED</span>';
    } else {
      statusBadge = `<span class="badge" style="background:rgba(107,118,145,0.15); color:var(--mu); font-size:10px; padding:2px 6px">${escapeHtml(le.status)}</span>`;
    }

    const typeColor = le.color || '#00d4aa';
    const typeBadge = `<span class="badge" style="background:${typeColor}22; color:${typeColor}; border:1px solid ${typeColor}55; font-size:11px; font-weight:700">${escapeHtml(le.leave_type_name || le.leave_type_id)}</span>`;

    return `
      <tr style="border-bottom:1px solid var(--br); transition:background 0.15s">
        <td style="padding:10px">${typeBadge}</td>
        <td style="padding:10px">
          <div style="font-weight:600; color:var(--tx)">${escapeHtml(le.emp_name || le.emp_id)}</div>
          <div style="font-size:10.5px; color:var(--mu)">ID: ${escapeHtml(le.emp_id)} • ${escapeHtml(le.department || 'Operations')}</div>
        </td>
        <td style="padding:10px; font-family:var(--mo); font-size:11.5px; color:var(--tx)">
          ${le.start_date} <span style="color:var(--mu)">➔</span> ${le.end_date}
        </td>
        <td style="padding:10px; text-align:center; font-weight:700; color:var(--tx)">
          ${le.total_days} days
        </td>
        <td style="padding:10px; font-size:11px; color:var(--tx); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="${escapeHtml(le.reason || '')}">
          ${escapeHtml(le.reason || 'Personal Leave')}
        </td>
        <td style="padding:10px; text-align:center">${statusBadge}</td>
        <td style="padding:10px; font-size:11px; color:var(--mu)">
          ${le.approved_by ? `<div style="color:var(--tx)">By: <strong>${escapeHtml(le.approved_by)}</strong></div>` : ''}
          ${le.comments ? `<div style="font-style:italic">"${escapeHtml(le.comments)}"</div>` : '<span style="color:var(--mu)">-</span>'}
        </td>
        <td style="padding:10px; text-align:right; white-space:nowrap">
          ${le.status === 'PENDING' ? `
            <button class="btn bsm" style="font-size:10.5px; padding:2px 6px; color:#10b981; border-color:#10b981; margin-right:4px" onclick="updateLeaveEntryStatus('${le.id}', 'APPROVED')">✓ Approve</button>
            <button class="btn bsm" style="font-size:10.5px; padding:2px 6px; color:#ef4444; border-color:#ef4444; margin-right:4px" onclick="updateLeaveEntryStatus('${le.id}', 'REJECTED')">✕ Reject</button>
          ` : ''}
          <button class="btn bsm" style="font-size:10.5px; padding:2px 6px; color:var(--err); border-color:var(--err)" onclick="deleteLeaveEntryAction('${le.id}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function resetLeaveFilters() {
  const ef = document.getElementById('le-emp-filter');
  const tf = document.getElementById('le-type-filter');
  const sf = document.getElementById('le-status-filter');
  const sd = document.getElementById('le-start-date');
  const ed = document.getElementById('le-end-date');
  if (ef) ef.value = '';
  if (tf) tf.value = '';
  if (sf) sf.value = '';
  if (sd) sd.value = '';
  if (ed) ed.value = '';
  loadLeaveEntriesGrid(1);
}

function openApplyLeaveModal() {
  const m = document.getElementById('leave-entry-form-modal');
  if (!m) return;
  m.style.display = 'flex';

  const empSel = document.getElementById('la-emp-id');
  if (empSel) {
    empSel.innerHTML = '<option value="">Select Employee...</option>';
    (state.employees || []).forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.name} (${e.id}) - ${e.department || 'Operations'}`;
      empSel.appendChild(opt);
    });
  }

  const ltSel = document.getElementById('la-type-id');
  if (ltSel) {
    ltSel.innerHTML = '<option value="">Select Leave Type...</option>';
    cachedLeaveTypes.forEach(lt => {
      const opt = document.createElement('option');
      opt.value = lt.id;
      opt.textContent = `${lt.name} (${lt.code}) - ${lt.annual_quota_days}d Quota`;
      ltSel.appendChild(opt);
    });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  document.getElementById('la-start-date').value = todayStr;
  document.getElementById('la-end-date').value = todayStr;
  document.getElementById('la-total-days').value = '1.0';
  document.getElementById('la-reason').value = '';
  document.getElementById('la-comments').value = '';
}

function closeApplyLeaveModal() {
  const m = document.getElementById('leave-entry-form-modal');
  if (m) m.style.display = 'none';
}

function autoCalcLeaveDays() {
  const s = document.getElementById('la-start-date')?.value;
  const e = document.getElementById('la-end-date')?.value;
  if (!s || !e) return;
  const d1 = new Date(s);
  const d2 = new Date(e);
  if (d2 >= d1) {
    const diffMs = d2.getTime() - d1.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    const daysInput = document.getElementById('la-total-days');
    if (daysInput) daysInput.value = days.toFixed(1);
  }
}

async function saveLeaveApplication(e) {
  if (e) e.preventDefault();
  const emp_id = document.getElementById('la-emp-id')?.value;
  const leave_type_id = document.getElementById('la-type-id')?.value;
  const start_date = document.getElementById('la-start-date')?.value;
  const end_date = document.getElementById('la-end-date')?.value;
  const total_days = parseFloat(document.getElementById('la-total-days')?.value) || 1.0;
  const reason = document.getElementById('la-reason')?.value.trim();
  const comments = document.getElementById('la-comments')?.value.trim();

  if (!emp_id) return notify('Please select an employee.', 'warn');
  if (!leave_type_id) return notify('Please select a leave type.', 'warn');
  if (!start_date || !end_date) return notify('Start Date and End Date are required.', 'warn');
  if (!reason) return notify('Reason for leave application is required.', 'warn');

  const payload = {
    emp_id,
    leave_type_id,
    start_date,
    end_date,
    total_days,
    reason,
    status: 'PENDING',
    comments
  };

  try {
    const res = await api('/leave-entries', { method: 'POST', body: payload });
    if (res && res.success) {
      notify('Leave application submitted successfully!', 'ok');
      closeApplyLeaveModal();
      await loadLeaveEntriesGrid(1);
    } else {
      notify(res?.error?.message || 'Failed to submit leave application.', 'err');
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}

async function updateLeaveEntryStatus(id, status) {
  const actionText = status === 'APPROVED' ? 'approve' : 'reject';
  const comments = prompt(`Enter approver remarks/comments for ${actionText.toUpperCase()}:`, status === 'APPROVED' ? 'Approved by HR Administrator' : 'Rejected per policy');
  if (comments === null) return;

  try {
    const res = await api(`/leave-entries/${id}/status`, {
      method: 'PUT',
      body: { status, comments }
    });
    if (res && res.success) {
      notify(`Leave application marked as ${status}!`, 'ok');
      await loadLeaveEntriesGrid(currentLeavePage);
    } else {
      notify(res?.error?.message || 'Failed to update leave status.', 'err');
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}

async function deleteLeaveEntryAction(id) {
  if (!confirm('Are you sure you want to permanently delete this leave application entry?')) return;

  try {
    const res = await api(`/leave-entries/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      notify('Leave application deleted.', 'ok');
      await loadLeaveEntriesGrid(currentLeavePage);
    } else {
      notify(res?.error?.message || 'Failed to delete leave entry.', 'err');
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}

async function openLeaveBalancesModal() {
  const m = document.getElementById('leave-balance-modal');
  if (!m) return;
  m.style.display = 'flex';

  const empSel = document.getElementById('lb-emp-id');
  if (empSel) {
    empSel.innerHTML = '<option value="">Select Employee...</option>';
    (state.employees || []).forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.name} (${e.id}) - ${e.department || 'Operations'}`;
      empSel.appendChild(opt);
    });
    if (state.employees && state.employees.length > 0) {
      empSel.value = state.employees[0].id;
    }
  }

  const yearSel = document.getElementById('lb-year');
  if (yearSel) {
    const currYear = new Date().getFullYear();
    yearSel.innerHTML = `
      <option value="${currYear}">${currYear}</option>
      <option value="${currYear - 1}">${currYear - 1}</option>
      <option value="${currYear + 1}">${currYear + 1}</option>
    `;
    yearSel.value = String(currYear);
  }

  await loadEmployeeLeaveBalances();
}

function closeLeaveBalancesModal() {
  const m = document.getElementById('leave-balance-modal');
  if (m) m.style.display = 'none';
}

async function loadEmployeeLeaveBalances() {
  const empId = document.getElementById('lb-emp-id')?.value;
  const year = document.getElementById('lb-year')?.value || new Date().getFullYear();
  const container = document.getElementById('lb-cards-container');

  if (!container) return;
  if (!empId) {
    container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--mu)">Please select an employee to view their annual leave balance ledger.</div>';
    return;
  }

  container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--mu)">Loading statutory leave entitlement balance...</div>';

  try {
    const res = await api(`/leave-entries/balances/${empId}?year=${year}`);
    if (res && res.success && Array.isArray(res.data?.balances)) {
      const balances = res.data.balances;
      if (balances.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--mu)">No leave entitlements found for this employee.</div>';
        return;
      }

      container.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:12px; margin-top:8px">
          ${balances.map(b => {
            const color = b.color || '#00d4aa';
            const quota = b.annual_quota !== undefined ? b.annual_quota : (b.annual_quota_days || 0);
            const used = b.used_days !== undefined ? b.used_days : (b.approved_days || 0);
            const avail = b.available_days !== undefined ? b.available_days : (b.remaining_balance || 0);
            const remainingColor = avail > 0 ? '#10b981' : '#ef4444';
            return `
              <div style="background:var(--s1); border:1px solid var(--br); border-radius:8px; padding:14px; position:relative; overflow:hidden">
                <div style="position:absolute; top:0; left:0; right:0; height:3px; background:${color}"></div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px">
                  <div>
                    <div style="font-weight:700; font-size:13px; color:var(--tx)">${escapeHtml(b.name || b.leave_type_name || b.leave_type_id)}</div>
                    <div style="font-family:var(--mo); font-size:10.5px; color:var(--mu)">${escapeHtml(b.code || b.leave_type_code || '')}</div>
                  </div>
                  <span class="badge" style="background:${b.paid ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${b.paid ? '#10b981' : '#ef4444'}; font-size:10px">
                    ${b.paid ? 'PAID' : 'UNPAID'}
                  </span>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px; margin-bottom:10px">
                  <div><span style="color:var(--mu)">Quota:</span> <strong>${quota}d</strong></div>
                  <div><span style="color:var(--mu)">Used:</span> <strong>${used}d</strong></div>
                </div>
                <div style="border-top:1px dashed var(--br); padding-top:8px; display:flex; justify-content:space-between; align-items:center">
                  <span style="font-size:11px; color:var(--mu)">Available Balance:</span>
                  <span style="font-size:15px; font-weight:800; color:${remainingColor}">${avail}d</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--er)">Failed to fetch balance ledger.</div>';
    }
  } catch (err) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--er)">Error: ${err.message}</div>`;
  }
}

// ══════════════════════════════════════════════
// 🚶 3. EMPLOYEE OUTDOOR / ON-DUTY (OD) ENTRIES
// ══════════════════════════════════════════════
let currentOutdoorPage = 1;

async function openOutdoorEntriesModal() {
  const modal = document.getElementById('outdoor-entries-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  populateOutdoorFilterDropdowns();
  await loadOutdoorEntriesGrid(1);
}

function closeOutdoorEntriesModal() {
  const modal = document.getElementById('outdoor-entries-modal');
  if (modal) modal.style.display = 'none';
}

function populateOutdoorFilterDropdowns() {
  const empSel = document.getElementById('od-emp-filter');
  if (empSel) {
    const prevVal = empSel.value;
    empSel.innerHTML = '<option value="">All Employees</option>';
    (state.employees || []).forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.name} (${e.id})`;
      empSel.appendChild(opt);
    });
    empSel.value = prevVal;
  }
}

async function loadOutdoorEntriesGrid(page = 1) {
  currentOutdoorPage = page;
  const tbody = document.getElementById('outdoor-entries-tbody');
  const pageLabel = document.getElementById('od-pagination-label');
  const paginationControls = document.getElementById('od-pagination-controls');

  if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--mu)">Loading outdoor duty entries...</td></tr>';

  const emp_id = document.getElementById('od-emp-filter')?.value || '';
  const status = document.getElementById('od-status-filter')?.value || '';
  const start_date = document.getElementById('od-start-date')?.value || '';
  const end_date = document.getElementById('od-end-date')?.value || '';

  const params = new URLSearchParams({
    page: String(page),
    limit: '25'
  });
  if (emp_id) params.append('emp_id', emp_id);
  if (status) params.append('status', status);
  if (start_date) params.append('start_date', start_date);
  if (end_date) params.append('end_date', end_date);

  try {
    const res = await api(`/outdoor-entries?${params.toString()}`);
    if (res && res.success && res.data) {
      const { entries, total, limit } = res.data;
      renderOutdoorEntriesTable(entries);

      const totalPages = Math.ceil(total / limit) || 1;
      if (pageLabel) pageLabel.textContent = `Showing ${entries.length} of ${total} outdoor entries (Page ${page} of ${totalPages})`;

      if (paginationControls) {
        paginationControls.innerHTML = `
          <button class="btn bsm" ${page <= 1 ? 'disabled' : ''} onclick="loadOutdoorEntriesGrid(${page - 1})">◀ Prev</button>
          <span style="font-size:11px; font-weight:600; color:var(--tx); padding:0 4px">${page} / ${totalPages}</span>
          <button class="btn bsm" ${page >= totalPages ? 'disabled' : ''} onclick="loadOutdoorEntriesGrid(${page + 1})">Next ▶</button>
        `;
      }
    } else {
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--er)">Failed to load outdoor entries.</td></tr>';
    }
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--er)">Error: ${err.message}</td></tr>`;
  }
}

function renderOutdoorEntriesTable(entries) {
  const tbody = document.getElementById('outdoor-entries-tbody');
  if (!tbody) return;

  if (!entries || entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--mu)">No outdoor duty records found matching criteria.</td></tr>';
    return;
  }

  tbody.innerHTML = entries.map(od => {
    let statusBadge = '';
    if (od.status === 'APPROVED') {
      statusBadge = '<span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); font-size:10px; padding:2px 6px">✓ APPROVED</span>';
    } else if (od.status === 'PENDING') {
      statusBadge = '<span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3); font-size:10px; padding:2px 6px">⏳ PENDING</span>';
    } else if (od.status === 'REJECTED') {
      statusBadge = '<span class="badge" style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); font-size:10px; padding:2px 6px">✕ REJECTED</span>';
    } else {
      statusBadge = `<span class="badge" style="background:rgba(107,118,145,0.15); color:var(--mu); font-size:10px; padding:2px 6px">${escapeHtml(od.status)}</span>`;
    }

    const taBadge = od.travel_allowance_eligible ?
      '<span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; font-size:10.5px">TA Eligible</span>' :
      '<span class="badge" style="background:rgba(107,118,145,0.15); color:var(--mu); font-size:10.5px">N/A</span>';

    return `
      <tr style="border-bottom:1px solid var(--br); transition:background 0.15s">
        <td style="padding:10px; font-family:var(--mo); font-size:11.5px; font-weight:700; color:var(--tx)">
          ${od.od_date}
        </td>
        <td style="padding:10px">
          <div style="font-weight:600; color:var(--tx)">${escapeHtml(od.emp_name || od.emp_id)}</div>
          <div style="font-size:10.5px; color:var(--mu)">ID: ${escapeHtml(od.emp_id)} • ${escapeHtml(od.department || 'Operations')}</div>
        </td>
        <td style="padding:10px; font-family:var(--mo); font-size:11px; color:var(--tx)">
          ${od.start_time ? od.start_time.slice(0, 5) : '09:00'} - ${od.end_time ? od.end_time.slice(0, 5) : '18:00'}
        </td>
        <td style="padding:10px; font-weight:600; color:var(--tx)">
          📍 ${escapeHtml(od.destination_client)}
        </td>
        <td style="padding:10px; font-size:11px; color:var(--mu); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="${escapeHtml(od.purpose || '')}">
          ${escapeHtml(od.purpose)}
        </td>
        <td style="padding:10px; text-align:center">${taBadge}</td>
        <td style="padding:10px; text-align:center">${statusBadge}</td>
        <td style="padding:10px; text-align:right; white-space:nowrap">
          ${od.status === 'PENDING' ? `
            <button class="btn bsm" style="font-size:10.5px; padding:2px 6px; color:#10b981; border-color:#10b981; margin-right:4px" onclick="updateOutdoorEntryStatus('${od.id}', 'APPROVED')">✓ Approve</button>
            <button class="btn bsm" style="font-size:10.5px; padding:2px 6px; color:#ef4444; border-color:#ef4444; margin-right:4px" onclick="updateOutdoorEntryStatus('${od.id}', 'REJECTED')">✕ Reject</button>
          ` : ''}
          <button class="btn bsm" style="font-size:10.5px; padding:2px 6px; color:var(--err); border-color:var(--err)" onclick="deleteOutdoorEntryAction('${od.id}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function resetOutdoorFilters() {
  const ef = document.getElementById('od-emp-filter');
  const sf = document.getElementById('od-status-filter');
  const sd = document.getElementById('od-start-date');
  const ed = document.getElementById('od-end-date');
  if (ef) ef.value = '';
  if (sf) sf.value = '';
  if (sd) sd.value = '';
  if (ed) ed.value = '';
  loadOutdoorEntriesGrid(1);
}

function openApplyOutdoorModal() {
  const m = document.getElementById('outdoor-entry-form-modal');
  if (!m) return;
  m.style.display = 'flex';

  const empSel = document.getElementById('oda-emp-id');
  if (empSel) {
    empSel.innerHTML = '<option value="">Select Employee...</option>';
    (state.employees || []).forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.name} (${e.id}) - ${e.department || 'Operations'}`;
      empSel.appendChild(opt);
    });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  document.getElementById('oda-date').value = todayStr;
  document.getElementById('oda-start-time').value = '09:00';
  document.getElementById('oda-end-time').value = '18:00';
  document.getElementById('oda-destination').value = '';
  document.getElementById('oda-purpose').value = '';
  document.getElementById('oda-ta').checked = true;
  document.getElementById('oda-comments').value = '';
}

function closeApplyOutdoorModal() {
  const m = document.getElementById('outdoor-entry-form-modal');
  if (m) m.style.display = 'none';
}

async function saveOutdoorEntry(e) {
  if (e) e.preventDefault();
  const emp_id = document.getElementById('oda-emp-id')?.value;
  const od_date = document.getElementById('oda-date')?.value;
  const start_time = (document.getElementById('oda-start-time')?.value || '09:00') + ':00';
  const end_time = (document.getElementById('oda-end-time')?.value || '18:00') + ':00';
  const destination_client = document.getElementById('oda-destination')?.value.trim();
  const purpose = document.getElementById('oda-purpose')?.value.trim();
  const travel_allowance_eligible = document.getElementById('oda-ta')?.checked;
  const comments = document.getElementById('oda-comments')?.value.trim();

  if (!emp_id) return notify('Please select an employee.', 'warn');
  if (!od_date) return notify('OD Date is required.', 'warn');
  if (!destination_client) return notify('Destination / Client Location is required.', 'warn');
  if (!purpose) return notify('Purpose of visit is required.', 'warn');

  const payload = {
    emp_id,
    od_date,
    start_time,
    end_time,
    destination_client,
    purpose,
    travel_allowance_eligible,
    status: 'PENDING',
    comments
  };

  try {
    const res = await api('/outdoor-entries', { method: 'POST', body: payload });
    if (res && res.success) {
      notify('Outdoor duty entry submitted successfully!', 'ok');
      closeApplyOutdoorModal();
      await loadOutdoorEntriesGrid(1);
    } else {
      notify(res?.error?.message || 'Failed to submit outdoor entry.', 'err');
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}

async function updateOutdoorEntryStatus(id, status) {
  const actionText = status === 'APPROVED' ? 'approve' : 'reject';
  const comments = prompt(`Enter approver remarks/comments for ${actionText.toUpperCase()}:`, status === 'APPROVED' ? 'Approved by HR Administrator' : 'Rejected per policy');
  if (comments === null) return;

  try {
    const res = await api(`/outdoor-entries/${id}/status`, {
      method: 'PUT',
      body: { status, comments }
    });
    if (res && res.success) {
      notify(`Outdoor entry marked as ${status}!`, 'ok');
      await loadOutdoorEntriesGrid(currentOutdoorPage);
    } else {
      notify(res?.error?.message || 'Failed to update outdoor status.', 'err');
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}

async function deleteOutdoorEntryAction(id) {
  if (!confirm('Are you sure you want to permanently delete this outdoor duty entry?')) return;

  try {
    const res = await api(`/outdoor-entries/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      notify('Outdoor duty entry deleted.', 'ok');
      await loadOutdoorEntriesGrid(currentOutdoorPage);
    } else {
      notify(res?.error?.message || 'Failed to delete outdoor entry.', 'err');
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}

// Window exports for Organization (Leave & Outdoor)
window.openLeaveTypesModal = openLeaveTypesModal;
window.closeLeaveTypesModal = closeLeaveTypesModal;
window.loadLeaveTypesGrid = loadLeaveTypesGrid;
window.openAddLeaveTypeModal = openAddLeaveTypeModal;
window.openEditLeaveTypeModal = openEditLeaveTypeModal;
window.closeLeaveTypeFormModal = closeLeaveTypeFormModal;
window.saveLeaveTypeForm = saveLeaveTypeForm;
window.deleteLeaveTypeAction = deleteLeaveTypeAction;

window.openLeaveEntriesModal = openLeaveEntriesModal;
window.closeLeaveEntriesModal = closeLeaveEntriesModal;
window.loadLeaveEntriesGrid = loadLeaveEntriesGrid;
window.resetLeaveFilters = resetLeaveFilters;
window.openApplyLeaveModal = openApplyLeaveModal;
window.closeApplyLeaveModal = closeApplyLeaveModal;
window.autoCalcLeaveDays = autoCalcLeaveDays;
window.saveLeaveApplication = saveLeaveApplication;
window.updateLeaveEntryStatus = updateLeaveEntryStatus;
window.deleteLeaveEntryAction = deleteLeaveEntryAction;
window.openLeaveBalancesModal = openLeaveBalancesModal;
window.closeLeaveBalancesModal = closeLeaveBalancesModal;
window.loadEmployeeLeaveBalances = loadEmployeeLeaveBalances;

window.openOutdoorEntriesModal = openOutdoorEntriesModal;
window.closeOutdoorEntriesModal = closeOutdoorEntriesModal;
window.loadOutdoorEntriesGrid = loadOutdoorEntriesGrid;
window.resetOutdoorFilters = resetOutdoorFilters;
window.openApplyOutdoorModal = openApplyOutdoorModal;
window.closeApplyOutdoorModal = closeApplyOutdoorModal;
window.saveOutdoorEntry = saveOutdoorEntry;
window.updateOutdoorEntryStatus = updateOutdoorEntryStatus;
window.deleteOutdoorEntryAction = deleteOutdoorEntryAction;

// ══════════════════════════════════════════════
// Boot
// ══════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', init);

