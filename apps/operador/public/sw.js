const CACHE_NAME = 'cmms-operador-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through de rede com fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});