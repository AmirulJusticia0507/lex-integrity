# Menjadikan Laptop Sendiri sebagai Server Lex Integrity

Panduan ini ditujukan untuk laptop server dengan spesifikasi:

- RAM 16 GB
- GPU NVIDIA dengan VRAM 4 GB
- SSD 2 TB
- Frontend tetap di Vercel
- Backend, PostgreSQL/pgvector, Redis, queue, worker, dan Ollama berjalan di laptop

Spesifikasi tersebut cukup untuk sekitar 45 ribu produk hukum dan satu model Ollama 8B quantized. VRAM 4 GB tidak dapat memuat seluruh model 8B, sehingga Ollama akan membagi beban antara GPU dan RAM. Hindari model 14B, lebih dari satu model aktif, atau inferensi paralel.

## Arsitektur

```text
Internet
   |
Frontend Vercel
   |
Cloudflare Tunnel (HTTPS)
   |
Laptop Ubuntu Server
   |-- Backend Node.js :3000 (localhost saja)
   |-- PostgreSQL + pgvector (Docker internal)
   |-- Redis + Bull Queue (Docker internal)
   |-- Worker (Docker)
   `-- Ollama 8B (host, memakai GPU NVIDIA)
```

Cloudflare Tunnel menghindari kebutuhan IP publik statis dan port forwarding. Port PostgreSQL `5432`, Redis `6379`, dan Ollama `11434` tidak boleh dibuka ke internet.

## 1. Persiapan perangkat

Gunakan Ubuntu Server 24.04 LTS tanpa desktop agar RAM lebih lega. Hubungkan laptop melalui kabel LAN bila memungkinkan.

Di BIOS/UEFI:

- Aktifkan opsi menyala kembali setelah listrik pulih bila tersedia.
- Pastikan boot otomatis tidak menunggu input pengguna.

Di Ubuntu, cegah sleep saat layar ditutup:

```bash
sudo mkdir -p /etc/systemd/logind.conf.d
sudo tee /etc/systemd/logind.conf.d/server.conf >/dev/null <<'EOF'
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
IdleAction=ignore
EOF
sudo systemctl restart systemd-logind
```

Baterai laptop membantu saat listrik mati sebentar, tetapi bukan pengganti backup data atau UPS.

## 2. Instalasi sistem

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl git ufw openssh-server ubuntu-drivers-common
sudo ubuntu-drivers install
sudo reboot
```

Setelah reboot, pastikan GPU terbaca:

```bash
nvidia-smi
```

Pasang Docker:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
docker --version
docker compose version
```

Aktifkan firewall untuk SSH saja. Akses web akan melalui tunnel keluar, bukan port publik:

```bash
sudo ufw allow OpenSSH
sudo ufw enable
```

Sebaiknya gunakan SSH key dan matikan login root/password setelah key dipastikan bekerja.

## 3. Instalasi dan pembatasan Ollama

Jalankan Ollama langsung di host agar deteksi GPU NVIDIA lebih sederhana:

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl edit ollama
```

Isi override systemd berikut:

```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_KEEP_ALIVE=10m"
Environment="OLLAMA_CONTEXT_LENGTH=4096"
```

Aktifkan konfigurasi:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
ollama list
```

Siapkan model:

```bash
ollama pull nomic-embed-text
```

Model `lex-integrity-agent:latest` perlu dibuat ulang dari `Modelfile` atau dipindahkan dari instalasi lama. Pastikan hasil akhirnya muncul:

```bash
ollama list
curl http://127.0.0.1:11434/api/tags
```

Port Ollama mendengarkan di host agar container backend dapat mengaksesnya, tetapi UFW tidak membuka port tersebut ke internet.

## 4. Tambahkan swap

RAM 16 GB cukup tetapi ketat ketika model 8B, PostgreSQL, dan worker aktif bersamaan. Tambahkan swap 12 GB sebagai pengaman:

```bash
sudo fallocate -l 12G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

Swap mencegah OOM saat lonjakan singkat, tetapi bukan pengganti RAM. Jika swap terus aktif saat chat, kurangi konteks atau upgrade RAM.

## 5. Ambil aplikasi

```bash
git clone https://github.com/AmirulJusticia0507/lex-integrity.git
cd lex-integrity
cp .env.example .env
```

Buat rahasia URL-safe:

```bash
openssl rand -hex 32
openssl rand -hex 24
openssl rand -hex 24
```

Gunakan hasilnya masing-masing untuk `JWT_SECRET`, `POSTGRES_PASSWORD`, dan `REDIS_PASSWORD`. Jangan commit `.env`.

Konfigurasi minimum:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=ganti_dengan_random_64_karakter
CORS_ORIGIN=https://DOMAIN_FRONTEND_VERCEL

POSTGRES_DB=lex_integrity
POSTGRES_USER=postgres
POSTGRES_PASSWORD=ganti_dengan_random_hex

REDIS_PASSWORD=ganti_dengan_random_hex

OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_AGENT_MODEL=lex-integrity-agent:latest
OLLAMA_MODEL=lex-integrity-agent:latest
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_THINK=false
OLLAMA_KEEP_ALIVE_MIN=10

SCRAPE_SCHEDULE_ENABLED=true
```

Tambahkan konfigurasi SMTP, Gemini, OpenAI, atau integrasi lainnya hanya bila digunakan.

## 6. Jalankan layanan

Gunakan Compose khusus home server. File ini tidak mengekspos database dan Redis ke host:

```bash
docker compose -f docker-compose.home-server.yml up -d --build
docker compose -f docker-compose.home-server.yml ps
```

Periksa konektivitas:

```bash
curl http://127.0.0.1:3000/health
docker compose -f docker-compose.home-server.yml logs --tail=100 backend
docker compose -f docker-compose.home-server.yml logs --tail=100 worker
```

Jika backend tidak dapat menjangkau Ollama, periksa `sudo systemctl status ollama`, `curl http://127.0.0.1:11434/api/tags`, dan nilai `OLLAMA_HOST`.

## 7. Pindahkan database lokal ke laptop server

Data tidak otomatis berpindah bersama source code atau `git pull`. Gunakan `pg_dump` agar seluruh tabel, pengguna aplikasi, role, dan produk hukum pada database lokal ikut tersalin. Proses ini membuat salinan dan tidak menghapus database sumber.

### 7.1 Buat dump di laptop utama

Jalankan dari PowerShell pada laptop yang memiliki database lengkap. Contoh berikut menggunakan PostgreSQL lokal pada port `5432`, user `postgres`, password `postgres`, dan database `lex_integrity`:

```powershell
cd C:\laragon\www\lex-integrity
$env:PGPASSWORD="postgres"

pg_dump `
  -h 127.0.0.1 `
  -p 5432 `
  -U postgres `
  -d lex_integrity `
  -Fc `
  -f lex_integrity.dump
```

Pastikan dump berhasil dibuat dan catat jumlah data sumber:

```powershell
Get-Item .\lex_integrity.dump

psql -h 127.0.0.1 -p 5432 -U postgres -d lex_integrity `
  -c "SELECT COUNT(*) FROM rules;"
```

Jika PostgreSQL lokal memakai port lain, ganti nilai `-p`. Sebagai contoh, gunakan `-p 5433` apabila container lama dipublikasikan pada port tersebut.

### 7.2 Kirim dump ke laptop kedua

```powershell
scp .\lex_integrity.dump USER_SERVER@IP_LAPTOP_SERVER:~/
```

Contoh:

```powershell
scp .\lex_integrity.dump amirul@192.168.1.20:~/
```

### 7.3 Restore ke PostgreSQL Docker di laptop kedua

Jalankan di laptop server:

```bash
cd ~/lex-integrity
docker compose -f docker-compose.home-server.yml up -d postgres

docker cp ~/lex_integrity.dump lex-integrity-postgres:/tmp/lex_integrity.dump
docker exec lex-integrity-postgres pg_restore \
  -U postgres \
  -d lex_integrity \
  --clean --if-exists --no-owner \
  /tmp/lex_integrity.dump
```

Peringatan objek tidak ditemukan saat memakai `--clean --if-exists` dapat muncul pada database tujuan yang masih baru. Restore dianggap gagal jika `pg_restore` berhenti dengan error atau mengembalikan exit code selain nol.

### 7.4 Verifikasi dan hidupkan aplikasi

```bash
docker exec lex-integrity-postgres psql \
  -U postgres -d lex_integrity \
  -c "SELECT COUNT(*) FROM rules;"

docker exec lex-integrity-postgres psql \
  -U postgres -d lex_integrity \
  -c "SELECT 'rules' AS tabel, COUNT(*) FROM rules UNION ALL SELECT 'users', COUNT(*) FROM users UNION ALL SELECT 'roles', COUNT(*) FROM roles;"

docker compose -f docker-compose.home-server.yml up -d --build
docker compose -f docker-compose.home-server.yml ps
curl http://127.0.0.1:3000/health
```

Jumlah `rules` sebelum dan sesudah restore harus sama. Jangan memasukkan `lex_integrity.dump` ke Git dan jangan menghapus database lama sebelum backup serta server baru terverifikasi.

## 8. Publikasikan dengan Cloudflare Tunnel

Tambahkan domain ke Cloudflare, lalu buat tunnel melalui dashboard **Zero Trust > Networks > Tunnels**. Pilih connector Linux dan jalankan perintah instalasi bertoken yang diberikan Cloudflare pada laptop server.

Tambahkan public hostname:

```text
Hostname: api.domain-anda.id
Service:  http://localhost:3000
```

Uji dari jaringan lain:

```bash
curl https://api.domain-anda.id/health
curl https://api.domain-anda.id/api/analyze/status
```

Tidak perlu menjalankan ngrok dan tidak perlu membuka port router.

## 9. Hubungkan frontend Vercel

Atur environment Vercel:

```env
REACT_APP_API_URL=https://api.domain-anda.id
```

Redeploy frontend. Pastikan backend memakai origin frontend yang tepat:

```env
CORS_ORIGIN=https://domain-frontend-vercel-anda
```

Jangan menambahkan trailing slash pada kedua URL.

## 10. Backup otomatis

Volume Docker menjaga data saat container dibuat ulang, tetapi bukan backup. Buat folder backup di SSD:

```bash
mkdir -p "$HOME/backups/lex-integrity"
```

Buat `/home/USER_SERVER/backup-lex.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
DEST="$HOME/backups/lex-integrity"
STAMP="$(date +%F_%H-%M)"
mkdir -p "$DEST"
docker exec lex-integrity-postgres pg_dump \
  -U postgres -d lex_integrity -Fc > "$DEST/lex_integrity_$STAMP.dump"
find "$DEST" -type f -name '*.dump' -mtime +14 -delete
```

Aktifkan:

```bash
chmod 700 ~/backup-lex.sh
(crontab -l 2>/dev/null; echo '0 2 * * * /home/USER_SERVER/backup-lex.sh') | crontab -
```

Salin backup secara rutin ke laptop utama, hard disk eksternal, atau object storage. SSD 2 TB tidak melindungi dari kerusakan drive, kehilangan perangkat, atau penghapusan tidak sengaja.

## 11. Operasional dan pembaruan

Periksa kondisi server:

```bash
free -h
df -h
nvidia-smi
docker stats
docker compose -f docker-compose.home-server.yml ps
journalctl -u ollama --since today
```

Pembaruan aplikasi:

```bash
cd ~/lex-integrity
git pull --ff-only
docker compose -f docker-compose.home-server.yml up -d --build
curl http://127.0.0.1:3000/health
```

## 12. Rekomendasi pembagian hosting

Gunakan pembagian berikut agar biaya tetap rendah tanpa mengorbankan kemampuan AI lokal:

| Aplikasi/komponen | Penempatan | Alasan |
| --- | --- | --- |
| Lex Integrity backend, PostgreSQL, Redis, queue, scraper, dan Ollama | Laptop server kedua | Membutuhkan RAM besar, penyimpanan lokal, dan akses model Ollama 8B. Lebih hemat daripada VPS 16 GB. |
| Lex Integrity frontend | Vercel | Frontend statis tidak perlu ditempatkan bersama backend. |
| Al-Hikmah backend | Railway Hobby | Backend relatif ringan karena AI memakai Gemini/API eksternal dan database memakai Neon. |
| Al-Hikmah frontend | Vercel | Tetap sederhana dan dapat dideploy otomatis dari Git. |
| Al-Hikmah database | Neon | Tidak membebani RAM dan penyimpanan Railway. |
| Akses publik Lex Integrity | Cloudflare Tunnel | Tidak membutuhkan IP publik statis atau port forwarding. |

### Batas biaya Railway untuk Al-Hikmah

Railway Hobby memiliki biaya minimum USD 5 per bulan dan mencakup USD 5 pemakaian resource. Tagihan mengikuti pemakaian apabila total resource melebihi nilai tersebut.

- Pasang notifikasi biaya pada USD 5 dan USD 8.
- Pasang hard limit sekitar USD 10 per bulan bila opsinya tersedia pada akun.
- Setelah berjalan satu minggu, periksa **Usage > Estimated Usage**.
- Jangan menjalankan Ollama di Railway Hobby; gunakan Gemini/API eksternal untuk Al-Hikmah.

Perkiraan awal Al-Hikmah adalah USD 5-10 per bulan, tergantung CPU, RAM, trafik, dan network egress. Biaya Gemini dihitung terpisah sesuai pemakaian API.

### Kapan perlu pindah ke VPS

Pertahankan Lex Integrity di laptop server selama listrik, internet, pendinginan, dan backup dapat dijaga. Pertimbangkan VPS 16 GB ketika aplikasi harus tersedia 24 jam, pengguna sudah rutin, atau ketergantungan pada koneksi rumah mulai mengganggu layanan.

Sebagai pembanding, Biznet Gio NEO Lite LL 16.8 tercantum dengan 16 GB RAM, 8 vCPU, dan SSD 60 GB. Harga promo yang pernah diperiksa adalah Rp459.000 per bulan atau Rp5.508.000 per tahun sebelum pajak. Pastikan harga promo, perpanjangan, dan spesifikasi terbaru langsung di halaman penyedia sebelum membeli.

Dengan kondisi saat ini, keputusan yang direkomendasikan adalah:

1. Jalankan Lex Integrity dan Ollama di laptop kedua.
2. Gunakan Cloudflare Tunnel untuk endpoint HTTPS publik.
3. Jalankan Al-Hikmah backend di Railway Hobby dengan batas biaya.
4. Pertahankan frontend di Vercel dan database Al-Hikmah di Neon.
5. Simpan backup database Lex Integrity di perangkat atau lokasi lain.

## 13. Meminta coding agent menyiapkan server

Coding agent harus dijalankan dari direktori repository agar dapat membaca source code, konfigurasi, dan panduan ini. Tarik perubahan terbaru terlebih dahulu.

Windows PowerShell:

```powershell
cd C:\laragon\www\lex-integrity
git pull origin main
codex
```

Linux:

```bash
cd ~/lex-integrity
git pull origin main
codex
```

Setelah agent terbuka, kirim prompt berikut:

```text
Baca SELF_HOST_LAPTOP.md dan periksa kondisi project ini. Siapkan Lex Integrity
sebagai home server di laptop ini mengikuti dokumentasi tersebut.

Kerjakan bertahap:
1. Periksa Docker, Docker Compose, PostgreSQL, Redis, Node.js, Ollama, dan
   Cloudflare Tunnel.
2. Periksa file .env tanpa menampilkan nilai rahasia.
3. Jalankan docker-compose.home-server.yml.
4. Restore lex_integrity.dump ke PostgreSQL lokal jika file tersedia.
5. Pastikan model lex-integrity-agent:latest dan nomic-embed-text tersedia.
6. Jalankan backend, worker, database, dan Redis.
7. Verifikasi jumlah data pada tabel rules.
8. Uji /health dan /api/analyze/status.
9. Jangan menghapus database, dump, atau volume yang sudah ada.
10. Laporkan langkah yang membutuhkan tindakan manual dariku.
```

Agent juga dapat diberi instruksi langsung dari terminal tanpa sesi interaktif:

```bash
codex "Baca SELF_HOST_LAPTOP.md lalu siapkan project ini sebagai home server. Periksa dependency, jalankan Docker Compose, restore lex_integrity.dump jika tersedia, verifikasi database, Ollama, Redis, worker, dan health endpoint. Jangan hapus data atau volume yang sudah ada dan jangan tampilkan nilai rahasia dari .env."
```

Tetap tinjau perintah yang diajukan agent sebelum menjalankan operasi database. File `lex_integrity.dump` dan `.env` tidak boleh dimasukkan ke commit Git.

## Checklist akhir

- Jumlah produk hukum sama dengan database sumber.
- Database, Redis, dan queue berstatus connected.
- `lex-integrity-agent:latest` dan `nomic-embed-text` tersedia.
- Chat AI berjalan dengan satu permintaan pada satu waktu.
- Frontend Vercel dapat login dan memanggil API server.
- Laptop tidak sleep ketika layar ditutup.
- Tunnel otomatis hidup setelah reboot.
- Backup harian berhasil dan memiliki salinan di perangkat lain.

