// ══════════════════════════════════════════════
// Expose global window variables/triggers
// ══════════════════════════════════════════════
window.generateMonthlyReport = generateMonthlyReport;
window.findInReport = findInReport;
window.showSubTab = showSubTab;
window.renderDbdGrid = renderDbdGrid;
window.setupAutoRefresh = setupAutoRefresh;
window.manualRefreshDbd = manualRefreshDbd;
window.goToReportsMenu = goToReportsMenu;
window.doLogOff = doLogOff;
window.openMenuDrawer = openMenuDrawer;
window.toggleHibFields = toggleHibFields;
window.toggleOptionalFormFields = toggleOptionalFormFields;
window.toggleEmployeeDetails = toggleEmployeeDetails;
window.filterEmpDirectory = filterEmpDirectory;
window.deleteEmployee = deleteEmployee;
window.resetSeedDatabase = resetSeedDatabase;
window.showTab = showTab;
window.startRegCam = startRegCam;
window.doRegister = doRegister;
window.startAttCam = startAttCam;
window.stopAttCam = stopAttCam;
window.filt = filt;
window.clrFilt = clrFilt;
window.exportCSV = exportCSV;

window.openEmpModal = openEmpModal;
window.closeEmpModal = closeEmpModal;
window.saveEmpModal = saveEmpModal;
window.toggleModalHibFields = toggleModalHibFields;
window.syncAllDevices = syncAllDevices;
window.unsyncAllDevices = unsyncAllDevices;
window.showLeaveSummary = showLeaveSummary;
window.showShiftDetails = showShiftDetails;
window.showOtherDetails = showOtherDetails;
window.showPayDetails = showPayDetails;
window.toggleEmployeePhoto = toggleEmployeePhoto;
window.enrollFinger = enrollFinger;
window.closeInfoDrawer = closeInfoDrawer;

// Registration form helpers
window.toggleRegHibFields = toggleRegHibFields;
window.resetRegForm = resetRegForm;
window.syncRegFormDevices = syncRegFormDevices;
window.unsyncRegFormDevices = unsyncRegFormDevices;

// Company List helpers
window.loadCompaniesFromAPI = loadCompaniesFromAPI;
window.renderCompanyGrid = renderCompanyGrid;
window.sortCompanies = sortCompanies;
window.updateCompanyPagination = updateCompanyPagination;
window.prevCompanyPage = prevCompanyPage;
window.nextCompanyPage = nextCompanyPage;
window.openAddCompanyModal = openAddCompanyModal;
window.openEditCompanyModal = openEditCompanyModal;
window.closeCompanyModal = closeCompanyModal;
window.saveCompanyModal = saveCompanyModal;
window.deleteCompanyItem = deleteCompanyItem;
window.updateCompanySelects = updateCompanySelects;

// Employee List Grid helpers
window.renderEmployeeGrid = renderEmployeeGrid;
window.filterEmployeeGrid = filterEmployeeGrid;
window.sortEmployeesList = sortEmployeesList;
window.updateEmpListPagination = updateEmpListPagination;
window.prevEmpListPage = prevEmpListPage;
window.nextEmpListPage = nextEmpListPage;
window.updateEmpListFilterDropdowns = updateEmpListFilterDropdowns;
window.showEmployeePhoto = showEmployeePhoto;
window.deleteEmployeeList = deleteEmployeeList;

// Auth & User Management helpers
window.handleLoginFormSubmit = handleLoginFormSubmit;
window.fillPresetCredentials = fillPresetCredentials;
window.promptSwitchMode = promptSwitchMode;
window.closeSwitchModeModal = closeSwitchModeModal;
window.presetSwitchForm = presetSwitchForm;
window.doSwitchMode = doSwitchMode;
window.openUserMgmtModal = openUserMgmtModal;
window.closeUserMgmtModal = closeUserMgmtModal;
window.loadSystemUsers = loadSystemUsers;
window.createSystemUser = createSystemUser;
window.resetUserPasswordPrompt = resetUserPasswordPrompt;
window.deleteUserPrompt = deleteUserPrompt;
window.openChangelogModal = openChangelogModal;
window.closeChangelogModal = closeChangelogModal;
window.switchChangelogTab = switchChangelogTab;
window.toggleChangelogPref = toggleChangelogPref;

// Master Settings Modal Helpers (deferred — defined in shift_master.js loaded later)
document.addEventListener('DOMContentLoaded', () => {
  if (typeof openMasterSettingsModal === 'function') window.openMasterSettingsModal = openMasterSettingsModal;
  if (typeof closeMasterSettingsModal === 'function') window.closeMasterSettingsModal = closeMasterSettingsModal;
  if (typeof switchMasterSettingsTab === 'function') window.switchMasterSettingsTab = switchMasterSettingsTab;
  if (typeof saveMasterSettings === 'function') window.saveMasterSettings = saveMasterSettings;
  if (typeof resetMasterSettingsDefaults === 'function') window.resetMasterSettingsDefaults = resetMasterSettingsDefaults;
});

// Shift Details Modal Helpers
window.openShiftDetailsModal = openShiftDetailsModal;
window.closeShiftDetailsModal = closeShiftDetailsModal;
window.loadShiftsList = loadShiftsList;
window.renderShiftsTable = renderShiftsTable;
window.openAddShiftModal = openAddShiftModal;
window.openEditShiftModal = openEditShiftModal;
window.closeShiftFormModal = closeShiftFormModal;
window.saveShiftForm = saveShiftForm;
window.deleteShiftPrompt = deleteShiftPrompt;

// ══════════════════════════════════════════════
// ⏱️ SHIFT DETAILS CONTROLLER
// ══════════════════════════════════════════════
let activeShiftsCache = [];

async function openShiftDetailsModal() {
  const modal = document.getElementById('shift-details-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  await loadShiftsList();
}

function closeShiftDetailsModal() {
  const modal = document.getElementById('shift-details-modal');
  if (modal) modal.style.display = 'none';
}

async function loadShiftsList() {
  const tbody = document.getElementById('shifts-tbody');
  const countLabel = document.getElementById('shifts-count-label');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--mu)">Loading shifts...</td></tr>';

  try {
    const res = await api('/shifts');
    if (res && res.success && Array.isArray(res.data?.shifts)) {
      activeShiftsCache = res.data.shifts;
      renderShiftsTable(activeShiftsCache);
      if (countLabel) countLabel.textContent = `Total configured shifts: ${activeShiftsCache.length}`;
    } else {
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--er)">Failed to load shifts.</td></tr>';
    }
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--er)">Error: ${err.message}</td></tr>`;
  }
}

function renderShiftsTable(shifts) {
  const tbody = document.getElementById('shifts-tbody');
  if (!tbody) return;

  if (!shifts || shifts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--mu)">No active shifts configured yet. Click "+ Add New Shift" to create one.</td></tr>';
    return;
  }

  tbody.innerHTML = shifts.map(s => {
    const formatTime = (t) => t ? String(t).slice(0, 5) : '--:--';
    const color = s.color || '#00d4aa';
    return `
      <tr style="border-bottom:1px solid var(--br); transition:background 0.15s">
        <td style="padding:10px">
          <span class="shift-code-badge" style="background:${color}20; color:${color}; border:1px solid ${color}40">
            <span class="shift-dot" style="background:${color}"></span>
            ${escapeHtml(s.code)}
          </span>
        </td>
        <td style="padding:10px; font-weight:600; color:var(--tx)">
          ${escapeHtml(s.name)}
        </td>
        <td style="padding:10px; text-align:center">
          <span class="shift-time-pill">${formatTime(s.start_time)} – ${formatTime(s.end_time)}</span>
        </td>
        <td style="padding:10px; text-align:center; color:var(--mu)">
          ${s.break_mins ? `${s.break_mins}m` : 'None'}
          ${s.break_start ? `<span style="font-size:10px; display:block">(${formatTime(s.break_start)} - ${formatTime(s.break_end)})</span>` : ''}
        </td>
        <td style="padding:10px; text-align:center; color:var(--ac)">
          +${s.late_grace_mins || 0}m
        </td>
        <td style="padding:10px; text-align:center">
          ${s.is_night_shift ? '<span class="status-badge" style="background:#a855f720; color:#a855f7; border:1px solid #a855f740">🌙 Overnight</span>' : '<span style="color:var(--mu)">Day</span>'}
        </td>
        <td style="padding:10px; text-align:right; white-space:nowrap">
          <button class="btn bsm" onclick="openEditShiftModal('${s.id}')" style="padding:3px 8px; font-size:11px">Edit</button>
          <button class="btn bsm" onclick="deleteShiftPrompt('${s.id}', '${s.code}')" style="padding:3px 8px; font-size:11px; color:var(--er); border-color:rgba(255,75,75,0.3)">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddShiftModal() {
  document.getElementById('shift-form-title').textContent = 'Add New Shift';
  document.getElementById('sf-id').value = '';
  document.getElementById('sf-code').value = '';
  document.getElementById('sf-code').disabled = false;
  document.getElementById('sf-name').value = '';
  document.getElementById('sf-start_time').value = '09:00';
  document.getElementById('sf-end_time').value = '18:00';
  document.getElementById('sf-break_start').value = '13:00';
  document.getElementById('sf-break_end').value = '14:00';
  document.getElementById('sf-break_mins').value = '60';
  document.getElementById('sf-early_in_mins').value = '30';
  document.getElementById('sf-late_grace_mins').value = '15';
  document.getElementById('sf-early_out_mins').value = '15';
  document.getElementById('sf-min_full_day_hrs').value = '8.0';
  document.getElementById('sf-min_half_day_hrs').value = '4.0';
  document.getElementById('sf-is_night_shift').checked = false;
  document.getElementById('sf-color').value = '#00d4aa';
  document.getElementById('sf-color-preview').textContent = '#00d4aa';

  document.getElementById('shift-form-modal').style.display = 'flex';
}

function openEditShiftModal(id) {
  const shift = activeShiftsCache.find(s => s.id === id);
  if (!shift) return;

  document.getElementById('shift-form-title').textContent = 'Edit Shift — ' + shift.code;
  document.getElementById('sf-id').value = shift.id;
  document.getElementById('sf-code').value = shift.code;
  document.getElementById('sf-code').disabled = true;
  document.getElementById('sf-name').value = shift.name;
  document.getElementById('sf-start_time').value = String(shift.start_time).slice(0, 5);
  document.getElementById('sf-end_time').value = String(shift.end_time).slice(0, 5);
  document.getElementById('sf-break_start').value = shift.break_start ? String(shift.break_start).slice(0, 5) : '';
  document.getElementById('sf-break_end').value = shift.break_end ? String(shift.break_end).slice(0, 5) : '';
  document.getElementById('sf-break_mins').value = shift.break_mins || 60;
  document.getElementById('sf-early_in_mins').value = shift.early_in_mins || 30;
  document.getElementById('sf-late_grace_mins').value = shift.late_grace_mins || 15;
  document.getElementById('sf-early_out_mins').value = shift.early_out_mins || 15;
  document.getElementById('sf-min_full_day_hrs').value = shift.min_full_day_hrs || 8.0;
  document.getElementById('sf-min_half_day_hrs').value = shift.min_half_day_hrs || 4.0;
  document.getElementById('sf-is_night_shift').checked = !!shift.is_night_shift;
  const col = shift.color || '#00d4aa';
  document.getElementById('sf-color').value = col;
  document.getElementById('sf-color-preview').textContent = col;

  document.getElementById('shift-form-modal').style.display = 'flex';
}

function closeShiftFormModal() {
  const modal = document.getElementById('shift-form-modal');
  if (modal) modal.style.display = 'none';
}

async function saveShiftForm(event) {
  if (event) event.preventDefault();

  const id = document.getElementById('sf-id').value.trim();
  const code = document.getElementById('sf-code').value.trim().toUpperCase();
  const name = document.getElementById('sf-name').value.trim();
  const start_time = document.getElementById('sf-start_time').value;
  const end_time = document.getElementById('sf-end_time').value;

  if (!code || !name || !start_time || !end_time) {
    notify('Shift Code, Name, Start Time, and End Time are required.', 'wn');
    return;
  }

  const payload = {
    code,
    name,
    start_time,
    end_time,
    break_start: document.getElementById('sf-break_start').value || null,
    break_end: document.getElementById('sf-break_end').value || null,
    break_mins: parseInt(document.getElementById('sf-break_mins').value, 10) || 60,
    early_in_mins: parseInt(document.getElementById('sf-early_in_mins').value, 10) || 30,
    late_grace_mins: parseInt(document.getElementById('sf-late_grace_mins').value, 10) || 15,
    early_out_mins: parseInt(document.getElementById('sf-early_out_mins').value, 10) || 15,
    min_full_day_hrs: parseFloat(document.getElementById('sf-min_full_day_hrs').value) || 8.0,
    min_half_day_hrs: parseFloat(document.getElementById('sf-min_half_day_hrs').value) || 4.0,
    is_night_shift: !!document.getElementById('sf-is_night_shift').checked,
    color: document.getElementById('sf-color').value || '#00d4aa'
  };

  const saveBtn = document.getElementById('sf-save-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }

  try {
    let res;
    if (id) {
      res = await api(`/shifts/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      res = await api('/shifts', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    if (res && res.success) {
      notify(`Shift "${name}" saved successfully!`, 'ok');
      closeShiftFormModal();
      await loadShiftsList();
    } else {
      notify(`Error saving shift: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Failed to save shift: ${err.message}`, 'er');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Shift';
    }
  }
}

async function deleteShiftPrompt(id, code) {
  if (!confirm(`Are you sure you want to delete shift "${code}"?`)) return;

  try {
    const res = await api(`/shifts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res && res.success) {
      notify(`Shift "${code}" deleted successfully.`, 'ok');
      await loadShiftsList();
    } else {
      notify(`Failed to delete shift: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error deleting shift: ${err.message}`, 'er');
  }
}

// Color picker listener
document.addEventListener('DOMContentLoaded', () => {
  const colPicker = document.getElementById('sf-color');
  const colPrev = document.getElementById('sf-color-preview');
  if (colPicker && colPrev) {
    colPicker.addEventListener('input', () => {
      colPrev.textContent = colPicker.value;
    });
  }
});
