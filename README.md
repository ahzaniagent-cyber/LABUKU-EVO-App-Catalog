# LABUKU EVO

Katalog aplikasi tertutup untuk ASN KUA Sawoo, dikembangkan oleh **Ahzani Labs**. Satu pintu login untuk menemukan dan membuka aplikasi internal maupun kedinasan di tab baru. Bisa dipasang seperti aplikasi di HP dan laptop (PWA).

> Cara memasang: lihat **[PANDUAN-INSTALASI.md](PANDUAN-INSTALASI.md)**.

## Arsitektur

```
GitHub Pages (file ini)          Google Apps Script (Kode.gs, terpisah)      Google Sheets
tampilan saja, tanpa data  ⇄    periksa login & PIN, kirim katalog,   ⇄    Aplikasi · Kategori
fetch POST text/plain            simpan perubahan admin                     Log PIN · AppConfig
```

- Repository ini **tidak berisi data maupun rahasia**. Daftar aplikasi hanya dikirim Apps Script kepada pemegang token login yang sah.
- Password dan PIN disimpan sebagai hash di Properti skrip Apps Script.

## Struktur

```
index.html              satu halaman (SPA): login, katalog, admin, offline
manifest.webmanifest    pengaturan PWA
sw.js                   service worker (menyimpan tampilan, bukan data)
css/style.css           gaya, mode terang & gelap
js/config.js            ← ISI GAS_URL di sini
js/api.js               komunikasi ke Apps Script & penyimpanan lokal
js/app.js               login, beranda, pencarian, tema, pemasangan PWA
js/admin.js             menu admin (PIN, aplikasi, kategori, password, PIN)
img/logo.svg            logo (sementara, boleh diganti)
icons/                  ikon PWA
```

## Prinsip kecepatan

- **SPA:** semua layar dimuat sekali; berpindah layar tanpa memuat ulang.
- **Tampil dari data lokal:** katalog terakhir ditampilkan seketika saat aplikasi dibuka, lalu disegarkan di latar belakang. Pencarian dan "Sering Dipakai" dihitung di perangkat.
- **Optimistic UI di menu admin:** perubahan tampil seketika, disimpan berurutan di latar belakang, dan dikembalikan bila server menolak.
- **Cache server:** Apps Script menyimpan katalog di CacheService dan menghapusnya setiap ada perubahan.
- **Tulis sekaligus:** setiap perubahan ditulis ke Sheets dengan satu operasi `setValues`.

© Ahzani Labs · LABUKU EVO v1.0
