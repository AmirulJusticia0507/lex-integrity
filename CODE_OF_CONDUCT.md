# Kode Etik Proyek - Lex-Integrity

## Tujuan
Memastikan pengembangan platform kepatuhan kebijakan hukum yang etis, transparan, dan bertanggung jawab.

## Prinsip Utama

### 1. Privasi & Keamanan Data
- ❌ **TIDAK** menyimpan atau membagikan data pribadi pengguna tanpa persetujuan eksplisit
- ✅ Enkripsi semua data sensitif baik saat istirahat maupun dalam transit
- ✅ Implementasi access control yang ketat
- ✅ Logging hanya untuk audit debugging, bukan untuk pemantauan pengguna

### 2. Etika AI & LLM
- ✅ Gunakan LLM lokal (Ollama) untuk menghindari pengolahan data oleh pihak ketiga
- ✅ Gunakan prompt yang etis dan tidak mengandung bias
- ✅ Hindari inferensi atau pengambilan kesimpulan yang menghakimi
- ✅ Sediakan penjelasan transparan untuk hasil yang dihasilkan oleh AI

### 3. Kepatuhan Hukum
- ✅ Patuhi semua hukum dan peraturan Indonesia yang berlaku
- ✅ Pastikan proses scraping mematuhi hukum hak cipta dan lisensi sumber
- ✅ Berikan notifikasi yang jelas tentang sumber data dan lisensi

### 4. Transparansi & Akuntabilitas
- ✅ Dokumentasikan semua proses pengambilan keputusan AI
- ✅ Sediakan akses ke sumber data dan referensi
- ✅ Buat mekanisme pelaporan bug dan masalah
- ✅ Audit regular hasil deteksi loophole/kontradiksi

## Perizinan Penggunaan Data

Data hukum dari:
- **JDIHN (Jaringan Dokumentasi dan Informasi Hukum Nasional)**: Gratis dan terbuka
- **DPR RI**: Berlisensi pemerintah
- **DPRD**: Hak akses pemerintah daerah

Semua data harus:
1. Disitasi dengan benar
2. Tidak dimanipulasi untuk tujuan politik
3. Digunakan hanya untuk analisis kepatuhan dan audit

## Batasan Penggunaan

❌ **TIDAK** diperbolehkan:
- Membagikan atau menjual dataset kepada pihak ketiga
- Menggunakan data untuk tujuan politik partisan
- Memanipulasi atau memalsukan dokumen hukum
- Mengabaikan hak kekayaan intelektual

✅ **DIPERBOLEHKAN**:
- Analisis akademik dan penelitian
- Audit kepatuhan pemerintah dan perusahaan
- Pembuatan laporan publik
- Dokumentasi dan pendidikan hukum

## Panduan Implementasi

### Pengembangan Etis
- Gunakan prinsip-prinsip rekayasa Fairness, Accountability, dan Transparency (FAccT) untuk AI
- Buat dokumentasi keputusan desain yang jelas
- Implementasi perlindungan privasi sejak awal (privacy-by-design)

### Keamanan
- Gunakan HTTPS untuk semua API dan koneksi database
- Implementasi rate limiting dan proteksi DDoS
- Rutin lakukan audit keamanan dan pentesting
- Gunakan lingkungan development yang terisolasi

### Audit & Pemantauan
- Buat log akses yang terperinci dan terverifikasi
- Monitor penggunaan sumber daya dan performa
- Buat dashboard monitoring kepatuhan
- Rutin lakukan backup dan recovery test

## Tanggung Jawab Pengembang

1. **Etika Data**: Perlakukan semua data sebagai sumber daya publik yang berharga
2. **Kode yang Jujur**: Jangan memanipulasi hasil analisis atau menyembunyikan bug
3. **Dokumentasi yang Jujur**: Berikan dokumentasi yang akurat dan lengkap
4. **Komunikasi yang Terbuka**: Berikan notifikasi yang jelas tentang perubahan dan masalah

## Tanggung Jawab Pengguna

1. Gunakan sistem dengan itikad baik dan tujuan sah
2. Hormati batasan akses dan hak cipta data
3. Laporkan bug, masalah, atau kekhawatiran etika segera
4. Gunakan output sistem sebagai referensi, bukan sebagai pernyataan hukum yang definitif

## Etika Penggunaan di Tempat Kerja

### Lingkungan Development
- ✅ Gunakan database development yang terpisah
- ✅ Jangan uji script scraping pada produksi
- ✅ Batasi akses hanya untuk tim yang perlu
- ✅ Lakukan rotasi kredensial secara rutin

### Lingkungan Production
- ✅ Monitor penggunaan API dan sumber daya sistem secara terus-menerus
- ✅ Batasi akses berdasarkan peran dan departemen
- ✅ Lakukan audit log akses secara rutin
- ✅ Sediakan kontak dukungan teknis yang cepat

### Penggunaan Sumber Daya
- ✅ Gunakan kapasitas komputasi yang efisien
- ✅ Batasi crawling hanya pada domain yang diizinkan
- ✅ Sediakan mekanisme rate limiting yang baik
- ✅ Lakukan penjadwalan rutin untuk maintenance dan backup

## Etika Pengguna Lanjutan

### Penggunaan Perusahaan
- ✅ Dapatkan persetujuan hukum dan kepatuhan sebelum penggunaan
- ✅ Batasi akses berdasarkan kebutuhan bisnis dan hukum
- ✅ Dokumentasikan semua proses pengambilan keputusan
- ✅ Laporkan penggunaan dan dampak secara rutin kepada pemangku kepentingan

### Penelitian & Akademik
- ✅ Dapatkan persetujuan etis dari institusi
- ✅ Dapatkan izin penelitian jika diperlukan
- ✅ Publikasikan methodology dan batasan dengan jujur
- ✅ Bagikan data hasil penelitian secara bertanggung jawab

## Panduan Cepat

| Situasi | Pedoman Etika |
|----------|----------------|
| Meragukan legalitas data | Konsultasikan dengan tim hukum |
| Curiga bias dalam analisis | Audit model dan data pelatihan |
| Mendeteksi bug | Laporkan segera, jangan sembunyikan |
| Kesalahan dalam output | Verifikasi, perbaiki, dokumentasikan |
| Tekanan waktu | Prioritaskan integritas data |
| Masalah sumber daya | Hemat dan dokumentasikan usage |

## Perubahan Terakhir Diperbarui
[Tanggal]

Disusun untuk memastikan pengembangan dan penggunaan platform kepatuhan kebijakan hukum yang bertanggung jawab dan etis.