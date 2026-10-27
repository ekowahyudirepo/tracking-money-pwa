'use strict';

/* =========================================================
   KeuanganKu (PWA) - data tersimpan di localStorage perangkat
   ========================================================= */

const IN = 'INCOME';
const OUT = 'EXPENSE';

const CATEGORIES = {
  EXPENSE: ['Makan', 'Transport', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Keluarga', 'Lainnya'],
  INCOME: ['Gaji', 'Bonus', 'Usaha', 'Investasi', 'Lainnya']
};

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/* ---------- Ikon (satu warna, mengikuti warna teks) ---------- */
const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5V21h-6v-6H9v6H3z" fill="currentColor"/>',
  chart: '<path d="M4 13h4v7H4zM10 8h4v12h-4zM16 4h4v16h-4z" fill="currentColor"/>',
  settings: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.5"/><circle cx="8" cy="17" r="2.5"/></g>',
  plus: '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
  left: '<path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
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

let transactions = store.load('kk.tx', []);
let settings = Object.assign({ budget: 0, theme: 'system' }, store.load('kk.settings', {}));
const ui = { tab: 'home', month: currentMonthIndex(), filter: 'all', query: '' };
let draft = null;
let deferredInstall = null;

const saveTx = () => store.save('kk.tx', transactions);
const saveSettings = () => store.save('kk.settings', settings);

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

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const sorted = (list) => list.slice().sort((a, b) => b.date - a.date || (b.created || 0) - (a.created || 0));
const monthItems = () => transactions.filter((t) => monthIndexOf(t.date) === ui.month);

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

function summaryHtml(income, expense) {
  const budget = settings.budget || 0;
  let budgetHtml = '';
  if (budget > 0) {
    const ratio = expense / budget;
    const cls = ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warn' : '';
    budgetHtml =
      '<div class="budget">' +
      '<div class="row-between"><span>Anggaran pengeluaran</span><span>' + fmtCompact(expense) + ' / ' + fmtCompact(budget) + '</span></div>' +
      '<div class="progress"><div class="' + cls + '" style="width:' + Math.min(100, Math.max(0, ratio * 100)) + '%"></div></div>' +
      '<div class="small" style="margin-top:4px;font-weight:600">' +
      (expense <= budget ? 'Sisa ' + fmtRp(budget - expense) : 'Melebihi anggaran ' + fmtRp(expense - budget)) +
      '</div></div>';
  }
  return '<div class="card hero"><div class="lbl">Saldo ' + monthLabel(ui.month) + '</div>' +
    '<div class="big">' + fmtRp(income - expense) + '</div>' + budgetHtml + '</div>' +
    '<div class="grid2">' +
    '<div class="card"><div class="lbl">Pemasukan</div><div class="val in">' + fmtRp(income) + '</div></div>' +
    '<div class="card"><div class="lbl">Pengeluaran</div><div class="val out">' + fmtRp(expense) + '</div></div>' +
    '</div>';
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
    return '<div class="empty">' + (items.length ? 'Tidak ada transaksi yang cocok.' : 'Belum ada transaksi di bulan ini.\nTekan + untuk menambah.') + '</div>';
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
    return '<div class="day"><span>' + esc(dayLabel(g.items[0].date)) + '</span>' +
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
  const items = monthItems();
  return monthSelector() +
    summaryHtml(sum(items, IN), sum(items, OUT)) +
    '<div class="toolbar">' +
    '<div class="search"><input id="q" type="search" placeholder="Cari kategori atau catatan" value="' + esc(ui.query) + '" autocomplete="off"></div>' +
    '<div class="chips">' +
    chip('Semua', 'filter', 'all', ui.filter === 'all') +
    chip('Pemasukan', 'filter', 'in', ui.filter === 'in') +
    chip('Pengeluaran', 'filter', 'out', ui.filter === 'out') +
    '</div></div>' +
    '<div id="list">' + listHtml(items) + '</div>';
}

function renderStats() {
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

  return monthSelector() + '<div class="stack">' +
    '<div class="card"><h2>Ringkasan ' + monthLabel(ui.month) + '</h2>' +
    '<div class="line"><span>Jumlah transaksi</span><span>' + items.length + '</span></div>' +
    '<div class="line"><span>Rata-rata pengeluaran per hari</span><span>' + fmtRp(avg) + '</span></div>' +
    '<div class="line"><span>Pengeluaran terbesar</span><span>' + (biggest ? esc(biggest.category) + ' • ' + fmtRp(biggest.amount) : '-') + '</span></div>' +
    '<div class="line"><span>Rasio tabungan</span><span>' + rate + '</span></div></div>' +

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
    '<div class="card"><h2>Anggaran bulanan</h2>' +
    '<div class="muted small">Batas pengeluaran per bulan. Kosongkan atau isi 0 untuk menonaktifkan.</div>' +
    '<label class="field"><span>Anggaran</span><div class="money">Rp&nbsp;<input id="budget-input" data-money inputmode="numeric" autocomplete="off" value="' +
    (settings.budget > 0 ? settings.budget.toLocaleString('id-ID') : '') + '"></div></label>' +
    '<div style="margin-top:12px"><button class="btn" data-action="save-budget">Simpan anggaran</button></div></div>' +

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

    '<div class="card"><h2>Tentang</h2><div>KeuanganKu versi web 1.0</div>' +
    '<div class="muted small">Data hanya disimpan di browser perangkat ini dan tidak dikirim ke server mana pun.</div></div>' +
    '</div>';
}

function render() {
  const app = $('#app');
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
    : { id: null, type: OUT, category: CATEGORIES.EXPENSE[0], note: '', date: toDateInput(Date.now()), origDate: null, amountText: '' };
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
    '<div class="field"><span>Kategori</span><div class="chips">' +
    CATEGORIES[d.type].map((c) => chip(esc(c), 'sheet-cat', esc(c), c === d.category)).join('') +
    '</div></div>' +
    '<label class="field"><span>Tanggal</span><input id="f-date" type="date" value="' + esc(d.date) + '"></label>' +
    '<label class="field"><span>Catatan (opsional)</span><input id="f-note" type="text" autocomplete="off" value="' + esc(d.note) + '"></label>' +
    '<div class="actions">' +
    (editing ? '<button class="btn danger" data-action="sheet-delete">Hapus</button>' : '') +
    '<button class="btn outline" data-action="sheet-cancel">Batal</button>' +
    '<button class="btn" id="f-save" data-action="sheet-save"' + (parseMoney(d.amountText) > 0 ? '' : ' disabled') + '>Simpan</button>' +
    '</div>';
}

function saveSheet() {
  const d = draft;
  const amount = parseMoney(d.amountText);
  if (!(amount > 0) || !d.date) return;
  const dateMs = d.origDate && d.origDate === d.date
    ? (transactions.find((t) => t.id === d.id) || {}).date || fromDateInput(d.date)
    : fromDateInput(d.date);
  const data = { type: d.type, amount, category: d.category, note: d.note.trim(), date: dateMs };
  if (d.id) {
    const t = transactions.find((x) => x.id === d.id);
    if (t) Object.assign(t, data);
  } else {
    transactions.push(Object.assign({ id: newId(), created: Date.now() }, data));
  }
  saveTx();
  ui.month = monthIndexOf(dateMs);
  closeSheet();
  render();
  toast('Transaksi disimpan');
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
  let text = 'Ringkasan keuangan ' + monthLabel(ui.month) + '\nPemasukan: ' + fmtRp(inc) + '\nPengeluaran: ' + fmtRp(exp) + '\nSaldo: ' + fmtRp(inc - exp);
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
        draft.category = CATEGORIES[value][0];
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
        render();
        toast('Semua data dihapus');
      }
      break;
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
    }
  } else if (el.id === 'f-note' && draft) {
    draft.note = el.value;
  } else if (el.id === 'f-date' && draft) {
    draft.date = el.value;
  } else if (el.id === 'q') {
    ui.query = el.value;
    $('#list').innerHTML = listHtml(monthItems());
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

/* ---------- Mulai ---------- */
applyTheme();
render();

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
