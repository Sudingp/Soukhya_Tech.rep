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
    const depts = res?.departments || res?.data?.departments || (Array.isArray(res) ? res : []);
    if (res && res.success && Array.isArray(depts)) {
      cachedDepartments = depts;
      window.cachedDepartments = depts;
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
            👥 ${d.employee_count || d.headcount || 0}
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
    let emps = (window.state && window.state.employees) || window.EMP || [];
    if (!emps || emps.length === 0) {
      const res = await api('/employees?size=500');
      emps = res?.employees || res?.data?.employees || [];
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
    let shifts = (window.activeShiftsCache && window.activeShiftsCache.length) ? window.activeShiftsCache : [];
    if (shifts.length === 0) {
      const sRes = await api('/shifts');
      const shiftsList = sRes?.shifts || sRes?.data?.shifts || (Array.isArray(sRes) ? sRes : []);
      if (sRes && sRes.success && Array.isArray(shiftsList)) {
        shifts = shiftsList;
        window.activeShiftsCache = shiftsList;
      }
    }

    const res = await api('/department-shifts');
    const deptShifts = res?.department_shifts || res?.configs || res?.policies || res?.data?.department_shifts || [];
    if (res && res.success && Array.isArray(deptShifts)) {
      cachedDeptShifts = deptShifts;
      window.cachedDeptShifts = deptShifts;
      renderDeptShiftsTable(cachedDeptShifts, shifts);
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
          <div style="font-size:10.5px; color:var(--mu); font-family:var(--mo)">Code: ${escapeHtml(ds.dept_code)} · <strong style="color:#60a5fa">👥 ${Number(ds.employee_count || 0).toLocaleString("en-IN")} Emps</strong></div>
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
    const holidays = res?.holidays || res?.data?.holidays || (Array.isArray(res) ? res : []);
    if (res && res.success && Array.isArray(holidays)) {
      cachedPublicHolidays = holidays;
      window.cachedPublicHolidays = holidays;
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