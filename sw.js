// Pocket Theatre – service worker
// Új kiadásnál elég a VERSION-t átírni (pl. 'v0.7').
const VERSION = 'v0.6';
const CACHE = 'pocket-theatre-' + VERSION;
const RUNTIME = 'pocket-theatre-cdn';

const CORE = [
  './',
  './index.html',
  './terkep.html',
  './manifest.json',
  './icon.png'
];

// Külső CDN-ek, amiket érdemes offline is megtartani
const CDN_HOSTS = [
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// Telepítés: alapfájlok letöltése (egy hiányzó fájl nem rontja el az egészet)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(
        CORE.map(url =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      ))
      .then(() => self.skipWaiting())
  );
});

// Aktiválás: régi gyorsítótárak törlése, irányítás átvétele
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE && k !== RUNTIME)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Saját oldal fájljai
  if (url.origin === self.location.origin) {
    const isPage =
      req.mode === 'navigate' ||
      url.pathname.endsWith('/') ||
      url.pathname.endsWith('.html');

    if (isPage) {
      event.respondWith(networkFirst(req, url));
    } else {
      event.respondWith(staleWhileRevalidate(event, req, CACHE));
    }
    return;
  }

  // CDN fájlok (Three.js, ikonok, betűk)
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(event, req, RUNTIME));
    return;
  }

  // Minden más (pl. MA Web Remote IP-n) – nem nyúlunk hozzá
});

// HTML: először hálózat, offline esetén a tárolt példány
async function networkFirst(req, url) {
  const cache = await caches.open(CACHE);
  const key = url.origin + url.pathname; // ?v=2 és hasonlók nélkül
  try {
    let res = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
    res = await cleanRedirect(res);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch (e) {
    const hit =
      (await cache.match(key)) ||
      (await cache.match(req, { ignoreSearch: true })) ||
      (req.mode === 'navigate' ? await cache.match('./index.html') : null);
    return hit || Response.error();
  }
}

// Egyéb fájlok: azonnal a tárolt, háttérben frissítés
async function staleWhileRevalidate(event, req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req)
    .then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  if (hit) {
    event.waitUntil(net);
    return hit;
  }
  return (await net) || Response.error();
}

// Safari nem fogad el átirányított választ oldalbetöltésnél – ezt kijavítjuk
async function cleanRedirect(res) {
  if (!res.redirected) return res;
  const body = await res.blob();
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers
  });
}
