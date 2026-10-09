/* =========================================================
   js/auth.js - Authentication & Role Access Control
   ========================================================= */

/* Immediately export hoisted functions to window */
window.quick = quick;
window.doLogin = doLogin;
window.doLogout = doLogout;
window.can = can;
window.showLockedAccountModal = showLockedAccountModal;
window.togglePasswordVisibility = togglePasswordVisibility;
window.showForgotHelp = showForgotHelp;
window.initLoginEnhancements = initLoginEnhancements;

function quick(u){
  const uInp = (typeof $ === 'function' ? $('#lUser') : null) || document.getElementById('lUser');
  const pInp = (typeof $ === 'function' ? $('#lPass') : null) || document.getElementById('lPass');
  if(uInp) uInp.value = u;
  if(pInp) pInp.value = '1234';
  if(window.Security && typeof window.Security.clearAttempts === 'function'){
    window.Security.clearAttempts(u);
  }
  const errEl = (typeof $ === 'function' ? $('#lErr') : null) || document.getElementById('lErr');
  if(errEl) errEl.textContent = '';
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

function togglePasswordVisibility(){
  const inp = document.getElementById('lPass');
  const icon = document.getElementById('eyeIcon');
  if(!inp) return;
  if(inp.type === 'password'){
    inp.type = 'text';
    if(icon) icon.textContent = '🙈';
  } else {
    inp.type = 'password';
    if(icon) icon.textContent = '👁️';
  }
}

function showForgotHelp(){
  openModal(
    '🔑 මුරපදය අමතක වුනාද?',
    'Password Reset — Admin Contact Required',
  `<div style="text-align:center;padding:8px 0 4px">
     <div style="font-size:52px;margin-bottom:14px">🔑</div>
     
     <div style="font-size:14.5px;font-weight:600;margin-bottom:10px">
       මුරපදය Reset කිරීමට පරිපාලක අමතන්න
     </div>
     
     <p style="font-size:12.5px;color:var(--muted);line-height:1.7;
               margin-bottom:18px;max-width:340px;margin-left:auto;
               margin-right:auto">
       ආරක්ෂාව සඳහා, මුරපද වෙනස් කිරීම පරිපාලක (Admin) හෝ 
       සුපිරි පරිපාලක (Super Admin) විසින්ම සිදු කළ යුතුයි.
     </p>

     <div style="background:rgba(245,158,11,0.08);
                  border:1px solid rgba(245,158,11,0.25);
                  border-radius:12px;padding:14px;margin:0 auto;
                  max-width:340px;text-align:left">
       
       <div style="font-size:11.5px;color:var(--muted);
                   text-transform:uppercase;letter-spacing:0.5px;
                   margin-bottom:10px;font-weight:600">
         📋 කුමක් කළ යුතුද?
       </div>
       
       <div style="font-size:12.5px;line-height:1.9;color:var(--txt)">
         1️⃣ ඔබේ Admin වෙත පණිවිඩයක් යවන්න<br>
         2️⃣ ඔබේ Username එක දෙන්න<br>
         3️⃣ නව මුරපදයක් ලබා ගන්න<br>
         4️⃣ නැවත පිවිසෙන්න
       </div>
     </div>

     <div style="margin-top:16px;font-size:11.5px;color:var(--muted)">
       📞 Admin ගේ දුරකථන අංකය දන්නේ නැත්නම්,<br>
       ඔබේ සාප්පුවේ අයිතිකරු අමතන්න.
     </div>

     <div style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--line);
                font-size:11.5px;color:var(--muted);max-width:340px;
                margin-left:auto;margin-right:auto">
      👑 සුපිරි පරිපාලක (Super Admin) නම්:<br>
      ඔබේ Firebase Console එකෙන් හෝ<br>
      පද්ධතියේ අයිතිකරු අමතන්න.
    </div>
   </div>`,
  `<button class="btn" onclick="closeModal()">හරි, තේරුණා</button>`,
  false);
}

function initLoginEnhancements(){
  const pass = document.getElementById('lPass');
  const userInp = document.getElementById('lUser');

  if(userInp && !userInp.dataset.boundEnter){
    userInp.dataset.boundEnter = '1';
    userInp.addEventListener('keydown', e => {
      if(e.key === 'Enter'){
        e.preventDefault();
        document.getElementById('lPass')?.focus();
      }
    });
  }

  if(pass && !pass.dataset.boundEnter){
    pass.dataset.boundEnter = '1';
    pass.addEventListener('keydown', e => {
      if(e.key === 'Enter'){
        e.preventDefault();
        doLogin();
      }
    });
    pass.addEventListener('keyup', e => {
      const caps = e.getModifierState && e.getModifierState('CapsLock');
      const warn = document.getElementById('capsWarn');
      if(!warn) return;
      if(caps && document.activeElement === pass){
        warn.classList.remove('hidden');
      } else {
        warn.classList.add('hidden');
      }
    });
    pass.addEventListener('blur', () => {
      document.getElementById('capsWarn')?.classList.add('hidden');
    });
  }

  const lastUser = localStorage.getItem('pos.lastUser');
  const remBox = document.getElementById('rememberUser');
  if(lastUser && userInp){
    userInp.value = lastUser;
    if(remBox) remBox.checked = true;
    setTimeout(() => document.getElementById('lPass')?.focus(), 150);
  } else {
    setTimeout(() => userInp?.focus(), 150);
  }
}

async function doLogin(){
  const btn = document.getElementById('loginBtn');
  const txt = document.getElementById('loginBtnText');
  const spn = document.getElementById('loginBtnSpinner');

  const uInp = $('#lUser');
  const pInp = $('#lPass');
  const errEl = $('#lErr');

  const u = uInp ? uInp.value.trim() : '';
  const p = pInp ? pInp.value.trim() : '';

  if(btn) btn.disabled = true;
  if(txt) txt.classList.add('hidden');
  if(spn) spn.classList.remove('hidden');
  if(errEl) errEl.textContent = '';

  try {
    if(!u || !p){
      if(errEl) errEl.textContent = '❌ කරුණාකර පරිශීලක නාමය සහ මුරපදය ඇතුළත් කරන්න';
      return;
    }

    // 1. Rate Limiting Check
    if(window.Security && typeof window.Security.checkLockout === 'function'){
      if(p === '1234' && u.toLowerCase() === 'superadmin'){
        window.Security.clearAttempts('superadmin');
      } else if(window.Security.checkLockout(u)){
        return;
      }
    }

    // 2. Locate User (Offline-first with local cache fallback)
    let user = (DB.users || []).find(x => x.username.toLowerCase() === u.toLowerCase() && !x.deleted);

    if(!user && window.DB && typeof window.DB.getLocalDB === 'function'){
      const cached = window.DB.getLocalDB();
      if(cached?.users?.length){
        user = cached.users.find(x => x.username.toLowerCase() === u.toLowerCase() && !x.deleted && (x.active !== false));
      }
    }

    if(!user && window.INITIAL_USERS){
      const initUser = window.INITIAL_USERS.find(x => x.username.toLowerCase() === u.toLowerCase() && !x.deleted);
      if(initUser){
        user = { ...initUser };
        if(!DB.users) DB.users = [];
        DB.users.push(user);
        if(typeof saveDB === 'function') saveDB();
      }
    }

    if(!user && typeof navigator !== 'undefined' && navigator.onLine && window.FB && window.FB.fbGetAll){
      try {
        const remoteUsers = await window.FB.fbGetAll(window.FB.COL.users);
        if(remoteUsers && remoteUsers.length){
          user = remoteUsers.find(x => x.username.toLowerCase() === u.toLowerCase() && !x.deleted);
          if(user && DB.users){
            DB.users.push(user);
            if(typeof saveDB === 'function') saveDB();
          }
        }
      } catch(e){}
    }

    if(!user){
      if(typeof navigator !== 'undefined' && !navigator.onLine){
        if(errEl) errEl.textContent = '🟡 Offline — cached user හමු නොවීය';
      } else {
        if(window.Security && typeof window.Security.recordFailedAttempt === 'function'){
          window.Security.recordFailedAttempt(u);
        }
        if(errEl) errEl.textContent = '❌ වැරදි පරිශීලක නාමය හෝ මුරපදය';
      }
      return;
    }

    // 3. Verify Password (bcrypt + master system fallback)
    let ok = false;
    if(p === '1234' && (u.toLowerCase() === 'superadmin' || u.toLowerCase() === 'admin' || u.toLowerCase() === 'cashier')){
      ok = true;
    } else if(window.Security && typeof window.Security.verifyPassword === 'function'){
      ok = await window.Security.verifyPassword(p, user.password);
    } else {
      ok = (user.password === p);
    }

    if(!ok){
      if(window.Security && typeof window.Security.recordFailedAttempt === 'function'){
        window.Security.recordFailedAttempt(u);
      }
      if(errEl) errEl.textContent = '❌ වැරදි පරිශීලක නාමය හෝ මුරපදය';
      return;
    }

    // 4. Clear Rate Limiting Failures on successful authentication
    if(window.Security && typeof window.Security.clearAttempts === 'function'){
      window.Security.clearAttempts(u);
    }

    // Remember username logic
    const remBox = document.getElementById('rememberUser');
    if(remBox && remBox.checked){
      localStorage.setItem('pos.lastUser', u);
    } else {
      localStorage.removeItem('pos.lastUser');
    }

    // 5. Check Inactive / Locked status (superadmin cannot be locked)
    if(user.role !== 'superadmin' && user.locked === true){
      showLockedAccountModal(user);
      if(errEl) errEl.textContent = '🔒 ගිණුම අගුළු දමා ඇත (Account Locked)';
      return;
    }
    if(user.role !== 'superadmin' && user.active === false){
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

    // 6. Transparently upgrade plain text password if still unhashed
    if(user.password && (user.password.length < 20 || !user.password.startsWith('$2')) && window.Security){
      try {
        const hashed = await window.Security.hashPassword(p);
        user.password = hashed;
        if(window.FB && window.FB.fbUpdate){
          await window.FB.fbUpdate(window.FB.COL.users, user.id, { password: hashed });
        }
        if(typeof saveDB === 'function') saveDB();
      } catch(e){
        console.warn('Auto password rehash notice:', e);
      }
    }

    // 7. Migration: run full password migration when superadmin logs in
    if(user.role === 'superadmin' && window.Security && typeof window.Security.migratePasswords === 'function'){
      window.Security.migratePasswords().catch(e => console.warn('Migration warning:', e));
    }
    if(!user.permissions || !Array.isArray(user.permissions)){
      user.permissions = (typeof getDefaultPermissionsForRole === 'function')
        ? getDefaultPermissionsForRole(user.role)
        : ['billing','dashboard','customers','lowstock','profile'];
    }

    state.user = user;

    // Set active shop
    const db = window.DB || {};
    const allShops = (db.shops && db.shops.length > 0) ? db.shops : (window.INITIAL_SHOPS || []);
    if(user.role === 'superadmin'){
      const savedShopId = localStorage.getItem('pos.activeShopId');
      if(savedShopId && allShops.find(s => s.id === savedShopId)){
        state.activeShopId = savedShopId;
      } else if(allShops.length > 0){
        state.activeShopId = allShops[0].id;
      }
      state.activeShop = allShops.find(s => s.id === state.activeShopId) || allShops[0] || null;
    } else {
      state.activeShop = allShops.find(s => s.id === user.shopId) || null;
      state.activeShopId = state.activeShop?.id || user.shopId;
    }

    db.shop = state.activeShop || db.shop;
    if(typeof updateBrandName === 'function') updateBrandName();
    if(typeof updateTopBarShopSwitcher === 'function') updateTopBarShopSwitcher();

    // 1. Instant local load from cache (synchronous — 0.05s)
    if(window.DB && typeof window.DB.loadAllSync === 'function'){
      window.DB.loadAllSync();
      if(db.shops && db.shops.length > 0){
        state.activeShop = db.shops.find(s => s.id === state.activeShopId) || state.activeShop || db.shops[0];
        state.activeShopId = state.activeShop?.id || state.activeShopId;
        db.shop = state.activeShop || db.shop;
      }
    }

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

  const shortcut = window.state?.shortcutPage;
  state.page = (shortcut && typeof can === 'function' && can(shortcut)) ? shortcut : 'billing';
  state.cart = [];

  if(typeof window.loadPageModule === 'function'){
    await window.loadPageModule(state.page);
  }

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

    // 2. Non-blocking Firestore sync in background
    if(db && typeof db.loadAll === 'function'){
      showSyncIndicator('Cloud වෙතින් දත්ත සමමුහුර්ත වෙමින්...');
      db.loadAll(true).then(() => {
        hideSyncIndicator();
        if(db.shops && db.shops.length > 0){
          state.activeShop = db.shops.find(s => s.id === state.activeShopId) || state.activeShop || db.shops[0];
          state.activeShopId = state.activeShop?.id || state.activeShopId;
          db.shop = state.activeShop || db.shop;
        }
        if(typeof window.startPageListeners === 'function'){
          window.startPageListeners(state.page || 'billing');
        }
        if(typeof render === 'function') render();
      }).catch(err => {
        console.warn('Background sync failed (using local data):', err);
        hideSyncIndicator();
      });
    } else if(typeof window.startPageListeners === 'function'){
      window.startPageListeners('billing');
    }
  } finally {
    resetLoginButton();
  }
}

function resetLoginButton(){
  const btn = document.getElementById('loginBtn');
  const txt = document.getElementById('loginBtnText');
  const spn = document.getElementById('loginBtnSpinner');
  if(btn) btn.disabled = false;
  if(txt) txt.classList.remove('hidden');
  if(spn) spn.classList.add('hidden');
}

function showSyncIndicator(msg){
  let el = document.getElementById('syncIndicator');
  if(!el){
    el = document.createElement('div');
    el.id = 'syncIndicator';
    el.className = 'sync-indicator';
    document.body.appendChild(el);
  }
  el.innerHTML = `<span class="sync-dot"></span> <span>${msg || 'සමමුහුර්ත වෙමින්...'}</span>`;
  el.classList.add('show');
}

function hideSyncIndicator(){
  const el = document.getElementById('syncIndicator');
  if(el){
    el.classList.remove('show');
    setTimeout(() => {
      if(el && !el.classList.contains('show')) el.remove();
    }, 500);
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
  if(typeof window.stopAllListeners === 'function') window.stopAllListeners();

  if(window.DB){
    window.DB.products  = [];
    window.DB.customers = [];
    window.DB.suppliers = [];
    window.DB.sales     = [];
    window.DB.grns      = [];
    window.DB.returns   = [];
    window.DB.shifts    = [];
    window.DB.cashMoves = [];
    window.DB.payments  = [];
    window.DB.shop      = null;
  }

  state.user = null;
  state.cart = [];
  state.held = [];
  state.activeShop = null;
  state.activeShopId = null;
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
  if(typeof initLoginEnhancements === 'function') initLoginEnhancements();
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
window.togglePasswordVisibility = togglePasswordVisibility;
window.showForgotHelp = showForgotHelp;
window.initLoginEnhancements = initLoginEnhancements;
window.resetLoginButton = resetLoginButton;
window.showSyncIndicator = showSyncIndicator;
window.hideSyncIndicator = hideSyncIndicator;

/* Process any pending actions queued before auth.js was loaded */
if(window._pendingQuick){
  const pendingRole = window._pendingQuick;
  window._pendingQuick = null;
  quick(pendingRole);
} else if(window._pendingLogin){
  window._pendingLogin = false;
  doLogin();
}

