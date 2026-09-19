// ══════════════════════════════════════════════
// ⚡ LIVE TRANSACTION MONITOR HUD CONTROLLER
// ══════════════════════════════════════════════
let liveTxTimer = null;

async function openLiveTxMonitorModal() {
  const m = document.getElementById('live-tx-monitor-modal');
  if (m) m.style.display = 'flex';
  await pollLiveTxMetrics();
  if (!liveTxTimer) {
    liveTxTimer = setInterval(pollLiveTxMetrics, 2000);
  }
}

function closeLiveTxMonitorModal() {
  const m = document.getElementById('live-tx-monitor-modal');
  if (m) m.style.display = 'none';
  if (liveTxTimer) {
    clearInterval(liveTxTimer);
    liveTxTimer = null;
  }
}

async function pollLiveTxMetrics() {
  try {
    const res = await api('/punch-buffer/metrics');
    if (res && res.metrics) {
      const qEl = document.getElementById('tx-queued-count');
      const pEl = document.getElementById('tx-processed-count');
      const dEl = document.getElementById('tx-duplicate-count');
      const lEl = document.getElementById('tx-avg-latency');

      if (qEl) qEl.textContent = res.metrics.queued_count || 0;
      if (pEl) pEl.textContent = res.metrics.processed_count || 0;
      if (dEl) dEl.textContent = res.metrics.duplicate_count || 0;
      if (lEl) lEl.textContent = `${parseFloat(res.metrics.avg_latency_ms || 0.4).toFixed(2)} ms`;

      renderLiveTxTable(res.recent_punches || []);
    }
  } catch (err) {
    console.warn('[LIVE TX POLL]', err.message);
  }
}

function renderLiveTxTable(list) {
  const tbody = document.getElementById('live-tx-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--mu)">No recent punch packets in buffer. Click "⚡ Test 100 Punches" to simulate hardware burst.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => {
    let stateBadge = `<span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b">QUEUED</span>`;
    if (p.processed === 1) stateBadge = `<span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981">PROCESSED</span>`;
    if (p.processed === 2) stateBadge = `<span class="badge" style="background:rgba(139,92,246,0.15); color:#8b5cf6">DUPLICATE</span>`;

    return `
      <tr style="border-bottom:1px solid var(--br)">
        <td style="padding:8px 16px; font-family:var(--mo); font-size:11px; color:var(--mu)">${escapeHTML(p.punch_timestamp || p.created_at)}</td>
        <td style="padding:8px 16px; font-weight:700; color:var(--tx)">${escapeHTML(p.emp_name || p.emp_id)} <span style="font-size:10px; color:var(--mu); font-family:var(--mo)">(${escapeHTML(p.emp_id)})</span></td>
        <td style="padding:8px 16px; font-family:var(--mo); font-size:11px">${escapeHTML(p.terminal_id)}</td>
        <td style="padding:8px 16px; text-align:center"><span class="badge" style="background:rgba(0,212,170,0.1); color:var(--ac); font-size:10px">${escapeHTML(p.punch_state)}</span></td>
        <td style="padding:8px 16px; text-align:center; font-size:11px">${escapeHTML(p.verification_type)}</td>
        <td style="padding:8px 16px; text-align:center; font-family:var(--mo); color:#00d4aa; font-weight:700">${parseFloat(p.process_latency_ms || 0.3).toFixed(2)}ms</td>
        <td style="padding:8px 16px; text-align:right">${stateBadge}</td>
      </tr>
    `;
  }).join('');
}

async function simulateFastPunchBatch(count = 100) {
  notify(`Injecting burst of ${count} edge hardware punches into buffer pipeline...`, 'ok');
  const punches = [];
  const empIds = ['EMP0001', 'EMP0002', 'EMP0003', 'EMP0004', 'EMP0005', 'EMP0006', 'EMP0007', 'EMP0008', 'EMP0009', 'EMP0010'];
  const terminals = ['DEV_BLR_01', 'DEV_BLR_02', 'DEV_WFD_01', 'EDGE_GATE_05'];

  for (let i = 0; i < count; i++) {
    punches.push({
      emp_id: empIds[Math.floor(Math.random() * empIds.length)],
      terminal_id: terminals[Math.floor(Math.random() * terminals.length)],
      punch_state: 'CHECK_IN',
      verification_type: 'FACE',
      temperature: 36.5,
      mask_detected: false
    });
  }

  try {
    const res = await api('/punch-buffer/batch-ingest', {
      method: 'POST',
      body: { punches }
    });
    if (res && res.success) {
      notify(`⚡ Ingested ${res.inserted} punches in ${res.latency_ms}ms (${res.throughput_ops_sec} TPS)!`, 'ok');
      await pollLiveTxMetrics();
    }
  } catch (err) {
    notify('Simulation failed: ' + err.message, 'err');
  }
}

async function flushPunchBufferFromUI() {
  try {
    const res = await api('/punch-buffer/flush', { method: 'POST', body: { limit: 1000 } });
    if (res && res.success) {
      notify(`🌊 Drained ${res.total_drained} buffer punches (${res.processed} written, ${res.duplicates} deduplicated)!`, 'ok');
      await pollLiveTxMetrics();
    }
  } catch (err) {
    notify('Buffer drain failed: ' + err.message, 'err');
  }
}

// ── Dropdown Loader Helpers ──
async function loadCompaniesDropdown(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return;
  try {
    const res = await api('/companies');
    if (res && res.companies) {
      const currentVal = el.value;
      const isFilter = selectId.includes('filter');
      el.innerHTML = (isFilter ? '<option value="">All Companies</option>' : '<option value="">Select Company</option>') +
        res.companies.map(c => `<option value="${c.id}">${escapeHTML(c.name)} (${escapeHTML(c.code)})</option>`).join('');
      if (currentVal) el.value = currentVal;
    }
  } catch {}
}

async function loadDepartmentsDropdown(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return;
  try {
    const res = await api('/departments');
    if (res && res.departments) {
      const currentVal = el.value;
      const isFilter = selectId.includes('filter');
      el.innerHTML = (isFilter ? '<option value="">All Departments</option>' : '<option value="">(None / General Corporate)</option>') +
        res.departments.map(d => `<option value="${d.id}">${escapeHTML(d.name)}</option>`).join('');
      if (currentVal) el.value = currentVal;
    }
  } catch {}
}

async function loadDesignationsDropdown(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return;
  try {
    const res = await api('/designations');
    if (res && res.designations) {
      el.innerHTML = '<option value="">(Keep Unchanged / Select)</option>' +
        res.designations.map(d => `<option value="${d.id}">${escapeHTML(d.name)} (${d.grade_level})</option>`).join('');
    }
  } catch {}
}

async function loadBranchesDropdown(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return;
  try {
    const res = await api('/branches');
    if (res && res.branches) {
      el.innerHTML = '<option value="">(Keep Unchanged / Select)</option>' +
        res.branches.map(b => `<option value="${b.id}">${escapeHTML(b.name)} - ${b.city}</option>`).join('');
    }
  } catch {}
}

async function loadGeofencesDropdown(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return;
  try {
    const res = await api('/geofences');
    if (res && res.geofences) {
      el.innerHTML = '<option value="">(None)</option>' +
        res.geofences.map(g => `<option value="${g.id}">${escapeHTML(g.name)} (${g.radius_meters}m)</option>`).join('');
    }
  } catch {}
}

// Window exports for New Masters & Hardware Monitor
window.openDivisionsModal = openDivisionsModal;
window.closeDivisionsModal = closeDivisionsModal;
window.filterDivisionsTable = filterDivisionsTable;
window.openDivisionFormModal = openDivisionFormModal;
window.closeDivisionFormModal = closeDivisionFormModal;
window.openEditDivisionModal = openEditDivisionModal;
window.saveDivisionForm = saveDivisionForm;
window.deleteDivisionAction = deleteDivisionAction;

window.openCostCentersModal = openCostCentersModal;
window.closeCostCentersModal = closeCostCentersModal;
window.filterCostCentersTable = filterCostCentersTable;
window.openCostCenterFormModal = openCostCenterFormModal;
window.closeCostCenterFormModal = closeCostCenterFormModal;
window.openEditCostCenterModal = openEditCostCenterModal;
window.saveCostCenterForm = saveCostCenterForm;
window.deleteCostCenterAction = deleteCostCenterAction;

window.openDesignationsModal = openDesignationsModal;
window.closeDesignationsModal = closeDesignationsModal;
window.filterDesignationsTable = filterDesignationsTable;
window.openDesignationFormModal = openDesignationFormModal;
window.closeDesignationFormModal = closeDesignationFormModal;
window.openEditDesignationModal = openEditDesignationModal;
window.saveDesignationForm = saveDesignationForm;
window.deleteDesignationAction = deleteDesignationAction;

window.openBranchesModal = openBranchesModal;
window.closeBranchesModal = closeBranchesModal;
window.filterBranchesTable = filterBranchesTable;
window.openBranchFormModal = openBranchFormModal;
window.closeBranchFormModal = closeBranchFormModal;
window.openEditBranchModal = openEditBranchModal;
window.saveBranchForm = saveBranchForm;
window.deleteBranchAction = deleteBranchAction;

window.openTransfersModal = openTransfersModal;
window.closeTransfersModal = closeTransfersModal;
window.filterTransfersTable = filterTransfersTable;
window.openTransferFormModal = openTransferFormModal;
window.closeTransferFormModal = closeTransferFormModal;
window.saveTransferForm = saveTransferForm;

window.openDeviceMgmtModal = openDeviceMgmtModal;
window.closeDeviceMgmtModal = closeDeviceMgmtModal;
window.filterDevicesTable = filterDevicesTable;
window.openDeviceFormModal = openDeviceFormModal;
window.closeDeviceFormModal = closeDeviceFormModal;
window.saveDeviceForm = saveDeviceForm;
window.pingDeviceAction = pingDeviceAction;
window.pingAllDevices = pingAllDevices;
window.syncDeviceAction = syncDeviceAction;
window.deleteDeviceAction = deleteDeviceAction;

window.openLiveTxMonitorModal = openLiveTxMonitorModal;
window.closeLiveTxMonitorModal = closeLiveTxMonitorModal;
window.simulateFastPunchBatch = simulateFastPunchBatch;
window.flushPunchBufferFromUI = flushPunchBufferFromUI;
