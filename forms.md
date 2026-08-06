---

## 📄 5. `forms.md`
> **Fokus:** Spesifikasi form pencarian/query dan form pengunggahan PDF.

```markdown
# 📝 Form Specifications

## 1. Dynamic Search & Audit Query Form
- **Keyword / Nomor UU**: Text input (misal: "Izin Lahan", "UU No. 32").
- **Rezim Pemerintahan**: Multi-select (Orde Baru, Reformasi, Megawati, SBY, Jokowi, Prabowo Subianto).
- **Jenis Aturan**: Checkboxes (UU, PP, Perpres, Perda, Permen).
- **Filter Celah Risk**: Toggle Switch (*"Hanya tampilkan pasal yang terindikasi Loophole"*).

## 2. Ingestion & Reprocess Form (Admin Panel)
- **PDF Drag & Drop**: Multi-file upload area.
- **Kategori Manual**: Select Box (UU/PP/Perpres/Perda).
- **LLM Prompt Depth**: Slider (0.0 = Strict Legal Reading, 0.7 = Deep Loophole Analysis).