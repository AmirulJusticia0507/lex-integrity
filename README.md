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

---

## 🚀 Panduan Ingestion & Scraping PDF Aturan

### 1. Prasyarat Scraping (Python 3.10+)

```bash
pip install requests beautifulsoup4 playwright pytesseract pdf2image
playwright install

2. Menjalankan Scraper Peraturan

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
