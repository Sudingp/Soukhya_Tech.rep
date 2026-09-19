// ══════════════════════════════════════════════
// Employee List Grid Management
// ══════════════════════════════════════════════
function renderEmployeeGrid() {
  const limitInput = document.getElementById('emp-list-records-limit');
  let limit = limitInput ? parseInt(limitInput.value) : 20;
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 10000) limit = 10000;
  if (limitInput) limitInput.value = limit;

  // Retrieve filter values
  const compFilter = document.getElementById('emp-list-filter-company')?.value || 'All';
  const desFilter  = document.getElementById('emp-list-filter-designation')?.value || 'All';
  const statFilter = document.getElementById('emp-list-filter-status')?.value || 'All';
  const typeFilter = document.getElementById('emp-list-filter-emptype')?.value || 'All';

  // 1. Filter
  let filtered = EMP.filter(e => {
    const eComp = e.company || 'Default';
    if (compFilter !== 'All' && eComp !== compFilter) return false;

    const eRole = e.role || '';
    if (desFilter !== 'All' && eRole !== desFilter) return false;

    const eStat = e.status || 'Active';
    if (statFilter !== 'All' && eStat !== statFilter) return false;

    const eType = e.employmentType || e.employment_type || 'Permanent';
    if (typeFilter !== 'All' && eType !== typeFilter) return false;

    return true;
  });

  // 2. Sort
  filtered.sort((a, b) => {
    let valA, valB;
    if (empListSortField === 'id') {
      valA = a.id || '';
      valB = b.id || '';
      const numA = parseInt(valA.replace(/\D/g, ''));
      const numB = parseInt(valB.replace(/\D/g, ''));
      if (!isNaN(numA) && !isNaN(numB)) {
        return empListSortAsc ? numA - numB : numB - numA;
      }
    } else if (empListSortField === 'name') {
      valA = a.name || '';
      valB = b.name || '';
    } else if (empListSortField === 'company') {
      valA = a.company || 'Default';
      valB = b.company || 'Default';
    } else if (empListSortField === 'department') {
      valA = a.department || a.dept || '';
      valB = b.department || b.dept || '';
    } else if (empListSortField === 'role') {
      valA = a.role || '';
      valB = b.role || '';
    } else if (empListSortField === 'location') {
      valA = a.location || 'HQ - Bangalore';
      valB = b.location || 'HQ - Bangalore';
    } else if (empListSortField === 'category') {
      valA = a.category || 'Default';
      valB = b.category || 'Default';
    } else {
      valA = a[empListSortField] || '';
      valB = b[empListSortField] || '';
    }

    valA = String(valA).toLowerCase();
    valB = String(valB).toLowerCase();
    if (valA < valB) return empListSortAsc ? -1 : 1;
    if (valA > valB) return empListSortAsc ? 1 : -1;
    return 0;
  });

  // 3. Paginate
  const totalRecords = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
  if (empListPage > totalPages) empListPage = totalPages;
  if (empListPage < 1) empListPage = 1;

  const startIndex = (empListPage - 1) * limit;
  const endIndex = Math.min(startIndex + limit, totalRecords);
  const pageRecords = filtered.slice(startIndex, endIndex);

  // Update headers indicators dynamically
  const headers = document.querySelectorAll('#tab-employee-list thead th');
  const sortFields = ['id', 'name', 'company', 'department', 'role', 'location', 'category'];
  sortFields.forEach((f, idx) => {
    if (headers[idx]) {
      const colName = headers[idx].textContent.replace(/[⇅▲▼]/g, '').trim();
      const indicator = empListSortField === f ? (empListSortAsc ? '▲' : '▼') : '⇅';
      headers[idx].innerHTML = `${colName} ${indicator}`;
    }
  });

  // Render rows
  const tbody = document.getElementById('emp-list-grid-body');
  if (!tbody) return;

  if (pageRecords.length === 0) {
    tbody.innerHTML = `<tr><td colspan="15" class="emp" style="text-align:center; padding:12px; color:var(--mu)">No employees found matching filters.</td></tr>`;
    const gridInfo = document.getElementById('emp-list-grid-info');
    if (gridInfo) gridInfo.textContent = 'Records: 0 - 0 of 0';
    const pageNum = document.getElementById('emp-list-page-num');
    if (pageNum) pageNum.textContent = '1';
    return;
  }

  let html = '';
  pageRecords.forEach(e => {
    const company = e.company || 'Default';
    const dept = e.department || e.dept || 'N/A';
    const role = e.role || 'N/A';
    const loc = e.location || 'HQ - Bangalore';
    const cat = e.category || 'Default';

    html += `
      <tr style="border-bottom:1px solid #eee">
        <td style="padding:8px; border-right:1px solid #ccc; font-family:var(--mo); font-weight:bold">${e.id}</td>
        <td style="padding:8px; border-right:1px solid #ccc; font-weight:bold">${e.name}</td>
        <td style="padding:8px; border-right:1px solid #ccc">${company}</td>
        <td style="padding:8px; border-right:1px solid #ccc">${dept}</td>
        <td style="padding:8px; border-right:1px solid #ccc">${role}</td>
        <td style="padding:8px; border-right:1px solid #ccc">${loc}</td>
        <td style="padding:8px; border-right:1px solid #ccc">${cat}</td>
        <td style="padding:8px; border-right:1px solid #ccc; text-align:center">
          <a href="#" style="color:#0055aa; text-decoration:none" onclick="event.preventDefault(); showLeaveSummary('${e.id}')">Leave Summary</a>
        </td>
        <td style="padding:8px; border-right:1px solid #ccc; text-align:center">
          <a href="#" style="color:#0055aa; text-decoration:none" onclick="event.preventDefault(); showShiftDetails('${e.id}')">Shift Details</a>
        </td>
        <td style="padding:8px; border-right:1px solid #ccc; text-align:center">
          <a href="#" style="color:#0055aa; text-decoration:none" onclick="event.preventDefault(); showOtherDetails('${e.id}')">Other Details</a>
        </td>
        <td style="padding:8px; border-right:1px solid #ccc; text-align:center">
          <a href="#" style="color:#0055aa; text-decoration:none" onclick="event.preventDefault(); showPayDetails('${e.id}')">Pay Details</a>
        </td>
        <td style="padding:8px; border-right:1px solid #ccc; text-align:center">
          <a href="#" style="color:#0055aa; text-decoration:none" onclick="event.preventDefault(); showEmployeePhoto('${e.id}')">Photo</a>
        </td>
        <td style="padding:8px; border-right:1px solid #ccc; text-align:center">
          <a href="#" style="color:#cc0000; text-decoration:none; font-weight:bold" onclick="event.preventDefault(); deleteEmployeeList('${e.id}')">Delete</a>
        </td>
        <td style="padding:8px; border-right:1px solid #ccc; text-align:center">
          <a href="#" style="color:#0055aa; text-decoration:none; font-weight:bold" onclick="event.preventDefault(); openEmpModal('${e.id}')">Edit</a>
        </td>
        <td style="padding:8px; text-align:center">
          <a href="#" style="color:#0055aa; text-decoration:none" onclick="event.preventDefault(); enrollFinger('${e.id}')">Finger</a>
          <span style="color:#ccc; margin:0 3px">|</span>
          <a href="#" style="color:#0055aa; text-decoration:none" onclick="event.preventDefault(); showEmployeePhoto('${e.id}')">BioPhoto</a>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;

  // Update paginator label
  const gridInfo = document.getElementById('emp-list-grid-info');
  if (gridInfo) {
    gridInfo.textContent = `Records: ${startIndex + 1} - ${endIndex} of ${totalRecords}`;
  }

  const pageNum = document.getElementById('emp-list-page-num');
  if (pageNum) {
    pageNum.textContent = empListPage;
  }
}

function filterEmployeeGrid() {
  empListPage = 1;
  renderEmployeeGrid();
  notify('Employee list refreshed.', 'ok');
}

function sortEmployeesList(field) {
  if (empListSortField === field) {
    empListSortAsc = !empListSortAsc;
  } else {
    empListSortField = field;
    empListSortAsc = true;
  }
  renderEmployeeGrid();
}

function updateEmpListPagination() {
  empListPage = 1;
  renderEmployeeGrid();
}

function prevEmpListPage() {
  if (empListPage > 1) {
    empListPage--;
    renderEmployeeGrid();
  }
}

function nextEmpListPage() {
  const limitInput = document.getElementById('emp-list-records-limit');
  let limit = limitInput ? parseInt(limitInput.value) : 20;
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 10000) limit = 10000;
  
  const compFilter = document.getElementById('emp-list-filter-company')?.value || 'All';
  const desFilter  = document.getElementById('emp-list-filter-designation')?.value || 'All';
  const statFilter = document.getElementById('emp-list-filter-status')?.value || 'All';
  const typeFilter = document.getElementById('emp-list-filter-emptype')?.value || 'All';

  const count = EMP.filter(e => {
    const eComp = e.company || 'Default';
    if (compFilter !== 'All' && eComp !== compFilter) return false;
    const eRole = e.role || '';
    if (desFilter !== 'All' && eRole !== desFilter) return false;
    const eStat = e.status || 'Active';
    if (statFilter !== 'All' && eStat !== statFilter) return false;
    const eType = e.employmentType || e.employment_type || 'Permanent';
    if (typeFilter !== 'All' && eType !== typeFilter) return false;
    return true;
  }).length;

  const totalPages = Math.ceil(count / limit);
  if (empListPage < totalPages) {
    empListPage++;
    renderEmployeeGrid();
  }
}

function updateEmpListFilterDropdowns() {
  // 1. Company Filter
  const compSelect = document.getElementById('emp-list-filter-company');
  if (compSelect) {
    const currentVal = compSelect.value || 'All';
    compSelect.innerHTML = '<option value="All">All</option>';
    COMPANIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.short;
      opt.textContent = c.short;
      compSelect.appendChild(opt);
    });
    if (Array.from(compSelect.options).some(o => o.value === currentVal)) {
      compSelect.value = currentVal;
    }
  }

  // 2. Designation Filter
  const desSelect = document.getElementById('emp-list-filter-designation');
  if (desSelect) {
    const currentVal = desSelect.value || 'All';
    desSelect.innerHTML = '<option value="All">All</option>';
    
    // Get unique non-empty designations
    const designations = [...new Set(EMP.map(e => e.role).filter(Boolean))].sort();
    designations.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      desSelect.appendChild(opt);
    });
    if (Array.from(desSelect.options).some(o => o.value === currentVal)) {
      desSelect.value = currentVal;
    }
  }
}

function showEmployeePhoto(id) {
  const emp = EMP.find(e => e.id === id);
  if (!emp) return;
  const html = `
    <div style="text-align:center; padding:15px">
      <div style="font-size:14px; font-weight:600; margin-bottom:12px; color:var(--ac); font-family:var(--sa)">Employee Photo — ${emp.name}</div>
      ${emp.image || emp.img ? `<img src="${emp.image || emp.img}" style="max-width:100%; max-height:300px; border-radius:8px; border:2px solid var(--ac)">` : '<div style="color:var(--mu); font-size:12px; font-family:var(--sa)">No face camera snapshot registered.</div>'}
    </div>
  `;
  openInfoDrawer('Photo Preview', html);
}

async function deleteEmployeeList(id) {
  if (!confirm(`Remove employee ${id} from the system? Their attendance records will also be deleted.`)) return;
  const res = await apiDelete('/api/employees/' + id);
  if (res.success) {
    EMP = EMP.filter(e => e.id !== id);
    ATT = ATT.filter(a => a.empId !== id);
    renderEL();
    renderLog();
    updateStats();
    notify('Employee removed from database.', 'wn');
  } else {
    notify(res.error || 'Failed to delete employee.', 'er');
  }
}
