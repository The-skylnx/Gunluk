const CACHE_NAME = 'gunluk-cache-v9';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './universiteler.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './fonts/bricolage-grotesque-600-latin-ext.woff2',
  './fonts/bricolage-grotesque-600-latin.woff2',
  './fonts/bricolage-grotesque-700-latin-ext.woff2',
  './fonts/bricolage-grotesque-700-latin.woff2',
  './fonts/public-sans-400-latin-ext.woff2',
  './fonts/public-sans-400-latin.woff2',
  './fonts/public-sans-600-latin-ext.woff2',
  './fonts/public-sans-600-latin.woff2',
  './fonts/caveat-400-latin-ext.woff2',
  './fonts/caveat-400-latin.woff2'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(PRECACHE_URLS.map(u => cache.add(u)))
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('gunluk-cache-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // YÖK Atlas proxy (workers.dev) isteklerini asla önbelleğe alma
  if (url.hostname.endsWith('workers.dev')) {
    event.respondWith(fetch(req));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // HTML sayfaları: ağ öncelikli, çevrimdışıysa önbellekten dön
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then(m => m || caches.match('./index.html')))
    );
    return;
  }

  // Statik varlıklar (universiteler.js, manifest.json, ikonlar): önbellek + arka plan güncelleme
  event.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
