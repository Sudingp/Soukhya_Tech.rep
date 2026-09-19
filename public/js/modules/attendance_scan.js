// ══════════════════════════════════════════════
// Face recognition loop
// ══════════════════════════════════════════════
async function recognize() {
  if (!loaded || busy || !EMP.length) return;
  const vid = document.getElementById('av');
  if (!vid.srcObject || vid.paused || vid.ended) return;
  busy = true;

  try {
    const det = await detectFaceWithFallback(vid);

    const cv  = document.getElementById('ac');
    cv.width  = vid.videoWidth  || 640;
    cv.height = vid.videoHeight || 480;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);

    if (!det) { setRes('', ''); busy = false; return; }

    const b       = det.detection.box;
    const matcher = new faceapi.FaceMatcher(
      EMP.map(e => new faceapi.LabeledFaceDescriptors(e.id, [e.descriptor])),
      0.55
    );
    const match  = matcher.findBestMatch(det.descriptor);
    const isUnk  = match.label === 'unknown';

    ctx.strokeStyle = isUnk ? '#ef4444' : '#00d4aa';
    ctx.lineWidth   = 2;
    ctx.strokeRect(b.x, b.y, b.width, b.height);
    drawCorners(ctx, b, isUnk ? '#ef4444' : '#00d4aa');

    if (isUnk) {
      setRes('unk', `
        <div class="remp">
          <div class="ravi" style="border-color:var(--err);color:var(--err)">?</div>
          <div>
            <div class="rn" style="color:var(--err)">Unknown Person</div>
            <div class="rm">Not registered in system</div>
          </div>
        </div>`, 10);
    } else {
      const emp  = EMP.find(e => e.id === match.label);
      if (emp) {
        const conf  = Math.round((1 - match.distance) * 100);
        
        // ── ATTENDANCE RULES: Guard for Hibernate Mode ──
        if (emp.status === 'Hibernate') {
          const html = `
            <div class="remp hiber-alert animate-shake">
              <div class="ravi" style="border-color:#f59e0b;color:#f59e0b;background:rgba(245,158,11,0.1)">⬡</div>
              <div>
                <div class="rn" style="color:#f59e0b">${emp.name}</div>
                <div class="rm">${emp.id} · ${emp.department || emp.dept} · ${emp.role}</div>
                <div class="hib-text-alert animate-pulse" style="margin-top:8px;font-size:12px;color:var(--err);font-weight:600;line-height:1.4">
                  Employee currently in Hibernate Mode<br>
                  Attendance disabled
                </div>
                <div style="font-size:10px;color:var(--mu);margin-top:4px">
                  Reason: "${emp.hibernate_reason || 'Not specified'}"
                </div>
              </div>
            </div>`;
          
          setRes('unk', html, conf);
          busy = false;
          return;
        }

        const today = new Date().toDateString();
        const dup   = ATT.find(a => a.empId === emp.id && new Date(a.ts).toDateString() === today);

        const badge = dup
          ? '<span class="chip cb" style="margin-left:4px">Already logged</span>'
          : '<span class="chip cp" style="margin-left:4px">✓ Logged</span>';

        const html = `
          <div class="remp">
            ${(emp.image || emp.img)
              ? `<div class="rav"><img src="${emp.image || emp.img}" alt="${emp.name}"></div>`
              : `<div class="ravi">${emp.name.charAt(0)}</div>`}
            <div>
              <div class="rn">${emp.name}</div>
              <div class="rm">${emp.id} · ${emp.department || emp.dept} · ${emp.role}</div>
              <div style="margin-top:5px">
                <span class="chip cp">✓ Recognized ${conf}%</span>${badge}
              </div>
            </div>
          </div>`;

        setRes('ok', html, conf);
        if (!dup) { await logAtt(emp); }
      }
    }
  } catch (e) {
    console.error(e);
  }

  busy = false;
}

// ══════════════════════════════════════════════
// Log attendance to DB
// ══════════════════════════════════════════════
async function logAtt(emp) {
  const now  = new Date();
  const late = new Date(); late.setHours(9, 0, 0, 0);
  const status = now > late ? 'Late' : 'Present';

  const payload = {
    emp_id:    emp.id,
    name:      emp.name,
    dept:      emp.department || emp.dept,
    role:      emp.role,
    timestamp: now.toISOString(),
    status
  };

  const res = await apiPost('/api/attendance', payload);

  if (res.success && !res.duplicate) {
    const record = { empId: emp.id, name: emp.name, dept: payload.dept, role: emp.role, ts: now.toISOString(), status, att_id: res.att_id };
    ATT.push(record);
    renderLog();
    updateStats();
    notify(`${emp.name} marked ${status} <span class="db-badge">DB</span>`);
  } else if (!res.success) {
    notify(res.error || 'Failed to record attendance.', 'er');
  }
}

// ══════════════════════════════════════════════
// UI helpers
// ══════════════════════════════════════════════
function setRes(cls, html, conf) {
  const rb = document.getElementById('rb');
  rb.className = 'res ' + (cls || '');
  rb.innerHTML = html || '<div style="color:var(--mu);font-size:12px;text-align:center;padding:12px">Position face in frame to mark attendance</div>';

  const cb = document.getElementById('cbr2');
  const cf = document.getElementById('cfll');
  if (conf) {
    cb.style.display    = 'block';
    cf.style.width      = conf + '%';
    cf.style.background = conf > 70 ? 'var(--ac)' : conf > 50 ? 'var(--warn)' : 'var(--err)';
  } else {
    cb.style.display = 'none';
  }
}

function renderLog() {
  const el    = document.getElementById('alog');
  const today = new Date().toDateString();
  const todays = ATT.filter(a => new Date(a.ts).toDateString() === today).slice().reverse();

  if (!todays.length) {
    el.innerHTML = '<div class="emp">No attendance logged yet today.</div>';
    return;
  }

  el.innerHTML = todays.map(a => {
    const t = new Date(a.ts);
    return `<div class="li">
      <div class="lt">${t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
      <div class="ln">${a.name}</div>
      <div style="font-family:var(--mo);font-size:10px;color:var(--mu);margin-right:4px">${a.dept}</div>
      <span class="chip ${a.status === 'Present' ? 'cp' : 'cl'}">${a.status}</span>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════
// Update Stats and Dashboard Analytics Charts
// ══════════════════════════════════════════════
async function updateStats() {
  try {
    const res = await apiGet('/api/stats');
    if (!res.success) return;

    const today = new Date().toDateString();
    const td    = ATT.filter(a => new Date(a.ts).toDateString() === today);

    // Populate default logs stats
    document.getElementById('st').textContent   = res.total_employees;
    document.getElementById('spd').textContent  = td.length;
    document.getElementById('slt').textContent  = td.filter(a => a.status === 'Late').length;
    document.getElementById('sall').textContent = ATT.length;

    // Populate Roster Status stats
    document.getElementById('s-active').textContent = res.status_counts.active;
    document.getElementById('s-hibernate').textContent = res.status_counts.hibernate;
    document.getElementById('s-leave').textContent = res.status_counts.on_leave;
    document.getElementById('s-resigned').textContent = res.status_counts.resigned;

    // Initialize/Update interactive charts
    updateCharts(res);

  } catch (err) {
    console.error('Failed to update stats:', err);
  }

  filt();
}

// ── Chart.js updates ──────────────────────────
function updateCharts(stats) {
  if (!window.Chart) {
    console.warn('[CHARTS] Chart.js library is not available.');
    return;
  }

  // Curated Harmonies Theme Color tokens
  const textClr = '#dde2f0';
  const gridClr = '#2d3650';
  const tooltipBg = '#1e2438';

  // 1. Doughnut Chart: Roster Distribution %
  const rosterCtx = document.getElementById('rosterChart')?.getContext('2d');
  if (rosterCtx) {
    const sc = stats.status_counts || { active: 0, hibernate: 0, on_leave: 0, resigned: 0 };
    const chartData = [sc.active, sc.hibernate, sc.on_leave, sc.resigned];
    
    if (rosterChart) {
      rosterChart.data.datasets[0].data = chartData;
      rosterChart.update();
    } else {
      rosterChart = new Chart(rosterCtx, {
        type: 'doughnut',
        data: {
          labels: ['Active', 'Hibernate', 'On Leave', 'Resigned'],
          datasets: [{
            data: chartData,
            backgroundColor: ['#10b981', '#f59e0b', '#4f8ef7', '#6b7691'],
            borderColor: '#161b27',
            borderWidth: 2,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                color: textClr,
                boxWidth: 10,
                font: { family: 'IBM Plex Sans', size: 10 }
              }
            },
            tooltip: {
              backgroundColor: tooltipBg,
              titleColor: textClr,
              bodyColor: textClr,
              borderWidth: 1,
              borderColor: '#2d3650'
            }
          },
          cutout: '70%'
        }
      });
    }
  }

  // 2. Bar Chart: Hibernate count by Department
  const deptCtx = document.getElementById('deptChart')?.getContext('2d');
  if (deptCtx) {
    const labels = stats.dept_hibernate_counts.map(d => d.department);
    const data = stats.dept_hibernate_counts.map(d => d.count);
    
    if (deptChart) {
      deptChart.data.labels = labels.length ? labels : ['None'];
      deptChart.data.datasets[0].data = data.length ? data : [0];
      deptChart.update();
    } else {
      deptChart = new Chart(deptCtx, {
        type: 'bar',
        data: {
          labels: labels.length ? labels : ['None'],
          datasets: [{
            label: 'Hibernate Count',
            data: data.length ? data : [0],
            backgroundColor: 'rgba(245, 158, 11, 0.7)',
            borderColor: '#f59e0b',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: tooltipBg, titleColor: textClr, bodyColor: textClr }
          },
          scales: {
            x: { 
              ticks: { color: textClr, font: { family: 'IBM Plex Sans', size: 9 } }, 
              grid: { display: false } 
            },
            y: { 
              ticks: { color: textClr, font: { family: 'IBM Plex Sans', size: 9 }, stepSize: 1 }, 
              grid: { color: gridClr } 
            }
          }
        }
      });
    }
  }

  // 3. Area Trend Chart: Monthly Hibernate Entry Trends
  const trendCtx = document.getElementById('trendChart')?.getContext('2d');
  if (trendCtx) {
    const labels = stats.monthly_hibernate_trend.map(t => t.month);
    const data = stats.monthly_hibernate_trend.map(t => t.count);

    if (trendChart) {
      trendChart.data.labels = labels.length ? labels : ['No Data'];
      trendChart.data.datasets[0].data = data.length ? data : [0];
      trendChart.update();
    } else {
      trendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
          labels: labels.length ? labels : ['No Data'],
          datasets: [{
            label: 'New Hibernate Entries',
            data: data.length ? data : [0],
            borderColor: '#4f8ef7',
            backgroundColor: 'rgba(79, 142, 247, 0.15)',
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#4f8ef7',
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: tooltipBg, titleColor: textClr, bodyColor: textClr }
          },
          scales: {
            x: { 
              ticks: { color: textClr, font: { family: 'IBM Plex Sans', size: 9 } }, 
              grid: { display: false } 
            },
            y: { 
              ticks: { color: textClr, font: { family: 'IBM Plex Sans', size: 9 }, stepSize: 1 }, 
              grid: { color: gridClr } 
            }
          }
        }
      });
    }
  }
}

// ── Reset & Seed DB Trigger ───────────────────
async function resetSeedDatabase() {
  if (!confirm('Are you sure you want to reset the database? This will clear all attendance logs and re-seed exactly 100 realistic employee records.')) return;
  notify('Resetting database...', 'wn');
  try {
    const res = await apiPost('/api/reset-seed', {});
    if (res.success) {
      notify('Database reset & seeded successfully!', 'ok');
      await loadFromDB();
    } else {
      notify(res.error || 'Failed to reset and seed', 'er');
    }
  } catch (e) {
    console.error(e);
    notify('Reset & seed failed.', 'er');
  }
}
