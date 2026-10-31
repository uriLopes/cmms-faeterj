const CACHE_NAME = 'cmms-operador-v27';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Sempre busca da rede para ter a versão mais recente e usa cache apenas offline
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
