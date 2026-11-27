/* SICOBA service worker
   - Aset lokal: stale-while-revalidate (cepat, tetap menarik versi terbaru di latar belakang)
   - Pustaka CDN (QR): cache-first agar QR tetap dibuat tanpa internet
   - API Apps Script: tidak pernah di-cache; antrian offline ditangani oleh masing-masing aplikasi
   Naikkan VERSI jika daftar ASET atau URL CDN berubah. */
const VERSI = 'sicoba-v1';
const ASET = [
  './', './index.html', './guru.html', './siswa.html', './mesin.html',
  './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png'
];
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js'
];
const CDN_HOST = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSI);
    // Satu per satu: kegagalan satu berkas tidak membatalkan instalasi.
    await Promise.allSettled([...ASET, ...CDN].map(u => c.add(new Request(u, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSI) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(VERSI);
      const cached = await c.match(req, { ignoreSearch: true });
      const jaringan = fetch(req).then(r => {
        if (r.ok) c.put(req, r.clone());
        return r;
      }).catch(() => null);
      if (cached) { e.waitUntil(jaringan); return cached; }
      const r = await jaringan;
      if (r) return r;
      if (req.mode === 'navigate') return (await c.match('./index.html')) || Response.error();
      return Response.error();
    })());
    return;
  }

  if (CDN_HOST.includes(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(VERSI);
      const cached = await c.match(req);
      if (cached) return cached;
      try {
        const r = await fetch(req);
        if (r.ok) c.put(req, r.clone());
        return r;
      } catch (err) { return Response.error(); }
    })());
  }
  // Host lain (termasuk script.google.com): langsung ke jaringan.
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const semua = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const buka = semua.find(c => c.url.includes('siswa.html')) || semua[0];
    if (buka) return buka.focus();
    return clients.openWindow('./siswa.html');
  })());
});
