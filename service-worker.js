/* =========================================================
   service-worker.js - PWA Offline App Shell Cache
   ========================================================= */

const CACHE_NAME = 'autoparts-pos-v2.2.0';

const APP_SHELL = [
  './',
  'index.html',
  'partials/login.html',
  'partials/sidebar.html',
  'partials/topbar.html',
  'partials/overlays.html',
  'css/base.css',
  'css/components.css',
  'css/checkout.css',
  'css/grn.css',
  'css/pos.css',
  'css/dashboard.css',
  'css/shift.css',
  'css/returns.css',
  'css/print-thermal.css',
  'css/profile.css',
  'css/shops.css',
  'css/lock.css',
  'css/permissions.css',
  'css/autoparts.css',
  'css/offline.css',
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
  'js/app.js',
  'js/loader.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for(const url of APP_SHELL){
        try {
          await cache.add(url);
        } catch(err){
          console.warn('SW cache add skipped for:', url, err.message);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle GET requests and http/https schemes
  if(req.method !== 'GET' || !req.url.startsWith('http')) return;

  // Exclude real-time Firebase, Firestore, Google Cloud APIs
  if(req.url.includes('firestore') || 
     req.url.includes('googleapis') ||
     req.url.includes('firebase') ||
     req.url.includes('gstatic')){
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cachedResponse => {
      if(cachedResponse) {
        return cachedResponse;
      }

      return fetch(req).then(networkResponse => {
        // Cache valid 200 GET responses
        if(networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic'){
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(req, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback for navigation requests when completely offline
        if(req.destination === 'document' || req.mode === 'navigate'){
          return caches.match('index.html') || caches.match('./');
        }
      });
    })
  );
});
