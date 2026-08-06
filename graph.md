Fokus: Visualisasi node hubungan antar pasal menggunakan React Flow / Cytoscape.js.

# 🕸️ Interactive Legal Hierarchy Graph

## Node Definition & Color Rules
1. **Root Node (UU Utama)**: Circle Biru Besar (`#38bdf8`) - Menandakan Induk Undang-Undang.
2. **Derived Node (PP / Perpres)**: Circle Hijau (`#22c55e`) - Peraturan Pelaksana Eksekutif.
3. **Local Node (Perda / Permen)**: Circle Ungu (`#a855f7`) - Aturan Daerah / Instansi.
4. **Risk / Loophole Node**: Circle Merah (`#ef4444`) - Ditemukan celah penyalahgunaan / kontradiksi.

## Edge (Garis Hubung) Attributes
- `Mandates`: Garis Solid Biru (UU memerintahkan pembuatan PP).
- `Contradicts`: Garis Merah Putus-Putus (Aturan turunan bertentangan dengan UU di atasnya).
- `Overlaps`: Garis Kuning (Tumpang tindih wewenang).