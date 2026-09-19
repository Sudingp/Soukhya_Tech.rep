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
