/* =========================================================
   js/pages/profile.js - User Profile, Change Password & Staff Control
   ========================================================= */

window._staffSearch = window._staffSearch || '';
window._staffRoleFilter = window._staffRoleFilter || 'all';
window._staffStatusFilter = window._staffStatusFilter || 'all';

/* =========================================================
   METRIC COMPUTATIONS
   ========================================================= */
function userDaysWorked(userId, userName){
  const db = window.DB || {};
  const shifts = (db.shifts || []).filter(s => s.cashierId === userId || s.cashierName === userName);
  const dates = new Set(shifts.map(s => (s.openedAt || '').slice(0, 10)).filter(Boolean));
  (db.sales || []).filter(s => s.cashier === userName || s.cashierId === userId).forEach(s => {
    if(s.date) dates.add(s.date.slice(0, 10));
  });
  return dates.size;
}

function userHoursWorked(userId, userName){
  const db = window.DB || {};
  const shifts = (db.shifts || []).filter(s => s.cashierId === userId || s.cashierName === userName);
  let totalMs = 0;
  for(const s of shifts){
    if(s.openedAt){
      const start = new Date(s.openedAt).getTime();
      const end = s.closedAt ? new Date(s.closedAt).getTime() : Date.now();
      totalMs += Math.max(0, end - start);
    }
  }
  const totalHours = Math.floor(totalMs / 3600000);
  const mins = Math.floor((totalMs % 3600000) / 60000);
  return { totalHours, mins, text: `${totalHours}h ${mins}m` };
}

function userSalesStats(userId, userName){
  const db = window.DB || {};
  const sales = (db.sales || []).filter(s => s.cashier === userName || s.cashierId === userId);
  const count = sales.length;
  const total = sales.reduce((a, s) => a + Number(s.total || 0), 0);
  const avg = count > 0 ? (total / count) : 0;
  return { count, total, avg };
}

function userPerformanceScore(userId, userName){
  const db = window.DB || {};
  const shifts = (db.shifts || []).filter(s => s.cashierId === userId || s.cashierName === userName);
  const totalVar = shifts.reduce((a, s) => a + Math.abs(Number(s.variance || 0)), 0);
  const sales = (db.sales || []).filter(s => s.cashier === userName || s.cashierId === userId);
  const totalSales = sales.reduce((a, s) => a + Number(s.total || 0), 0);
  if(totalSales <= 0) return 100;
  const score = Math.max(0, Math.min(100, Math.round(100 - (totalVar / totalSales * 100))));
  return score;
}

/* =========================================================
   MAIN VIEW: pgProfile
   ========================================================= */
function pgProfile(){
  const u = state.user;
  if(!u){
    return `<div class="card"><div class="empty">කරුණාකර ප්‍රථමයෙන් පිවිසෙන්න</div></div>`;
  }

  const db = window.DB || {};
  const userShifts = (db.shifts || [])
    .filter(s => s.cashierId === u.id || s.cashierName === u.name)
    .slice()
    .reverse();

  const daysWorked = userDaysWorked(u.id, u.name);
  const hoursWorked = userHoursWorked(u.id, u.name);
  const salesStats = userSalesStats(u.id, u.name);
  const perfScore = userPerformanceScore(u.id, u.name);

  const isAdminOrSuper = u.role === 'admin' || u.role === 'superadmin';

  return `
  <div class="profile-wrap">

    <!-- 1. Hero Profile Card -->
    <div class="profile-hero">
      <div class="profile-hero-left">
        <div class="profile-avatar">${esc(u.name.charAt(0).toUpperCase())}</div>
        <div class="profile-meta">
          <h2>
            ${esc(u.name)}
            <span class="badge ${u.role}">${ROLE_EN[u.role] || u.role}</span>
          </h2>
          <div class="profile-sub">
            <span>👤 @${esc(u.username)}</span>
            <span>📧 ${esc(u.email || (u.username + '@autoparts.lk'))}</span>
            <span>📱 ${esc(u.phone || '077-1234567')}</span>
            <span>🕐 Joined: ${esc(u.joined || '2026-01-15')}</span>
          </div>
        </div>
      </div>
      <div class="profile-hero-actions">
        <button class="btn btn-sm" onclick="openEditProfileModal()">✏️ විස්තර සංස්කරණය (Edit)</button>
        <button class="btn btn-sm btn-primary" onclick="openChangePasswordModal()">🔑 මුරපදය වෙනස් කරන්න (Change Password)</button>
      </div>
    </div>

    <!-- 2. Work Summary Metrics -->
    <div>
      <div class="profile-section-title">
        <span>📊 ඔබේ වැඩ සාරාංශය (Your Work Summary)</span>
      </div>
      <div class="profile-stats-grid">
        <div class="profile-stat-box">
          <div class="ps-ico">📅</div>
          <div class="ps-val">${daysWorked}</div>
          <div class="ps-lbl-si">දින ${daysWorked}</div>
          <div class="ps-lbl-en">Days Worked</div>
        </div>
        <div class="profile-stat-box">
          <div class="ps-ico">🕐</div>
          <div class="ps-val">${hoursWorked.totalHours}h</div>
          <div class="ps-lbl-si">පැය ${hoursWorked.totalHours}</div>
          <div class="ps-lbl-en">Hours Worked</div>
        </div>
        <div class="profile-stat-box">
          <div class="ps-ico">🧾</div>
          <div class="ps-val">${salesStats.count}</div>
          <div class="ps-lbl-si">බිල් ${salesStats.count}</div>
          <div class="ps-lbl-en">Bills Issued</div>
        </div>
        <div class="profile-stat-box">
          <div class="ps-ico">💰</div>
          <div class="ps-val">${money(salesStats.total)}</div>
          <div class="ps-lbl-si">මුළු විකුණුම්</div>
          <div class="ps-lbl-en">Total Sales</div>
        </div>
        <div class="profile-stat-box">
          <div class="ps-ico">📊</div>
          <div class="ps-val">${money(salesStats.avg)}</div>
          <div class="ps-lbl-si">බිලක සාමාන්‍යය</div>
          <div class="ps-lbl-en">Avg Per Bill</div>
        </div>
        <div class="profile-stat-box">
          <div class="ps-ico">⭐</div>
          <div class="ps-val" style="color:var(--green)">${perfScore}%</div>
          <div class="ps-lbl-si">කාර්යසාධනය</div>
          <div class="ps-lbl-en">Performance</div>
        </div>
      </div>
    </div>

    <!-- 3. Recent Shifts Table -->
    <div class="card">
      <div class="card-h">
        <h3>📋 අවසන් Shift (Recent Shifts)<small>Your shift logs & variance tracking</small></h3>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Shift ID</th>
              <th>දිනය / Date</th>
              <th>කාලය / Duration</th>
              <th style="text-align:right">ආරම්භක මුදල / Float</th>
              <th style="text-align:right">විකුණුම් / Sales</th>
              <th style="text-align:center">වෙනස / Variance</th>
              <th style="text-align:center">තත්ත්වය / Status</th>
            </tr>
          </thead>
          <tbody>
            ${userShifts.length ? userShifts.slice(0, 6).map(s => {
              const dur = Shift.duration(s);
              const sm = Shift.summary(s.id);
              const v = s.variance;
              let varHtml = '<span style="color:var(--muted)">—</span>';
              if(v != null){
                if(Math.abs(v) < 0.01) varHtml = '<b style="color:var(--green)">+0 (Balanced)</b>';
                else if(v > 0) varHtml = `<b style="color:#fcd34d">+ ${money(v)}</b>`;
                else varHtml = `<b style="color:var(--red)">- ${money(Math.abs(v))}</b>`;
              }
              return `
              <tr>
                <td><b>${esc(s.id)}</b></td>
                <td><small>${new Date(s.openedAt).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})}</small></td>
                <td><small>${dur.text}</small></td>
                <td style="text-align:right">${money(s.openingFloat)}</td>
                <td style="text-align:right;font-weight:700;color:var(--primary)">${money(sm ? sm.totalSales : 0)}</td>
                <td style="text-align:center">${varHtml}</td>
                <td style="text-align:center"><span class="pill ${s.status==='open'?'warn':'ok'}">${s.status==='open'?'ක්‍රියාකාරී (Open)':'අවසන් (Closed)'}</span></td>
              </tr>`;
            }).join('') : `<tr><td colspan="7" class="empty">කිසිදු Shift එකක් හමු නොවීය (No shifts recorded)</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <!-- 4. Staff Control Center (Staff Permission Required) -->
    ${hasPermission('staff') ? renderStaffControlSection() : ''}

  </div>`;
}

/* =========================================================
   STAFF CONTROL CENTER (Admin / Superadmin only)
   ========================================================= */
function renderStaffControlSection(){
  const db = window.DB || {};
  const q = (window._staffSearch || '').toLowerCase().trim();
  const roleF = window._staffRoleFilter || 'all';
  const statusF = window._staffStatusFilter || 'all';

  const isSuper = state.user.role === 'superadmin';
  const isAdmin = state.user.role === 'admin';

  const shopObj = (db.shops || []).find(s => s.id === state.user.shopId);
  const shopTitleSuffix = isAdmin ? (shopObj ? ` — ${esc(shopObj.name)}` : '') : '';

  const users = (db.users || []).filter(u => {
    if(u.deleted) return false;
    // CRITICAL: Admin only sees Cashiers from their OWN shop
    if(isAdmin){
      if(u.shopId !== state.user.shopId || u.role !== 'cashier') return false;
    }
    if(roleF !== 'all' && u.role !== roleF) return false;
    if(statusF === 'active' && (u.locked || !u.active)) return false;
    if(statusF === 'locked' && (!u.locked && u.active)) return false;
    if(q){
      const matchName = (u.name || '').toLowerCase().includes(q);
      const matchUser = (u.username || '').toLowerCase().includes(q);
      const matchPhone = (u.phone || '').toLowerCase().includes(q);
      return matchName || matchUser || matchPhone;
    }
    return true;
  });

  return `
  <div class="staff-ctrl-card">
    <div class="card-h">
      <div>
        <h3>👥 කාර්ය මණ්ඩල පාලනය · Staff Control Center${shopTitleSuffix}</h3>
        <small style="color:var(--muted)">
          ${isAdmin ? `ඔබගේ සාප්පුවේ කැෂියර්වරුන් කළමනාකරණය (${users.length} කැෂියර්වරු)` : `පද්ධතියේ සියලු කාර්ය මණ්ඩලය කළමනාකරණය (${users.length} පරිශීලකයන්)`}
        </small>
      </div>
      <div>
        <button class="btn btn-primary btn-sm" onclick="${isAdmin ? 'openAddCashierModal()' : 'openAddUserModal()'}">
          ➕ නව කැෂියර් එකතු කරන්න
        </button>
      </div>
    </div>

    <div class="staff-toolbar">
      <div class="staff-filters">
        <input id="staffSearchInp" placeholder="🔍 නම / Username සොයන්න..."
               value="${esc(window._staffSearch)}"
               oninput="window._staffSearch=this.value;render()">
        ${isSuper ? `
        <select onchange="window._staffRoleFilter=this.value;render()">
          <option value="all" ${roleF==='all'?'selected':''}>සියලු භූමිකාවන් (All Roles)</option>
          <option value="cashier" ${roleF==='cashier'?'selected':''}>කැෂියර් (Cashier)</option>
          <option value="admin" ${roleF==='admin'?'selected':''}>පරිපාලක (Admin)</option>
          <option value="superadmin" ${roleF==='superadmin'?'selected':''}>සුපිරි පරිපාලක (Super Admin)</option>
        </select>` : ''}
        <select onchange="window._staffStatusFilter=this.value;render()">
          <option value="all" ${statusF==='all'?'selected':''}>සියලු තත්ත්ව (All Status)</option>
          <option value="active" ${statusF==='active'?'selected':''}>🟢 සක්‍රීය (Active)</option>
          <option value="locked" ${statusF==='locked'?'selected':''}>🔴 අගුළු දැමූ (Locked)</option>
        </select>
      </div>
    </div>

    <div class="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>පරිශීලක / User</th>
            <th>Username</th>
            <th>භූමිකාව / Role</th>
            <th>දුරකථන / Phone</th>
            <th>තත්ත්වය / Status</th>
            <th style="text-align:right">ක්‍රියා / Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.length ? users.map(u => {
            const isSelf = u.id === state.user.id;
            const isLocked = Boolean(u.locked || !u.active);
            return `
            <tr>
              <td>
                <div class="staff-user-cell">
                  <div class="staff-avatar-sm">${esc(u.name.charAt(0).toUpperCase())}</div>
                  <div>
                    <b>${esc(u.name)}</b>
                    ${isSelf ? '<span style="color:var(--primary);font-size:11px;margin-left:4px">(ඔබ)</span>' : ''}
                    <div style="font-size:11px;color:var(--muted)">${esc(u.email || u.username+'@autoparts.lk')}</div>
                  </div>
                </div>
              </td>
              <td><code>${esc(u.username)}</code></td>
              <td><span class="badge ${u.role}">${ROLE_EN[u.role] || u.role}</span></td>
              <td><small>${esc(u.phone || '—')}</small></td>
              <td>
                <span class="pill ${isLocked ? 'bad' : 'ok'}" title="${isLocked ? esc(u.lockMessage || 'ගිණුම අගුළු දමා ඇත') : 'Active'}">
                  ${isLocked ? '🔴 අගුළු දැමූ (Locked)' : '🟢 සක්‍රීය (Active)'}
                </span>
              </td>
              <td style="text-align:right">
                <div class="staff-actions" style="justify-content:flex-end">
                  <button class="btn btn-sm" onclick="openEditUserModal('${u.id}')" title="සංස්කරණය / Edit">✏️</button>
                  <button class="btn btn-sm" onclick="openResetPasswordModal('${u.id}')" title="මුරපදය Reset">🔑</button>
                  ${isLocked ? `
                    <button class="btn btn-sm btn-green" onclick="unlockUser('${u.id}')" title="අගුළු හරින්න (Unlock)">
                      🔓
                    </button>
                  ` : `
                    <button class="btn btn-sm btn-red" onclick="openLockUserModal('${u.id}')" title="අගුළු දමන්න (Lock with message)">
                      🔒
                    </button>
                  `}
                  ${isSuper && !isSelf ? `
                    <button class="btn btn-sm btn-red" onclick="deleteUser('${u.id}')" title="මකන්න / Delete">🗑️</button>
                  ` : ''}
                </div>
              </td>
            </tr>`;
          }).join('') : `
            <tr><td colspan="6" class="empty">කිසිදු පරිශීලකයෙකු හමු නොවීය</td></tr>
          `}
        </tbody>
      </table>
    </div>
  </div>`;
}

/* =========================================================
   CHANGE PASSWORD MODAL (CASHIER & ADMIN)
   ========================================================= */
function openChangePasswordModal(){
  openModal('🔑 මුරපදය වෙනස් කරන්න', 'Change Password',
  `<div style="display:flex;flex-direction:column;gap:13px;padding:4px 0">
     <div>
       <label style="font-size:12px;color:var(--muted);font-weight:600">වත්මන් මුරපදය / Current Password *</label>
       <div class="pwd-input-wrap" style="margin-top:4px">
         <input id="pwdCurrent" type="password" placeholder="වත්මන් මුරපදය" autofocus>
         <button type="button" class="pwd-toggle-btn" onclick="togglePwdVis('pwdCurrent')">👁️</button>
       </div>
     </div>

     <div>
       <label style="font-size:12px;color:var(--muted);font-weight:600">නව මුරපදය / New Password *</label>
       <div class="pwd-input-wrap" style="margin-top:4px">
         <input id="pwdNew" type="password" placeholder="නව මුරපදය (අවම අක්ෂර 6)" oninput="checkPwdStrength(this.value)">
         <button type="button" class="pwd-toggle-btn" onclick="togglePwdVis('pwdNew')">👁️</button>
       </div>
     </div>

     <div>
       <label style="font-size:12px;color:var(--muted);font-weight:600">නව මුරපදය තහවුරු කරන්න / Confirm New Password *</label>
       <div class="pwd-input-wrap" style="margin-top:4px">
         <input id="pwdConfirm" type="password" placeholder="නව මුරපදය නැවත ඇතුළත් කරන්න">
         <button type="button" class="pwd-toggle-btn" onclick="togglePwdVis('pwdConfirm')">👁️</button>
       </div>
     </div>

     <div class="pwd-strength-container">
       <div style="display:flex;justify-content:space-between;font-size:11.5px">
         <span style="color:var(--muted)">── බලය (Strength) ──</span>
         <b id="pwdStrengthLbl" style="color:#ef4444">දුර්වලයි (Weak)</b>
       </div>
       <div class="pwd-strength-bar">
         <div id="pwdStrengthFill" class="pwd-strength-fill weak"></div>
       </div>
       <ul class="pwd-rules" style="padding-left:0">
         <li id="ruleMinLen" class="invalid"><span>✓</span> අවම 6 අක්ෂර (Min 6 characters)</li>
         <li id="ruleHasDigit" class="invalid"><span>✓</span> ඉලක්කමක් 1ක් (At least 1 digit)</li>
       </ul>
     </div>
   </div>`,
  `<button class="btn" onclick="closeModal()">අවලංගු</button>
   <button class="btn btn-primary" onclick="submitChangePassword()">🔑 වෙනස් කරන්න (Update)</button>`,
  false);
}

function togglePwdVis(id){
  const inp = $(`#${id}`);
  if(!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function checkPwdStrength(val){
  const fill = $('#pwdStrengthFill');
  const lbl = $('#pwdStrengthLbl');
  const ruleLen = $('#ruleMinLen');
  const ruleDigit = $('#ruleHasDigit');

  const hasLen = (val || '').length >= 6;
  const hasDigit = /\d/.test(val || '');
  const hasSpecial = /[^A-Za-z0-9]/.test(val || '');

  if(ruleLen) ruleLen.className = hasLen ? 'valid' : 'invalid';
  if(ruleDigit) ruleDigit.className = hasDigit ? 'valid' : 'invalid';

  if(!fill || !lbl) return;

  if(!val || val.length < 6){
    fill.className = 'pwd-strength-fill weak';
    lbl.style.color = '#ef4444';
    lbl.textContent = 'දුර්වලයි (Weak)';
  } else if(hasLen && hasDigit && hasSpecial){
    fill.className = 'pwd-strength-fill strong';
    lbl.style.color = '#10b981';
    lbl.textContent = 'ඉතා හොඳයි (Strong)';
  } else if(hasLen && hasDigit){
    fill.className = 'pwd-strength-fill good';
    lbl.style.color = '#f59e0b';
    lbl.textContent = 'හොඳයි (Good)';
  } else {
    fill.className = 'pwd-strength-fill weak';
    lbl.style.color = '#ef4444';
    lbl.textContent = 'දුර්වලයි (Weak)';
  }
}

async function submitChangePassword(){
  const curr = $('#pwdCurrent')?.value || '';
  const newP = $('#pwdNew')?.value || '';
  const conf = $('#pwdConfirm')?.value || '';

  if(!curr){ toast('කරුණාකර වත්මන් මුරපදය ඇතුළත් කරන්න', 'err'); return; }

  // Verify current password with Security.verifyPassword
  const ok = window.Security 
    ? await window.Security.verifyPassword(curr, state.user.password)
    : (curr === state.user.password);

  if(!ok){
    toast('❌ වත්මන් මුරපදය වැරදියි (Current password incorrect)', 'err');
    return;
  }
  if(newP.length < 6){
    toast('නව මුරපදය අවම වශයෙන් අක්ෂර 6ක් විය යුතුය (Min 6 chars)', 'err');
    return;
  }
  if(!/\d/.test(newP)){
    toast('නව මුරපදයේ අවම වශයෙන් එක් ඉලක්කමක්වත් අඩංගු විය යුතුය (Must contain a digit)', 'err');
    return;
  }
  if(newP !== conf){
    toast('❌ තහවුරු කළ මුරපදය නොගැලපේ (Passwords do not match)', 'err');
    return;
  }

  // Hash new password using bcrypt
  const hashed = window.Security ? await window.Security.hashPassword(newP) : newP;

  const db = window.DB || {};
  const user = (db.users || []).find(u => u.id === state.user.id);
  if(user){
    user.password = hashed;
    if(window.FB && window.FB.fbUpdate){
      await window.FB.fbUpdate(window.FB.COL.users, user.id, { password: hashed });
    }
    if(typeof saveDB === 'function') saveDB();
  }
  state.user.password = hashed;

  closeModal();
  toast('✅ මුරපදය සාර්ථකව වෙනස් විය! කරුණාකර නැවත පිවිසෙන්න.', 'ok');

  /* Force logout after 2 sec */
  setTimeout(() => {
    if(typeof doLogout === 'function') doLogout();
  }, 2000);
}

/* =========================================================
   EDIT PROFILE MODAL
   ========================================================= */
function openEditProfileModal(){
  const u = state.user;
  openModal('✏️ විස්තර සංස්කරණය', 'Edit Profile Details',
  `<div style="display:flex;flex-direction:column;gap:12px">
     <div>
       <label style="font-size:12px;color:var(--muted);font-weight:600">නම / Name *</label>
       <input id="epName" value="${esc(u.name)}" style="margin-top:4px">
     </div>
     <div>
       <label style="font-size:12px;color:var(--muted);font-weight:600">දුරකථන / Phone</label>
       <input id="epPhone" value="${esc(u.phone || '')}" placeholder="077-XXXXXXX" style="margin-top:4px">
     </div>
     <div>
       <label style="font-size:12px;color:var(--muted);font-weight:600">Email</label>
       <input id="epEmail" type="email" value="${esc(u.email || '')}" placeholder="name@shop.com" style="margin-top:4px">
     </div>
   </div>`,
  `<button class="btn" onclick="closeModal()">අවලංගු</button>
   <button class="btn btn-primary" onclick="saveEditProfile()">💾 සුරකින්න (Save)</button>`,
  false);
}

async function saveEditProfile(){
  const name = $('#epName')?.value.trim();
  const phone = $('#epPhone')?.value.trim();
  const email = $('#epEmail')?.value.trim();

  if(!name){ toast('කරුණාකර නම ඇතුළත් කරන්න', 'err'); return; }

  const db = window.DB || {};
  const user = (db.users || []).find(u => u.id === state.user.id);
  if(user){
    user.name = name;
    user.phone = phone;
    user.email = email;
    if(window.FB && window.FB.fbUpdate){
      await window.FB.fbUpdate(window.FB.COL.users, user.id, { name, phone, email });
    }
    if(typeof saveDB === 'function') saveDB();
  }
  state.user.name = name;
  state.user.phone = phone;
  state.user.email = email;

  const uName = $('#uName');
  if(uName) uName.textContent = name;
  const uAvatar = $('#uAvatar');
  if(uAvatar) uAvatar.textContent = name.charAt(0);

  closeModal();
  toast('පැතිකඩ විස්තර යාවත්කාලීන විය ✅');
  render();
}

/* =========================================================
   PERMISSION EDITOR HELPER FUNCTIONS (STAFF CONTROL)
   ========================================================= */
function renderPermEditorHtml(selectedPerms = [], isSelf = false){
  const groups = window.PERMISSION_GROUPS || [];
  const perms = window.PERMISSIONS || [];
  const activeCount = selectedPerms.length;
  const totalCount = perms.length;

  return `
  <div class="perm-section">
    <div class="perm-header">
      <div class="perm-header-title">
        <span>🔐 අවසර කළමනාකරණය · Permissions</span>
        <span class="perm-count-badge" id="permCountBadge">${activeCount} of ${totalCount} permissions</span>
      </div>
    </div>

    ${isSelf ? `
      <div style="color:#fcd34d;font-size:11.5px;background:rgba(245,158,11,0.12);padding:7px 10px;border-radius:6px;border:1px solid rgba(245,158,11,0.3)">
        ⚠️ ඔබේම ගිණුමේ අවසර වෙනස් කළ නොහැක (You cannot edit your own permissions)
      </div>
    ` : `
      <div class="perm-presets-bar">
        <span class="perm-preset-lbl">Presets:</span>
        <button type="button" class="perm-preset-btn" onclick="applyPermPreset('cashier')">💵 Cashier</button>
        <button type="button" class="perm-preset-btn" onclick="applyPermPreset('supervisor')">🛡️ Supervisor</button>
        <button type="button" class="perm-preset-btn" onclick="applyPermPreset('inventory_mgr')">📦 Inventory</button>
        <button type="button" class="perm-preset-btn" onclick="applyPermPreset('sales_mgr')">📈 Sales Mgr</button>
        <button type="button" class="perm-preset-btn" onclick="applyPermPreset('full')">⚡ Full Access</button>
        <div class="perm-quick-actions">
          <button type="button" class="perm-quick-btn" onclick="toggleAllPerms(true)">සියල්ල (All)</button>
          <button type="button" class="perm-quick-btn" onclick="toggleAllPerms(false)">කිසිවක් නැත (None)</button>
        </div>
      </div>
    `}

    <div class="perm-groups-wrap">
      ${groups.map(g => {
        const groupPerms = perms.filter(p => p.group === g.id);
        if(!groupPerms.length) return '';
        return `
          <div class="perm-group-card">
            <div class="perm-group-title">
              <span>${g.icon} ${esc(g.si)}</span>
              <small>· ${esc(g.name)}</small>
            </div>
            <div class="perm-grid">
              ${groupPerms.map(p => {
                const checked = selectedPerms.includes(p.id) ? 'checked' : '';
                const disabled = isSelf ? 'disabled' : '';
                return `
                  <label class="perm-item">
                    <input type="checkbox" name="userPerm" value="${esc(p.id)}" ${checked} ${disabled} onchange="updatePermCountBadge()">
                    <div class="perm-item-content">
                      <div class="perm-item-label">
                        ${esc(p.si)}
                        <small>(${esc(p.name)})</small>
                      </div>
                      <div class="perm-item-desc">${esc(p.desc)}</div>
                    </div>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  </div>`;
}

function applyPermPreset(presetKey){
  const preset = (window.PERMISSION_PRESETS || {})[presetKey];
  if(!preset) return;
  const boxes = document.querySelectorAll('input[name="userPerm"]');
  boxes.forEach(cb => {
    if(!cb.disabled){
      cb.checked = preset.perms.includes(cb.value);
    }
  });
  updatePermCountBadge();
}

function toggleAllPerms(check){
  const boxes = document.querySelectorAll('input[name="userPerm"]');
  boxes.forEach(cb => {
    if(!cb.disabled){
      cb.checked = !!check;
    }
  });
  updatePermCountBadge();
}

function updatePermCountBadge(){
  const boxes = document.querySelectorAll('input[name="userPerm"]');
  const checked = Array.from(boxes).filter(cb => cb.checked).length;
  const badge = document.getElementById('permCountBadge');
  if(badge){
    badge.textContent = `${checked} of ${boxes.length} permissions`;
  }
}

function getSelectedPermsFromModal(){
  const boxes = document.querySelectorAll('input[name="userPerm"]:checked');
  return Array.from(boxes).map(cb => cb.value);
}

function onRoleChangeAddUser(role){
  if(role === 'cashier'){
    applyPermPreset('cashier');
  } else if(role === 'admin'){
    applyPermPreset('full');
  } else if(role === 'superadmin'){
    toggleAllPerms(true);
  }
}

/* =========================================================
   ADD CASHIER / USER MODAL (STAFF CONTROL)
   ========================================================= */
function openAddCashierModal(){
  const db = window.DB || {};
  const shopObj = (db.shops || []).find(s => s.id === state.user.shopId);
  const shopName = shopObj ? shopObj.name : 'Current Shop';

  const defaultPerms = (window.PERMISSION_PRESETS && window.PERMISSION_PRESETS.cashier)
    ? window.PERMISSION_PRESETS.cashier.perms
    : ['billing', 'dashboard', 'customers', 'lowstock', 'profile'];
  const permHtml = renderPermEditorHtml(defaultPerms, false);

  openModal(
    '➕ නව කැෂියර් එකතු කරන්න',
    `Add Cashier to ${shopName}`,
    `<div style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600">නම / Name *</label>
        <input id="nuName" placeholder="උදා: සුනිල් පෙරේරා" style="margin-top:4px">
      </div>
      <div class="grid2">
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600">පරිශීලක නාමය / Username *</label>
          <input id="nuUser" placeholder="sunil" style="margin-top:4px">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600">මුරපදය / Password *</label>
          <input id="nuPass" value="1234" style="margin-top:4px">
        </div>
      </div>
      <div class="grid2">
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600">දුරකථන / Phone</label>
          <input id="nuPhone" placeholder="077-XXXXXXX" style="margin-top:4px">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600">Email</label>
          <input id="nuEmail" placeholder="user@shop.com" style="margin-top:4px">
        </div>
      </div>
      <div style="background:#0f172a;padding:10px 12px;border-radius:6px;border:1px solid var(--line);font-size:12px;color:var(--muted)">
        ශාඛාව: <b>${esc(shopName)}</b> · භූමිකාව: <span class="badge cashier">Cashier</span>
      </div>
      ${permHtml}
    </div>`,
    `<button class="btn" onclick="closeModal()">අවලංගු</button>
     <button class="btn btn-primary" onclick="saveNewCashier()">✅ සුරකින්න (Save)</button>`,
    true
  );
  setTimeout(updatePermCountBadge, 50);
}

async function saveNewCashier(){
  const name = $('#nuName')?.value.trim();
  const username = $('#nuUser')?.value.trim().toLowerCase();
  const password = $('#nuPass')?.value.trim();
  const phone = $('#nuPhone')?.value.trim();
  const email = $('#nuEmail')?.value.trim();

  if(!name || !username || !password){
    toast('කරුණාකර සියලු අනිවාර්ය ක්ෂේත්‍ර පුරවන්න (*)', 'err');
    return;
  }

  const db = window.DB || {};
  if((db.users || []).some(u => !u.deleted && u.username.toLowerCase() === username)){
    toast('මෙම පරිශීලක නාමය දැනටමත් භාවිතා කර ඇත (Username already exists)', 'warn');
    return;
  }

  const selectedPerms = getSelectedPermsFromModal();
  const permissions = selectedPerms.length ? selectedPerms : ['billing', 'dashboard', 'customers', 'lowstock', 'profile'];

  const hashedPassword = window.Security ? await window.Security.hashPassword(password) : password;

  const newCashier = {
    id: uid('U'),
    name,
    username,
    password: hashedPassword,
    role: 'cashier',
    permissions,
    shopId: state.user.shopId || 'SHOP-001',
    phone,
    email: email || `${username}@autoparts.lk`,
    joined: today(),
    createdAt: new Date().toISOString(),
    createdBy: state.user.id,
    active: true,
    locked: false,
    lockMessage: '',
    lockedBy: null,
    lockedAt: null,
    deleted: false
  };

  if(!db.users) db.users = [];
  db.users.push(newCashier);

  if(window.FB && window.FB.fbSet){
    await window.FB.fbSet(window.FB.COL.users, newCashier.id, newCashier);
  }
  if(typeof saveDB === 'function') saveDB();

  closeModal();
  toast(`නව කැෂියර්වරයා (${name}) සාර්ථකව එකතු කළා ✅`);
  render();
}

function openAddUserModal(){
  if(state.user.role === 'admin'){
    return openAddCashierModal();
  }

  const isSuper = state.user.role === 'superadmin';
  const db = window.DB || {};
  const shops = db.shops || [];

  const defaultPerms = (window.PERMISSION_PRESETS && window.PERMISSION_PRESETS.cashier)
    ? window.PERMISSION_PRESETS.cashier.perms
    : ['billing', 'dashboard', 'customers', 'lowstock', 'profile'];
  const permHtml = renderPermEditorHtml(defaultPerms, false);

  openModal('➕ නව පරිශීලක එකතු කරන්න', 'Add Staff Member',
  `<div style="display:flex;flex-direction:column;gap:12px">
     <div>
       <label style="font-size:12px;color:var(--muted);font-weight:600">නම / Name *</label>
       <input id="nuName" placeholder="උදා: සුනිල් පෙරේරා" style="margin-top:4px">
     </div>
     <div class="grid2">
       <div>
         <label style="font-size:12px;color:var(--muted);font-weight:600">පරිශීලක නාමය / Username *</label>
         <input id="nuUser" placeholder="sunil" style="margin-top:4px">
       </div>
       <div>
         <label style="font-size:12px;color:var(--muted);font-weight:600">මුරපදය / Password *</label>
         <input id="nuPass" value="1234" style="margin-top:4px">
       </div>
     </div>
     <div class="grid2">
       <div>
         <label style="font-size:12px;color:var(--muted);font-weight:600">දුරකථන / Phone</label>
         <input id="nuPhone" placeholder="077-XXXXXXX" style="margin-top:4px">
       </div>
       <div>
         <label style="font-size:12px;color:var(--muted);font-weight:600">Email</label>
         <input id="nuEmail" placeholder="user@shop.com" style="margin-top:4px">
       </div>
     </div>
     <div class="grid2">
       <div>
         <label style="font-size:12px;color:var(--muted);font-weight:600">භූමිකාව / Role *</label>
         <select id="nuRole" style="margin-top:4px" onchange="onRoleChangeAddUser(this.value)">
           <option value="cashier" selected>කැෂියර් (Cashier)</option>
           <option value="admin">පරිපාලක (Admin)</option>
           ${isSuper ? '<option value="superadmin">සුපිරි පරිපාලක (Super Admin)</option>' : ''}
         </select>
       </div>
       <div>
         <label style="font-size:12px;color:var(--muted);font-weight:600">සාප්පුව / Shop</label>
         <select id="nuShop" style="margin-top:4px">
           ${shops.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
         </select>
       </div>
     </div>
     ${permHtml}
   </div>`,
  `<button class="btn" onclick="closeModal()">අවලංගු</button>
   <button class="btn btn-primary" onclick="saveNewUser()">✅ සුරකින්න (Save)</button>`,
  true);
  setTimeout(updatePermCountBadge, 50);
}

async function saveNewUser(){
  const name = $('#nuName')?.value.trim();
  const username = $('#nuUser')?.value.trim().toLowerCase();
  const password = $('#nuPass')?.value.trim();
  const phone = $('#nuPhone')?.value.trim();
  const email = $('#nuEmail')?.value.trim();
  const role = $('#nuRole')?.value || 'cashier';
  const shopId = $('#nuShop')?.value || (state.user ? state.user.shopId : null);

  if(!name || !username || !password){
    toast('කරුණාකර සියලු අනිවාර්ය ක්ෂේත්‍ර පුරවන්න (*)', 'err');
    return;
  }

  const db = window.DB || {};
  if((db.users || []).some(u => !u.deleted && u.username.toLowerCase() === username)){
    toast('මෙම පරිශීලක නාමය දැනටමත් භාවිතා කර ඇත (Username already exists)', 'warn');
    return;
  }

  const selectedPerms = getSelectedPermsFromModal();
  const defaultPerms = (typeof getDefaultPermissionsForRole === 'function') 
    ? getDefaultPermissionsForRole(role) 
    : ['billing', 'dashboard', 'customers', 'lowstock', 'profile'];
  const permissions = selectedPerms.length ? selectedPerms : defaultPerms;

  const hashedPassword = window.Security ? await window.Security.hashPassword(password) : password;

  const newUser = {
    id: uid('U'),
    name,
    username,
    password: hashedPassword,
    role,
    permissions,
    shopId,
    phone,
    email: email || `${username}@autoparts.lk`,
    joined: today(),
    createdAt: new Date().toISOString(),
    createdBy: state.user ? state.user.id : 'system',
    active: true,
    locked: false,
    lockMessage: '',
    lockedBy: null,
    lockedAt: null,
    deleted: false
  };

  if(!db.users) db.users = [];
  db.users.push(newUser);

  if(window.FB && window.FB.fbSet){
    await window.FB.fbSet(window.FB.COL.users, newUser.id, newUser);
  }
  if(typeof saveDB === 'function') saveDB();

  closeModal();
  toast(`නව පරිශීලකයා (${name}) සාර්ථකව එකතු කළා ✅`);
  render();
}

/* =========================================================
   EDIT USER MODAL (STAFF CONTROL)
   ========================================================= */
function openEditUserModal(userId){
  const db = window.DB || {};
  const u = (db.users || []).find(x => x.id === userId);
  if(!u) return;

  const isSelf = u.id === state.user.id;
  const isSuper = state.user.role === 'superadmin';
  const canEditRole = isSuper && !isSelf;

  const userPerms = (u.permissions && Array.isArray(u.permissions))
    ? u.permissions
    : ((typeof getDefaultPermissionsForRole === 'function') ? getDefaultPermissionsForRole(u.role) : ['billing','dashboard','customers','lowstock','profile']);
  const permHtml = renderPermEditorHtml(userPerms, isSelf);

  openModal(`✏️ පරිශීලක සංස්කරණය — ${esc(u.name)}`, 'Edit Staff Member & Permissions',
  `<div style="display:flex;flex-direction:column;gap:12px">
     <div>
       <label style="font-size:12px;color:var(--muted);font-weight:600">නම / Name *</label>
       <input id="euName" value="${esc(u.name)}" style="margin-top:4px">
     </div>
     <div class="grid2">
       <div>
         <label style="font-size:12px;color:var(--muted);font-weight:600">Username *</label>
         <input id="euUser" value="${esc(u.username)}" style="margin-top:4px">
       </div>
       <div>
         <label style="font-size:12px;color:var(--muted);font-weight:600">භූමිකාව / Role</label>
         <select id="euRole" ${!canEditRole ? 'disabled title="භූමිකාව වෙනස් කිරීමට අවසර නැත"' : ''} style="margin-top:4px" onchange="if(!${isSelf}){ if(this.value==='admin') applyPermPreset('full'); else if(this.value==='cashier') applyPermPreset('cashier'); }">
           <option value="cashier" ${u.role==='cashier'?'selected':''}>කැෂියර් (Cashier)</option>
           <option value="admin" ${u.role==='admin'?'selected':''}>පරිපාලක (Admin)</option>
           ${isSuper ? `<option value="superadmin" ${u.role==='superadmin'?'selected':''}>සුපිරි පරිපාලක (Super Admin)</option>` : ''}
         </select>
       </div>
     </div>
     <div class="grid2">
       <div>
         <label style="font-size:12px;color:var(--muted);font-weight:600">දුරකථන / Phone</label>
         <input id="euPhone" value="${esc(u.phone || '')}" style="margin-top:4px">
       </div>
       <div>
         <label style="font-size:12px;color:var(--muted);font-weight:600">Email</label>
         <input id="euEmail" value="${esc(u.email || '')}" style="margin-top:4px">
       </div>
     </div>
     ${permHtml}
   </div>`,
  `<button class="btn" onclick="closeModal()">අවලංගු</button>
   <button class="btn btn-primary" onclick="saveEditedUser('${u.id}')">💾 සුරකින්න</button>`,
  true);
  setTimeout(updatePermCountBadge, 50);
}

async function saveEditedUser(userId){
  const name = $('#euName')?.value.trim();
  const username = $('#euUser')?.value.trim().toLowerCase();
  const phone = $('#euPhone')?.value.trim();
  const email = $('#euEmail')?.value.trim();
  const roleSelect = $('#euRole');

  if(!name || !username){ toast('කරුණාකර නම සහ username ඇතුළත් කරන්න', 'err'); return; }

  const db = window.DB || {};
  const duplicate = (db.users || []).find(u => u.id !== userId && !u.deleted && u.username.toLowerCase() === username);
  if(duplicate){
    toast('මෙම username දැනටමත් භාවිතා කර ඇත', 'warn');
    return;
  }

  const isSelf = userId === state.user.id;
  const u = (db.users || []).find(x => x.id === userId);
  if(u){
    u.name = name;
    u.username = username;
    u.phone = phone;
    u.email = email;
    if(roleSelect && !roleSelect.disabled && state.user.role === 'superadmin'){
      u.role = roleSelect.value;
    }

    const updatePayload = {
      name: u.name,
      username: u.username,
      phone: u.phone,
      email: u.email,
      role: u.role
    };

    if(!isSelf){
      const newPerms = getSelectedPermsFromModal();
      u.permissions = newPerms;
      updatePayload.permissions = newPerms;
    }

    if(window.FB && window.FB.fbUpdate){
      await window.FB.fbUpdate(window.FB.COL.users, u.id, updatePayload);
    }
    if(typeof saveDB === 'function') saveDB();
  }

  if(isSelf){
    state.user.name = name;
    state.user.username = username;
  }

  closeModal();
  toast('පරිශීලක විස්තර සහ අවසර සුරැකිණි ✅');
  render();
}

/* =========================================================
   RESET PASSWORD MODAL (STAFF CONTROL)
   ========================================================= */
function openResetPasswordModal(userId){
  const db = window.DB || {};
  const u = (db.users || []).find(x => x.id === userId);
  if(!u) return;

  openModal(`🔑 මුරපදය Reset කරන්න — ${esc(u.name)}`, 'Reset Password',
  `<div style="display:flex;flex-direction:column;gap:12px">
     <p style="color:var(--muted);font-size:12.5px">
       ${esc(u.name)} (<code>${esc(u.username)}</code>) සඳහා නව මුරපදයක් ලබාදෙන්න හෝ පෙරනිමි මුරපදය (1234) තෝරන්න.
     </p>
     <div>
       <label style="font-size:12px;color:var(--muted);font-weight:600">නව මුරපදය / New Password *</label>
       <input id="rpNewPass" value="1234" style="font-size:16px;font-weight:700;margin-top:4px">
     </div>
     <div style="display:flex;gap:6px">
       <button type="button" class="btn btn-sm" onclick="document.getElementById('rpNewPass').value='1234'">Default (1234)</button>
       <button type="button" class="btn btn-sm" onclick="document.getElementById('rpNewPass').value='pass'+Math.floor(1000+Math.random()*9000)">Generate Random</button>
     </div>
   </div>`,
  `<button class="btn" onclick="closeModal()">අවලංගු</button>
   <button class="btn btn-primary" onclick="submitResetPassword('${u.id}')">🔑 Reset කරන්න</button>`,
  false);
}

async function submitResetPassword(userId){
  const newPass = $('#rpNewPass')?.value.trim();
  if(!newPass){ toast('කරුණාකර මුරපදයක් ඇතුළත් කරන්න', 'err'); return; }

  const hashedPassword = window.Security ? await window.Security.hashPassword(newPass) : newPass;

  const db = window.DB || {};
  const u = (db.users || []).find(x => x.id === userId);
  if(u){
    u.password = hashedPassword;
    if(window.FB && window.FB.fbUpdate){
      await window.FB.fbUpdate(window.FB.COL.users, u.id, { password: hashedPassword });
    }
    if(typeof saveDB === 'function') saveDB();
  }

  closeModal();
  toast(`මුරපදය reset කරන ලදී (නව මුරපදය: ${newPass}) ✅`);
}

/* =========================================================
/* =========================================================
   LOCK / UNLOCK USER WITH MESSAGE (STAFF CONTROL)
   ========================================================= */
function openLockUserModal(userId){
  if(userId === state.user.id){
    toast('⚠️ ඔබට ඔබගේම ගිණුම අගුළු දැමිය නොහැක (Cannot lock self)', 'warn');
    return;
  }

  const db = window.DB || {};
  const u = (db.users || []).find(x => x.id === userId);
  if(!u) return;

  // Security: Admin cannot lock another admin or superadmin
  if(state.user.role === 'admin' && (u.role === 'admin' || u.role === 'superadmin')){
    toast('⚠️ Admin හට වෙනත් Admin හෝ Super Admin අගුළු දැමිය නොහැක', 'err');
    return;
  }

  // Security: Cannot lock the last superadmin
  if(u.role === 'superadmin'){
    const activeSupers = (db.users || []).filter(x => x.role === 'superadmin' && !x.locked && x.active && !x.deleted);
    if(activeSupers.length <= 1){
      toast('පද්ධතියේ සිටින එකම Super Admin අගුළු දැමිය නොහැක', 'err');
      return;
    }
  }

  const defaultMsg = 'Shift එක නිවැරදිව කර නැත. Admin එක්ක කතා කරන්න.';

  openModal(
    `🔒 පරිශීලකයා අගුළු දමන්න`,
    `Lock User — ${esc(u.name)} (${ROLE_EN[u.role] || u.role})`,
    `<div class="lock-prompt-wrap">
       <div class="lock-user-preview">
         <div class="lock-user-preview-avatar">${esc(u.name.charAt(0).toUpperCase())}</div>
         <div>
           <div style="font-weight:700;color:var(--txt)">${esc(u.name)} <small style="color:var(--muted)">(@${esc(u.username)})</small></div>
           <div style="font-size:11.5px;color:var(--muted)">භූමිකාව: <span class="badge ${u.role}">${ROLE_EN[u.role] || u.role}</span></div>
         </div>
       </div>

       <div>
         <label class="locked-msg-label">
           <span>🔒 මෙම පරිශීලකයාට පෙන්වන පණිවිඩය (Message shown to user) *</span>
         </label>
         <textarea id="lockUserMsg" class="lock-prompt-textarea" rows="3" placeholder="පණිවිඩය ඇතුළත් කරන්න...">${esc(defaultMsg)}</textarea>
       </div>

       <div>
         <div style="font-size:11.5px;color:var(--muted);margin-bottom:6px">Quick templates:</div>
         <div class="lock-templates-row">
           <button type="button" class="lock-template-btn" onclick="setLockTemplate('Shift එක නිවැරදිව කර නැත. Admin එක්ක කතා කරන්න.')">
             📋 Shift ගැටළුව
           </button>
           <button type="button" class="lock-template-btn" onclick="setLockTemplate('ලාච්චුවේ මුදල් ගණනය කිරීමේ දෝෂයක් ඇත. කරුණාකර Admin හමුවන්න.')">
             💰 වැරදි ගණනය
           </button>
           <button type="button" class="lock-template-btn" onclick="setLockTemplate('ඔබගේ ගිණුම තාවකාලිකව අත්හිටුවා ඇත. කරුණාකර කළමනාකාරීත්වය අමතන්න.')">
             🛡️ Admin කතා
           </button>
         </div>
       </div>

       <div class="lock-warning-alert">
         <span>⚠️ මෙය පරිශීලකයාට පද්ධතියට ලොගින් වීමට බාධා කරයි.</span>
       </div>
     </div>`,
    `<button class="btn" onclick="closeModal()">අවලංගු</button>
     <button class="btn btn-danger-lock" onclick="submitLockUser('${u.id}')">🔒 අගුළු දමන්න (Lock User)</button>`
  );
}

function setLockTemplate(txt){
  const el = $('#lockUserMsg');
  if(el){
    el.value = txt;
    el.focus();
  }
}

async function submitLockUser(userId){
  const msg = $('#lockUserMsg')?.value.trim() || 'Shift එක නිවැරදිව කර නැත. Admin එක්ක කතා කරන්න.';
  const db = window.DB || {};
  const u = (db.users || []).find(x => x.id === userId);
  if(!u) return;

  const lockerName = state.user ? `${state.user.name} (${ROLE_EN[state.user.role] || state.user.role})` : 'පරිපාලක (Admin)';
  const nowIso = new Date().toISOString();

  u.locked = true;
  u.active = false;
  u.lockMessage = msg;
  u.lockedBy = lockerName;
  u.lockedAt = nowIso;

  if(window.FB && window.FB.fbUpdate){
    await window.FB.fbUpdate(window.FB.COL.users, u.id, {
      locked: true,
      active: false,
      lockMessage: msg,
      lockedBy: lockerName,
      lockedAt: nowIso
    });
  }
  if(typeof saveDB === 'function') saveDB();

  closeModal();
  toast(`${u.name} ගිණුම සාර්ථකව අගුළු දමන ලදී (Locked) 🔒`, 'warn');
  render();
}

async function unlockUser(userId){
  const db = window.DB || {};
  const u = (db.users || []).find(x => x.id === userId);
  if(!u) return;

  u.locked = false;
  u.active = true;
  u.lockMessage = '';
  u.lockedBy = null;
  u.lockedAt = null;

  if(window.FB && window.FB.fbUpdate){
    await window.FB.fbUpdate(window.FB.COL.users, u.id, {
      locked: false,
      active: true,
      lockMessage: '',
      lockedBy: null,
      lockedAt: null
    });
  }
  if(typeof saveDB === 'function') saveDB();

  toast(`${u.name} ගිණුම සාර්ථකව අගුළු හරින ලදී (Unlocked) 🔓`);
  render();
}

async function toggleUserLock(userId){
  const db = window.DB || {};
  const u = (db.users || []).find(x => x.id === userId);
  if(!u) return;

  if(u.locked || !u.active){
    await unlockUser(userId);
  } else {
    openLockUserModal(userId);
  }
}

/* =========================================================
   DELETE USER (SUPERADMIN ONLY)
   ========================================================= */
function deleteUser(userId){
  if(state.user.role !== 'superadmin'){
    toast('පරිශීලකයන් මැකීමට අවසර ඇත්තේ Super Admin ට පමණි', 'err');
    return;
  }
  if(userId === state.user.id){
    toast('ඔබට ඔබගේම ගිණුම මැකිය නොහැක', 'err');
    return;
  }

  const db = window.DB || {};
  const u = (db.users || []).find(x => x.id === userId);
  if(!u) return;

  if(u.role === 'superadmin'){
    const superCount = (db.users || []).filter(x => x.role === 'superadmin' && !x.deleted).length;
    if(superCount <= 1){
      toast('අවසාන Super Admin මැකිය නොහැක', 'err');
      return;
    }
  }

  openModal('⚠️ පරිශීලකයා මකා දැමීම තහවුරු කරන්න', 'Confirm User Deletion',
  `<div style="text-align:center;padding:12px 0">
     <div style="font-size:42px;margin-bottom:10px">🗑️</div>
     <b style="font-size:15px;display:block;margin-bottom:6px">${esc(u.name)} (${esc(u.username)})</b>
     <p style="color:var(--muted);font-size:12.5px;line-height:1.6">
       මෙම පරිශීලකයාගේ පෙර දත්ත සහ විකුණුම් වාර්තා ඉතිහාසය පද්ධතියේ සුරැකෙනු ඇත.<br>
       නමුත් ඔහුට නැවත පද්ධතියට පිවිසීමට නොහැකි වනු ඇත.<br>
       ස්ථිරවම මකන්නද?
     </p>
   </div>`,
  `<button class="btn" onclick="closeModal()">අවලංගු</button>
   <button class="btn btn-red" onclick="confirmDeleteUser('${u.id}')">🗑️ ඔව්, මකන්න</button>`,
  false);
}

async function confirmDeleteUser(userId){
  const db = window.DB || {};
  const u = (db.users || []).find(x => x.id === userId);
  if(u){
    u.deleted = true;
    u.active = false;
    if(window.FB && window.FB.fbUpdate){
      await window.FB.fbUpdate(window.FB.COL.users, u.id, { deleted: true, active: false });
    }
    if(typeof saveDB === 'function') saveDB();
  }

  closeModal();
  toast('පරිශීලකයා සාර්ථකව ඉවත් කළා ✅');
  render();
}

/* =========================================================
   GLOBAL EXPORTS
   ========================================================= */
window.pgProfile = pgProfile;
window.userDaysWorked = userDaysWorked;
window.userHoursWorked = userHoursWorked;
window.userSalesStats = userSalesStats;
window.userPerformanceScore = userPerformanceScore;
window.openChangePasswordModal = openChangePasswordModal;
window.togglePwdVis = togglePwdVis;
window.checkPwdStrength = checkPwdStrength;
window.submitChangePassword = submitChangePassword;
window.openEditProfileModal = openEditProfileModal;
window.saveEditProfile = saveEditProfile;
window.openAddCashierModal = openAddCashierModal;
window.saveNewCashier = saveNewCashier;
window.openAddUserModal = openAddUserModal;
window.saveNewUser = saveNewUser;
window.openEditUserModal = openEditUserModal;
window.saveEditedUser = saveEditedUser;
window.openResetPasswordModal = openResetPasswordModal;
window.submitResetPassword = submitResetPassword;
window.openLockUserModal = openLockUserModal;
window.setLockTemplate = setLockTemplate;
window.submitLockUser = submitLockUser;
window.unlockUser = unlockUser;
window.toggleUserLock = toggleUserLock;
window.deleteUser = deleteUser;
window.confirmDeleteUser = confirmDeleteUser;
window.renderPermEditorHtml = renderPermEditorHtml;
window.applyPermPreset = applyPermPreset;
window.toggleAllPerms = toggleAllPerms;
window.updatePermCountBadge = updatePermCountBadge;
window.getSelectedPermsFromModal = getSelectedPermsFromModal;
window.onRoleChangeAddUser = onRoleChangeAddUser;
