// Pocket Theatre – service worker
// Új kiadásnál elég a VERSION-t átírni (pl. 'v0.7').
const VERSION = 'v1.4';
const CACHE = 'pocket-theatre-' + VERSION;
const RUNTIME = 'pocket-theatre-cdn';

const CORE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './terkep.enc.json',
  './nagyszinpad.enc.json',
  './tiri.enc.json',
  './vilagitas.enc.json',
  './manifest.json',
  './icon.png',
  './icon-192.png'
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
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('/style.css') ||
      url.pathname.endsWith('/app.js') ||
      url.pathname.endsWith('.enc.json');

    const isShell = url.pathname.endsWith('/style.css') || url.pathname.endsWith('/app.js');

    if (req.mode === 'navigate') {
      event.respondWith(pageFirst(req, url));
    } else if (isShell && Date.now() < cachedUntil) {
      event.respondWith(cachedShell(req, url));
    } else if (isPage) {
      event.respondWith(networkFirst(req, url));
    } else {
      event.respondWith(staleWhileRevalidate(event, req, CACHE));
    }
    return;
  }

  // Műsorlista (külön repóból): mindig a friss, offline az utoljára letöltött
  if (url.hostname === 'raw.githubusercontent.com' && url.pathname.endsWith('/musorlista.json')) {
    event.respondWith(networkFirst(req, url));
    return;
  }

  // CDN fájlok (Three.js, ikonok, betűk)
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(event, req, RUNTIME));
    return;
  }

  // Minden más (pl. MA Web Remote IP-n) – nem nyúlunk hozzá
});

// CSS, JS és a titkosított adatok: először hálózat, offline esetén a tárolt példány, így ezek mindig együtt frissülnek
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

// Oldalbetöltés: először hálózat, de gyenge térerőn nem várunk a végtelenségig.
// Ha PAGE_TIMEOUT alatt nem jön meg az oldal (vagy nincs net), a tárolt példány nyílik meg,
// és a hozzá tartozó CSS és JS is a tárból jön, hogy a három fájl ugyanabból a kiadásból legyen.
const PAGE_TIMEOUT = 3000;
let cachedUntil = 0;

async function pageFirst(req, url) {
  const cache = await caches.open(CACHE);
  const key = url.origin + url.pathname;
  const hit = (await cache.match(key)) || (await cache.match(req, { ignoreSearch: true }));
  // nincs tárolt példány: marad a sima hálózat-először
  if (!hit) return networkFirst(req, url);

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), PAGE_TIMEOUT);
  try {
    const net = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin', signal: ctl.signal });
    // a teljes letöltést megvárjuk, hogy az időkorlát arra is vonatkozzon (és Safarin se legyen átirányított válasz)
    const body = await net.blob();
    clearTimeout(timer);
    const make = () => new Response(body, { status: net.status, statusText: net.statusText, headers: net.headers });
    if (net.ok) cache.put(key, make());
    cachedUntil = 0;
    return make();
  } catch (e) {
    clearTimeout(timer);
    cachedUntil = Date.now() + 15000;
    return hit;
  }
}

// A tárolt oldalhoz tartozó CSS és JS: a tárból, hálózat csak akkor, ha hiányzik
async function cachedShell(req, url) {
  const cache = await caches.open(CACHE);
  const hit = (await cache.match(url.origin + url.pathname)) || (await cache.match(req, { ignoreSearch: true }));
  return hit || networkFirst(req, url);
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
