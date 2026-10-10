/**
 * LABUKU EVO — Menu admin
 * Masuk dengan PIN (diperiksa server), kelola aplikasi & kategori, ganti password & PIN.
 * Perubahan tampil seketika (optimistic UI) lalu disimpan ke server di latar belakang,
 * berurutan lewat antrean. Bila server menolak, tampilan dikembalikan ke data terakhir yang sah.
 */
(function () {
  'use strict';

  const { panggil, Simpan, KUNCI, GalatJaringan } = window.LabukuAPI;
  const App = window.App;
  const { $, $$, esc, ikon, inisial, hostDari, toast, konfirmasi, bukaModal, tutupModal, setLoading } = App;

  const MENIT_ADMIN = 15;
  const BATAS = { nama: 60, deskripsi: 120, kategori: 40, password: 8 };
  const POLA_URL = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(:\d+)?([\/?#][^\s<>"']*)?$/i;

  const A = {
    token: null,
    tokenSejak: 0,       // kapan token admin terakhir diterbitkan server
    terakhir: 0,         // aktivitas terakhir pengguna
    timer: null,
    antrian: Promise.resolve(),
    tertunda: 0,
    server: null,        // katalog terakhir yang dikonfirmasi server
    tab: 'aplikasi',
    edit: null,          // id aplikasi yang sedang diubah (null = tambah)
    tundaUrut: null,
    tundaUrutKat: null,
    setelahPin: null,    // apa yang dilakukan setelah PIN benar
    syncTimer: null
  };

  const salin = (o) => JSON.parse(JSON.stringify(o));
  const idBaru = (awalan) => awalan + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const katalog = () => App.S.katalog || { aplikasi: [], kategori: [] };

  // ============================================================
  // SESI ADMIN
  // ============================================================
  function aktif() { return !!A.token; }

  function simpanSesi() {
    Simpan.sesiSet(KUNCI.admin, { token: A.token, tokenSejak: A.tokenSejak, terakhir: A.terakhir });
  }

  function setGembok(on) {
    const b = $('#btn-lock');
    b.classList.toggle('active', on);
    b.classList.toggle('icon-btn-quiet', !on);
    b.innerHTML = ikon(on ? 'unlock' : 'lock');
    b.setAttribute('aria-label', on ? 'Buka menu admin (mode admin aktif)' : 'Menu admin');
    b.title = on ? 'Menu admin (aktif)' : 'Menu admin';
  }

  function mulaiAdmin(token) {
    A.token = token;
    A.tokenSejak = Date.now();
    A.terakhir = Date.now();
    simpanSesi();
    setGembok(true);
    clearInterval(A.timer);
    A.timer = setInterval(cekDiam, 20000);
  }

  function cekDiam() {
    if (!aktif()) return;
    if (Date.now() - A.terakhir > MENIT_ADMIN * 60 * 1000) {
      keluarAdmin('Mode admin berakhir karena ' + MENIT_ADMIN + ' menit tidak aktif.');
    }
  }

  let simpanAktivitasTerakhir = 0;
  function catatAktivitas() {
    if (!aktif()) return;
    A.terakhir = Date.now();
    if (A.terakhir - simpanAktivitasTerakhir > 10000) { simpanAktivitasTerakhir = A.terakhir; simpanSesi(); }
    // Selama admin aktif, perpanjang token server tiap 5 menit agar tidak habis di tengah pekerjaan
    if (A.terakhir - A.tokenSejak > 5 * 60 * 1000 && A.tertunda === 0) {
      A.tokenSejak = A.terakhir;
      panggil('cekAdmin', { adminToken: A.token }).then((r) => {
        if (r.success && r.adminToken) { A.token = r.adminToken; A.tokenSejak = Date.now(); simpanSesi(); }
        else if (r.code === 'ADMIN_KEDALUWARSA') habis(r.message);
        else if (r.code === 'SESI_TIDAK_SAH') App.tanganiGagal(r);
      }).catch(() => { /* coba lagi pada aktivitas berikutnya */ });
    }
  }

  /** Dipanggil saat halaman dimuat: lanjutkan mode admin bila masih dalam 15 menit. */
  function pulihkan() {
    const s = Simpan.sesiGet(KUNCI.admin);
    if (s && s.token && Date.now() - (s.terakhir || 0) < MENIT_ADMIN * 60 * 1000) {
      mulaiAdmin(s.token);
      A.tokenSejak = s.tokenSejak || 0;
      A.terakhir = s.terakhir;
    } else {
      Simpan.sesiHapus(KUNCI.admin);
    }
  }

  function reset() {
    A.token = null;
    A.server = null;
    A.setelahPin = null;
    clearInterval(A.timer);
    clearTimeout(A.tundaUrut);
    clearTimeout(A.tundaUrutKat);
    Simpan.sesiHapus(KUNCI.admin);
    setGembok(false);
    if (App.S.view === 'admin') App.tampilView('home');
  }

  function keluarAdmin(pesan) {
    reset();
    tutupModal($('#drawer-app'));
    toast(pesan || 'Mode admin selesai.');
  }

  /** Server menyatakan token admin habis: minta PIN lagi tanpa membuang pekerjaan di layar. */
  function habis(pesan) {
    A.token = null;
    clearInterval(A.timer);
    Simpan.sesiHapus(KUNCI.admin);
    setGembok(false);
    bukaPin(pesan || 'Mode admin berakhir. Masukkan PIN lagi.', () => {});
  }

  // ============================================================
  // PIN
  // ============================================================
  function klikGembok() {
    if (aktif()) bukaAdmin();
    else bukaPin(null, bukaAdmin);
  }

  function bukaPin(pesanInfo, setelah) {
    A.setelahPin = setelah || bukaAdmin;
    const inp = $('#pin-input');
    inp.value = '';
    gambarTitik();
    const msg = $('#pin-msg');
    msg.textContent = pesanInfo || '';
    msg.className = 'pin-msg' + (pesanInfo ? ' info' : '');
    setLoading($('#btn-pin'), false);
    const modal = $('#modal-pin');
    modal.addEventListener('tutup', () => {
      // PIN dibatalkan saat token admin sudah tidak ada → tinggalkan tampilan admin
      if (!aktif() && App.S.view === 'admin') { tutupModal($('#drawer-app')); App.tampilView('home'); }
    }, { once: true });
    bukaModal(modal, inp);
  }

  function gambarTitik() {
    const n = $('#pin-input').value.length;
    $$('.pin-dots i').forEach((el, i) => { el.classList.toggle('on', i < n); el.classList.toggle('next', i === n); });
  }

  async function kirimPin(e) {
    if (e) e.preventDefault();
    const inp = $('#pin-input');
    const msg = $('#pin-msg');
    const pin = inp.value;
    if (!/^\d{6}$/.test(pin)) { msg.textContent = 'PIN harus 6 angka.'; msg.className = 'pin-msg'; inp.focus(); return; }
    const btn = $('#btn-pin');
    if (btn.disabled) return;
    setLoading(btn, true, 'Memeriksa…');
    inp.disabled = true;
    msg.textContent = 'Memeriksa PIN…';
    msg.className = 'pin-msg info';
    try {
      const r = await panggil('masukAdmin', { pin });
      if (r.success) {
        mulaiAdmin(r.adminToken);
        const lanjut = A.setelahPin;
        A.setelahPin = null;
        tutupModal($('#modal-pin'));
        toast('Mode admin aktif.');
        if (lanjut) lanjut();
        return;
      }
      if (r.code === 'SESI_TIDAK_SAH') { App.tanganiGagal(r); return; }
      msg.textContent = r.message || 'PIN salah.';
      msg.className = 'pin-msg';
      if (r.code === 'PIN_SALAH') {
        const dots = $('.pin-dots');
        dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake');
      }
      inp.value = '';
      gambarTitik();
    } catch (err) {
      if (err instanceof GalatJaringan) { tutupModal($('#modal-pin')); App.tampilOffline(); return; }
      msg.textContent = err.message;
      msg.className = 'pin-msg';
    } finally {
      setLoading(btn, false);
      inp.disabled = false;
      if (!$('#modal-pin').hidden) inp.focus();
    }
  }

  // ============================================================
  // TAMPILAN ADMIN
  // ============================================================
  function bukaAdmin() {
    App.hapusCari();
    if (A.tertunda === 0) A.server = salin(katalog());
    App.tampilView('admin');
    pilihTab(A.tab);
    render();
    window.scrollTo({ top: 0 });
  }

  function pilihTab(tab) {
    A.tab = tab;
    $$('.tab').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.tab-panel').forEach((p) => {
      const on = p.id === 'tab-' + tab;
      p.hidden = !on;
      p.classList.toggle('active', on);
    });
  }

  function render() {
    if (App.S.view !== 'admin') return;
    renderAplikasi();
    renderKategori();
  }

  function renderAplikasi() {
    const { aplikasi } = katalog();
    $('#admin-app-count').textContent = aplikasi.length
      ? aplikasi.length + ' aplikasi · urutan di sini menjadi urutan bawaan katalog'
      : '';
    const list = $('#admin-app-list');
    if (aplikasi.length === 0) {
      list.innerHTML = `<div class="empty" style="border:0">${ikon('grid')}<strong>Belum ada aplikasi</strong><span>Klik <b>Tambah aplikasi</b> untuk mengisi katalog.</span></div>`;
      return;
    }
    list.innerHTML = aplikasi.map((a, i) => `
      <div class="admin-row" data-id="${esc(a.id)}">
        <span class="row-num">${i + 1}</span>
        <span class="avatar avatar-sm" aria-hidden="true">${esc(inisial(a.nama))}</span>
        <span class="row-main">
          <span class="row-title">${esc(a.nama)}</span>
          <span class="row-sub">${esc(a.deskripsi)} · ${esc(hostDari(a.url))}</span>
        </span>
        <span class="row-cat">${a.kategori ? `<span class="chip">${esc(a.kategori)}</span>` : '<span class="chip plain">Hanya Umum</span>'}</span>
        <span class="row-actions">
          <button type="button" class="icon-btn icon-btn-sm" data-act="up" aria-label="Naikkan ${esc(a.nama)}" ${i === 0 ? 'disabled' : ''}>${ikon('up')}</button>
          <button type="button" class="icon-btn icon-btn-sm" data-act="down" aria-label="Turunkan ${esc(a.nama)}" ${i === aplikasi.length - 1 ? 'disabled' : ''}>${ikon('down')}</button>
          <button type="button" class="icon-btn icon-btn-sm" data-act="edit" aria-label="Ubah ${esc(a.nama)}">${ikon('pencil')}</button>
          <button type="button" class="icon-btn icon-btn-sm danger" data-act="hapus" aria-label="Hapus ${esc(a.nama)}">${ikon('trash')}</button>
        </span>
      </div>`).join('');
  }

  function renderKategori() {
    const { aplikasi, kategori } = katalog();
    const list = $('#admin-kat-list');
    if (kategori.length === 0) {
      list.innerHTML = `<div class="empty" style="border:0">${ikon('tag')}<strong>Belum ada kategori peran</strong><span>Semua aplikasi tetap tampil di Umum.</span></div>`;
      return;
    }
    list.innerHTML = kategori.map((k, i) => {
      const n = aplikasi.filter((a) => a.kategori === k.nama).length;
      return `<div class="admin-row kat-row" data-id="${esc(k.id)}">
        <span class="row-num">${i + 1}</span>
        <span class="row-main">
          <span class="row-title">${esc(k.nama)}</span>
          <span class="row-sub">${n} aplikasi</span>
        </span>
        <span></span>
        <span class="row-actions">
          <button type="button" class="icon-btn icon-btn-sm" data-act="up" aria-label="Naikkan ${esc(k.nama)}" ${i === 0 ? 'disabled' : ''}>${ikon('up')}</button>
          <button type="button" class="icon-btn icon-btn-sm" data-act="down" aria-label="Turunkan ${esc(k.nama)}" ${i === kategori.length - 1 ? 'disabled' : ''}>${ikon('down')}</button>
          <button type="button" class="icon-btn icon-btn-sm" data-act="rename" aria-label="Ganti nama ${esc(k.nama)}">${ikon('pencil')}</button>
          <button type="button" class="icon-btn icon-btn-sm danger" data-act="hapus" aria-label="Hapus ${esc(k.nama)}" ${n ? 'title="Masih dipakai aplikasi"' : ''}>${ikon('trash')}</button>
        </span>
      </div>`;
    }).join('');
  }

  function kilat(listSel, id, act) {
    const row = $(listSel + ' [data-id="' + CSS.escape(id) + '"]');
    if (!row) return;
    row.classList.add('flash');
    if (act) {
      const b = $('[data-act="' + act + '"]', row);
      const alt = $('[data-act="' + (act === 'up' ? 'down' : 'up') + '"]', row);
      (b && !b.disabled ? b : alt).focus({ preventScroll: true });
    }
  }

  // ============================================================
  // SINKRON KE SERVER (antrean berurutan, optimistic UI)
  // ============================================================
  function setSync(keadaan) {
    const el = $('#sync-status');
    clearTimeout(A.syncTimer);
    el.className = 'sync' + (keadaan ? ' ' + keadaan : '');
    el.textContent = keadaan === 'busy' ? 'Menyimpan…' : keadaan === 'ok' ? '✓ Tersimpan' : '';
    if (keadaan === 'ok') A.syncTimer = setTimeout(() => setSync(''), 2500);
  }

  /** Ubah katalog di layar sekarang juga (sebelum server menjawab). */
  function ubahLokal(fn) {
    const k = salin(katalog());
    fn(k);
    k.aplikasi.forEach((a, i) => { a.urutan = i + 1; });
    k.kategori.forEach((c, i) => { c.urutan = i + 1; });
    App.simpanKatalogLokal(k);
    App.renderKatalog();
  }

  function kembalikan() {
    if (!A.server) return;
    App.simpanKatalogLokal(salin(A.server));
    App.renderKatalog();
  }

  function kirim(action, data, opsi) {
    opsi = opsi || {};
    A.tertunda++;
    setSync('busy');
    A.antrian = A.antrian.then(async () => {
      let r;
      try {
        if (!A.token) throw Object.assign(new Error('Mode admin berakhir. Perubahan tidak disimpan.'), { kode: 'ADMIN' });
        r = await panggil(action, Object.assign({}, data, { adminToken: A.token }));
      } catch (e) {
        A.tertunda--;
        kembalikan();
        setSync('');
        if (e instanceof GalatJaringan) { toast('Perubahan tidak tersimpan: tidak ada koneksi.', 'err'); App.tampilOffline(); }
        else toast(e.message, 'err');
        if (opsi.gagal) opsi.gagal({ message: e.message });
        return;
      }
      A.tertunda--;
      if (r.adminToken) { A.token = r.adminToken; A.tokenSejak = Date.now(); simpanSesi(); }
      if (r.success) {
        if (r.katalog) A.server = r.katalog;
        // Samakan layar dengan server hanya bila tidak ada perubahan lain yang belum terkirim
        if (A.tertunda === 0 && !A.menungguUrut && A.server) { App.simpanKatalogLokal(salin(A.server)); App.renderKatalog(); }
        setSync(A.tertunda ? 'busy' : 'ok');
        if (opsi.sukses) opsi.sukses(r);
      } else {
        kembalikan();
        setSync('');
        App.tanganiGagal(r);
        if (opsi.gagal) opsi.gagal(r);
      }
    });
    return A.antrian;
  }

  // ============================================================
  // APLIKASI: TAMBAH / UBAH / HAPUS / URUTKAN
  // ============================================================
  function isiPilihanKategori(terpilih) {
    const sel = $('#app-kat');
    sel.innerHTML = '<option value="">Tanpa kategori (hanya di Umum)</option>' +
      katalog().kategori.map((k) => `<option value="${esc(k.nama)}">${esc(k.nama)}</option>`).join('');
    sel.value = terpilih || '';
  }

  function bukaForm(id, draf, pesanGalat) {
    const a = draf || (id ? katalog().aplikasi.find((x) => x.id === id) : null) || {};
    A.edit = id || null;
    $('#drawer-title').textContent = id ? 'Ubah aplikasi' : 'Tambah aplikasi';
    $('#app-nama').value = a.nama || '';
    $('#app-desk').value = a.deskripsi || '';
    $('#app-url').value = a.url || '';
    isiPilihanKategori(a.kategori);
    const alert = $('#form-app .alert');
    alert.hidden = !pesanGalat;
    alert.textContent = pesanGalat || '';
    perbaruiForm();
    bukaModal($('#drawer-app'), $('#app-nama'));
  }

  function nilaiForm() {
    return {
      nama: $('#app-nama').value.replace(/\s+/g, ' ').trim(),
      deskripsi: $('#app-desk').value.replace(/\s+/g, ' ').trim(),
      kategori: $('#app-kat').value,
      url: $('#app-url').value.trim()
    };
  }

  function perbaruiForm() {
    [['app-nama', BATAS.nama], ['app-desk', BATAS.deskripsi]].forEach(([id, maks]) => {
      const n = $('#' + id).value.length;
      const c = $('.counter[data-for="' + id + '"]');
      c.textContent = n + '/' + maks;
      c.classList.toggle('over', n > maks);
    });
    $('#app-preview').innerHTML = App.kartuHTML(nilaiForm(), { pratinjau: true });
  }

  function galatForm(pesan, fokus) {
    const alert = $('#form-app .alert');
    alert.textContent = pesan;
    alert.hidden = false;
    if (fokus) $(fokus).focus();
  }

  function simpanForm(e) {
    e.preventDefault();
    const v = nilaiForm();
    if (!v.nama) return galatForm('Nama aplikasi wajib diisi.', '#app-nama');
    if (v.nama.length > BATAS.nama) return galatForm('Nama maksimal ' + BATAS.nama + ' karakter.', '#app-nama');
    if (!v.deskripsi) return galatForm('Deskripsi singkat wajib diisi.', '#app-desk');
    if (v.deskripsi.length > BATAS.deskripsi) return galatForm('Deskripsi maksimal ' + BATAS.deskripsi + ' karakter.', '#app-desk');
    if (!POLA_URL.test(v.url)) return galatForm('Tautan wajib diawali https:// dan berupa alamat yang valid, mis. https://simkah.kemenag.go.id', '#app-url');

    const id = A.edit || idBaru('app');
    const baru = !A.edit;
    const data = Object.assign({ id }, v);
    tutupModal($('#drawer-app'));
    ubahLokal((k) => {
      const ada = k.aplikasi.find((a) => a.id === id);
      if (ada) Object.assign(ada, v);
      else k.aplikasi.push(Object.assign({ urutan: k.aplikasi.length + 1 }, data));
    });
    kilat('#admin-app-list', id);
    kirim('simpanAplikasi', data, {
      sukses: (r) => toast(r.message || 'Tersimpan.'),
      gagal: (r) => {
        if (r.code === 'SESI_TIDAK_SAH') return;
        // Buka lagi formulir berisi isian tadi agar tidak perlu mengetik ulang
        const lanjut = () => bukaForm(baru ? null : id, v, r.code === 'ADMIN_KEDALUWARSA' ? null : r.message);
        if (r.code === 'ADMIN_KEDALUWARSA') A.setelahPin = lanjut; else lanjut();
      }
    });
  }

  async function hapusAplikasi(id) {
    const a = katalog().aplikasi.find((x) => x.id === id);
    if (!a) return;
    const ya = await konfirmasi({ judul: 'Hapus aplikasi?', pesan: '"' + a.nama + '" akan dihapus dari katalog untuk semua pengguna.', tombol: 'Hapus' });
    if (!ya) return;
    ubahLokal((k) => { k.aplikasi = k.aplikasi.filter((x) => x.id !== id); });
    kirim('hapusAplikasi', { id }, { sukses: () => toast('Aplikasi dihapus.') });
  }

  function pindah(daftarKunci, id, arah) {
    let pindahOk = false;
    ubahLokal((k) => {
      const d = k[daftarKunci];
      const i = d.findIndex((x) => x.id === id);
      const j = arah === 'up' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= d.length) return;
      [d[i], d[j]] = [d[j], d[i]];
      pindahOk = true;
    });
    return pindahOk;
  }

  function jadwalUrut(jenis) {
    const kunci = jenis === 'aplikasi' ? 'tundaUrut' : 'tundaUrutKat';
    clearTimeout(A[kunci]);
    A.menungguUrut = true;
    setSync('busy');
    // Tunggu admin selesai menekan tombol naik/turun, lalu kirim satu kali saja
    A[kunci] = setTimeout(() => {
      A.menungguUrut = false;
      const ids = katalog()[jenis].map((x) => x.id);
      kirim(jenis === 'aplikasi' ? 'urutkanAplikasi' : 'urutkanKategori', { ids });
    }, 700);
  }

  function onDaftarAplikasi(e) {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const id = b.closest('[data-id]').dataset.id;
    const act = b.dataset.act;
    if (act === 'edit') bukaForm(id);
    else if (act === 'hapus') hapusAplikasi(id);
    else if (pindah('aplikasi', id, act)) { kilat('#admin-app-list', id, act); jadwalUrut('aplikasi'); }
  }

  // ============================================================
  // KATEGORI
  // ============================================================
  function cekNamaKategori(nama, kecualiId) {
    if (!nama) return 'Nama kategori wajib diisi.';
    if (nama.length > BATAS.kategori) return 'Nama kategori maksimal ' + BATAS.kategori + ' karakter.';
    const kecil = nama.toLowerCase();
    if (kecil === 'umum' || kecil === 'sering dipakai') return '"' + nama + '" adalah nama bagian bawaan. Pilih nama lain.';
    if (katalog().kategori.some((k) => k.id !== kecualiId && k.nama.toLowerCase() === kecil)) return 'Kategori "' + nama + '" sudah ada.';
    return null;
  }

  function tambahKategori(e) {
    e.preventDefault();
    const inp = $('#kategori-baru');
    const nama = inp.value.replace(/\s+/g, ' ').trim();
    const galat = cekNamaKategori(nama);
    if (galat) { toast(galat, 'err'); inp.focus(); return; }
    const id = idBaru('kat');
    inp.value = '';
    ubahLokal((k) => { k.kategori.push({ id, nama, urutan: k.kategori.length + 1 }); });
    kilat('#admin-kat-list', id);
    kirim('simpanKategori', { id, nama }, { sukses: () => toast('Kategori "' + nama + '" ditambahkan.') });
  }

  function mulaiGantiNama(row) {
    const id = row.dataset.id;
    const k = katalog().kategori.find((x) => x.id === id);
    if (!k) return;
    const main = $('.row-main', row);
    main.innerHTML = `<form class="rename-form"><input type="text" maxlength="${BATAS.kategori}" value="${esc(k.nama)}" aria-label="Nama baru untuk ${esc(k.nama)}"></form>`;
    const form = $('form', main);
    const inp = $('input', main);
    inp.focus();
    inp.select();
    let selesai = false;
    const batal = () => { if (!selesai) { selesai = true; renderKategori(); } };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nama = inp.value.replace(/\s+/g, ' ').trim();
      if (nama === k.nama) return batal();
      const galat = cekNamaKategori(nama, id);
      if (galat) { toast(galat, 'err'); inp.focus(); return; }
      selesai = true;
      const lama = k.nama;
      ubahLokal((kk) => {
        kk.kategori.find((x) => x.id === id).nama = nama;
        kk.aplikasi.forEach((a) => { if (a.kategori === lama) a.kategori = nama; });
      });
      kilat('#admin-kat-list', id);
      kirim('simpanKategori', { id, nama }, { sukses: () => toast('Nama kategori diganti.') });
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); batal(); } });
    inp.addEventListener('blur', () => setTimeout(() => { if (!selesai) form.requestSubmit(); }, 120));
  }

  async function hapusKategori(id) {
    const { aplikasi, kategori } = katalog();
    const k = kategori.find((x) => x.id === id);
    if (!k) return;
    const n = aplikasi.filter((a) => a.kategori === k.nama).length;
    if (n > 0) { toast('Kategori "' + k.nama + '" masih dipakai ' + n + ' aplikasi. Pindahkan aplikasinya dulu.', 'err'); return; }
    const ya = await konfirmasi({ judul: 'Hapus kategori?', pesan: 'Kategori "' + k.nama + '" akan dihapus.', tombol: 'Hapus' });
    if (!ya) return;
    ubahLokal((kk) => { kk.kategori = kk.kategori.filter((x) => x.id !== id); });
    kirim('hapusKategori', { id }, { sukses: () => toast('Kategori dihapus.') });
  }

  function onDaftarKategori(e) {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const row = b.closest('[data-id]');
    const id = row.dataset.id;
    const act = b.dataset.act;
    if (act === 'rename') mulaiGantiNama(row);
    else if (act === 'hapus') hapusKategori(id);
    else if (pindah('kategori', id, act)) { kilat('#admin-kat-list', id, act); jadwalUrut('kategori'); }
  }

  // ============================================================
  // GANTI PASSWORD & PIN (menunggu jawaban server, tidak optimistic)
  // ============================================================
  function alertForm(form, pesan, ok) {
    const el = $('.alert', form);
    el.textContent = pesan;
    el.className = 'alert' + (ok ? ' ok' : '');
    el.hidden = !pesan;
  }

  async function gantiPassword(e) {
    e.preventDefault();
    const form = e.target;
    const baru = $('#pass-baru').value;
    const ulang = $('#pass-ulang').value;
    if (baru.length < BATAS.password) return alertForm(form, 'Password minimal ' + BATAS.password + ' karakter.');
    if (baru !== ulang) return alertForm(form, 'Kedua password tidak sama.');
    alertForm(form, '');
    const ya = await konfirmasi({
      judul: 'Ganti password bersama?',
      pesan: 'Semua perangkat, termasuk perangkat ini, akan keluar. Pastikan Anda mengingat password baru sebelum melanjutkan.',
      tombol: 'Ganti password', bahaya: false
    });
    if (!ya) return;
    const btn = $('button[type="submit"]', form);
    setLoading(btn, true, 'Menyimpan…');
    try {
      await A.antrian; // pastikan perubahan lain sudah tersimpan
      const r = await panggil('gantiPassword', { passwordBaru: baru, adminToken: A.token });
      if (r.success) {
        form.reset();
        App.keluar({ pesan: 'Password sudah diganti. Masuk dengan password baru, lalu bagikan ke ASN yang masih bertugas.', jenis: 'info' });
        return;
      }
      if (!['SESI_TIDAK_SAH', 'ADMIN_KEDALUWARSA'].includes(r.code)) alertForm(form, r.message);
      else App.tanganiGagal(r);
    } catch (err) {
      if (err instanceof GalatJaringan) App.tampilOffline(); else alertForm(form, err.message);
    } finally {
      setLoading(btn, false);
    }
  }

  async function gantiPin(e) {
    e.preventDefault();
    const form = e.target;
    const lama = $('#pin-lama').value;
    const baru = $('#pin-baru').value;
    const ulang = $('#pin-ulang').value;
    if (!/^\d{6}$/.test(lama)) return alertForm(form, 'PIN lama harus 6 angka.');
    if (!/^\d{6}$/.test(baru)) return alertForm(form, 'PIN baru harus tepat 6 angka.');
    if (baru !== ulang) return alertForm(form, 'PIN baru dan ulangannya tidak sama.');
    if (baru === lama) return alertForm(form, 'PIN baru sama dengan PIN lama.');
    const btn = $('button[type="submit"]', form);
    setLoading(btn, true, 'Menyimpan…');
    alertForm(form, '');
    try {
      const r = await panggil('gantiPin', { pinLama: lama, pinBaru: baru, adminToken: A.token });
      if (r.adminToken) { A.token = r.adminToken; A.tokenSejak = Date.now(); simpanSesi(); }
      if (r.success) {
        form.reset();
        alertForm(form, 'PIN berhasil diganti. Gunakan PIN baru saat masuk menu admin berikutnya.', true);
        toast('PIN berhasil diganti.');
        return;
      }
      if (!['SESI_TIDAK_SAH', 'ADMIN_KEDALUWARSA'].includes(r.code)) alertForm(form, r.message);
      else App.tanganiGagal(r);
    } catch (err) {
      if (err instanceof GalatJaringan) App.tampilOffline(); else alertForm(form, err.message);
    } finally {
      setLoading(btn, false);
    }
  }

  // ============================================================
  // PERISTIWA
  // ============================================================
  function hanyaAngka(e) {
    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
    if (v !== e.target.value) e.target.value = v;
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('#btn-lock').addEventListener('click', klikGembok);
    $('#btn-admin-back').addEventListener('click', () => { App.tampilView('home'); window.scrollTo({ top: 0 }); });
    $('#btn-admin-exit').addEventListener('click', () => keluarAdmin());
    $$('.tab').forEach((b) => b.addEventListener('click', () => pilihTab(b.dataset.tab)));

    // PIN: hanya angka, titik mengikuti, kirim otomatis setelah 6 angka
    const pin = $('#pin-input');
    pin.addEventListener('input', (e) => {
      hanyaAngka(e);
      gambarTitik();
      $('#pin-msg').textContent = '';
      if (pin.value.length === 6) kirimPin();
    });
    pin.addEventListener('focus', () => $('.pin-dots').classList.add('focus'));
    pin.addEventListener('blur', () => $('.pin-dots').classList.remove('focus'));
    $('#form-pin-admin').addEventListener('submit', kirimPin);
    ['#pin-lama', '#pin-baru', '#pin-ulang'].forEach((s) => $(s).addEventListener('input', hanyaAngka));

    $('#btn-add-app').addEventListener('click', () => bukaForm(null));
    $('#form-app').addEventListener('submit', simpanForm);
    ['#app-nama', '#app-desk', '#app-url', '#app-kat'].forEach((s) => $(s).addEventListener('input', perbaruiForm));
    $('#admin-app-list').addEventListener('click', onDaftarAplikasi);
    $('#admin-kat-list').addEventListener('click', onDaftarKategori);
    $('#form-kategori-baru').addEventListener('submit', tambahKategori);
    $('#form-password').addEventListener('submit', gantiPassword);
    $('#form-pin').addEventListener('submit', gantiPin);

    ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, catatAktivitas, { passive: true }));
    window.addEventListener('beforeunload', (e) => {
      if (A.tertunda > 0) { e.preventDefault(); e.returnValue = ''; }
    });
  });

  window.Admin = { render, pulihkan, reset, habis, sibuk: () => A.tertunda > 0 || A.menungguUrut, aktif };
})();
