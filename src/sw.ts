/// <reference lib="webworker" />
// Service worker. Kept free of imports so it builds to a single classic script.
// The build replaces __PRECACHE__ and __VERSION__ (see vite.config.ts).

declare const self: ServiceWorkerGlobalScope;
declare const __PRECACHE__: string[];
declare const __VERSION__: string;

const SHELL = `ade-shell-${__VERSION__}`;
const DATA = 'ade-data';
const TILES = 'ade-tiles';
const STATIC = 'ade-static';
const IMAGES = 'ade-images';
const KEEP = [SHELL, DATA, TILES, STATIC, IMAGES];

/** ≈150 MB at ~50 kB per vector tile. */
const MAX_TILES = 3000;
const MAX_IMAGES = 250;
/** Amsterdam, a little wider than the map's pan limits. */
const BBOX = { west: 4.6, south: 52.2, east: 5.15, north: 52.5 };

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      // `reload` bypasses the HTTP cache (GitHub Pages: max-age=600), so the precache never
      // stores a stale index.html that points at assets from the previous deploy.
      await cache.addAll(__PRECACHE__.map((url) => new Request(url, { cache: 'reload' })));
      // Seed the data cache too so the very first offline launch works.
      const data = await caches.open(DATA);
      for (const url of [
        'data/ade-2026.core.json',
        'data/ade-2026.text.json',
        'data/ade-2026.meta.json',
        'data/basemap.json',
      ]) {
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          if (res.ok) await data.put(url, res);
        } catch {
          /* offline install — the network-first handler will fill it later */
        }
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (!KEEP.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

function tileInBbox(z: number, x: number, y: number): boolean {
  const n = 2 ** z;
  const lon = (x / n) * 360 - 180;
  const lon2 = ((x + 1) / n) * 360 - 180;
  const lat = (t: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * t) / n))) * 180) / Math.PI;
  const north = lat(y);
  const south = lat(y + 1);
  return lon2 >= BBOX.west && lon <= BBOX.east && north >= BBOX.south && south <= BBOX.north;
}

async function trim(cacheName: string, max: number) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function staleWhileRevalidate(event: FetchEvent, cacheName: string, max?: number): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(event.request, { ignoreVary: true });
  const network = fetch(event.request)
    .then(async (res) => {
      if (res.ok || res.type === 'opaque') {
        await cache.put(event.request, res.clone());
        if (max) await trim(cacheName, max);
      }
      return res;
    })
    .catch(() => undefined);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return (await network) ?? Response.error();
}

/** Network first (with a timeout for flaky connections), cache as fallback. */
async function networkFirst(request: Request, cacheName: string, key: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  try {
    const res = await Promise.race([
      fetch(request, { cache: 'no-cache' }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
    if (res.ok) await cache.put(key, res.clone());
    return res;
  } catch {
    return (await cache.match(key, { ignoreVary: true })) ?? Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const scope = new URL(self.registration.scope);

  if (url.origin === scope.origin) {
    const path = url.pathname.slice(scope.pathname.length);
    if (path.startsWith('data/')) {
      event.respondWith(networkFirst(req, DATA, path));
      return;
    }
    if (req.mode === 'navigate') {
      // Always revalidate the page (cheap 304 when unchanged): a stale index.html from the
      // HTTP cache would reference assets that no longer exist after a deploy.
      event.respondWith(
        fetch(req, { cache: 'no-cache' }).catch(
          async () => (await caches.match('index.html', { ignoreVary: true })) ?? Response.error(),
        ),
      );
      return;
    }
    event.respondWith(
      (async () => (await caches.match(req, { ignoreSearch: true, ignoreVary: true })) ?? fetch(req))(),
    );
    return;
  }

  if (url.hostname === 'tiles.openfreemap.org') {
    const m = /\/(\d+)\/(\d+)\/(\d+)\.(pbf|png|mvt)$/.exec(url.pathname);
    if (m) {
      if (tileInBbox(+m[1], +m[2], +m[3])) event.respondWith(staleWhileRevalidate(event, TILES, MAX_TILES));
      return;
    }
    // Styles, TileJSON, glyphs and sprites.
    event.respondWith(staleWhileRevalidate(event, STATIC));
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(event, STATIC));
    return;
  }

  if (url.hostname === 'cdn.amsterdam-dance-event.nl' && req.destination === 'image') {
    event.respondWith(staleWhileRevalidate(event, IMAGES, MAX_IMAGES));
  }
});
