// Script untuk load hasil scraping JDIH Kemendagri ke PostgreSQL
// Sumber: scripts/scraper/jdih_kemendagri_scraper.py -> kemendagri_peraturan.json
//
// Jalankan dari root server/:
//   node src/scripts/loadKemendagri.js
//   node src/scripts/loadKemendagri.js /path/to/custom/kemendagri_peraturan.json

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Rule from '../models/Rule.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const SOURCE    = 'jdih.kemendagri.co';
const PROCESSOR = 'scraper-jdih-kemendagri';
const DEFAULT_JSON = path.join(
  __dirname, '..', '..', '..', 'scripts', 'scraper', 'kemendagri_peraturan.json'
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function trunc(str, maxLen = 500) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str;
}

/**
 * Normalisasi kategori Kemendagri ke label baku.
 */
function normalizeCategory(raw) {
  if (!raw) return 'Peraturan Kemendagri';
  const lower = raw.toLowerCase().trim();

  if (lower.startsWith('uu') || lower.includes('undang-undang'))
    return 'Undang-Undang';
  if (lower.includes('perpu') || lower.includes('pengganti undang-undang'))
    return 'Peraturan Pemerintah Pengganti UU';
  if (lower.includes('peraturan pemerintah') || lower.startsWith('pp'))
    return 'Peraturan Pemerintah';
  if (lower.includes('peraturan presiden') || lower.startsWith('perpres'))
    return 'Peraturan Presiden';
  if (lower.includes('peraturan menteri') || lower.includes('permendagri'))
    return 'Peraturan Menteri Dalam Negeri';
  if (lower.includes('keputusan menteri') || lower.includes('kepmendagri'))
    return 'Keputusan Menteri Dalam Negeri';
  if (lower.includes('surat edaran') || lower.startsWith('se'))
    return 'Surat Edaran';
  if (lower.includes('instruksi'))
    return 'Instruksi Menteri Dalam Negeri';
  if (lower.includes('peraturan daerah') || lower.startsWith('perda'))
    return 'Peraturan Daerah';
  return raw.trim() || 'Peraturan Kemendagri';
}

/**
 * Tentukan regime berdasarkan tahun terbit.
 * Kemendagri mencakup peraturan lintas rezim pemerintahan.
 */
function deriveRegime(publishDate) {
  if (!publishDate) return 'Nasional';
  const year = parseInt(publishDate.slice(0, 4), 10);
  if (isNaN(year)) return 'Nasional';
  if (year >= 2014) return 'Jokowi';
  if (year >= 2009) return 'SBY II';
  if (year >= 2004) return 'SBY I';
  if (year >= 2001) return 'Megawati';
  if (year >= 1999) return 'Gus Dur';
  if (year >= 1998) return 'Habibie';
  return 'Orde Baru';
}

function mapRow(r, idx) {
  const rawCode  = (r.rule_code || `KEMENDAGRI-UNKNOWN-${idx}`).trim();
  const ruleCode = rawCode.length > 100 ? rawCode.slice(0, 97) + '...' : rawCode;

  const publishDate = r.publish_date || null;

  return {
    rule_code:         ruleCode,
    title:             trunc(r.title || '(Tanpa Judul)', 500),
    category:          normalizeCategory(r.category),
    regime:            r.regime || deriveRegime(publishDate),
    publish_date:      publishDate,
    pdf_url:           r.pdf_url || null,
    source:            SOURCE,
    is_active:         typeof r.is_active === 'boolean' ? r.is_active : true,
    processed_at:      new Date().toISOString(),
    processed_by:      PROCESSOR,
    processing_method: 'scrape',
  };
}

// ---------------------------------------------------------------------------
// Main loader
// ---------------------------------------------------------------------------
async function loadKemendagri(jsonPath = DEFAULT_JSON) {
  if (!fs.existsSync(jsonPath)) {
    console.error(`File tidak ditemukan: ${jsonPath}`);
    console.error('Jalankan scraper dulu:');
    console.error('  cd scripts/scraper');
    console.error('  python jdih_kemendagri_scraper.py --no-pdf --output-json kemendagri_peraturan.json');
    process.exit(1);
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch (err) {
    console.error(`Gagal parse JSON: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(raw)) {
    console.error('Format JSON tidak valid — harus array of objects');
    process.exit(1);
  }

  console.log(`File: ${jsonPath}`);
  console.log(`Total baris di JSON: ${raw.length}`);

  // Breakdown per kategori sebelum import
  const catCounts = {};
  for (const r of raw) {
    const cat = normalizeCategory(r?.category);
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }
  console.log('Breakdown kategori:');
  for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(45)} : ${count}`);
  }

  const rows = raw
    .filter((r, i) => {
      if (!r || !r.title) {
        console.warn(`  Skip baris ${i}: tidak ada title`);
        return false;
      }
      return true;
    })
    .map((r, i) => mapRow(r, i));

  console.log(`\nBaris siap di-import: ${rows.length}`);

  try {
    await Rule.sync({ force: false, alter: false });
  } catch (err) {
    console.warn(`Rule.sync warning: ${err.message}`);
  }

  let inserted = 0;
  let updated  = 0;
  let failed   = 0;
  const failLog = [];

  for (const row of rows) {
    try {
      const existing = await Rule.findOne({ where: { rule_code: row.rule_code } });
      if (existing) {
        await Rule.update(row, { where: { rule_code: row.rule_code } });
        updated++;
      } else {
        await Rule.create(row);
        inserted++;
      }
    } catch (err) {
      failed++;
      const msg = `${row.rule_code}: ${err.message}`;
      failLog.push(msg);
      if (failLog.length <= 10) {
        console.error(`  Gagal: ${msg}`);
      }
    }
  }

  const totalDB       = await Rule.count();
  const fromKemendagri = await Rule.count({ where: { source: SOURCE } });

  console.log('\n=== Hasil Import JDIH Kemendagri ===');
  console.log(`Inserted : ${inserted}`);
  console.log(`Updated  : ${updated}`);
  console.log(`Failed   : ${failed}`);
  if (failed > 10) console.log(`  (dan ${failed - 10} error lainnya tidak ditampilkan)`);
  console.log(`\nTotal rules di DB              : ${totalDB}`);
  console.log(`Dari ${SOURCE} : ${fromKemendagri}`);

  process.exit(failed > 0 && inserted + updated === 0 ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
const jsonArg = process.argv[2];
loadKemendagri(jsonArg || DEFAULT_JSON);
