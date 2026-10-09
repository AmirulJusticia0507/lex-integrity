# Deploy Lex Integrity ke DomaiNesia Cloud VPS Lite

Panduan ini digunakan untuk memindahkan backend Lex Integrity dari Railway ke VPS. Frontend dapat tetap berjalan di Vercel.

> Harga dan spesifikasi diperiksa pada 9 Oktober 2026. Konfirmasi kembali sebelum membeli di [halaman Cloud VPS Lite DomaiNesia](https://www.domainesia.com/cloud-vps-lite/).

## Paket yang disarankan

### Pilihan utama: Cloud VPS Lite 16GB

- 6 Core CPU
- 16 GB RAM
- 200 GB SSD NVMe
- Cocok untuk backend, PostgreSQL/pgvector, Redis, queue worker, Nginx, Ollama 8B, dan model embedding dalam satu VPS
- Harga promo tahunan saat panduan ditulis: Rp1.075.500/bulan
- Harga perpanjangan saat panduan ditulis: Rp1.195.000/bulan

Model `lex-integrity-agent:latest` berukuran sekitar 5,2 GB. RAM 16 GB memberi ruang untuk runtime model, database, Redis, Node.js, worker, dan cache sistem. Cloud VPS Lite tidak mencantumkan GPU, sehingga Ollama akan mengandalkan CPU dan respons AI tetap dapat memerlukan waktu.

### Alternatif

| Kebutuhan | Paket minimum |
| --- | --- |
| Gemini/OpenRouter, tanpa Ollama di VPS | Lite 4GB |
| Ollama 8B untuk trafik rendah | Lite 12GB |
| Semua layanan dan Ollama 8B dalam satu VPS | **Lite 16GB** |
| Beberapa model atau pemrosesan paralel tinggi | Lite 24GB |

Jangan memilih Lite 8GB untuk instalasi all-in-one. Kapasitas tersebut terlalu dekat dengan kebutuhan model dan berisiko kehabisan memori.

## Arsitektur

```text
Pengguna
   |
   +-- Frontend Vercel
   |       |
   |       +-- https://api.domain-anda.id
   |
   +-- Nginx + HTTPS (VPS)
           |
           +-- Backend Node.js :3000
           +-- Queue worker
           +-- PostgreSQL + pgvector
           +-- Redis
           +-- Ollama :11434 (internal saja)
```

Jangan membuka port PostgreSQL `5432`, Redis `6379`, atau Ollama `11434` ke internet. Hanya SSH, HTTP, dan HTTPS yang perlu dibuka.

## 1. Pesan VPS

1. Buka [Cloud VPS Lite DomaiNesia](https://www.domainesia.com/cloud-vps-lite/).
2. Pilih **Cloud VPS Lite 16GB**.
3. Pilih lokasi Jakarta dan **Ubuntu 24.04 LTS**.
4. Gunakan hostname, misalnya `api.lexintegrity.id`.
5. Simpan alamat IP VPS dan kredensial root dengan aman.

## 2. Siapkan server

Masuk melalui SSH:

```bash
ssh root@IP_VPS
```

Perbarui sistem dan pasang kebutuhan dasar:

```bash
apt update && apt upgrade -y
apt install -y ca-certificates curl git nginx certbot python3-certbot-nginx ufw
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin
```

Buat pengguna deployment agar aplikasi tidak dikelola langsung sebagai root:

```bash
adduser deploy
usermod -aG sudo,docker deploy
```

Aktifkan firewall:

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

## 3. Ambil aplikasi

```bash
su - deploy
git clone https://github.com/AmirulJusticia0507/lex-integrity.git
cd lex-integrity
```

Buat `.env` dari contoh:

```bash
cp .env.example .env
openssl rand -hex 32
```

Masukkan hasil perintah terakhir sebagai `JWT_SECRET`. Gunakan password berbeda dan kuat untuk PostgreSQL dan Redis. Jangan memasukkan `.env` ke Git.

Variabel minimum untuk deployment all-in-one:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=ganti_dengan_hasil_openssl
CORS_ORIGIN=https://DOMAIN_FRONTEND_VERCEL

POSTGRES_DB=lex_integrity
POSTGRES_USER=postgres
POSTGRES_PASSWORD=ganti_password_database
DATABASE_URL=postgresql://postgres:ganti_password_database@postgres:5432/lex_integrity

REDIS_PASSWORD=ganti_password_redis
REDIS_URL=redis://:ganti_password_redis@redis:6379

OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_AGENT_MODEL=lex-integrity-agent:latest
OLLAMA_MODEL=lex-integrity-agent:latest
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_THINK=false
OLLAMA_KEEP_ALIVE_MIN=30
```

Tambahkan juga konfigurasi SMTP, Gemini, OpenAI, atau integrasi lain hanya bila fitur tersebut digunakan.

## 4. Siapkan Docker Compose production

Compose bawaan repositori ditujukan untuk development dan backend hanya memakai `expose`. Buat override khusus VPS agar backend dapat dijangkau Nginx host tanpa membuka port ke internet:

```bash
cat > docker-compose.vps.yml <<'YAML'
services:
  backend:
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      OLLAMA_BASE_URL: http://ollama:11434
      OLLAMA_AGENT_MODEL: ${OLLAMA_AGENT_MODEL}
      OLLAMA_EMBED_MODEL: ${OLLAMA_EMBED_MODEL}

  worker:
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      OLLAMA_BASE_URL: http://ollama:11434

  ollama:
    image: ollama/ollama:latest
    container_name: lex-integrity-ollama
    restart: unless-stopped
    volumes:
      - ollama_data:/root/.ollama
    networks:
      - lex-network

volumes:
  ollama_data:
YAML
```

Jalankan hanya layanan production yang diperlukan:

```bash
docker compose -f docker-compose.yml -f docker-compose.vps.yml \
  up -d postgres redis ollama backend worker
docker exec -it lex-integrity-ollama ollama pull nomic-embed-text
```

Model kustom `lex-integrity-agent:latest` harus dibuat atau disalin kembali ke Ollama VPS. Jangan ikut menarik semua model eksperimen lama karena akan menghabiskan disk. Pastikan `ollama list` di container menampilkan model agent sebelum menguji chat AI.

Tambahkan swap sebagai pengaman, bukan sebagai pengganti RAM:

```bash
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 5. Pindahkan database

Di komputer lokal, buat dump dari database Lex Integrity:

```powershell
$env:PGPASSWORD="postgres"
pg_dump -h 127.0.0.1 -p 5432 -U postgres -d lex_integrity -Fc -f lex_integrity.dump
scp .\lex_integrity.dump deploy@IP_VPS:/home/deploy/
```

Di VPS, salin dump ke container dan pulihkan:

```bash
docker cp /home/deploy/lex_integrity.dump lex-integrity-postgres:/tmp/lex_integrity.dump
docker exec -it lex-integrity-postgres pg_restore \
  -U postgres -d lex_integrity --clean --if-exists --no-owner \
  /tmp/lex_integrity.dump
```

Verifikasi jumlah aturan:

```bash
docker exec -it lex-integrity-postgres \
  psql -U postgres -d lex_integrity -c "SELECT COUNT(*) FROM rules;"
```

## 6. Pasang domain dan HTTPS

Tambahkan DNS `A` untuk `api.domain-anda.id` menuju IP VPS. Buat konfigurasi Nginx:

```nginx
server {
    listen 80;
    server_name api.domain-anda.id;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

Aktifkan konfigurasi dan SSL:

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d api.domain-anda.id
```

Pastikan port backend hanya di-bind ke `127.0.0.1:3000` jika dipublikasikan dari Docker ke host.

## 7. Hubungkan frontend Vercel

Di Vercel, ubah environment production:

```env
REACT_APP_API_URL=https://api.domain-anda.id
```

Redeploy frontend setelah environment disimpan. Nilai `CORS_ORIGIN` backend harus sama persis dengan origin frontend Vercel dan tidak memakai trailing slash.

## 8. Verifikasi

```bash
curl https://api.domain-anda.id/health
curl https://api.domain-anda.id/api/analyze/status
docker compose -f docker-compose.yml -f docker-compose.vps.yml ps
docker compose -f docker-compose.yml -f docker-compose.vps.yml logs --tail=100 backend
docker compose -f docker-compose.yml -f docker-compose.vps.yml logs --tail=100 worker
```

Checklist hasil yang diharapkan:

- Database `connected` dan jumlah aturan sesuai sumber.
- Redis dan queue `connected`.
- Ollama serta `lex-integrity-agent:latest` tersedia jika memakai AI lokal.
- Login dari frontend Vercel berhasil.
- Chat pada halaman aturan menggunakan fokus aturan yang sedang dibuka.
- Upload, SMTP OTP, scraper, dan backup terjadwal berjalan.

## 9. Backup dan pembaruan

Simpan backup di luar VPS. Minimal buat dump harian PostgreSQL dan salin ke object storage atau komputer lain.

Pembaruan aplikasi:

```bash
cd /home/deploy/lex-integrity
git pull --ff-only
docker compose -f docker-compose.yml -f docker-compose.vps.yml build backend worker
docker compose -f docker-compose.yml -f docker-compose.vps.yml up -d backend worker
docker compose -f docker-compose.yml -f docker-compose.vps.yml ps
```

Sebelum pembaruan besar, buat snapshot VPS dan dump database. Pantau penggunaan resource dengan `docker stats`, `free -h`, dan `df -h`. Naikkan ke Lite 24GB bila memory terus berada di atas 85% atau queue/AI sering berjalan paralel.

