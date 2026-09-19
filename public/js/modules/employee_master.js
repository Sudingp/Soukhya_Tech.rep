window.toggleMasterSubmenu = toggleMasterSubmenu;

// Horizontal Navigation Menu Drawer Content Generators
function openMenuDrawer(section) {
  let title = 'System Details';
  let html = '';

  switch (section) {
    case 'database':
      title = 'Database Manager';
      html = `
        <div style="font-family:var(--sa); font-size:12px; color:var(--tx); line-height:1.6">
          <div style="background:var(--s2); border:1px solid var(--br); border-radius:6px; padding:12px; margin-bottom:12px">
            <div style="font-weight:600; color:var(--ac); margin-bottom:6px">Database Engine Status</div>
            <div>Engine: MySQL 8.4 LTS (InnoDB)</div>
            <div>Database: <code style="color:var(--ac2); font-family:var(--mo)">soukhya_attendance</code></div>
            <div>Collation: utf8mb4_0900_ai_ci</div>
            <div>Mode: High-Throughput Connection Pool (ACID Compliant)</div>
          </div>
          <div style="margin-bottom:12px">
            <div style="font-weight:600; margin-bottom:6px">Available Backups</div>
            <table style="width:100%; border-collapse:collapse; font-size:11px">
              <thead>
                <tr style="border-bottom:1px solid var(--br); color:var(--mu)">
                  <th style="text-align:left; padding:4px 0">File Name</th>
                  <th style="text-align:right; padding:4px 0">Size</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding:4px 0">backup_2026_06_12_0900.db</td>
                  <td style="text-align:right; padding:4px 0">245 KB</td>
                </tr>
                <tr>
                  <td style="padding:4px 0">backup_2026_06_11_0900.db</td>
                  <td style="text-align:right; padding:4px 0">240 KB</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style="display:flex; gap:8px">
            <button class="btn btnp bsm" onclick="notify('Generating hot database backup...', 'ok')">Backup Now</button>
            <button class="btn bsm" onclick="notify('Select a backup file to restore.', 'wn')">Restore</button>
          </div>
        </div>
      `;
      break;

    case 'masters':
      title = 'Master Configs';
      html = `
        <div style="font-family:var(--sa); font-size:12px; color:var(--tx)">
          <div style="font-weight:600; color:var(--ac); margin-bottom:10px">Enterprise Configuration Masters</div>
          <div class="menu-list-vertical">
            <div class="menu-list-item" onclick="closeInfoDrawer(); showTab('company', null)">
              <span class="menu-icon">🏢</span> <span class="menu-text">Companies</span>
            </div>
            <div class="menu-list-item" onclick="closeInfoDrawer(); openDivisionsModal()">
              <span class="menu-icon">🏢</span> <span class="menu-text">Divisions & Business Units</span>
            </div>
            <div class="menu-list-item" onclick="closeInfoDrawer(); openCostCentersModal()">
              <span class="menu-icon">💰</span> <span class="menu-text">Cost Centers</span>
            </div>
            <div class="menu-list-item" onclick="closeInfoDrawer(); openDesignationsModal()">
              <span class="menu-icon">👔</span> <span class="menu-text">Designations</span>
            </div>
            <div class="menu-list-item" onclick="closeInfoDrawer(); openBranchesModal()">
              <span class="menu-icon">📍</span> <span class="menu-text">Branches & Locations</span>
            </div>
            <div class="menu-list-item" onclick="closeInfoDrawer(); openTransfersModal()">
              <span class="menu-icon">🔄</span> <span class="menu-text">Career Transfers & Promotions</span>
            </div>
            <div class="menu-list-item" onclick="closeInfoDrawer(); openLiveTxMonitorModal()">
              <span class="menu-icon">⚡</span> <span class="menu-text" style="color:#00d4aa; font-weight:700">Live Transaction Monitor HUD</span>
            </div>

            <!-- Settings Dropdown / Submenu Option -->
            <div class="menu-list-item has-sub" onclick="toggleMasterSubmenu('sub-settings', event)" style="display:flex; justify-content:space-between; align-items:center">
              <div style="display:flex; align-items:center; gap:10px">
                <span class="menu-icon">⚙️</span> <span class="menu-text" style="font-weight:600">Settings</span>
              </div>
              <span id="sub-settings-arrow" style="font-size:10px; color:var(--mu); transition:transform 0.2s">▶</span>
            </div>
            <div id="sub-settings" class="menu-submenu" style="display:none; padding-left:14px; margin-left:12px; border-left:2px solid var(--ac); margin-top:2px; margin-bottom:4px">
              <div class="menu-list-item" onclick="closeInfoDrawer(); openMasterSettingsModal()">
                <span class="menu-icon">⚙️</span> <span class="menu-text">Master Settings</span>
              </div>
              <div class="menu-list-item" onclick="notify('Mail Settings config loaded.', 'ok')">
                <span class="menu-icon">✉️</span> <span class="menu-text">Mail Settings</span>
              </div>
            </div>

            <!-- Shift Dropdown / Submenu Option -->
            <div class="menu-list-item has-sub" onclick="toggleMasterSubmenu('sub-shift', event)" style="display:flex; justify-content:space-between; align-items:center">
              <div style="display:flex; align-items:center; gap:10px">
                <span class="menu-icon">⏱️</span> <span class="menu-text" style="font-weight:600">Shift</span>
              </div>
              <span id="sub-shift-arrow" style="font-size:10px; color:var(--mu); transition:transform 0.2s">▶</span>
            </div>
            <div id="sub-shift" class="menu-submenu" style="display:none; padding-left:14px; margin-left:12px; border-left:2px solid var(--ac); margin-top:2px; margin-bottom:4px">
              <div class="menu-list-item" onclick="closeInfoDrawer(); openShiftDetailsModal()">
                <span class="menu-icon">⏱️</span> <span class="menu-text">Shift Details</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openShiftCalendarModal()">
                <span class="menu-icon">📅</span> <span class="menu-text">Shift Calendar</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openShiftRosterModal()">
                <span class="menu-icon">📋</span> <span class="menu-text">Shift Roster</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openShiftGroupModal()">
                <span class="menu-icon">👥</span> <span class="menu-text">Shift Group</span>
              </div>
            </div>

            <!-- Organization Dropdown / Submenu Option -->
            <div class="menu-list-item has-sub" onclick="toggleMasterSubmenu('sub-org', event)" style="display:flex; justify-content:space-between; align-items:center">
              <div style="display:flex; align-items:center; gap:10px">
                <span class="menu-icon">🏢</span> <span class="menu-text" style="font-weight:600">Organization</span>
              </div>
              <span id="sub-org-arrow" style="font-size:10px; color:var(--mu); transition:transform 0.2s">▶</span>
            </div>
            <div id="sub-org" class="menu-submenu" style="display:none; padding-left:14px; margin-left:12px; border-left:2px solid var(--ac); margin-top:2px; margin-bottom:4px">
              <div class="menu-list-item" onclick="closeInfoDrawer(); openDepartmentsModal()">
                <span class="menu-icon">🏢</span> <span class="menu-text">Departments</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openDeptShiftsModal()">
                <span class="menu-icon">🔄</span> <span class="menu-text">Departments Shifts</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openPublicHolidaysModal()">
                <span class="menu-icon">🏖️</span> <span class="menu-text">Public Holidays</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openLeaveTypesModal()">
                <span class="menu-icon">🏥</span> <span class="menu-text">Leave Types</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openLeaveEntriesModal()">
                <span class="menu-icon">📝</span> <span class="menu-text">Employee Leave Entries</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openOutdoorEntriesModal()">
                <span class="menu-icon">🚶</span> <span class="menu-text">Employee Outdoor Entries</span>
              </div>
            </div>

            <!-- Employee Management Dropdown / Submenu Option -->
            <div class="menu-list-item has-sub" onclick="toggleMasterSubmenu('sub-emp', event)" style="display:flex; justify-content:space-between; align-items:center">
              <div style="display:flex; align-items:center; gap:10px">
                <span class="menu-icon">👥</span> <span class="menu-text" style="font-weight:600">Employee Management</span>
              </div>
              <span id="sub-emp-arrow" style="font-size:10px; color:var(--mu); transition:transform 0.2s">▶</span>
            </div>
            <div id="sub-emp" class="menu-submenu" style="display:none; padding-left:14px; margin-left:12px; border-left:2px solid var(--ac); margin-top:2px; margin-bottom:4px">
              <div class="menu-list-item" onclick="closeInfoDrawer(); showTab('employee-list', null)">
                <span class="menu-icon">👤</span> <span class="menu-text">Employees</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openEmploymentTypesModal()">
                <span class="menu-icon">👔</span> <span class="menu-text">Employment Types</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openEmployeeGroupsModal()">
                <span class="menu-icon">👥</span> <span class="menu-text">Employee Groups</span>
              </div>
            </div>

            <!-- Attendance & Time Dropdown / Submenu Option -->
            <div class="menu-list-item has-sub" onclick="toggleMasterSubmenu('sub-att', event)" style="display:flex; justify-content:space-between; align-items:center">
              <div style="display:flex; align-items:center; gap:10px">
                <span class="menu-icon">🕐</span> <span class="menu-text" style="font-weight:600">Attendance & Time</span>
              </div>
              <span id="sub-att-arrow" style="font-size:10px; color:var(--mu); transition:transform 0.2s">▶</span>
            </div>
            <div id="sub-att" class="menu-submenu" style="display:none; padding-left:14px; margin-left:12px; border-left:2px solid var(--ac); margin-top:2px; margin-bottom:4px">
              <div class="menu-list-item" onclick="closeInfoDrawer(); openAttendanceLogModal()">
                <span class="menu-icon">📊</span> <span class="menu-text">Attendance Log</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openGeofencesModal()">
                <span class="menu-icon">📍</span> <span class="menu-text">Geofences</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openWorkCodesModal()">
                <span class="menu-icon">🔢</span> <span class="menu-text">Manage Work Code</span>
              </div>
              <div class="menu-list-item" onclick="closeInfoDrawer(); openOtRegisterModal()">
                <span class="menu-icon">⏱️</span> <span class="menu-text">Employee OT Register</span>
              </div>
            </div>
          </div>
        </div>
      `;
      break;

    case 'devices':
      title = 'Biometric Device Manager';
      html = `
        <div style="font-family:var(--sa); font-size:12px; color:var(--tx)">
          <div style="font-weight:600; color:var(--ac); margin-bottom:10px">Connected Biometric Terminal Status</div>
          <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:14px">
            <div style="background:var(--s2); border:1px solid var(--br); border-radius:6px; padding:12px">
              <div style="font-weight:600; color:var(--tx); margin-bottom:4px">Edge Hardware Controllers</div>
              <div style="font-size:11px; color:var(--mu); margin-bottom:8px">Manage physical fingerprint, facial recognition & turnstile controllers</div>
              <button class="btn btnp bsm" style="width:100%" onclick="closeInfoDrawer(); openDeviceMgmtModal()">📟 Open Device Management Console</button>
            </div>
            <div style="background:var(--s2); border:1px solid var(--br); border-radius:6px; padding:12px">
              <div style="font-weight:600; color:#00d4aa; margin-bottom:4px">⚡ Real-Time Ingestion Buffer HUD</div>
              <div style="font-size:11px; color:var(--mu); margin-bottom:8px">High-throughput write buffer packet stream and TPS monitoring</div>
              <button class="btn bsm" style="width:100%; border-color:#00d4aa; color:#00d4aa" onclick="closeInfoDrawer(); openLiveTxMonitorModal()">⚡ Open Live Transaction Monitor</button>
            </div>
          </div>
          <div style="display:flex; gap:8px">
            <button class="btn bsm" style="flex:1" onclick="pingAllDevices()">⚡ Ping Readers</button>
            <button class="btn bsm" style="flex:1" onclick="openDeviceMgmtModal()">Manage Terminals</button>
          </div>
        </div>
      `;
      break;

    case 'utilities':
      title = 'System Utilities';
      html = `
        <div style="font-family:var(--sa); font-size:12px; color:var(--tx); line-height:1.6">
          <div style="font-weight:600; color:var(--ac); margin-bottom:12px">Administrative System Utilities</div>
          <div style="display:flex; flex-direction:column; gap:10px">
            <div style="background:var(--s2); border:1px solid var(--br); border-radius:6px; padding:10px; display:flex; justify-content:space-between; align-items:center">
              <div>
                <div style="font-weight:600">Recalculate Work Hours</div>
                <div style="font-size:10px; color:var(--mu)">Recalculate total duration from raw punches</div>
              </div>
              <button class="btn bsm" onclick="notify('Initiating log recalculation batch...', 'ok')">Run</button>
            </div>
            <div style="background:var(--s2); border:1px solid var(--br); border-radius:6px; padding:10px; display:flex; justify-content:space-between; align-items:center">
              <div>
                <div style="font-weight:600">Database VACUUM</div>
                <div style="font-size:10px; color:var(--mu)">Rebuild database file to reclaim free space</div>
              </div>
              <button class="btn bsm" onclick="notify('Database vacuuming completed.', 'ok')">Run</button>
            </div>
            <div style="background:var(--s2); border:1px solid var(--br); border-radius:6px; padding:10px; display:flex; justify-content:space-between; align-items:center">
              <div>
                <div style="font-weight:600">Flush Roster Cache</div>
                <div style="font-size:10px; color:var(--mu)">Clear temporary session files and charts cache</div>
              </div>
              <button class="btn bsm" onclick="notify('Session cache cleared successfully.', 'ok')">Run</button>
            </div>
          </div>
        </div>
      `;
      break;

    case 'payroll':
      title = 'Payroll System';
      html = `
        <div style="font-family:var(--sa); font-size:12px; color:var(--tx)">
          <div style="font-weight:600; color:var(--ac); margin-bottom:10px">Enterprise Payroll Summary (June 2026)</div>
          <div style="background:var(--s2); border:1px solid var(--br); border-radius:6px; padding:12px; display:flex; flex-direction:column; gap:8px; margin-bottom:12px">
            <div style="display:flex; justify-content:space-between"><span>Active Roster count:</span><span style="font-weight:600; color:var(--ac2)">75 Employees</span></div>
            <div style="display:flex; justify-content:space-between"><span>Basic Payroll processed:</span><span style="font-weight:600; color:var(--ok)">₹12,45,000</span></div>
            <div style="display:flex; justify-content:space-between"><span>TDS & Provident Fund:</span><span style="font-weight:600">₹1,85,000</span></div>
            <div style="display:flex; justify-content:space-between"><span>Pending Approvals:</span><span style="font-weight:600; color:var(--warn)">5 batches</span></div>
          </div>
          <div style="display:flex; gap:8px">
            <button class="btn btnp bsm" onclick="notify('Generating monthly payroll slips...', 'ok')">Process Slip Batch</button>
            <button class="btn bsm" onclick="notify('Exporting bank transfer file...', 'ok')">Export Bank File</button>
          </div>
        </div>
      `;
      break;

    case 'canteen':
      title = 'Canteen Terminal Summary';
      html = `
        <div style="font-family:var(--sa); font-size:12px; color:var(--tx)">
          <div style="font-weight:600; color:var(--ac); margin-bottom:10px">Canteen Facility Usage Summary</div>
          <div style="background:var(--s2); border:1px solid var(--br); border-radius:6px; padding:12px; display:flex; flex-direction:column; gap:8px; margin-bottom:12px">
            <div style="display:flex; justify-content:space-between"><span>Breakfast punches today:</span><span style="font-weight:600">42 Punches</span></div>
            <div style="display:flex; justify-content:space-between"><span>Lunch punches today:</span><span style="font-weight:600; color:var(--ac2)">68 Punches</span></div>
            <div style="display:flex; justify-content:space-between"><span>Dinner punches today:</span><span style="font-weight:600">15 Punches</span></div>
          </div>
          <div style="display:flex; gap:8px">
            <button class="btn btnp bsm" onclick="notify('Exporting Canteen Billing file...', 'ok')">Export Bills</button>
            <button class="btn bsm" onclick="notify('Canteen terminal list refreshed.', 'ok')">Refresh Terminals</button>
          </div>
        </div>
      `;
      break;

    case 'users':
      closeInfoDrawer();
      openUserMgmtModal();
      return;

    case 'audit':
      title = 'System Audit Trail';
      html = `
        <div style="font-family:var(--sa); font-size:12px; color:var(--tx); line-height:1.6">
          <div style="font-weight:600; color:var(--ac); margin-bottom:10px">Security &amp; Action Logs (Last 5 events)</div>
          <div style="background:var(--s2); border:1px solid var(--br); border-radius:6px; padding:10px; font-family:var(--mo); font-size:10px; color:var(--mu)">
            <div>[2026-06-12 14:02:15] admin: Registered employee Saurabh Sharma (EMP031)</div>
            <div style="margin-top:6px">[2026-06-12 11:30:10] system: Terminals synchronized successfully</div>
            <div style="margin-top:6px">[2026-06-12 09:28:00] admin: Clean database tables &amp; seed database</div>
            <div style="margin-top:6px">[2026-06-11 18:45:00] admin: Updated status of EMP010 to On Leave</div>
            <div style="margin-top:6px">[2026-06-11 14:15:32] operator: Biometric terminal #2 pinged successfully</div>
          </div>
          <button class="btn bsm" style="margin-top:12px" onclick="notify('Exporting security audit trail to CSV...', 'ok')">Export Audit Logs</button>
        </div>
      `;
      break;

    case 'db-settings':
      title = 'Database Settings';
      html = `
        <div style="font-family:var(--sa); font-size:12px; color:var(--tx); line-height:1.6">
          <div style="font-weight:600; color:var(--ac); margin-bottom:10px">MySQL 8.4 LTS Engine Configurations</div>
          <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:12px">
            <div class="fg" style="margin:0">
              <label class="fl">Max Connection Pool Size</label>
              <input class="fi" value="20" id="cfg-pool-size" style="padding:6px 10px; font-size:11px" />
            </div>
            <div class="fg" style="margin:0">
              <label class="fl">Keep-Alive Initial Delay (ms)</label>
              <input class="fi" value="10000" id="cfg-keepalive" style="padding:6px 10px; font-size:11px" />
            </div>
            <div class="fg" style="margin:0; display:flex; gap:8px; align-items:center">
              <input type="checkbox" checked disabled id="cfg-innodb" />
              <label style="font-size:11px; margin:0">InnoDB ACID Transactions & UTF8MB4 Collation</label>
            </div>
          </div>
          <button class="btn btnp bsm" onclick="notify('Database configuration updated.', 'ok')">Save Settings</button>
        </div>
      `;
      break;

    case 'password':
      title = 'Security Center';
      html = `
        <div style="font-family:var(--sa); font-size:12px; color:var(--tx); line-height:1.6">
          <div style="font-weight:600; color:var(--ac); margin-bottom:10px">Update System Password</div>
          <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:12px">
            <div class="fg" style="margin:0">
              <label class="fl">Current Password</label>
              <input class="fi" type="password" placeholder="••••••••" style="padding:6px 10px; font-size:11px" />
            </div>
            <div class="fg" style="margin:0">
              <label class="fl">New Password</label>
              <input class="fi" type="password" placeholder="••••••••" style="padding:6px 10px; font-size:11px" />
            </div>
            <div class="fg" style="margin:0">
              <label class="fl">Confirm New Password</label>
              <input class="fi" type="password" placeholder="••••••••" style="padding:6px 10px; font-size:11px" />
            </div>
          </div>
          <button class="btn btnp bsm" onclick="notify('Password updated successfully.', 'ok')">Change Password</button>
        </div>
      `;
      break;

    case 'about':
      title = 'About HR Enterprise';
      html = `
        <div style="font-family:var(--sa); font-size:12px; color:var(--tx); line-height:1.6; text-align:center; padding:10px 0">
          <div style="font-size:16px; font-weight:600; color:var(--ac); font-family:var(--mo); margin-bottom:6px">SOUKHYA TECH</div>
          <div style="font-size:11px; font-weight:bold; color:var(--ac2); margin-bottom:12px">HR Enterprise Suite v2.0</div>
          <div style="background:var(--s2); border:1px solid var(--br); border-radius:6px; padding:10px; font-size:11px; text-align:left; color:var(--mu)">
            <div style="margin-bottom:4px">✓ Biometric Fingerprint Sync Engine</div>
            <div style="margin-bottom:4px">✓ AI Face Recognition Engine</div>
            <div style="margin-bottom:4px">✓ RFID Card Punch Sync Engine</div>
            <div>✓ WAL Transaction Logger enabled</div>
          </div>
          <div style="margin-top:15px; font-size:10px; color:var(--mu)">
            Developed by Soukhya Tech Ltd. © 2026. All rights reserved.
          </div>
        </div>
      `;
      break;
  }

  openInfoDrawer(title, html);
}

function goToReportsMenu() {
  const hrBtn = document.querySelector('button[data-tab="hr"]');
  if (hrBtn) showTab('hr', hrBtn);
  const subRepBtn = document.querySelector('button[onclick*="sub-tab-hr-reports"]');
  if (subRepBtn) showSubTab('sub-tab-hr-reports', subRepBtn);
}


// Interactive Link Details Drawer triggers
function showLeaveSummary(id) {
  const emp = EMP.find(e => e.id === id);
  if (!emp) return;
  
  const randAllocated = 12 + Math.floor(Math.random() * 15);
  const randTaken = Math.floor(Math.random() * 8);
  const randBal = randAllocated - randTaken;

  const html = `
    <div style="font-family:var(--sa); font-size:12px; line-height:1.6">
      <div style="font-size:14px; font-weight:600; margin-bottom:12px; color:var(--ac)">Leave Details for ${emp.name}</div>
      <table style="width:100%; border:1px solid var(--br); margin-bottom:12px">
        <thead>
          <tr>
            <th style="background:var(--s2)">Leave Type</th>
            <th style="background:var(--s2)">Allocated</th>
            <th style="background:var(--s2)">Availed</th>
            <th style="background:var(--s2)">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Earned Leaves (EL)</td>
            <td>${randAllocated}</td>
            <td>${randTaken}</td>
            <td style="color:var(--ok); font-weight:600">${randBal}</td>
          </tr>
          <tr>
            <td>Casual Leaves (CL)</td>
            <td>12</td>
            <td>3</td>
            <td style="color:var(--ok); font-weight:600">9</td>
          </tr>
          <tr>
            <td>Sick Leaves (SL)</td>
            <td>8</td>
            <td>1</td>
            <td style="color:var(--ok); font-weight:600">7</td>
          </tr>
        </tbody>
      </table>
      <div style="color:var(--mu); font-size:10px">✓ Updated from HR Portal: eTimeTrackLite Sync v2.0</div>
    </div>`;
  
  openInfoDrawer('Leave Summary — ' + emp.id, html);
}