Fokus: Ringkasan proyek, fitur utama, quick start, dan Panduan Scraping PDF Hukum.

# 🏛️ Local AI Policy & Regulatory Compliance Matrix (MERN + Local LLM)

Platform analisis integritas hukum dan pelacak kontradiksi regulasi otomatis berbasis **MERN Stack** dan **Local LLM (100% Offline & Free)**. Sistem ini dirancang untuk memetakan hirarki aturan hukum Indonesia (UU, PP, Perpres, Perda) dari era awal hingga era Presiden Prabowo Subianto, mendeteksi celah diskresi (*abuse of power*), menganalisis dampak kebijakan, serta memberikan rekomendasi sanksi secara visual.

---

## 🌟 Fitur Utama

- **Autonomous Legal Scraper Pipeline**: Otomasi unduh PDF dari JDIHN, DPR, Setneg, DPRD, dan Pemprov.
- **Local RAG & Conflict Matrix**: Memanfaatkan Local LLM (Ollama / DeepSeek / Mistral) untuk mendeteksi kontradiksi antar pasal tanpa biaya API.
- **Interactive Hierarchy Graph**: Visualisasi pohon hubungan pasal utama ke aturan turunan (PP, Perpres, Perda).
- **Discretionary Loophole & Risk Radar**: Deteksi otomatis pasal karet dan wewenang berlebih.
- **Open Audit & Visitor Tracking**: Monitoring statistik tayangan dan penelusuran publik.
- **Chat AI dengan Riwayat**: Tanya AI tentang peraturan, percakapan tersimpan di sidebar.
- **Rate Limiting Management**: Kelola batas request per endpoint via UI.
- **Export/Import Data JDIH**: Backup & restore 17k+ records Jogja JDIH.

---

## 📦 Export/Import Data JDIH Jogja (17.8k+ records)

```bash
cd server

# Export ke JSON + SQL (~17 MB each)
node src/scripts/exportJogjaData.js

# Import dari JSON (recommended - cepat, bulkCreate)
node src/scripts/importJogjaData.js exports/jogja_<timestamp>.json

# Import dari SQL
node src/scripts/importJogjaData.js exports/jogja_<timestamp>.sql
```

Files di `server/exports/` **gitignored** (terlalu besar ~35 MB total). Copy folder `exports/` manual ke server baru.

---

## 🚀 Panduan Ingestion & Scraping PDF Aturan

### 1. Prasyarat Scraping (Python 3.10+)

```bash
pip install requests beautifulsoup4 playwright pytesseract pdf2image
playwright install

### 2. Menjalankan Scraper Peraturan

# Scraping via REST API JDIHN (Setneg, Kemenkumham, Pemprov)
python scripts/scraper/jdih_api_scraper.py --instansi setneg --pages 50

# Scraping Web HTML (DPR / DPRD)
python scripts/scraper/dpr_html_scraper.py --jenis UU --tahun 1945-2026

# OCR Processing untuk PDF versi Scan/Gambar (Era Lama)
python scripts/scraper/ocr_processor.py --input ./pdf_raw --output ./pdf_text

🏗️ Quick Start Development

# 1. Start Database & Redis
docker-compose up -d

# 2. Run Local LLM Engine
ollama run deepseek-r1:14b

# 3. Start Backend & Frontend
cd server && npm run dev
cd client && npm start

---
```

### 3. Database & Schema

```bash
# Schema & seed
psql -U postgres -d lex_integrity -f server/schema.sql
psql -U postgres -d lex_integrity -f server/seed.sql
```

---

## 🔧 Environment Variables

### Server (`server/.env`)
```env
DB_NAME=lex_integrity
DB_USER=postgres
DB_PASSWORD=admin123
DB_HOST=127.0.0.1
DB_PORT=5432
JWT_SECRET=your_jwt_secret
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:14b
```

### Client (`client/.env`)
```env
PORT=8801
REACT_APP_API_URL=http://localhost:3000
```

---

## 👤 Default Users

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | admin |
| superadmin | gedangbosok | superadmin |

---

## 📁 Struktur Proyek

```
lex-integrity/
├── client/                 # React CRA + Tailwind
│   ├── src/
│   │   ├── pages/          # Dashboard, Explorer, Chat, DataMgmt, Auth
│   │   ├── components/     # Sidebar, Charts, Rules, Auth, Layout
│   │   └── store/          # Rule & Analytics context
│   └── public/             # manifest, icons
├── server/                 # Express + Sequelize
│   ├── src/
│   │   ├── models/         # Rule, User, Role, Analytics
│   │   ├── routes/         # API endpoints
│   │   ├── scripts/        # Export/Import, Load Jogja JDIH
│   │   └── middleware/     # Auth, Rate Limit
│   ├── schema.sql          # DB structure
│   ├── seed.sql            # Default roles & users
│   └── EXPORT_IMPORT_README.md
├── docker-compose.yml      # Postgres + Redis (optional)
└── README.md
```

---

## 📄 Lisensi

MIT License — bebas digunakan untuk keperluan penelitian & pengembangan hukum Indonesia.
