// ══════════════════════════════════════════════
// HR Dashboard filtering
// ══════════════════════════════════════════════
function filt() {
  const s  = (document.getElementById('fs')?.value  || '').toLowerCase();
  const d  =  document.getElementById('fd')?.value;
  const dd =  document.getElementById('fdd')?.value;
  const st =  document.getElementById('fst')?.value;

  let r = [...ATT];
  if (s)  r = r.filter(a => a.name.toLowerCase().includes(s) || a.empId.toLowerCase().includes(s));
  if (d)  r = r.filter(a => a.ts.startsWith(d));
  if (dd) r = r.filter(a => a.dept === dd);
  if (st) r = r.filter(a => a.status === st);
  r.sort((a, b) => new Date(b.ts) - new Date(a.ts));

  const tb = document.getElementById('atb');
  const tc = document.getElementById('tc2');

  if (!r.length) {
    tb.innerHTML = `<tr><td colspan="7" class="emp">${ATT.length ? 'No records match filters.' : 'No records yet.'}</td></tr>`;
    if (tc) tc.textContent = '';
    return;
  }

  tb.innerHTML = r.map(a => {
    const ts = new Date(a.ts);
    return `<tr>
      <td class="tid">${a.empId}</td>
      <td style="font-weight:500">${a.name}</td>
      <td>${a.dept}</td>
      <td style="color:var(--mu)">${a.role}</td>
      <td class="tts">${ts.toLocaleDateString()}</td>
      <td class="tts">${ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</td>
      <td><span class="chip ${a.status === 'Present' ? 'cp' : 'cl'}">${a.status}</span></td>
    </tr>`;
  }).join('');

  if (tc) tc.textContent = r.length + ' record' + (r.length !== 1 ? 's' : '');
}

function clrFilt() {
  ['fs', 'fd', 'fdd', 'fst'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  filt();
}

// ══════════════════════════════════════════════
// CSV Export
// ══════════════════════════════════════════════
function exportCSV() {
  if (!ATT.length) { notify('No records to export.', 'wn'); return; }

  const hdrs = ['Employee ID', 'Name', 'Department', 'Role', 'Date', 'Time', 'Status'];
  const rows = ATT.map(a => {
    const ts = new Date(a.ts);
    return [a.empId, a.name, a.dept, a.role, ts.toLocaleDateString(), ts.toLocaleTimeString(), a.status];
  });

  const csv = [hdrs, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href     = url;
  link.download = 'attendance_' + new Date().toISOString().slice(0, 10) + '.csv';
  link.click();
  URL.revokeObjectURL(url);
  notify('CSV exported successfully!');
}

// ══════════════════════════════════════════════
// eTimeTrackLite Dialog & Action Link Controls
// ══════════════════════════════════════════════

// Date dropdown helpers
function populateDateDropdowns(containerId, dateStr) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  let valDate = new Date();
  if (dateStr && dateStr !== 'N/A' && dateStr !== 'null') {
    valDate = new Date(dateStr);
  } else if (containerId.includes('last-working')) {
    valDate = new Date("3000-01-01");
  } else if (containerId.includes('exp-start')) {
    valDate = new Date("2000-01-01");
  } else if (containerId.includes('exp-end')) {
    valDate = new Date("2030-12-31");
  } else if (containerId.includes('confirm-date')) {
    valDate = new Date();
    valDate.setMonth(valDate.getMonth() + 6);
  }

  const d = valDate.getDate();
  const m = valDate.getMonth(); // 0-11
  const y = valDate.getFullYear();

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let daysHtml = `<select class="fs date-sel-d" style="width: 32%; display: inline-block; margin-right: 2%">`;
  for (let i = 1; i <= 31; i++) {
    const val = String(i).padStart(2, '0');
    daysHtml += `<option value="${val}" ${i === d ? 'selected' : ''}>${val}</option>`;
  }
  daysHtml += `</select>`;

  let monthsHtml = `<select class="fs date-sel-m" style="width: 32%; display: inline-block; margin-right: 2%">`;
  for (let i = 0; i < 12; i++) {
    monthsHtml += `<option value="${String(i+1).padStart(2, '0')}" ${i === m ? 'selected' : ''}>${months[i]}</option>`;
  }
  monthsHtml += `</select>`;

  let yearsHtml = `<select class="fs date-sel-y" style="width: 32%; display: inline-block">`;
  const startYr = Math.min(y - 10, 2000);
  const endYr = Math.max(y + 10, 2035);
  
  let yrs = [];
  for (let i = startYr; i <= endYr; i++) {
    yrs.push(i);
  }
  if (!yrs.includes(3000)) yrs.push(3000);
  if (!yrs.includes(y)) yrs.push(y);
  yrs.sort((a,b) => a-b);

  yrs.forEach(yr => {
    yearsHtml += `<option value="${yr}" ${yr === y ? 'selected' : ''}>${yr}</option>`;
  });
  yearsHtml += `</select>`;

  container.innerHTML = daysHtml + monthsHtml + yearsHtml;
}

function getISOFromDateDropdowns(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  const d = container.querySelector('.date-sel-d').value;
  const m = container.querySelector('.date-sel-m').value;
  const y = container.querySelector('.date-sel-y').value;
  return `${y}-${m}-${d}`;
}

// Modal open
function openEmpModal(id) {
  const emp = EMP.find(e => e.id === id);
  if (!emp) return;

  // Set text fields
  document.getElementById('m-id').value = emp.id;
  document.getElementById('m-name').value = emp.name || '';
  document.getElementById('m-device-code').value = emp.deviceCode || emp.device_code || emp.id;
  document.getElementById('m-dept').value = emp.department || emp.dept || 'Engineering';
  document.getElementById('m-sub-dept').value = emp.subDepartment || emp.sub_department || 'None';
  document.getElementById('m-grade').value = emp.grade || 'G1';
  document.getElementById('m-location').value = emp.location || 'HQ - Bangalore';
  document.getElementById('m-category').value = emp.category || 'Default';
  document.getElementById('m-shift-group').value = emp.shiftGroup || emp.shift_group || 'None';
  document.getElementById('m-status').value = emp.status || 'Active';
  
  // Sex (radio)
  const isMale = (emp.gender || '').toLowerCase() !== 'female';
  document.getElementById('m-sex-male').checked = isMale;
  document.getElementById('m-sex-female').checked = !isMale;

  document.getElementById('m-card-number').value = emp.cardNumber || emp.card_number || '';
  document.getElementById('m-expiry-rule').checked = emp.deviceExpiryRuleApplicable || emp.device_expiry_rule_applicable || false;

  document.getElementById('m-company').value = emp.company || 'Default';
  document.getElementById('m-role').value = emp.role || '';
  document.getElementById('m-division').value = emp.division || 'None';
  document.getElementById('m-team').value = emp.team || 'None';
  document.getElementById('m-emp-type').value = emp.employmentType || emp.employment_type || 'Permanent';
  document.getElementById('m-holiday-group').value = emp.holidayGroup || emp.holiday_group || 'None';
  document.getElementById('m-shift-roster').value = emp.shiftRoster || emp.shift_roster || 'None';
  document.getElementById('m-aadhaar').value = emp.aadhaarNumber || emp.aadhaar_number || '';
  document.getElementById('m-geofence').value = emp.geofence || '--Select--';
  document.getElementById('m-verification-type').value = emp.verificationType || emp.verification_type || 'Finger or Face or Card or Pin';

  // Compliance fields
  document.getElementById('m-pan').value = emp.panNumber || emp.pan_number || '';
  document.getElementById('m-phone').value = emp.phoneNo || emp.phone_no || '';
  document.getElementById('m-email').value = emp.email || '';
  document.getElementById('m-reporting-to').value = emp.reportingTo || emp.reporting_to || '';

  // Dates
  populateDateDropdowns('m-join-date-grp', emp.dateOfJoining || emp.date_of_joining);
  populateDateDropdowns('m-confirm-date-grp', emp.dateOfConfirmation || emp.date_of_confirmation);
  populateDateDropdowns('m-last-working-grp', emp.lastWorkingDay || emp.last_working_day);
  populateDateDropdowns('m-exp-start-grp', emp.expiryStartDate || emp.expiry_start_date);
  populateDateDropdowns('m-exp-end-grp', emp.expiryEndDate || emp.expiry_end_date);

  // Hibernate fields
  toggleModalHibFields(emp.status || 'Active');
  if (emp.status === 'Hibernate') {
    document.getElementById('m-hib-start').value = emp.hibernateStartDate || emp.hibernate_start_date || '';
    document.getElementById('m-hib-end').value = emp.hibernateEndDate || emp.hibernate_end_date || '';
    document.getElementById('m-hib-reason').value = emp.hibernateReason || emp.hibernate_reason || '';
  }

  // Display modal
  document.getElementById('emp-modal').style.display = 'flex';
}

function closeEmpModal() {
  document.getElementById('emp-modal').style.display = 'none';
}

function toggleModalHibFields(status) {
  const hRow = document.getElementById('m-hib-fields-row');
  if (status === 'Hibernate') {
    hRow.style.display = 'grid';
  } else {
    hRow.style.display = 'none';
  }
}

// Modal save
async function saveEmpModal() {
  const id = document.getElementById('m-id').value;
  const name = document.getElementById('m-name').value.trim();
  const role = document.getElementById('m-role').value.trim();
  const status = document.getElementById('m-status').value;

  if (!name || !role) {
    notify('Name and Designation cannot be empty.', 'wn');
    return;
  }

  const payload = {
    name,
    department: document.getElementById('m-dept').value,
    role,
    status,
    device_code: document.getElementById('m-device-code').value.trim(),
    sub_department: document.getElementById('m-sub-dept').value,
    grade: document.getElementById('m-grade').value,
    location: document.getElementById('m-location').value,
    category: document.getElementById('m-category').value,
    shift_group: document.getElementById('m-shift-group').value,
    gender: document.querySelector('input[name="m-sex"]:checked').value,
    card_number: document.getElementById('m-card-number').value.trim(),
    device_expiry_rule_applicable: document.getElementById('m-expiry-rule').checked,
    
    company: document.getElementById('m-company').value,
    division: document.getElementById('m-division').value,
    team: document.getElementById('m-team').value,
    employment_type: document.getElementById('m-emp-type').value,
    holiday_group: document.getElementById('m-holiday-group').value,
    shift_roster: document.getElementById('m-shift-roster').value,
    aadhaar_number: document.getElementById('m-aadhaar').value.trim(),
    geofence: document.getElementById('m-geofence').value,
    verification_type: document.getElementById('m-verification-type').value,

    // Dates
    date_of_joining: getISOFromDateDropdowns('m-join-date-grp'),
    date_of_confirmation: getISOFromDateDropdowns('m-confirm-date-grp'),
    last_working_day: getISOFromDateDropdowns('m-last-working-grp'),
    expiry_start_date: getISOFromDateDropdowns('m-exp-start-grp'),
    expiry_end_date: getISOFromDateDropdowns('m-exp-end-grp'),

    // Compliance
    pan_number: document.getElementById('m-pan').value.trim(),
    phone_no: document.getElementById('m-phone').value.trim(),
    email: document.getElementById('m-email').value.trim(),
    reporting_to: document.getElementById('m-reporting-to').value.trim(),
  };

  if (status === 'Hibernate') {
    payload.hibernate_start_date = document.getElementById('m-hib-start').value;
    payload.hibernate_end_date = document.getElementById('m-hib-end').value;
    payload.hibernate_reason = document.getElementById('m-hib-reason').value.trim();

    if (!payload.hibernate_start_date || !payload.hibernate_end_date || !payload.hibernate_reason) {
      notify('Please fill all Hibernate details.', 'wn');
      return;
    }
  }

  notify('Updating employee record...', 'wn');

  try {
    const res = await apiPut('/api/employees/' + id, payload);
    if (res.success) {
      notify('Employee saved successfully! <span class="db-badge">DB</span>', 'ok');
      
      // Update local state directly
      const idx = EMP.findIndex(e => e.id === id);
      if (idx !== -1) {
        EMP[idx] = {
          ...EMP[idx],
          name: payload.name,
          department: payload.department,
          role: payload.role,
          status: payload.status,
          deviceCode: payload.device_code,
          subDepartment: payload.sub_department,
          grade: payload.grade,
          location: payload.location,
          category: payload.category,
          shiftGroup: payload.shift_group,
          gender: payload.gender,
          cardNumber: payload.card_number,
          deviceExpiryRuleApplicable: payload.device_expiry_rule_applicable,
          company: payload.company,
          division: payload.division,
          team: payload.team,
          employmentType: payload.employment_type,
          holidayGroup: payload.holiday_group,
          shiftRoster: payload.shift_roster,
          aadhaarNumber: payload.aadhaar_number,
          geofence: payload.geofence,
          verificationType: payload.verification_type,
          dateOfJoining: payload.date_of_joining,
          dateOfConfirmation: payload.date_of_confirmation,
          lastWorkingDay: payload.last_working_day,
          expiryStartDate: payload.expiry_start_date,
          expiryEndDate: payload.expiry_end_date,
          panNumber: payload.pan_number,
          phoneNo: payload.phone_no,
          email: payload.email,
          reportingTo: payload.reporting_to,
          hibernateStartDate: payload.hibernate_start_date || null,
          hibernateEndDate: payload.hibernate_end_date || null,
          hibernateReason: payload.hibernate_reason || null
        };
      }
      
      closeEmpModal();
      renderEL();
      updateStats();
    } else {
      notify(res.error || 'Failed to save updates.', 'er');
    }
  } catch (err) {
    console.error(err);
    notify('Communication error occurred.', 'er');
  }
}

// Simulated Sync actions
function syncAllDevices() {
  const name = document.getElementById('m-name').value;
  notify(`Syncing "${name}" credentials to 5 facial readers...`, 'wn');
  setTimeout(() => {
    notify('Reader Synchronization complete! Verified on: KCC-Lobby, KCC-Server, HQ-Entrance.', 'ok');
  }, 1800);
}

function unsyncAllDevices() {
  const name = document.getElementById('m-name').value;
  notify(`Revoking credentials for "${name}" from all terminals...`, 'wn');
  setTimeout(() => {
    notify('Credentials deleted from 5 active face readers successfully.', 'ok');
  }, 1800);
}

// Popup Info Drawer helpers
function openInfoDrawer(title, html) {
  document.getElementById('dr-title').textContent = title;
  document.getElementById('dr-body').innerHTML = html;
  document.getElementById('info-drawer').style.display = 'flex';
}

function closeInfoDrawer() {
  document.getElementById('info-drawer').style.display = 'none';
}

function toggleMasterSubmenu(id, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const el = document.getElementById(id);
  const arrow = document.getElementById(id + '-arrow');
  if (!el) return;
  const isHidden = el.style.display === 'none' || !el.style.display;
  el.style.display = isHidden ? 'block' : 'none';
  if (arrow) {
    arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
    arrow.style.color = isHidden ? 'var(--ac)' : 'var(--mu)';
  }
}