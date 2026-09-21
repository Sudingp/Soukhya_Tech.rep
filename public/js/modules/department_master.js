// ══════════════════════════════════════════════
// Public Holiday Management Functions
// ══════════════════════════════════════════════

function openAddHolidayModal() {
  const year = document.getElementById('ph-year-select')?.value || '2026';
  document.getElementById('hf-form-title').textContent = 'Add Public Holiday';
  document.getElementById('hf-id').value = '';
  document.getElementById('hf-title').value = '';
  document.getElementById('hf-date').value = `${year}-01-01`;
  document.getElementById('hf-type').value = 'MANDATORY';
  document.getElementById('hf-state').value = 'Karnataka';
  document.getElementById('hf-location').value = 'All Locations';
  document.getElementById('hf-desc').value = 'Official Gazetted Holiday under N.I. Act';

  const modal = document.getElementById('holiday-form-modal');
  if (modal) modal.style.display = 'flex';
}

function openEditHolidayModal(id) {
  const h = cachedPublicHolidays.find(item => item.id === id);
  if (!h) return;

  document.getElementById('hf-form-title').textContent = 'Edit Public Holiday';
  document.getElementById('hf-id').value = h.id;
  document.getElementById('hf-title').value = h.title;
  document.getElementById('hf-date').value = h.holiday_date;
  document.getElementById('hf-type').value = h.holiday_type;
  document.getElementById('hf-state').value = h.state || 'Karnataka';
  document.getElementById('hf-location').value = h.location || 'All Locations';
  document.getElementById('hf-desc').value = h.description || '';

  const modal = document.getElementById('holiday-form-modal');
  if (modal) modal.style.display = 'flex';
}

function closeHolidayFormModal() {
  const modal = document.getElementById('holiday-form-modal');
  if (modal) modal.style.display = 'none';
}

async function saveHolidayForm(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('hf-id').value;
  const title = document.getElementById('hf-title').value.trim();
  const holiday_date = document.getElementById('hf-date').value;
  const holiday_type = document.getElementById('hf-type').value;
  const state = document.getElementById('hf-state').value.trim();
  const location = document.getElementById('hf-location').value.trim();
  const description = document.getElementById('hf-desc').value.trim();

  if (!title || !holiday_date) {
    notify('Holiday title and date are required.', 'wn');
    return;
  }

  const payload = { title, holiday_date, holiday_type, state, location, description };

  try {
    let res;
    if (id) {
      res = await api(`/public-holidays/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      res = await api('/public-holidays', { method: 'POST', body: JSON.stringify(payload) });
    }

    if (res && res.success) {
      notify(`Public Holiday "${title}" saved successfully!`, 'ok');
      closeHolidayFormModal();
      await loadPublicHolidays();
    } else {
      notify(`Failed to save public holiday: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error saving holiday: ${err.message}`, 'er');
  }
}

async function deleteHolidayPrompt(id, title) {
  if (!confirm(`Are you sure you want to delete public holiday "${title}"?`)) {
    return;
  }

  try {
    const res = await api(`/public-holidays/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      notify(`Holiday "${title}" removed.`, 'ok');
      await loadPublicHolidays();
    } else {
      notify(`Could not delete holiday: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error deleting holiday: ${err.message}`, 'er');
  }
}

async function importKarnatakaGazetteHolidays() {
  const yearSelect = document.getElementById('ph-year-select');
  const year = parseInt(yearSelect ? yearSelect.value : '2026', 10);

  if (!confirm(`Import official Karnataka State Gazetted Public Holidays for year ${year}? (Reference: india.gov.in Karnataka Gazette Calendar)`)) {
    return;
  }

  try {
    const res = await api('/public-holidays/import-karnataka', {
      method: 'POST',
      body: JSON.stringify({ year })
    });

    if (res && res.success) {
      notify(`Karnataka Gazetted Holidays (${res.data?.count || 21} holidays) imported / verified successfully!`, 'ok');
      await loadPublicHolidays();
    } else {
      notify(`Import failed: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error importing Karnataka holidays: ${err.message}`, 'er');
  }
}

async function syncHolidaysWithShiftCalendar() {
  const yearSelect = document.getElementById('ph-year-select');
  const year = parseInt(yearSelect ? yearSelect.value : '2026', 10);

  if (!confirm(`Synchronize all Public Holidays for year ${year} into the Shift Calendar as official HOLIDAY overrides?`)) {
    return;
  }

  try {
    const res = await api('/public-holidays/sync-calendar', {
      method: 'POST',
      body: JSON.stringify({ year, overwrite_workdays: true })
    });

    if (res && res.success) {
      notify(`Synchronized ${res.data?.days_synced || 0} holidays into the Shift Calendar!`, 'ok');
    } else {
      notify(`Sync failed: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error syncing holidays: ${err.message}`, 'er');
  }
}

// Window exports for Organization subsystem
window.openDepartmentsModal = openDepartmentsModal;
window.closeDepartmentsModal = closeDepartmentsModal;
window.loadDepartments = loadDepartments;
window.openAddDepartmentModal = openAddDepartmentModal;
window.openEditDepartmentModal = openEditDepartmentModal;
window.closeDeptFormModal = closeDeptFormModal;
window.saveDepartmentForm = saveDepartmentForm;
window.deleteDepartmentPrompt = deleteDepartmentPrompt;

window.openDeptShiftsModal = openDeptShiftsModal;
window.closeDeptShiftsModal = closeDeptShiftsModal;
window.loadDeptShifts = loadDeptShifts;
window.saveDeptShiftPolicy = saveDeptShiftPolicy;
window.applyDeptShiftsToEmployees = applyDeptShiftsToEmployees;

window.openPublicHolidaysModal = openPublicHolidaysModal;
window.closePublicHolidaysModal = closePublicHolidaysModal;
window.loadPublicHolidays = loadPublicHolidays;
window.filterHolidaysTable = filterHolidaysTable;
window.openAddHolidayModal = openAddHolidayModal;
window.openEditHolidayModal = openEditHolidayModal;
window.closeHolidayFormModal = closeHolidayFormModal;
window.saveHolidayForm = saveHolidayForm;
window.deleteHolidayPrompt = deleteHolidayPrompt;
window.importKarnatakaGazetteHolidays = importKarnatakaGazetteHolidays;
window.syncHolidaysWithShiftCalendar = syncHolidaysWithShiftCalendar;
