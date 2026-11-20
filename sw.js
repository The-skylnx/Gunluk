const CACHE_NAME = 'gunluk-cache-v20';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json?v=19',
  './universiteler.js',
  './icons/icon-192.png?v=19',
  './icons/icon-512.png?v=19',
  './icons/icon-512-maskable.png?v=19',
  './icons/apple-touch-icon.png?v=19',
  './fonts/bricolage-grotesque-600-latin-ext.woff2',
  './fonts/bricolage-grotesque-600-latin.woff2',
  './fonts/bricolage-grotesque-700-latin-ext.woff2',
  './fonts/bricolage-grotesque-700-latin.woff2',
  './fonts/public-sans-400-latin-ext.woff2',
  './fonts/public-sans-400-latin.woff2',
  './fonts/public-sans-600-latin-ext.woff2',
  './fonts/public-sans-600-latin.woff2',
  './fonts/times.ttf'
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

// Mobil & Masaüstü Bildirim Tıklama Yönetimi (Android Chrome & iOS PWA)
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('push', event => {
  let payload = { title: 'Gelişim Günlüğü', body: 'Bugünkü çalışma ve alışkanlıklarını kontrol et!' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (_) {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      vibrate: [200, 100, 200],
      renotify: true,
      tag: payload.tag || 'gunluk-push',
      data: { url: './' }
    })
  );
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
