/**
 * LABUKU EVO — Lapisan komunikasi & penyimpanan lokal
 * Semua permintaan ke Apps Script lewat fetch() POST text/plain (tanpa preflight CORS).
 */
(function () {
  'use strict';

  // ---------- Penyimpanan lokal yang aman (bisa gagal di mode privat) ----------
  const Simpan = {
    get(kunci, cadangan) {
      try {
        const v = localStorage.getItem(kunci);
        return v === null ? cadangan : JSON.parse(v);
      } catch (e) { return cadangan; }
    },
    set(kunci, nilai) {
      try { localStorage.setItem(kunci, JSON.stringify(nilai)); } catch (e) { /* abaikan */ }
    },
    hapus(kunci) {
      try { localStorage.removeItem(kunci); } catch (e) { /* abaikan */ }
    },
    sesiGet(kunci) {
      try { const v = sessionStorage.getItem(kunci); return v === null ? null : JSON.parse(v); } catch (e) { return null; }
    },
    sesiSet(kunci, nilai) {
      try { sessionStorage.setItem(kunci, JSON.stringify(nilai)); } catch (e) { /* abaikan */ }
    },
    sesiHapus(kunci) {
      try { sessionStorage.removeItem(kunci); } catch (e) { /* abaikan */ }
    }
  };

  const KUNCI = {
    token: 'labuku_token',
    katalog: 'labuku_katalog',
    klik: 'labuku_klik',
    tema: 'labuku_tema',
    iosTutup: 'labuku_ios_tutup',
    admin: 'labuku_admin'      // sessionStorage: hilang saat tab/aplikasi ditutup
  };

  // ---------- Galat khusus ----------
  class GalatJaringan extends Error {
    constructor(pesan) { super(pesan || 'Tidak ada koneksi.'); this.name = 'GalatJaringan'; }
  }
  class GalatServer extends Error {
    constructor(pesan) { super(pesan); this.name = 'GalatServer'; }
  }

  const URL_GAS = (window.LABUKU_CONFIG && window.LABUKU_CONFIG.GAS_URL) || '';

  function urlTerisi() {
    return /^https:\/\/script\.google(usercontent)?\.com\/.+/.test(URL_GAS) && URL_GAS.indexOf('GANTI_DENGAN') === -1
      || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_GAS); // untuk pengujian lokal
  }

  /**
   * Panggil aksi di server. Mengembalikan objek JSON dari server
   * ({ success, ... } atau { success:false, code, message }).
   * Melempar GalatJaringan bila tidak ada koneksi, GalatServer bila respons rusak.
   */
  async function panggil(action, data, opsi) {
    opsi = opsi || {};
    if (!navigator.onLine) throw new GalatJaringan();
    const ctrl = new AbortController();
    const batas = setTimeout(() => ctrl.abort(), opsi.timeout || 45000);
    let res;
    try {
      res = await fetch(URL_GAS, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: action, token: Simpan.get(KUNCI.token, null), data: data || {} }),
        redirect: 'follow',
        cache: 'no-store',
        signal: ctrl.signal
      });
    } catch (e) {
      clearTimeout(batas);
      if (e.name === 'AbortError') throw new GalatServer('Server terlalu lama merespons. Coba lagi.');
      throw new GalatJaringan();
    }
    clearTimeout(batas);
    let json;
    try {
      json = await res.json();
    } catch (e) {
      throw new GalatServer('Respons server tidak valid. Periksa GAS_URL dan pastikan deployment diatur "Anyone".');
    }
    if (!json || typeof json.success !== 'boolean') throw new GalatServer('Respons server tidak dikenali.');
    return json;
  }

  window.LabukuAPI = { panggil, urlTerisi, Simpan, KUNCI, GalatJaringan, GalatServer };
})();
