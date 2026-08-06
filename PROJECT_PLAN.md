# Lex-Integrity Project Plan
## Fase 1: Perencanaan & Pengaturan

### Overview
Platform analisis integritas hukum dan pelacak kontradiksi regulasi otomatis berbasis MERN Stack dan Local LLM (100% Offline & Free). Sistem ini dirancang untuk memetakan hierarki aturan hukum Indonesia dari era awal hingga era Presiden Prabowo Subianto.

### Tujuan Utama
1. Scraping otomatis PDF aturan dari JDIHN, DPR, Setneg, DPRD, dan Pemprov
2. Mendeteksi celah diskresi (*abuse of power*) menggunakan Local LLM
3. Menganalisis dampak kebijakan dan merekomendasikan sanksi
4. Menyediakan visualisasi hierarki interaktif

### Aspek Etika Penting
- **Kepatuhan hukum**: Semua scraping mematuhi lisensi terbuka JDIHN
- **Otomatisasi LLM lokal**: Tanpa biaya API, tanpa data yang dikirim ke pihak ketiga
- **Transparansi**: Dokumentasi lengkap prompt dan keputusan LLM
- **Aksesibilitas**: UI yang ramah pengguna dengan dukungan multi-bahasa

### Teknologi Stack yang Direkomendasikan

#### Backend (Node.js)
```javascript
- Express.js (v4.18+)
- MongoDB v7.0 Atlas + Local Vector Index
- BullMQ (Job Queue)
- Redis (Caching & Pub/Sub)
- Ollama (Local LLM: deepseek-r1:14b)
- Docker & Docker Compose
```

#### Frontend (React)
```javascript
- React.js v18+
- Tailwind CSS v3+
- @xyflow/react (React Flow)
- Recharts (Grafik)
- Socket.io-client (Real-time)
```

#### Python Pipeline
```python
- Python 3.10+
- Playwright (Web Scraping)
- BeautifulSoup4 (HTML Parsing)
- PyTesseract + pdf2image (OCR)
- requests, aiohttp (HTTP Client)
- asyncio (Concurrency)
```

### Dokumen Referensi

#### 1. README.md
**Fokus**: Ringkasan proyek, fitur utama, panduan quick start, dan panduan scraping PDF hukum.

#### 2. guideline.md
**Fokus**: Panduan arsitektur sistem, alur pemrosesan RAG lokal, dan penanganan dokumen PDF.

#### 3. forms.md
**Fokus**: Spesifikasi form pencarian/query dan form pengunggahan PDF.

#### 4. graph.md
**Fokus**: Visualisasi node hubungan antar pasal menggunakan React Flow / Cytoscape.js.

#### 5. style.md
**Fokus**: UI/UX Design System dengan gaya *Civic Intelligence Command Center*.

#### 6. table.md
**Fokus**: Struktur tabel visual di React dan Skema MongoDB Collection.

#### 7. requirements.md
**Fokus**: Persyaratan hardware dan software untuk infrastruktur LLM lokal.

#### 8. CODE_OF_CONDUCT.md
**Fokus**: Prinsip etika untuk pengembangan dan penggunaan data hukum.

### Diagram Arsitektur Sistem

```
[ JDIH / Setneg / DPR PDFs ]
          │
          ▼
[ Python Scraper / OCR Engine ] ──► Raw PDFs & Cleaned Text
          │
          ▼
[ Express & BullMQ Ingestion Queue ]
          │
          ▼
[ Ollama Local LLM (RAG Engine) ] ──► Chunking, Vector Embeddings & Structured JSON
          │
          ▼
[ MongoDB Atlas / Vector Index ] ──► Graph Store & Audit Logs
          │
          ▼
[ React Command Center UI ] ──► Interactive Graph, Matrix Table & Analytics
```

### Fitur Implementasi Per Fase

#### Fase 1A: Core Infrastructure
✅ [x] Direktori struktur (`server/`, `client/`, `scripts/`, `docs/`)  
✅ [x] Package.json files dengan dependensi yang tepat  
✅ [x] Docker Compose setup dengan MongoDB & Redis  
✅ [x] .env.example file dengan konfigurasi  
✅ [x] CODE_OF_CONDUCT.md dengan pedoman etika  

#### Fase 1B: Backend API
✅ [x] Express.js server dengan middleware security  
✅ [x] MongoDB connection dengan Schema rules  
✅ [x] API endpoints untuk CRUD rules dan analytics  
✅ [x] BullMQ queue untuk pemrosesan LLM background  
✅ [x] Health check endpoint dan monitoring  

#### Fase 1C: Frontend Structure
✅ [x] React.js dengan Router untuk multi-page app  
✅ [x] Config theme dan API endpoints  
✅ [x] Komponen UI dasar (Navigation, Loading, Error boundaries)  
✅ [x] Halaman Dashboard dengan stats overview  

#### Fase 2A: Database Setup
✅ [x] MongoDB dengan collection rules  
✅ [x] Schema dengan semua field yang dibutuhkan  
✅ [x] Seed data dengan contoh peraturan  
✅ [x] Index untuk query performance  

#### Fase 2B: Queue System  
✅ [x] BullMQ untuk ingestion dan processing  
✅ [x] Worker untuk LLM analysis (RAG pipeline)  
✅ [x] Queue statistics dan monitoring  

#### Fase 3A: JDIHN API Scraper
✅ [x] jdih_api_scraper.py dengan retry logic  
✅ [x] Rate limiting dan error handling  
✅ [x] Session management dengan proxy rotation  
✅ [x] JSON output dan PDF download  

#### Fase 3B: DPR HTML Scraper
✅ [x] dpr_html_scraper.py dengan BeautifulSoup  
✅ [x] Ekstrak metadata dan content  
✅ [x] Handle multiple page layouts  
✅ [x] Save dalam format terstruktur  

#### Fase 3C: OCR Processor
✅ [x] ocr_processor.py untuk PDF scan/image  
✅ [x] Integration dengan Tesseract dan pdf2image  
✅ [x] Text extraction dan cleaning  
✅ [x] Save ke JSON format  

### Dependencies Management

#### Backend Dependencies (server/package.json)
```json
{
  "name": "lex-integrity-api",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^8.5.1",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.7.0",
    "redis": "^4.6.0",
    "bull": "^4.8.0",
    "dotenv": "^16.3.1",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "node-cron": "^3.0.0"
  }
}
```

#### Frontend Dependencies (client/package.json)
```json
{
  "name": "lex-integrity-client",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "axios": "^1.6.0",
    "socket.io-client": "^4.7.2",
    "@xyflow/react": "^11.8.0",
    "recharts": "^2.8.0",
    "date-fns": "^2.30.0",
    "tailwindcss": "^3.4.1"
  }
}
```

#### Python Dependencies
```bash
pip install requests beautifulsoup4 playwright pytesseract pdf2image
playwright install
```

### Pengembangan & Testing

#### Local Development
```bash
# Mulai database dan Redis
 docker-compose up -d

# Jalankan backend
 cd server && npm run dev

# Jalankan frontend
 cd client && npm start

# Gunakan concurrently untuk keduanya
 npm run dev
```

#### Testing
```bash
# Test backend
 cd server && npm test

# Test frontend
 cd client && npm test

# Lint code
 npm run lint
```

### Validasi & Verifikasi

#### 1. Health Checks
- Endpoint `/api/health` memverifikasi MongoDB dan Redis
- Health checks otomatis untuk Docker containers

#### 2. Data Integrity
- Verifikasi schema untuk semua aturan yang disimpan
- Validasi untuk field yang wajib (rule_code, title, content)
- Integrity checks untuk relationships (derived_rules, loopholes)

#### 3. Performance
- Monitoring untuk API response time
- Queue processing metrics
- Memory usage dan database connection pooling

#### 4. Keamanan
- Rate limiting untuk semua API endpoints
- Input validation dan sanitization
- CORS configuration yang tepat
- Headers security (helmet)

### Kontinum Pengembangan

#### Iterasi 1 (Fase 1-3)
- ✅ Core infrastructure lengkap
- ✅ Basic CRUD API
- ✅ Simple search functionality
- ✅ Data ingestion dari scrapers

#### Iterasi 2 (Fase 4)
- Integrasi Ollama LLM
- RAG pipeline implementation
- Advanced search dengan semantic search
- Real-time updates

#### Iterasi 3 (Fase 5)
- Graph visualization dengan React Flow
- Interactive matrix table
- Advanced analytics dashboard
- Export functionality

#### Iterasi 4 (Fase 6)
- Full Docker deployment
- CI/CD pipeline
- Monitoring dan alerting
- Security audit

### Perkiraan Timeline

| Fase | Minggu | Hasil |
|------|--------|---------|
| Fase 1 | 2-3 | Dokumentasi lengkap, struktur dasar, API core |
| Fase 2 | 3-4 | Database, queue system, worker processes |
| Fase 3 | 4-5 | Scrapers (JDIHN, DPR, OCR), data pipeline |
| Fase 4 | 5-6 | LLM integration, RAG pipeline |
| Fase 5 | 6-7 | Frontend, graph visualization, analytics |
| Fase 6 | 7-8 | DevOps, deployment, monitoring |

### Catatan Penutup

Proyek ini membutuhkan kolaborasi antara tim backend, frontend, dan data science. Pastikan:
1. Semua kode diuji secara komprehensif
2. Dokumentasi dibuat untuk setiap komponen
3. Environment development diisolasi
4. Proses backup data terotomatisasi
5. Monitoring dan logging selalu aktif

Selesai