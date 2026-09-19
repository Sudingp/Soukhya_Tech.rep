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
