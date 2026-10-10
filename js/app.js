/**
 * LABUKU EVO — Aplikasi utama (SPA)
 * Login, beranda, pencarian, tema, PWA, tanpa koneksi.
 * Prinsip: navigasi tanpa memuat ulang, tampilan dari data lokal, server hanya untuk data.
 */
(function () {
  'use strict';

  const { panggil, urlTerisi, Simpan, KUNCI, GalatJaringan, GalatServer } = window.LabukuAPI;

  // ============================================================
  // UTILITAS
  // ============================================================
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  const esc = (t) => String(t === undefined || t === null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /** Inisial dua huruf dari nama aplikasi, mis. "AKAD TRACKER" → "AT", "SIMKAH" → "SI". */
  function inisial(nama) {
    const kata = String(nama || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
    if (kata.length === 0) return '?';
    if (kata.length === 1) return kata[0].slice(0, 2).toUpperCase();
    return (kata[0][0] + kata[1][0]).toUpperCase();
  }

  function hostDari(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  /** Hanya tautan https yang boleh dirender sebagai href. */
  function urlAman(url) {
    try { return new URL(url).protocol === 'https:'; } catch (e) { return false; }
  }

  const ikon = (nama, kelas) => `<svg class="i ${kelas || ''}" aria-hidden="true"><use href="#i-${nama}"/></svg>`;

  // ============================================================
  // STATE
  // ============================================================
  const S = {
    katalog: null,          // { aplikasi:[], kategori:[] }
    layar: null,            // layar aktif (login/main/config/loading)
    view: 'home',           // home | search | admin
    query: '',
    klikBerubah: false,
    terakhirSegar: 0,
    promptPasang: null,
    offline: false
  };

  // ============================================================
  // LAYAR & TAMPILAN
  // ============================================================
  function tampilLayar(id) {
    $$('.screen').forEach((el) => {
      if (el.id === 'scr-offline') return; // offline adalah lapisan tersendiri
      el.classList.toggle('active', el.id === 'scr-' + id);
    });
    S.layar = id;
  }

  function tampilView(view) {
    S.view = view;
    $('#view-home').hidden = view !== 'home';
    $('#view-search').hidden = view !== 'search';
    $('#view-admin').hidden = view !== 'admin';
  }

  // ---------- Tanpa koneksi (lapisan di atas layar mana pun) ----------
  function tampilOffline() {
    if (S.offline) return;
    S.offline = true;
    const el = $('#scr-offline');
    el.classList.add('active', 'overlay');
    $('#btn-retry').focus({ preventScroll: true });
  }

  async function cobaLagi() {
    if (!navigator.onLine) {
      const b = $('#btn-retry');
      b.classList.add('loading');
      setTimeout(() => b.classList.remove('loading'), 600);
      toast('Masih belum ada koneksi.', 'err');
      return;
    }
    S.offline = false;
    $('#scr-offline').classList.remove('active', 'overlay');
    if (S.layar === 'main') segarkanKatalog({ diam: true });
    else if (S.layar === 'loading') mulai();
  }

  // ============================================================
  // TOAST, MODAL, KONFIRMASI
  // ============================================================
  function toast(pesan, jenis, lama) {
    jenis = jenis || 'ok';
    const el = document.createElement('div');
    el.className = 'toast ' + jenis;
    el.setAttribute('role', jenis === 'err' ? 'alert' : 'status');
    el.innerHTML = ikon(jenis === 'err' ? 'alert' : 'check') + '<span>' + esc(pesan) + '</span>';
    const wadah = $('#toasts');
    wadah.appendChild(el);
    while (wadah.children.length > 3) wadah.firstElementChild.remove(); // paling banyak 3 sekaligus
    setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 250); }, lama || (jenis === 'err' ? 4500 : 2800));
  }

  let fokusSebelum = null;
  function bukaModal(el, fokus) {
    fokusSebelum = document.activeElement;
    el.hidden = false;
    document.body.style.overflow = 'hidden';
    // Fokus langsung (masih dalam ketukan pengguna) agar keyboard HP ikut terbuka
    const f = fokus || $('input, textarea, select, button:not([data-close])', el);
    if (f) f.focus({ preventScroll: true });
  }
  function tutupModal(el) {
    if (el.hidden) return;
    el.hidden = true;
    if (!$$('.modal, .drawer').some((m) => !m.hidden)) document.body.style.overflow = '';
    if (fokusSebelum && document.contains(fokusSebelum)) fokusSebelum.focus({ preventScroll: true });
    el.dispatchEvent(new CustomEvent('tutup'));
  }

  function konfirmasi(opsi) {
    const m = $('#modal-confirm');
    $('#confirm-title').textContent = opsi.judul || 'Yakin?';
    $('#confirm-msg').textContent = opsi.pesan || '';
    const ok = $('#confirm-ok');
    ok.textContent = opsi.tombol || 'Ya';
    ok.className = 'btn ' + (opsi.bahaya === false ? 'btn-primary' : 'btn-danger');
    return new Promise((selesai) => {
      let hasil = false;
      const klikOk = () => { hasil = true; tutupModal(m); };
      ok.addEventListener('click', klikOk, { once: true });
      m.addEventListener('tutup', () => { ok.removeEventListener('click', klikOk); selesai(hasil); }, { once: true });
      bukaModal(m, ok);
    });
  }

  function setLoading(btn, aktif, teks) {
    if (aktif) {
      btn.dataset.teks = btn.dataset.teks || btn.innerHTML;
      btn.disabled = true;
      btn.classList.add('loading');
      if (teks) btn.textContent = teks;
    } else {
      btn.disabled = false;
      btn.classList.remove('loading');
      if (btn.dataset.teks) { btn.innerHTML = btn.dataset.teks; delete btn.dataset.teks; }
    }
  }

  // ============================================================
  // TEMA
  // ============================================================
  function temaSekarang() { return document.documentElement.getAttribute('data-theme') || 'light'; }
  function terapkanTema(t) {
    document.documentElement.setAttribute('data-theme', t);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0E1524' : '#F6F8FB');
    $('#btn-theme').setAttribute('aria-label', t === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap');
  }
  function gantiTema() {
    const t = temaSekarang() === 'dark' ? 'light' : 'dark';
    Simpan.set(KUNCI.tema, t);
    terapkanTema(t);
  }

  // ============================================================
  // KATALOG: RENDER
  // ============================================================
  const katalog = () => S.katalog || { aplikasi: [], kategori: [] };

  function bacaKlik() { const k = Simpan.get(KUNCI.klik, {}); return (k && typeof k === 'object') ? k : {}; }

  function catatKlik(id) {
    const k = bacaKlik();
    k[id] = (Number(k[id]) || 0) + 1;
    Simpan.set(KUNCI.klik, k);
    S.klikBerubah = true; // diurutkan ulang saat pengguna kembali, agar kartu tidak melompat di bawah jari
  }

  /** 6 aplikasi teratas: klik terbanyak di perangkat ini, sisanya mengikuti urutan bawaan admin. */
  function seringDipakai() {
    const k = bacaKlik();
    return katalog().aplikasi.slice()
      .sort((a, b) => ((Number(k[b.id]) || 0) - (Number(k[a.id]) || 0)) || (a.urutan - b.urutan))
      .slice(0, 6);
  }

  function kartuHTML(a, opsi) {
    opsi = opsi || {};
    const href = urlAman(a.url) ? esc(a.url) : '#';
    const tag = opsi.pratinjau ? 'div' : 'a';
    const atribut = opsi.pratinjau ? '' : ` href="${href}" target="_blank" rel="noopener noreferrer" data-app="${esc(a.id)}"`;
    return `<${tag} class="card"${atribut}>
      <span class="avatar" aria-hidden="true">${esc(inisial(a.nama))}</span>
      <span class="card-body">
        <span class="card-title">${esc(a.nama || 'Nama aplikasi')}</span>
        <span class="card-desc">${esc(a.deskripsi || 'Deskripsi singkat aplikasi')}</span>
        <span class="card-meta">
          ${a.kategori ? `<span class="chip">${esc(a.kategori)}</span>` : '<span class="chip plain">Umum</span>'}
          <span class="host">${esc(hostDari(a.url))}</span>
        </span>
      </span>
      ${ikon('external', 'card-go')}
    </${tag}>`;
  }

  function ubinHTML(a) {
    const href = urlAman(a.url) ? esc(a.url) : '#';
    return `<a class="tile" href="${href}" target="_blank" rel="noopener noreferrer" data-app="${esc(a.id)}" title="${esc(a.deskripsi)}">
      <span class="avatar avatar-sm" aria-hidden="true">${esc(inisial(a.nama))}</span>
      <span class="tile-name">${esc(a.nama)}</span>
    </a>`;
  }

  const slug = (t) => 'bag-' + String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-');

  function bagianHTML(id, judul, ikonNama, daftar) {
    return `<section class="section" id="${id}" aria-labelledby="${id}-h">
      <div class="section-head">${ikon(ikonNama)}<h2 id="${id}-h">${esc(judul)}</h2><span class="count">${daftar.length}</span></div>
      <div class="grid grid-cards">${daftar.map((a) => kartuHTML(a)).join('')}</div>
    </section>`;
  }

  function renderBeranda() {
    const { aplikasi, kategori } = katalog();
    const wadah = $('#home-content');
    const jump = $('#jump');
    S.klikBerubah = false;

    if (aplikasi.length === 0) {
      jump.innerHTML = '';
      wadah.innerHTML = `<div class="section"><div class="empty">${ikon('grid')}
        <strong>Katalog masih kosong</strong>
        <span>Admin dapat menambahkan aplikasi lewat ikon gembok di kanan atas.</span></div></div>`;
      return;
    }

    const perKategori = kategori
      .map((k) => ({ k, daftar: aplikasi.filter((a) => a.kategori === k.nama) }))
      .filter((x) => x.daftar.length > 0);

    jump.innerHTML = [
      `<a class="chip-link" href="#bag-sering">${ikon('star', 'i-inline')}Sering Dipakai</a>`,
      `<a class="chip-link" href="#bag-umum">Umum <span class="n">${aplikasi.length}</span></a>`
    ].concat(perKategori.map((x) => `<a class="chip-link" href="#${slug(x.k.nama)}">${esc(x.k.nama)} <span class="n">${x.daftar.length}</span></a>`)).join('');

    const sering = seringDipakai();
    wadah.innerHTML =
      `<section class="section featured" id="bag-sering" aria-labelledby="bag-sering-h">
        <div class="section-head">${ikon('star')}<h2 id="bag-sering-h">Sering Dipakai</h2></div>
        <div class="grid grid-tiles">${sering.map(ubinHTML).join('')}</div>
      </section>` +
      bagianHTML('bag-umum', 'Umum', 'grid', aplikasi) +
      perKategori.map((x) => bagianHTML(slug(x.k.nama), x.k.nama, 'tag', x.daftar)).join('');
  }

  function renderSkeleton() {
    $('#jump').innerHTML = '';
    const kartu = '<div class="card is-skel"><span class="avatar"></span><span class="card-body"><span class="skel skel-line" style="width:60%"></span><span class="skel skel-line" style="width:92%"></span><span class="skel skel-line" style="width:40%"></span></span></div>';
    $('#home-content').innerHTML = `<section class="section featured"><div class="section-head"><span class="skel" style="width:140px;height:18px"></span></div>
      <div class="grid grid-tiles">${'<div class="tile"><span class="avatar avatar-sm skel"></span><span class="skel skel-line" style="flex:1"></span></div>'.repeat(6)}</div></section>
      <section class="section"><div class="section-head"><span class="skel" style="width:90px;height:18px"></span></div>
      <div class="grid grid-cards">${kartu.repeat(6)}</div></section>`;
  }

  // ---------- Pencarian (lokal, instan) ----------
  function cari(q) {
    const istilah = q.toLowerCase().split(/\s+/).filter(Boolean);
    return katalog().aplikasi.filter((a) => {
      const teks = (a.nama + ' ' + a.deskripsi).toLowerCase();
      return istilah.every((t) => teks.includes(t));
    });
  }

  function renderPencarian() {
    const q = S.query.trim();
    const hasil = cari(q);
    $('#search-title').textContent = hasil.length
      ? `${hasil.length} aplikasi untuk "${q}"`
      : `Hasil pencarian "${q}"`;
    $('#search-results').innerHTML = hasil.length
      ? hasil.map((a) => kartuHTML(a)).join('')
      : `<div class="empty">${ikon('search')}<strong>Aplikasi tidak ditemukan</strong><span>Coba kata lain, misalnya sebagian nama aplikasi.</span></div>`;
  }

  let tundaCari = null;
  function onCari(e) {
    S.query = e.target.value;
    $('#search-clear').hidden = !S.query;
    clearTimeout(tundaCari);
    tundaCari = setTimeout(() => {
      if (S.query.trim()) { tampilView('search'); renderPencarian(); }
      else { tampilView('home'); if (S.klikBerubah) renderBeranda(); }
    }, 80);
  }

  function hapusCari() {
    const inp = $('#search');
    inp.value = '';
    S.query = '';
    $('#search-clear').hidden = true;
    tampilView('home');
    if (S.klikBerubah) renderBeranda();
  }

  /** Dipanggil setiap katalog berubah (dari server atau dari perubahan admin). */
  function renderKatalog() {
    renderBeranda();
    if (S.view === 'search') renderPencarian();
    if (window.Admin) window.Admin.render();
  }

  function simpanKatalogLokal(k) {
    S.katalog = k;
    Simpan.set(KUNCI.katalog, k);
  }

  // ============================================================
  // DATA DARI SERVER
  // ============================================================
  async function segarkanKatalog(opsi) {
    opsi = opsi || {};
    try {
      const r = await panggil('katalog');
      if (!r.success) return tanganiGagal(r);
      S.terakhirSegar = Date.now();
      // Jangan timpa tampilan admin yang sedang menyimpan perubahan
      if (window.Admin && window.Admin.sibuk()) return;
      simpanKatalogLokal(r.katalog);
      renderKatalog();
    } catch (e) {
      if (e instanceof GalatJaringan) return tampilOffline();
      if (!S.katalog) {
        $('#config-title').textContent = 'Tidak dapat terhubung ke server';
        $('#config-msg').textContent = e.message;
        tampilLayar('config');
      } else if (!opsi.diam) {
        toast(e.message, 'err');
      }
    }
  }

  /** Menangani respons gagal yang berlaku umum. Mengembalikan true bila sudah ditangani. */
  function tanganiGagal(r) {
    if (r.code === 'SESI_TIDAK_SAH') { keluar({ pesan: r.message || 'Sesi berakhir. Silakan masuk lagi.' }); return true; }
    if (r.code === 'BELUM_SETUP') {
      $('#config-title').textContent = 'Server belum disiapkan';
      $('#config-msg').textContent = r.message;
      tampilLayar('config');
      return true;
    }
    if (r.code === 'ADMIN_KEDALUWARSA' && window.Admin) { window.Admin.habis(r.message); return true; }
    toast(r.message || 'Terjadi kesalahan.', 'err');
    return false;
  }

  // ============================================================
  // LOGIN & KELUAR
  // ============================================================
  function tampilLogin(pesan, jenis) {
    const alert = $('#login-alert');
    if (pesan) {
      alert.textContent = pesan;
      alert.className = 'alert' + (jenis === 'info' ? ' ok' : '');
      alert.hidden = false;
    } else {
      alert.hidden = true;
    }
    tampilLayar('login');
    setTimeout(() => $('#login-user').focus(), 50);
  }

  async function onLogin(e) {
    e.preventDefault();
    const user = $('#login-user').value.trim();
    const pass = $('#login-pass').value;
    const alert = $('#login-alert');
    if (!user || !pass) {
      alert.textContent = 'Username dan password wajib diisi.';
      alert.className = 'alert';
      alert.hidden = false;
      return;
    }
    const btn = $('#btn-login');
    setLoading(btn, true, 'Memeriksa…');
    alert.hidden = true;
    try {
      const r = await panggil('login', { username: user, password: pass });
      if (!r.success) {
        if (r.code === 'BELUM_SETUP') return tanganiGagal(r);
        alert.textContent = r.message || 'Gagal masuk.';
        alert.className = 'alert';
        alert.hidden = false;
        $('#login-pass').select();
        return;
      }
      Simpan.set(KUNCI.token, r.token);
      simpanKatalogLokal(r.katalog);
      S.terakhirSegar = Date.now();
      $('#form-login').reset();
      masukUtama();
      toast('Berhasil masuk.');
    } catch (err) {
      if (err instanceof GalatJaringan) { tampilOffline(); return; }
      alert.textContent = err.message;
      alert.className = 'alert';
      alert.hidden = false;
    } finally {
      setLoading(btn, false);
    }
  }

  function keluar(opsi) {
    opsi = opsi || {};
    Simpan.hapus(KUNCI.token);
    Simpan.hapus(KUNCI.katalog);
    if (window.Admin) window.Admin.reset();
    S.katalog = null;
    hapusCari();
    $$('.modal, .drawer').forEach((m) => { m.hidden = true; });
    document.body.style.overflow = '';
    tampilLogin(opsi.pesan, opsi.jenis);
  }

  async function onKeluar() {
    const ya = await konfirmasi({ judul: 'Keluar dari LABUKU EVO?', pesan: 'Anda perlu memasukkan username dan password lagi untuk masuk.', tombol: 'Keluar', bahaya: false });
    if (ya) keluar({ pesan: 'Anda sudah keluar.', jenis: 'info' });
  }

  function masukUtama() {
    tampilLayar('main');
    tampilView('home');
    if (S.katalog) renderKatalog(); else renderSkeleton();
    if (window.Admin) window.Admin.pulihkan();
    tawarkanPasangIOS();
  }

  // ============================================================
  // PWA: SERVICE WORKER & PASANG
  // ============================================================
  const diIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const terpasang = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  function siapkanPasang() {
    const btn = $('#btn-install');
    if (terpasang()) return;
    if (diIOS()) btn.hidden = false;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      S.promptPasang = e;
      btn.hidden = false;
    });
    window.addEventListener('appinstalled', () => {
      S.promptPasang = null;
      btn.hidden = true;
      toast('LABUKU EVO terpasang di perangkat ini.');
    });
    btn.addEventListener('click', async () => {
      if (S.promptPasang) {
        S.promptPasang.prompt();
        try { await S.promptPasang.userChoice; } catch (e) { /* abaikan */ }
        S.promptPasang = null;
        btn.hidden = true;
      } else if (diIOS()) {
        $('#sheet-ios').hidden = false;
      } else {
        toast('Gunakan menu browser → "Pasang aplikasi" / "Install app".', 'ok', 4500);
      }
    });
    $('#ios-close').addEventListener('click', () => {
      $('#sheet-ios').hidden = true;
      Simpan.set(KUNCI.iosTutup, true);
    });
  }

  function tawarkanPasangIOS() {
    if (diIOS() && !terpasang() && !Simpan.get(KUNCI.iosTutup, false)) {
      setTimeout(() => { if (S.layar === 'main') $('#sheet-ios').hidden = false; }, 1500);
    }
  }

  function daftarkanSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker gagal:', e));
    });
  }

  // ============================================================
  // PERISTIWA
  // ============================================================
  function pasangPeristiwa() {
    $('#form-login').addEventListener('submit', onLogin);
    $('#btn-retry').addEventListener('click', cobaLagi);
    $('#btn-theme').addEventListener('click', gantiTema);
    $('#btn-logout').addEventListener('click', onKeluar);
    $('#search').addEventListener('input', onCari);
    $('#search').addEventListener('keydown', (e) => { if (e.key === 'Escape') { hapusCari(); e.target.blur(); } });
    $('#search-clear').addEventListener('click', () => { hapusCari(); $('#search').focus(); });
    $('#brand').addEventListener('click', (e) => {
      e.preventDefault();
      hapusCari();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Lompat ke bagian tanpa mengubah alamat halaman
    $('#jump').addEventListener('click', (e) => {
      const a = e.target.closest('a.chip-link');
      if (!a) return;
      e.preventDefault();
      const target = document.getElementById(a.getAttribute('href').slice(1));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Catat klik kartu (klik biasa maupun klik tengah)
    const klik = (e) => {
      const a = e.target.closest('a[data-app]');
      if (!a) return;
      if (a.getAttribute('href') === '#') { e.preventDefault(); return; }
      if (e.type === 'auxclick' && e.button !== 1) return;
      catatKlik(a.dataset.app);
    };
    document.addEventListener('click', klik);
    document.addEventListener('auxclick', klik);

    // Tampilkan/sembunyikan password
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-toggle-pass]');
      if (!b) return;
      const inp = document.getElementById(b.dataset.togglePass);
      const lihat = inp.type === 'password';
      inp.type = lihat ? 'text' : 'password';
      b.innerHTML = ikon(lihat ? 'eye-off' : 'eye');
      b.setAttribute('aria-label', lihat ? 'Sembunyikan password' : 'Tampilkan password');
    });

    // Tutup modal: tombol/latar [data-close] dan tombol Escape
    document.addEventListener('click', (e) => {
      const c = e.target.closest('[data-close]');
      if (c) tutupModal(c.closest('.modal, .drawer'));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const terbuka = $$('.modal, .drawer').filter((m) => !m.hidden).pop();
      if (terbuka) tutupModal(terbuka);
    });

    // Kembali ke aplikasi: urutkan ulang "Sering Dipakai" dan segarkan data bila sudah lama
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || S.layar !== 'main') return;
      if (S.klikBerubah && S.view === 'home') renderBeranda();
      if (Date.now() - S.terakhirSegar > 5 * 60 * 1000) segarkanKatalog({ diam: true });
    });

    window.addEventListener('offline', () => { if (S.layar !== 'config') tampilOffline(); });
    window.addEventListener('online', () => { if (S.offline) cobaLagi(); });

    // Ikuti tema perangkat bila pengguna belum memilih
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!Simpan.get(KUNCI.tema, null)) terapkanTema(e.matches ? 'dark' : 'light');
    });
  }

  // ============================================================
  // MULAI
  // ============================================================
  async function mulai() {
    if (!urlTerisi()) { tampilLayar('config'); return; }
    if (!navigator.onLine) { tampilLayar('loading'); tampilOffline(); return; }
    const token = Simpan.get(KUNCI.token, null);
    if (!token) { tampilLogin(); return; }
    const tersimpan = Simpan.get(KUNCI.katalog, null);
    if (tersimpan && Array.isArray(tersimpan.aplikasi)) S.katalog = tersimpan; // tampil instan, lalu disegarkan
    masukUtama();
    await segarkanKatalog({ diam: !!S.katalog });
  }

  // Ekspos untuk admin.js
  window.App = {
    S, $, $$, esc, ikon, inisial, hostDari, urlAman, toast, konfirmasi, bukaModal, tutupModal, setLoading,
    kartuHTML, renderKatalog, simpanKatalogLokal, tanganiGagal, tampilOffline, tampilView, keluar, hapusCari
  };

  terapkanTema(temaSekarang());
  daftarkanSW();
  document.addEventListener('DOMContentLoaded', () => {
    pasangPeristiwa();
    siapkanPasang();
    mulai();
  });
})();
