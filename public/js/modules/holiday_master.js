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
            👥 ${t.employee_count || t.headcount || 0}
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
            👥 ${g.member_count || g.members_count || 0} Members
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