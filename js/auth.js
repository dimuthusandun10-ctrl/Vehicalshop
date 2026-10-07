/* =========================================================
   js/auth.js - Authentication & Role Access Control
   ========================================================= */

function quick(u){
  const uInp = $('#lUser');
  const pInp = $('#lPass');
  if(uInp) uInp.value = u;
  if(pInp) pInp.value = '1234';
  doLogin();
}

function showLockedAccountModal(user){
  const lockMsg = user.lockMessage || 'Shift එක නිවැරදිව කර නැත. Admin එක්ක කතා කරන්න.';
  const lockedBy = user.lockedBy || 'පරිපාලක (Admin)';
  const dateStr = user.lockedAt 
    ? new Date(user.lockedAt).toLocaleString('en-GB', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) 
    : new Date().toLocaleString('en-GB', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });

  const bodyHtml = `
    <div class="locked-modal-wrap">
      <div class="locked-icon-badge">🚫</div>
      <div class="locked-title">ගිණුම අගුළු දමා ඇත</div>
      <div class="locked-subtitle">Account Locked</div>

      <hr class="locked-divider">

      <div class="locked-msg-label">📩 පණිවිඩය:</div>
      <div class="locked-msg-box">${esc(lockMsg)}</div>

      <hr class="locked-divider">

      <div class="locked-meta-row">
        <div class="locked-meta-item">
          <span>🔒 Lock කළේ:</span>
          <b>${esc(lockedBy)}</b>
        </div>
        <div class="locked-meta-item">
          <span>📅 දිනය:</span>
          <b>${esc(dateStr)}</b>
        </div>
      </div>
    </div>
  `;

  const footerHtml = `
    <button class="btn btn-primary" style="width:100%;padding:10px;font-weight:600" onclick="closeModal()">හරි (OK)</button>
  `;

  openModal('🚫 ගිණුම අගුළු දමා ඇත', 'Account Locked', bodyHtml, footerHtml);
}

function doLogin(){
  const uInp = $('#lUser');
  const pInp = $('#lPass');
  const errEl = $('#lErr');

  const u = uInp ? uInp.value.trim() : '';
  const p = pInp ? pInp.value : '';

  const matched = (DB.users || []).find(x => x.username.toLowerCase() === u.toLowerCase() && x.password === p && !x.deleted);
  if(!matched){
    if(errEl) errEl.textContent = '❌ වැරදි පරිශීලක නාමය හෝ මුරපදය';
    return;
  }
  if(matched.locked === true){
    showLockedAccountModal(matched);
    if(errEl) errEl.textContent = '🔒 ගිණුම අගුළු දමා ඇත (Account Locked)';
    return;
  }
  if(matched.active === false){
    openModal(
      '⚠️ ගිණුම අක්‍රීයයි',
      'Account Inactive',
      `<div style="text-align:center;padding:15px">
        <div style="font-size:44px;margin-bottom:10px">⚠️</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:6px">මෙම ගිණුම අක්‍රීය කර ඇත</div>
        <div style="color:var(--muted);font-size:13px">කරුණාකර ප්‍රධාන පරිපාලක (Super Admin) අමතන්න.</div>
      </div>`,
      `<button class="btn btn-primary" style="width:100%" onclick="closeModal()">හරි (OK)</button>`
    );
    if(errEl) errEl.textContent = '⚠️ මෙම ගිණුම අක්‍රීය කර ඇත';
    return;
  }
  const user = matched;
  if(!user.permissions || !Array.isArray(user.permissions)){
    user.permissions = (typeof getDefaultPermissionsForRole === 'function')
      ? getDefaultPermissionsForRole(user.role)
      : ['billing','dashboard','customers','lowstock','profile'];
  }

  state.user = user;

  // Set active shop
  const db = window.DB || {};
  if(user.role === 'superadmin'){
    const savedShopId = localStorage.getItem('pos.activeShopId');
    if(savedShopId && (db.shops || []).find(s => s.id === savedShopId)){
      state.activeShopId = savedShopId;
    } else if((db.shops || []).length > 0){
      state.activeShopId = db.shops[0].id;
    }
    state.activeShop = (db.shops || []).find(s => s.id === state.activeShopId);
  } else {
    state.activeShop = (db.shops || []).find(s => s.id === user.shopId);
    state.activeShopId = state.activeShop?.id;
  }

  db.shop = state.activeShop;
  if(typeof updateBrandName === 'function') updateBrandName();
  if(typeof updateTopBarShopSwitcher === 'function') updateTopBarShopSwitcher();

  const loginScreen = $('#loginScreen');
  if(loginScreen) loginScreen.classList.add('hidden');
  const loginSlot = $('#loginSlot');
  if(loginSlot) loginSlot.classList.add('hidden');

  const appSlot = $('#appSlot') || $('#app');
  if(appSlot) appSlot.classList.remove('hidden');

  const uAvatar = $('#uAvatar');
  if(uAvatar) uAvatar.textContent = user.name.charAt(0);

  const uName = $('#uName');
  if(uName) uName.textContent = user.name;

  const uRole = $('#uRole');
  if(uRole) uRole.textContent = ROLE_SI[user.role] + ' / ' + ROLE_EN[user.role];

  const roleBadge = $('#roleBadge');
  if(roleBadge){
    roleBadge.className = 'badge ' + user.role;
    roleBadge.textContent = ROLE_EN[user.role];
  }

  state.page = 'billing';
  state.cart = [];

  renderNav();
  render();
  updateClock();
  updateShiftIndicator();

  /* ⭐ Shift check: cashier = required, admin/superadmin = optional */
  const activeShift = (typeof Shift !== 'undefined') ? Shift.getActive(user.id) : null;
  if(!activeShift && user.role === 'cashier'){
    /* must open shift */
    setTimeout(() => {
      if(typeof openShiftModal === 'function') openShiftModal();
    }, 400);
    toast('සාදරයෙන් පිළිගනිමු, ' + user.name + '! ෂිෆ්ට් එක ආරම්භ කරන්න.', 'warn');
  } else if(activeShift){
    toast('🔓 ෂිෆ්ට් එක නැවත ලබාගත්තා (' + Shift.duration(activeShift).text + ')');
  } else {
    toast('සාදරයෙන් පිළිගනිමු, ' + user.name + '!');
  }

  /* Admin awareness: notify if returns are pending approval */
  if(user.role !== 'cashier'){
    const pendingCount = (DB.returns || []).filter(r => r.status === 'pending').length;
    if(pendingCount > 0){
      setTimeout(() => toast('⚠️ අනුමැතිය අපේක්ෂිත ආපසු ඉල්ලීම් ' + pendingCount + 'ක් ඇත', 'warn'), 1500);
    }
  }
}

function doLogout(){
  const active = (state.user && typeof Shift !== 'undefined') ? Shift.getActive(state.user.id) : null;

  if(active){
    /* must close shift first */
    closeShiftModal(() => performLogout());
  } else {
    performLogout();
  }
}

function performLogout(){
  state.user = null;
  state.cart = [];
  state.activeShop = null;
  state.activeShopId = null;
  if(window.DB) window.DB.shop = null;
  if(typeof updateBrandName === 'function') updateBrandName();
  if(typeof updateTopBarShopSwitcher === 'function') updateTopBarShopSwitcher();

  const appSlot = $('#appSlot') || $('#app');
  if(appSlot) appSlot.classList.add('hidden');

  const loginScreen = $('#loginScreen');
  if(loginScreen) loginScreen.classList.remove('hidden');
  const loginSlot = $('#loginSlot');
  if(loginSlot) loginSlot.classList.remove('hidden');

  const pInp = $('#lPass');
  if(pInp) pInp.value = '';
  const errEl = $('#lErr');
  if(errEl) errEl.textContent = '';

  updateShiftIndicator();
}

function can(page){
  if(!state.user) return false;
  const n = NAV.find(x => x.id === page);
  return n && n.roles.includes(state.user.role);
}

window.quick = quick;
window.doLogin = doLogin;
window.doLogout = doLogout;
window.can = can;
window.showLockedAccountModal = showLockedAccountModal;
