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
window.showChangePasswordModal = showChangePasswordModal;
window.saveNewPassword = saveNewPassword;
window.openContactModal = window.openContactModal || function(){ if(typeof window.showContactUsModal === 'function') window.showContactUsModal(); };

/* =========================================================
   One-time Cache Invalidation for Auth Migration (FIX 2)
   ========================================================= */
(function clearOldUserCache(){
  if(localStorage.getItem('pos.authMigrationDone') !== 'v2'){
    Object.keys(localStorage).forEach(k => {
      if(k.startsWith('pos.localDB.') || k === 'autoparts_pos_db'){
        localStorage.removeItem(k);
      }
    });
    localStorage.setItem('pos.authMigrationDone', 'v2');
    console.log('🧹 Purged legacy user/localDB cache for Firebase Auth migration (v2).');
  }
})();

function quick(u){
  const uInp = (typeof $ === 'function' ? $('#lUser') : null) || document.getElementById('lUser');
  const pInp = (typeof $ === 'function' ? $('#lPass') : null) || document.getElementById('lPass');
  if(uInp) uInp.value = u;
  if(pInp) { pInp.value = ''; pInp.focus(); }
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
  `<div style="display:flex;gap:8px;justify-content:flex-end;width:100%"><button class="btn btn-secondary" onclick="openContactModal()">📞 Contact Us</button><button class="btn btn-primary" onclick="closeModal()">හරි, තේරුණා</button></div>`,
  false);
}

function initLoginEnhancements(){
  const pass = document.getElementById('lPass');
  const userInp = document.getElementById('lUser');
  const errEl = document.getElementById('lErr');

  // Immediately clear error when typing
  if(userInp && !userInp.dataset.boundInput){
    userInp.dataset.boundInput = '1';
    userInp.addEventListener('input', () => {
      if(errEl) errEl.textContent = '';
    });
  }
  if(pass && !pass.dataset.boundInput){
    pass.dataset.boundInput = '1';
    pass.addEventListener('input', () => {
      if(errEl) errEl.textContent = '';
    });
  }

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

  const uInp = document.getElementById('lUser');
  const pInp = document.getElementById('lPass');
  const errEl = document.getElementById('lErr');

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

    // 1. Rate Limiting Check (no backdoor)
    if(window.Security && typeof window.Security.checkLockout === 'function'){
      if(window.Security.checkLockout(u)){
        return;
      }
    }

    // 2. Resolve user email for Firebase Auth
    function isSuperAdminIdentifier(identifier){
      if(!identifier) return false;
      const s = String(identifier).trim().toLowerCase();
      return (
        s === 'info.dimuthudishan2002@gmail.com' ||
        s === 'dimuthusandun10@gmail.com' ||
        s === 'superadmin' ||
        s === 'superadmin@autoparts.local' ||
        s === 'superadmin@autoparts.lk' ||
        s === 'dimuthu'
      );
    }

    const normalized = u.toLowerCase();
    let email = normalized;
    if(normalized === 'dimuthusandun10@gmail.com'){
      email = 'dimuthusandun10@gmail.com';
    } else if(isSuperAdminIdentifier(normalized)){
      email = 'info.dimuthudishan2002@gmail.com';
    } else if(!normalized.includes('@')){
      email = `${normalized}@autoparts.local`;
    }

    const db = window.DB || {};
    let localUser = (db.users || []).find(x => 
      !x.deleted && (
        (x.username && x.username.toLowerCase() === normalized) ||
        (x.email && x.email.toLowerCase() === email) ||
        (isSuperAdminIdentifier(normalized) && (x.role === 'superadmin' || x.username === 'superadmin'))
      )
    );
    if(localUser && localUser.email && !isSuperAdminIdentifier(normalized) && !u.includes('@')){
      email = localUser.email;
    }

    // 3. Status checks
    if(localUser && localUser.role !== 'superadmin' && localUser.locked === true){
      showLockedAccountModal(localUser);
      if(errEl) errEl.textContent = '🔒 ගිණුම අගුළු දමා ඇත (Account Locked)';
      return;
    }
    if(localUser && localUser.role !== 'superadmin' && localUser.active === false){
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

    // 4. ⭐ Firebase Authentication (Strict, Zero Backdoors)
    await window.FB.initFirebase();
    const authMod = window.FB.getAuthModule();
    const auth = window.FB.getAuth();

    if(!auth || !authMod){
      throw new Error('Firebase Authentication සේවාව සම්බන්ධ කළ නොහැක.');
    }

    const credential = await authMod.signInWithEmailAndPassword(auth, email, p);
    const authUid = credential.user.uid;

    if(window.FB && typeof window.FB.resetPermissionDenied === 'function'){
      window.FB.resetPermissionDenied();
    }

    // 5. Token & Session Storage
    const token = await credential.user.getIdToken();
    sessionStorage.setItem('pos.authToken', token);

    // Clear Rate Limiting Failures on successful authentication
    if(window.Security && typeof window.Security.clearAttempts === 'function'){
      window.Security.clearAttempts(u);
    }

    const isSuper = isSuperAdminIdentifier(normalized) || isSuperAdminIdentifier(email) || (localUser && localUser.role === 'superadmin');

    // 6. Locate User Document (by Firebase Auth UID)
    let user = (db.users || []).find(x => x.id === authUid || x.authUid === authUid);
    if(!user && window.FB && typeof window.FB.fbGetDirect === 'function'){
      try {
        user = await window.FB.fbGetDirect('users', authUid);
      } catch(e){}
    }
    if(!user && window.FB && typeof window.FB.fbGet === 'function'){
      try {
        user = await window.FB.fbGet('users', authUid);
      } catch(e){}
    }
    if(!user && localUser && (localUser.authUid === authUid || localUser.id === authUid)){
      user = { ...localUser, id: authUid, authUid: authUid, email: email };
    }

    // 7. Security Check: If user doc does not exist, reject unauthorized logins
    if(!user){
      if(isSuper){
        // Initial Super Admin bootstrap profile
        user = {
          id: authUid,
          authUid: authUid,
          username: 'superadmin',
          email: email,
          role: 'superadmin',
          name: 'ඩිමුතු දිශාන් (Super Admin)',
          shopId: null,
          active: true,
          locked: false,
          permissions: [
            'billing', 'dashboard', 'pos', 'inventory', 'customers', 'lowstock',
            'grn', 'returns', 'serial-search', 'shifts', 'reports', 'shops',
            'profile', 'settings', 'staff', 'credit', 'discounts',
            'price-override', 'void-sale', 'delete-product'
          ]
        };
        if(window.FB && typeof window.FB.fbSetDirect === 'function'){
          try {
            await window.FB.fbSetDirect('users', authUid, user);
            console.log('✅ Created Super Admin profile in Firestore users/' + authUid);
          } catch(e){}
        }
      } else {
        if(window.FB && typeof window.FB.signOut === 'function'){
          await window.FB.signOut();
        }
        throw new Error('පද්ධතියේ සක්‍රීය කාර්ය මණ්ඩල පැතිකඩක් හමු නොවීය. කරුණාකර ප්‍රධාන පරිපාලක අමතන්න. (No active staff profile found for this account)');
      }
    }

    // ⭐ Strict Super Admin Enforcement:
    if(isSuper || user.role === 'superadmin' || email === 'info.dimuthudishan2002@gmail.com'){
      user.role = 'superadmin';
      user.shopId = null;
      user.permissions = [
        'billing', 'dashboard', 'pos', 'inventory', 'customers', 'lowstock',
        'grn', 'returns', 'serial-search', 'shifts', 'reports', 'shops',
        'profile', 'settings', 'staff', 'credit', 'discounts',
        'price-override', 'void-sale', 'delete-product'
      ];
    } else if(!user.permissions || !Array.isArray(user.permissions)){
      user.permissions = (typeof getDefaultPermissionsForRole === 'function')
        ? getDefaultPermissionsForRole(user.role)
        : ['billing','dashboard','customers','lowstock','profile'];
    }

    // Ensure user document in Firestore always has matching authUid, role and permissions
    if(window.FB && typeof window.FB.fbSetDirect === 'function'){
      try {
        await window.FB.fbSetDirect('users', authUid, {
          id: authUid,
          authUid: authUid,
          username: user.username || u,
          email: user.email || email,
          role: user.role,
          name: user.name,
          shopId: user.shopId,
          active: true,
          locked: false,
          permissions: user.permissions,
          updatedAt: new Date().toISOString()
        });
      } catch(syncErr){}
    }

    // Update in-memory db.users
    if(db.users && Array.isArray(db.users)){
      const existingIdx = db.users.findIndex(x => x.id === authUid || x.authUid === authUid || (isSuper && x.role === 'superadmin'));
      if(existingIdx >= 0){
        db.users[existingIdx] = { ...db.users[existingIdx], ...user };
      } else {
        db.users.push(user);
      }
      if(window.DB && typeof window.DB.saveToLocal === 'function'){
        window.DB.saveToLocal('users');
      }
    }

    state.user = user;
    state.authUid = authUid;

    // Remember username logic
    const remBox = document.getElementById('rememberUser');
    if(remBox && remBox.checked){
      localStorage.setItem('pos.lastUser', u);
    } else {
      localStorage.removeItem('pos.lastUser');
    }

    // Set active shop
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

  // Persist session across browser refresh within this tab session
  try {
    sessionStorage.setItem('pos.tabSessionActive', 'true');
    sessionStorage.setItem('pos.currentUser', JSON.stringify(user));
    sessionStorage.setItem('pos.currentPage', state.page);
    sessionStorage.removeItem('pos.screenLocked');

    // Clear persistent user from localStorage so closing the tab requires re-login
    localStorage.removeItem('pos.currentUser');
    localStorage.removeItem('pos.currentPage');
    localStorage.removeItem('pos.screenLocked');
  } catch(e){}

  if(typeof window.loadPageModule === 'function'){
    await window.loadPageModule(state.page);
  }

  renderNav();
  render();
  if(typeof updateClock === 'function') updateClock();
  if(typeof updateShiftIndicator === 'function') updateShiftIndicator();

  // Start 5-minute inactivity idle lock
  if(typeof initIdleTimer === 'function') initIdleTimer();

  // FIX 3: Prompt password change if flagged
  if(user.needsPasswordChange){
    setTimeout(() => {
      if(typeof showChangePasswordModal === 'function') showChangePasswordModal(user);
    }, 400);
  }

  /* ⭐ Shift check: cashier = required, admin/superadmin = optional */
  const activeShift = (typeof Shift !== 'undefined') ? Shift.getActive(user.id) : null;
  const pendingShift = (typeof Shift !== 'undefined' && Shift.getPendingBalanceShift) ? Shift.getPendingBalanceShift(user.id) : null;
  if(pendingShift){
    setTimeout(() => {
      if(typeof openSettlePendingModal === 'function') openSettlePendingModal(pendingShift.id);
    }, 450);
    toast('⚠️ ඔබගේ Shift එක පරිපාලක විසින් නවතා ඇත. කරුණාකර මුදල් ඇතුළත් කර අවසන් කරන්න.', 'warn');
  } else if(!activeShift && user.role === 'cashier'){
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
        if(window.Offline && typeof window.Offline.sync === 'function') setTimeout(() => window.Offline.sync(), 1000);
      }).catch(err => {
        console.warn('Background sync failed (using local data):', err);
        hideSyncIndicator();
        if(window.Offline && typeof window.Offline.sync === 'function') setTimeout(() => window.Offline.sync(), 1000);
      });
    } else if(typeof window.startPageListeners === 'function'){
      window.startPageListeners('billing');
    }
  } catch(err) {
    console.error('Firebase Auth Login Error:', err.code, err.message);
    if(window.Security && typeof window.Security.recordFailedAttempt === 'function'){
      window.Security.recordFailedAttempt(u);
    }
    if(err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential'){
      if(errEl) errEl.textContent = '❌ වැරදි පරිශීලක නාමය හෝ මුරපදය';
    } else if(err.code === 'auth/too-many-requests'){
      if(errEl) errEl.textContent = '⚠️ වැරදි උත්සාහයන් වැඩියි — මිනිත්තු කිහිපයක් රැඳී සිටින්න';
    } else {
      if(errEl) errEl.textContent = '❌ පද්ධතියට පිවිසිය නොහැක (' + (err.code || err.message) + ')';
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

  // Clear persisted user session & lock state
  try {
    sessionStorage.removeItem('pos.tabSessionActive');
    sessionStorage.removeItem('pos.currentUser');
    sessionStorage.removeItem('pos.currentPage');
    sessionStorage.removeItem('pos.authToken');
    sessionStorage.removeItem('pos.screenLocked');
    localStorage.removeItem('pos.currentUser');
    localStorage.removeItem('pos.currentPage');
    localStorage.removeItem('pos.screenLocked');
  } catch(e){}
  if(typeof stopIdleTimer === 'function') stopIdleTimer();
  const lockOverlay = document.getElementById('screenLockOverlay');
  if(lockOverlay) lockOverlay.remove();

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

  try {
    if(window.FB && typeof window.FB.signOut === 'function'){
      window.FB.signOut().catch(e => console.warn('SignOut notice:', e));
    }
  } catch(e){}
  sessionStorage.removeItem('pos.authToken');

  if(typeof updateShiftIndicator === 'function') updateShiftIndicator();
  if(typeof initLoginEnhancements === 'function') initLoginEnhancements();
}

/* =========================================================
   Change Password Modal (For migrated users / temp password)
   ========================================================= */
function showChangePasswordModal(user){
  const bodyHtml = `
    <div style="padding:10px 0">
      <div style="font-size:38px;text-align:center;margin-bottom:10px">🔑</div>
      <p style="font-size:13px;color:var(--muted);margin-bottom:14px;text-align:center;line-height:1.6">
        ආරක්ෂාව තහවුරු කිරීම සඳහා කරුණාකර ඔබගේ තාවකාලික මුරපදය වෙනුවට නව ශක්තිමත් මුරපදයක් සකසන්න.
      </p>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">නව මුරපදය (New Password) *</label>
        <input type="password" id="npNewPass" placeholder="අවම වශයෙන් අකුරු 6ක්" style="width:100%;padding:10px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--txt)">
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">මුරපදය තහවුරු කරන්න (Confirm Password) *</label>
        <input type="password" id="npConfirmPass" placeholder="නැවත ඇතුළත් කරන්න" style="width:100%;padding:10px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--txt)">
      </div>
      <div id="npErr" style="color:var(--red);font-size:12px;margin-top:6px"></div>
    </div>
  `;
  const footerHtml = `
    <button class="btn btn-primary" id="btnSaveNewPass" style="width:100%;padding:10px;font-weight:700" onclick="saveNewPassword()">✅ නව මුරපදය සුරකින්න</button>
  `;
  openModal('🔑 නව මුරපදයක් සකසන්න', 'Password Change Required', bodyHtml, footerHtml, false);
}

async function saveNewPassword(){
  const p1 = document.getElementById('npNewPass')?.value;
  const p2 = document.getElementById('npConfirmPass')?.value;
  const err = document.getElementById('npErr');
  const btn = document.getElementById('btnSaveNewPass');
  if(!p1 || p1.length < 6){
    if(err) err.textContent = '❌ මුරපදය අවම වශයෙන් අකුරු 6ක් විය යුතුය';
    return;
  }
  if(p1 !== p2){
    if(err) err.textContent = '❌ මුරපද දෙක එකිනෙකට නොගැලපේ';
    return;
  }

  if(btn) btn.disabled = true;
  if(err) err.textContent = '';

  try {
    if(window.FB && typeof window.FB.updatePassword === 'function'){
      await window.FB.updatePassword(p1);
    }
    if(state.user){
      state.user.needsPasswordChange = false;
      if(window.FB && window.FB.fbUpdate){
        await window.FB.fbUpdate('users', state.user.id, { needsPasswordChange: false });
      }
    }
    toast('මුරපදය සාර්ථකව යාවත්කාලීන විය ✅', 'ok');
    closeModal();
  } catch(e){
    console.error('Password update error:', e);
    if(err) err.textContent = '❌ මුරපදය වෙනස් කිරීම අසාර්ථකයි: ' + (e.message || '');
  } finally {
    if(btn) btn.disabled = false;
  }
}

function can(page){
  if(!state.user) return false;
  if(state.user.role === 'superadmin') return true;
  if(typeof hasPermission === 'function'){
    const n = (typeof NAV !== 'undefined' && Array.isArray(NAV)) ? NAV.find(x => x.id === page) : null;
    return hasPermission((n && n.perm) || page, state.user);
  }
  const n = (typeof NAV !== 'undefined' && Array.isArray(NAV)) ? NAV.find(x => x.id === page) : null;
  return n && (n.roles || []).includes(state.user.role);
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
window.restoreSession = restoreSession;
window.initIdleTimer = initIdleTimer;
window.resetIdleTimer = resetIdleTimer;
window.stopIdleTimer = stopIdleTimer;
window.lockScreen = lockScreen;
window.unlockScreen = unlockScreen;
window.toggleUnlockPasswordVisibility = toggleUnlockPasswordVisibility;
window.lockSwitchUser = lockSwitchUser;

/* =========================================================
   Session Restoration Across Browser Refresh & Reloads
   ========================================================= */
async function restoreSession(){
  try {
    // 🛡️ Tab-Session Guard:
    // If the browser tab was closed and re-opened, sessionStorage is empty.
    // The user MUST be redirected to the login page to authenticate!
    // On page refresh (reload/F5 within the same tab), sessionStorage is preserved,
    // so the user remains logged in seamlessly on their current page.
    const isTabSessionActive = sessionStorage.getItem('pos.tabSessionActive');
    const userJson = sessionStorage.getItem('pos.currentUser');

    if(!isTabSessionActive || !userJson){
      // Ensure any legacy localStorage session is completely purged
      try {
        localStorage.removeItem('pos.currentUser');
        localStorage.removeItem('pos.currentPage');
        localStorage.removeItem('pos.screenLocked');
      } catch(_){}
      // Sign out background Firebase auth if any
      if(window.FB && typeof window.FB.signOut === 'function'){
        window.FB.signOut().catch(() => {});
      }
      return false;
    }

    const user = JSON.parse(userJson);
    if(!user || !user.id || !user.role) return false;

    const db = window.DB || {};
    // Verify user is not deactivated or locked in local user cache
    if(db.users && Array.isArray(db.users)){
      const liveUser = db.users.find(u => u.id === user.id || u.authUid === user.id);
      if(liveUser){
        if(liveUser.locked === true || liveUser.active === false){
          sessionStorage.removeItem('pos.tabSessionActive');
          sessionStorage.removeItem('pos.currentUser');
          sessionStorage.removeItem('pos.currentPage');
          localStorage.removeItem('pos.currentUser');
          return false;
        }
      }
    }

    state.user = user;
    state.authUid = user.authUid || user.id;

    // Set active shop
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

    // Instant local cache load
    if(db && typeof db.loadAllSync === 'function'){
      db.loadAllSync();
    }

    const loginScreen = $('#loginScreen');
    if(loginScreen) loginScreen.classList.add('hidden');
    const loginSlot = $('#loginSlot');
    if(loginSlot) loginSlot.classList.add('hidden');

    const appSlot = $('#appSlot') || $('#app');
    if(appSlot) appSlot.classList.remove('hidden');

    const uAvatar = $('#uAvatar');
    if(uAvatar) uAvatar.textContent = (user.name || 'U').charAt(0);
    const uName = $('#uName');
    if(uName) uName.textContent = user.name;
    const uRole = $('#uRole');
    if(uRole) uRole.textContent = (typeof ROLE_SI !== 'undefined' ? ROLE_SI[user.role] : user.role) + ' / ' + (typeof ROLE_EN !== 'undefined' ? ROLE_EN[user.role] : user.role);
    const roleBadge = $('#roleBadge');
    if(roleBadge){
      roleBadge.className = 'badge ' + user.role;
      roleBadge.textContent = typeof ROLE_EN !== 'undefined' ? ROLE_EN[user.role] : user.role;
    }

    // Determine target page: URL shortcut > sessionStorage saved page > default 'billing'
    const savedPage = sessionStorage.getItem('pos.currentPage') || localStorage.getItem('pos.currentPage');
    const shortcut = window.state?.shortcutPage;
    let targetPage = shortcut || savedPage || 'billing';
    if(typeof can === 'function' && !can(targetPage)){
      targetPage = 'billing';
    }
    if(typeof can === 'function' && !can(targetPage) && typeof NAV !== 'undefined'){
      const firstNav = NAV.find(n => (typeof hasPermission === 'function' ? hasPermission(n.perm || n.id) : (n.roles || []).includes(user.role)));
      targetPage = firstNav ? firstNav.id : 'billing';
    }

    state.page = targetPage;
    state.cart = state.cart || [];

    if(typeof window.loadPageModule === 'function'){
      await window.loadPageModule(targetPage);
    }

    if(typeof renderNav === 'function') renderNav();
    if(typeof render === 'function') render();
    if(typeof updateClock === 'function') updateClock();
    if(typeof updateShiftIndicator === 'function') updateShiftIndicator();

    if(typeof window.startPageListeners === 'function'){
      window.startPageListeners(targetPage);
    }

    // Start 5-minute inactivity idle detection
    if(typeof initIdleTimer === 'function'){
      initIdleTimer();
    }

    // Restore lock state if previously locked within this tab session
    if(sessionStorage.getItem('pos.screenLocked') === 'true' || localStorage.getItem('pos.screenLocked') === 'true'){
      lockScreen();
    }

    if(window.Offline && typeof window.Offline.sync === 'function'){
      setTimeout(() => window.Offline.sync(), 1500);
    }

    return true;
  } catch(err){
    console.warn('Session restore failed:', err);
    return false;
  }
}

/* =========================================================
   5-Minute Inactivity Auto Screen Lock System
   ========================================================= */
const INACTIVITY_LOCK_MS = 5 * 60 * 1000; // 5 minutes (300,000ms)
let _idleLockTimer = null;
let _isScreenLocked = false;
let _idleEventsBound = false;

function initIdleTimer(){
  resetIdleTimer();
  if(!_idleEventsBound){
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    activityEvents.forEach(evt => {
      window.addEventListener(evt, () => {
        if(!_isScreenLocked && window.state?.user){
          resetIdleTimer();
        }
      }, { passive: true });
    });
    _idleEventsBound = true;
  }
}

function resetIdleTimer(){
  if(_idleLockTimer) clearTimeout(_idleLockTimer);
  if(!_isScreenLocked && window.state?.user){
    _idleLockTimer = setTimeout(() => {
      lockScreen();
    }, INACTIVITY_LOCK_MS);
  }
}

function stopIdleTimer(){
  if(_idleLockTimer){
    clearTimeout(_idleLockTimer);
    _idleLockTimer = null;
  }
}

function lockScreen(){
  if(!window.state?.user) return;
  _isScreenLocked = true;
  try {
    sessionStorage.setItem('pos.screenLocked', 'true');
    localStorage.removeItem('pos.screenLocked');
  } catch(e){}

  if(document.getElementById('screenLockOverlay')) return;

  const user = window.state.user;
  const initialLetter = (user.name || 'U').charAt(0).toUpperCase();
  const roleName = (typeof ROLE_SI !== 'undefined' && ROLE_SI[user.role]) 
    ? `${ROLE_SI[user.role]} (${ROLE_EN[user.role] || user.role})`
    : (user.role || 'User');

  const overlay = document.createElement('div');
  overlay.id = 'screenLockOverlay';
  overlay.className = 'screen-lock-overlay';
  overlay.innerHTML = `
    <div class="screen-lock-modal">
      <div class="screen-lock-icon-wrap">
        <span class="screen-lock-icon">🔒</span>
      </div>
      <h2 class="screen-lock-title">පද්ධතිය අගුළු දමා ඇත</h2>
      <p class="screen-lock-subtitle">ආරක්ෂාව සඳහා මිනිත්තු 5ක් අක්‍රියව තිබූ බැවින් පද්ධතිය අගුළු ලන ලදී (Screen locked due to 5 min inactivity)</p>

      <div class="screen-lock-user-card">
        <div class="screen-lock-avatar">${esc(initialLetter)}</div>
        <div class="screen-lock-user-details">
          <div class="screen-lock-user-name">${esc(user.name)}</div>
          <div class="screen-lock-user-role">${esc(roleName)}</div>
        </div>
      </div>

      <div class="screen-lock-form">
        <label for="lockUnlockPass" class="screen-lock-label">🔑 මුරපදය ඇතුළත් කර අගුල හරින්න (Enter Password)</label>
        <div class="screen-lock-input-wrap">
          <input type="password" id="lockUnlockPass" placeholder="මුරපදය / Password" autocomplete="current-password">
          <button type="button" class="eye-btn" onclick="toggleUnlockPasswordVisibility()" tabindex="-1" aria-label="Show password">
            <span id="lockEyeIcon">👁️</span>
          </button>
        </div>
        <div id="lockUnlockErr" class="screen-lock-err"></div>

        <button type="button" id="lockUnlockBtn" class="btn btn-primary screen-lock-submit-btn" onclick="unlockScreen()">
          <span id="lockUnlockBtnText">🔓 අගුළු හරින්න (Unlock POS)</span>
          <span id="lockUnlockBtnSpinner" class="btn-spinner hidden"><span class="spinner"></span></span>
        </button>

        <div class="screen-lock-switch-wrap">
          <button type="button" class="screen-lock-switch-btn" onclick="lockSwitchUser()">
            👤 වෙනත් පරිශීලකයෙක් ලෙස පිවිසෙන්න (Switch User / Log Out)
          </button>
        </div>
      </div>
    </div>
  `;

  // Trap ESC key and all clicks
  overlay.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){
      e.preventDefault();
      e.stopPropagation();
    }
  });

  document.body.appendChild(overlay);

  const passInput = document.getElementById('lockUnlockPass');
  if(passInput){
    passInput.addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){
        e.preventDefault();
        unlockScreen();
      }
    });
    setTimeout(() => passInput.focus(), 150);
  }
}

function toggleUnlockPasswordVisibility(){
  const inp = document.getElementById('lockUnlockPass');
  const icon = document.getElementById('lockEyeIcon');
  if(!inp) return;
  if(inp.type === 'password'){
    inp.type = 'text';
    if(icon) icon.textContent = '🙈';
  } else {
    inp.type = 'password';
    if(icon) icon.textContent = '👁️';
  }
}

async function unlockScreen(){
  const passInp = document.getElementById('lockUnlockPass');
  const errEl = document.getElementById('lockUnlockErr');
  const btn = document.getElementById('lockUnlockBtn');
  const txt = document.getElementById('lockUnlockBtnText');
  const spn = document.getElementById('lockUnlockBtnSpinner');
  const entered = passInp ? passInp.value.trim() : '';

  if(!entered){
    if(errEl) errEl.textContent = '❌ කරුණාකර ඔබගේ මුරපදය ඇතුළත් කරන්න';
    if(passInp) passInp.focus();
    return;
  }

  if(btn) btn.disabled = true;
  if(txt) txt.classList.add('hidden');
  if(spn) spn.classList.remove('hidden');
  if(errEl) errEl.textContent = '';

  try {
    const user = window.state?.user;
    if(!user){
      lockSwitchUser();
      return;
    }

    let isValid = false;

    // 1. Check against user.password hash with bcrypt
    if(user.password && window.Security && typeof window.Security.verifyPassword === 'function'){
      isValid = await window.Security.verifyPassword(entered, user.password);
    }

    // 2. Fallback: check matching user in db.users
    if(!isValid && window.DB?.users){
      const dbUser = window.DB.users.find(u => u.id === user.id || u.username === user.username || u.email === user.email);
      if(dbUser && dbUser.password && window.Security){
        isValid = await window.Security.verifyPassword(entered, dbUser.password);
      }
    }

    // 3. Fallback: verify via Firebase Auth signInWithEmailAndPassword
    if(!isValid && window.FB && typeof window.FB.getAuth === 'function' && typeof window.FB.getAuthModule === 'function' && user.email){
      try {
        const authMod = window.FB.getAuthModule();
        const auth = window.FB.getAuth();
        if(auth && authMod){
          await authMod.signInWithEmailAndPassword(auth, user.email, entered);
          isValid = true;
        }
      } catch(fbErr){}
    }

    if(isValid){
      _isScreenLocked = false;
      try {
        sessionStorage.removeItem('pos.screenLocked');
        localStorage.removeItem('pos.screenLocked');
      } catch(e){}

      const overlay = document.getElementById('screenLockOverlay');
      if(overlay) overlay.remove();

      resetIdleTimer();
      if(typeof toast === 'function'){
        toast('🔓 පද්ධතිය සාර්ථකව අගුළු හරින ලදී (System Unlocked)', 'ok');
      }
    } else {
      if(errEl) errEl.textContent = '❌ වැරදි මුරපදයකි. කරුණාකර නැවත උත්සාහ කරන්න.';
      if(passInp){
        passInp.value = '';
        passInp.focus();
      }
    }
  } catch(err){
    console.error('Unlock error:', err);
    if(errEl) errEl.textContent = '❌ අගුළු හැරීමේ දෝෂයක්: ' + (err.message || err);
  } finally {
    if(btn) btn.disabled = false;
    if(txt) txt.classList.remove('hidden');
    if(spn) spn.classList.add('hidden');
  }
}

function lockSwitchUser(){
  if(confirm('ඔබට මෙම ගිණුමෙන් ඉවත් වී වෙනත් පරිශීලකයෙක් ලෙස පිවිසීමට අවශ්‍යද? (Switch User / Log Out?)')){
    _isScreenLocked = false;
    try {
      sessionStorage.removeItem('pos.screenLocked');
      localStorage.removeItem('pos.screenLocked');
    } catch(e){}
    const overlay = document.getElementById('screenLockOverlay');
    if(overlay) overlay.remove();
    performLogout();
  }
}

/* Process any pending actions queued before auth.js was loaded */
if(window._pendingQuick){
  const pendingRole = window._pendingQuick;
  window._pendingQuick = null;
  quick(pendingRole);
} else if(window._pendingLogin){
  window._pendingLogin = false;
  const curU = document.getElementById('lUser') ? document.getElementById('lUser').value.trim() : '';
  const curP = document.getElementById('lPass') ? document.getElementById('lPass').value.trim() : '';
  if(curU && curP){
    doLogin();
  }
}


