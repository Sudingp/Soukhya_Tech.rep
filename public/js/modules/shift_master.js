// ══════════════════════════════════════════════
// ⚙️ MASTER CONFIGURATION SETTINGS CONTROLLER
// ══════════════════════════════════════════════
let currentMasterSettings = {};

const MASTER_SETTINGS_DEFAULTS = {
  company_name: 'Soukhya Tech Solutions Ltd.',
  hq_location: 'Bangalore Headquarters, India',
  timezone: 'Asia/Kolkata',
  date_format: 'DD/MM/YYYY',
  currency: 'INR (₹)',
  late_grace_mins: 15,
  punch_cooldown_mins: 5,
  full_day_hrs: 8.0,
  half_day_hrs: 4.0,
  ot_threshold_mins: 30,
  face_match_threshold: 0.55,
  liveness_detection_enabled: true,
  multi_factor_required: false,
  session_timeout_mins: 30,
  audit_retention_days: 180,
  pii_masking_enabled: true
};

async function openMasterSettingsModal() {
  const modal = document.getElementById('master-settings-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  switchMasterSettingsTab('general');

  try {
    const res = await api('/settings/master');
    if (res && res.success && res.data && res.data.settings) {
      currentMasterSettings = res.data.settings;
      populateMasterSettingsForm(currentMasterSettings);
    } else {
      populateMasterSettingsForm(MASTER_SETTINGS_DEFAULTS);
    }
  } catch (e) {
    console.warn('[SETTINGS] Could not fetch remote master settings, using defaults:', e);
    populateMasterSettingsForm(MASTER_SETTINGS_DEFAULTS);
  }
}

function closeMasterSettingsModal() {
  const modal = document.getElementById('master-settings-modal');
  if (modal) modal.style.display = 'none';
}

function switchMasterSettingsTab(tabName) {
  const tabs = ['general', 'attendance', 'biometrics', 'security'];
  tabs.forEach(t => {
    const btn = document.getElementById('ms-tab-btn-' + t);
    const content = document.getElementById('ms-tab-' + t);
    if (btn) btn.classList.toggle('active', t === tabName);
    if (content) content.style.display = (t === tabName) ? 'block' : 'none';
  });
}

function populateMasterSettingsForm(data) {
  const getVal = (k, def) => (typeof data[k] !== 'undefined' ? data[k] : def);

  const setInput = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  const setCheck = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = (val === true || val === 'true' || val === 1 || val === '1');
  };

  setInput('ms-company_name', getVal('company_name', MASTER_SETTINGS_DEFAULTS.company_name));
  setInput('ms-hq_location', getVal('hq_location', MASTER_SETTINGS_DEFAULTS.hq_location));
  setInput('ms-timezone', getVal('timezone', MASTER_SETTINGS_DEFAULTS.timezone));
  setInput('ms-date_format', getVal('date_format', MASTER_SETTINGS_DEFAULTS.date_format));
  setInput('ms-currency', getVal('currency', MASTER_SETTINGS_DEFAULTS.currency));

  setInput('ms-late_grace_mins', getVal('late_grace_mins', MASTER_SETTINGS_DEFAULTS.late_grace_mins));
  setInput('ms-punch_cooldown_mins', getVal('punch_cooldown_mins', MASTER_SETTINGS_DEFAULTS.punch_cooldown_mins));
  setInput('ms-full_day_hrs', getVal('full_day_hrs', MASTER_SETTINGS_DEFAULTS.full_day_hrs));
  setInput('ms-half_day_hrs', getVal('half_day_hrs', MASTER_SETTINGS_DEFAULTS.half_day_hrs));
  setInput('ms-ot_threshold_mins', getVal('ot_threshold_mins', MASTER_SETTINGS_DEFAULTS.ot_threshold_mins));

  const faceThresh = parseFloat(getVal('face_match_threshold', MASTER_SETTINGS_DEFAULTS.face_match_threshold)) || 0.55;
  setInput('ms-face_match_threshold', faceThresh);
  const faceValEl = document.getElementById('ms-face_match_val');
  if (faceValEl) faceValEl.textContent = faceThresh.toFixed(2);

  setCheck('ms-liveness_detection_enabled', getVal('liveness_detection_enabled', MASTER_SETTINGS_DEFAULTS.liveness_detection_enabled));
  setCheck('ms-multi_factor_required', getVal('multi_factor_required', MASTER_SETTINGS_DEFAULTS.multi_factor_required));

  setInput('ms-session_timeout_mins', getVal('session_timeout_mins', MASTER_SETTINGS_DEFAULTS.session_timeout_mins));
  setInput('ms-audit_retention_days', getVal('audit_retention_days', MASTER_SETTINGS_DEFAULTS.audit_retention_days));
  setCheck('ms-pii_masking_enabled', getVal('pii_masking_enabled', MASTER_SETTINGS_DEFAULTS.pii_masking_enabled));
}

function resetMasterSettingsDefaults() {
  populateMasterSettingsForm(MASTER_SETTINGS_DEFAULTS);
  notify('Restored default master settings values. Click Save to apply.', 'ok');
}

async function saveMasterSettings(event) {
  if (event) event.preventDefault();

  const payload = {
    company_name: document.getElementById('ms-company_name')?.value?.trim() || '',
    hq_location: document.getElementById('ms-hq_location')?.value?.trim() || '',
    timezone: document.getElementById('ms-timezone')?.value || 'Asia/Kolkata',
    date_format: document.getElementById('ms-date_format')?.value || 'DD/MM/YYYY',
    currency: document.getElementById('ms-currency')?.value?.trim() || 'INR (₹)',

    late_grace_mins: parseInt(document.getElementById('ms-late_grace_mins')?.value, 10) || 15,
    punch_cooldown_mins: parseInt(document.getElementById('ms-punch_cooldown_mins')?.value, 10) || 5,
    full_day_hrs: parseFloat(document.getElementById('ms-full_day_hrs')?.value) || 8.0,
    half_day_hrs: parseFloat(document.getElementById('ms-half_day_hrs')?.value) || 4.0,
    ot_threshold_mins: parseInt(document.getElementById('ms-ot_threshold_mins')?.value, 10) || 30,

    face_match_threshold: parseFloat(document.getElementById('ms-face_match_threshold')?.value) || 0.55,
    liveness_detection_enabled: !!document.getElementById('ms-liveness_detection_enabled')?.checked,
    multi_factor_required: !!document.getElementById('ms-multi_factor_required')?.checked,

    session_timeout_mins: parseInt(document.getElementById('ms-session_timeout_mins')?.value, 10) || 30,
    audit_retention_days: parseInt(document.getElementById('ms-audit_retention_days')?.value, 10) || 180,
    pii_masking_enabled: !!document.getElementById('ms-pii_masking_enabled')?.checked
  };

  const saveBtn = document.getElementById('ms-save-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }

  try {
    const res = await api('/settings/master', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (res && res.success) {
      currentMasterSettings = res.data?.settings || payload;
      notify('Master Settings updated and persisted to database successfully!', 'ok');
      closeMasterSettingsModal();
    } else {
      const errMsg = res?.error?.message || 'Failed to update settings';
      notify(`Settings update error: ${errMsg}`, 'er');
    }
  } catch (err) {
    notify(`Failed to save settings: ${err.message}`, 'er');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Changes';
    }
  }
}

// ══════════════════════════════════════════════
// 📅 SHIFT CALENDAR CONTROLLER
// ══════════════════════════════════════════════
let activeCalendarYear = new Date().getFullYear();
let activeCalendarMonth = new Date().getMonth() + 1;
let cachedShiftsList = [];

async function getCachedShifts() {
  if (cachedShiftsList.length === 0) {
    try {
      const res = await api('/shifts');
      if (res && res.success && Array.isArray(res.data?.shifts)) {
        cachedShiftsList = res.data.shifts;
      }
    } catch (e) {
      console.warn('[SHIFTS] Failed to fetch cached shifts:', e);
    }
  }
  return cachedShiftsList;
}

async function openShiftCalendarModal() {
  const modal = document.getElementById('shift-calendar-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  const mSelect = document.getElementById('cal-month-select');
  const ySelect = document.getElementById('cal-year-select');
  if (mSelect) mSelect.value = activeCalendarMonth;
  if (ySelect) ySelect.value = activeCalendarYear;

  await loadCalendarMonth();
}

function closeShiftCalendarModal() {
  const modal = document.getElementById('shift-calendar-modal');
  if (modal) modal.style.display = 'none';
}

function navCalendarMonth(delta) {
  let m = parseInt(document.getElementById('cal-month-select')?.value || activeCalendarMonth, 10);
  let y = parseInt(document.getElementById('cal-year-select')?.value || activeCalendarYear, 10);

  m += delta;
  if (m < 1) {
    m = 12;
    y -= 1;
  } else if (m > 12) {
    m = 1;
    y += 1;
  }

  activeCalendarMonth = m;
  activeCalendarYear = y;

  const mSelect = document.getElementById('cal-month-select');
  const ySelect = document.getElementById('cal-year-select');
  if (mSelect) mSelect.value = m;
  if (ySelect) ySelect.value = y;

  loadCalendarMonth();
}

function setCalendarToToday() {
  const now = new Date();
  activeCalendarYear = now.getFullYear();
  activeCalendarMonth = now.getMonth() + 1;

  const mSelect = document.getElementById('cal-month-select');
  const ySelect = document.getElementById('cal-year-select');
  if (mSelect) mSelect.value = activeCalendarMonth;
  if (ySelect) ySelect.value = activeCalendarYear;

  loadCalendarMonth();
}

async function loadCalendarMonth() {
  const mSelect = document.getElementById('cal-month-select');
  const ySelect = document.getElementById('cal-year-select');
  const y = ySelect ? parseInt(ySelect.value, 10) : activeCalendarYear;
  const m = mSelect ? parseInt(mSelect.value, 10) : activeCalendarMonth;
  activeCalendarYear = y;
  activeCalendarMonth = m;

  const mStr = String(m).padStart(2, '0');
  const gridEl = document.getElementById('cal-days-grid');
  if (gridEl) gridEl.innerHTML = '<div style="grid-column:span 7; text-align:center; padding:30px; color:var(--mu)">Loading monthly schedule...</div>';

  try {
    const res = await api(`/shift-calendar?month=${y}-${mStr}`);
    if (res && res.success && res.data) {
      renderCalendarGrid(res.data);
    } else {
      notify('Failed to load shift calendar', 'er');
    }
  } catch (err) {
    notify(`Error loading calendar: ${err.message}`, 'er');
  }
}

function renderCalendarGrid(data) {
  const gridEl = document.getElementById('cal-days-grid');
  const statsEl = document.getElementById('cal-stats-summary');
  if (!gridEl) return;

  // Stats bar
  if (statsEl && data.summary) {
    statsEl.innerHTML = `
      <span style="color:#00d4aa; font-weight:600">💼 Workdays: <strong>${data.summary.working_days}</strong></span>
      <span style="color:#64748b; font-weight:600">☕ Off Days: <strong>${data.summary.weekly_offs}</strong></span>
      <span style="color:#ef4444; font-weight:600">🎉 Holidays: <strong>${data.summary.holidays}</strong></span>
    `;
  }

  const days = data.days || [];
  if (days.length === 0) return;

  const firstDayOfWeek = new Date(data.year, data.month - 1, 1).getDay(); // 0 = Sun
  const todayStr = new Date().toISOString().slice(0, 10);

  let html = '';

  // Leading empty placeholders
  for (let i = 0; i < firstDayOfWeek; i++) {
    html += '<div class="cal-day-card other-month"></div>';
  }

  // Days cards
  days.forEach(d => {
    const isToday = d.date === todayStr;
    const isOff = d.day_type === 'WEEKLY_OFF';
    const isHol = d.day_type === 'HOLIDAY';
    const isHalf = d.day_type === 'HALF_DAY';

    let cardClass = 'cal-day-card';
    if (isToday) cardClass += ' is-today';
    if (isOff) cardClass += ' type-off';
    if (isHol) cardClass += ' type-holiday';

    let badgeBg = isOff ? '#64748b' : (isHol ? '#ef4444' : (isHalf ? '#f59e0b' : (d.shift_color || '#00d4aa')));
    let badgeText = isOff ? 'WO' : (isHol ? 'HOL' : (isHalf ? 'HD' : d.shift_code));

    html += `
      <div class="${cardClass}" onclick="openShiftDayModal('${d.date}', '${d.day_type}', '${d.default_shift_id || 'SHIFT_GEN'}', '${escapeHtml(d.title || '')}')">
        <div class="cal-day-hdr">
          <span class="cal-day-num">${d.day_number}</span>
          <span class="cal-shift-pill" style="background:${badgeBg}22; color:${badgeBg}; border:1px solid ${badgeBg}55">
            <span style="width:6px; height:6px; border-radius:50%; background:${badgeBg}"></span>
            ${badgeText}
          </span>
        </div>
        <div>
          <div style="font-size:10.5px; font-weight:600; color:var(--tx)">${isOff ? 'Weekly Off' : (isHol ? 'Public Holiday' : d.shift_name)}</div>
          <div class="cal-day-title" title="${escapeHtml(d.title || '')}">${escapeHtml(d.title || '')}</div>
        </div>
      </div>
    `;
  });

  gridEl.innerHTML = html;
}

async function openShiftDayModal(dateStr, currentDayType, currentShiftId, currentTitle) {
  const modal = document.getElementById('shift-day-modal');
  if (!modal) return;

  document.getElementById('sd-date').value = dateStr;
  document.getElementById('sd-date-display').value = `${dateStr} (${new Date(dateStr).toLocaleDateString('default', { weekday: 'long' })})`;
  document.getElementById('sd-day-type').value = currentDayType || 'WORK';
  document.getElementById('sd-title').value = currentTitle || '';

  // Populate shifts dropdown
  const shifts = await getCachedShifts();
  const shiftSelect = document.getElementById('sd-shift-select');
  if (shiftSelect) {
    shiftSelect.innerHTML = shifts.map(s => `
      <option value="${s.id}" ${s.id === currentShiftId ? 'selected' : ''}>${s.code} - ${s.name} (${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)})</option>
    `).join('');
  }

  // Populate holiday presets
  const holSelect = document.getElementById('sd-holiday-select');
  if (holSelect && Array.isArray(cachedPublicHolidays)) {
    holSelect.innerHTML = '<option value="">-- Choose from 2026 Karnataka Holidays --</option>' +
      cachedPublicHolidays.map(h => `<option value="${escapeHtml(h.title)}">${h.holiday_date.slice(5)} - ${escapeHtml(h.title)} (${h.holiday_type})</option>`).join('');
  }

  onShiftDayTypeChange();
  modal.style.display = 'flex';
}

function closeShiftDayModal() {
  const modal = document.getElementById('shift-day-modal');
  if (modal) modal.style.display = 'none';
}

function onShiftDayTypeChange() {
  const dayType = document.getElementById('sd-day-type')?.value;
  const shiftGroup = document.getElementById('sd-shift-group');
  const holGroup = document.getElementById('sd-holiday-group');
  if (shiftGroup) {
    shiftGroup.style.display = (dayType === 'WORK' || dayType === 'HALF_DAY') ? 'block' : 'none';
  }
  if (holGroup) {
    holGroup.style.display = (dayType === 'HOLIDAY') ? 'block' : 'none';
  }
}

function onShiftDayHolidaySelect() {
  const holSelect = document.getElementById('sd-holiday-select');
  const titleInp = document.getElementById('sd-title');
  if (holSelect && titleInp && holSelect.value) {
    titleInp.value = holSelect.value;
  }
}

async function saveShiftDayOverride(event) {
  if (event) event.preventDefault();

  const cal_date = document.getElementById('sd-date').value;
  const day_type = document.getElementById('sd-day-type').value;
  const default_shift_id = (day_type === 'WORK' || day_type === 'HALF_DAY') ? document.getElementById('sd-shift-select').value : null;
  const title = document.getElementById('sd-title').value.trim();

  try {
    const res = await api('/shift-calendar/day', {
      method: 'PUT',
      body: JSON.stringify({ cal_date, day_type, default_shift_id, title })
    });

    if (res && res.success) {
      notify(`Calendar day ${cal_date} updated successfully!`, 'ok');
      closeShiftDayModal();
      await loadCalendarMonth();
    } else {
      notify(`Failed to update calendar day: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error updating day: ${err.message}`, 'er');
  }
}

async function openShiftCalendarPatternModal() {
  const modal = document.getElementById('shift-pattern-modal');
  if (!modal) return;

  const mSelect = document.getElementById('sp-month');
  const ySelect = document.getElementById('sp-year');
  if (mSelect) {
    mSelect.innerHTML = [
      'January','February','March','April','May','June','July','August','September','October','November','December'
    ].map((name, i) => `<option value="${i + 1}" ${i + 1 === activeCalendarMonth ? 'selected' : ''}>${name}</option>`).join('');
  }
  if (ySelect) {
    ySelect.innerHTML = [2025, 2026, 2027, 2028].map(y => `<option value="${y}" ${y === activeCalendarYear ? 'selected' : ''}>${y}</option>`).join('');
  }

  const shifts = await getCachedShifts();
  const shiftSelect = document.getElementById('sp-default-shift');
  if (shiftSelect) {
    shiftSelect.innerHTML = shifts.map(s => `<option value="${s.id}">${s.code} - ${s.name}</option>`).join('');
  }

  modal.style.display = 'flex';
}

function closeShiftPatternModal() {
  const modal = document.getElementById('shift-pattern-modal');
  if (modal) modal.style.display = 'none';
}

async function applyCalendarPatternSubmit(event) {
  if (event) event.preventDefault();

  const year = parseInt(document.getElementById('sp-year').value, 10);
  const month = parseInt(document.getElementById('sp-month').value, 10);
  const pattern_type = document.getElementById('sp-pattern-type').value;
  const default_shift_id = document.getElementById('sp-default-shift').value;

  try {
    const res = await api('/shift-calendar/apply-pattern', {
      method: 'POST',
      body: JSON.stringify({ year, month, pattern_type, default_shift_id })
    });

    if (res && res.success) {
      notify(`Weekly off pattern applied to ${month}/${year} (${res.data?.result?.count || 0} days configured)!`, 'ok');
      closeShiftPatternModal();
      activeCalendarYear = year;
      activeCalendarMonth = month;
      const mSelect = document.getElementById('cal-month-select');
      const ySelect = document.getElementById('cal-year-select');
      if (mSelect) mSelect.value = month;
      if (ySelect) ySelect.value = year;
      await loadCalendarMonth();
    } else {
      notify(`Failed to apply pattern: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error applying pattern: ${err.message}`, 'er');
  }
}
