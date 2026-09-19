
function closeAddOtManualModal() {
  const m = document.getElementById('ot-entry-modal');
  if (m) m.style.display = 'none';
}

function autoCalculateOtDiff() {
  const sched = parseFloat(document.getElementById('otm-sched-hrs')?.value || 8.0);
  const actual = parseFloat(document.getElementById('otm-actual-hrs')?.value || 8.0);
  const ot = Math.max(0, Math.round((actual - sched) * 10) / 10);
  const otEl = document.getElementById('otm-ot-hrs');
  if (otEl) otEl.value = ot.toFixed(1);
}

async function saveOtManualEntry(event) {
  if (event) event.preventDefault();
  const emp_id = document.getElementById('otm-emp-id')?.value;
  const ot_date = document.getElementById('otm-date')?.value;
  const shift_id = document.getElementById('otm-shift')?.value || 'SHIFT_GEN';
  const scheduled_hours = parseFloat(document.getElementById('otm-sched-hrs')?.value || 8.0);
  const actual_hours = parseFloat(document.getElementById('otm-actual-hrs')?.value || 8.0);
  const ot_hours = parseFloat(document.getElementById('otm-ot-hrs')?.value || 0.0);
  const ot_multiplier = parseFloat(document.getElementById('otm-multiplier')?.value || 1.5);
  const ot_rate_type = document.getElementById('otm-rate-type')?.value || 'STANDARD_DAY';
  const comments = document.getElementById('otm-comments')?.value.trim() || null;

  if (!emp_id) {
    notify('Please select an employee', 'wn');
    return;
  }
  if (!ot_date) {
    notify('Please select an OT date', 'wn');
    return;
  }

  const payload = {
    emp_id,
    ot_date,
    shift_id,
    scheduled_hours,
    actual_hours,
    ot_hours,
    ot_multiplier,
    ot_rate_type,
    status: 'PENDING',
    comments
  };

  try {
    const res = await api('/ot-register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res && res.success) {
      notify('Overtime record submitted successfully!', 'ok');
      closeAddOtManualModal();
      await loadOtRegisterGrid(1);
    } else {
      notify(`Failed to save OT entry: ${res?.error?.message || 'Error'}`, 'er');
    }
  } catch (err) {
    notify(`Error saving OT entry: ${err.message}`, 'er');
  }
}

function openOtAutoCalcModal() {
  const m = document.getElementById('ot-calc-modal');
  if (!m) return;
  m.style.display = 'flex';
  document.getElementById('ot-calc-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('ot-calc-threshold').value = '8.0';
  const box = document.getElementById('ot-calc-result-box');
  if (box) box.style.display = 'none';
}

function closeOtAutoCalcModal() {
  const m = document.getElementById('ot-calc-modal');
  if (m) m.style.display = 'none';
}

async function runOtAutoCalculation() {
  const date = document.getElementById('ot-calc-date')?.value;
  const threshold_hours = parseFloat(document.getElementById('ot-calc-threshold')?.value || 8.0);
  const box = document.getElementById('ot-calc-result-box');

  if (!date) {
    notify('Please select a calculation date', 'wn');
    return;
  }

  if (box) {
    box.style.display = 'block';
    box.innerHTML = '<span style="color:var(--mu)">Calculating daily overtime spans...</span>';
  }

  try {
    const res = await api('/ot-register/calculate', {
      method: 'POST',
      body: JSON.stringify({ date, threshold_hours })
    });

    if (res && res.success) {
      const d = res.data;
      if (box) {
        box.innerHTML = `
          <div style="color:var(--ok); font-weight:700; margin-bottom:4px">✓ Auto-Calculation Complete</div>
          <div>Date: <strong>${d.date}</strong> (${d.rate_type} - ${d.multiplier}x)</div>
          <div>Generated OT Records: <strong>${d.generated_count}</strong></div>
        `;
      }
      notify(`Generated ${d.generated_count} OT records for ${d.date}!`, 'ok');
      await loadOtRegisterGrid(1);
    } else {
      if (box) box.innerHTML = `<span style="color:var(--er)">Calculation failed: ${res?.error?.message}</span>`;
    }
  } catch (err) {
    if (box) box.innerHTML = `<span style="color:var(--er)">Error: ${err.message}</span>`;
  }
}

// Window exports for Attendance & Time
window.openAttendanceLogModal = openAttendanceLogModal;
window.closeAttendanceLogModal = closeAttendanceLogModal;
window.loadAttendanceLogStats = loadAttendanceLogStats;
window.loadAttendanceLogGrid = loadAttendanceLogGrid;
window.resetAttendanceLogFilters = resetAttendanceLogFilters;
window.exportAttendanceLogCsv = exportAttendanceLogCsv;
window.openRegularizeAttendanceModal = openRegularizeAttendanceModal;
window.closeRegularizeAttendanceModal = closeRegularizeAttendanceModal;
window.saveRegularizeAttendance = saveRegularizeAttendance;

window.openGeofencesModal = openGeofencesModal;
window.closeGeofencesModal = closeGeofencesModal;
window.loadGeofencesList = loadGeofencesList;
window.openAddGeofenceModal = openAddGeofenceModal;
window.openEditGeofenceModal = openEditGeofenceModal;
window.closeGeofenceFormModal = closeGeofenceFormModal;
window.saveGeofenceForm = saveGeofenceForm;
window.deleteGeofenceAction = deleteGeofenceAction;
window.openTestCoordsModal = openTestCoordsModal;
window.closeTestCoordsModal = closeTestCoordsModal;
window.setTestCoordPreset = setTestCoordPreset;
window.runGeofenceVerificationTest = runGeofenceVerificationTest;

window.openWorkCodesModal = openWorkCodesModal;
window.closeWorkCodesModal = closeWorkCodesModal;
window.loadWorkCodesList = loadWorkCodesList;
window.openAddWorkCodeModal = openAddWorkCodeModal;
window.openEditWorkCodeModal = openEditWorkCodeModal;
window.closeWorkCodeFormModal = closeWorkCodeFormModal;
window.saveWorkCodeForm = saveWorkCodeForm;
window.deleteWorkCodeAction = deleteWorkCodeAction;

window.openOtRegisterModal = openOtRegisterModal;
window.closeOtRegisterModal = closeOtRegisterModal;
window.loadOtRegisterGrid = loadOtRegisterGrid;
window.toggleSelectAllOtRecords = toggleSelectAllOtRecords;
window.resetOtFilters = resetOtFilters;
window.approveSingleOtRecord = approveSingleOtRecord;
window.rejectSingleOtRecord = rejectSingleOtRecord;
window.compOffSingleOtRecord = compOffSingleOtRecord;
window.updateOtStatusAction = updateOtStatusAction;
window.bulkApproveSelectedOt = bulkApproveSelectedOt;
window.deleteOtRecordAction = deleteOtRecordAction;
window.openAddOtManualModal = openAddOtManualModal;
window.closeAddOtManualModal = closeAddOtManualModal;
window.autoCalculateOtDiff = autoCalculateOtDiff;
window.saveOtManualEntry = saveOtManualEntry;
window.openOtAutoCalcModal = openOtAutoCalcModal;
window.closeOtAutoCalcModal = closeOtAutoCalcModal;
window.runOtAutoCalculation = runOtAutoCalculation;

// ══════════════════════════════════════════════
// 🏥 1. LEAVE TYPES MASTER (ORGANIZATION)
// ══════════════════════════════════════════════
let cachedLeaveTypes = [];
let isEditingLeaveType = false;
let editingLeaveTypeId = null;

async function openLeaveTypesModal() {
  const modal = document.getElementById('leave-types-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  await loadLeaveTypesGrid();
}

function closeLeaveTypesModal() {
  const modal = document.getElementById('leave-types-modal');
  if (modal) modal.style.display = 'none';
}

async function loadLeaveTypesGrid() {
  const tbody = document.getElementById('leave-types-tbody');
  const countLabel = document.getElementById('lt-count-label');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--mu)">Loading statutory leave types...</td></tr>';

  try {
    const res = await api('/leave-types');
    if (res && res.success && Array.isArray(res.data?.leaveTypes)) {
      cachedLeaveTypes = res.data.leaveTypes;
      renderLeaveTypesTable(cachedLeaveTypes);
      if (countLabel) countLabel.textContent = `Total Leave Types: ${cachedLeaveTypes.length} (Statutory & Custom)`;
    } else {
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--er)">Failed to load leave types.</td></tr>';
    }
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--er)">Error: ${err.message}</td></tr>`;
  }
}

function renderLeaveTypesTable(types) {
  const tbody = document.getElementById('leave-types-tbody');
  if (!tbody) return;

  if (!types || types.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--mu)">No leave types configured. Click "+ Add Leave Type" to create one.</td></tr>';
    return;
  }

  tbody.innerHTML = types.map(lt => {
    const statusBadge = lt.active ? 
      '<span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); font-size:10px; padding:2px 6px">Active</span>' : 
      '<span class="badge" style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); font-size:10px; padding:2px 6px">Inactive</span>';

    const paidBadge = lt.paid ?
      '<span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; font-size:10.5px">Paid</span>' :
      '<span class="badge" style="background:rgba(239,68,68,0.15); color:#ef4444; font-size:10.5px">Unpaid</span>';

    const encashBadge = lt.encashable ?
      '<span class="badge" style="background:rgba(59,130,246,0.15); color:#60a5fa; font-size:10.5px">Yes</span>' :
      '<span class="badge" style="background:rgba(107,118,145,0.15); color:var(--mu); font-size:10.5px">No</span>';

    const colorDot = `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${escapeHtml(lt.color || '#00d4aa')}; margin-right:6px"></span>`;

    return `
      <tr style="border-bottom:1px solid var(--br); transition:background 0.15s">
        <td style="padding:10px">
          <span style="font-weight:700; font-family:var(--mo); color:var(--ac); background:rgba(0,212,170,0.08); padding:3px 8px; border-radius:4px; border:1px solid rgba(0,212,170,0.2)">
            ${escapeHtml(lt.code)}
          </span>
        </td>
        <td style="padding:10px; font-weight:600; color:var(--tx)">
          ${colorDot}${escapeHtml(lt.name)} ${statusBadge}
        </td>
        <td style="padding:10px; color:var(--mu); font-size:11px">
          <span class="badge" style="background:rgba(124,58,237,0.15); color:#a78bfa; font-size:10.5px">${escapeHtml(lt.category)}</span>
        </td>
        <td style="padding:10px; text-align:center">${paidBadge}</td>
        <td style="padding:10px; text-align:center; font-weight:700; color:var(--tx)">
          ${lt.annual_quota_days} days
        </td>
        <td style="padding:10px; text-align:center; font-weight:600; color:var(--tx)">
          ${lt.carry_forward_max ? `${lt.carry_forward_max}d` : '<span style="color:var(--mu)">0d</span>'}
        </td>
        <td style="padding:10px; text-align:center">${encashBadge}</td>
        <td style="padding:10px; text-align:right">
          <button class="btn bsm" style="font-size:11px; padding:2px 8px; margin-right:4px" onclick="openEditLeaveTypeModal('${escapeHtml(lt.id)}')">✏️ Edit</button>
          <button class="btn bsm" style="font-size:11px; padding:2px 8px; color:var(--err); border-color:var(--err)" onclick="deleteLeaveTypeAction('${escapeHtml(lt.id)}', '${escapeHtml(lt.name)}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddLeaveTypeModal() {
  isEditingLeaveType = false;
  editingLeaveTypeId = null;
  const form = document.getElementById('leave-type-form');
  if (form) form.reset();
  const title = document.getElementById('lt-form-title');
  if (title) title.textContent = 'Add Statutory Leave Type';
  document.getElementById('lt-color').value = '#00d4aa';
  document.getElementById('lt-active').checked = true;
  document.getElementById('lt-paid').checked = true;
  document.getElementById('lt-encashable').checked = false;
  document.getElementById('lt-code').disabled = false;
  const modal = document.getElementById('leave-type-form-modal');
  if (modal) modal.style.display = 'flex';
}

function openEditLeaveTypeModal(id) {
  const lt = cachedLeaveTypes.find(x => String(x.id) === String(id));
  if (!lt) return;

  isEditingLeaveType = true;
  editingLeaveTypeId = id;
  const title = document.getElementById('lt-form-title');
  if (title) title.textContent = `Edit Leave Type: ${lt.name}`;

  document.getElementById('lt-code').value = lt.code;
  document.getElementById('lt-code').disabled = true;
  document.getElementById('lt-name').value = lt.name;
  document.getElementById('lt-category').value = lt.category;
  document.getElementById('lt-description').value = lt.description || '';
  document.getElementById('lt-annual-quota').value = lt.annual_quota_days;
  document.getElementById('lt-carry-forward').value = lt.carry_forward_max || 0;
  document.getElementById('lt-color').value = lt.color || '#00d4aa';
  document.getElementById('lt-paid').checked = Boolean(lt.paid);
  document.getElementById('lt-encashable').checked = Boolean(lt.encashable);
  document.getElementById('lt-active').checked = Boolean(lt.active);

  const modal = document.getElementById('leave-type-form-modal');
  if (modal) modal.style.display = 'flex';
}

function closeLeaveTypeFormModal() {
  const modal = document.getElementById('leave-type-form-modal');
  if (modal) modal.style.display = 'none';
}

async function saveLeaveTypeForm(e) {
  if (e) e.preventDefault();
  const code = document.getElementById('lt-code').value.trim();
  const name = document.getElementById('lt-name').value.trim();
  const category = document.getElementById('lt-category').value;
  const description = document.getElementById('lt-description').value.trim();
  const annual_quota_days = parseFloat(document.getElementById('lt-annual-quota').value) || 0;
  const carry_forward_max = parseFloat(document.getElementById('lt-carry-forward').value) || 0;
  const color = document.getElementById('lt-color').value.trim() || '#00d4aa';
  const paid = document.getElementById('lt-paid').checked;
  const encashable = document.getElementById('lt-encashable').checked;
  const active = document.getElementById('lt-active').checked;

  if (!name) return notify('Leave Type Name is required.', 'warn');
  if (!code && !isEditingLeaveType) return notify('Leave Type Code is required.', 'warn');

  const payload = {
    code,
    name,
    category,
    description,
    annual_quota_days,
    carry_forward_max,
    encashable,
    paid,
    color,
    active
  };

  try {
    let res;
    if (isEditingLeaveType) {
      res = await api(`/leave-types/${editingLeaveTypeId}`, { method: 'PUT', body: payload });
    } else {
      res = await api('/leave-types', { method: 'POST', body: payload });
    }

    if (res && res.success) {
      notify(`Leave Type ${isEditingLeaveType ? 'updated' : 'created'} successfully!`, 'ok');
      closeLeaveTypeFormModal();
      await loadLeaveTypesGrid();
    } else {
      notify(res?.error?.message || 'Failed to save leave type.', 'err');
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}

async function deleteLeaveTypeAction(id, name) {
  if (!confirm(`Are you sure you want to delete leave type "${name}" (${id})?`)) return;

  try {
    const res = await api(`/leave-types/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      notify(`Leave type ${name} deleted successfully!`, 'ok');
      await loadLeaveTypesGrid();
    } else {
      notify(res?.error?.message || 'Failed to delete leave type.', 'err');
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}
