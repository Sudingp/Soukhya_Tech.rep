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