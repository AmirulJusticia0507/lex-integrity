Fokus: Struktur tabel visual di React dan Skema MongoDB Collection.

# 📊 Policy Compliance Matrix & Database Schema

## Matriks Analisis Pasal (React Dashboard View)
| ID Pasal | Aturan Utama | Aturan Turunan | Potensi Celah / Abuse of Power | Konsekuensi & Dampak | Rekomendasi Sanksi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `PASAL-UU-2024-01` | UU No. 1/2024 Ps. 4 | PP No. 12/2024 Ps. 8 | Diskon kewajiban Amdal via diskresi Menteri | Kerusakan kawasan resapan & konflik lahan | **Admin**: Pencabutan SK<br>**Pidana**: Ps 3 UU Tipikor |
| `PASAL-PERPRES-2025-05` | Perpres No. 5/2025 Ps. 12 | Perda No. 2/2025 Ps. 3 | Pengalihan wewenang tanpa persetujuan DPRD | Tumpang tindih alokasi APBD | **Admin**: Pembatalan via Judicial Review |

---

## MongoDB Collection Schema (`rules`)
```json
{
  "_id": "ObjectId",
  "rule_code": "UU-2024-1-P4",
  "title": "UU No. 1 Tahun 2024 Pasal 4",
  "regime": "Prabowo Subianto",
  "category": "UU",
  "content": "Teks asli isi pasal...",
  "derived_rules": [
    { "rule_code": "PP-2024-12-P8", "relation": "Implementasi_Teknis" }
  ],
  "loopholes": ["Diskresi Menteri tanpa kriteria yang jelas"],
  "impacts": ["Risiko ekologis tinggi", "Monopoli izin"],
  "sanctions": {
    "administrative": "Pencabutan SK Terkait",
    "criminal": "Pasal 3 UU Tipikor"
  },
  "view_count": 412
}