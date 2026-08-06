# ⚙️ Technical Requirements & Stack

## 🖥️ Recommended Hardware (Local LLM Infrastructure)
- **CPU**: Intel Core i7 12th Gen / AMD Ryzen 7 5000 Series ke atas.
- **RAM**: Minimum 32 GB (Disarankan 64 GB untuk RAG multi-dokumen).
- **GPU**: NVIDIA VRAM 12GB+ (RTX 3060 12GB / RTX 4070) untuk menjalankan Ollama secara *low latency*.
- **Storage**: 1 TB NVMe SSD.

## 📦 Software & Tools
- **Node.js**: v20.x+ & Express.js
- **Database**: MongoDB v7.0 (Vector Search) & Redis v7.2
- **Local AI Engine**: Ollama (`deepseek-r1:14b` / `llama3.1:8b`)
- **Python Pipeline**: Python 3.10+, Playwright, BeautifulSoup4, PyTesseract
- **Frontend**: React.js v18, Tailwind CSS, `@xyflow/react` (React Flow)