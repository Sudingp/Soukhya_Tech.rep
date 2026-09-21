// ══════════════════════════════════════════════
// 📍 LIVE GEOLOCATION & OPENSTREETMAP LEAFLET MAPPING CONTROLLER (<500 lines)
// ══════════════════════════════════════════════

let liveRegMap = null;
let liveRegMarker = null;
let liveRegCircle = null;
let liveTrackingWatchId = null;

let radarModalMap = null;
let radarModalMarker = null;
let radarModalCircle = null;

let currentMachineCoords = {
  latitude: null,
  longitude: null,
  accuracy: null,
  timestamp: null,
  address: ''
};

// ── Initialize Geolocation UI on Tab Switch ──
function initLiveGeoLocation() {
  const regLatInput = document.getElementById('r-lat');
  if (regLatInput && (!regLatInput.value || regLatInput.value === '')) {
    acquireCurrentLocation({ silent: true });
  }
}

// ── Acquire Current Machine Location via HTML5 Geolocation API ──
function acquireCurrentLocation(opts = {}) {
  const silent = opts.silent || false;
  const statusBadge = document.getElementById('geo-status-badge');
  const latDisplay = document.getElementById('geo-lat-display');
  const lonDisplay = document.getElementById('geo-lon-display');
  const accDisplay = document.getElementById('geo-acc-display');
  const addrDisplay = document.getElementById('geo-addr-display');
  const latInput = document.getElementById('r-lat');
  const lonInput = document.getElementById('r-lon');

  if (statusBadge) {
    statusBadge.className = 'badge';
    statusBadge.style.background = 'rgba(245,158,11,0.15)';
    statusBadge.style.color = '#f59e0b';
    statusBadge.style.borderColor = 'rgba(245,158,11,0.3)';
    statusBadge.textContent = '📡 Acquiring GPS...';
  }

  if (!navigator.geolocation) {
    if (!silent) notify('Geolocation is not supported by your browser.', 'wn');
    applyFallbackLocation('Geolocation unsupported', silent);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const acc = position.coords.accuracy;
      const ts  = new Date(position.timestamp).toLocaleTimeString();

      currentMachineCoords.latitude = lat;
      currentMachineCoords.longitude = lon;
      currentMachineCoords.accuracy = acc;
      currentMachineCoords.timestamp = ts;

      if (latInput) latInput.value = lat.toFixed(7);
      if (lonInput) lonInput.value = lon.toFixed(7);

      if (latDisplay) latDisplay.textContent = lat.toFixed(6) + '°';
      if (lonDisplay) lonDisplay.textContent = lon.toFixed(6) + '°';
      if (accDisplay) accDisplay.textContent = '±' + Math.round(acc) + 'm';

      if (statusBadge) {
        statusBadge.className = 'badge';
        statusBadge.style.background = 'rgba(16,185,129,0.15)';
        statusBadge.style.color = '#10b981';
        statusBadge.style.borderColor = 'rgba(16,185,129,0.3)';
        statusBadge.textContent = '🟢 GPS Signal Locked (Live)';
      }

      // Render or Pan Interactive OpenStreetMap Leaflet Map
      renderLeafletRegMap(lat, lon, acc);

      // Verify whether location is inside an authorized Geofence zone
      verifyGeofenceProximity(lat, lon);

      // Reverse geocode via OpenStreetMap Nominatim API
      reverseGeocodeCoords(lat, lon);

      if (!silent) notify(`Live machine position mapped: [${lat.toFixed(4)}, ${lon.toFixed(4)}]`, 'ok');
    },
    (error) => {
      console.warn('[GEOLOCATION] Acquisition error:', error.message);
      let msg = 'Location request timed out or denied.';
      if (error.code === error.PERMISSION_DENIED) msg = 'Location permission denied by user/browser.';
      else if (error.code === error.POSITION_UNAVAILABLE) msg = 'Location coordinates unavailable.';
      
      applyFallbackLocation(msg, silent);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

// ── Fallback to Default Headquarters Coordinates if GPS Blocked ──
function applyFallbackLocation(reason, silent) {
  // Default Enterprise HQ (Bangalore Tech Corridor Reference)
  const defaultLat = 12.9716000;
  const defaultLon = 77.5946000;
  
  const statusBadge = document.getElementById('geo-status-badge');
  const latDisplay = document.getElementById('geo-lat-display');
  const lonDisplay = document.getElementById('geo-lon-display');
  const accDisplay = document.getElementById('geo-acc-display');
  const latInput = document.getElementById('r-lat');
  const lonInput = document.getElementById('r-lon');

  if (latInput) latInput.value = defaultLat.toFixed(7);
  if (lonInput) lonInput.value = defaultLon.toFixed(7);
  if (latDisplay) latDisplay.textContent = defaultLat.toFixed(6) + '° (HQ)';
  if (lonDisplay) lonDisplay.textContent = defaultLon.toFixed(6) + '° (HQ)';
  if (accDisplay) accDisplay.textContent = 'Default Base';

  if (statusBadge) {
    statusBadge.className = 'badge';
    statusBadge.style.background = 'rgba(59,130,246,0.15)';
    statusBadge.style.color = '#60a5fa';
    statusBadge.style.borderColor = 'rgba(59,130,246,0.3)';
    statusBadge.textContent = 'ℹ️ Default HQ Coordinates Applied';
  }

  renderLeafletRegMap(defaultLat, defaultLon, 150);
  if (!silent) notify(`Applied reference base coordinates. (${reason})`, 'wn');
}

// ── OpenStreetMap Nominatim Reverse Geocoder ──
async function reverseGeocodeCoords(lat, lon) {
  const addrDisplay = document.getElementById('geo-addr-display');
  const locSelect = document.getElementById('r-location');
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'SoukhyaTech-AttendanceSystem/4.0' } });
    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        const addr = data.display_name;
        currentMachineCoords.address = addr;
        if (addrDisplay) addrDisplay.textContent = addr;

        // Auto-match city/location if possible
        const city = data.address?.city || data.address?.town || data.address?.state_district || 'Bangalore';
        if (locSelect) {
          const matchOpt = Array.from(locSelect.options).find(o => o.text.toLowerCase().includes(city.toLowerCase()));
          if (matchOpt) locSelect.value = matchOpt.value;
        }
      }
    }
  } catch (e) {
    if (addrDisplay) addrDisplay.textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)} (Reverse geocode offline)`;
  }
}

// ── Verify Coordinates against DB Geofence Zones ──
async function verifyGeofenceProximity(lat, lon) {
  const geofenceBadge = document.getElementById('geo-zone-badge');
  if (!geofenceBadge) return;
  try {
    const res = await apiPost('/api/geofences/verify-coords', { latitude: lat, longitude: lon });
    if (res && res.success) {
      if (res.is_valid && res.matched_geofence) {
        geofenceBadge.style.display = 'inline-flex';
        geofenceBadge.className = 'badge';
        geofenceBadge.style.background = 'rgba(16,185,129,0.15)';
        geofenceBadge.style.color = '#10b981';
        geofenceBadge.innerHTML = `🛡️ Inside ${escapeHtml(res.matched_geofence.name)} Zone (${res.matched_geofence.radius_meters}m)`;
        
        // Auto-select geofence dropdown if present
        const gSelect = document.getElementById('r-geofence');
        if (gSelect) {
          const opt = Array.from(gSelect.options).find(o => o.text.includes(res.matched_geofence.name));
          if (opt) gSelect.value = opt.value;
        }
      } else {
        geofenceBadge.style.display = 'inline-flex';
        geofenceBadge.className = 'badge';
        geofenceBadge.style.background = 'rgba(239,68,68,0.15)';
        geofenceBadge.style.color = '#ef4444';
        geofenceBadge.innerHTML = '⚠️ Outside Designated Office Geofence';
      }
    }
  } catch (err) {
    console.warn('[GEOFENCE] Verification error:', err.message);
  }
}

// ── Render Leaflet Interactive Map Widget ──
function renderLeafletRegMap(lat, lon, accuracy = 50) {
  const mapContainer = document.getElementById('reg-live-map');
  if (!mapContainer || typeof L === 'undefined') return;

  if (!liveRegMap) {
    liveRegMap = L.map('reg-live-map', {
      center: [lat, lon],
      zoom: 16,
      zoomControl: true,
      attributionControl: false
    });

    // OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(liveRegMap);

    // Custom pulsing marker icon
    const customIcon = L.divIcon({
      className: 'custom-gps-pin',
      html: `<div style="width:16px; height:16px; background:#00d4aa; border:3px solid #ffffff; border-radius:50%; box-shadow:0 0 14px #00d4aa; transform:translate(-5px, -5px);"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    liveRegMarker = L.marker([lat, lon], { icon: customIcon, draggable: true }).addTo(liveRegMap);
    liveRegCircle = L.circle([lat, lon], {
      radius: Math.min(accuracy, 200),
      color: '#00d4aa',
      fillColor: '#00d4aa',
      fillOpacity: 0.15,
      weight: 1
    }).addTo(liveRegMap);

    liveRegMarker.bindPopup(`<b>📍 Machine Location</b><br>Lat: ${lat.toFixed(5)}<br>Lon: ${lon.toFixed(5)}`).openPopup();

    // Allow user to drag marker to fine-tune registered location
    liveRegMarker.on('dragend', function (e) {
      const pos = e.target.getLatLng();
      const latInput = document.getElementById('r-lat');
      const lonInput = document.getElementById('r-lon');
      if (latInput) latInput.value = pos.lat.toFixed(7);
      if (lonInput) lonInput.value = pos.lng.toFixed(7);
      
      const latDisplay = document.getElementById('geo-lat-display');
      const lonDisplay = document.getElementById('geo-lon-display');
      if (latDisplay) latDisplay.textContent = pos.lat.toFixed(6) + '°';
      if (lonDisplay) lonDisplay.textContent = pos.lng.toFixed(6) + '°';

      if (liveRegCircle) liveRegCircle.setLatLng(pos);
      liveRegMarker.setPopupContent(`<b>📍 Custom Pinned</b><br>Lat: ${pos.lat.toFixed(5)}<br>Lon: ${pos.lng.toFixed(5)}`).openPopup();
      reverseGeocodeCoords(pos.lat, pos.lng);
      verifyGeofenceProximity(pos.lat, pos.lng);
    });

  } else {
    liveRegMap.setView([lat, lon], 16);
    if (liveRegMarker) {
      liveRegMarker.setLatLng([lat, lon]);
      liveRegMarker.setPopupContent(`<b>📍 Machine Location</b><br>Lat: ${lat.toFixed(5)}<br>Lon: ${lon.toFixed(5)}`);
    }
    if (liveRegCircle) {
      liveRegCircle.setLatLng([lat, lon]);
      liveRegCircle.setRadius(Math.min(accuracy, 200));
    }
    liveRegMap.invalidateSize();
  }
}

// ── Continuous Live Tracking Toggle ──
function toggleLiveTracking() {
  const btn = document.getElementById('btn-toggle-tracking');
  if (liveTrackingWatchId !== null) {
    navigator.geolocation.clearWatch(liveTrackingWatchId);
    liveTrackingWatchId = null;
    if (btn) {
      btn.innerHTML = '🔄 Start Continuous Tracking';
      btn.style.borderColor = 'var(--br)';
      btn.style.color = 'var(--tx)';
    }
    notify('Live GPS continuous tracking stopped.', 'wn');
  } else {
    if (!navigator.geolocation) {
      notify('Geolocation is not supported.', 'er');
      return;
    }
    liveTrackingWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const acc = pos.coords.accuracy;
        renderLeafletRegMap(lat, lon, acc);
        const latInput = document.getElementById('r-lat');
        const lonInput = document.getElementById('r-lon');
        if (latInput) latInput.value = lat.toFixed(7);
        if (lonInput) lonInput.value = lon.toFixed(7);
      },
      (err) => console.warn('[TRACKING] Error:', err.message),
      { enableHighAccuracy: true }
    );
    if (btn) {
      btn.innerHTML = '⏹ Stop Continuous Tracking';
      btn.style.borderColor = 'var(--err)';
      btn.style.color = 'var(--err)';
    }
    notify('Live GPS continuous tracking active.', 'ok');
  }
}

// ── Global Fullscreen Interactive Geolocation Radar Modal ──
function openGeoRadarModal(lat, lon, label = 'Machine Location') {
  const targetLat = parseFloat(lat) || currentMachineCoords.latitude || 12.9716;
  const targetLon = parseFloat(lon) || currentMachineCoords.longitude || 77.5946;

  const modal = document.getElementById('geo-radar-modal');
  const title = document.getElementById('geo-radar-title');
  const meta  = document.getElementById('geo-radar-meta');
  if (modal) modal.style.display = 'flex';
  if (title) title.textContent = `Live Geolocation Radar — ${label}`;
  if (meta) meta.textContent = `Coordinates: ${targetLat.toFixed(6)}° N, ${targetLon.toFixed(6)}° E | OpenStreetMap Engine`;

  setTimeout(() => {
    const mapBox = document.getElementById('radar-modal-map');
    if (!mapBox || typeof L === 'undefined') return;

    if (!radarModalMap) {
      radarModalMap = L.map('radar-modal-map', {
        center: [targetLat, targetLon],
        zoom: 16
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(radarModalMap);

      radarModalMarker = L.marker([targetLat, targetLon]).addTo(radarModalMap);
      radarModalCircle = L.circle([targetLat, targetLon], { radius: 100, color: '#4f8ef7', fillColor: '#4f8ef7', fillOpacity: 0.2 }).addTo(radarModalMap);
    } else {
      radarModalMap.setView([targetLat, targetLon], 16);
      radarModalMarker.setLatLng([targetLat, targetLon]);
      radarModalCircle.setLatLng([targetLat, targetLon]);
      radarModalMap.invalidateSize();
    }
    radarModalMarker.bindPopup(`<b>${escapeHtml(label)}</b><br>Lat: ${targetLat.toFixed(6)}<br>Lon: ${targetLon.toFixed(6)}`).openPopup();
  }, 100);
}

function closeGeoRadarModal() {
  const modal = document.getElementById('geo-radar-modal');
  if (modal) modal.style.display = 'none';
}

// ── Exports to Window ──
window.initLiveGeoLocation = initLiveGeoLocation;
window.acquireCurrentLocation = acquireCurrentLocation;
window.toggleLiveTracking = toggleLiveTracking;
window.openGeoRadarModal = openGeoRadarModal;
window.closeGeoRadarModal = closeGeoRadarModal;
window.renderLeafletRegMap = renderLeafletRegMap;
