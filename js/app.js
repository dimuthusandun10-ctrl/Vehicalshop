/* =========================================================
   js/app.js - Application Lifecycle & Global Event Listeners
   ========================================================= */

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
function initApp(){
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

  if(typeof initLoginEnhancements === 'function'){
    initLoginEnhancements();
  } else {
    const uInp = $('#lUser');
    if(uInp) uInp.focus();
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

    // When the new Service Worker activates and claims clients, reload page seamlessly
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if(!refreshing){
        refreshing = true;
        window.location.reload();
      }
    });
  }

  // Active check for updates directly from Cloudflare server
  setTimeout(() => {
    checkForCloudflareUpdates();
  }, 3500);

  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible'){
      checkForCloudflareUpdates();
    }
  });
}

const CURRENT_APP_VERSION = 'v2.5.4';

async function checkForCloudflareUpdates(){
  if(typeof navigator !== 'undefined' && !navigator.onLine) return;
  try {
    const res = await fetch('/service-worker.js?_chk=' + Date.now(), { cache: 'no-store' });
    if(res.ok){
      const text = await res.text();
      const match = text.match(/CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/);
      if(match && match[1]){
        const remoteVer = match[1];
        const localVer = localStorage.getItem('pos.appVersion') || CURRENT_APP_VERSION;
        if(remoteVer !== localVer){
          console.log('⚡ New version detected on Cloudflare:', remoteVer, 'Local:', localVer);
          showUpdateBannerDirect(remoteVer);
        }
      }
    }
  } catch(e){
    // Network or worker check notice ignored
  }
}

function showUpdateBannerDirect(newVer){
  // 1. Reveal sidebar update button ONLY when an update is actually available
  const sbWrap = document.getElementById('sidebarUpdateWrap');
  if(sbWrap){
    sbWrap.style.display = 'block';
    const sbBtn = document.getElementById('sidebarUpdateBtn');
    if(sbBtn) sbBtn.innerHTML = `🚀 නව Update ඇත! <small style="color:var(--muted);font-weight:700">${newVer}</small>`;
  }

  // 2. Reveal login screen update button ONLY when an update is actually available
  const lWrap = document.getElementById('loginUpdateWrap');
  if(lWrap){
    lWrap.style.display = 'block';
  }

  // 3. Floating bottom update notification banner
  if(document.getElementById('updateBanner')) return;
  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.id = 'updateBanner';
  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:22px">🚀</span>
      <div>
        <b style="font-size:13px;display:block">නවතම සංස්කරණයක් ඇත (${newVer})!</b>
        <small style="opacity:0.9;font-size:11px">Cloudflare වෙතින් නවතම යාවත්කාලීනය ලබාගන්න</small>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:6px">
      <button type="button" onclick="forceUpdateApp()" style="background:#10b981;color:#fff;border:none;padding:6px 12px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer">🔄 Update කරන්න</button>
      <button type="button" onclick="this.closest('.update-banner').remove()" style="background:transparent;color:#fff;border:none;font-size:16px;cursor:pointer;padding:4px 8px;border-radius:6px" title="පසුව">✕</button>
    </div>
  `;
  document.body.appendChild(banner);
}

function showUpdateBanner(reg){
  showUpdateBannerDirect(CURRENT_APP_VERSION);
}

async function forceUpdateApp(){
  if(typeof toast === 'function') toast('⏳ නවතම අනුවාදය පරීක්ෂා කරමින් පවතී... (Checking Cloudflare updates)', 'info');

  try {
    localStorage.setItem('pos.appVersion', CURRENT_APP_VERSION);

    // 1. Tell waiting or installing service worker to activate
    if('serviceWorker' in navigator){
      const reg = window._swReg || await navigator.serviceWorker.getRegistration();
      if(reg){
        if(reg.waiting){
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        if(reg.installing){
          reg.installing.postMessage({ type: 'SKIP_WAITING' });
        }
        try {
          await reg.update();
        } catch(_){}
      }
    }

    // 2. Clear all cache storage caches (scripts, css, html)
    if('caches' in window){
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }

    if(typeof toast === 'function') toast('✅ යෙදුම සාර්ථකව යාවත්කාලීන විය! නැවත පූරණය වේ...', 'ok');

    // 3. Force clean reload with cache-buster timestamp query to bypass Cloudflare/browser cache
    setTimeout(() => {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.location.href = cleanUrl + '?ts=' + Date.now();
    }, 450);

  } catch(err){
    console.error('Force update error:', err);
    const cleanUrl = window.location.origin + window.location.pathname;
    window.location.href = cleanUrl + '?ts=' + Date.now();
  }
}

window.forceUpdateApp = forceUpdateApp;
window.updateApp = forceUpdateApp;
window.checkForCloudflareUpdates = checkForCloudflareUpdates;

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

