/**
 * LABUKU EVO — Service worker
 * - Menyimpan tampilan aplikasi (HTML/CSS/JS/ikon) agar terbuka cepat dan
 *   layar "Tidak ada koneksi" tetap tampil saat offline.
 * - TIDAK menyimpan data katalog dari server (permintaan ke Apps Script tidak disentuh).
 * Naikkan VERSI setiap kali mengubah daftar file di bawah.
 */
const VERSI = 'labuku-evo-v1.0.0';
const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/config.js',
  'js/api.js',
  'js/app.js',
  'js/admin.js',
  'manifest.webmanifest',
  'img/logo.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];
const FONT_CACHE = 'labuku-font-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSI).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSI && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Utamakan jaringan (agar pembaruan langsung terlihat); bila gagal/lebih dari 4 detik, pakai simpanan. */
function jaringanDulu(req) {
  return new Promise((selesai) => {
    let beres = false;
    const pakaiCache = () => caches.match(req, { ignoreSearch: true })
      .then((r) => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined))
      .then((r) => { if (r && !beres) { beres = true; selesai(r); } return r; });
    const batas = setTimeout(pakaiCache, 4000);
    fetch(req).then((res) => {
      clearTimeout(batas);
      if (res && res.ok) {
        const salin = res.clone();
        caches.open(VERSI).then((c) => c.put(req, salin));
      }
      if (!beres) { beres = true; selesai(res); }
    }).catch(() => {
      clearTimeout(batas);
      pakaiCache().then((r) => { if (!beres) { beres = true; selesai(r || Response.error()); } });
    });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // POST ke Apps Script tidak disentuh
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(jaringanDulu(req));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    // Huruf: pakai simpanan bila ada, sambil diperbarui
    e.respondWith(caches.open(FONT_CACHE).then((c) => c.match(req).then((hit) => {
      const ambil = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || ambil;
    })));
  }
});
