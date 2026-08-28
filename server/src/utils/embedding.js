// Utilitas embedding — placeholder karena modul lama tidak tersedia.
// Diganti dengan fungsi sederhana agar RAGService tetap bekerja.
export function getEmbedding(text) {
  if (!text) return [];
  const words = String(text).toLowerCase().split(/\W+/).filter(Boolean);
  const map = {};
  words.forEach(w => { map[w] = (map[w] || 0) + 1; });
  return Object.entries(map).map(([token, count]) => ({ token, count }));
}

export default { getEmbedding };

