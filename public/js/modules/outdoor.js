// ══════════════════════════════════════════════
// 👔 DESIGNATIONS CONTROLLER
// ══════════════════════════════════════════════
let designationsData = [];

async function openDesignationsModal() {
  const m = document.getElementById('designations-modal');
  if (m) m.style.display = 'flex';
  await loadDepartmentsDropdown('des-dept-filter');
  await loadDesignationsGrid();
}

function closeDesignationsModal() {
  const m = document.getElementById('designations-modal');
  if (m) m.style.display = 'none';
}

async function loadDesignationsGrid() {
  try {
    const res = await api('/designations');
    if (res && res.designations) {
      designationsData = res.designations;
      renderDesignationsTable(designationsData);
    }
  } catch (err) {
    notify('Failed to load designations: ' + err.message, 'err');
  }
}

function renderDesignationsTable(list) {
  const tbody = document.getElementById('designations-tbody');
  const countTag = document.getElementById('des-count-tag');
  if (countTag) countTag.textContent = `${list.length} designations configured`;
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--mu)">No designations configured yet. Click "+ Add Designation" to create one.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(d => `
    <tr style="border-bottom:1px solid var(--br)">
      <td style="padding:10px 16px; font-weight:700; font-family:var(--mo); color:var(--ac2)">${escapeHTML(d.code)}</td>
      <td style="padding:10px 16px; font-weight:600; color:var(--tx)">${escapeHTML(d.name)}</td>
      <td style="padding:10px 16px; color:var(--mu)">${escapeHTML(d.dept_name || 'General')}</td>
      <td style="padding:10px 16px; text-align:center"><span class="badge" style="background:rgba(139,92,246,0.15); color:#8b5cf6">${escapeHTML(d.grade_level || 'L1')}</span></td>
      <td style="padding:10px 16px; font-size:11px; color:var(--mu)">${escapeHTML(d.description || '—')}</td>
      <td style="padding:10px 16px; text-align:center">
        <span class="badge" style="background:${d.active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${d.active ? '#10b981' : '#ef4444'}">
          ${d.active ? 'ACTIVE' : 'INACTIVE'}
        </span>
      </td>
      <td style="padding:10px 16px; text-align:right">
        <button class="btn bsm" style="padding:2px 8px; font-size:11px" onclick="openEditDesignationModal('${d.id}')">✏️</button>
        <button class="btn bsm" style="padding:2px 8px; font-size:11px; color:#ef4444" onclick="deleteDesignationAction('${d.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function filterDesignationsTable() {
  const query = (document.getElementById('des-search-input')?.value || '').toLowerCase();
  const dept = document.getElementById('des-dept-filter')?.value || '';

  const filtered = designationsData.filter(d => {
    const matchesSearch = d.code.toLowerCase().includes(query) || d.name.toLowerCase().includes(query);
    const matchesDept = !dept || d.dept_id === dept;
    return matchesSearch && matchesDept;
  });
  renderDesignationsTable(filtered);
}

async function openDesignationFormModal(desId = null) {
  const m = document.getElementById('designation-form-modal');
  if (m) m.style.display = 'flex';
  await loadDepartmentsDropdown('desf-dept_id');

  const title = document.getElementById('desf-modal-title');
  const idInput = document.getElementById('desf-id');
  const codeInput = document.getElementById('desf-code');
  const nameInput = document.getElementById('desf-name');
  const deptSelect = document.getElementById('desf-dept_id');
  const gradeSelect = document.getElementById('desf-grade_level');
  const descInput = document.getElementById('desf-description');
  const activeChk = document.getElementById('desf-active');

  if (desId) {
    const d = designationsData.find(x => x.id === desId);
    if (d) {
      if (title) title.textContent = 'Edit Designation';
      if (idInput) idInput.value = d.id;
      if (codeInput) { codeInput.value = d.code; codeInput.disabled = true; }
      if (nameInput) nameInput.value = d.name;
      if (deptSelect) deptSelect.value = d.dept_id || '';
      if (gradeSelect) gradeSelect.value = d.grade_level || 'L1';
      if (descInput) descInput.value = d.description || '';
      if (activeChk) activeChk.checked = !!d.active;
    }
  } else {
    if (title) title.textContent = 'Add Designation';
    if (idInput) idInput.value = '';
    if (codeInput) { codeInput.value = ''; codeInput.disabled = false; }
    if (nameInput) nameInput.value = '';
    if (descInput) descInput.value = '';
    if (activeChk) activeChk.checked = true;
  }
}

function closeDesignationFormModal() {
  const m = document.getElementById('designation-form-modal');
  if (m) m.style.display = 'none';
}

function openEditDesignationModal(id) {
  openDesignationFormModal(id);
}

async function saveDesignationForm(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('desf-id')?.value;
  const code = document.getElementById('desf-code')?.value.trim();
  const name = document.getElementById('desf-name')?.value.trim();
  const dept_id = document.getElementById('desf-dept_id')?.value || null;
  const grade_level = document.getElementById('desf-grade_level')?.value || 'L1';
  const description = document.getElementById('desf-description')?.value.trim();
  const active = document.getElementById('desf-active')?.checked;

  if (!code || !name) {
    notify('Please fill out all required fields.', 'wn');
    return;
  }

  try {
    if (id) {
      const res = await api(`/designations/${id}`, {
        method: 'PUT',
        body: { name, dept_id, grade_level, description, active }
      });
      if (res && res.success) {
        notify('Designation updated successfully!', 'ok');
        closeDesignationFormModal();
        await loadDesignationsGrid();
      } else {
        notify(res?.error?.message || 'Update failed.', 'err');
      }
    } else {
      const res = await api('/designations', {
        method: 'POST',
        body: { code, name, dept_id, grade_level, description, active }
      });
      if (res && res.success) {
        notify('Designation created successfully!', 'ok');
        closeDesignationFormModal();
        await loadDesignationsGrid();
      } else {
        notify(res?.error?.message || 'Creation failed.', 'err');
      }
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}

async function deleteDesignationAction(id) {
  if (!confirm('Are you sure you want to permanently delete this designation?')) return;
  try {
    const res = await api(`/designations/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      notify('Designation deleted.', 'ok');
      await loadDesignationsGrid();
    } else {
      notify(res?.error?.message || 'Failed to delete designation.', 'err');
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}

// ══════════════════════════════════════════════
// 📍 BRANCHES CONTROLLER
// ══════════════════════════════════════════════
let branchesData = [];

async function openBranchesModal() {
  const m = document.getElementById('branches-modal');
  if (m) m.style.display = 'flex';
  await loadBranchesGrid();
}

function closeBranchesModal() {
  const m = document.getElementById('branches-modal');
  if (m) m.style.display = 'none';
}

async function loadBranchesGrid() {
  try {
    const res = await api('/branches');
    if (res && res.branches) {
      branchesData = res.branches;
      renderBranchesTable(branchesData);
      populateBranchCityFilter(branchesData);
    }
  } catch (err) {
    notify('Failed to load branches: ' + err.message, 'err');
  }
}

function populateBranchCityFilter(list) {
  const select = document.getElementById('br-city-filter');
  if (!select) return;
  const cities = [...new Set(list.map(b => b.city).filter(Boolean))];
  select.innerHTML = '<option value="">All Cities</option>' + cities.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
}

function renderBranchesTable(list) {
  const tbody = document.getElementById('branches-tbody');
  const countTag = document.getElementById('br-count-tag');
  if (countTag) countTag.textContent = `${list.length} branches configured`;
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--mu)">No branches configured yet. Click "+ Add Branch" to create one.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(b => `
    <tr style="border-bottom:1px solid var(--br)">
      <td style="padding:10px 16px; font-weight:700; font-family:var(--mo); color:var(--ac2)">${escapeHTML(b.code)}</td>
      <td style="padding:10px 16px; font-weight:600; color:var(--tx)">${escapeHTML(b.name)}</td>
      <td style="padding:10px 16px; color:var(--tx)">${escapeHTML(b.city)}, ${escapeHTML(b.state)}</td>
      <td style="padding:10px 16px; font-size:11px; color:var(--mu)">${escapeHTML(b.address || '—')}</td>
      <td style="padding:10px 16px"><span class="badge" style="background:rgba(0,212,170,0.1); color:var(--ac); font-size:11px">${escapeHTML(b.geofence_name || 'None')}</span></td>
      <td style="padding:10px 16px; text-align:center">
        <span class="badge" style="background:${b.active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${b.active ? '#10b981' : '#ef4444'}">
          ${b.active ? 'ACTIVE' : 'INACTIVE'}
        </span>
      </td>
      <td style="padding:10px 16px; text-align:right">
        <button class="btn bsm" style="padding:2px 8px; font-size:11px" onclick="openEditBranchModal('${b.id}')">✏️</button>
        <button class="btn bsm" style="padding:2px 8px; font-size:11px; color:#ef4444" onclick="deleteBranchAction('${b.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function filterBranchesTable() {
  const query = (document.getElementById('br-search-input')?.value || '').toLowerCase();
  const city = document.getElementById('br-city-filter')?.value || '';

  const filtered = branchesData.filter(b => {
    const matchesSearch = b.code.toLowerCase().includes(query) || b.name.toLowerCase().includes(query) || (b.address && b.address.toLowerCase().includes(query));
    const matchesCity = !city || b.city === city;
    return matchesSearch && matchesCity;
  });
  renderBranchesTable(filtered);
}

async function openBranchFormModal(brId = null) {
  const m = document.getElementById('branch-form-modal');
  if (m) m.style.display = 'flex';
  await loadGeofencesDropdown('brf-geofence_id');

  const title = document.getElementById('brf-modal-title');
  const idInput = document.getElementById('brf-id');
  const codeInput = document.getElementById('brf-code');
  const nameInput = document.getElementById('brf-name');
  const addrInput = document.getElementById('brf-address');
  const cityInput = document.getElementById('brf-city');
  const stateInput = document.getElementById('brf-state');
  const pinInput = document.getElementById('brf-pincode');
  const geoSelect = document.getElementById('brf-geofence_id');
  const activeChk = document.getElementById('brf-active');

  if (brId) {
    const b = branchesData.find(x => x.id === brId);
    if (b) {
      if (title) title.textContent = 'Edit Branch Location';
      if (idInput) idInput.value = b.id;
      if (codeInput) { codeInput.value = b.code; codeInput.disabled = true; }
      if (nameInput) nameInput.value = b.name;
      if (addrInput) addrInput.value = b.address || '';
      if (cityInput) cityInput.value = b.city || 'Bangalore';
      if (stateInput) stateInput.value = b.state || 'Karnataka';
      if (pinInput) pinInput.value = b.pincode || '';
      if (geoSelect) geoSelect.value = b.geofence_id || '';
      if (activeChk) activeChk.checked = !!b.active;
    }
  } else {
    if (title) title.textContent = 'Add Branch Location';
    if (idInput) idInput.value = '';
    if (codeInput) { codeInput.value = ''; codeInput.disabled = false; }
    if (nameInput) nameInput.value = '';
    if (addrInput) addrInput.value = '';
    if (pinInput) pinInput.value = '';
    if (activeChk) activeChk.checked = true;
  }
}

function closeBranchFormModal() {
  const m = document.getElementById('branch-form-modal');
  if (m) m.style.display = 'none';
}

function openEditBranchModal(id) {
  openBranchFormModal(id);
}

async function saveBranchForm(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('brf-id')?.value;
  const code = document.getElementById('brf-code')?.value.trim();
  const name = document.getElementById('brf-name')?.value.trim();
  const address = document.getElementById('brf-address')?.value.trim();
  const city = document.getElementById('brf-city')?.value.trim();
  const state = document.getElementById('brf-state')?.value.trim();
  const pincode = document.getElementById('brf-pincode')?.value.trim();
  const geofence_id = document.getElementById('brf-geofence_id')?.value || null;
  const active = document.getElementById('brf-active')?.checked;

  if (!code || !name || !city || !state) {
    notify('Please fill out all required fields.', 'wn');
    return;
  }

  try {
    if (id) {
      const res = await api(`/branches/${id}`, {
        method: 'PUT',
        body: { name, address, city, state, pincode, geofence_id, active }
      });
      if (res && res.success) {
        notify('Branch location updated successfully!', 'ok');
        closeBranchFormModal();
        await loadBranchesGrid();
      } else {
        notify(res?.error?.message || 'Update failed.', 'err');
      }
    } else {
      const res = await api('/branches', {
        method: 'POST',
        body: { code, name, address, city, state, pincode, geofence_id, active }
      });
      if (res && res.success) {
        notify('Branch location created successfully!', 'ok');
        closeBranchFormModal();
        await loadBranchesGrid();
      } else {
        notify(res?.error?.message || 'Creation failed.', 'err');
      }
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}

async function deleteBranchAction(id) {
  if (!confirm('Are you sure you want to permanently delete this branch location?')) return;
  try {
    const res = await api(`/branches/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      notify('Branch location deleted.', 'ok');
      await loadBranchesGrid();
    } else {
      notify(res?.error?.message || 'Failed to delete branch.', 'err');
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}
