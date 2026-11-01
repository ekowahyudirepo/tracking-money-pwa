'use strict';

/* =========================================================
   KeuanganKu (PWA) - data tersimpan di localStorage perangkat
   ========================================================= */

const IN = 'INCOME';
const OUT = 'EXPENSE';

const BASE_CATEGORIES = {
  EXPENSE: ['Makan', 'Transport', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Keluarga', 'Lainnya'],
  INCOME: ['Gaji', 'Bonus', 'Usaha', 'Investasi', 'Lainnya']
};

const MAX_CATS = 30;       // maksimal kategori per jenis
const MAX_CAT_LEN = 20;    // maksimal panjang nama kategori

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/* ---------- Ikon (satu warna, mengikuti warna teks) ---------- */
const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5V21h-6v-6H9v6H3z" fill="currentColor"/>',
  chart: '<path d="M4 13h4v7H4zM10 8h4v12h-4zM16 4h4v16h-4z" fill="currentColor"/>',
  settings: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.5"/><circle cx="8" cy="17" r="2.5"/></g>',
  plus: '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
  left: '<path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  up: '<path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  down: '<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
  right: '<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
};
const icon = (name) => '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>';

/* ---------- Penyimpanan ---------- */
const store = {
  load(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      toast('Gagal menyimpan data. Penyimpanan browser mungkin penuh atau dinonaktifkan.');
      return false;
    }
  }
};

/* ---------- Konfigurasi cloud (Supabase) ---------- */
const CFG = window.KK_CONFIG || {};
const CLOUD = !!(CFG.SUPABASE_URL && CFG.SUPABASE_KEY && window.supabase && window.supabase.createClient);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}

let transactions = store.load('kk.tx', []);
const defaultCats = () => ({ EXPENSE: BASE_CATEGORIES.EXPENSE.slice(), INCOME: BASE_CATEGORIES.INCOME.slice() });
const defaultSettings = () => ({ budget: 0, dailyLimit: 0, openingBalance: 0, theme: 'system', cats: defaultCats() });
let settings = (() => {
  const stored = store.load('kk.settings', {});
  const base = defaultSettings();
  if (!stored.cats) delete base.cats; // data versi lama (customCats) dimigrasi di normalizeSettings
  const st = normalizeSettings(Object.assign(base, stored));
  if (Object.keys(stored).length && !stored.cats) store.save('kk.settings', st); // simpan hasil migrasi
  return st;
})();

function cleanCatList(list) {
  const out = [];
  (Array.isArray(list) ? list : []).forEach((n) => {
    const name = String(n || '').trim().replace(/\s+/g, ' ').slice(0, MAX_CAT_LEN);
    if (name && !out.some((x) => x.toLowerCase() === name.toLowerCase())) out.push(name);
  });
  return out.slice(0, MAX_CATS);
}
function normalizeSettings(st) {
  st.openingBalance = Math.max(0, Number(st.openingBalance) || 0);
  if (!st.cats) {
    // Migrasi dari versi lama: kategori bawaan + kategori kustom ("Lainnya" tetap di akhir)
    const c = st.customCats || {};
    const merge = (t) => BASE_CATEGORIES[t].filter((x) => x !== 'Lainnya').concat(cleanCatList(c[t])).concat('Lainnya');
    st.cats = { EXPENSE: merge('EXPENSE'), INCOME: merge('INCOME') };
  }
  delete st.customCats;
  const d = defaultCats();
  const exp = cleanCatList(st.cats.EXPENSE);
  const inc = cleanCatList(st.cats.INCOME);
  st.cats = { EXPENSE: exp.length ? exp : d.EXPENSE, INCOME: inc.length ? inc : d.INCOME };
  return st;
}
// Kategori milik akun: dibaca dari kolom custom_categories ({ v: 2, EXPENSE, INCOME }, atau format lama berisi kategori tambahan saja)
function catsFromServer(obj) {
  if (obj && obj.v === 2) return normalizeSettings({ cats: { EXPENSE: obj.EXPENSE, INCOME: obj.INCOME } }).cats;
  return normalizeSettings({ customCats: obj || {} }).cats;
}
const catsChanged = () => JSON.stringify(settings.cats) !== JSON.stringify(defaultCats());
const hasSettings = () => settings.budget > 0 || settings.openingBalance > 0 || settings.dailyLimit > 0 || settings.theme !== 'system' || catsChanged();

// Daftar kategori milik pengguna. `extra` = kategori transaksi lama yang sudah tidak ada di daftar (tetap ditampilkan saat mengubah transaksi).
function categoriesFor(type, extra) {
  const all = settings.cats[type].slice();
  if (extra && !all.some((c) => c.toLowerCase() === extra.toLowerCase())) all.push(extra);
  return all;
}
const ui = { tab: 'home', view: store.load('kk.view', 'month') === 'day' ? 'day' : 'month', month: currentMonthIndex(), day: Date.now(), filter: 'all', query: '' };
let draft = null;
let deferredInstall = null;

// Antrean perubahan yang belum terkirim ke server: items[id] = 'upsert' | 'delete'
let outbox = Object.assign({ items: {}, wipe: false, settings: false }, store.load('kk.outbox', {}));
let user = store.load('kk.user', null); // { id, email } bila sudah login
let localMode = store.load('kk.localmode', false); // true = sengaja dipakai tanpa akun
const sync = { busy: false, again: false, last: 0, error: '' };
let sb = null;

// Migrasi: id lama (bukan UUID) diganti UUID supaya cocok dengan database
if (transactions.some((t) => !UUID_RE.test(t.id))) {
  transactions.forEach((t) => { if (!UUID_RE.test(t.id)) t.id = uuid(); });
  store.save('kk.tx', transactions);
}

const saveTx = () => store.save('kk.tx', transactions);
const saveSettings = () => {
  const ok = store.save('kk.settings', settings);
  queueSettings();
  return ok;
};

/* ---------- Helper ---------- */
const $ = (sel) => document.querySelector(sel);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0, minimumFractionDigits: 0 });
const fmtRp = (n) => rupiah.format(n).replace(/ /g, ' ');

function fmtCompact(v) {
  const t = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
  if (v >= 1e9) return t(v / 1e9) + ' M';
  if (v >= 1e6) return t(v / 1e6) + ' jt';
  if (v >= 1e3) return t(v / 1e3) + ' rb';
  return String(v);
}

const sum = (list, type) => list.filter((t) => t.type === type).reduce((a, t) => a + t.amount, 0);

function monthIndexOf(ms) {
  const d = new Date(ms);
  return d.getFullYear() * 12 + d.getMonth();
}
function currentMonthIndex() {
  return monthIndexOf(Date.now());
}
const monthLabel = (idx) => MONTHS[idx % 12] + ' ' + Math.floor(idx / 12);
const monthShort = (idx) => MONTHS_SHORT[idx % 12];
const daysInMonth = (idx) => new Date(Math.floor(idx / 12), (idx % 12) + 1, 0).getDate();

function dayKey(ms) {
  const d = new Date(ms);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function dayLabel(ms) {
  const base = new Date(ms).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
  const key = dayKey(ms);
  if (key === dayKey(Date.now())) return 'Hari ini • ' + base;
  if (key === dayKey(Date.now() - 86400000)) return 'Kemarin • ' + base;
  return base;
}
const pad = (n) => String(n).padStart(2, '0');
const toDateInput = (ms) => {
  const d = new Date(ms);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
};
function fromDateInput(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getTime();
}

const newId = () => uuid();
const sorted = (list) => list.slice().sort((a, b) => b.date - a.date || (b.created || 0) - (a.created || 0));
const monthItems = () => transactions.filter((t) => monthIndexOf(t.date) === ui.month);
const dayItems = () => transactions.filter((t) => dayKey(t.date) === dayKey(ui.day));
const viewItems = () => (ui.view === 'day' ? dayItems() : monthItems());

// Saldo berlanjut: saldo awal (pengaturan) + semua transaksi sebelum periode yang dilihat
const netOf = (t) => (t.type === IN ? t.amount : -t.amount);
const balanceBeforeMonth = (idx) => (settings.openingBalance || 0) +
  transactions.filter((t) => monthIndexOf(t.date) < idx).reduce((a, t) => a + netOf(t), 0);
const balanceBeforeDay = (key) => (settings.openingBalance || 0) +
  transactions.filter((t) => dayKey(t.date) < key).reduce((a, t) => a + netOf(t), 0);
function shiftDay(ms, n) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12, 0, 0).getTime();
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ---------- Tema ---------- */
function applyTheme() {
  const root = document.documentElement;
  if (settings.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', settings.theme);
  const dark = settings.theme === 'dark' ||
    (settings.theme === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0f1413' : '#f6faf9');
}

/* ---------- Render ---------- */
function monthSelector() {
  const isCurrent = ui.month === currentMonthIndex();
  return '<div class="month">' +
    '<button class="icon-btn" data-action="prev-month" aria-label="Bulan sebelumnya">' + icon('left') + '</button>' +
    '<button class="label" data-action="this-month">' + monthLabel(ui.month) +
    (isCurrent ? '' : '<small>Ketuk untuk ke bulan ini</small>') + '</button>' +
    '<button class="icon-btn" data-action="next-month" aria-label="Bulan berikutnya">' + icon('right') + '</button>' +
    '</div>';
}

function viewToggle() {
  return '<div class="chips view-toggle">' +
    chip('Bulanan', 'set-view', 'month', ui.view === 'month') +
    chip('Harian', 'set-view', 'day', ui.view === 'day') + '</div>';
}

function daySelector() {
  const isToday = dayKey(ui.day) === dayKey(Date.now());
  const label = new Date(ui.day).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  return '<div class="month">' +
    '<button class="icon-btn" data-action="prev-day" aria-label="Hari sebelumnya">' + icon('left') + '</button>' +
    '<button class="label day-label" data-action="this-day">' + esc(label) +
    (isToday ? '<small>Hari ini</small>' : '<small>Ketuk untuk ke hari ini</small>') + '</button>' +
    '<button class="icon-btn" data-action="next-day" aria-label="Hari berikutnya">' + icon('right') + '</button>' +
    '</div>';
}

function summaryHtml(opening, income, expense) {
  const day = ui.view === 'day';
  const closing = opening + income - expense;
  const period = day ? 'hari ini' : 'bulan ini';
  let extra = '';
  // Bulanan: anggaran bulanan. Harian: batas harian; jika belum diisi, turunan dari anggaran bulanan.
  let cap = 0, capTitle = 'Anggaran pengeluaran', capNote = '';
  if (day) {
    capTitle = 'Anggaran harian';
    if (settings.dailyLimit > 0) cap = settings.dailyLimit;
    else if (settings.budget > 0) {
      cap = Math.floor(settings.budget / daysInMonth(monthIndexOf(ui.day)));
      capNote = ' (dari anggaran bulanan)';
    }
  } else {
    cap = settings.budget || 0;
  }
  if (cap > 0) {
    const ratio = expense / cap;
    const cls = ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warn' : '';
    extra =
      '<div class="budget">' +
      '<div class="row-between"><span>' + capTitle + capNote + '</span><span>' + fmtCompact(expense) + ' / ' + fmtCompact(cap) + '</span></div>' +
      '<div class="progress"><div class="' + cls + '" style="width:' + Math.min(100, Math.max(0, ratio * 100)) + '%"></div></div>' +
      '<div class="small" style="margin-top:4px;font-weight:600">' +
      (expense <= cap ? 'Sisa ' + fmtRp(cap - expense) : 'Melebihi anggaran ' + fmtRp(expense - cap)) +
      '</div></div>';
  }
  const title = day ? 'Saldo akhir ' + new Date(ui.day).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'Saldo akhir ' + monthLabel(ui.month);
  return '<div class="card hero"><div class="lbl">' + esc(title) + '</div>' +
    '<div class="big">' + fmtRp(closing) + '</div>' +
    '<div class="small opening">Saldo awal ' + (day ? 'hari' : 'bulan') + ': ' + fmtRp(opening) + '</div>' + extra + '</div>' +
    '<div class="grid2">' +
    '<div class="card"><div class="lbl">Pemasukan ' + period + '</div><div class="val in">' + fmtRp(income) + '</div></div>' +
    '<div class="card"><div class="lbl">Pengeluaran ' + period + '</div><div class="val out">' + fmtRp(expense) + '</div></div>' +
    '</div>';
}

// Proyeksi batas harian untuk sisa bulan berjalan (hari ini ikut dihitung)
function projectionCard(balance) {
  if (ui.month !== currentMonthIndex()) return '';
  const now = new Date();
  const daysLeft = daysInMonth(ui.month) - now.getDate() + 1;
  const lim = settings.dailyLimit || 0;
  const row = (label, note, value, cls) =>
    '<div class="line proj"><span>' + label + '<small class="proj-note">' + note + '</small></span>' +
    '<span class="' + (cls || '') + '">' + value + '</span></div>';

  // Rekomendasi: saldo saat ini dibagi sisa hari
  const rec = balance > 0 ? Math.floor(balance / daysLeft) : 0;
  const recRow = row('Rekomendasi anggaran harian',
    'Saldo ' + fmtRp(balance) + ' dibagi ' + daysLeft + ' hari',
    balance > 0 ? fmtRp(rec) + ' / hari' : 'Saldo tidak tersisa', balance > 0 ? '' : 'out');

  // Jika memakai batas harian dari pengaturan: saldo cukup untuk berapa hari
  let limRow;
  if (lim > 0) {
    const days = balance > 0 ? Math.floor(balance / lim) : 0;
    let note;
    if (days <= 0) note = 'Saldo tidak cukup untuk satu hari';
    else if (days >= daysLeft) note = 'Cukup sampai akhir bulan, sisa ' + fmtRp(balance - lim * daysLeft);
    else {
      const last = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days - 1);
      note = 'Saldo habis setelah tanggal ' + last.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    }
    limRow = row('Dengan anggaran harian ' + fmtRp(lim), note, days + ' hari', days >= daysLeft ? 'in' : (days <= 0 ? 'out' : ''));
  } else {
    limRow = row('Dengan anggaran harian dari pengaturan', 'Belum diatur. Isi di Pengaturan > Batas pengeluaran harian.', '-');
  }

  return '<div class="card" style="margin-top:12px"><h2>Batas harian untuk sisa bulan</h2>' +
    '<div class="line"><span>Sisa hari di ' + monthLabel(ui.month) + '</span><span>' + daysLeft + ' hari</span></div>' +
    '<div class="small muted" style="margin-bottom:4px">Termasuk hari ini.</div>' +
    recRow + limRow + '</div>';
}

function chip(label, action, value, active) {
  return '<button class="chip' + (active ? ' active' : '') + '" data-action="' + action + '" data-value="' + value + '">' + label + '</button>';
}

function listHtml(items) {
  const q = ui.query.trim().toLowerCase();
  const shown = sorted(items).filter((t) => {
    const typeOk = ui.filter === 'all' || (ui.filter === 'in' ? t.type === IN : t.type === OUT);
    const queryOk = !q || t.category.toLowerCase().includes(q) || (t.note || '').toLowerCase().includes(q);
    return typeOk && queryOk;
  });
  if (!shown.length) {
    return '<div class="empty">' + (items.length ? 'Tidak ada transaksi yang cocok.' : (ui.view === 'day' ? 'Belum ada transaksi di hari ini.' : 'Belum ada transaksi di bulan ini.') + '\nTekan + untuk menambah.') + '</div>';
  }
  const groups = [];
  shown.forEach((t) => {
    const k = dayKey(t.date);
    const last = groups[groups.length - 1];
    if (last && last.key === k) last.items.push(t);
    else groups.push({ key: k, items: [t] });
  });
  return groups.map((g) => {
    const net = g.items.reduce((a, t) => a + (t.type === IN ? t.amount : -t.amount), 0);
    const lim = settings.dailyLimit || 0;
    const overDay = lim > 0 && g.items.filter((t) => t.type === OUT).reduce((a, t) => a + t.amount, 0) > lim;
    return '<div class="day"><span>' + esc(dayLabel(g.items[0].date)) +
      (overDay ? ' <b class="out">• Melebihi batas</b>' : '') + '</span>' +
      '<span class="' + (net >= 0 ? 'in' : 'out') + '">' + (net >= 0 ? '+' : '-') + fmtCompact(Math.abs(net)) + '</span></div>' +
      g.items.map((t) =>
        '<button class="row" data-action="edit" data-id="' + esc(t.id) + '">' +
        '<span class="badge">' + esc(t.category.charAt(0).toUpperCase()) + '</span>' +
        '<span class="grow"><b>' + esc(t.category) + '</b>' + (t.note ? '<small>' + esc(t.note) + '</small>' : '') + '</span>' +
        '<span class="amt ' + (t.type === IN ? 'in' : 'out') + '">' + (t.type === IN ? '+' : '-') + fmtRp(t.amount) + '</span>' +
        '</button>'
      ).join('');
  }).join('');
}

function renderHome() {
  const items = viewItems();
  const opening = ui.view === 'day' ? balanceBeforeDay(dayKey(ui.day)) : balanceBeforeMonth(ui.month);
  return viewToggle() + (ui.view === 'day' ? daySelector() : monthSelector()) +
    summaryHtml(opening, sum(items, IN), sum(items, OUT)) +
    (ui.view === 'month' ? projectionCard(opening + sum(items, IN) - sum(items, OUT)) : '') +
    dailyCard() +
    '<div class="toolbar">' +
    '<div class="search"><input id="q" type="search" placeholder="Cari kategori atau catatan" value="' + esc(ui.query) + '" autocomplete="off"></div>' +
    '<div class="chips">' +
    chip('Semua', 'filter', 'all', ui.filter === 'all') +
    chip('Pemasukan', 'filter', 'in', ui.filter === 'in') +
    chip('Pengeluaran', 'filter', 'out', ui.filter === 'out') +
    '</div></div>' +
    '<div id="list">' + listHtml(items) + '</div>';
}

function catListHtml(expenses, totalOut, emptyText) {
  const byCat = {};
  expenses.forEach((t) => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
  const cats = Object.keys(byCat).map((k) => [k, byCat[k]]).sort((a, b) => b[1] - a[1]);
  return cats.length ? cats.map(([name, v]) => {
    const pct = totalOut > 0 ? (v / totalOut) * 100 : 0;
    return '<div class="cat"><div class="top"><b>' + esc(name) + '</b><span>' + fmtRp(v) + ' (' + Math.round(pct) + '%)</span></div>' +
      '<div class="progress"><div class="expense" style="width:' + pct + '%"></div></div></div>';
  }).join('') : '<div class="muted">' + emptyText + '</div>';
}

const WEEKDAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function renderDayStats() {
  const key = dayKey(ui.day);
  const items = dayItems();
  const expenses = items.filter((t) => t.type === OUT);
  const totalIn = sum(items, IN);
  const totalOut = sum(items, OUT);
  const opening = balanceBeforeDay(key);
  const biggest = expenses.reduce((m, t) => (!m || t.amount > m.amount ? t : m), null);

  // Rata-rata pengeluaran harian di bulan yang sama (sampai hari ini bila bulan berjalan)
  const midx = monthIndexOf(ui.day);
  const monthOut = sum(transactions.filter((t) => monthIndexOf(t.date) === midx), OUT);
  const counted = midx === currentMonthIndex() ? new Date().getDate() : daysInMonth(midx);
  const avg = counted > 0 ? Math.floor(monthOut / counted) : 0;
  let cmp = '-';
  if (avg > 0) {
    const diff = Math.round(((totalOut - avg) / avg) * 100);
    cmp = (diff > 0 ? '+' : '') + diff + '% dari rata-rata (' + fmtRp(avg) + ')';
  }

  const lim = settings.dailyLimit || 0;
  let limLine = '';
  if (lim > 0) {
    limLine = '<div class="line"><span>Batas harian</span><span class="' + (totalOut > lim ? 'out' : '') + '">' +
      (totalOut > lim ? 'Melebihi ' + fmtRp(totalOut - lim) : 'Sisa ' + fmtRp(lim - totalOut)) + '</span></div>';
  }

  // Grafik 7 hari berakhir di hari yang dipilih
  const series = [];
  for (let i = 6; i >= 0; i--) {
    const ms = shiftDay(ui.day, -i);
    const k = dayKey(ms);
    const list = transactions.filter((t) => dayKey(t.date) === k);
    series.push({ ms, k, inc: sum(list, IN), exp: sum(list, OUT) });
  }
  const maxV = Math.max(1, ...series.map((x) => Math.max(x.inc, x.exp)));
  const bar = (v, color) => '<span style="height:' + (v <= 0 ? 2 : Math.max(3, Math.round(100 * v / maxV))) + 'px;background:' + color + '"></span>';
  const weekExp = series.reduce((a, x) => a + x.exp, 0);

  return viewToggle() + daySelector() + '<div class="stack">' +
    '<div class="card"><h2>Ringkasan hari</h2>' +
    '<div class="line"><span>Saldo awal</span><span>' + fmtRp(opening) + '</span></div>' +
    '<div class="line"><span>Saldo akhir</span><span>' + fmtRp(opening + totalIn - totalOut) + '</span></div>' +
    '<div class="line"><span>Jumlah transaksi</span><span>' + items.length + '</span></div>' +
    '<div class="line"><span>Pemasukan</span><span class="in">' + fmtRp(totalIn) + '</span></div>' +
    '<div class="line"><span>Pengeluaran</span><span class="out">' + fmtRp(totalOut) + '</span></div>' +
    '<div class="line"><span>Pengeluaran terbesar</span><span>' + (biggest ? esc(biggest.category) + ' • ' + fmtRp(biggest.amount) : '-') + '</span></div>' +
    '<div class="line"><span>Dibanding rata-rata harian bulan ini</span><span>' + esc(cmp) + '</span></div>' + limLine + '</div>' +

    '<div class="card"><h2>7 hari terakhir</h2>' +
    '<div class="legend"><span><i style="background:var(--in)"></i>Pemasukan</span><span><i style="background:var(--out)"></i>Pengeluaran</span></div>' +
    '<div class="chart">' + series.map((x) =>
      '<div class="col"><div class="bars">' + bar(x.inc, 'var(--in)') + bar(x.exp, 'var(--out)') + '</div>' +
      '<div class="m' + (x.k === key ? ' sel' : '') + '">' + WEEKDAYS_SHORT[new Date(x.ms).getDay()] + '</div>' +
      '<div class="m d' + (x.k === key ? ' sel' : '') + '">' + new Date(x.ms).getDate() + '</div></div>'
    ).join('') + '</div>' +
    '<div class="line" style="margin-top:12px"><span>Total pengeluaran 7 hari</span><span>' + fmtRp(weekExp) + '</span></div>' +
    '<div class="line"><span>Rata-rata per hari</span><span>' + fmtRp(Math.floor(weekExp / 7)) + '</span></div></div>' +

    '<div class="card"><h2>Pengeluaran per kategori</h2>' + catListHtml(expenses, totalOut, 'Belum ada pengeluaran di hari ini.') + '</div></div>';
}

function renderStats() {
  if (ui.view === 'day') return renderDayStats();
  const items = monthItems();
  const expenses = items.filter((t) => t.type === OUT);
  const totalIn = sum(items, IN);
  const totalOut = sum(items, OUT);

  const byCat = {};
  expenses.forEach((t) => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
  const cats = Object.keys(byCat).map((k) => [k, byCat[k]]).sort((a, b) => b[1] - a[1]);

  const series = [];
  for (let idx = ui.month - 5; idx <= ui.month; idx++) {
    const list = transactions.filter((t) => monthIndexOf(t.date) === idx);
    series.push({ idx, inc: sum(list, IN), exp: sum(list, OUT) });
  }
  const maxV = Math.max(1, ...series.map((s) => Math.max(s.inc, s.exp)));
  const bar = (v, color) => '<span style="height:' + (v <= 0 ? 2 : Math.max(3, Math.round(100 * v / maxV))) + 'px;background:' + color + '"></span>';

  const daysCounted = ui.month === currentMonthIndex() ? new Date().getDate() : daysInMonth(ui.month);
  const avg = daysCounted > 0 ? Math.floor(totalOut / daysCounted) : 0;
  const biggest = expenses.reduce((m, t) => (!m || t.amount > m.amount ? t : m), null);
  const rate = totalIn > 0 ? Math.round(((totalIn - totalOut) / totalIn) * 100) + '%' : '-';

  const dailyLim = settings.dailyLimit || 0;
  let overLine = '';
  if (dailyLim > 0) {
    const perDay = {};
    expenses.forEach((t) => { const k = dayKey(t.date); perDay[k] = (perDay[k] || 0) + t.amount; });
    const overDays = Object.keys(perDay).filter((k) => perDay[k] > dailyLim).length;
    overLine = '<div class="line"><span>Hari melebihi batas harian</span><span>' + overDays + ' hari</span></div>';
  }

  return viewToggle() + monthSelector() + '<div class="stack">' +
    '<div class="card"><h2>Ringkasan ' + monthLabel(ui.month) + '</h2>' +
    '<div class="line"><span>Saldo awal bulan</span><span>' + fmtRp(balanceBeforeMonth(ui.month)) + '</span></div>' +
    '<div class="line"><span>Saldo akhir bulan</span><span>' + fmtRp(balanceBeforeMonth(ui.month) + totalIn - totalOut) + '</span></div>' +
    '<div class="line"><span>Jumlah transaksi</span><span>' + items.length + '</span></div>' +
    '<div class="line"><span>Rata-rata pengeluaran per hari</span><span>' + fmtRp(avg) + '</span></div>' +
    '<div class="line"><span>Pengeluaran terbesar</span><span>' + (biggest ? esc(biggest.category) + ' • ' + fmtRp(biggest.amount) : '-') + '</span></div>' +
    '<div class="line"><span>Rasio tabungan</span><span>' + rate + '</span></div>' + overLine + '</div>' +

    '<div class="card"><h2>6 bulan terakhir</h2>' +
    '<div class="legend"><span><i style="background:var(--in)"></i>Pemasukan</span><span><i style="background:var(--out)"></i>Pengeluaran</span></div>' +
    '<div class="chart">' + series.map((s) =>
      '<div class="col"><div class="bars">' + bar(s.inc, 'var(--in)') + bar(s.exp, 'var(--out)') + '</div>' +
      '<div class="m' + (s.idx === ui.month ? ' sel' : '') + '">' + monthShort(s.idx) + '</div></div>'
    ).join('') + '</div></div>' +

    '<div class="card"><h2>Pengeluaran per kategori</h2>' +
    (cats.length ? cats.map(([name, v]) => {
      const pct = totalOut > 0 ? (v / totalOut) * 100 : 0;
      return '<div class="cat"><div class="top"><b>' + esc(name) + '</b><span>' + fmtRp(v) + ' (' + Math.round(pct) + '%)</span></div>' +
        '<div class="progress"><div class="expense" style="width:' + pct + '%"></div></div></div>';
    }).join('') : '<div class="muted">Belum ada pengeluaran di bulan ini.</div>') +
    '</div></div>';
}

function renderSettings() {
  return '<h1>Pengaturan</h1><div class="stack">' +
    accountCard() +
    '<div class="card"><h2>Saldo awal</h2>' +
    '<div class="muted small">Uang yang sudah kamu punya sebelum mulai mencatat. Saldo tidak direset tiap bulan: saldo akhir sebuah bulan menjadi saldo awal bulan berikutnya.</div>' +
    '<label class="field"><span>Saldo awal</span><div class="money">Rp&nbsp;<input id="opening-input" data-money inputmode="numeric" autocomplete="off" value="' +
    (settings.openingBalance > 0 ? settings.openingBalance.toLocaleString('id-ID') : '') + '"></div></label>' +
    '<div style="margin-top:12px"><button class="btn" data-action="save-opening">Simpan saldo awal</button></div></div>' +
    '<div class="card"><h2>Anggaran bulanan</h2>' +
    '<div class="muted small">Batas pengeluaran per bulan. Kosongkan atau isi 0 untuk menonaktifkan.</div>' +
    '<label class="field"><span>Anggaran</span><div class="money">Rp&nbsp;<input id="budget-input" data-money inputmode="numeric" autocomplete="off" value="' +
    (settings.budget > 0 ? settings.budget.toLocaleString('id-ID') : '') + '"></div></label>' +
    '<div style="margin-top:12px"><button class="btn" data-action="save-budget">Simpan anggaran</button></div></div>' +
    dailyLimitCard() +
    categoryCard() +

    '<div class="card"><h2>Tampilan</h2><div class="chips">' +
    chip('Ikut sistem', 'theme', 'system', settings.theme === 'system') +
    chip('Terang', 'theme', 'light', settings.theme === 'light') +
    chip('Gelap', 'theme', 'dark', settings.theme === 'dark') +
    '</div></div>' +

    '<div class="card"><h2>Data</h2>' +
    '<div class="muted small" style="margin-bottom:12px">Total ' + transactions.length + ' transaksi tersimpan di perangkat ini. Ekspor secara berkala sebagai cadangan.</div>' +
    '<div class="btns">' +
    '<button class="btn block" data-action="export">Ekspor semua data ke CSV</button>' +
    '<button class="btn outline block" data-action="import">Impor dari CSV</button>' +
    '<button class="btn outline block" data-action="share">Bagikan ringkasan ' + monthLabel(ui.month) + '</button>' +
    '<button class="btn danger block" data-action="delete-all">Hapus semua data</button>' +
    '</div></div>' +

    '<div class="card"><h2>Pasang di layar utama</h2>' +
    '<div class="muted small"><b>iPhone:</b> buka di Safari, ketuk Bagikan, lalu pilih "Tambah ke Layar Utama".<br>' +
    '<b>Android:</b> buka di Chrome, ketuk menu titik tiga, lalu pilih "Instal aplikasi".</div>' +
    (deferredInstall ? '<div style="margin-top:12px"><button class="btn" data-action="install">Pasang aplikasi</button></div>' : '') +
    '</div>' +

    '<div class="card"><h2>Tentang</h2><div>KeuanganKu versi web 1.1</div>' +
    '<div class="muted small">' + (CLOUD && user
      ? 'Data disimpan di akun kamu dan disalin ke perangkat ini supaya bisa dipakai offline.'
      : 'Data hanya disimpan di browser perangkat ini dan tidak dikirim ke server mana pun.') + '</div></div>' +
    '</div>';
}

function render() {
  const app = $('#app');
  const navEl = document.querySelector('.nav');
  if (CLOUD && !user && !localMode) {
    app.innerHTML = renderAuth();
    $('#fab').hidden = true;
    navEl.hidden = true;
    return;
  }
  navEl.hidden = false;
  app.innerHTML = ui.tab === 'home' ? renderHome() : ui.tab === 'stats' ? renderStats() : renderSettings();
  $('#fab').hidden = ui.tab !== 'home';
  $('#fab').innerHTML = icon('plus');
  const tabs = [['home', 'Beranda', 'home'], ['stats', 'Statistik', 'chart'], ['settings', 'Pengaturan', 'settings']];
  $('#nav').innerHTML = tabs.map(([key, label, ic]) =>
    '<button data-action="tab" data-value="' + key + '"' + (ui.tab === key ? ' class="active" aria-current="page"' : '') + '>' +
    '<span class="pill">' + icon(ic) + '</span>' + label + '</button>'
  ).join('');
}

/* ---------- Form transaksi (bottom sheet) ---------- */
function openSheet(tx) {
  draft = tx
    ? { id: tx.id, type: tx.type, category: tx.category, note: tx.note || '', date: toDateInput(tx.date), origDate: toDateInput(tx.date), amountText: tx.amount.toLocaleString('id-ID') }
    : { id: null, type: OUT, category: categoriesFor(OUT)[0], note: '', date: toDateInput(Date.now()), origDate: null, amountText: '' };
  renderSheet();
  $('#overlay').hidden = false;
  if (!tx) setTimeout(() => { const a = $('#f-amount'); if (a) a.focus(); }, 50);
}

function closeSheet() {
  $('#overlay').hidden = true;
  draft = null;
}

function renderSheet() {
  const d = draft;
  const editing = !!d.id;
  $('#sheet').innerHTML =
    '<h2>' + (editing ? 'Ubah Transaksi' : 'Tambah Transaksi') + '</h2>' +
    '<div class="chips">' +
    chip('Pengeluaran', 'sheet-type', OUT, d.type === OUT) +
    chip('Pemasukan', 'sheet-type', IN, d.type === IN) +
    '</div>' +
    '<label class="field"><span>Nominal</span><div class="money">Rp&nbsp;<input id="f-amount" data-money inputmode="numeric" autocomplete="off" placeholder="0" value="' + esc(d.amountText) + '"></div></label>' +
    '<div id="f-limit" class="limit-hint small"></div>' +
    '<div class="field"><span>Kategori</span><div class="chips">' +
    categoriesFor(d.type, d.category).map((c) => chip(esc(c), 'sheet-cat', esc(c), c === d.category)).join('') +
    '</div></div>' +
    '<label class="field"><span>Tanggal</span><input id="f-date" type="date" value="' + esc(d.date) + '"></label>' +
    '<label class="field"><span>Catatan (opsional)</span><input id="f-note" type="text" autocomplete="off" value="' + esc(d.note) + '"></label>' +
    '<div class="actions">' +
    (editing ? '<button class="btn danger" data-action="sheet-delete">Hapus</button>' : '') +
    '<button class="btn outline" data-action="sheet-cancel">Batal</button>' +
    '<button class="btn" id="f-save" data-action="sheet-save"' + (parseMoney(d.amountText) > 0 ? '' : ' disabled') + '>Simpan</button>' +
    '</div>';
  updateLimitHint();
}

function saveSheet() {
  const d = draft;
  const amount = parseMoney(d.amountText);
  if (!(amount > 0) || !d.date) return;
  const dateMs = d.origDate && d.origDate === d.date
    ? (transactions.find((t) => t.id === d.id) || {}).date || fromDateInput(d.date)
    : fromDateInput(d.date);
  const data = { type: d.type, amount, category: d.category, note: d.note.trim(), date: dateMs };
  let savedId = d.id;
  if (d.id) {
    const t = transactions.find((x) => x.id === d.id);
    if (t) Object.assign(t, data);
    else transactions.push(Object.assign({ id: d.id, created: Date.now() }, data));
  } else {
    savedId = newId();
    transactions.push(Object.assign({ id: savedId, created: Date.now() }, data));
  }
  saveTx();
  queueUpsert(savedId);
  ui.month = monthIndexOf(dateMs);
  ui.day = dateMs;
  const lim = settings.dailyLimit || 0;
  const overLimit = d.type === OUT && lim > 0 && dayExpense(dayKey(dateMs), null) > lim;
  closeSheet();
  render();
  toast(overLimit ? 'Tersimpan. Perhatian: pengeluaran hari itu melebihi batas harian ' + fmtRp(lim) : 'Transaksi disimpan');
}

/* ---------- Input nominal ---------- */
function parseMoney(text) {
  const digits = String(text).replace(/\D/g, '').slice(0, 12);
  return digits ? Number(digits) : 0;
}

function formatMoneyInput(el) {
  const raw = el.value;
  const caret = el.selectionStart == null ? raw.length : el.selectionStart;
  const digitsBefore = raw.slice(0, caret).replace(/\D/g, '').length;
  const digits = raw.replace(/\D/g, '').slice(0, 12).replace(/^0+(?=\d)/, '');
  const formatted = digits ? Number(digits).toLocaleString('id-ID') : '';
  el.value = formatted;
  let pos = 0;
  let count = 0;
  while (pos < formatted.length && count < digitsBefore) {
    if (/\d/.test(formatted[pos])) count++;
    pos++;
  }
  try { el.setSelectionRange(pos, pos); } catch (e) { /* abaikan */ }
}

/* ---------- Ekspor / impor ---------- */
const csvEscape = (s) => '"' + String(s).replace(/"/g, '""') + '"';

function buildCsv() {
  const lines = ['tanggal,jenis,kategori,nominal,catatan'];
  transactions.slice().sort((a, b) => a.date - b.date).forEach((t) => {
    lines.push([toDateInput(t.date), t.type === IN ? 'Pemasukan' : 'Pengeluaran', csvEscape(t.category), t.amount, csvEscape(t.note || '')].join(','));
  });
  return '﻿' + lines.join('\n') + '\n';
}

function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = ''; rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ''));
}

function exportCsv() {
  const blob = new Blob([buildCsv()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'keuanganku-' + toDateInput(Date.now()).replace(/-/g, '') + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('Data diekspor');
}

function importCsv(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCsv(String(reader.result));
    if (rows.length && /tanggal/i.test(rows[0][0] || '')) rows.shift();
    const keyOf = (t) => [toDateInput(t.date), t.type, t.category, t.amount, t.note || ''].join('|');
    const existing = new Set(transactions.map(keyOf));
    let added = 0;
    rows.forEach((r) => {
      const [dateStr, jenis, kategori, nominal, catatan] = r;
      const amount = Number(String(nominal || '').replace(/[^\d]/g, ''));
      if (!/^\d{4}-\d{2}-\d{2}$/.test((dateStr || '').trim()) || !(amount > 0)) return;
      const type = /pemasukan|income/i.test(jenis || '') ? IN : OUT;
      const t = { id: newId(), created: Date.now() + added, type, amount, category: (kategori || 'Lainnya').trim() || 'Lainnya', note: (catatan || '').trim(), date: fromDateInput(dateStr.trim()) };
      if (existing.has(keyOf(t))) return;
      existing.add(keyOf(t));
      transactions.push(t);
      queueUpsert(t.id);
      added++;
    });
    saveTx();
    render();
    toast(added + ' transaksi diimpor');
  };
  reader.onerror = () => toast('Gagal membaca file');
  reader.readAsText(file);
}

function summaryText() {
  const items = monthItems();
  const inc = sum(items, IN);
  const exp = sum(items, OUT);
  const byCat = {};
  items.filter((t) => t.type === OUT).forEach((t) => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
  const cats = Object.keys(byCat).map((k) => [k, byCat[k]]).sort((a, b) => b[1] - a[1]);
  let text = 'Ringkasan keuangan ' + monthLabel(ui.month) + '\nSaldo awal: ' + fmtRp(balanceBeforeMonth(ui.month)) + '\nPemasukan: ' + fmtRp(inc) + '\nPengeluaran: ' + fmtRp(exp) + '\nSaldo akhir: ' + fmtRp(balanceBeforeMonth(ui.month) + inc - exp);
  if (cats.length) text += '\n\nPengeluaran per kategori:\n' + cats.map(([k, v]) => '- ' + k + ': ' + fmtRp(v)).join('\n');
  return text;
}

async function shareSummary() {
  const text = summaryText();
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
    await navigator.clipboard.writeText(text);
    toast('Ringkasan disalin');
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    toast('Tidak bisa membagikan ringkasan');
  }
}

/* ---------- Event ---------- */
document.addEventListener('click', (e) => {
  if (e.target.id === 'overlay') { closeSheet(); return; }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const value = el.dataset.value;

  switch (action) {
    case 'tab': ui.tab = value; render(); window.scrollTo(0, 0); break;
    case 'set-view':
      if (value !== ui.view) {
        if (value === 'day') {
          ui.day = ui.month === currentMonthIndex() ? Date.now() : new Date(Math.floor(ui.month / 12), ui.month % 12, 1, 12).getTime();
        } else {
          ui.month = monthIndexOf(ui.day);
        }
        ui.view = value;
        store.save('kk.view', value);
        render();
      }
      break;
    case 'prev-day': ui.day = shiftDay(ui.day, -1); ui.month = monthIndexOf(ui.day); render(); break;
    case 'next-day': ui.day = shiftDay(ui.day, 1); ui.month = monthIndexOf(ui.day); render(); break;
    case 'this-day': ui.day = Date.now(); ui.month = currentMonthIndex(); render(); break;
    case 'save-opening':
      settings.openingBalance = parseMoney($('#opening-input').value);
      saveSettings();
      toast('Saldo awal disimpan');
      render();
      break;
    case 'prev-month': ui.month--; render(); break;
    case 'next-month': ui.month++; render(); break;
    case 'this-month': ui.month = currentMonthIndex(); render(); break;
    case 'filter': ui.filter = value; render(); break;
    case 'add': openSheet(null); break;
    case 'edit': {
      const tx = transactions.find((t) => t.id === el.dataset.id);
      if (tx) openSheet(tx);
      break;
    }
    case 'sheet-type':
      if (draft.type !== value) {
        draft.type = value;
        draft.category = categoriesFor(value)[0];
        renderSheet();
      }
      break;
    case 'sheet-cat': draft.category = el.dataset.value; renderSheet(); break;
    case 'sheet-cancel': closeSheet(); break;
    case 'sheet-save': saveSheet(); break;
    case 'sheet-delete':
      if (draft && draft.id && confirm('Hapus transaksi ini?')) {
        transactions = transactions.filter((t) => t.id !== draft.id);
        saveTx();
        queueDelete(draft.id);
        closeSheet();
        render();
        toast('Transaksi dihapus');
      }
      break;
    case 'save-budget':
      settings.budget = parseMoney($('#budget-input').value);
      saveSettings();
      toast('Anggaran disimpan');
      break;
    case 'theme': settings.theme = value; saveSettings(); applyTheme(); render(); break;
    case 'export': exportCsv(); break;
    case 'import': $('#import-file').click(); break;
    case 'share': shareSummary(); break;
    case 'delete-all':
      if (confirm('Hapus SEMUA transaksi? Tindakan ini tidak bisa dibatalkan.')) {
        transactions = [];
        saveTx();
        queueWipe();
        render();
        toast('Semua data dihapus');
      }
      break;
    case 'add-cat': {
      const type = el.dataset.type === IN ? IN : OUT;
      const input = $('#newcat-' + type);
      const name = (input.value || '').trim().replace(/\s+/g, ' ');
      if (!name) { toast('Tulis nama kategori dulu'); break; }
      if (name.length > MAX_CAT_LEN) { toast('Maksimal ' + MAX_CAT_LEN + ' karakter'); break; }
      if (categoriesFor(type).some((c) => c.toLowerCase() === name.toLowerCase())) { toast('Kategori sudah ada'); break; }
      if (settings.cats[type].length >= MAX_CATS) { toast('Maksimal ' + MAX_CATS + ' kategori per jenis'); break; }
      settings.cats[type].push(name);
      saveSettings();
      render();
      toast('Kategori ditambahkan');
      break;
    }
    case 'rename-cat': {
      const type = el.dataset.type === IN ? IN : OUT;
      const old = el.dataset.value;
      const input = prompt('Ubah nama kategori "' + old + '". Transaksi lama dengan kategori ini ikut berubah.', old);
      if (input === null) break;
      const name = input.trim().replace(/\s+/g, ' ');
      if (!name) { toast('Nama tidak boleh kosong'); break; }
      if (name.length > MAX_CAT_LEN) { toast('Maksimal ' + MAX_CAT_LEN + ' karakter'); break; }
      if (name === old) break;
      if (settings.cats[type].some((c) => c !== old && c.toLowerCase() === name.toLowerCase())) { toast('Kategori sudah ada'); break; }
      settings.cats[type] = settings.cats[type].map((c) => (c === old ? name : c));
      let n = 0;
      transactions.forEach((t) => {
        if (t.type === type && t.category === old) { t.category = name; queueUpsert(t.id); n++; }
      });
      if (n) saveTx();
      saveSettings();
      render();
      toast('Kategori diubah' + (n ? ' (' + n + ' transaksi ikut diperbarui)' : ''));
      break;
    }
    case 'move-cat': {
      const type = el.dataset.type === IN ? IN : OUT;
      const list = settings.cats[type];
      const i = list.indexOf(el.dataset.value);
      const j = el.dataset.dir === 'up' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= list.length) break;
      [list[i], list[j]] = [list[j], list[i]];
      saveSettings();
      render();
      break;
    }
    case 'del-cat': {
      const type = el.dataset.type === IN ? IN : OUT;
      const name = el.dataset.value;
      if (settings.cats[type].length <= 1) { toast('Minimal harus ada satu kategori'); break; }
      const used = transactions.filter((t) => t.type === type && t.category === name).length;
      const msg = used
        ? 'Hapus kategori "' + name + '"? ' + used + ' transaksi lama tetap memakai nama ini, hanya tidak muncul lagi sebagai pilihan.'
        : 'Hapus kategori "' + name + '"?';
      if (confirm(msg)) {
        settings.cats[type] = settings.cats[type].filter((c) => c !== name);
        saveSettings();
        render();
        toast('Kategori dihapus');
      }
      break;
    }
    case 'reset-cats':
      if (confirm('Kembalikan semua kategori ke bawaan? Transaksi tidak berubah.')) {
        settings.cats = defaultCats();
        saveSettings();
        render();
        toast('Kategori dikembalikan ke bawaan');
      }
      break;
    case 'save-daily':
      settings.dailyLimit = parseMoney($('#daily-input').value);
      saveSettings();
      toast(settings.dailyLimit > 0 ? 'Batas harian disimpan' : 'Batas harian dinonaktifkan');
      render();
      break;
    case 'use-suggest': {
      const input = $('#daily-input');
      if (input) input.value = Number(value).toLocaleString('id-ID');
      break;
    }
    case 'auth-toggle':
      authState.mode = authState.mode === 'login' ? 'signup' : 'login';
      authState.msg = '';
      render();
      break;
    case 'auth-local':
      localMode = true;
      store.save('kk.localmode', true);
      render();
      break;
    case 'show-login':
      localMode = false;
      store.save('kk.localmode', false);
      authState.msg = '';
      render();
      break;
    case 'sync-now': syncNow(true); break;
    case 'logout': logout(); break;
    case 'install':
      if (deferredInstall) {
        deferredInstall.prompt();
        deferredInstall.userChoice.finally(() => { deferredInstall = null; render(); });
      }
      break;
  }
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.matches('[data-money]')) {
    formatMoneyInput(el);
    if (el.id === 'f-amount' && draft) {
      draft.amountText = el.value;
      const btn = $('#f-save');
      if (btn) btn.disabled = !(parseMoney(el.value) > 0);
      updateLimitHint();
    }
  } else if (el.id === 'f-note' && draft) {
    draft.note = el.value;
  } else if (el.id === 'f-date' && draft) {
    draft.date = el.value;
    updateLimitHint();
  } else if (el.id === 'a-email') {
    authState.email = el.value;
  } else if (el.id === 'q') {
    ui.query = el.value;
    $('#list').innerHTML = listHtml(viewItems());
  }
});

$('#import-file').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) importCsv(file);
  e.target.value = '';
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && draft) closeSheet();
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  if (ui.tab === 'settings') render();
});

if (window.matchMedia) {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => { if (settings.theme === 'system') applyTheme(); };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
}

/* =========================================================
   Sinkronisasi (Supabase), offline-first.
   Data lokal selalu jadi sumber tampilan. Setiap perubahan masuk
   antrean (outbox) lalu dikirim saat online. Tanpa konfigurasi
   (config.js kosong) aplikasi berjalan dalam mode lokal.
   ========================================================= */
const authState = { mode: 'login', email: '', msg: '', ok: false, busy: false };
let flushTimer = null;
let needsRender = false;

function chk(res) {
  if (res.error) {
    const e = new Error(res.error.message || 'Permintaan gagal');
    e.code = res.error.code;
    e.status = res.status;
    throw e;
  }
  return res.data;
}

function toRow(t) {
  return {
    id: t.id,
    user_id: user.id,
    type: t.type,
    amount: t.amount,
    category: t.category,
    note: t.note || '',
    tx_date: toDateInput(t.date),
    created_at: new Date(t.created || t.date).toISOString(),
    updated_at: new Date().toISOString()
  };
}

function fromRow(r) {
  return {
    id: r.id,
    type: r.type,
    amount: Number(r.amount),
    category: r.category,
    note: r.note || '',
    date: fromDateInput(r.tx_date),
    created: Date.parse(r.created_at) || Date.now()
  };
}

const saveOutbox = () => store.save('kk.outbox', outbox);
const pendingCount = () => Object.keys(outbox.items).length + (outbox.wipe ? 1 : 0) + (outbox.settings ? 1 : 0);

function scheduleFlush() {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => syncNow(false), 400);
}
function queueUpsert(id) {
  if (!CLOUD || !user) return;
  outbox.items[id] = 'upsert';
  saveOutbox();
  renderSyncBadge();
  scheduleFlush();
}
function queueDelete(id) {
  if (!CLOUD || !user) return;
  outbox.items[id] = 'delete';
  saveOutbox();
  renderSyncBadge();
  scheduleFlush();
}
function queueWipe() {
  if (!CLOUD || !user) return;
  outbox.items = {};
  outbox.wipe = true;
  saveOutbox();
  renderSyncBadge();
  scheduleFlush();
}
function queueSettings() {
  if (!CLOUD || !user) return;
  outbox.settings = true;
  saveOutbox();
  renderSyncBadge();
  scheduleFlush();
}

async function flushOutbox() {
  if (outbox.wipe) {
    chk(await sb.from('transactions').delete().not('id', 'is', null));
    outbox.wipe = false;
    saveOutbox();
  }

  const opIds = (op) => Object.keys(outbox.items).filter((id) => outbox.items[id] === op);
  const takeOut = (ids) => { ids.forEach((id) => { delete outbox.items[id]; }); saveOutbox(); };
  const putBack = (ids, op) => { ids.forEach((id) => { if (!(id in outbox.items)) outbox.items[id] = op; }); saveOutbox(); };

  const upIds = opIds('upsert');
  if (upIds.length) {
    takeOut(upIds);
    try {
      const rows = upIds.map((id) => transactions.find((t) => t.id === id)).filter(Boolean).map(toRow);
      for (let i = 0; i < rows.length; i += 200) {
        chk(await sb.from('transactions').upsert(rows.slice(i, i + 200), { onConflict: 'id' }));
      }
    } catch (e) {
      putBack(upIds, 'upsert');
      throw e;
    }
  }

  const delIds = opIds('delete');
  if (delIds.length) {
    takeOut(delIds);
    try {
      for (let i = 0; i < delIds.length; i += 100) {
        chk(await sb.from('transactions').delete().in('id', delIds.slice(i, i + 100)));
      }
    } catch (e) {
      putBack(delIds, 'delete');
      throw e;
    }
  }

  if (outbox.settings) {
    outbox.settings = false;
    saveOutbox();
    try {
      const payload = {
        user_id: user.id,
        budget: settings.budget || 0,
        daily_limit: settings.dailyLimit || 0,
        custom_categories: Object.assign({ v: 2 }, settings.cats),
        opening_balance: settings.openingBalance || 0,
        theme: settings.theme || 'system',
        updated_at: new Date().toISOString()
      };
      let res = await sb.from('user_settings').upsert(payload, { onConflict: 'user_id' });
      if (res.error && res.error.code === 'PGRST204') {
        // Kolom baru belum ada di database: simpan pengaturan lainnya saja
        delete payload.daily_limit;
        delete payload.custom_categories;
        delete payload.opening_balance;
        res = await sb.from('user_settings').upsert(payload, { onConflict: 'user_id' });
      }
      chk(res);
    } catch (e) {
      outbox.settings = true;
      saveOutbox();
      throw e;
    }
  }
}

// Tarik data dari server. Perubahan lokal yang belum terkirim menang atas data server.
async function pullAll() {
  const before = JSON.stringify([transactions, settings]);
  const remote = [];
  for (let from = 0; ; from += 1000) {
    const rows = chk(await sb.from('transactions').select('*')
      .order('tx_date', { ascending: false }).order('id').range(from, from + 999));
    remote.push(...rows);
    if (rows.length < 1000) break;
  }

  const pending = outbox.items;
  const local = new Map(transactions.map((t) => [t.id, t]));
  const seen = new Set();
  const merged = [];
  remote.forEach((r) => {
    seen.add(r.id);
    if (pending[r.id] === 'delete') return;
    merged.push(pending[r.id] === 'upsert' && local.has(r.id) ? local.get(r.id) : fromRow(r));
  });
  local.forEach((t, id) => { if (!seen.has(id) && pending[id] === 'upsert') merged.push(t); });
  transactions = merged;
  saveTx();

  const srv = chk(await sb.from('user_settings').select('*').limit(1));
  if (!outbox.settings) {
    if (srv.length) {
      settings.budget = Number(srv[0].budget) || 0;
      if ('daily_limit' in srv[0]) settings.dailyLimit = Number(srv[0].daily_limit) || 0;
      if ('opening_balance' in srv[0]) settings.openingBalance = Math.max(0, Number(srv[0].opening_balance) || 0);
      // Kategori milik akun ini; akun baru (kolom kosong) mendapat kategori bawaan, bukan sisa akun lain
      if ('custom_categories' in srv[0]) settings.cats = catsFromServer(srv[0].custom_categories);
      settings.theme = srv[0].theme || 'system';
      store.save('kk.settings', settings);
      applyTheme();
    } else if (hasSettings()) {
      outbox.settings = true; // belum ada di server: kirim pengaturan lokal
      saveOutbox();
    }
  }
  return before !== JSON.stringify([transactions, settings]);
}

async function syncNow(manual) {
  if (!CLOUD || !user || !sb) return;
  if (sync.busy) { sync.again = true; return; }
  if (navigator.onLine === false) {
    sync.error = 'offline';
    renderSyncBadge();
    if (manual) toast('Sedang offline. Perubahan akan dikirim saat online.');
    return;
  }
  sync.busy = true;
  sync.error = '';
  renderSyncBadge();
  try {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    if (!data.session) { forceLogin(); return; }
    await flushOutbox();
    const changed = await pullAll();
    if (outbox.settings) await flushOutbox();
    sync.last = Date.now();
    if (changed) softRender();
    if (manual) toast('Sinkronisasi selesai');
  } catch (e) {
    sync.error = describeError(e);
    if (e && e.status === 401) forceLogin();
    else if (manual) toast('Gagal sinkron: ' + sync.error);
  } finally {
    sync.busy = false;
    renderSyncBadge();
    if (sync.again) { sync.again = false; scheduleFlush(); }
  }
}

function describeError(e) {
  const m = String((e && e.message) || e || '');
  if (/failed to fetch|networkerror|load failed|network request/i.test(m)) return 'tidak ada koneksi';
  if (e && e.code === '42P01') return 'tabel belum dibuat (jalankan SQL di Supabase)';
  if (e && e.code === '42501') return 'izin ditolak (cek grant dan policy di SQL)';
  return m || 'kesalahan tidak dikenal';
}

// Render ulang tanpa mengganggu pengguna yang sedang mengetik
function softRender() {
  const a = document.activeElement;
  if (a && a.matches && a.matches('#app input')) { needsRender = true; return; }
  needsRender = false;
  render();
}
document.addEventListener('focusout', () => setTimeout(() => { if (needsRender) softRender(); }, 150));

/* ---------- Akun ---------- */
function authMessage(e) {
  const m = String((e && e.message) || e || '').toLowerCase();
  if (/failed to fetch|network|load failed/.test(m)) return 'Tidak ada koneksi internet. Coba lagi saat online.';
  if (m.includes('invalid login')) return 'Email atau kata sandi salah.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Email ini sudah terdaftar. Silakan masuk.';
  if (m.includes('password should be') || m.includes('at least')) return 'Kata sandi minimal 6 karakter.';
  if (m.includes('not confirmed')) return 'Email belum dikonfirmasi. Cek kotak masuk kamu.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.';
  if (m.includes('invalid') && m.includes('email')) return 'Format email tidak valid.';
  if (m.includes('signups not allowed')) return 'Pendaftaran dinonaktifkan di Supabase.';
  return 'Gagal: ' + ((e && e.message) || 'terjadi kesalahan');
}

function renderAuth() {
  const signup = authState.mode === 'signup';
  return '<div class="auth"><h1>KeuanganKu</h1>' +
    '<p class="muted">' + (signup
      ? 'Buat akun untuk menyimpan data dan memakainya di semua perangkat.'
      : 'Masuk untuk menyinkronkan data kamu di semua perangkat.') + '</p>' +
    '<form id="auth-form" novalidate>' +
    '<label class="field"><span>Email</span><input id="a-email" type="email" autocomplete="email" inputmode="email" autocapitalize="none" value="' + esc(authState.email) + '"></label>' +
    '<label class="field"><span>Kata sandi</span><input id="a-pass" type="password" autocomplete="' + (signup ? 'new-password' : 'current-password') + '"></label>' +
    (authState.msg ? '<div class="auth-msg ' + (authState.ok ? 'ok' : 'err') + '" role="alert">' + esc(authState.msg) + '</div>' : '') +
    '<div style="margin-top:16px"><button class="btn block" type="submit" id="a-submit">' + (signup ? 'Daftar' : 'Masuk') + '</button></div>' +
    '</form>' +
    '<div class="auth-links">' +
    '<button class="btn text" data-action="auth-toggle">' + (signup ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar') + '</button>' +
    '<button class="btn text" data-action="auth-local">Lanjut tanpa akun (data hanya di perangkat ini)</button>' +
    '</div></div>';
}

document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'auth-form') return;
  e.preventDefault();
  if (authState.busy || !sb) return;
  const email = $('#a-email').value.trim();
  const pass = $('#a-pass').value;
  authState.email = email;
  authState.ok = false;
  if (!/^\S+@\S+\.\S+$/.test(email)) { authState.msg = 'Format email tidak valid.'; render(); return; }
  if (pass.length < 6) { authState.msg = 'Kata sandi minimal 6 karakter.'; render(); return; }
  authState.busy = true;
  const btn = $('#a-submit');
  btn.disabled = true;
  btn.textContent = 'Memproses...';
  try {
    const result = await doAuth(authState.mode, email, pass);
    authState.busy = false;
    if (result === 'confirm') {
      authState.mode = 'login';
      authState.msg = 'Pendaftaran berhasil. Cek email untuk konfirmasi, lalu masuk.';
      authState.ok = true;
      render();
    } else {
      authState.msg = '';
    }
  } catch (err) {
    authState.busy = false;
    authState.msg = authMessage(err);
    render();
  }
});

async function doAuth(mode, email, password) {
  const res = mode === 'signup'
    ? await sb.auth.signUp({ email, password })
    : await sb.auth.signInWithPassword({ email, password });
  if (res.error) throw res.error;
  if (!res.data.session) return 'confirm';
  afterLogin(res.data.session.user);
  return 'ok';
}

function afterLogin(u) {
  const prev = store.load('kk.lastuser', null);
  if (prev && prev !== u.id) {
    // Data lokal milik akun lain: jangan dicampur
    transactions = [];
    saveTx();
    outbox = { items: {}, wipe: false, settings: false };
    settings = defaultSettings();
    store.save('kk.settings', settings);
  }
  user = { id: u.id, email: u.email || '' };
  store.save('kk.user', user);
  store.save('kk.lastuser', u.id);
  localMode = false;
  store.save('kk.localmode', false);
  if (!prev) {
    // Data yang sudah ada sebelum punya akun ikut naik ke akun ini
    transactions.forEach((t) => { outbox.items[t.id] = 'upsert'; });
    if (hasSettings()) outbox.settings = true;
  }
  saveOutbox();
  authState.msg = '';
  applyTheme();
  render();
  syncNow(true);
}

function forceLogin() {
  user = null;
  store.save('kk.user', null);
  authState.mode = 'login';
  authState.msg = 'Sesi berakhir. Silakan masuk lagi.';
  authState.ok = false;
  render();
}

function wipeLocal() {
  transactions = [];
  settings = defaultSettings();
  outbox = { items: {}, wipe: false, settings: false };
  user = null;
  localMode = false;
  ['kk.tx', 'kk.settings', 'kk.outbox', 'kk.user', 'kk.lastuser', 'kk.localmode', 'kk.auth', 'kk.auth-code-verifier']
    .forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } });
  ui.tab = 'home';
  authState.mode = 'login';
  authState.msg = '';
  applyTheme();
  render();
}

async function logout() {
  if (!confirm('Keluar dari akun? Data di perangkat ini akan dihapus. Data tetap aman di akun kamu dan muncul lagi saat masuk.')) return;
  if (pendingCount() > 0) {
    try {
      await flushOutbox();
    } catch (e) {
      if (!confirm('Ada perubahan yang belum terkirim ke akun dan akan hilang jika keluar sekarang. Tetap keluar?')) return;
    }
  }
  user = null; // supaya event SIGNED_OUT tidak dianggap sesi berakhir
  try { await sb.auth.signOut(); } catch (e) { /* abaikan */ }
  wipeLocal();
}

function accountCard() {
  if (!CLOUD) {
    return '<div class="card"><h2>Akun dan sinkronisasi</h2><div class="muted small">Sinkronisasi antar perangkat belum diaktifkan. Data tersimpan hanya di perangkat ini.</div></div>';
  }
  if (!user) {
    return '<div class="card"><h2>Akun dan sinkronisasi</h2>' +
      '<div class="muted small">Kamu memakai mode lokal. Masuk untuk menyimpan data di akun dan memakainya di perangkat lain. Data yang sudah ada ikut tersimpan.</div>' +
      '<div style="margin-top:12px"><button class="btn" data-action="show-login">Masuk atau daftar</button></div></div>';
  }
  return '<div class="card"><h2>Akun dan sinkronisasi</h2>' +
    '<div class="line"><span>Akun</span><span>' + esc(user.email) + '</span></div>' +
    '<div class="line"><span>Status</span><span id="sync-status">' + esc(syncText()) + '</span></div>' +
    '<div class="btns" style="margin-top:12px">' +
    '<button class="btn block" data-action="sync-now">Sinkronkan sekarang</button>' +
    '<button class="btn outline block" data-action="logout">Keluar</button></div></div>';
}

function syncText() {
  const n = pendingCount();
  const tail = n ? ' (' + n + ' menunggu)' : '';
  if (sync.busy) return 'Menyinkronkan...';
  if (navigator.onLine === false || sync.error === 'offline') return 'Offline' + tail;
  if (sync.error) return 'Gagal: ' + sync.error + tail;
  if (n) return n + ' perubahan menunggu';
  return sync.last
    ? 'Tersinkron ' + new Date(sync.last).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : 'Belum disinkronkan';
}

function renderSyncBadge() {
  const el = document.getElementById('sync-status');
  if (el) el.textContent = syncText();
}

function initCloud() {
  if (!CLOUD) return;
  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'kk.auth' }
  });
  sb.auth.onAuthStateChange((event) => {
    // Jangan memanggil sb.* langsung di dalam callback ini
    if (event === 'SIGNED_OUT' && user) setTimeout(forceLogin, 0);
  });
  window.addEventListener('online', () => { sync.error = ''; syncNow(false); });
  window.addEventListener('offline', renderSyncBadge);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - sync.last > 20000) syncNow(false);
  });
}

/* ---------- Batas pengeluaran harian ---------- */
function dayExpense(key, excludeId) {
  return transactions
    .filter((t) => t.type === OUT && t.id !== excludeId && dayKey(t.date) === key)
    .reduce((a, t) => a + t.amount, 0);
}

// Kartu batas harian di Beranda: tampilan harian = hari yang dipilih; bulanan = hanya bulan berjalan
function dailyCard() {
  const lim = settings.dailyLimit || 0;
  if (ui.view === 'day') return '';
  const dayView = false;
  if (!lim || ui.month !== currentMonthIndex()) return '';
  const key = dayView ? dayKey(ui.day) : dayKey(Date.now());
  const isToday = key === dayKey(Date.now());
  const when = isToday ? 'hari ini' : 'tanggal ' + new Date(dayView ? ui.day : Date.now()).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const spent = dayExpense(key, null);
  const ratio = spent / lim;
  const cls = ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warn' : '';
  return '<div class="card" style="margin-top:12px">' +
    '<div class="row-between"><span class="lbl">Pengeluaran ' + when + '</span><span class="lbl">' + fmtCompact(spent) + ' / ' + fmtCompact(lim) + '</span></div>' +
    '<div class="progress"><div class="' + cls + '" style="width:' + Math.min(100, Math.max(0, ratio * 100)) + '%"></div></div>' +
    '<div class="small" style="margin-top:6px;font-weight:600">' +
    (spent <= lim ? 'Sisa batas ' + when + ' ' + fmtRp(lim - spent) : 'Melebihi batas ' + when + ' ' + fmtRp(spent - lim)) +
    '</div></div>';
}

// Petunjuk di form transaksi: sisa batas atau peringatan melebihi
function updateLimitHint() {
  const el = document.getElementById('f-limit');
  if (!el || !draft) return;
  const lim = settings.dailyLimit || 0;
  if (!lim || draft.type !== OUT || !draft.date) { el.className = 'limit-hint small'; el.textContent = ''; return; }
  const total = dayExpense(dayKey(fromDateInput(draft.date)), draft.id) + parseMoney(draft.amountText);
  if (total > lim) {
    el.className = 'limit-hint small out';
    el.textContent = 'Melebihi batas harian: total hari itu jadi ' + fmtRp(total) + ' (batas ' + fmtRp(lim) + ')';
  } else {
    el.className = 'limit-hint small muted';
    el.textContent = 'Sisa batas hari itu setelah ini: ' + fmtRp(lim - total);
  }
}

function dailyLimitCard() {
  const suggest = settings.budget > 0
    ? Math.floor(settings.budget / daysInMonth(currentMonthIndex()) / 1000) * 1000
    : 0;
  return '<div class="card"><h2>Batas pengeluaran harian</h2>' +
    '<div class="muted small">Kamu diberi peringatan saat total pengeluaran satu hari melewati batas ini. Transaksi tetap bisa disimpan. Kosongkan atau isi 0 untuk menonaktifkan.</div>' +
    '<label class="field"><span>Batas per hari</span><div class="money">Rp&nbsp;<input id="daily-input" data-money inputmode="numeric" autocomplete="off" value="' +
    (settings.dailyLimit > 0 ? settings.dailyLimit.toLocaleString('id-ID') : '') + '"></div></label>' +
    (suggest > 0
      ? '<div class="small muted" style="margin-top:8px">Saran dari anggaran bulanan: ' + fmtRp(suggest) +
        ' per hari. <button class="btn text" style="padding:0 4px" data-action="use-suggest" data-value="' + suggest + '">Pakai saran</button></div>'
      : '') +
    '<div style="margin-top:12px"><button class="btn" data-action="save-daily">Simpan batas harian</button></div></div>';
}

function categoryCard() {
  const block = (type, title) => {
    const list = settings.cats[type];
    const count = (name) => transactions.filter((t) => t.type === type && t.category === name).length;
    const btn = (action, ic, label, name, extra) =>
      '<button class="icon-btn sm" aria-label="' + label + ' ' + esc(name) + '" data-action="' + action + '" data-type="' + type + '" data-value="' + esc(name) + '"' + (extra || '') + '>' + icon(ic) + '</button>';
    return '<div class="field"><span>' + title + '</span>' +
      list.map((c, i) =>
        '<div class="cat-row"><span class="grow"><b>' + esc(c) + '</b><small>' + count(c) + ' transaksi</small></span>' +
        (i > 0 ? btn('move-cat', 'up', 'Naikkan', c, ' data-dir="up"') : '<span class="icon-sp"></span>') +
        (i < list.length - 1 ? btn('move-cat', 'down', 'Turunkan', c, ' data-dir="down"') : '<span class="icon-sp"></span>') +
        btn('rename-cat', 'edit', 'Ubah nama', c) + btn('del-cat', 'close', 'Hapus', c) + '</div>').join('') +
      '<div class="add-cat"><input class="input" id="newcat-' + type + '" maxlength="' + MAX_CAT_LEN + '" placeholder="Nama kategori baru" autocomplete="off">' +
      '<button class="btn" data-action="add-cat" data-type="' + type + '">Tambah</button></div></div>';
  };
  return '<div class="card"><h2>Kelola kategori</h2>' +
    '<div class="muted small">Tambah, ubah nama, urutkan, atau hapus semua kategori. Kategori ini milik akunmu sendiri dan ikut tersinkron di perangkat lain. Mengubah nama ikut memperbarui transaksi lama.</div>' +
    block(OUT, 'Pengeluaran') + block(IN, 'Pemasukan') +
    '<div style="margin-top:12px"><button class="btn outline block" data-action="reset-cats">Kembalikan ke kategori bawaan</button></div></div>';
}

/* ---------- Mulai ---------- */
applyTheme();
initCloud();
render();
if (CLOUD && user) syncNow(false);

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
