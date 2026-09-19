// ══════════════════════════════════════════════
// 📋 SHIFT ROSTER CONTROLLER
// ══════════════════════════════════════════════
let rosterSearchTimer = null;

async function openShiftRosterModal() {
  const modal = document.getElementById('shift-roster-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  // Initialize Month Picker
  const monthPicker = document.getElementById('roster-month-picker');
  if (monthPicker && !monthPicker.value) {
    const now = new Date();
    monthPicker.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  // Populate Dept and Group Filters
  try {
    const [empRes, grpRes] = await Promise.all([
      api('/employees?pageSize=500'),
      api('/shift-groups')
    ]);

    const employees = empRes?.data?.employees || [];
    const depts = Array.from(new Set(employees.map(e => e.dept || e.department).filter(Boolean)));
    const deptSelect = document.getElementById('roster-dept-filter');
    if (deptSelect) {
      deptSelect.innerHTML = '<option value="">All Departments</option>' + depts.map(d => `<option value="${d}">${d}</option>`).join('');
    }

    const groups = grpRes?.data?.groups || [];
    const grpSelect = document.getElementById('roster-group-filter');
    if (grpSelect) {
      grpSelect.innerHTML = '<option value="">All Groups</option>' + groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    }
  } catch (e) {
    console.warn('[ROSTER] Error loading filter options:', e);
  }

  await loadShiftRosterMatrix();
}

function closeShiftRosterModal() {
  const modal = document.getElementById('shift-roster-modal');
  if (modal) modal.style.display = 'none';
}

function debounceRosterSearch() {
  clearTimeout(rosterSearchTimer);
  rosterSearchTimer = setTimeout(() => {
    loadShiftRosterMatrix();
  }, 300);
}

async function loadShiftRosterMatrix() {
  const monthVal = document.getElementById('roster-month-picker')?.value || new Date().toISOString().slice(0, 7);
  const dept = document.getElementById('roster-dept-filter')?.value || '';
  const groupId = document.getElementById('roster-group-filter')?.value || '';
  const search = document.getElementById('roster-search-input')?.value?.trim() || '';

  const tbody = document.getElementById('roster-table-tbody');
  const thead = document.getElementById('roster-table-thead');
  const statsLabel = document.getElementById('roster-footer-stats');

  if (tbody) tbody.innerHTML = '<tr><td colspan="35" style="text-align:center; padding:40px; color:var(--mu)">Loading monthly roster matrix...</td></tr>';

  try {
    const query = new URLSearchParams({ month: monthVal, dept, groupId, search }).toString();
    const res = await api(`/shift-roster?${query}`);

    if (res && res.success && res.data) {
      renderShiftRosterTable(res.data);
      if (statsLabel) statsLabel.textContent = `Showing ${res.data.total_employees} employee schedules for ${res.data.month}/${res.data.year}`;
    } else {
      notify('Failed to load shift roster matrix', 'er');
    }
  } catch (err) {
    notify(`Error loading roster: ${err.message}`, 'er');
  }
}

function renderShiftRosterTable(data) {
  const thead = document.getElementById('roster-table-thead');
  const tbody = document.getElementById('roster-table-tbody');
  if (!thead || !tbody) return;

  const days = data.calendar_days || [];
  const employees = data.employees || [];

  // Header
  let headerHtml = '<tr>';
  headerHtml += '<th class="roster-emp-sticky" style="padding:8px 10px">Employee Details</th>';
  days.forEach(d => {
    const isWeekend = d.day_name === 'Sun' || d.day_name === 'Sat';
    headerHtml += `
      <th style="padding:6px 4px; min-width:34px; color:${isWeekend ? '#f59e0b' : 'inherit'}">
        <div style="font-size:11px">${d.day_number}</div>
        <div style="font-size:9px; color:var(--mu)">${d.day_name}</div>
      </th>
    `;
  });
  headerHtml += '<th style="padding:6px 8px; color:#00d4aa">Work</th>';
  headerHtml += '<th style="padding:6px 8px; color:#64748b">Off</th>';
  headerHtml += '</tr>';
  thead.innerHTML = headerHtml;

  // Body
  if (employees.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${days.length + 3}" style="text-align:center; padding:30px; color:var(--mu)">No active employees match the selected criteria.</td></tr>`;
    return;
  }

  let bodyHtml = '';
  employees.forEach(row => {
    const emp = row.employee;
    const sched = row.schedule;
    const stats = row.stats;

    bodyHtml += '<tr>';
    bodyHtml += `
      <td class="roster-emp-sticky" style="padding:6px 10px">
        <div style="display:flex; align-items:center; gap:8px">
          <div style="width:24px; height:24px; border-radius:50%; background:var(--s3); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:var(--ac); flex-shrink:0">
            ${emp.name.charAt(0)}
          </div>
          <div style="overflow:hidden">
            <div style="font-weight:600; color:var(--tx); white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${escapeHtml(emp.name)}</div>
            <div style="font-size:10px; color:var(--mu)">${emp.id} · <span style="color:var(--ac)">${escapeHtml(emp.dept || 'Staff')}</span></div>
          </div>
        </div>
      </td>
    `;

    days.forEach(d => {
      const cell = sched[d.date] || { shift_code: d.shift_code, shift_color: d.shift_color, day_type: d.day_type };
      const isOff = cell.day_type === 'WEEKLY_OFF';
      const isHol = cell.day_type === 'HOLIDAY';
      const isLeave = cell.day_type === 'LEAVE';
      const isOd = cell.day_type === 'OUTDOOR';

      let bg = cell.shift_color || '#00d4aa';
      let text = cell.shift_code || 'GEN';

      if (isOff) { bg = '#64748b'; text = 'WO'; }
      else if (isHol) { bg = '#ef4444'; text = 'HOL'; }
      else if (isLeave) { bg = '#ec4899'; text = 'LV'; }
      else if (isOd) { bg = '#8b5cf6'; text = 'OD'; }

      bodyHtml += `
        <td style="padding:4px 2px">
          <span class="roster-cell-chip" style="background:${bg}22; color:${bg}; border:1px solid ${bg}55"
                title="${escapeHtml(emp.name)} - ${d.date} (${text})\nClick to change shift"
                onclick="quickChangeRosterShift('${emp.id}', '${d.date}', '${cell.shift_id || 'SHIFT_GEN'}')">
            ${text}
          </span>
        </td>
      `;
    });

    bodyHtml += `<td style="font-weight:700; color:#00d4aa; font-family:var(--mo)">${stats.working_days}</td>`;
    bodyHtml += `<td style="font-weight:700; color:#64748b; font-family:var(--mo)">${stats.off_days}</td>`;
    bodyHtml += '</tr>';
  });

  tbody.innerHTML = bodyHtml;
}

async function quickChangeRosterShift(empId, dateStr, currentShiftId) {
  const shifts = await getCachedShifts();
  const options = [
    ...shifts.map(s => `[${s.code}] ${s.name}`),
    '[WO] Weekly Off',
    '[HOL] Public Holiday',
    '[LV] On Leave'
  ];

  const choice = prompt(`Change shift for employee ${empId} on date ${dateStr}:\nEnter option code (e.g. GEN, MOR, EVE, NIT, WO, HOL, LV):`, 'GEN');
  if (!choice) return;

  const clean = choice.trim().toUpperCase();
  let shift_id = 'SHIFT_GEN';
  let day_type = 'WORK';

  if (clean === 'WO') {
    day_type = 'WEEKLY_OFF';
  } else if (clean === 'HOL') {
    day_type = 'HOLIDAY';
  } else if (clean === 'LV') {
    day_type = 'LEAVE';
  } else {
    const matchedShift = shifts.find(s => s.code === clean || s.id === clean);
    if (matchedShift) {
      shift_id = matchedShift.id;
    } else {
      notify(`Unknown shift code "${clean}". Valid shifts: ${shifts.map(s => s.code).join(', ')}`, 'wn');
      return;
    }
  }

  try {
    const res = await api('/shift-roster/assign', {
      method: 'POST',
      body: JSON.stringify({
        emp_ids: [empId],
        start_date: dateStr,
        shift_id,
        day_type,
        note: 'Quick interactive roster update'
      })
    });

    if (res && res.success) {
      notify(`Updated shift for ${empId} on ${dateStr}`, 'ok');
      await loadShiftRosterMatrix();
    } else {
      notify(`Failed to update roster: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error assigning shift: ${err.message}`, 'er');
  }
}

// ── Auto Generate Roster Modal ──
async function openShiftRosterAutoModal() {
  const modal = document.getElementById('shift-roster-auto-modal');
  if (!modal) return;

  const currentMonthVal = document.getElementById('roster-month-picker')?.value || new Date().toISOString().slice(0, 7);
  document.getElementById('sra-month').value = currentMonthVal;

  const [empRes, grpRes] = await Promise.all([
    api('/employees?pageSize=500'),
    api('/shift-groups')
  ]);

  const employees = empRes?.data?.employees || [];
  const depts = Array.from(new Set(employees.map(e => e.dept || e.department).filter(Boolean)));
  const deptSelect = document.getElementById('sra-dept');
  if (deptSelect) {
    deptSelect.innerHTML = '<option value="">All Departments</option>' + depts.map(d => `<option value="${d}">${d}</option>`).join('');
  }

  const groups = grpRes?.data?.groups || [];
  const grpSelect = document.getElementById('sra-group');
  if (grpSelect) {
    grpSelect.innerHTML = '<option value="">All Groups</option>' + groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
  }

  modal.style.display = 'flex';
}

function closeShiftRosterAutoModal() {
  const modal = document.getElementById('shift-roster-auto-modal');
  if (modal) modal.style.display = 'none';
}

async function executeAutoGenerateRoster(event) {
  if (event) event.preventDefault();

  const monthStr = document.getElementById('sra-month').value;
  if (!monthStr) return;
  const parts = monthStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const dept = document.getElementById('sra-dept').value || null;
  const groupId = document.getElementById('sra-group').value || null;
  const overwrite = !!document.getElementById('sra-overwrite').checked;

  try {
    const res = await api('/shift-roster/auto-generate', {
      method: 'POST',
      body: JSON.stringify({ year, month, dept, groupId, overwrite })
    });

    if (res && res.success) {
      notify(`Auto-generated roster for ${res.data?.employees_count || 0} employees (${res.data?.total_slots || 0} date slots created)!`, 'ok');
      closeShiftRosterAutoModal();
      document.getElementById('roster-month-picker').value = monthStr;
      await loadShiftRosterMatrix();
    } else {
      notify(`Failed to generate roster: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error generating roster: ${err.message}`, 'er');
  }
}

// ── Bulk Assign Shift Modal ──
async function openShiftRosterAssignModal() {
  const modal = document.getElementById('shift-roster-assign-modal');
  if (!modal) return;

  const todayStr = new Date().toISOString().slice(0, 10);
  document.getElementById('sras-start-date').value = todayStr;
  document.getElementById('sras-end-date').value = todayStr;
  document.getElementById('sras-day-type').value = 'WORK';
  document.getElementById('sras-note').value = '';

  const [empRes, shifts] = await Promise.all([
    api('/employees?pageSize=500'),
    getCachedShifts()
  ]);

  const employees = empRes?.data?.employees || [];
  const empSelect = document.getElementById('sras-emp-select');
  if (empSelect) {
    empSelect.innerHTML = employees.map(e => `
      <option value="${e.id}">${e.name} (${e.id}) - ${e.dept || 'Staff'}</option>
    `).join('');
  }

  const shiftSelect = document.getElementById('sras-shift-id');
  if (shiftSelect) {
    shiftSelect.innerHTML = shifts.map(s => `
      <option value="${s.id}">${s.code} - ${s.name} (${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)})</option>
    `).join('');
  }

  onRosterBulkDayTypeChange();
  modal.style.display = 'flex';
}

function closeShiftRosterAssignModal() {
  const modal = document.getElementById('shift-roster-assign-modal');
  if (modal) modal.style.display = 'none';
}

function onRosterBulkDayTypeChange() {
  const dayType = document.getElementById('sras-day-type')?.value;
  const shiftWrap = document.getElementById('sras-shift-wrap');
  if (shiftWrap) {
    shiftWrap.style.display = (dayType === 'WORK') ? 'block' : 'none';
  }
}

async function executeBulkAssignRoster(event) {
  if (event) event.preventDefault();

  const selectedEmpOptions = Array.from(document.getElementById('sras-emp-select').selectedOptions);
  const emp_ids = selectedEmpOptions.map(opt => opt.value);
  if (emp_ids.length === 0) {
    notify('Please select at least one employee', 'wn');
    return;
  }

  const start_date = document.getElementById('sras-start-date').value;
  const end_date = document.getElementById('sras-end-date').value;
  const day_type = document.getElementById('sras-day-type').value;
  const shift_id = (day_type === 'WORK') ? document.getElementById('sras-shift-id').value : 'SHIFT_GEN';
  const note = document.getElementById('sras-note').value.trim();

  try {
    const res = await api('/shift-roster/assign', {
      method: 'POST',
      body: JSON.stringify({ emp_ids, start_date, end_date, shift_id, day_type, note })
    });

    if (res && res.success) {
      notify(`Shift assigned successfully to ${emp_ids.length} employees (${res.data?.result?.records_processed || 0} date records)!`, 'ok');
      closeShiftRosterAssignModal();
      await loadShiftRosterMatrix();
    } else {
      notify(`Failed to assign shifts: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error bulk assigning shifts: ${err.message}`, 'er');
  }
}

// Window exports
window.openShiftCalendarModal = openShiftCalendarModal;
window.closeShiftCalendarModal = closeShiftCalendarModal;
window.navCalendarMonth = navCalendarMonth;
window.setCalendarToToday = setCalendarToToday;
window.loadCalendarMonth = loadCalendarMonth;
window.openShiftDayModal = openShiftDayModal;
window.closeShiftDayModal = closeShiftDayModal;
window.onShiftDayTypeChange = onShiftDayTypeChange;
window.onShiftDayHolidaySelect = onShiftDayHolidaySelect;
window.saveShiftDayOverride = saveShiftDayOverride;
window.openShiftCalendarPatternModal = openShiftCalendarPatternModal;
window.closeShiftPatternModal = closeShiftPatternModal;
window.applyCalendarPatternSubmit = applyCalendarPatternSubmit;

window.openShiftGroupModal = openShiftGroupModal;
window.closeShiftGroupModal = closeShiftGroupModal;
window.loadShiftGroups = loadShiftGroups;
window.openAddShiftGroupModal = openAddShiftGroupModal;
window.openEditShiftGroupModal = openEditShiftGroupModal;
window.closeShiftGroupFormModal = closeShiftGroupFormModal;
window.saveShiftGroupForm = saveShiftGroupForm;
window.deleteShiftGroupPrompt = deleteShiftGroupPrompt;
window.openShiftGroupMembersModal = openShiftGroupMembersModal;
window.closeShiftGroupMembersModal = closeShiftGroupMembersModal;
window.filterGroupMembersList = filterGroupMembersList;
window.selectAllGroupMembers = selectAllGroupMembers;
window.updateGroupMemberCount = updateGroupMemberCount;
window.saveShiftGroupMembers = saveShiftGroupMembers;

window.openShiftRosterModal = openShiftRosterModal;
window.closeShiftRosterModal = closeShiftRosterModal;
window.debounceRosterSearch = debounceRosterSearch;
window.loadShiftRosterMatrix = loadShiftRosterMatrix;
window.quickChangeRosterShift = quickChangeRosterShift;
window.openShiftRosterAutoModal = openShiftRosterAutoModal;
window.closeShiftRosterAutoModal = closeShiftRosterAutoModal;
window.executeAutoGenerateRoster = executeAutoGenerateRoster;
window.openShiftRosterAssignModal = openShiftRosterAssignModal;
window.closeShiftRosterAssignModal = closeShiftRosterAssignModal;
window.onRosterBulkDayTypeChange = onRosterBulkDayTypeChange;
window.executeBulkAssignRoster = executeBulkAssignRoster;
