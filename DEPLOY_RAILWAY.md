# Deploy Backend Lex-Integrity ke Railway (5-10 menit)

Frontend sudah di Vercel: https://lex-integrity.vercel.app
Backend Express perlu di-deploy terpisah agar HP bisa connect (tidak lagi localhost:3000).

## 1. Push sudah done
Commit `9cc6644` sudah di `main` — Vercel auto-redeploy.

## 2. Railway — Deploy Backend
1. Buka https://railway.app → Login dengan GitHub → **New Project** → **Deploy from GitHub repo** → pilih `AmirulJusticia0507/lex-integrity`
2. Railway akan detect `railway.json` + `nixpacks.toml` (sudah aku siapkan). Jika ditanya Root Directory, biarkan **/** (root).
3. Klik service backend → **Settings** → **Root Directory** kosongkan (atau `server` jika build gagal), **Start Command** sudah `npm start --prefix server`.
4. **Add Plugin** → **PostgreSQL**: Railway → New → Database → Add PostgreSQL → akan otomatis inject `DATABASE_URL`
5. **Add Plugin** → **Redis**: New → Database → Add Redis → otomatis inject `REDIS_URL`
6. **Variables** → Add (di service backend):
   ```
   NODE_ENV=production
   JWT_SECRET=<isi random 32 char, misal: k8sJ9...Pakai: openssl rand -hex 32>
   CORS_ORIGIN=https://lex-integrity.vercel.app
   TWILIO_ACCOUNT_SID=ACxxx (jika sudah ada)
   TWILIO_AUTH_TOKEN=xxx
   TWILIO_PHONE_NUMBER=+1xxx
   DB_SSL=true
   ```
   `DATABASE_URL` dan `REDIS_URL` tidak perlu isi manual (sudah dari plugin).
7. **Deploy** → tunggu sampai **Healthcheck /health** hijau. Klik **Settings → Domains → Generate Domain** → copy URL misal `https://lex-integrity-production.up.railway.app`
8. Test di browser/HP: `https://xxx.up.railway.app/health` harus return JSON `{"redis":"connected","database":"connected",...}`

## 3. Vercel — Sambungkan Frontend ke Backend
1. Buka https://vercel.com/dashboard → pilih project `lex-integrity` → **Settings** → **Environment Variables**
2. **Add** → Key: `REACT_APP_API_URL` → Value: `https://xxx.up.railway.app` (URL Railway tanpa trailing slash, tanpa `/api`)
   - Centang **Production + Preview + Development**
   - Save
3. **Deployments** → pilih deployment terbaru (9cc6644) → **⋯ → Redeploy** → tunggu selesai
4. Buka `https://lex-integrity.vercel.app/login` di HP → login harus berhasil. Cek DevTools HP: Network → `/api/auth/login` harus ke `xxx.up.railway.app` bukan `localhost`.

## 4. Jika masih "Tidak terhubung ke server"
- Cek Vercel → Deployment → Build Logs → pastikan env terbaca
- Cek Railway → Deploy Logs → pastikan tidak error `ECONNREFUSED` DB/Redis
- Cek HP → buka `https://xxx.up.railway.app/health` langsung — kalau 404, domain salah
- Cek CORS: Railway Variables `CORS_ORIGIN` harus persis `https://lex-integrity.vercel.app` (tanpa slash)

## 5. Seed Data (opsional)
Jika DB kosong:
Railway → service backend → **Variables** → tambahkan `DATABASE_URL` sudah ada → lewat Railway CLI atau lokal:
```
DATABASE_URL=xxx npm run seed --prefix server
```

---
Siap. Setelah step 2 & 3 selesai, HP akan bisa login.
