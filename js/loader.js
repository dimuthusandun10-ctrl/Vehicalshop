/* =========================================================
   js/loader.js - High Performance Script Loader & Page Code Splitter
   ========================================================= */

(function initLoader() {
  const APP_VERSION = '2.4.3';
  const _loadedScripts = new Set();
  const _pendingPromises = new Map();

  // Page-specific modules (loaded on demand)
  const PAGE_SCRIPTS = {
    billing: ['js/pages/billing.js', 'js/pages/pos.js', 'js/pages/credit.js'],
    pos: ['js/pages/pos.js', 'js/pages/billing.js', 'js/pages/credit.js'],
    credit: ['js/pages/credit.js', 'js/pages/billing.js'],
    dashboard: ['js/pages/dashboard.js'],
    inventory: ['js/pages/inventory.js'],
    customers: ['js/pages/customers.js'],
    lowstock: ['js/pages/lowstock.js'],
    grn: ['js/pages/grn.js'],
    returns: ['js/pages/returns.js'],
    shifts: ['js/pages/shifts.js'],
    reports: ['js/pages/reports.js'],
    shops: ['js/pages/shops.js'],
    settings: ['js/pages/settings.js'],
    'serial-search': ['js/pages/serial-search.js'],
    profile: ['js/pages/profile.js']
  };

  function isScriptAlreadyLoaded(src) {
    if (_loadedScripts.has(src)) return true;
    const cleanSrc = src.split('?')[0];
    const scripts = document.querySelectorAll('script[src]');
    for (const s of scripts) {
      const sSrc = s.getAttribute('src') || s.src;
      if (sSrc && sSrc.split('?')[0].includes(cleanSrc)) {
        _loadedScripts.add(src);
        return true;
      }
    }
    return false;
  }

  function loadScript(src) {
    if (isScriptAlreadyLoaded(src)) return Promise.resolve(src);
    if (_pendingPromises.has(src)) return _pendingPromises.get(src);

    const promise = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = src + (src.includes('?') ? '&' : '?') + 'v=' + APP_VERSION;
      script.async = true;
      script.onload = () => {
        _loadedScripts.add(src);
        _pendingPromises.delete(src);
        resolve(src);
      };
      script.onerror = () => {
        console.warn('Script failed to load: ' + src);
        _pendingPromises.delete(src);
        resolve(src);
      };
      document.body.appendChild(script);
    });

    _pendingPromises.set(src, promise);
    return promise;
  }

  // Globally accessible for router and auth
  window.loadScript = loadScript;
  window.loadPageModule = async function(page) {
    const list = PAGE_SCRIPTS[page] || [];
    if (!list.length) return true;
    await Promise.all(list.map(src => loadScript(src)));
    return true;
  };

  function preloadAllPages() {
    const all = Object.values(PAGE_SCRIPTS).flat();
    const unique = [...new Set(all)];
    unique.forEach(src => {
      if (!isScriptAlreadyLoaded(src)) {
        loadScript(src);
      }
    });
  }

  window.preloadAllPages = preloadAllPages;

  async function boot() {
    /* 1. Initialize Database & Local Storage */
    try {
      if (typeof window.bootMigration === 'function') {
        await window.bootMigration();
      }
      if (window.DB && typeof window.DB.loadAll === 'function') {
        await window.DB.loadAll();
        // Start listeners only if a user is already active
        if (window.state?.user && typeof window.startPageListeners === 'function') {
          window.startPageListeners(window.state?.currentPage || 'billing');
        }
      }
    } catch(e) {
      console.warn('DB load notice:', e);
    }

    /* 2. Initialize offline manager */
    if (window.Offline && typeof window.Offline.init === 'function') {
      window.Offline.init();
    }

    /* 3. Initialize application */
    if (typeof initApp === 'function') {
      initApp();
    }

    /* 4. Hide boot loader screen smoothly */
    const bootLoader = document.getElementById('bootLoader');
    if (bootLoader) {
      bootLoader.classList.add('hidden');
      setTimeout(() => {
        if (bootLoader.parentNode) bootLoader.parentNode.removeChild(bootLoader);
      }, 400);
    }

    /* 5. Preload page scripts in background idle time */
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => preloadAllPages(), { timeout: 3500 });
    } else {
      setTimeout(preloadAllPages, 2000);
    }

    /* 6. Register PWA Service Worker for offline app shell */
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('service-worker.js')
        .then(reg => console.log('✅ Service Worker registered, scope:', reg.scope))
        .catch(err => console.log('SW registration notice:', err.message));
    }

    /* 7. Development Mode & Database Audit Tool */
    const isDev = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' || 
                  window.location.search.includes('audit') || 
                  window.location.search.includes('dev');
    if (isDev) {
      loadScript('js/database-audit.js');
    }
  }

  // On-demand loader stub for database audit
  if (typeof window.runDatabaseAudit !== 'function') {
    window.runDatabaseAudit = async function() {
      await loadScript('js/database-audit.js');
      if (typeof window.runDatabaseAudit === 'function') {
        return window.runDatabaseAudit();
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
