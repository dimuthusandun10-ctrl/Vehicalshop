/* =========================================================
   js/loader.js - Dynamic Script Loader
   ========================================================= */

(async function boot() {
  const APP_VERSION = '2.2.0';
  /* 1. Scripts in strict dependency sequence */
  const SCRIPTS = [
    'js/bcrypt.min.js',
    'js/config.js',
    'js/helpers.js',
    'js/security.js',
    'js/offline.js',
    'js/firebase.js',
    'js/seed.js',
    'js/db-service.js',
    'js/shift.js',
    'js/auth.js',
    'js/date-picker.js',
    'js/pages/credit.js',
    'js/pages/dashboard.js',
    'js/pages/billing.js',
    'js/pages/pos.js',
    'js/pages/inventory.js',
    'js/pages/customers.js',
    'js/pages/lowstock.js',
    'js/pages/grn.js',
    'js/pages/returns.js',
    'js/pages/shifts.js',
    'js/pages/reports.js',
    'js/pages/shops.js',
    'js/pages/settings.js',
    'js/pages/serial-search.js',
    'js/pages/profile.js',
    'js/router.js',
    'js/app.js'
  ];

  function isScriptAlreadyLoaded(src) {
    const scripts = document.querySelectorAll('script[src]');
    for (const s of scripts) {
      const sSrc = s.getAttribute('src') || s.src;
      if (sSrc && sSrc.includes(src)) return true;
    }
    return false;
  }

  function loadScript(src) {
    return new Promise((resolve) => {
      if (isScriptAlreadyLoaded(src)) {
        return resolve(src);
      }
      const script = document.createElement('script');
      script.src = src + (src.includes('?') ? '&' : '?') + 'v=' + APP_VERSION;
      script.async = false;
      script.onload = () => resolve(src);
      script.onerror = () => {
        console.warn('Script failed to load: ' + src);
        resolve(src);
      };
      document.body.appendChild(script);
    });
  }

  for (const src of SCRIPTS) {
    if (!isScriptAlreadyLoaded(src)) {
      await loadScript(src);
    }
  }

  /* 2. Initialize Database & Backend */
  try {
    if(typeof window.bootMigration === 'function'){
      await window.bootMigration();
    }
    if(window.DB && typeof window.DB.loadAll === 'function'){
      await window.DB.loadAll();
      if(typeof window.startPageListeners === 'function'){
        window.startPageListeners(window.state?.currentPage || 'billing');
      } else if(typeof window.DB.watch === 'function'){
        window.DB.watch();
      }
    }
  } catch(e) {
    console.warn('DB load warning:', e);
  }

  /* 3. Initialize offline manager */
  if (window.Offline && typeof window.Offline.init === 'function') {
    window.Offline.init();
  }

  /* 4. Initialize application */
  if (typeof initApp === 'function') {
    initApp();
  }

  /* 5. Register PWA Service Worker for App Shell offline caching */
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => console.log('✅ Service Worker registered, scope:', reg.scope))
      .catch(err => console.log('SW registration notice:', err.message));
  }
})();
