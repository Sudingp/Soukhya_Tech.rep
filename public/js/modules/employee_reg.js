// ══════════════════════════════════════════════
// Registration — Form conditional fields
// ══════════════════════════════════════════════
function toggleHibFields(status) {
  const hFields = document.getElementById('r-hib-fields');
  if (status === 'Hibernate') {
    hFields.style.display = 'block';
  } else {
    hFields.style.display = 'none';
    // Clear values
    document.getElementById('r-hib-start').value = '';
    document.getElementById('r-hib-end').value = '';
    document.getElementById('r-hib-reason').value = '';
  }
}

// ── Toggle optional registration form fields ──
function toggleOptionalFormFields() {
  const fields = document.getElementById('r-opt-fields');
  const btn = document.getElementById('toggle-opt-btn');
  if (!fields || !btn) return;
  
  if (fields.style.display === 'none') {
    fields.style.display = 'block';
    btn.innerHTML = '➖ Hide Enterprise Details (Optional)';
  } else {
    fields.style.display = 'none';
    btn.innerHTML = '➕ Show Enterprise Details (Optional)';
  }
}

// ══════════════════════════════════════════════
// Registration — Capture & Save
// ══════════════════════════════════════════════
// ── Register form status toggle ──
function toggleRegHibFields(status) {
  const hRow = document.getElementById('r-hib-fields-row');
  if (status === 'Not Working') {
    hRow.style.display = 'grid';
  } else {
    hRow.style.display = 'none';
    document.getElementById('r-hib-start').value = '';
    document.getElementById('r-hib-end').value = '';
    document.getElementById('r-hib-reason').value = '';
  }
}

// ── Reset Register Form ──
function resetRegForm() {
  document.getElementById('r-id').value = '';
  document.getElementById('r-name').value = '';
  document.getElementById('r-device-code').value = '';
  document.getElementById('r-role').value = '';
  document.getElementById('r-card-number').value = '';
  document.getElementById('r-aadhaar').value = '';
  document.getElementById('r-pan').value = '';
  document.getElementById('r-phone').value = '';
  document.getElementById('r-email').value = '';
  document.getElementById('r-reporting-to').value = '';
  document.getElementById('r-expiry-rule').checked = false;
  document.getElementById('r-status').value = 'Working';
  toggleRegHibFields('Working');
  
  // reset date select dropdowns
  populateDateDropdowns('r-join-date-grp', null);
  populateDateDropdowns('r-confirm-date-grp', null);
  populateDateDropdowns('r-last-working-grp', '3000-01-01');
  populateDateDropdowns('r-exp-start-grp', '2000-01-01');
  populateDateDropdowns('r-exp-end-grp', '2030-12-31');

  // Clear canvas and photo previews
  const c = document.getElementById('rc');
  if (c) c.getContext('2d').clearRect(0,0,c.width,c.height);
  const p = document.getElementById('cprev');
  if (p) p.style.display = 'none';
  
  if (document.getElementById('r-lat')) document.getElementById('r-lat').value = '';
  if (document.getElementById('r-lon')) document.getElementById('r-lon').value = '';
  if (typeof acquireCurrentLocation === 'function') acquireCurrentLocation({ silent: true });
  
  notify('Registration form cleared.', 'wn');
}

// Simulated Sync actions for register form
function syncRegFormDevices() {
  const name = document.getElementById('r-name').value.trim() || 'New Employee';
  notify(`Syncing "${name}" registration to 5 terminals...`, 'wn');
  setTimeout(() => {
    notify('Device sync complete. Ready to receive biometric logs.', 'ok');
  }, 1800);
}

function unsyncRegFormDevices() {
  const name = document.getElementById('r-name').value.trim() || 'New Employee';
  notify(`Removing active reader sync registry for "${name}"...`, 'wn');
  setTimeout(() => {
    notify('Terminals unregistered successfully.', 'ok');
  }, 1800);
}

// ══════════════════════════════════════════════
// Face Detection Helpers
// ══════════════════════════════════════════════
function drawCorners(ctx, box, color) {
  const { x, y, width, height } = box;
  const len = Math.min(width, height) * 0.2; // length of corner lines
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  
  // Top-left
  ctx.moveTo(x, y + len);
  ctx.lineTo(x, y);
  ctx.lineTo(x + len, y);
  
  // Top-right
  ctx.moveTo(x + width - len, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + len);
  
  // Bottom-left
  ctx.moveTo(x, y + height - len);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x + len, y + height);
  
  // Bottom-right
  ctx.moveTo(x + width - len, y + height);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + width, y + height - len);
  
  ctx.stroke();
}

async function detectFaceWithFallback(vid) {
  // 1. Primary: Try SsdMobilenetv1 first (robust to varied lighting & rotation)
  let det = await faceapi
    .detectSingleFace(vid, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 }))
    .withFaceLandmarks(false) // use standard faceLandmark68Net
    .withFaceDescriptor();

  if (det) {
    return det;
  }

  // 2. Fallback: Try TinyFaceDetector with lenient configuration
  det = await faceapi
    .detectSingleFace(vid, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
    .withFaceLandmarks(true) // use faceLandmark68TinyNet
    .withFaceDescriptor();

  return det;
}

// ══════════════════════════════════════════════
// Registration — Capture & Save
// ══════════════════════════════════════════════
async function doRegister() {
  if (!loaded) { notify('AI not ready yet.', 'wn'); return; }

  const id        = document.getElementById('r-id').value.trim();
  const name      = document.getElementById('r-name').value.trim();
  const dept      = document.getElementById('r-dept').value;
  const role      = document.getElementById('r-role').value.trim();
  const statusVal = document.getElementById('r-status').value; // 'Working' or 'Not Working'

  // Harvest new eTimeTrackLite inputs
  const deviceCode   = document.getElementById('r-device-code').value.trim();
  const subDept      = document.getElementById('r-sub-dept').value;
  const grade        = document.getElementById('r-grade').value;
  const loc          = document.getElementById('r-location').value;
  const category     = document.getElementById('r-category').value;
  const shiftGroup   = document.getElementById('r-shift-group').value;
  
  const isMale       = document.getElementById('r-sex-male').checked;
  const gender       = isMale ? 'Male' : 'Female';

  const cardNumber   = document.getElementById('r-card-number').value.trim();
  const expiryRule   = document.getElementById('r-expiry-rule').checked;

  const company      = document.getElementById('r-company').value;
  const division     = document.getElementById('r-division').value;
  const team         = document.getElementById('r-team').value;
  const empType      = document.getElementById('r-emp-type').value;
  const holidayGroup = document.getElementById('r-holiday-group').value;
  const shiftRoster  = document.getElementById('r-shift-roster').value;
  const aadhaar      = document.getElementById('r-aadhaar').value.trim();
  const geofence     = document.getElementById('r-geofence').value;
  const verType      = document.getElementById('r-verification-type').value;

  // Compliance
  const pan          = document.getElementById('r-pan').value.trim();
  const phone        = document.getElementById('r-phone').value.trim();
  const email        = document.getElementById('r-email').value.trim();
  const reportingTo  = document.getElementById('r-reporting-to').value.trim();

  // Date selects
  const joinDate     = getISOFromDateDropdowns('r-join-date-grp');
  const confirmDate  = getISOFromDateDropdowns('r-confirm-date-grp');
  const lastWorkingDay = getISOFromDateDropdowns('r-last-working-grp');
  const expStart     = getISOFromDateDropdowns('r-exp-start-grp');
  const expEnd       = getISOFromDateDropdowns('r-exp-end-grp');

  // Hibernate conditions
  const hibStart  = document.getElementById('r-hib-start').value;
  const hibEnd    = document.getElementById('r-hib-end').value;
  const hibReason = document.getElementById('r-hib-reason').value.trim();

  if (!id || !name || !role) { notify('Please fill all mandatory core fields: Employee Code, Name, Designation.', 'wn'); return; }

  // Map Employment status to Active/Resigned or Hibernate
  let mappedStatus = 'Active';
  if (statusVal === 'Not Working') {
    if (hibStart && hibEnd && hibReason) {
      mappedStatus = 'Hibernate';
    } else {
      mappedStatus = 'Resigned';
    }
  }

  if (EMP.find(e => e.id === id)) { notify('Employee Code already exists.', 'er'); return; }
  if (!rStream) { notify('Start camera first to capture biometric face encoding.', 'wn'); return; }

  const vid  = document.getElementById('rv');
  const rst  = document.getElementById('rst');
  rst.innerHTML = '<div class="det" style="margin:0">Detecting face encoding...</div>';
  
  // Disable button
  const capBtn = document.getElementById('rcap-lnk');
  if (capBtn) capBtn.disabled = true;

  try {
    const det = await detectFaceWithFallback(vid);

    if (!det) {
      rst.innerHTML = '<div style="color:var(--err);font-size:11px">⚠ No face detected. Centre your face in the frame.</div>';
      if (capBtn) capBtn.disabled = false;
      return;
    }

    // Draw bounding box on canvas
    const cv  = document.getElementById('rc');
    cv.width  = vid.videoWidth  || 640;
    cv.height = vid.videoHeight || 480;
    const ctx = cv.getContext('2d');
    ctx.drawImage(vid, 0, 0, cv.width, cv.height);
    const b = det.detection.box;
    ctx.strokeStyle = '#00d4aa'; ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.width, b.height);
    drawCorners(ctx, b, '#00d4aa');

    const imgData = cv.toDataURL('image/jpeg', .8);
    const prev    = document.getElementById('cprev');
    prev.src      = imgData;
    prev.style.display = 'block';

    // ── POST to database ──────────────────────
    const payload = {
      id,
      name,
      department: dept,
      role,
      descriptor: Array.from(det.descriptor),   
      image:      imgData,
      status:     mappedStatus,
      hibernate_start_date: mappedStatus === 'Hibernate' ? hibStart : null,
      hibernate_end_date: mappedStatus === 'Hibernate' ? hibEnd : null,
      hibernate_reason: mappedStatus === 'Hibernate' ? hibReason : null,
      
      company,
      designation: role,
      gender,
      date_of_joining: joinDate,
      date_of_confirmation: confirmDate,
      last_working_day: lastWorkingDay,
      aadhaar_number: aadhaar,
      pan_number: pan || null,
      card_number: cardNumber || null,
      phone_no: phone || null,
      email: email || null,
      reporting_to: reportingTo || null,

      // Replica fields
      device_code: deviceCode || null,
      sub_department: subDept,
      division,
      grade,
      team,
      location: loc,
      latitude: parseFloat(document.getElementById('r-lat')?.value) || null,
      longitude: parseFloat(document.getElementById('r-lon')?.value) || null,
      employment_type: empType,
      category,
      holiday_group: holidayGroup,
      shift_group: shiftGroup,
      shift_roster: shiftRoster,
      geofence,
      device_expiry_rule_applicable: expiryRule,
      verification_type: verType,
      expiry_start_date: expStart,
      expiry_end_date: expEnd
    };

    const apiRes = await apiPost('/api/employees', payload);

    if (!apiRes.success) {
      rst.innerHTML = `<div style="color:var(--err);font-size:11px">✕ ${apiRes.error}</div>`;
      if (capBtn) capBtn.disabled = false;
      return;
    }

    // Update local state
    EMP.push({ 
      id, 
      name, 
      department: dept, 
      role, 
      descriptor: det.descriptor, 
      image: imgData,
      status: mappedStatus,
      hibernate_start_date: mappedStatus === 'Hibernate' ? hibStart : null,
      hibernate_end_date: mappedStatus === 'Hibernate' ? hibEnd : null,
      hibernate_reason: mappedStatus === 'Hibernate' ? hibReason : null,
      company,
      designation: role,
      gender,
      dateOfJoining: joinDate,
      dateOfConfirmation: confirmDate,
      lastWorkingDay,
      aadhaarNumber: aadhaar,
      panNumber: pan || null,
      cardNumber,
      phoneNo: phone || null,
      email: email || null,
      reportingTo: reportingTo || null,

      deviceCode,
      subDepartment: subDept,
      division,
      grade,
      team,
      location: loc,
      latitude: parseFloat(document.getElementById('r-lat')?.value) || null,
      longitude: parseFloat(document.getElementById('r-lon')?.value) || null,
      employmentType: empType,
      category,
      holidayGroup,
      shiftGroup,
      shiftRoster,
      geofence,
      deviceExpiryRuleApplicable: expiryRule,
      verificationType: verType,
      expiryStartDate: expStart,
      expiryEndDate: expEnd
    });
    
    rst.innerHTML = `<div style="color:var(--ok);font-size:11px">✓ ${name} registered successfully.</div>`;
    renderEL();
    updateStats();
    notify(name + ' registered successfully! <span class="db-badge">DB</span>', 'ok');

    // Reset Form completely
    resetRegForm();

  } catch (e) {
    console.error(e);
    rst.innerHTML = '<div style="color:var(--err);font-size:11px">Detection error. Try again.</div>';
  }

  if (capBtn) capBtn.disabled = false;
}
