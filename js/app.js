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

          // Hourly update check
          setInterval(() => {
            try { reg.update(); } catch(e){}
          }, 3600000);

          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if(!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if(newWorker.state === 'installed' && navigator.serviceWorker.controller){
                showUpdateBanner();
              }
            });
          });
        })
        .catch(err => console.warn('PWA SW registration notice:', err));
    });
  }
}

function showUpdateBanner(){
  if(document.getElementById('updateBanner')) return;
  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.id = 'updateBanner';
  banner.innerHTML = `
    <span>🆕 නව version එකක් තියෙනවා (Update Available)</span>
    <button onclick="updateApp()">🔄 Update කරන්න</button>
  `;
  document.body.appendChild(banner);
}

function updateApp(){
  if(navigator.serviceWorker && navigator.serviceWorker.controller){
    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
  }
  setTimeout(() => window.location.reload(), 400);
}

window.updateApp = updateApp;

/* =========================================================
   Custom PWA Install Prompt (Chrome / Edge / Android)
   ========================================================= */
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  if(localStorage.getItem('pos.installPromptDismissed')){
    return;
  }

  setTimeout(() => {
    showInstallBanner();
  }, 30000);
});

function showInstallBanner(){
  if(!deferredPrompt || document.getElementById('installBanner')) return;

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
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log('Install outcome:', outcome);
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
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = (window.navigator.standalone === true) || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

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

