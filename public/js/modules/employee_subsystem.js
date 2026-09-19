
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
