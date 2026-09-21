// ══════════════════════════════════════════════
// CHANGELOG MODAL CONTROLLER (v4.0)
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
    dontShowChk.checked = localStorage.getItem('changelog_dismiss_v4') === 'true';
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
    if (roleIndicator) roleIndicator.textContent = 'VIEW: ADMIN TECHNICAL (v4.0)';
  } else {
    userBtn?.classList.add('active');
    adminBtn?.classList.remove('active');
    if (userView) userView.style.display = 'block';
    if (adminView) adminView.style.display = 'none';
    if (roleIndicator) roleIndicator.textContent = 'VIEW: USER HIGHLIGHTS (v4.0)';
  }
}

function toggleChangelogPref(checked) {
  localStorage.setItem('changelog_dismiss_v4', checked ? 'true' : 'false');
}

let changelogAutoShown = false;
function checkAutoShowChangelog() {
  if (changelogAutoShown) return;
  const dismissed = localStorage.getItem('changelog_dismiss_v4');
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
      let retryData;
      try {
        retryData = await retry.json();
      } catch {
        retryData = { success: retry.ok, status: retry.status };
      }
      if (retryData && typeof retryData === 'object' && !retryData.data) {
        retryData.data = { ...retryData };
      }
      return retryData;
    }

    // Capture and index server ETag
    const responseETag = res.headers.get('ETag');
    if (responseETag) {
      eTags.set(path, responseETag);
    }

    let data;
    try {
      data = await res.json();
    } catch {
      data = { success: res.ok, status: res.status };
    }

    if (data && typeof data === 'object') {
      if (!data.data) data.data = { ...data };
      if (data.departments && !data.data.departments) data.data.departments = data.departments;
      if (data.holidays && !data.data.holidays) data.data.holidays = data.holidays;
      if (data.leaveTypes && !data.data.leaveTypes) data.data.leaveTypes = data.leaveTypes;
      if (data.leave_types && !data.data.leave_types) data.data.leave_types = data.leave_types;
      if (data.shifts && !data.data.shifts) data.data.shifts = data.shifts;
      if (data.configs && !data.data.department_shifts) data.data.department_shifts = data.configs;
      if (data.policies && !data.data.department_shifts) data.data.department_shifts = data.policies;
      if (data.entries && !data.data.entries) data.data.entries = data.entries;
      if (data.divisions && !data.data.divisions) data.data.divisions = data.divisions;
      if (data.cost_centers && !data.data.cost_centers) data.data.cost_centers = data.cost_centers;
      if (data.designations && !data.data.designations) data.data.designations = data.designations;
      if (data.branches && !data.data.branches) data.data.branches = data.branches;
      if (data.companies && !data.data.companies) data.data.companies = data.companies;
    }

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

async function api(path, opts = {}) {
  let url = path;
  if (!url.startsWith('/api/') && url !== '/api') {
    url = '/api' + (url.startsWith('/') ? url : '/' + url);
  }
  const fetchOpts = { ...opts };
  if (fetchOpts.body && typeof fetchOpts.body === 'object') {
    fetchOpts.body = JSON.stringify(fetchOpts.body);
  }
  return apiFetch(url, fetchOpts);
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

window.api = api;
window.apiFetch = apiFetch;
window.apiGet = apiGet;
window.apiPost = apiPost;
window.apiPut = apiPut;
window.apiDelete = apiDelete;
