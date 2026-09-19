
  nodesToReplace.forEach(node => {
    const val = node.nodeValue;
    const parent = node.parentNode;
    const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
    const html = val.replace(regex, '<mark style="background:yellow; color:black">$1</mark>');
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    while (tempDiv.firstChild) {
      parent.insertBefore(tempDiv.firstChild, node);
    }
    parent.removeChild(node);
  });

  notify(`Found matches for "${query}".`, 'ok');
}

function removeHighlights(container) {
  const marks = container.querySelectorAll('mark');
  marks.forEach(mark => {
    const parent = mark.parentNode;
    const textNode = document.createTextNode(mark.textContent);
    parent.replaceChild(textNode, mark);
    parent.normalize();
  });
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ══════════════════════════════════════════════
// Company List Configuration Management
// ══════════════════════════════════════════════
function renderCompanyGrid() {
  const limitInput = document.getElementById('company-records-limit');
  let limit = limitInput ? parseInt(limitInput.value) : 10;
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > 10000) limit = 10000;
  if (limitInput) limitInput.value = limit;

  // 1. Sort
  const sorted = [...COMPANIES].sort((a, b) => {
    let valA = (a[companySortField] || '').toLowerCase();
    let valB = (b[companySortField] || '').toLowerCase();
    if (valA < valB) return companySortAsc ? -1 : 1;
    if (valA > valB) return companySortAsc ? 1 : -1;
    return 0;
  });

  // 2. Pagination
  const totalRecords = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
  if (companyPage > totalPages) companyPage = totalPages;
  if (companyPage < 1) companyPage = 1;

  const startIndex = (companyPage - 1) * limit;
  const endIndex = Math.min(startIndex + limit, totalRecords);
  const pageRecords = sorted.slice(startIndex, endIndex);

  // Update headers arrows dynamically
  const headers = document.querySelectorAll('#tab-company thead th');
  if (headers.length >= 2) {
    headers[0].innerHTML = `Company Name ${companySortField === 'name' ? (companySortAsc ? '▲' : '▼') : '⇅'}`;
    headers[1].innerHTML = `Short Name ${companySortField === 'short' ? (companySortAsc ? '▲' : '▼') : '⇅'}`;
  }

  // Render rows
  const tbody = document.getElementById('company-grid-body');
  if (!tbody) return;

  if (pageRecords.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="emp" style="text-align:center; padding:12px; color:var(--mu)">No companies registered.</td></tr>`;
    const gridInfo = document.getElementById('company-grid-info');
    if (gridInfo) gridInfo.textContent = 'Records: 0 - 0 of 0';
    const pageNum = document.getElementById('company-page-num');
    if (pageNum) pageNum.textContent = '1';
    return;
  }

  let html = '';
  pageRecords.forEach((c) => {
    const origIndex = COMPANIES.findIndex(comp => comp.name === c.name && comp.short === c.short);
    const empCount = c.employee_count || 0;
    html += `
      <tr style="border-bottom:1px solid #eee">
        <td style="padding:8px; border-right:1px solid #ccc; font-weight:bold">${c.name}</td>
        <td style="padding:8px; border-right:1px solid #ccc">${c.short}</td>
        <td style="padding:8px; border-right:1px solid #ccc; text-align:center">
          <span style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:bold; background:rgba(30,136,229,0.12); color:#1565c0; border:1px solid rgba(30,136,229,0.3)">
            👥 ${empCount.toLocaleString()}
          </span>
        </td>
        <td style="padding:8px; border-right:1px solid #ccc; text-align:center">
          <a href="#" style="color:#0055aa; text-decoration:none" onclick="event.preventDefault(); notify('Logo link clicked for ${c.short}', 'ok')">Logo</a>
        </td>
        <td style="padding:8px; border-right:1px solid #ccc; text-align:center">
          <a href="#" style="color:#0055aa; text-decoration:none" onclick="event.preventDefault(); openEditCompanyModal(${origIndex})">Edit</a>
        </td>
        <td style="padding:8px; text-align:center">
          <a href="#" style="color:#cc0000; text-decoration:none" onclick="event.preventDefault(); deleteCompanyItem(${origIndex})">Delete</a>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;

  // Update pagination UI
  const gridInfo = document.getElementById('company-grid-info');
  if (gridInfo) {
    if (totalRecords === 0) {
      gridInfo.textContent = 'Records: 0 - 0 of 0';
    } else {
      gridInfo.textContent = `Records: ${startIndex + 1} - ${endIndex} of ${totalRecords}`;
    }
  }

  const pageNum = document.getElementById('company-page-num');
  if (pageNum) {
    pageNum.textContent = companyPage;
  }
}

function sortCompanies(field) {
  if (companySortField === field) {
    companySortAsc = !companySortAsc;
  } else {
    companySortField = field;
    companySortAsc = true;
  }
  renderCompanyGrid();
}

function updateCompanyPagination() {
  companyPage = 1;
  renderCompanyGrid();
}

function prevCompanyPage() {
  if (companyPage > 1) {
    companyPage--;
    renderCompanyGrid();
  }
}

function nextCompanyPage() {
  const limitInput = document.getElementById('company-records-limit');
  let limit = limitInput ? parseInt(limitInput.value) : 10;
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > 10000) limit = 10000;
  
  const totalPages = Math.ceil(COMPANIES.length / limit);
  if (companyPage < totalPages) {
    companyPage++;
    renderCompanyGrid();
  }
}

function openAddCompanyModal() {
  document.getElementById('comp-modal-title').textContent = 'Add Company';
  document.getElementById('comp-edit-index').value = '';
  document.getElementById('comp-name').value = '';
  document.getElementById('comp-short').value = '';
  document.getElementById('company-modal').style.display = 'flex';
}

function openEditCompanyModal(idx) {
  const c = COMPANIES[idx];
  if (!c) return;
  document.getElementById('comp-modal-title').textContent = 'Edit Company';
  document.getElementById('comp-edit-index').value = idx;
  document.getElementById('comp-name').value = c.name;
  document.getElementById('comp-short').value = c.short;
  document.getElementById('company-modal').style.display = 'flex';
}

function closeCompanyModal() {
  document.getElementById('company-modal').style.display = 'none';
}

async function loadCompaniesFromAPI() {
  try {
    const res = await apiFetch('/api/companies');
    if (res && res.success && Array.isArray(res.companies)) {
      COMPANIES = res.companies.map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        short: c.short_name || c.short || c.code,
        short_name: c.short_name || c.short || c.code,
        address: c.address,
        city: c.city,
        employee_count: c.employee_count || 0,
        active: c.active
      }));
      updateCompanySelects();
      renderCompanyGrid();
    }
  } catch (e) {
    console.warn('[LOAD COMPANIES]', e.message);
  }
}

async function saveCompanyModal() {
  const idxVal = document.getElementById('comp-edit-index').value;
  const name = document.getElementById('comp-name').value.trim();
  const short = document.getElementById('comp-short').value.trim();

  if (!name || !short) {
    notify('Company Name and Short Name are required.', 'wn');
    return;
  }

  const payload = {
    name,
    code: short.toUpperCase(),
    short_name: short
  };

  if (idxVal === '') {
    // Add
    const res = await apiPost('/api/companies', payload);
    if (res && res.success) {
      notify(`Company "${name}" registered successfully.`, 'ok');
      closeCompanyModal();
      await loadCompaniesFromAPI();
    } else {
      notify((res && res.error && res.error.message) || 'Failed to register company', 'er');
    }
  } else {
    // Edit
    const idx = parseInt(idxVal);
    const c = COMPANIES[idx];
    if (!c) return;
    const compId = c.id || c.code || short;
    const res = await apiPut(`/api/companies/${compId}`, payload);
    if (res && res.success) {
      notify(`Company details updated.`, 'ok');
      closeCompanyModal();
      await loadCompaniesFromAPI();
    } else {
      notify((res && res.error && res.error.message) || 'Failed to update company', 'er');
    }
  }
}

async function deleteCompanyItem(idx) {
  const c = COMPANIES[idx];
  if (!c) return;
  if (!confirm(`Are you sure you want to delete company "${c.name}"?`)) return;

  const compId = c.id || c.code || c.short;
  const res = await apiDelete(`/api/companies/${compId}`);
  if (res && res.success) {
    notify(`Company deleted successfully.`, 'wn');
    await loadCompaniesFromAPI();
  } else {
    notify((res && res.error && res.error.message) || 'Failed to delete company', 'er');
  }
}

function updateCompanySelects() {
  const selects = ['r-company', 'm-company', 'rep-company', 'emp-list-filter-company'];
  selects.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    
    const currentVal = select.value;
    select.innerHTML = '';
    
    if (id === 'rep-company' || id === 'emp-list-filter-company') {
      const optAll = document.createElement('option');
      optAll.value = 'All';
      optAll.textContent = 'All Companies';
      select.appendChild(optAll);
    }
    
    COMPANIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.short || c.code;
      opt.textContent = `${c.short || c.code} - ${c.name}`;
      select.appendChild(opt);
    });
    
    if (Array.from(select.options).some(o => o.value === currentVal)) {
      select.value = currentVal;
    } else {
      if (select.options.length > 0) {
        select.selectedIndex = 0;
      }
    }
  });
}
