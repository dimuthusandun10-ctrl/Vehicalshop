/* =========================================================
   service-worker.js - PWA Offline App Shell & Runtime Cache
   ========================================================= */

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = 'autoparts-pos-' + CACHE_VERSION;
const RUNTIME_CACHE = 'autoparts-runtime-' + CACHE_VERSION;

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',

  // Partials
  '/partials/login.html',
  '/partials/sidebar.html',
  '/partials/topbar.html',
  '/partials/overlays.html',

  // CSS
  '/css/base.css',
  '/css/components.css',
  '/css/checkout.css',
  '/css/grn.css',
  '/css/pos.css',
  '/css/dashboard.css',
  '/css/shift.css',
  '/css/returns.css',
  '/css/print-thermal.css',
  '/css/profile.css',
  '/css/shops.css',
  '/css/lock.css',
  '/css/permissions.css',
  '/css/autoparts.css',
  '/css/offline.css',
  '/css/pwa.css',

  // JS Core
  '/js/bcrypt.min.js',
  '/js/config.js',
  '/js/helpers.js',
  '/js/security.js',
  '/js/offline.js',
  '/js/firebase.js',
  '/js/seed.js',
  '/js/db-service.js',
  '/js/shift.js',
  '/js/auth.js',
  '/js/router.js',
  '/js/app.js',
  '/js/loader.js',

  // JS Pages
  '/js/pages/credit.js',
  '/js/pages/dashboard.js',
  '/js/pages/billing.js',
  '/js/pages/pos.js',
  '/js/pages/inventory.js',
  '/js/pages/customers.js',
  '/js/pages/lowstock.js',
  '/js/pages/grn.js',
  '/js/pages/returns.js',
  '/js/pages/shifts.js',
  '/js/pages/reports.js',
  '/js/pages/shops.js',
  '/js/pages/settings.js',
  '/js/pages/serial-search.js',
  '/js/pages/profile.js',

  // Icons
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-180x180.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/shortcut-billing.png',
  '/icons/shortcut-inventory.png',

  // Fonts
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap'
];

// ============ INSTALL ============
self.addEventListener('install', event => {
  console.log('📦 Service Worker: installing cache', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log('📦 Caching app shell assets');
      for (const url of APP_SHELL) {
        try {
          await cache.add(new Request(url, { credentials: 'same-origin' }));
        } catch (err) {
          // Attempt relative path fallback if absolute root fails
          try {
            const relUrl = url.startsWith('/') ? url.slice(1) : url;
            await cache.add(relUrl);
          } catch (e2) {
            console.warn('Cache item skipped:', url, err.message);
          }
        }
      }
    }).then(() => {
      console.log('✅ App shell cached');
      return self.skipWaiting();
    })
  );
});

// ============ ACTIVATE ============
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: activating...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== RUNTIME_CACHE)
          .map(key => {
            console.log('🗑️ Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ============ FETCH ============
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests and cloud backends
  if (req.method !== 'GET' ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('firestore') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('google-analytics') ||
      url.hostname.includes('googletagmanager')) {
    return;
  }

  // Network-first for HTML document navigation (always get fresh version if online)
  if (req.destination === 'document' || req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(req, { ignoreSearch: true })
            .then(cached => cached || caches.match('/index.html') || caches.match('index.html') || caches.match('/'));
        })
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;

      return fetch(req).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(RUNTIME_CACHE).then(cache => cache.put(req, clone));
        return response;
      }).catch(err => {
        console.warn('Fetch failed for:', req.url, err.message);
      });
    })
  );
});

// ============ MESSAGE (for skipWaiting) ============
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
