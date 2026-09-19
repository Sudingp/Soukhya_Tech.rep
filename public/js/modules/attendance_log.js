// ══════════════════════════════════════════════
// 📍 GEOFENCES CONTROLLERS
// ══════════════════════════════════════════════
let geofencesData = [];

async function openGeofencesModal() {
  const m = document.getElementById('geofences-modal');
  if (!m) return;
  m.style.display = 'flex';
  await loadGeofencesList();
}

function closeGeofencesModal() {
  const m = document.getElementById('geofences-modal');
  if (m) m.style.display = 'none';
}

async function loadGeofencesList() {
  const container = document.getElementById('geofences-cards');
  const countLabel = document.getElementById('geofence-count-label');
  if (container) container.innerHTML = '<div style="color:var(--mu); padding:20px">Loading geofences...</div>';

  try {
    const res = await api('/geofences');
    if (res && res.success) {
      geofencesData = res.data?.geofences || [];
      if (countLabel) countLabel.textContent = `${geofencesData.length} Geofence boundary zone(s) configured`;
      renderGeofencesCards(geofencesData);
    } else {
      if (container) container.innerHTML = `<div style="color:var(--er); padding:20px">Failed to load geofences: ${res?.error?.message}</div>`;
    }
  } catch (err) {
    if (container) container.innerHTML = `<div style="color:var(--er); padding:20px">Error: ${err.message}</div>`;
  }
}

function renderGeofencesCards(fences) {
  const container = document.getElementById('geofences-cards');
  if (!container) return;

  if (!fences || fences.length === 0) {
    container.innerHTML = '<div style="color:var(--mu); padding:20px; grid-column:1/-1">No geofences found. Click "+ Add Geofence" to create one.</div>';
    return;
  }

  container.innerHTML = fences.map(g => {
    const isActive = !!g.active;
    const isStrict = g.enforcement_mode === 'STRICT';
    const depts = Array.isArray(g.allowed_depts) ? g.allowed_depts : [];
    const deptsBadges = depts.length > 0
      ? depts.map(d => `<span style="font-size:10px; background:var(--s1); border:1px solid var(--br); padding:1px 6px; border-radius:4px">${escapeHtml(d)}</span>`).join(' ')
      : `<span style="font-size:10px; color:var(--mu)">All Departments</span>`;

    return `
      <div style="background:var(--s2); border:1px solid var(--br); border-radius:8px; padding:14px; display:flex; flex-direction:column; justify-content:space-between; position:relative">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px">
            <div>
              <span class="mode-badge" style="font-size:10px; font-weight:700; background:rgba(79,142,247,0.15); color:#4f8ef7; border:1px solid rgba(79,142,247,0.3)">
                ${escapeHtml(g.code)}
              </span>
              <h4 style="margin:6px 0 2px 0; font-size:13.5px; font-weight:700; color:var(--tx)">${escapeHtml(g.name)}</h4>
            </div>
            <span class="mode-badge ${isActive ? 'ok' : 'er'}" style="font-size:9.5px">
              ${isActive ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; background:var(--s1); padding:8px; border-radius:6px; margin-bottom:8px; font-size:11px">
            <div>
              <span style="color:var(--mu)">Latitude:</span>
              <div style="font-family:var(--mo); font-weight:600; color:var(--tx)">${Number(g.latitude).toFixed(5)}</div>
            </div>
            <div>
              <span style="color:var(--mu)">Longitude:</span>
              <div style="font-family:var(--mo); font-weight:600; color:var(--tx)">${Number(g.longitude).toFixed(5)}</div>
            </div>
            <div>
              <span style="color:var(--mu)">Radius:</span>
              <div style="font-weight:600; color:var(--ac)">${g.radius_meters} meters</div>
            </div>
            <div>
              <span style="color:var(--mu)">Mode:</span>
              <div style="font-weight:600; color:${isStrict ? 'var(--er)' : 'var(--wn)'}">${g.enforcement_mode}</div>
            </div>
          </div>

          <div style="margin-bottom:8px">
            <span style="font-size:10.5px; color:var(--mu); display:block; margin-bottom:3px">Allowed Departments:</span>
            <div style="display:flex; flex-wrap:wrap; gap:4px">${deptsBadges}</div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:6px; border-top:1px solid var(--br); padding-top:10px; margin-top:6px">
          <button type="button" class="btn bsm" onclick="openEditGeofenceModal('${g.id}')">✏️ Edit</button>
          <button type="button" class="btn bsm" style="color:var(--er); border-color:var(--er)" onclick="deleteGeofenceAction('${g.id}', '${escapeHtml(g.name)}')">🗑️ Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

function openAddGeofenceModal() {
  const m = document.getElementById('geofence-form-modal');
  if (!m) return;
  document.getElementById('geofence-form-title').textContent = 'Add Geofence Boundary';
  document.getElementById('geo-id').value = '';
  document.getElementById('geo-code').value = '';
  document.getElementById('geo-code').readOnly = false;
  document.getElementById('geo-name').value = '';
  document.getElementById('geo-lat').value = '12.9716000';
  document.getElementById('geo-lon').value = '77.5946000';
  document.getElementById('geo-radius').value = '150';
  document.getElementById('geo-enforcement').value = 'STRICT';
  document.getElementById('geo-ip').value = '';
  document.getElementById('geo-wifi').value = '';
  document.getElementById('geo-active').checked = true;

  populateGeofenceAllowedDeptsSelect();
  m.style.display = 'flex';
}

function populateGeofenceAllowedDeptsSelect(selected = []) {
  const sel = document.getElementById('geo-allowed-depts');
  if (!sel) return;
  sel.innerHTML = '';
  const depts = state.departments || [];
  depts.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.name;
    opt.textContent = d.name;
    if (selected.includes(d.name)) opt.selected = true;
    sel.appendChild(opt);
  });
}

function openEditGeofenceModal(id) {
  const g = geofencesData.find(x => x.id === id);
  if (!g) return;

  const m = document.getElementById('geofence-form-modal');
  if (!m) return;
  document.getElementById('geofence-form-title').textContent = 'Edit Geofence Boundary';
  document.getElementById('geo-id').value = g.id;
  document.getElementById('geo-code').value = g.code;
  document.getElementById('geo-code').readOnly = true;
  document.getElementById('geo-name').value = g.name;
  document.getElementById('geo-lat').value = g.latitude;
  document.getElementById('geo-lon').value = g.longitude;
  document.getElementById('geo-radius').value = g.radius_meters;
  document.getElementById('geo-enforcement').value = g.enforcement_mode || 'STRICT';
  document.getElementById('geo-ip').value = g.ip_range || '';
  document.getElementById('geo-wifi').value = g.wifi_bssid || '';
  document.getElementById('geo-active').checked = !!g.active;

  populateGeofenceAllowedDeptsSelect(Array.isArray(g.allowed_depts) ? g.allowed_depts : []);
  m.style.display = 'flex';
}

function closeGeofenceFormModal() {
  const m = document.getElementById('geofence-form-modal');
  if (m) m.style.display = 'none';
}

async function saveGeofenceForm(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('geo-id').value;
  const code = document.getElementById('geo-code').value.trim();
  const name = document.getElementById('geo-name').value.trim();
  const latitude = parseFloat(document.getElementById('geo-lat').value);
  const longitude = parseFloat(document.getElementById('geo-lon').value);
  const radius_meters = parseInt(document.getElementById('geo-radius').value, 10);
  const enforcement_mode = document.getElementById('geo-enforcement').value;
  const ip_range = document.getElementById('geo-ip').value.trim() || null;
  const wifi_bssid = document.getElementById('geo-wifi').value.trim() || null;
  const active = document.getElementById('geo-active').checked;

  const deptsSel = document.getElementById('geo-allowed-depts');
  const allowed_depts = deptsSel ? Array.from(deptsSel.selectedOptions).map(o => o.value) : [];

  const payload = {
    code,
    name,
    latitude,
    longitude,
    radius_meters,
    enforcement_mode,
    allowed_depts,
    ip_range,
    wifi_bssid,
    active
  };

  try {
    const url = id ? `/geofences/${id}` : '/geofences';
    const method = id ? 'PUT' : 'POST';
    const res = await api(url, { method, body: JSON.stringify(payload) });

    if (res && res.success) {
      notify(`Geofence ${id ? 'updated' : 'created'} successfully!`, 'ok');
      closeGeofenceFormModal();
      await loadGeofencesList();
    } else {
      notify(`Failed to save geofence: ${res?.error?.message || 'Error'}`, 'er');
    }
  } catch (err) {
    notify(`Error saving geofence: ${err.message}`, 'er');
  }
}

async function deleteGeofenceAction(id, name) {
  if (!confirm(`Are you sure you want to delete geofence "${name}"?`)) return;
  try {
    const res = await api(`/geofences/${id}`, { method: 'DELETE' });
    if (res && res.success) {
      notify('Geofence deleted successfully', 'ok');
      await loadGeofencesList();
    } else {
      notify(`Failed to delete: ${res?.error?.message || 'Error'}`, 'er');
    }
  } catch (err) {
    notify(`Error deleting geofence: ${err.message}`, 'er');
  }
}

function openTestCoordsModal() {
  const m = document.getElementById('geofence-test-modal');
  if (m) m.style.display = 'flex';
}

function closeTestCoordsModal() {
  const m = document.getElementById('geofence-test-modal');
  if (m) m.style.display = 'none';
}

function setTestCoordPreset(lat, lon) {
  document.getElementById('test-geo-lat').value = lat;
  document.getElementById('test-geo-lon').value = lon;
}

async function runGeofenceVerificationTest() {
  const lat = parseFloat(document.getElementById('test-geo-lat')?.value);
  const lon = parseFloat(document.getElementById('test-geo-lon')?.value);
  const resBox = document.getElementById('test-geo-result');
  if (!resBox) return;

  resBox.style.display = 'block';
  resBox.innerHTML = 'Verifying with GPS boundary engine...';

  try {
    const res = await api('/geofences/verify-coords', {
      method: 'POST',
      body: JSON.stringify({ latitude: lat, longitude: lon })
    });

    if (res && res.success) {
      const data = res.data;
      if (data.is_valid && data.matched_geofence) {
        const mg = data.matched_geofence;
        resBox.innerHTML = `
          <div style="color:var(--ok); font-weight:700; margin-bottom:4px">✓ INSIDE VALID GEOFENCE</div>
          <div>Matched Zone: <strong>${escapeHtml(mg.name)}</strong> (${escapeHtml(mg.code)})</div>
          <div>Distance from Zone Center: <strong>${mg.distance_meters}m</strong> (Allowed Radius: ${mg.radius_meters}m)</div>
          <div>Enforcement: <strong>${mg.enforcement_mode}</strong></div>
        `;
      } else {
        const nearest = (data.all_zones || []).sort((a, b) => a.distance_meters - b.distance_meters)[0];
        resBox.innerHTML = `
          <div style="color:var(--er); font-weight:700; margin-bottom:4px">❌ OUTSIDE ALL ACTIVE GEOFENCES</div>
          <div>Nearest Zone: <strong>${escapeHtml(nearest?.name || 'None')}</strong></div>
          <div>Distance: <strong>${nearest?.distance_meters || '—'}m</strong> away (Radius: ${nearest?.radius_meters || '—'}m)</div>
          <div style="color:var(--wn); margin-top:4px">Punches from these coordinates will be flagged or rejected according to zone policy.</div>
        `;
      }
    } else {
      resBox.innerHTML = `<span style="color:var(--er)">Verification failed: ${res?.error?.message}</span>`;
    }
  } catch (err) {
    resBox.innerHTML = `<span style="color:var(--er)">Error: ${err.message}</span>`;
  }
}
