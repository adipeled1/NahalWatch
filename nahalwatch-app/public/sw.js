// NahalWatch service worker — makes the app usable with weak/no reception in the field.
// Pages & data: network-first (fresh when online, cached copy when offline).
// Static assets & map tiles: cache-first.
// Bump VERSION when the caching rules change: activate deletes every cache from older versions.
const VERSION = 'nw-v2';
const PAGES = `${VERSION}-pages`;
const STATIC = `${VERSION}-static`;
const TILES = `${VERSION}-tiles`;
const PRECACHE = ['/', '/updates', '/streams', '/models', '/about', '/data/meta.json', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    // Offline page fallback for navigations only. A data request (JSON) must fail as a network error,
    // not get the home page's HTML (which the app would try to parse as JSON).
    if (req.mode === 'navigate') return (await caches.match('/')) || Response.error();
    return Response.error();
  }
}

/** Keeps a cache to at most `limit` entries, dropping the oldest first. */
async function trim(cache, limit) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - limit; i++) await cache.delete(keys[i]);
}

async function cacheFirst(req, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') {
    cache.put(req, res.clone()).then(() => limit && trim(cache, limit));
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.hostname === 'tile.openstreetmap.org' || url.hostname === 'server.arcgisonline.com') return e.respondWith(cacheFirst(request, TILES, 600));
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    // Hashed build files: every deploy adds new ones, so keep only the most recent 300.
    return e.respondWith(cacheFirst(request, STATIC, 300));
  }
  if (request.mode === 'navigate' || url.pathname.startsWith('/data/')) {
    return e.respondWith(networkFirst(request, PAGES));
  }
});
