# KeuanganKu (versi web / PWA)

Aplikasi web untuk mencatat pemasukan dan pengeluaran. Bisa dipasang di layar utama iPhone maupun Android
dan tetap berjalan offline. Secara bawaan data tersimpan di browser perangkat (mode lokal). Setelah Supabase
diisi di `config.js`, ada login dan data tersinkron di semua perangkat.

## Fitur
- Tambah, ubah, hapus transaksi (nominal dengan pemisah ribuan, kategori, tanggal, catatan)
- Pindah antar bulan, pencarian, filter pemasukan/pengeluaran, riwayat per hari
- Anggaran bulanan dengan progress bar
- Statistik: ringkasan, grafik 6 bulan, pengeluaran per kategori
- Ekspor dan impor CSV (format sama dengan versi Android), bagikan ringkasan bulanan
- Tema terang/gelap/ikut sistem, bisa offline

## Sinkronisasi antar perangkat (Supabase, gratis)
1. Buat proyek di supabase.com (region Singapore), lalu jalankan `supabase/schema.sql` di SQL Editor.
2. Authentication > Sign In / Providers > Email: matikan "Confirm email" (opsional, untuk pemakaian pribadi).
3. Isi `config.js` dengan Project URL dan kunci **anon/publishable**. Jangan pernah memasukkan kunci `service_role`.
4. Commit dan push. Aplikasi akan menampilkan layar login.

Cara kerja: offline-first. Data selalu dibaca dari perangkat, perubahan masuk antrean dan dikirim saat online.
Keamanan data diatur Row Level Security: tiap akun hanya bisa membaca dan menulis datanya sendiri.
Proyek Supabase gratis di-pause setelah 7 hari tanpa aktivitas; workflow `keepalive.yml` (jika ada) mencegahnya.

## Tanpa build
Proyek ini hanya file statis (HTML, CSS, JavaScript). Tidak perlu `npm install` atau proses build.

## Deploy ke GitHub Pages
1. Buka repo di GitHub: **Settings > Pages**.
2. Pada **Build and deployment**, pilih **Source: Deploy from a branch**.
3. Pilih branch `main` dan folder `/ (root)`, lalu **Save**.
4. Tunggu 1-2 menit. Alamatnya: `https://<username>.github.io/<nama-repo>/`.

Alternatif: import repo ini di Vercel atau Netlify (tanpa build command, output directory `.`).

## Pasang di layar utama
- **iPhone:** buka di Safari, ketuk Bagikan, pilih "Tambah ke Layar Utama".
- **Android:** buka di Chrome, menu titik tiga, pilih "Instal aplikasi".

## Catatan data
Data ada di browser perangkat itu saja. Menghapus data situs/riwayat browser akan menghapus transaksi.
Lakukan **Ekspor CSV** secara berkala sebagai cadangan. Berpindah perangkat: ekspor di satu perangkat,
lalu impor di perangkat lain.

## Uji lokal
```
python3 -m http.server 8000
```
Lalu buka http://localhost:8000. Service worker aktif di localhost maupun HTTPS.
