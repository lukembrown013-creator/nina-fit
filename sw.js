// Offline support. The app shell is cached on first visit, served from cache
// instantly afterwards, and refreshed in the background when online.
const CACHE = 'ninafit-v2';
const ASSETS = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/ui.js', 'js/util.js', 'js/store.js', 'js/calc.js', 'js/exercises.js',
  'js/home.js', 'js/train.js', 'js/workout.js', 'js/food.js', 'js/progress.js', 'js/settings.js',
  'js/sync.js', 'js/scan.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  // The login/sync/food API always needs a live network round-trip, never a cached reply —
  // sync.js and scan.js already handle the offline case themselves.
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req)
        .then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => hit || cache.match('index.html'));
      return hit || net;
    })
  );
});
