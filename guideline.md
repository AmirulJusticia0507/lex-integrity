## 📄 2. `guideline.md`
> **Fokus:** Panduan arsitektur sistem, alur pemrosesan RAG lokal, dan penanganan dokumen PDF.

```markdown
# 📐 Technical & System Guidelines

## 1. System Architecture Workflow
```text
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

2. Document Chunking & Ingestion Strategy
Chunking Strategy: Memotong PDF berdasarkan pasal/bab (maksimal 500–1000 token per chunk) dengan menyertakan metadata (UU_NO, TAHUN, PASAL_NO, REZIM).

Local Vector Search: Menggunakan model embedding lokal (misal: bge-m3 atau nomic-embed-text di Ollama).

JSON Analysis Extraction: Mendorong LLM mengembalikan format JSON yang tervalidasi schema sebelum disimpan ke database.

---
