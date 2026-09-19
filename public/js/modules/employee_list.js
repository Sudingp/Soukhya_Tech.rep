// ══════════════════════════════════════════════
// Roster Filtering (Employee list)
// ══════════════════════════════════════════════
function filterEmpDirectory(status, btn) {
  currentDirFilter = status;
  
  // Toggle active class on selection pills
  document.querySelectorAll('.ef-pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  
  renderEL();
}

// ── Toggle detailed profile accordion drawer in list ──
function toggleEmployeeDetails(id, event) {
  const details = document.getElementById(id);
  if (!details) return;
  
  // Don't trigger if click occurred on the delete button
  if (event.target.closest('button')) return;
  
  if (details.style.display === 'none') {
    details.style.display = 'block';
    details.parentElement.classList.add('selected-item');
  } else {
    details.style.display = 'none';
    details.parentElement.classList.remove('selected-item');
  }
}

// ══════════════════════════════════════════════
// Render Employee List
// ══════════════════════════════════════════════
function renderEL() {
  const el = document.getElementById('elist');
  const searchInput = document.getElementById('emp-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  
  // Apply directory filters
  let filtered = [...EMP];
  if (currentDirFilter !== 'All') {
    filtered = EMP.filter(e => e.status === currentDirFilter);
  }

  // Apply search query filter
  if (query) {
    filtered = filtered.filter(e => 
      (e.name || '').toLowerCase().includes(query) ||
      (e.id || '').toLowerCase().includes(query) ||
      (e.department || e.dept || '').toLowerCase().includes(query) ||
      (e.role || '').toLowerCase().includes(query)
    );
  }

  document.getElementById('ecnt').textContent = filtered.length + ' employee' + (filtered.length !== 1 ? 's' : '');

  if (!filtered.length) {
    el.innerHTML = `<div class="emp">No employees match filters.</div>`;
    return;
  }

  el.innerHTML = filtered.map(e => {
    let chipClass = 'cp'; // Active
    if (e.status === 'Hibernate') chipClass = 'cl';
    if (e.status === 'On Leave') chipClass = 'cb';
    if (e.status === 'Resigned') chipClass = 'cu';

    const hTitle = e.status === 'Hibernate' 
      ? `title="Reason: ${e.hibernate_reason || 'N/A'}\nDates: ${e.hibernate_start_date} to ${e.hibernate_end_date}"` 
      : '';

    // Standardize database properties loaded via Spring API vs newly pushed
    const company = e.company || 'N/A';
    const gender = e.gender || 'N/A';
    const cardNo = e.cardNumber || e.card_number || 'N/A';
    const phone = e.phoneNo || e.phone_no || 'N/A';
    const email = e.email || 'N/A';
    const reporting = e.reportingTo || e.reporting_to || 'N/A';
    const aadhaar = e.aadhaarNumber || e.aadhaar_number || 'N/A';
    const pan = e.panNumber || e.pan_number || 'N/A';
    const joined = e.dateOfJoining || e.date_of_joining || 'N/A';
    const confirmed = e.dateOfConfirmation || e.date_of_confirmation || 'N/A';
    const exited = e.lastWorkingDay || e.last_working_day || 'N/A';
    const loc = e.location || 'N/A';
    const empType = e.employmentType || e.employment_type || 'N/A';

    return `
      <div class="eit eit-clickable" onclick="toggleEmployeeDetails('details-${e.id}', event)">
        <div style="display:flex;align-items:center;width:100%;gap:9px">
          <div class="eav">
            ${e.image || e.img ? `<img src="${e.image || e.img}" alt="${e.name}">` : ''}
          </div>
          <div class="eii">
            <div class="ein">${e.name}</div>
            <div class="eim">${e.id} · ${e.department || e.dept} · ${e.role}</div>
          </div>
          <span class="chip ${chipClass}" ${hTitle}>${e.status || 'Active'}</span>
        </div>
        
        <!-- Expandable Details Drawer -->
        <div id="details-${e.id}" class="eit-details" style="display:none">
          <div class="details-grid">
            <div><strong>Company:</strong> ${company}</div>
            <div><strong>Sex:</strong> ${gender}</div>
            <div><strong>Phone:</strong> ${phone}</div>
            <div><strong>Email:</strong> ${email}</div>
            <div><strong>Card No:</strong> ${cardNo}</div>
            <div><strong>Reporting To:</strong> ${reporting}</div>
            <div><strong>Aadhaar:</strong> ${aadhaar}</div>
            <div><strong>PAN:</strong> ${pan}</div>
            <div><strong>Grade:</strong> ${e.grade || 'N/A'}</div>
            <div><strong>Location:</strong> ${loc}</div>
            <div><strong>Emp Type:</strong> ${empType}</div>
            <div><strong>Category:</strong> ${e.category || 'N/A'}</div>
          </div>
          <div class="details-dates">
            <div><strong>Joined:</strong> ${joined}</div>
            <div><strong>Confirmed:</strong> ${confirmed}</div>
            <div><strong>Last Day:</strong> ${exited}</div>
          </div>
          
          <!-- eTimeTrackLite action link buttons -->
          <div class="details-actions">
            <button class="act-lnk" onclick="event.stopPropagation(); showLeaveSummary('${e.id}')">Leave Summary</button>
            <span class="act-sep">|</span>
            <button class="act-lnk" onclick="event.stopPropagation(); showShiftDetails('${e.id}')">Shift Details</button>
            <span class="act-sep">|</span>
            <button class="act-lnk" onclick="event.stopPropagation(); showOtherDetails('${e.id}')">Other Details</button>
            <span class="act-sep">|</span>
            <button class="act-lnk" onclick="event.stopPropagation(); showPayDetails('${e.id}')">Pay Details</button>
            <span class="act-sep">|</span>
            <button class="act-lnk" onclick="event.stopPropagation(); toggleEmployeePhoto('${e.id}', event)">Photo</button>
            <span class="act-sep">|</span>
            <button class="act-lnk danger" onclick="event.stopPropagation(); deleteEmployee('${e.id}')">Delete</button>
            <span class="act-sep">|</span>
            <button class="act-lnk edit-btn" onclick="event.stopPropagation(); openEmpModal('${e.id}')">Edit</button>
            <span class="act-sep">|</span>
            <button class="act-lnk" onclick="event.stopPropagation(); enrollFinger('${e.id}')">Finger | Bio</button>
          </div>
          
          <!-- Photo Container -->
          <div id="photo-preview-${e.id}" class="drawer-photo-preview" style="display:none">
            ${e.image || e.img ? `<img src="${e.image || e.img}" alt="Face encoding snapshot">` : '<div class="no-img-text">No camera image stored</div>'}
          </div>
        </div>
      </div>`;
  }).join('');

  // Keep full Employee List grid in sync
  if (typeof renderEmployeeGrid === 'function') {
    renderEmployeeGrid();
    updateEmpListFilterDropdowns();
  }
}

// ── Delete employee ────────────────────────────
async function deleteEmployee(id) {
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

// ══════════════════════════════════════════════
// Attendance — Camera
// ══════════════════════════════════════════════
async function startAttCam() {
  if (!EMP.length) { notify('Register employees first.', 'wn'); return; }
  try {
    aStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 480 }
    });
    const vid = document.getElementById('av');
    vid.srcObject = aStream;
    document.getElementById('ap').style.display   = 'none';
    document.getElementById('asc').style.display  = 'none';
    document.getElementById('asto').style.display = 'inline-flex';
    document.getElementById('det').style.display  = 'block';
    vid.addEventListener('loadeddata', () => { aLoop = setInterval(recognize, 1500); }, { once: true });
  } catch (e) {
    notify('Camera access denied.', 'er');
  }
}

// ── Stop Attendance Camera ────────────────────
function stopAttCam() {
  if (aStream) { aStream.getTracks().forEach(t => t.stop()); aStream = null; }
  if (aLoop)   { clearInterval(aLoop); aLoop = null; }
  const vid = document.getElementById('av');
  vid.srcObject = null;
  document.getElementById('ap').style.display   = 'flex';
  document.getElementById('asc').style.display  = 'inline-flex';
  document.getElementById('asto').style.display = 'none';
  document.getElementById('det').style.display  = 'none';
  const c = document.getElementById('ac');
  c.getContext('2d').clearRect(0, 0, c.width, c.height);
  setRes('', '');
}
