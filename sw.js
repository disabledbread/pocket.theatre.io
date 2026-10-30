const CACHE_NAME = 'work-app-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
  './terkep.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
