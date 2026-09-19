// ══════════════════════════════════════════════
// 👥 SHIFT GROUP CONTROLLER
// ══════════════════════════════════════════════
let allShiftGroupsList = [];
let activeManagingGroupId = null;
let allEmployeesCache = [];

async function openShiftGroupModal() {
  const modal = document.getElementById('shift-group-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  await loadShiftGroups();
}

function closeShiftGroupModal() {
  const modal = document.getElementById('shift-group-modal');
  if (modal) modal.style.display = 'none';
}

async function loadShiftGroups() {
  const container = document.getElementById('shift-groups-container');
  const countLabel = document.getElementById('shift-groups-count-label');
  if (container) container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--mu)">Loading shift groups...</div>';

  try {
    const res = await api('/shift-groups');
    if (res && res.success && Array.isArray(res.data?.groups)) {
      allShiftGroupsList = res.data.groups;
      if (countLabel) countLabel.textContent = `Showing ${allShiftGroupsList.length} configured shift group(s)`;
      renderShiftGroups(allShiftGroupsList);
    } else {
      notify('Failed to load shift groups', 'er');
    }
  } catch (err) {
    notify(`Error loading shift groups: ${err.message}`, 'er');
  }
}

async function renderShiftGroups(groups) {
  const container = document.getElementById('shift-groups-container');
  if (!container) return;

  if (groups.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:40px; background:var(--s2); border-radius:8px; border:1px solid var(--br)">
        <div style="font-size:28px; margin-bottom:10px">👥</div>
        <div style="font-size:13px; font-weight:600; color:var(--tx)">No Shift Groups Configured</div>
        <div style="font-size:11px; color:var(--mu); margin-top:4px">Create a group to configure team shift rotation cycles.</div>
        <button class="btn btnp bsm" style="margin-top:12px" onclick="openAddShiftGroupModal()">+ Add Shift Group</button>
      </div>
    `;
    return;
  }

  const shifts = await getCachedShifts();
  const shiftMap = {};
  shifts.forEach(s => { shiftMap[s.id] = s; });

  const html = groups.map(g => {
    const seq = Array.isArray(g.shifts_sequence) ? g.shifts_sequence : [];
    const seqBadges = seq.map((sId, idx) => {
      const s = shiftMap[sId] || { code: sId, name: sId, color: '#4f8ef7' };
      const arrow = idx < seq.length - 1 ? '<span class="sg-seq-arrow">→</span>' : '';
      return `
        <span class="sg-seq-item" style="background:${s.color || '#4f8ef7'}22; color:${s.color || '#4f8ef7'}; border:1px solid ${s.color || '#4f8ef7'}44">
          ${s.code || sId}
        </span>
        ${arrow}
      `;
    }).join(' ');

    return `
      <div class="shift-group-card">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px">
            <div style="display:flex; align-items:center; gap:8px">
              <span style="width:10px; height:10px; border-radius:50%; background:${g.color || '#4f8ef7'}"></span>
              <strong style="font-size:13px; color:var(--tx)">${escapeHtml(g.name)}</strong>
            </div>
            <span class="sg-badge-mode">${g.rotation_type}</span>
          </div>

          <div style="font-size:10.5px; font-family:var(--mo); color:var(--mu); margin-bottom:8px">
            Code: <strong style="color:var(--ac)">${escapeHtml(g.code)}</strong>
          </div>

          <div style="margin-bottom:10px">
            <div style="font-size:10px; color:var(--mu); margin-bottom:4px">Rotation Shift Sequence:</div>
            <div class="sg-seq-flow">${seqBadges || '<span style="font-size:10px; color:var(--mu)">No sequence</span>'}</div>
          </div>

          <div style="font-size:11px; color:var(--mu); line-height:1.4">
            ${escapeHtml(g.description || 'No description provided.')}
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--br); padding-top:10px; margin-top:4px">
          <span style="font-size:11px; font-weight:600; color:var(--tx); display:flex; align-items:center; gap:4px">
            👥 <span>${g.member_count || 0} Members</span>
          </span>
          <div style="display:flex; gap:6px">
            <button class="btn bsm" style="font-size:10.5px; padding:3px 8px" onclick="openShiftGroupMembersModal('${g.id}', '${escapeHtml(g.name)}')">👥 Members</button>
            <button class="btn bsm" style="font-size:10.5px; padding:3px 8px" onclick="openEditShiftGroupModal('${g.id}')">✏️ Edit</button>
            <button class="btn bsm" style="font-size:10.5px; padding:3px 8px; color:var(--err)" onclick="deleteShiftGroupPrompt('${g.id}', '${escapeHtml(g.name)}')">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

async function openAddShiftGroupModal() {
  const modal = document.getElementById('shift-group-form-modal');
  if (!modal) return;

  document.getElementById('sg-form-title').textContent = 'Add New Shift Group';
  document.getElementById('sg-id').value = '';
  document.getElementById('sg-name').value = '';
  document.getElementById('sg-code').value = '';
  document.getElementById('sg-code').disabled = false;
  document.getElementById('sg-desc').value = '';
  document.getElementById('sg-rotation-type').value = 'WEEKLY';
  document.getElementById('sg-color').value = '#4f8ef7';
  document.getElementById('sg-color-preview').textContent = '#4f8ef7';
  document.getElementById('sg-active').checked = true;

  await renderShiftGroupSequenceSelector(['SHIFT_MOR', 'SHIFT_EVE', 'SHIFT_NIT']);
  modal.style.display = 'flex';
}

async function openEditShiftGroupModal(id) {
  const modal = document.getElementById('shift-group-form-modal');
  if (!modal) return;

  try {
    const res = await api(`/shift-groups/${encodeURIComponent(id)}`);
    if (res && res.success && res.data?.group) {
      const g = res.data.group;
      document.getElementById('sg-form-title').textContent = `Edit Shift Group (${g.code})`;
      document.getElementById('sg-id').value = g.id;
      document.getElementById('sg-name').value = g.name;
      document.getElementById('sg-code').value = g.code;
      document.getElementById('sg-code').disabled = true;
      document.getElementById('sg-desc').value = g.description || '';
      document.getElementById('sg-rotation-type').value = g.rotation_type || 'FIXED';
      document.getElementById('sg-color').value = g.color || '#4f8ef7';
      document.getElementById('sg-color-preview').textContent = g.color || '#4f8ef7';
      document.getElementById('sg-active').checked = g.active !== false;

      await renderShiftGroupSequenceSelector(g.shifts_sequence || ['SHIFT_GEN']);
      modal.style.display = 'flex';
    } else {
      notify('Failed to load group details', 'er');
    }
  } catch (err) {
    notify(`Error opening group: ${err.message}`, 'er');
  }
}

async function renderShiftGroupSequenceSelector(selectedShiftIds) {
  const container = document.getElementById('sg-sequence-selector');
  if (!container) return;

  const shifts = await getCachedShifts();
  const selectedSet = new Set(selectedShiftIds || []);

  container.innerHTML = shifts.map(s => {
    const checked = selectedSet.has(s.id) ? 'checked' : '';
    return `
      <label style="display:inline-flex; align-items:center; gap:6px; background:var(--s1); padding:4px 10px; border-radius:4px; border:1px solid var(--br); font-size:11px; cursor:pointer">
        <input type="checkbox" name="sg-shift-seq" value="${s.id}" ${checked} />
        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${s.color}"></span>
        <span><strong>${s.code}</strong> (${s.name})</span>
      </label>
    `;
  }).join('');
}

function closeShiftGroupFormModal() {
  const modal = document.getElementById('shift-group-form-modal');
  if (modal) modal.style.display = 'none';
}

async function saveShiftGroupForm(event) {
  if (event) event.preventDefault();

  const id = document.getElementById('sg-id').value;
  const name = document.getElementById('sg-name').value.trim();
  const code = document.getElementById('sg-code').value.trim().toUpperCase();
  const rotation_type = document.getElementById('sg-rotation-type').value;
  const description = document.getElementById('sg-desc').value.trim();
  const color = document.getElementById('sg-color').value;
  const active = !!document.getElementById('sg-active').checked;

  const checkedBoxes = Array.from(document.querySelectorAll('input[name="sg-shift-seq"]:checked'));
  const shifts_sequence = checkedBoxes.map(cb => cb.value);

  if (shifts_sequence.length === 0) {
    notify('Please select at least one shift in the rotation sequence', 'wn');
    return;
  }

  const payload = { name, code, rotation_type, description, color, shifts_sequence, active };

  try {
    let res;
    if (id) {
      res = await api(`/shift-groups/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      res = await api('/shift-groups', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    if (res && res.success) {
      notify(`Shift Group "${name}" saved successfully!`, 'ok');
      closeShiftGroupFormModal();
      await loadShiftGroups();
    } else {
      notify(`Failed to save shift group: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error saving group: ${err.message}`, 'er');
  }
}

async function deleteShiftGroupPrompt(id, name) {
  if (!confirm(`Are you sure you want to delete shift group "${name}"? Assigned members will be unlinked.`)) return;

  try {
    const res = await api(`/shift-groups/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res && res.success) {
      notify(`Shift group "${name}" deleted successfully.`, 'ok');
      await loadShiftGroups();
    } else {
      notify(`Failed to delete group: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error deleting group: ${err.message}`, 'er');
  }
}

// ── Manage Shift Group Members ──
async function openShiftGroupMembersModal(groupId, groupName) {
  activeManagingGroupId = groupId;
  const modal = document.getElementById('shift-group-members-modal');
  if (!modal) return;

  document.getElementById('sgm-title').textContent = `Manage Members: ${groupName}`;
  document.getElementById('sgm-subtitle').textContent = `Assign employees to shift group ${groupId}`;

  // Fetch employees
  try {
    const [empRes, grpRes] = await Promise.all([
      api('/employees?pageSize=500'),
      api(`/shift-groups/${encodeURIComponent(groupId)}`)
    ]);

    allEmployeesCache = empRes?.data?.employees || [];
    const assignedMemberIds = new Set((grpRes?.data?.group?.members || []).map(m => m.emp_id));

    // Populate department filter
    const depts = Array.from(new Set(allEmployeesCache.map(e => e.dept || e.department).filter(Boolean)));
    const deptSelect = document.getElementById('sgm-dept-filter');
    if (deptSelect) {
      deptSelect.innerHTML = '<option value="">All Departments</option>' + depts.map(d => `<option value="${d}">${d}</option>`).join('');
    }

    renderGroupMembersList(allEmployeesCache, assignedMemberIds);
    modal.style.display = 'flex';
  } catch (err) {
    notify(`Error loading members: ${err.message}`, 'er');
  }
}

function renderGroupMembersList(employees, assignedMemberIds) {
  const tbody = document.getElementById('sgm-tbody');
  if (!tbody) return;

  const html = employees.map(emp => {
    const isChecked = assignedMemberIds.has(emp.id) ? 'checked' : '';
    const dept = emp.dept || emp.department || 'General';
    return `
      <tr class="sgm-row" data-emp-id="${emp.id}" data-dept="${escapeHtml(dept)}" data-name="${escapeHtml(emp.name.toLowerCase())}" style="border-bottom:1px solid var(--br)">
        <td style="padding:6px; text-align:center">
          <input type="checkbox" class="sgm-chk" value="${emp.id}" ${isChecked} onchange="updateGroupMemberCount()" />
        </td>
        <td style="padding:6px; font-family:var(--mo); font-weight:600; color:var(--ac)">${emp.id}</td>
        <td style="padding:6px; font-weight:600; color:var(--tx)">${escapeHtml(emp.name)}</td>
        <td style="padding:6px; color:var(--mu)">${escapeHtml(dept)}</td>
        <td style="padding:6px; color:var(--mu)">${escapeHtml(emp.role || 'Staff')}</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = html;
  updateGroupMemberCount();
}

function filterGroupMembersList() {
  const search = document.getElementById('sgm-search')?.value?.trim().toLowerCase() || '';
  const dept = document.getElementById('sgm-dept-filter')?.value || '';
  const rows = document.querySelectorAll('.sgm-row');

  rows.forEach(row => {
    const empId = (row.getAttribute('data-emp-id') || '').toLowerCase();
    const name = (row.getAttribute('data-name') || '').toLowerCase();
    const rowDept = row.getAttribute('data-dept') || '';

    const matchSearch = !search || empId.includes(search) || name.includes(search);
    const matchDept = !dept || rowDept === dept;

    row.style.display = (matchSearch && matchDept) ? '' : 'none';
  });
}

function selectAllGroupMembers(check) {
  const visibleCheckboxes = document.querySelectorAll('.sgm-row:not([style*="display: none"]) .sgm-chk');
  visibleCheckboxes.forEach(cb => { cb.checked = check; });
  updateGroupMemberCount();
}

function updateGroupMemberCount() {
  const totalChecked = document.querySelectorAll('.sgm-chk:checked').length;
  const countEl = document.getElementById('sgm-selected-count');
  if (countEl) countEl.textContent = `${totalChecked} employee(s) assigned`;
}

async function saveShiftGroupMembers() {
  if (!activeManagingGroupId) return;

  const checkedBoxes = Array.from(document.querySelectorAll('.sgm-chk:checked'));
  const emp_ids = checkedBoxes.map(cb => cb.value);

  try {
    const res = await api(`/shift-groups/${encodeURIComponent(activeManagingGroupId)}/members`, {
      method: 'POST',
      body: JSON.stringify({ emp_ids })
    });

    if (res && res.success) {
      notify(`Successfully assigned ${emp_ids.length} employees to group!`, 'ok');
      closeShiftGroupMembersModal();
      await loadShiftGroups();
    } else {
      notify(`Failed to assign group members: ${res?.error?.message || 'Server error'}`, 'er');
    }
  } catch (err) {
    notify(`Error saving group assignments: ${err.message}`, 'er');
  }
}

function closeShiftGroupMembersModal() {
  const modal = document.getElementById('shift-group-members-modal');
  if (modal) modal.style.display = 'none';
  activeManagingGroupId = null;
}
