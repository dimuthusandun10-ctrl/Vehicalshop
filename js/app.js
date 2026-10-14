/* =========================================================
   js/app.js - Application Lifecycle & Global Event Listeners
   ========================================================= */

function resolveAppVersion(){
  try {
    const scripts = document.querySelectorAll('script[src*="js/app.js"]');
    for(const s of scripts){
      const src = s.getAttribute('src') || '';
      const m = src.match(/[?&]v=([0-9a-zA-Z\.\-]+)/);
      if(m && m[1]) return m[1].startsWith('v') ? m[1] : ('v' + m[1]);
    }
  } catch(_){}
  return 'v2.7.8';
}
window.CURRENT_APP_VERSION = resolveAppVersion();
const CURRENT_APP_VERSION = window.CURRENT_APP_VERSION;
let _isUpdatingApp = false;
window._isUpdatingApp = false;

/* Global Keyboard Shortcuts */
window.addEventListener('keydown', e => {
  // If modal is currently displayed
  if($('#modalRoot')?.children.length > 0){
    if(e.key === 'Escape'){
      e.preventDefault();
      closeModal();
    }
    return;
  }

  // Active only when logged in and on the billing page
  if(state.user && state.page === 'billing'){
    if(e.key === 'F2'){
      e.preventDefault();
      focusSearch();
    } else if(e.key === 'F4'){
      e.preventDefault();
      if(state.cart.length) openCheckout();
      else toast('බිලට භාණ්ඩ එකතු කර නැත (Cart empty)', 'warn');
    } else if(e.key === 'F8'){
      e.preventDefault();
      clearCart();
    }
  }
});

/* Interval for topbar live clock */
setInterval(updateClock, 1000);

/* Application Bootstrapper Entry Point */
async function initApp(){
  updateClock();

  // Read PWA shortcut navigation (e.g. ?page=billing or ?page=inventory)
  try {
    const params = new URLSearchParams(window.location.search);
    const target = params.get('page');
    if(target && window.state){
      window.state.shortcutPage = target;
    }
  } catch(e){}

  // One-time cleanup for legacy user ID queue items (e.g. U2, U3)
  if(localStorage.getItem('pos.uidMigrationDone') !== 'v1'){
    try {
      const q = JSON.parse(localStorage.getItem('pos.syncQueue') || '[]');
      const cleaned = q.filter(item => !(item.collection === 'users' && /^U\d+$/.test(item.docId)));
      if(cleaned.length !== q.length){
        localStorage.setItem('pos.syncQueue', JSON.stringify(cleaned));
        console.log(`🧹 Dropped ${q.length - cleaned.length} stale user queue items`);
      }
    } catch(e){}
    localStorage.setItem('pos.uidMigrationDone', 'v1');
  }

  if(window.Offline && typeof window.Offline.init === 'function'){
    window.Offline.init();
  }

  if(window.BackupService && typeof window.BackupService.init === 'function'){
    window.BackupService.init();
  }

  // Restore active user session across browser refresh / reload
  let sessionRestored = false;
  if(typeof window.restoreSession === 'function'){
    sessionRestored = await window.restoreSession();
  }

  if(!sessionRestored){
    if(typeof initLoginEnhancements === 'function'){
      initLoginEnhancements();
    } else {
      const uInp = $('#lUser');
      if(uInp) uInp.focus();
    }
  }

  // Register PWA Service Worker
  registerPwaServiceWorker();
}

/* =========================================================
   PWA Service Worker Registration & Auto-Update
   ========================================================= */
function registerPwaServiceWorker(){
  if('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
        .then(reg => {
          console.log('✅ PWA Service Worker registered, scope:', reg.scope);
          window._swReg = reg;

          // If a new worker is already waiting (from a background fetch), show update banner immediately
          if(reg.waiting){
            showUpdateBanner(reg);
          }

          // Check for updates whenever user returns to the app / window gains focus
          document.addEventListener('visibilitychange', () => {
            if(document.visibilityState === 'visible'){
              try { reg.update(); } catch(_){}
            }
          });

          // Check every 10 minutes
          setInterval(() => {
            try { reg.update(); } catch(_){}
          }, 600000);

          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if(!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if(newWorker.state === 'installed' && navigator.serviceWorker.controller){
                showUpdateBanner(reg);
              }
            });
          });
        })
        .catch(err => console.warn('PWA SW registration notice:', err));
    });

    // When the new Service Worker activates and claims clients, reload page only if NOT mid-update
    const hadController = Boolean(navigator.serviceWorker.controller);
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if(hadController && !window._isUpdatingApp && !refreshing){
        refreshing = true;
        window.location.reload();
      }
    });
  }

  // Real-time online reconnect check
  window.addEventListener('online', () => {
    checkForCloudflareUpdates(true);
  });

  // Real-time initial check directly from Cloudflare server (1.2s after start)
  setTimeout(() => {
    checkForCloudflareUpdates(true);
  }, 1200);

  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible'){
      checkForCloudflareUpdates(false);
    }
  });
}

try {
  if(localStorage.getItem('pos.appVersion') !== CURRENT_APP_VERSION){
    localStorage.setItem('pos.appVersion', CURRENT_APP_VERSION);
  }
} catch(_){}

let _lastUpdateCheckTime = 0;
let _updateBannerTimer = null;

function updateTopbarUpdateBadge(newVer){
  const badge = document.getElementById('topbarUpdateBadge');
  if(!badge) return;
  if(newVer && newVer !== CURRENT_APP_VERSION){
    badge.innerHTML = `🚀 Update (${newVer})`;
    badge.classList.remove('hidden');
    badge.onclick = () => forceUpdateApp(newVer);
  } else {
    badge.classList.add('hidden');
  }
}

async function checkForCloudflareUpdates(force = false){
  if(typeof navigator !== 'undefined' && !navigator.onLine) return;
  const now = Date.now();
  // Fast throttle of 20 seconds unless explicitly forced
  if(!force && (now - _lastUpdateCheckTime < 20000)){
    return;
  }
  _lastUpdateCheckTime = now;

  try {
    const res = await fetch('/service-worker.js?_chk=' + now, { cache: 'no-store' });
    if(res.ok){
      const text = await res.text();
      const match = text.match(/CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/);
      if(match && match[1]){
        const remoteVer = match[1];
        window._availableRemoteVersion = remoteVer;
        if(remoteVer !== CURRENT_APP_VERSION){
          console.log('⚡ Real-time new version detected on Cloudflare:', remoteVer, 'Current:', CURRENT_APP_VERSION);
          showUpdateBannerDirect(remoteVer);
          updateTopbarUpdateBadge(remoteVer);
        } else {
          dismissUpdateBanner(true);
          updateTopbarUpdateBadge(null);
          const sbWrap = document.getElementById('sidebarUpdateWrap');
          if(sbWrap) sbWrap.style.display = 'none';
        }
      }
    }
  } catch(e){
    // Network or worker check notice ignored
  }
}

function showUpdateBannerDirect(newVer){
  if(!newVer || newVer === CURRENT_APP_VERSION || newVer === window.CURRENT_APP_VERSION){
    dismissUpdateBanner(true);
    updateTopbarUpdateBadge(null);
    const sbWrap = document.getElementById('sidebarUpdateWrap');
    if(sbWrap) sbWrap.style.display = 'none';
    return;
  }
  // 1. Reveal sidebar update button in the side menu (stays accessible at all times)
  const sbWrap = document.getElementById('sidebarUpdateWrap');
  if(sbWrap){
    sbWrap.style.display = 'block';
    const sbBtn = document.getElementById('sidebarUpdateBtn');
    if(sbBtn){
      sbBtn.innerHTML = `🚀 නව Update ඇත! <small style="color:#38bdf8;font-weight:700;margin-left:4px">${newVer}</small>`;
      sbBtn.onclick = () => forceUpdateApp(newVer);
    }
  }

  // 2. Also show topbar update badge in header
  updateTopbarUpdateBadge(newVer);

  // 3. Floating bottom update notification banner
  let banner = document.getElementById('updateBanner');
  if(!banner){
    banner = document.createElement('div');
    banner.className = 'update-banner';
    banner.id = 'updateBanner';
    document.body.appendChild(banner);
  }

  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:22px">🚀</span>
      <div>
        <b style="font-size:13px;display:block">නවතම සංස්කරණයක් ඇත (${newVer})!</b>
        <small style="opacity:0.9;font-size:11px">Sidebar, Header හෝ Settings මඟින් Update කළ හැක</small>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:6px">
      <button type="button" onclick="forceUpdateApp('${newVer}')" style="background:#10b981;color:#fff;border:none;padding:6px 12px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer">🔄 Update කරන්න</button>
      <button type="button" onclick="dismissUpdateBanner()" style="background:transparent;color:#fff;border:none;font-size:16px;cursor:pointer;padding:4px 8px;border-radius:6px" title="පසුව">✕</button>
    </div>
  `;

  banner.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
  banner.style.opacity = '1';
  banner.style.transform = 'translateY(0)';

  if(_updateBannerTimer) clearTimeout(_updateBannerTimer);
  _updateBannerTimer = setTimeout(() => {
    dismissUpdateBanner();
  }, 4000);

  banner.onmouseenter = () => { if(_updateBannerTimer) clearTimeout(_updateBannerTimer); };
  banner.onmouseleave = () => { _updateBannerTimer = setTimeout(dismissUpdateBanner, 2000); };
}

function dismissUpdateBanner(immediate = false){
  if(_updateBannerTimer) clearTimeout(_updateBannerTimer);
  const banner = document.getElementById('updateBanner');
  if(!banner) return;
  if(immediate){
    banner.remove();
    return;
  }
  banner.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
  banner.style.opacity = '0';
  banner.style.transform = 'translateY(25px)';
  setTimeout(() => {
    if(banner && banner.parentNode) banner.parentNode.removeChild(banner);
  }, 350);
}

function showUpdateBanner(reg){
  if(window._availableRemoteVersion && window._availableRemoteVersion !== CURRENT_APP_VERSION){
    showUpdateBannerDirect(window._availableRemoteVersion);
  } else {
    checkForCloudflareUpdates(true);
  }
}

/* =========================================================
   🚀 REAL-TIME UPDATE PROGRESS MODAL & HARD REFRESH ENGINE
   ========================================================= */
function showUpdateProgressModal(targetVer){
  let el = document.getElementById('updateProgressOverlay');
  if(!el){
    el = document.createElement('div');
    el.id = 'updateProgressOverlay';
    el.className = 'update-progress-overlay';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="update-progress-card">
      <div class="upc-header">
        <div class="upc-icon-wrap">
          <span class="upc-rocket">🚀</span>
        </div>
        <h3>පද්ධතිය යාවත්කාලීන වෙමින් පවතී...</h3>
        <p id="upcTargetVer">${targetVer ? 'සංස්කරණය: ' + targetVer : 'AutoParts POS Live Update'}</p>
      </div>

      <div class="upc-bar-container">
        <div class="upc-bar-track">
          <div id="upcProgressBar" class="upc-bar-fill" style="width: 5%"></div>
        </div>
        <div class="upc-bar-meta">
          <span id="upcStatusText">සූදානම් වෙමින් පවතී...</span>
          <b id="upcPercentText">5%</b>
        </div>
      </div>

      <div class="upc-steps-list">
        <div class="upc-step active" id="upcStep1">
          <span class="step-icon">📡</span>
          <span class="step-text">Cloudflare Server නවතම සංස්කරණය තහවුරු කිරීම</span>
          <span class="step-status">⏳</span>
        </div>
        <div class="upc-step" id="upcStep2">
          <span class="step-icon">🗑️</span>
          <span class="step-text">පැරණි Cache Storage හා Service Worker ඉවත් කිරීම</span>
          <span class="step-status">⚪</span>
        </div>
        <div class="upc-step" id="upcStep3">
          <span class="step-icon">📦</span>
          <span class="step-text">නවතම App Scripts & Styles බාගත කිරීම</span>
          <span class="step-status">⚪</span>
        </div>
        <div class="upc-step" id="upcStep4">
          <span class="step-icon">💾</span>
          <span class="step-text">පද්ධති දත්ත (Local DB) ආරක්ෂා කර සකස් කිරීම</span>
          <span class="step-status">⚪</span>
        </div>
        <div class="upc-step" id="upcStep5">
          <span class="step-icon">🔄</span>
          <span class="step-text">සම්පූර්ණ Hard Refresh මඟින් පද්ධතිය ආරම්භ කිරීම</span>
          <span class="step-status">⚪</span>
        </div>
      </div>

      <div class="upc-footer-note">
        ⚠️ කරුණාකර පිටුව වසන්න හෝ Back ඔබන්න එපා (Do not close or reload)
      </div>
    </div>
  `;
}

function updateProgressStep(stepNum, percent, statusText){
  const bar = document.getElementById('upcProgressBar');
  const percentEl = document.getElementById('upcPercentText');
  const statusEl = document.getElementById('upcStatusText');
  if(bar) bar.style.width = percent + '%';
  if(percentEl) percentEl.textContent = percent + '%';
  if(statusEl) statusEl.textContent = statusText;

  for(let i = 1; i <= 5; i++){
    const s = document.getElementById('upcStep' + i);
    if(!s) continue;
    const stat = s.querySelector('.step-status');
    if(i < stepNum){
      s.className = 'upc-step done';
      if(stat) stat.textContent = '✅';
    } else if(i === stepNum){
      s.className = 'upc-step active';
      if(stat) stat.textContent = '⏳';
    } else {
      s.className = 'upc-step';
      if(stat) stat.textContent = '⚪';
    }
  }
}

async function forceUpdateApp(targetVer){
  window._isUpdatingApp = true;
  _isUpdatingApp = true;
  let newVer = targetVer || window._availableRemoteVersion || CURRENT_APP_VERSION;

  // 1. Show interactive progress modal
  showUpdateProgressModal(newVer);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  try {
    // STEP 1: Check Cloudflare live version (15%)
    updateProgressStep(1, 15, 'Cloudflare සේවාදායකයේ නවතම සංස්කරණය තහවුරු කරමින්...');
    try {
      const chkRes = await fetch('/service-worker.js?_chk=' + Date.now(), { cache: 'no-store' });
      if(chkRes.ok){
        const text = await chkRes.text();
        const match = text.match(/CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/);
        if(match && match[1]){
          newVer = match[1];
          window._availableRemoteVersion = newVer;
          const targetEl = document.getElementById('upcTargetVer');
          if(targetEl) targetEl.textContent = 'නවතම සංස්කරණය: ' + newVer;
        }
      }
    } catch(_){}
    await sleep(350);

    // STEP 2: Clear old service workers & all Cache Storage (40%)
    updateProgressStep(2, 40, 'පැරණි Service Worker හා Cache Storage සම්පූර්ණයෙන්ම ඉවත් කරමින්...');
    if('serviceWorker' in navigator){
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for(const reg of registrations){
          if(reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          if(reg.installing) reg.installing.postMessage({ type: 'SKIP_WAITING' });
          try { await reg.update(); } catch(_){}
          try { await reg.unregister(); } catch(_){}
        }
      } catch(e){}
    }

    if('caches' in window){
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch(e){}
    }
    await sleep(400);

    // STEP 3: Pre-fetch fresh bundle from network directly (70%)
    updateProgressStep(3, 70, 'නවතම App Scripts, CSS සහ Layouts බාගත කරමින්...');
    try {
      await Promise.all([
        fetch('/index.html?_ts=' + Date.now(), { cache: 'reload' }),
        fetch('/css/app-combined.css?v=' + encodeURIComponent(newVer), { cache: 'reload' }),
        fetch('/js/app.js?v=' + encodeURIComponent(newVer), { cache: 'reload' }),
        fetch('/service-worker.js?_ts=' + Date.now(), { cache: 'reload' })
      ]);
    } catch(_){}
    await sleep(400);

    // STEP 4: Protect local DB & commit version state (90%)
    updateProgressStep(4, 90, 'දේශීය දත්ත ගබඩාව ආරක්ෂා කරමින් පද්ධතිය සකස් කිරීම...');
    try {
      localStorage.setItem('pos.appVersion', newVer);
      Object.keys(sessionStorage).forEach(k => {
        if(k.startsWith('pos.updatePrompted.')) sessionStorage.removeItem(k);
      });
    } catch(_){}
    await sleep(350);

    // STEP 5: Hard Refresh (100%)
    updateProgressStep(5, 100, '✅ සාර්ථකයි! සම්පූර්ණ Hard Refresh මඟින් නැවත ආරම්භ වේ...');
    for(let i = 1; i <= 5; i++){
      const s = document.getElementById('upcStep' + i);
      if(s){
        s.className = 'upc-step done';
        const st = s.querySelector('.step-status');
        if(st) st.textContent = '✅';
      }
    }
    await sleep(500);

    // Hard navigation with cache-busting timestamp and version query
    const cleanUrl = window.location.origin + window.location.pathname;
    const targetUrl = cleanUrl + '?v=' + encodeURIComponent(newVer) + '&_hard_refresh=' + Date.now();
    window.location.replace(targetUrl);

    // Safety fallback
    setTimeout(() => {
      window.location.href = targetUrl;
    }, 600);

  } catch(err){
    console.error('Update progress error:', err);
    updateProgressStep(5, 100, 'Hard Refresh මඟින් නැවත පූරණය වේ...');
    await sleep(300);
    const cleanUrl = window.location.origin + window.location.pathname;
    window.location.replace(cleanUrl + '?v=' + encodeURIComponent(newVer) + '&_hard_refresh=' + Date.now());
  }
}

window.forceUpdateApp = forceUpdateApp;
window.updateApp = forceUpdateApp;
window.checkForCloudflareUpdates = checkForCloudflareUpdates;
window.openContactModal = window.openContactModal || function(){ if(typeof window.showContactUsModal === 'function') window.showContactUsModal(); };

/* =========================================================
   Custom PWA Install Prompt (Chrome / Edge / Android)
   ========================================================= */
window.deferredPrompt = window.deferredPrompt || null;
var deferredPrompt = window.deferredPrompt;

if(!window._pwaPromptListenerAttached){
  window._pwaPromptListenerAttached = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
    deferredPrompt = e;

    if(localStorage.getItem('pos.installPromptDismissed')){
      return;
    }

    setTimeout(() => {
      showInstallBanner();
    }, 30000);
  });
}

function showInstallBanner(){
  const promptEvt = window.deferredPrompt || deferredPrompt;
  if(!promptEvt || document.getElementById('installBanner')) return;

  const banner = document.createElement('div');
  banner.className = 'install-banner';
  banner.id = 'installBanner';
  banner.innerHTML = `
    <div class="ib-icon">📱</div>
    <div class="ib-content">
      <b>AutoParts POS Install කරන්න</b>
      <small>Home screen එකෙන් app එකක් වගේ open කරන්න</small>
    </div>
    <button class="ib-install" onclick="installPWA()">Install</button>
    <button class="ib-dismiss" onclick="dismissInstall()">✕</button>
  `;
  document.body.appendChild(banner);
}

async function installPWA(){
  const promptEvt = window.deferredPrompt || deferredPrompt;
  if(!promptEvt) return;
  promptEvt.prompt();
  const { outcome } = await promptEvt.userChoice;
  console.log('Install outcome:', outcome);
  window.deferredPrompt = null;
  deferredPrompt = null;
  document.getElementById('installBanner')?.remove();

  if(outcome === 'accepted' && typeof toast === 'function'){
    toast('✅ App install විය! Home screen එකේ බලන්න.', 'ok');
  }
}

function dismissInstall(){
  localStorage.setItem('pos.installPromptDismissed', 'v1');
  document.getElementById('installBanner')?.remove();
}

window.installPWA = installPWA;
window.dismissInstall = dismissInstall;

/* =========================================================
   iOS Safari Manual Install Hint
   ========================================================= */
var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
var isStandalone = (window.navigator.standalone === true) || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

if(isIOS && !isStandalone && !localStorage.getItem('pos.iosHintDismissed')){
  setTimeout(() => showIOSInstallHint(), 30000);
}

function showIOSInstallHint(){
  if(document.getElementById('iosInstallHint')) return;
  const hint = document.createElement('div');
  hint.className = 'install-banner';
  hint.id = 'iosInstallHint';
  hint.innerHTML = `
    <div class="ib-icon">📱</div>
    <div class="ib-content">
      <b>App ලෙස Install කරන්න</b>
      <small>Share <span style="color:#3b82f6;font-size:13px">⬆️</span> → "Add to Home Screen" තෝරන්න</small>
    </div>
    <button class="ib-dismiss" onclick="this.parentElement.remove();localStorage.setItem('pos.iosHintDismissed','v1')">✕</button>
  `;
  document.body.appendChild(hint);
}

