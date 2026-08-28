/**
 * Hierarchy util — mengklasifikasikan peraturan ke jenjang JDIH
 * (internasional → nasional → provinsi → kabupaten/kota) dan mencari
 * peraturan terkait antar jenjang berdasarkan kemiripan kata kunci judul.
 */
export const LEVELS = ['internasional', 'nasional', 'provinsi', 'kabupaten_kota'];

export const LEVEL_LABELS = {
  internasional: 'Internasional',
  nasional: 'Nasional',
  provinsi: 'Provinsi',
  kabupaten_kota: 'Kabupaten/Kota'
};

const STOPWORDS = new Set([
  'undang', 'nomor', 'tahun', 'tentang', 'pasal', 'peraturan', 'pemerintah',
  'daerah', 'republik', 'indonesia', 'pengganti', 'perubahan', 'ketatanegaraan',
  'negara', 'presiden', 'menteri', 'ditetapkan', 'diundangkan', 'nom', 'tahu',
  'pedoman', 'pelaksanaan', 'keputusan', 'instruksi', 'ketentuan', 'umum',
  'no.', 'lhkn', 'sebagai', 'berdasarkan', 'dengan'
]);

export function getJdihLevel(rule = {}) {
  const src = String(rule.source || '').toLowerCase();
  const cat = String(rule.category || '').toLowerCase();

  // Internasional: sumber UN atau kategori traktat/konvensi
  if (/un\.org|legal\.un/.test(src) || /internasional|traktat|konvensi|treaty/.test(cat)) {
    return 'internasional';
  }
  // Kabupaten/Kota: domain kab/kota atau kategori perbup/perda kab
  if (/slemankab|kab|kota/.test(src) || /perbup|perda\s*kab|perda\s*kot|perwal/.test(cat)) {
    return 'kabupaten_kota';
  }
  // Provinsi: domain prov atau pergub/perda prov
  if (/jogjaprov|prov/.test(src) || /pergub|perda\s*prov|perda\s*istimewa|perda\s*daerah\s*istimewa/.test(cat)) {
    return 'provinsi';
  }
  // Nasional: kategori UU/PP/Perpres/Permen dkk.
  if (/^uu\b|^pp\b|^perpres|^permen|^keppres|^inpres|^tap\s*mpr|^perma|^ppns/.test(cat)) {
    return 'nasional';
  }
  // Fallback: Lainnya dianggap nasional bila tidak ada sumber lokal
  return 'nasional';
}

function extractKeywords(text = '', max = 8) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
    .slice(0, max);
}

function similarity(keywordsA, keywordsB) {
  if (!keywordsA.length || !keywordsB.length) return 0;
  const setB = new Set(keywordsB);
  const shared = keywordsA.filter((w) => setB.has(w)).length;
  return shared / Math.min(keywordsA.length, keywordsB.length);
}

/**
 * Bangun struktur hierarki untuk satu peraturan sumber.
 * @param {object} sourceRule Instance Rule (raw)
 * @param {Array} allRules Semua rule (attributes ringkas)
 */
export function buildHierarchy(sourceRule, allRules) {
  const sourceKeywords = extractKeywords(`${sourceRule.title} ${String(sourceRule.content || '').slice(0, 400)}`, 12);

  const buckets = Object.fromEntries(LEVELS.map((l) => [l, []]));

  for (const r of allRules) {
    if (r.rule_code === sourceRule.rule_code) continue;
    const kw = extractKeywords(r.title);
    const score = Math.max(
      similarity(sourceKeywords, kw),
      similarity(extractKeywords(sourceRule.title), kw)
    );
    if (score <= 0) continue;

    const level = getJdihLevel(r);
    const loopholeCount = Array.isArray(r.loopholes) ? r.loopholes.length : 0;
    buckets[level].push({
      rule_code: r.rule_code,
      title: r.title,
      category: r.category,
      regime: r.regime,
      publish_date: r.publish_date,
      similarity: Math.round(score * 100),
      loophole_count: loopholeCount,
      has_conflict_analysis: Boolean(r.processed_at)
    });
  }

  // Urutkan tiap jenjang berdasarkan skor kemiripan, ambil maksimal 6
  for (const l of LEVELS) {
    buckets[l].sort((a, b) => b.similarity - a.similarity || a.title.localeCompare(b.title));
    buckets[l] = buckets[l].slice(0, 6);
  }

  const shown = LEVELS.flatMap((l) => buckets[l]);
  return {
    source_rule: {
      rule_code: sourceRule.rule_code,
      title: sourceRule.title,
      category: sourceRule.category,
      regime: sourceRule.regime,
      level: getJdihLevel(sourceRule),
      derived_rules: Array.isArray(sourceRule.derived_rules) ? sourceRule.derived_rules : [],
      loophole_count: Array.isArray(sourceRule.loopholes) ? sourceRule.loopholes.length : 0
    },
    levels: LEVELS.map((level) => ({
      key: level,
      label: LEVEL_LABELS[level],
      rules: buckets[level]
    })),
    stats: {
      total_related: shown.length,
      with_loopholes: shown.filter((r) => r.loophole_count > 0).length
    }
  };
}

export default { getJdihLevel, buildHierarchy, LEVELS, LEVEL_LABELS };

