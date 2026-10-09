/* =========================================================
   js/loader.js - Dynamic Script Loader
   ========================================================= */

(async function boot() {
  /* 1. Scripts to load in strict dependency sequence */
  const SCRIPTS = [
    'js/security.js',
    'js/firebase.js',
    'js/seed.js',
    'js/db-service.js',
    'js/config.js',
    'js/helpers.js',
    'js/shift.js',
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
    'js/auth.js',
    'js/router.js',
    'js/app.js'
  ];

  function loadScript(src) {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = src;
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
    await loadScript(src);
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

  /* 3. Initialize application */
  if (typeof initApp === 'function') {
    initApp();
  }
})();
