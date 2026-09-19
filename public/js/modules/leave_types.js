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
