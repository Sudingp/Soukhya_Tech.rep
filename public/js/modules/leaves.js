// ══════════════════════════════════════════════
// 🏢 DIVISIONS CONTROLLER
// ══════════════════════════════════════════════
let divisionsData = [];

async function openDivisionsModal() {
  const m = document.getElementById('divisions-modal');
  if (m) m.style.display = 'flex';
  await loadCompaniesDropdown('div-company-filter');
  await loadDivisionsGrid();
}

function closeDivisionsModal() {
  const m = document.getElementById('divisions-modal');
  if (m) m.style.display = 'none';
}

async function loadDivisionsGrid() {
  try {
    const res = await api('/divisions');
    if (res && res.divisions) {
      divisionsData = res.divisions;
      renderDivisionsTable(divisionsData);
    }
  } catch (err) {
    notify('Failed to load divisions: ' + err.message, 'err');
  }
}

function renderDivisionsTable(list) {
  const tbody = document.getElementById('divisions-tbody');
  const countTag = document.getElementById('div-count-tag');
  if (countTag) countTag.textContent = `${list.length} divisions configured`;
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--mu)">No divisions configured yet. Click "+ Add Division" to create one.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(d => `
    <tr style="border-bottom:1px solid var(--br)">
      <td style="padding:10px 16px; font-weight:700; font-family:var(--mo); color:var(--ac2)">${escapeHTML(d.code)}</td>
      <td style="padding:10px 16px; font-weight:600; color:var(--tx)">${escapeHTML(d.name)}</td>
      <td style="padding:10px 16px"><span class="badge" style="background:rgba(0,212,170,0.1); color:var(--ac); font-size:11px">${escapeHTML(d.company_code || d.company_name || 'All')}</span></td>
      <td style="padding:10px 16px; color:var(--mu)">${escapeHTML(d.head_emp_name || '—')}</td>
      <td style="padding:10px 16px; font-family:var(--mo); font-size:11px">${escapeHTML(d.budget_code || '—')}</td>
      <td style="padding:10px 16px; text-align:center">
        <span class="badge" style="background:${d.active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${d.active ? '#10b981' : '#ef4444'}">
          ${d.active ? 'ACTIVE' : 'INACTIVE'}
        </span>
      </td>
      <td style="padding:10px 16px; text-align:right">
        <button class="btn bsm" style="padding:2px 8px; font-size:11px" onclick="openEditDivisionModal('${d.id}')">✏️</button>
        <button class="btn bsm" style="padding:2px 8px; font-size:11px; color:#ef4444" onclick="deleteDivisionAction('${d.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function filterDivisionsTable() {
  const query = (document.getElementById('div-search-input')?.value || '').toLowerCase();
  const comp = document.getElementById('div-company-filter')?.value || '';

  const filtered = divisionsData.filter(d => {
    const matchesSearch = d.code.toLowerCase().includes(query) || d.name.toLowerCase().includes(query);
    const matchesComp = !comp || d.company_id === comp;
    return matchesSearch && matchesComp;
  });
  renderDivisionsTable(filtered);
}

async function openDivisionFormModal(divId = null) {
  const m = document.getElementById('division-form-modal');
  if (m) m.style.display = 'flex';
  await loadCompaniesDropdown('df-company_id');

  const title = document.getElementById('df-modal-title');
  const idInput = document.getElementById('df-id');
  const codeInput = document.getElementById('df-code');
  const nameInput = document.getElementById('df-name');
  const compSelect = document.getElementById('df-company_id');
  const budgetInput = document.getElementById('df-budget_code');
  const activeChk = document.getElementById('df-active');

  if (divId) {
    const d = divisionsData.find(x => x.id === divId);
    if (d) {
      if (title) title.textContent = 'Edit Division';
      if (idInput) idInput.value = d.id;
      if (codeInput) { codeInput.value = d.code; codeInput.disabled = true; }
      if (nameInput) nameInput.value = d.name;
      if (compSelect) compSelect.value = d.company_id;
      if (budgetInput) budgetInput.value = d.budget_code || '';
      if (activeChk) activeChk.checked = !!d.active;
    }
  } else {
    if (title) title.textContent = 'Add Division';
    if (idInput) idInput.value = '';
    if (codeInput) { codeInput.value = ''; codeInput.disabled = false; }
    if (nameInput) nameInput.value = '';
    if (budgetInput) budgetInput.value = '';
    if (activeChk) activeChk.checked = true;
  }
}

function closeDivisionFormModal() {
  const m = document.getElementById('division-form-modal');
  if (m) m.style.display = 'none';
}

function openEditDivisionModal(id) {
  openDivisionFormModal(id);
}

async function saveDivisionForm(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('df-id')?.value;
  const code = document.getElementById('df-code')?.value.trim();
  const name = document.getElementById('df-name')?.value.trim();
  const company_id = document.getElementById('df-company_id')?.value;
  const budget_code = document.getElementById('df-budget_code')?.value.trim();
  const active = document.getElementById('df-active')?.checked;

  if (!code || !name || !company_id) {
    notify('Please fill out all required fields.', 'wn');
    return;
  }

  try {
    if (id) {
      const res = await api(`/divisions/${id}`, {
        method: 'PUT',
        body: { name, company_id, budget_code, active }
      });
      if (res && res.success) {
        notify('Division updated successfully!', 'ok');
        closeDivisionFormModal();
        await loadDivisionsGrid();
      } else {
        notify(res?.error?.message || 'Update failed.', 'err');
      }
    } else {
      const res = await api('/divisions', {
        method: 'POST',
        body: { code, name, company_id, budget_code, active }
      });
      if (res && res.success) {
        notify('Division created successfully!', 'ok');
        closeDivisionFormModal();
        await loadDivisionsGrid();
      } else {
        notify(res?.error?.message || 'Creation failed.', 'err');
      }
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}

async function deleteDivisionAction(id) {
  if (!confirm('Are you sure you want to permanently delete this division?')) return;
  try {
    const res = await api(`/divisions/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      notify('Division deleted.', 'ok');
      await loadDivisionsGrid();
    } else {
      notify(res?.error?.message || 'Failed to delete division.', 'err');
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}

// ══════════════════════════════════════════════
// 💰 COST CENTERS CONTROLLER
// ══════════════════════════════════════════════
let costCentersData = [];

async function openCostCentersModal() {
  const m = document.getElementById('cost-centers-modal');
  if (m) m.style.display = 'flex';
  await loadCompaniesDropdown('cc-company-filter');
  await loadDepartmentsDropdown('cc-dept-filter');
  await loadCostCentersGrid();
}

function closeCostCentersModal() {
  const m = document.getElementById('cost-centers-modal');
  if (m) m.style.display = 'none';
}

async function loadCostCentersGrid() {
  try {
    const res = await api('/cost-centers');
    if (res && res.cost_centers) {
      costCentersData = res.cost_centers;
      renderCostCentersTable(costCentersData);
    }
  } catch (err) {
    notify('Failed to load cost centers: ' + err.message, 'err');
  }
}

function renderCostCentersTable(list) {
  const tbody = document.getElementById('cost-centers-tbody');
  const countTag = document.getElementById('cc-count-tag');
  if (countTag) countTag.textContent = `${list.length} cost centers configured`;
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--mu)">No cost centers configured yet. Click "+ Add Cost Center" to create one.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(c => `
    <tr style="border-bottom:1px solid var(--br)">
      <td style="padding:10px 16px; font-weight:700; font-family:var(--mo); color:var(--ac2)">${escapeHTML(c.code)}</td>
      <td style="padding:10px 16px; font-weight:600; color:var(--tx)">${escapeHTML(c.name)}</td>
      <td style="padding:10px 16px"><span class="badge" style="background:rgba(0,212,170,0.1); color:var(--ac); font-size:11px">${escapeHTML(c.company_code || c.company_name || 'All')}</span></td>
      <td style="padding:10px 16px; color:var(--mu)">${escapeHTML(c.dept_name || 'General')}</td>
      <td style="padding:10px 16px; font-family:var(--mo); font-size:11px">${escapeHTML(c.gl_account || '—')}</td>
      <td style="padding:10px 16px; text-align:right; font-family:var(--mo); font-weight:700">₹ ${Number(c.annual_budget || 0).toLocaleString('en-IN')}</td>
      <td style="padding:10px 16px; text-align:center">
        <span class="badge" style="background:${c.active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${c.active ? '#10b981' : '#ef4444'}">
          ${c.active ? 'ACTIVE' : 'INACTIVE'}
        </span>
      </td>
      <td style="padding:10px 16px; text-align:right">
        <button class="btn bsm" style="padding:2px 8px; font-size:11px" onclick="openEditCostCenterModal('${c.id}')">✏️</button>
        <button class="btn bsm" style="padding:2px 8px; font-size:11px; color:#ef4444" onclick="deleteCostCenterAction('${c.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function filterCostCentersTable() {
  const query = (document.getElementById('cc-search-input')?.value || '').toLowerCase();
  const comp = document.getElementById('cc-company-filter')?.value || '';
  const dept = document.getElementById('cc-dept-filter')?.value || '';

  const filtered = costCentersData.filter(c => {
    const matchesSearch = c.code.toLowerCase().includes(query) || c.name.toLowerCase().includes(query);
    const matchesComp = !comp || c.company_id === comp;
    const matchesDept = !dept || c.dept_id === dept;
    return matchesSearch && matchesComp && matchesDept;
  });
  renderCostCentersTable(filtered);
}

async function openCostCenterFormModal(ccId = null) {
  const m = document.getElementById('cost-center-form-modal');
  if (m) m.style.display = 'flex';
  await loadCompaniesDropdown('ccf-company_id');
  await loadDepartmentsDropdown('ccf-dept_id');

  const title = document.getElementById('ccf-modal-title');
  const idInput = document.getElementById('ccf-id');
  const codeInput = document.getElementById('ccf-code');
  const nameInput = document.getElementById('ccf-name');
  const compSelect = document.getElementById('ccf-company_id');
  const deptSelect = document.getElementById('ccf-dept_id');
  const glInput = document.getElementById('ccf-gl_account');
  const budgetInput = document.getElementById('ccf-annual_budget');
  const activeChk = document.getElementById('ccf-active');

  if (ccId) {
    const c = costCentersData.find(x => x.id === ccId);
    if (c) {
      if (title) title.textContent = 'Edit Cost Center';
      if (idInput) idInput.value = c.id;
      if (codeInput) { codeInput.value = c.code; codeInput.disabled = true; }
      if (nameInput) nameInput.value = c.name;
      if (compSelect) compSelect.value = c.company_id;
      if (deptSelect) deptSelect.value = c.dept_id || '';
      if (glInput) glInput.value = c.gl_account || '';
      if (budgetInput) budgetInput.value = c.annual_budget || 0;
      if (activeChk) activeChk.checked = !!c.active;
    }
  } else {
    if (title) title.textContent = 'Add Cost Center';
    if (idInput) idInput.value = '';
    if (codeInput) { codeInput.value = ''; codeInput.disabled = false; }
    if (nameInput) nameInput.value = '';
    if (glInput) glInput.value = '';
    if (budgetInput) budgetInput.value = 10000000;
    if (activeChk) activeChk.checked = true;
  }
}

function closeCostCenterFormModal() {
  const m = document.getElementById('cost-center-form-modal');
  if (m) m.style.display = 'none';
}

function openEditCostCenterModal(id) {
  openCostCenterFormModal(id);
}

async function saveCostCenterForm(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('ccf-id')?.value;
  const code = document.getElementById('ccf-code')?.value.trim();
  const name = document.getElementById('ccf-name')?.value.trim();
  const company_id = document.getElementById('ccf-company_id')?.value;
  const dept_id = document.getElementById('ccf-dept_id')?.value || null;
  const gl_account = document.getElementById('ccf-gl_account')?.value.trim();
  const annual_budget = parseFloat(document.getElementById('ccf-annual_budget')?.value || 0);
  const active = document.getElementById('ccf-active')?.checked;

  if (!code || !name || !company_id) {
    notify('Please fill out all required fields.', 'wn');
    return;
  }

  try {
    if (id) {
      const res = await api(`/cost-centers/${id}`, {
        method: 'PUT',
        body: { name, company_id, dept_id, gl_account, annual_budget, active }
      });
      if (res && res.success) {
        notify('Cost center updated successfully!', 'ok');
        closeCostCenterFormModal();
        await loadCostCentersGrid();
      } else {
        notify(res?.error?.message || 'Update failed.', 'err');
      }
    } else {
      const res = await api('/cost-centers', {
        method: 'POST',
        body: { code, name, company_id, dept_id, gl_account, annual_budget, active }
      });
      if (res && res.success) {
        notify('Cost center created successfully!', 'ok');
        closeCostCenterFormModal();
        await loadCostCentersGrid();
      } else {
        notify(res?.error?.message || 'Creation failed.', 'err');
      }
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}

async function deleteCostCenterAction(id) {
  if (!confirm('Are you sure you want to permanently delete this cost center?')) return;
  try {
    const res = await api(`/cost-centers/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      notify('Cost center deleted.', 'ok');
      await loadCostCentersGrid();
    } else {
      notify(res?.error?.message || 'Failed to delete cost center.', 'err');
    }
  } catch (err) {
    notify(`Error: ${err.message}`, 'err');
  }
}
