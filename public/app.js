// app.js ‚Äî Hardened Frontend with JWT auth, XSS prevention, PII masking
const API = '/api';
let AUTH = null;

// ‚îÄ‚îÄ Auth ‚îÄ‚îÄ
async function doLogin() {
  const u = document.getElementById('login-user').value;
  const p = document.getElementById('login-pass').value;
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username:u,password:p})
  });
  const data = await res.json();
  if (data.success) {
    AUTH = { token: data.access_token, refresh: data.refresh_token, role: data.role, username: data.username };
    localStorage.setItem('auth', JSON.stringify(AUTH));
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-shell').style.display = 'block';
    showView('dashboard');
  } else {
    document.getElementById('login-error').textContent = data.error?.message || 'Login failed';
  }
}

function doLogOff() {
  localStorage.removeItem('auth');
  AUTH = null;
  location.reload();
}

function getAuth() {
  if (!AUTH) AUTH = JSON.parse(localStorage.getItem('auth') || 'null');
  return AUTH;
}

async function apiFetch(path, opts = {}) {
  const auth = getAuth();
  const headers = {
    'Content-Type': 'application/json',
    ...(auth ? { 'Authorization': `Bearer ${auth.token}` } : {})
  };
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...headers, ...opts.headers } });
  if (res.status === 401) { doLogOff(); throw new Error('Session expired'); }
  return res;
}

// ‚îÄ‚îÄ Safe DOM ‚îÄ‚îÄ
function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function showView(view) {
  const main = document.getElementById('main-content');
  main.innerHTML = '';
  if (view === 'dashboard') renderDashboard(main);
  if (view === 'employees') renderEmployees(main);
  if (view === 'attendance') renderAttendance(main);
}

// ‚îÄ‚îÄ Dashboard ‚îÄ‚îÄ
async function renderDashboard(container) {
  const res = await apiFetch('/stats');
  const d = (await res.json());
  if (!d.success) return;
  const s = d;
  container.appendChild(el('h2', 'Dashboard'));
  const grid = el('div', null, 'dashboard-grid');
  const stats = [
    ['Total Employees', s.total_employees], ['Present Today', s.present_today],
    ['Late Today', s.late_today], ['Active %', s.active_percent + '%']
  ];
  stats.forEach(([label, val]) => {
    const card = el('div', null, 'stat-card');
    card.appendChild(el('h3', label));
    card.appendChild(el('p', String(val)));
    grid.appendChild(card);
  });
  container.appendChild(grid);
}

// ‚îÄ‚îÄ Employees (masked PII for non-admin) ‚îÄ‚îÄ
async function renderEmployees(container) {
  container.appendChild(el('h2', 'Employees'));
  const isAdmin = getAuth()?.role === 'ADMIN' || getAuth()?.role === 'HR';
  const res = await apiFetch('/employees?page=1&size=50');
  const data = await res.json();
  if (!data.success) return;
  const table = document.createElement('table');
  table.innerHTML = `<tr><th>ID</th><th>Name</th><th>Dept</th><th>Role</th><th>Status</th><th>Phone</th><th>Aadhaar</th></tr>`;
  data.employees.forEach(e => {
    const tr = document.createElement('tr');
    const phone = isAdmin ? (e.phone_no || '-') : (e.phone_no ? '****' : '-');
    const aadhaar = isAdmin ? (e.aadhaar_number || '-') : (e.aadhaar_number ? 'XXXX-XXXX-####' : '-');
    tr.appendChild(el('td', e.id));
    tr.appendChild(el('td', e.name));
    tr.appendChild(el('td', e.department));
    tr.appendChild(el('td', e.role));
    tr.appendChild(el('td', e.status));
    tr.appendChild(el('td', phone));
    tr.appendChild(el('td', aadhaar));
    table.appendChild(tr);
  });
  container.appendChild(table);
}

// ‚îÄ‚îÄ Attendance ‚îÄ‚îÄ
async function renderAttendance(container) {
  container.appendChild(el('h2', 'Attendance Records'));
  const res = await apiFetch('/attendance?page=1&size=20');
  const data = await res.json();
  if (!data.success) return;
  const list = el('ul', null, 'attendance-list');
  data.records.forEach(r => {
    const li = el('li', `${r.timestamp} ‚Äî ${r.name} (${r.status})`);
    list.appendChild(li);
  });
  container.appendChild(list);
}

// ‚îÄ‚îÄ Boot ‚îÄ‚îÄ
(function boot() {
  if (getAuth()) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-shell').style.display = 'block';
    showView('dashboard');
  }
})();