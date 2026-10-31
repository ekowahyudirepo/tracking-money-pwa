// Service worker: aplikasi bisa dibuka offline.
// Strategi: ambil versi terbaru dari jaringan (maks. 4 detik); jika offline atau lambat,
// pakai salinan di cache. Dengan begitu pembaruan langsung terlihat saat online.
const CACHE = 'keuanganku-v4';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'config.js',
  'vendor/supabase.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];
const NETWORK_TIMEOUT = 4000;

self.addEventListener('install', (event) => {
  // cache: 'reload' = jangan pakai salinan HTTP cache yang mungkin sudah usang
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' }))))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const fromNetwork = fetch(req.url, { cache: 'no-cache' }).then((res) => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  });
  try {
    return await Promise.race([
      fromNetwork,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT))
    ]);
  } catch (e) {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    return fromNetwork; // belum ada salinan: tunggu jaringan
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(req));
});
