# Panduan Instalasi LABUKU EVO

LABUKU EVO terdiri atas dua bagian yang dipasang terpisah:

| Bagian | Isi | Dipasang di |
| --- | --- | --- |
| Backend | `Kode.gs` (file terpisah, tidak ada di ZIP) | Google Apps Script milik akun Kepala KUA |
| Frontend | Isi ZIP ini: `index.html`, `css/`, `js/`, `icons/`, `img/`, `sw.js`, `manifest.webmanifest` | GitHub Pages |

Urutannya wajib: **backend dulu**, karena frontend membutuhkan alamat (URL) backend.

Perkiraan waktu: 30–45 menit.

---

## Bagian A — Memasang backend (Google Apps Script)

### A1. Buat proyek Apps Script

1. Buka **https://script.google.com** dengan akun Google yang akan menjadi pemilik data (akun Kepala KUA).
2. Klik **Proyek baru**. Ganti judul "Proyek tanpa judul" menjadi `LABUKU EVO API`.
3. Hapus seluruh isi file `Kode.gs` bawaan, lalu tempel **seluruh** isi file `Kode.gs` dari paket ini.
4. Klik ikon **Simpan** (atau Ctrl+S).

### A2. Isi kredensial awal

Di bagian atas `Kode.gs`, cari blok ini dan isi ketiga nilainya:

```javascript
const KREDENSIAL_AWAL = {
  USERNAME: 'kuasawoo',     // username bersama untuk semua ASN
  PASSWORD: 'IsiPasswordKuat2026',   // minimal 8 karakter
  PIN: '482913'             // PIN admin: tepat 6 angka, hanya untuk Kepala KUA
};
```

Simpan lagi.

### A3. Jalankan setup (sekali saja)

1. Di bilah atas editor, pilih fungsi **`setupAppEnvironment`** pada menu tarik-turun, lalu klik **Jalankan**.
2. Muncul permintaan izin → **Tinjau izin** → pilih akun Anda.
3. Bila muncul "Google belum memverifikasi aplikasi ini": klik **Lanjutan** → **Buka LABUKU EVO API (tidak aman)** → **Izinkan**.
   Ini normal untuk skrip buatan sendiri; skrip hanya mengakses spreadsheet yang dibuatnya sendiri.
4. Lihat **Log eksekusi** di bawah. Setup berhasil bila muncul `Setup selesai.` dan alamat spreadsheet.
5. Buka Google Drive: spreadsheet **LABUKU EVO — Database Katalog** sudah ada, berisi sheet `Aplikasi`, `Kategori` (sudah berisi Penghulu, Penyuluh, Pelaksana), `Log PIN`, dan `AppConfig`.

> ⚠️ Jangan menjalankan `setupAppEnvironment` dua kali. Kalau dijalankan lagi, skrip akan menolak dengan pesan "Setup sudah pernah dijalankan".

### A4. Kosongkan lagi kredensial di kode

Kembalikan ketiga nilai menjadi kosong, lalu **Simpan**:

```javascript
const KREDENSIAL_AWAL = {
  USERNAME: '',
  PASSWORD: '',
  PIN: ''
};
```

Password dan PIN sudah tersimpan dalam bentuk acak (hash) di **Setelan proyek (Project Settings) → Properti skrip (Script Properties)**. Teks aslinya tidak disimpan di mana pun, jadi **catat password dan PIN Anda di tempat yang aman**.

### A5. Deploy sebagai Web app

1. Klik **Terapkan (Deploy)** → **Deployment baru (New deployment)**.
2. Klik ikon roda gigi di samping "Pilih jenis" → **Aplikasi web**.
3. Isi:
   - **Deskripsi:** `v1`
   - **Jalankan sebagai (Execute as):** **Saya (Me)**
   - **Yang memiliki akses (Who has access):** **Siapa saja (Anyone)**. Jangan pilih "Siapa saja yang memiliki Akun Google".
4. Klik **Terapkan**, lalu **salin URL Aplikasi web**. Bentuknya:
   `https://script.google.com/macros/s/AKfycb.../exec`

**Uji:** buka URL itu di tab baru. Harus tampil:

```json
{"success":true,"app":"LABUKU EVO","status":"ok"}
```

Ini aman: alamat ini tidak pernah mengirim daftar aplikasi tanpa token login.

---

## Bagian B — Memasang frontend (GitHub Pages)

### B1. Siapkan folder

1. Ekstrak ZIP. Hasilnya folder **`labuku-evo`** yang langsung berisi `index.html`, `css`, `js`, `icons`, `img`, dan seterusnya.
2. **Folder `labuku-evo` inilah yang nanti di-`git init`.** Jangan naik satu tingkat ke atasnya, dan jangan masuk ke subfolder mana pun.

### B2. Isi alamat backend

Buka `js/config.js` dengan editor teks (Notepad / VS Code), ganti alamat contoh dengan URL dari langkah A5:

```javascript
window.LABUKU_CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
  VERSI: '1.0.0'
};
```

Simpan. Ini satu-satunya file yang wajib diubah.

### B3. (Opsional) Ganti logo

Logo saat ini adalah logo sementara. Untuk memakai logo resmi:

| File | Ukuran |
| --- | --- |
| `img/logo.svg` | logo di header, login, dan ikon tab browser |
| `icons/icon-192.png` | 192 × 192 px |
| `icons/icon-512.png` | 512 × 512 px |
| `icons/icon-maskable-512.png` | 512 × 512 px, logo di tengah dalam 60% area, latar penuh |
| `icons/apple-touch-icon.png` | 180 × 180 px, latar penuh (untuk iPhone) |

Nama file harus tetap sama.

### B4. Buat repository baru di GitHub

Di github.com: **+** → **New repository** → nama misalnya `labuku-evo` → **Public** → jangan centang README/.gitignore/license → **Create repository**.

> Repository publik aman: tidak ada password, PIN, atau data katalog di file frontend. Data hanya keluar dari Apps Script kepada pengguna yang sudah login.

### B5. Push dari folder `labuku-evo`

Buka PowerShell **di dalam folder `labuku-evo`** (di File Explorer: klik address bar → ketik `powershell` → Enter), lalu pastikan isinya benar:

```powershell
dir
```

Yang harus terlihat di daftar: `index.html`, `sw.js`, `manifest.webmanifest`, serta folder `css`, `js`, `icons`, `img`. Kalau yang terlihat malah satu folder `labuku-evo`, ketik `cd labuku-evo` dulu.

Lalu jalankan satu per satu (ganti `USERNAME`):

```powershell
git init
git add .
git commit -m "Rilis pertama LABUKU EVO"
git branch -M main
git remote add origin https://github.com/USERNAME/labuku-evo.git
git push -u origin main
```

Saat diminta password, gunakan **Personal Access Token** GitHub, bukan password akun. Saat token ditempel, layar memang tidak menampilkan apa pun; itu normal.

### B6. Aktifkan GitHub Pages

Repository → **Settings** → **Pages**:

| Kolom | Nilai |
| --- | --- |
| Source | Deploy from a branch |
| Branch | `main` · `/ (root)` |
| Enforce HTTPS | ✅ dicentang (wajib; PWA tidak bisa dipasang tanpa HTTPS) |

Klik **Save**, tunggu 1–2 menit, lalu buka alamat yang muncul:
`https://USERNAME.github.io/labuku-evo/`

---

## Bagian C — Uji sebelum dibagikan

- [ ] Halaman login tampil. Password salah ditolak dengan pesan "Username atau password salah".
- [ ] Login dengan username dan password dari langkah A2 berhasil.
- [ ] Ikon gembok → PIN salah ditolak setelah sekitar 3 detik, dan waktunya tercatat di sheet `Log PIN`.
- [ ] PIN benar membuka Menu Admin.
- [ ] Tambah satu aplikasi → muncul di bagian **Umum**; bila diberi kategori, muncul juga di bagian kategorinya; baris baru muncul di sheet `Aplikasi`.
- [ ] Kartu aplikasi terbuka di tab baru.
- [ ] Mode pesawat di HP → tampil ilustrasi "Tidak ada koneksi".
- [ ] Mode gelap terbaca jelas.
- [ ] Aplikasi bisa dipasang: di Chrome/Edge laptop lewat ikon pasang di address bar atau tombol unduh di header; di Android lewat tombol unduh di header atau menu ⋮ → **Instal aplikasi**.

---

## Bagian D — Mengisi katalog

1. Login → ikon **gembok** di kanan atas → masukkan PIN.
2. Tab **Aplikasi** → **Tambah aplikasi**. Isi nama, deskripsi singkat (maks. 120 karakter), kategori peran (boleh kosong), dan tautan yang diawali `https://`.
3. Urutan di daftar admin menjadi urutan bawaan katalog, dan juga urutan awal "Sering Dipakai" sebelum ada klik. Atur dengan tombol ▲▼.
4. Tab **Kategori** untuk menambah, mengganti nama, mengurutkan, atau menghapus kategori. Kategori yang masih dipakai tidak bisa dihapus.
5. Mode admin otomatis berakhir setelah 15 menit tanpa aktivitas, atau saat Anda menekan **Keluar admin**.

Data juga boleh diedit langsung di spreadsheet. Perubahan langsung itu tampil di aplikasi pada permintaan berikutnya, karena ada trigger yang menghapus simpanan sementara (cache) setiap kali spreadsheet diedit.

---

## Bagian E — Membagikan ke ASN

Kirim tiga hal: **alamat** (`https://USERNAME.github.io/labuku-evo/`), **username**, dan **password**. PIN tidak dibagikan.

Cara memasang seperti aplikasi:

| Perangkat | Langkah |
| --- | --- |
| Android (Chrome) | Buka alamat → tombol unduh di header, atau menu ⋮ → **Instal aplikasi** |
| iPhone / iPad | Buka di **Safari** → tombol **Bagikan** → **Tambahkan ke Layar Utama** → **Tambah** |
| Laptop (Chrome / Edge) | Ikon pasang di ujung kanan address bar, atau tombol unduh di header |

---

## Bagian F — Prosedur rutin & darurat

### Ada ASN mutasi, atau password diduga bocor

1. Login → gembok → PIN → tab **Password**.
2. Isi password baru dua kali → **Simpan password baru** → konfirmasi.
3. Semua perangkat otomatis keluar, termasuk perangkat Anda.
4. Login dengan password baru, lalu bagikan hanya kepada ASN yang masih bertugas.

### Lupa PIN atau lupa password

Hanya bisa dilakukan oleh pemilik proyek Apps Script:

1. Buka proyek `LABUKU EVO API`, isi lagi blok `KREDENSIAL_AWAL` dengan username, password, dan PIN baru, lalu simpan.
2. Pilih fungsi **`resetKredensial`** → **Jalankan**.
3. Kosongkan lagi blok `KREDENSIAL_AWAL` dan simpan. Semua perangkat akan keluar.

### Muncul "Terlalu banyak PIN salah"

Setelah 20 PIN salah dalam satu jam (dari siapa pun), semua percobaan PIN ditolak sampai jam berikutnya. Untuk membukanya lebih cepat, jalankan fungsi **`bukaKunciPin`** dari editor Apps Script. Lalu periksa sheet `Log PIN`: banyak catatan dalam waktu singkat berarti ada yang mencoba menebak PIN, dan sebaiknya password bersama segera diganti.

---

## Bagian G — Memperbarui aplikasi

**Frontend** (setelah mengubah file di folder `labuku-evo`):

```powershell
git add .
git commit -m "Deskripsi perubahan"
git push
```

Bila Anda menambah atau mengganti nama file, naikkan juga `VERSI` di `sw.js` (mis. `labuku-evo-v1.0.1`) agar perangkat pengguna memuat versi baru.

**Backend** (setelah mengubah `Kode.gs`):
**Terapkan** → **Kelola deployment** → ikon pensil → **Versi: Versi baru** → **Terapkan**.

> ⚠️ Jangan memakai "Deployment baru" untuk pembaruan. Itu membuat URL baru, sehingga `js/config.js` harus diganti dan frontend harus di-push ulang.

---

## Pemecahan masalah

| Gejala | Penyebab | Solusi |
| --- | --- | --- |
| "Pengaturan belum lengkap" | `GAS_URL` di `js/config.js` belum diisi | Isi, lalu `git add . && git commit -m "isi GAS_URL" && git push` |
| "Respons server tidak valid" | Akses deployment bukan "Siapa saja", atau URL salah/bukan `/exec` | Periksa langkah A5; uji URL di browser |
| "Server belum disiapkan" | `setupAppEnvironment` belum dijalankan | Lakukan langkah A3 |
| Login selalu ditolak padahal benar | Kredensial disimpan dengan nilai lain | Jalankan `resetKredensial` (Bagian F) |
| Perubahan `Kode.gs` tidak berpengaruh | Deployment belum diperbarui | Kelola deployment → Versi baru (Bagian G) |
| Halaman GitHub Pages 404 | `index.html` tidak di root repository | Pastikan push dilakukan dari dalam folder `labuku-evo` |
| Tampilan tanpa gaya (CSS hilang) | Struktur folder rusak (file diunggah lewat web GitHub) | Push ulang dari terminal; jangan memakai "Upload files" |
| Tombol pasang tidak muncul | Bukan HTTPS, atau aplikasi sudah terpasang | Centang Enforce HTTPS; cek layar utama/menu aplikasi |
| Perangkat masih memuat versi lama | Simpanan browser | Ctrl+Shift+R, atau tutup lalu buka lagi aplikasinya |

---

## Catatan keamanan (risiko yang sudah diputuskan)

- **Satu akun bersama.** Sistem tidak bisa mencabut akses satu orang saja dan tidak tahu siapa yang memakai. Pengendaliannya adalah ganti password setiap ada mutasi.
- **Sesi tidak kedaluwarsa.** Perangkat yang hilang tetap bisa masuk sampai password diganti.
- **Admin adalah siapa pun yang tahu PIN.** Jaga PIN; pembatasan 3 detik per PIN salah, maksimal 20 salah per jam, dan Log PIN membantu mendeteksi tebakan.
- **Tautan terlihat oleh semua pemegang password.** Setiap aplikasi tujuan wajib memiliki login sendiri.
- Password dan PIN disimpan sebagai hash di Properti skrip, bukan di spreadsheet. Spreadsheet aman dibuka admin tanpa membocorkan keduanya.
