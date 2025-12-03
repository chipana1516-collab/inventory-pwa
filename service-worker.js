const CACHE_NAME = 'inventory-pwa-v1';
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/src/main.jsx',
  '/src/index.css'
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evt) => {

  // ❌ NO interceptar WebSocket del HMR de Vite
  if (evt.request.url.includes('ws') || evt.request.url.includes('__vite')) {
    return;
  }

  // Solo GET
  if (evt.request.method !== 'GET') return;

  evt.respondWith(
    caches.match(evt.request).then((cached) => {
      if (cached) return cached;

      return fetch(evt.request)
        .then((response) => {
          // Evitar fallos: stream/opaque/invalid
          if (
            !response ||
            response.status !== 200 ||
            response.type !== 'basic' ||
            response.bodyUsed
          ) {
            return response;
          }

          const responseToCache = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(evt.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          if (evt.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    })
  );
});
