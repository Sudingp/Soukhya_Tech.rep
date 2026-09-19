
function showShiftDetails(id) {
  const emp = EMP.find(e => e.id === id);
  if (!emp) return;

  const group = emp.shiftGroup || 'General Shift Group';
  const roster = emp.shiftRoster || 'Standard Roster';

  const html = `
    <div style="font-family:var(--sa); font-size:12px; line-height:1.6">
      <div style="font-size:14px; font-weight:600; margin-bottom:12px; color:var(--ac)">Shift Schedule: ${emp.name}</div>
      <div style="margin-bottom:8px"><strong>Active Shift Group:</strong> ${group}</div>
      <div style="margin-bottom:8px"><strong>Shift Roster Profile:</strong> ${roster}</div>
      <table style="width:100%; border:1px solid var(--br); margin-bottom:12px">
        <thead>
          <tr>
            <th style="background:var(--s2)">Day</th>
            <th style="background:var(--s2)">In Time</th>
            <th style="background:var(--s2)">Out Time</th>
            <th style="background:var(--s2)">Grace Period</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Monday - Friday</td>
            <td>09:00 AM</td>
            <td>05:30 PM</td>
            <td>15 Mins</td>
          </tr>
          <tr>
            <td>Saturday</td>
            <td>09:00 AM</td>
            <td>01:30 PM</td>
            <td>15 Mins</td>
          </tr>
          <tr>
            <td>Sunday</td>
            <td colspan="3" style="text-align:center; color:var(--err)">Weekly Off</td>
          </tr>
        </tbody>
      </table>
    </div>`;

  openInfoDrawer('Shift Details — ' + emp.id, html);
}

function showOtherDetails(id) {
  const emp = EMP.find(e => e.id === id);
  if (!emp) return;

  const html = `
    <div style="font-family:var(--sa); font-size:12px; line-height:1.6">
      <div style="font-size:14px; font-weight:600; margin-bottom:12px; color:var(--ac)">Organizational Tree Details</div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:12px">
        <div><strong>Sub Department:</strong> ${emp.subDepartment || 'None'}</div>
        <div><strong>Division:</strong> ${emp.division || 'None'}</div>
        <div><strong>Grade:</strong> ${emp.grade || 'G1'}</div>
        <div><strong>Team:</strong> ${emp.team || 'None'}</div>
        <div><strong>Location:</strong> ${emp.location || 'HQ - Bangalore'}</div>
        <div><strong>Employment Type:</strong> ${emp.employmentType || 'Permanent'}</div>
        <div><strong>Holiday Group:</strong> ${emp.holidayGroup || 'None'}</div>
        <div><strong>Geofence Zone:</strong> ${emp.geofence || 'None'}</div>
      </div>
    </div>`;

  openInfoDrawer('Other Details — ' + emp.id, html);
}

function showPayDetails(id) {
  const emp = EMP.find(e => e.id === id);
  if (!emp) return;

  const basic = 25000 + Math.floor(Math.random() * 50000);
  const hra = Math.round(basic * 0.4);
  const pf = Math.round(basic * 0.12);
  const total = basic + hra - pf;

  const html = `
    <div style="font-family:var(--sa); font-size:12px; line-height:1.6">
      <div style="font-size:14px; font-weight:600; margin-bottom:12px; color:var(--ac)">Compensation Summary: ${emp.name}</div>
      <div style="margin-bottom:10px"><strong>Salary Structure Grade:</strong> ${emp.grade || 'G1'}</div>
      <table style="width:100%; border:1px solid var(--br); margin-bottom:12px">
        <tbody>
          <tr>
            <td>Basic Salary</td>
            <td style="text-align:right">₹ ${basic.toLocaleString()}</td>
          </tr>
          <tr>
            <td>HRA Allowance</td>
            <td style="text-align:right">₹ ${hra.toLocaleString()}</td>
          </tr>
          <tr>
            <td>Provident Fund (PF) Deduct</td>
            <td style="text-align:right; color:var(--err)">- ₹ ${pf.toLocaleString()}</td>
          </tr>
          <tr style="font-weight:600; border-top:1px solid var(--br)">
            <td>Net Monthly Pay (Est.)</td>
            <td style="text-align:right; color:var(--ok)">₹ ${total.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>`;

  openInfoDrawer('Pay Details — ' + emp.id, html);
}

function toggleEmployeePhoto(id, event) {
  const photoDiv = document.getElementById(`photo-preview-${id}`);
  if (!photoDiv) return;

  if (photoDiv.style.display === 'none') {
    photoDiv.style.display = 'block';
  } else {
    photoDiv.style.display = 'none';
  }
}

function enrollFinger(id) {
  const emp = EMP.find(e => e.id === id);
  if (!emp) return;

  const html = `
    <div style="text-align:center; padding:15px; font-family:var(--sa)">
      <div style="font-size:14px; font-weight:600; margin-bottom:15px; color:var(--ac)">Biometric Fingerprint Enrollment</div>
      <div style="margin: 20px 0; position: relative; display: inline-block">
        <!-- fingerprint scanner icon -->
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--ac); animation: pulse-glow 1s infinite ease-in-out">
          <path d="M12 2a10 10 0 0 0-8 8.18M12 2a10 10 0 0 1 8 8.18M12 6a6 6 0 0 0-4.8 5M12 6a6 6 0 0 1 4.8 5M8 12.5a4 4 0 0 1 8 0M9.5 15a2.5 2.5 0 0 1 5 0M11.5 18a.5.5 0 0 1 1 0" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div id="scan-status" style="margin-top:15px; font-size:12px; color:var(--mu)">
        Please place finger on USB biometric reader scanner...
      </div>
    </div>`;

  openInfoDrawer('Biometric Enrollment — ' + emp.id, html);

  // Set timeout to simulate scan steps
  setTimeout(() => {
    const status = document.getElementById('scan-status');
    if (status) status.innerHTML = '<span style="color:var(--warn)">Scanning finger pattern... 50%</span>';
  }, 1000);

  setTimeout(() => {
    const status = document.getElementById('scan-status');
    if (status) status.innerHTML = '<span style="color:var(--ok); font-weight:600">✓ Fingerprint enrolled successfully! (Templates saved)</span>';
    notify(`Biometrics enrolled for ${emp.name}!`, 'ok');
  }, 2300);
}

// ══════════════════════════════════════════════
// Monthly Status Report Generator
// ══════════════════════════════════════════════
function generateMonthlyReport() {
  const fromVal = document.getElementById('rep-from').value;
  const toVal = document.getElementById('rep-to').value;
  const companyFilter = document.getElementById('rep-company').value;
  const deptFilter = document.getElementById('rep-dept').value;

  if (!fromVal || !toVal) {
    notify('Please select both From and To dates.', 'wn');
    return;
  }

  const startDate = new Date(fromVal);
  const endDate = new Date(toVal);

  if (startDate > endDate) {
    notify('From Date cannot be after To Date.', 'wn');
    return;
  }

  // Calculate list of dates in the range
  const dates = [];
  let curr = new Date(startDate);
  while (curr <= endDate) {
    dates.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }

  if (dates.length > 31) {
    notify('Maximum date range is 31 days.', 'wn');
    return;
  }

  // Filter employees
  let filteredEmps = [...EMP];
  if (companyFilter !== 'All') {
    filteredEmps = filteredEmps.filter(e => e.company === companyFilter);
  }
  if (deptFilter !== 'All') {
    filteredEmps = filteredEmps.filter(e => (e.department || e.dept) === deptFilter);
  }

  // Group employees by department
  const empsByDept = {};
  filteredEmps.forEach(e => {
    const d = e.department || e.dept || 'Unassigned';
    if (!empsByDept[d]) empsByDept[d] = [];
    empsByDept[d].push(e);
  });

  // Calculate day headers
  // Saturday is "St" and Sunday is "S", others are standard: M, T, W, Th, F
  const dayLetters = ["S", "M", "T", "W", "Th", "F", "St"];
  
  let headerDaysHtml = '';
  dates.forEach(d => {
    const dayNum = d.getDate();
    const dayName = dayLetters[d.getDay()];
    headerDaysHtml += `<th>${dayNum} ${dayName}</th>`;
  });

  // Compile Printed On timestamp
  const now = new Date();
  const printMonth = now.toLocaleDateString('en-US', { month: 'short' });
  const printDay = String(now.getDate()).padStart(2, '0');
  const printYr = now.getFullYear();
  const printTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const printedOnStr = `${printMonth} ${printDay} ${printYr} ${printTime}`;

  // Format title dates
  const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
  const startDay = String(startDate.getDate()).padStart(2, '0');
  const startYr = startDate.getFullYear();
  
  const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
  const endDay = String(endDate.getDate()).padStart(2, '0');
  const endYr = endDate.getFullYear();
  
  const dateRangeStr = `${startMonth} ${startDay} ${startYr} To ${endMonth} ${endDay} ${endYr}`;

  let reportHtml = `
    <div class="rep-title">Monthly Status Report (Basic Work Duration)</div>
    <div class="rep-range">${dateRangeStr}</div>
    
    <table class="rep-meta-table">
      <tr>
        <td>Company: ${companyFilter === 'All' ? 'KRIDE / GC / Default' : companyFilter}</td>
        <td style="text-align:right">Printed On : ${printedOnStr}</td>
      </tr>
    </table>
  `;

  if (filteredEmps.length === 0) {
    reportHtml += `
      <div style="text-align:center; padding:50px; color:#666; border:1px solid #000">
        No employees found matching the filters.
      </div>
    `;
    document.getElementById('report-sheet').innerHTML = reportHtml;
    return;
  }

  let tableHtml = `
    <table>
      <thead>
        <tr>
          <th style="width:80px; text-align:left">Days</th>
          ${headerDaysHtml}
        </tr>
      </thead>
      <tbody>
  `;

  // For each department
  Object.keys(empsByDept).sort().forEach(deptName => {
    tableHtml += `
      <tr class="rep-dept-row">
        <td colspan="${dates.length + 1}">Department: ${deptName}</td>
      </tr>
    `;

    // For each employee in this department
    empsByDept[deptName].forEach(emp => {
      tableHtml += `
        <tr class="rep-emp-row">
          <td colspan="${dates.length + 1}">Emp. Code:&nbsp;&nbsp;&nbsp;&nbsp;${emp.id}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Emp. Name:&nbsp;&nbsp;&nbsp;&nbsp;${emp.name}</td>
        </tr>
      `;

      // Calculate status, inTime, outTime, total for each date
      const rowStatus = [];
      const rowIn = [];
      const rowOut = [];
      const rowTotal = [];

      dates.forEach(date => {
        const dateStr = date.toISOString().slice(0, 10);
        const dayOfWeek = date.getDay(); // 0 is Sunday
        
        // Check real logs from ATT
        const realLogs = ATT.filter(a => a.empId === emp.id && new Date(a.ts).toISOString().slice(0, 10) === dateStr);

        if (realLogs.length > 0) {
          // Present via database logs
          realLogs.sort((a,b) => new Date(a.ts) - new Date(b.ts));
          const firstPunch = new Date(realLogs[0].ts);
          const inTimeStr = firstPunch.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
          
          let outTimeStr = '';
          let totalMinutes = 0;
          
          if (realLogs.length > 1) {
            const lastPunch = new Date(realLogs[realLogs.length - 1].ts);
            outTimeStr = lastPunch.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            totalMinutes = Math.round((lastPunch - firstPunch) / 1000 / 60);
          } else {
            // Only one punch recorded, let's mock the out punch as 8.5 hours later to avoid leaving total as 00:00
            const mockOut = new Date(firstPunch.getTime() + (8.5 * 60 * 60 * 1000));
            outTimeStr = mockOut.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            totalMinutes = 510; // 8.5 hours
          }

          const hours = Math.floor(totalMinutes / 60);
          const mins = totalMinutes % 60;
          const totalStr = `${hours}:${String(mins).padStart(2, '0')}`;

          rowStatus.push({ text: 'P', cls: 'rep-pres-cell' });
          rowIn.push(inTimeStr);
          rowOut.push(outTimeStr);
          rowTotal.push(totalStr);
        } else {
          // Deterministic mock generation based on Employee ID and Date
          if (dayOfWeek === 0) {
            // Sunday is Weekly Off
            rowStatus.push({ text: 'WO', cls: 'rep-wo-cell' });
            rowIn.push('');
            rowOut.push('');
            rowTotal.push('00:00');
          } else if (emp.status === 'Hibernate' || emp.status === 'Resigned') {
            // Hibernated or Resigned shows Absent
            rowStatus.push({ text: 'A', cls: 'rep-abs-cell' });
            rowIn.push('');
            rowOut.push('');
            rowTotal.push('00:00');
          } else {
            // Working employee: generate attendance deterministically based on date and ID
            const hashVal = hashStringToInteger(emp.id + dateStr);
            const isPresent = (hashVal % 100) < 85; // 85% attendance rate

            if (isPresent) {
              // Generate realistic in-time (e.g. between 09:30 and 10:15)
              const inHour = 9;
              const inMin = 30 + (hashVal % 45); // 9:30 to 10:15
              const inTimeStr = `${String(inHour).padStart(2, '0')}:${String(inMin).padStart(2, '0')}`;

              // Generate realistic duration (e.g. between 8 hours and 9 hours 15 mins)
              const durationMins = 480 + (hashVal % 75); // 8h to 9h15m
              const totalHours = Math.floor(durationMins / 60);
              const totalMins = durationMins % 60;
              const totalStr = `${totalHours}:${String(totalMins).padStart(2, '0')}`;

              // OutTime calculation
              let outHour = inHour + totalHours;
              let outMin = inMin + totalMins;
              if (outMin >= 60) {
                outHour += 1;
                outMin -= 60;
              }
              const outTimeStr = `${String(outHour).padStart(2, '0')}:${String(outMin).padStart(2, '0')}`;

              rowStatus.push({ text: 'P', cls: 'rep-pres-cell' });
              rowIn.push(inTimeStr);
              rowOut.push(outTimeStr);
              rowTotal.push(totalStr);
            } else {
              // Absent
              rowStatus.push({ text: 'A', cls: 'rep-abs-cell' });
              rowIn.push('');
              rowOut.push('');
              rowTotal.push('00:00');
            }
          }
        }
      });

      // Render rows
      tableHtml += `
        <tr>
          <td class="rep-label-col">Status</td>
          ${rowStatus.map(s => `<td class="${s.cls}">${s.text}</td>`).join('')}
        </tr>
        <tr>
          <td class="rep-label-col">InTime</td>
          ${rowIn.map(t => `<td>${t}</td>`).join('')}
        </tr>
        <tr>
          <td class="rep-label-col">OutTime</td>
          ${rowOut.map(t => `<td>${t}</td>`).join('')}
        </tr>
        <tr>
          <td class="rep-label-col">Total</td>
          ${rowTotal.map(t => `<td>${t}</td>`).join('')}
        </tr>
      `;
    });
  });

  tableHtml += `
      </tbody>
    </table>
  `;

  reportHtml += tableHtml;
  document.getElementById('report-sheet').innerHTML = reportHtml;
  notify('Monthly status report generated successfully.', 'ok');
}

// Deterministic helper
function hashStringToInteger(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

// Client side search highlight
function findInReport() {
  const sheet = document.getElementById('report-sheet');
  const query = document.getElementById('rep-find').value.trim();

  // Clear previous highlights
  removeHighlights(sheet);

  if (!query) return;

  // Walk text nodes and wrap matches in <mark> tags
  const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT, null, false);
  const nodesToReplace = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentNode.nodeName !== 'SCRIPT' && node.parentNode.nodeName !== 'STYLE' && node.nodeValue.toLowerCase().includes(query.toLowerCase())) {
      nodesToReplace.push(node);
    }
  }

  if (nodesToReplace.length === 0) {
    notify(`Text "${query}" not found in report.`, 'wn');
    return;
  }