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
  // Load employees
  const empRes = await apiGet('/api/employees');
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
    renderCompanyGrid();
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
            <div>Engine: SQLite 3 (better-sqlite3)</div>
            <div>File: <code style="color:var(--ac2); font-family:var(--mo)">attendance.db</code></div>
            <div>Size: 245 KB</div>
            <div>Mode: WAL (Write-Ahead Log)</div>
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
            <div class="menu-list-item" onclick="notify('Master Settings config loaded.', 'ok')">
              <span class="menu-icon">⚙️</span> <span class="menu-text">Master Settings</span>
            </div>
            <div class="menu-list-item" onclick="notify('Mail Settings config loaded.', 'ok')">
              <span class="menu-icon">✉️</span> <span class="menu-text">Mail Settings</span>
            </div>
            <div class="menu-list-item" onclick="notify('SMS Settings config loaded.', 'ok')">
              <span class="menu-icon">💬</span> <span class="menu-text">SMS Settings</span>
            </div>
            <div class="menu-list-item" onclick="notify('Shift Details config loaded.', 'ok')">
              <span class="menu-icon">⏱️</span> <span class="menu-text">Shift Details</span>
            </div>
            <div class="menu-list-item" onclick="notify('Shift Calendar config loaded.', 'ok')">
              <span class="menu-icon">📅</span> <span class="menu-text">Shift Calendar</span>
            </div>
            <div class="menu-list-item" onclick="notify('Shift Roster config loaded.', 'ok')">
              <span class="menu-icon">📋</span> <span class="menu-text">Shift Roster</span>
            </div>
            <div class="menu-list-item" onclick="notify('Shift Group config loaded.', 'ok')">
              <span class="menu-icon">👥</span> <span class="menu-text">Shift Group</span>
            </div>
            <div class="menu-list-item" onclick="notify('Leave Types config loaded.', 'ok')">
              <span class="menu-icon">🏥</span> <span class="menu-text">Leave Types</span>
            </div>
            <div class="menu-list-item" onclick="notify('Employees Categories config loaded.', 'ok')">
              <span class="menu-icon">🏷️</span> <span class="menu-text">Employees Categories</span>
            </div>
            <div class="menu-list-item" onclick="notify('Public Holidays config loaded.', 'ok')">
              <span class="menu-icon">🏖️</span> <span class="menu-text">Public Holidays</span>
            </div>
            <div class="menu-list-item" onclick="notify('Departments config loaded.', 'ok')">
              <span class="menu-icon">🏢</span> <span class="menu-text">Departments</span>
            </div>
            <div class="menu-list-item" onclick="notify('Departments Shifts config loaded.', 'ok')">
              <span class="menu-icon">🔄</span> <span class="menu-text">Departments Shifts</span>
            </div>
            <div class="menu-list-item" onclick="closeInfoDrawer(); showTab('employee-list', null)">
              <span class="menu-icon">👤</span> <span class="menu-text">Employees</span>
            </div>
            <div class="menu-list-item" onclick="notify('Employees Shifts config loaded.', 'ok')">
              <span class="menu-icon">⏰</span> <span class="menu-text">Employees Shifts</span>
            </div>
            <div class="menu-list-item" onclick="notify('Employees Shift Schedule config loaded.', 'ok')">
              <span class="menu-icon">🗓️</span> <span class="menu-text">Employees Shift Schedule</span>
            </div>
            <div class="menu-list-item" onclick="notify('Employees Leave Entries config loaded.', 'ok')">
              <span class="menu-icon">📝</span> <span class="menu-text">Employees Leave Entries</span>
            </div>
            <div class="menu-list-item" onclick="notify('Employee OutDoor Entries config loaded.', 'ok')">
              <span class="menu-icon">🚶</span> <span class="menu-text">Employee OutDoor Entries</span>
            </div>
            <div class="menu-list-item" onclick="closeInfoDrawer(); showTab('hr', null)">
              <span class="menu-icon">📊</span> <span class="menu-text">Attendance Log</span>
            </div>
            <div class="menu-list-item" onclick="notify('Employee OT Register config loaded.', 'ok')">
              <span class="menu-icon">⏱️</span> <span class="menu-text">Employee OT Register</span>
            </div>
            <div class="menu-list-item" onclick="notify('Geofences config loaded.', 'ok')">
              <span class="menu-icon">📍</span> <span class="menu-text">Geofences</span>
            </div>
            <div class="menu-list-item" onclick="notify('Manage Work Code config loaded.', 'ok')">
              <span class="menu-icon">🔢</span> <span class="menu-text">Manage Work Code</span>
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
          <div style="font-weight:600; color:var(--ac); margin-bottom:10px">SQLite Engine Configurations</div>
          <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:12px">
            <div class="fg" style="margin:0">
              <label class="fl">Max DB connection timeout (ms)</label>
              <input class="fi" value="5000" id="cfg-timeout" style="padding:6px 10px; font-size:11px" />
            </div>
            <div class="fg" style="margin:0">
              <label class="fl">Page Cache Size (pages)</label>
              <input class="fi" value="2000" id="cfg-cache" style="padding:6px 10px; font-size:11px" />
            </div>
            <div class="fg" style="margin:0; display:flex; gap:8px; align-items:center">
              <input type="checkbox" checked id="cfg-wal" />
              <label style="font-size:11px; margin:0">Enable Write-Ahead Logging (WAL) Mode</label>
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

function saveCompanyModal() {
  const idxVal = document.getElementById('comp-edit-index').value;
  const name = document.getElementById('comp-name').value.trim();
  const short = document.getElementById('comp-short').value.trim();

  if (!name || !short) {
    notify('Company Name and Short Name are required.', 'wn');
    return;
  }

  if (idxVal === '') {
    // Add
    if (COMPANIES.some(c => c.name.toLowerCase() === name.toLowerCase() || c.short.toLowerCase() === short.toLowerCase())) {
      notify('Company or Short Name already exists.', 'er');
      return;
    }
    COMPANIES.push({ name, short });
    notify(`Company "${name}" registered successfully.`, 'ok');
  } else {
    // Edit
    const idx = parseInt(idxVal);
    if (isNaN(idx) || idx < 0 || idx >= COMPANIES.length) return;
    
    if (COMPANIES.some((c, i) => i !== idx && (c.name.toLowerCase() === name.toLowerCase() || c.short.toLowerCase() === short.toLowerCase()))) {
      notify('Company or Short Name already exists.', 'er');
      return;
    }
    COMPANIES[idx].name = name;
    COMPANIES[idx].short = short;
    notify(`Company details updated.`, 'ok');
  }

  closeCompanyModal();
  updateCompanySelects();
  renderCompanyGrid();
}

function deleteCompanyItem(idx) {
  const c = COMPANIES[idx];
  if (!c) return;
  if (!confirm(`Are you sure you want to delete company "${c.name}"?`)) return;
  
  COMPANIES.splice(idx, 1);
  notify(`Company deleted successfully.`, 'wn');
  updateCompanySelects();
  renderCompanyGrid();
}

function updateCompanySelects() {
  const selects = ['r-company', 'm-company', 'rep-company'];
  selects.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    
    const currentVal = select.value;
    select.innerHTML = '';
    
    if (id === 'rep-company') {
      const optAll = document.createElement('option');
      optAll.value = 'All';
      optAll.textContent = 'All Companies';
      select.appendChild(optAll);
    }
    
    COMPANIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.short;
      opt.textContent = c.short;
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

// ══════════════════════════════════════════════
// Boot
// ══════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', init);
