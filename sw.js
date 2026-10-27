/* ============================================
   Biblia de Jerusalén - Service Worker
   ============================================ */

const CACHE_NAME = 'biblia-jerusalen-v2';
const CACHE_URLS = [
  './',
  'index.html',
  'manifest.json',
  'css/main.css',
  'js/db.js',
  'js/app.js',
  'data/manifest.json',
  'data/books.json',
  'data/dividers.json',
  'data/dictionary.json',
  'data/dictionary-index.json',
  'data/verses/01-gnesis.json',
  'data/verses/02-exodo.json',
  'data/verses/03-levtico.json',
  'data/verses/04-nmeros.json',
  'data/verses/05-deuteronomio.json',
  'data/verses/06-josu.json',
  'data/verses/07-jueces.json',
  'data/verses/08-rut.json',
  'data/verses/09-1-samuel.json',
  'data/verses/10-2-samuel.json',
  'data/verses/11-1-reyes.json',
  'data/verses/12-2-reyes.json',
  'data/verses/13-1-crnicas.json',
  'data/verses/14-2-crnicas.json',
  'data/verses/15-esdras.json',
  'data/verses/16-nehemas.json',
  'data/verses/17-tobas.json',
  'data/verses/18-judit.json',
  'data/verses/19-ester.json',
  'data/verses/20-job.json',
  'data/verses/21-salmos.json',
  'data/verses/22-1-macabeos.json',
  'data/verses/23-2-macabeos.json',
  'data/verses/24-proverbios.json',
  'data/verses/25-eclesiasts-qohelet.json',
  'data/verses/26-cantar.json',
  'data/verses/27-sabidura.json',
  'data/verses/28-sircides-eclesistico.json',
  'data/verses/29-isaas.json',
  'data/verses/30-jeremas.json',
  'data/verses/31-lamentaciones.json',
  'data/verses/32-baruc.json',
  'data/verses/33-ezequiel.json',
  'data/verses/34-daniel.json',
  'data/verses/35-oseas.json',
  'data/verses/36-joel.json',
  'data/verses/37-ams.json',
  'data/verses/38-abdas.json',
  'data/verses/39-jons.json',
  'data/verses/40-miqueas.json',
  'data/verses/41-nahn.json',
  'data/verses/42-habacuc.json',
  'data/verses/43-sofonas.json',
  'data/verses/44-ageo.json',
  'data/verses/45-zacaras.json',
  'data/verses/46-malaquas.json',
  'data/verses/47-san-mateo.json',
  'data/verses/48-san-marcos.json',
  'data/verses/49-san-lucas.json',
  'data/verses/50-san-juan.json',
  'data/verses/51-hechos.json',
  'data/verses/52-romanos.json',
  'data/verses/53-i-corintios.json',
  'data/verses/54-ii-corintios.json',
  'data/verses/55-glatas.json',
  'data/verses/56-efesios.json',
  'data/verses/57-filipenses.json',
  'data/verses/58-colosenses.json',
  'data/verses/59-i-tesalonicenses.json',
  'data/verses/60-ii-tesalonicenses.json',
  'data/verses/61-i-timoteo.json',
  'data/verses/62-ii-timoteo.json',
  'data/verses/63-tito.json',
  'data/verses/64-filemon.json',
  'data/verses/65-hebreos.json',
  'data/verses/66-santiago.json',
  'data/verses/67-i-pedro.json',
  'data/verses/68-ii-pedro.json',
  'data/verses/69-i-juan.json',
  'data/verses/70-ii-juan.json',
  'data/verses/71-iii-juan.json',
  'data/verses/72-judas.json',
  'data/verses/73-apocalipsis.json',
];


// Install: precache all files
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Caching ' + CACHE_URLS.length + ' files');
      return cache.addAll(CACHE_URLS).catch(function(err) {
        console.error('[SW] Cache addAll error:', err);
        // Try adding files one by one
        return Promise.allSettled(
          CACHE_URLS.map(function(url) {
            return cache.add(url).catch(function(e) {
              console.warn('[SW] Failed to cache:', url, e);
            });
          })
        );
      });
    }).then(function() {
      console.log('[SW] Install complete');
      return self.skipWaiting();
    })
  );
});

// Activate: clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(name) {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch: cache-first strategy
self.addEventListener('fetch', function(event) {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip non-http(s) requests (e.g., chrome-extension://)
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      if (cachedResponse) {
        // Return cached response immediately
        return cachedResponse;
      }

      // Not in cache - fetch from network and cache
      return fetch(event.request).then(function(networkResponse) {
        // Don't cache non-successful responses
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Cache the new response
        var responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(function(err) {
        console.warn('[SW] Fetch failed:', event.request.url, err);
        // If it's a navigation request, return the cached index.html
        if (event.request.mode === 'navigate') {
          return caches.match('index.html');
        }
        // For other requests, just fail
        throw err;
      });
    })
  );
});
