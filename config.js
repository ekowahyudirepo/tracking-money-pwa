// Konfigurasi Supabase. Isi dua nilai ini untuk mengaktifkan login dan sinkronisasi antar perangkat.
// Keduanya aman berada di sini (memang publik); data dilindungi oleh Row Level Security di Supabase.
// JANGAN pernah menaruh kunci "service_role" / "secret" di file ini.
// Selama masih kosong, aplikasi berjalan dalam mode lokal (tanpa akun).
window.KK_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_KEY: ''
};
