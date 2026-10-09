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

## 7. Pindahkan sekitar 45 ribu produk hukum

Data tidak otomatis berpindah bersama source code. Buat dump dari database laptop lama.

Di Windows/laptop lama:

```powershell
$env:PGPASSWORD="PASSWORD_DATABASE_LOKAL"
pg_dump `
  -h 127.0.0.1 `
  -p 5432 `
  -U postgres `
  -d lex_integrity `
  -Fc `
  -f lex_integrity.dump

scp .\lex_integrity.dump USER_SERVER@IP_LAPTOP_SERVER:/home/USER_SERVER/
```

Catat jumlah sebelum migrasi:

```powershell
psql -h 127.0.0.1 -p 5432 -U postgres -d lex_integrity `
  -c "SELECT COUNT(*) FROM rules;"
```

Di laptop server:

```bash
docker cp ~/lex_integrity.dump lex-integrity-postgres:/tmp/lex_integrity.dump
docker exec lex-integrity-postgres pg_restore \
  -U postgres \
  -d lex_integrity \
  --clean --if-exists --no-owner \
  /tmp/lex_integrity.dump
```

Verifikasi data:

```bash
docker exec lex-integrity-postgres psql \
  -U postgres -d lex_integrity \
  -c "SELECT COUNT(*) FROM rules;"

docker exec lex-integrity-postgres psql \
  -U postgres -d lex_integrity \
  -c "SELECT 'rules' AS tabel, COUNT(*) FROM rules UNION ALL SELECT 'users', COUNT(*) FROM users UNION ALL SELECT 'roles', COUNT(*) FROM roles;"
```

Jumlah `rules` sebelum dan sesudah restore harus sama. Jangan hapus database lama sebelum backup dan server baru terverifikasi.

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

## Checklist akhir

- Jumlah produk hukum sama dengan database sumber.
- Database, Redis, dan queue berstatus connected.
- `lex-integrity-agent:latest` dan `nomic-embed-text` tersedia.
- Chat AI berjalan dengan satu permintaan pada satu waktu.
- Frontend Vercel dapat login dan memanggil API server.
- Laptop tidak sleep ketika layar ditutup.
- Tunnel otomatis hidup setelah reboot.
- Backup harian berhasil dan memiliki salinan di perangkat lain.

