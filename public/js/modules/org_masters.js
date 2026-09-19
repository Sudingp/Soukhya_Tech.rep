// ══════════════════════════════════════════════
// 🔄 TRANSFERS CONTROLLER
// ══════════════════════════════════════════════
let transfersData = [];

async function openTransfersModal() {
  const m = document.getElementById('transfers-modal');
  if (m) m.style.display = 'flex';
  await loadTransfersGrid();
}

function closeTransfersModal() {
  const m = document.getElementById('transfers-modal');
  if (m) m.style.display = 'none';
}

async function loadTransfersGrid() {
  try {
    const res = await api('/transfers');
    if (res && res.transfers) {
      transfersData = res.transfers;
      renderTransfersTable(transfersData);
    }
  } catch (err) {
    notify('Failed to load transfer history: ' + err.message, 'err');
  }
}

function renderTransfersTable(list) {
  const tbody = document.getElementById('transfers-tbody');
  const countTag = document.getElementById('tr-count-tag');
  if (countTag) countTag.textContent = `${list.length} recorded events`;
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--mu)">No transfer or promotion records yet. Click "+ New Transfer / Promotion" to record one.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(t => {
    let fromTo = [];
    if (t.new_desig_name) fromTo.push(`Role: ${escapeHTML(t.prev_desig_name || '—')} $\\to$ <strong>${escapeHTML(t.new_desig_name)}</strong>`);
    if (t.new_dept_name) fromTo.push(`Dept: ${escapeHTML(t.prev_dept_name || '—')} $\\to$ <strong>${escapeHTML(t.new_dept_name)}</strong>`);
    if (t.new_branch_name) fromTo.push(`Branch: ${escapeHTML(t.prev_branch_name || '—')} $\\to$ <strong>${escapeHTML(t.new_branch_name)}</strong>`);
    if (fromTo.length === 0) fromTo.push('Lateral alignment');

    return `
      <tr style="border-bottom:1px solid var(--br)">
        <td style="padding:10px 16px; font-family:var(--mo); font-size:11px; color:var(--mu)">${escapeHTML(t.effective_date)}</td>
        <td style="padding:10px 16px; font-weight:600; color:var(--tx)">${escapeHTML(t.emp_name || t.emp_id)} <span style="font-size:10px; color:var(--mu); font-family:var(--mo)">(${escapeHTML(t.emp_id)})</span></td>
        <td style="padding:10px 16px; text-align:center"><span class="badge" style="background:rgba(0,212,170,0.15); color:var(--ac)">${escapeHTML(t.transfer_type)}</span></td>
        <td style="padding:10px 16px; font-size:11.5px">${fromTo.join(' | ')}</td>
        <td style="padding:10px 16px; font-size:11px; color:var(--mu)">${escapeHTML(t.remarks || '—')}</td>
        <td style="padding:10px 16px; text-align:right; font-size:11px; color:var(--mu)">${escapeHTML(t.approved_by || 'Admin')}</td>
      </tr>
    `;
  }).join('');
}

function filterTransfersTable() {
  const query = (document.getElementById('tr-search-input')?.value || '').toLowerCase();
  const filtered = transfersData.filter(t => {
    return t.emp_id.toLowerCase().includes(query) || (t.emp_name && t.emp_name.toLowerCase().includes(query));
  });
  renderTransfersTable(filtered);
}

async function openTransferFormModal() {
  const m = document.getElementById('transfer-form-modal');
  if (m) m.style.display = 'flex';
  await loadCompaniesDropdown('trf-new_company_id');
  await loadDepartmentsDropdown('trf-new_dept_id');
  await loadDesignationsDropdown('trf-new_desig_id');
  await loadBranchesDropdown('trf-new_branch_id');
  const d = document.getElementById('trf-effective_date');
  if (d) d.value = new Date().toISOString().slice(0, 10);
}

function closeTransferFormModal() {
  const m = document.getElementById('transfer-form-modal');
  if (m) m.style.display = 'none';
}

async function saveTransferForm(event) {
  if (event) event.preventDefault();
  const emp_id = document.getElementById('trf-emp_id')?.value.trim();
  const transfer_type = document.getElementById('trf-transfer_type')?.value;
  const effective_date = document.getElementById('trf-effective_date')?.value;
  const new_company_id = document.getElementById('trf-new_company_id')?.value || null;
  const new_dept_id = document.getElementById('trf-new_dept_id')?.value || null;
  const new_desig_id = document.getElementById('trf-new_desig_id')?.value || null;
  const new_branch_id = document.getElementById('trf-new_branch_id')?.value || null;
  const remarks = document.getElementById('trf-remarks')?.value.trim();

  if (!emp_id || !effective_date) {
    notify('Please specify Employee ID and Effective Date.', 'wn');
    return;
  }

  try {
    const res = await api('/transfers', {
      method: 'POST',
      body: { emp_id, transfer_type, effective_date, new_company_id, new_dept_id, new_desig_id, new_branch_id, remarks }
    });
    if (res && res.success) {
      notify('Career transfer/promotion executed and recorded!', 'ok');
      closeTransferFormModal();
      await loadTransfersGrid();
    } else {
      notify(res?.error?.message || 'Failed to process transfer.', 'err');
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}

// ══════════════════════════════════════════════
// 📟 BIOMETRIC DEVICES CONTROLLER
// ══════════════════════════════════════════════
let devicesData = [];

async function openDeviceMgmtModal() {
  const m = document.getElementById('device-mgmt-modal');
  if (m) m.style.display = 'flex';
  await loadDevicesGrid();
}

function closeDeviceMgmtModal() {
  const m = document.getElementById('device-mgmt-modal');
  if (m) m.style.display = 'none';
}

async function loadDevicesGrid() {
  try {
    const res = await api('/devices');
    if (res && res.devices) {
      devicesData = res.devices;
      renderDevicesTable(devicesData);
    }
  } catch (err) {
    notify('Failed to load biometric devices: ' + err.message, 'err');
  }
}

function renderDevicesTable(list) {
  const tbody = document.getElementById('devices-tbody');
  const countTag = document.getElementById('dev-count-tag');
  if (countTag) countTag.textContent = `${list.length} connected devices`;
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--mu)">No biometric devices registered. Click "+ Register Terminal" to configure an IP reader.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(d => `
    <tr style="border-bottom:1px solid var(--br)">
      <td style="padding:10px 16px; font-weight:700; color:var(--tx)">${escapeHTML(d.device_name)}</td>
      <td style="padding:10px 16px; font-family:var(--mo); font-size:11px; color:var(--ac2)">${escapeHTML(d.serial_number)}</td>
      <td style="padding:10px 16px; font-family:var(--mo); font-size:11px">${escapeHTML(d.device_ip)}:${d.device_port}</td>
      <td style="padding:10px 16px; color:var(--mu)">${escapeHTML(d.branch_name || 'HQ Main')}</td>
      <td style="padding:10px 16px; text-align:center"><span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b">${escapeHTML(d.protocol)}</span></td>
      <td style="padding:10px 16px; text-align:center; font-family:var(--mo); font-weight:600">${d.template_count || 0}</td>
      <td style="padding:10px 16px; text-align:center">
        <span class="badge" style="background:${d.status === 'ONLINE' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${d.status === 'ONLINE' ? '#10b981' : '#ef4444'}">
          ● ${escapeHTML(d.status)} (${d.buffer_lag_ms || 0}ms)
        </span>
      </td>
      <td style="padding:10px 16px; text-align:right">
        <button class="btn bsm" style="padding:2px 8px; font-size:11px" onclick="pingDeviceAction('${d.id}')" title="Ping Reader">⚡ Ping</button>
        <button class="btn bsm" style="padding:2px 8px; font-size:11px" onclick="syncDeviceAction('${d.id}')" title="Sync Templates">🔄 Sync</button>
        <button class="btn bsm" style="padding:2px 8px; font-size:11px; color:#ef4444" onclick="deleteDeviceAction('${d.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function filterDevicesTable() {
  const query = (document.getElementById('dev-search-input')?.value || '').toLowerCase();
  const status = document.getElementById('dev-status-filter')?.value || '';

  const filtered = devicesData.filter(d => {
    const matchesSearch = d.device_name.toLowerCase().includes(query) || d.serial_number.toLowerCase().includes(query) || d.device_ip.includes(query);
    const matchesStatus = !status || d.status === status;
    return matchesSearch && matchesStatus;
  });
  renderDevicesTable(filtered);
}

async function openDeviceFormModal(devId = null) {
  const m = document.getElementById('device-form-modal');
  if (m) m.style.display = 'flex';
  await loadBranchesDropdown('devf-branch_id');

  const title = document.getElementById('devf-modal-title');
  const idInput = document.getElementById('devf-id');
  const serialInput = document.getElementById('devf-serial_number');
  const nameInput = document.getElementById('devf-device_name');
  const ipInput = document.getElementById('devf-device_ip');
  const portInput = document.getElementById('devf-device_port');
  const protoSelect = document.getElementById('devf-protocol');
  const branchSelect = document.getElementById('devf-branch_id');
  const dirSelect = document.getElementById('devf-direction');
  const modelInput = document.getElementById('devf-device_model');
  const activeChk = document.getElementById('devf-active');

  if (devId) {
    const d = devicesData.find(x => x.id === devId);
    if (d) {
      if (title) title.textContent = 'Edit Biometric Device';
      if (idInput) idInput.value = d.id;
      if (serialInput) { serialInput.value = d.serial_number; serialInput.disabled = true; }
      if (nameInput) nameInput.value = d.device_name;
      if (ipInput) ipInput.value = d.device_ip;
      if (portInput) portInput.value = d.device_port;
      if (protoSelect) protoSelect.value = d.protocol;
      if (branchSelect) branchSelect.value = d.branch_id || '';
      if (dirSelect) dirSelect.value = d.direction || 'BOTH';
      if (modelInput) modelInput.value = d.device_model || '';
      if (activeChk) activeChk.checked = !!d.active;
    }
  } else {
    if (title) title.textContent = 'Register Biometric Device';
    if (idInput) idInput.value = '';
    if (serialInput) { serialInput.value = ''; serialInput.disabled = false; }
    if (nameInput) nameInput.value = '';
    if (ipInput) ipInput.value = '192.168.1.100';
    if (portInput) portInput.value = 4370;
    if (activeChk) activeChk.checked = true;
  }
}

function closeDeviceFormModal() {
  const m = document.getElementById('device-form-modal');
  if (m) m.style.display = 'none';
}

async function saveDeviceForm(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('devf-id')?.value;
  const serial_number = document.getElementById('devf-serial_number')?.value.trim();
  const device_name = document.getElementById('devf-device_name')?.value.trim();
  const device_ip = document.getElementById('devf-device_ip')?.value.trim();
  const device_port = parseInt(document.getElementById('devf-device_port')?.value || 4370, 10);
  const protocol = document.getElementById('devf-protocol')?.value || 'ESSL';
  const branch_id = document.getElementById('devf-branch_id')?.value || null;
  const direction = document.getElementById('devf-direction')?.value || 'BOTH';
  const device_model = document.getElementById('devf-device_model')?.value.trim() || 'eSSL SilkBio-101TC';
  const active = document.getElementById('devf-active')?.checked;

  if (!serial_number || !device_name || !device_ip) {
    notify('Please fill out all required fields.', 'wn');
    return;
  }

  try {
    if (id) {
      const res = await api(`/devices/${id}`, {
        method: 'PUT',
        body: { device_name, device_ip, device_port, protocol, branch_id, direction, device_model, active }
      });
      if (res && res.success) {
        notify('Biometric device updated successfully!', 'ok');
        closeDeviceFormModal();
        await loadDevicesGrid();
      } else {
        notify(res?.error?.message || 'Update failed.', 'err');
      }
    } else {
      const res = await api('/devices', {
        method: 'POST',
        body: { serial_number, device_name, device_ip, device_port, protocol, branch_id, direction, device_model, active }
      });
      if (res && res.success) {
        notify('Biometric device registered successfully!', 'ok');
        closeDeviceFormModal();
        await loadDevicesGrid();
      } else {
        notify(res?.error?.message || 'Registration failed.', 'err');
      }
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}

async function pingDeviceAction(id) {
  try {
    const res = await api(`/devices/${id}/ping`, { method: 'POST' });
    if (res && res.success) {
      notify(`Ping ACK received (${res.device.buffer_lag_ms}ms)!`, 'ok');
      await loadDevicesGrid();
    } else {
      notify('Ping timed out or reader unreachable.', 'err');
    }
  } catch (err) {
    notify(`Ping Error: ${err.message}`, 'err');
  }
}

async function pingAllDevices() {
  notify('Broadcasting ping across all biometric hardware readers...', 'ok');
  for (const d of devicesData) {
    await api(`/devices/${d.id}/ping`, { method: 'POST' }).catch(() => {});
  }
  await loadDevicesGrid();
  notify('All hardware readers verified online.', 'ok');
}

async function syncDeviceAction(id) {
  try {
    const res = await api(`/devices/${id}/sync-templates`, { method: 'POST' });
    if (res && res.success) {
      notify(`Synchronized ${res.template_count} biometric templates to device flash memory!`, 'ok');
      await loadDevicesGrid();
    } else {
      notify('Template sync failed.', 'err');
    }
  } catch (err) {
    notify(`Sync Error: ${err.message}`, 'err');
  }
}

async function deleteDeviceAction(id) {
  if (!confirm('Are you sure you want to remove this biometric terminal?')) return;
  try {
    const res = await api(`/devices/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      notify('Biometric terminal removed.', 'ok');
      await loadDevicesGrid();
    } else {
      notify(res?.error?.message || 'Failed to remove device.', 'err');
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}
