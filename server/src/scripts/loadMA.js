// Script untuk load hasil scraping JDIH Mahkamah Agung RI ke PostgreSQL
// Sumber: scripts/scraper/jdih_ma_scraper.py -> ma_peraturan.json
//
// Jalankan dari root server/:
//   node src/scripts/loadMA.js
//   node src/scripts/loadMA.js /path/to/custom/ma_peraturan.json

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Rule from '../models/Rule.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const SOURCE     = 'jdih.mahkamahagung.go.id';
const PROCESSOR  = 'scraper-jdih-ma';
const DEFAULT_JSON = path.join(
  __dirname, '..', '..', '..', 'scripts', 'scraper', 'ma_peraturan.json'
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Truncate a string to maxLen and append ellipsis if needed.
 */
function trunc(str, maxLen = 500) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str;
}

/**
 * Map satu baris JSON scraper ke kolom tabel rules.
 */
function mapRow(r, idx) {
  // rule_code wajib unik — gunakan yang sudah ada dari scraper,
  // bersihkan kalau terlalu panjang
  const rawCode = (r.rule_code || `MA-UNKNOWN-${idx}`).trim();
  const ruleCode = rawCode.length > 100 ? rawCode.slice(0, 97) + '...' : rawCode;

  return {
    rule_code:          ruleCode,
    title:              trunc(r.title || '(Tanpa Judul)', 500),
    category:           r.category  || 'Peraturan MA',
    regime:             r.regime    || 'Nasional',
    publish_date:       r.publish_date || null,
    pdf_url:            r.pdf_url   || null,
    source:             SOURCE,
    is_active:          typeof r.is_active === 'boolean' ? r.is_active : true,
    processed_at:       new Date().toISOString(),
    processed_by:       PROCESSOR,
    processing_method:  'scrape',
  };
}

// ---------------------------------------------------------------------------
// Main loader
// ---------------------------------------------------------------------------
async function loadMA(jsonPath = DEFAULT_JSON) {
  // Validasi file
  if (!fs.existsSync(jsonPath)) {
    console.error(`File tidak ditemukan: ${jsonPath}`);
    console.error('Jalankan scraper dulu:');
    console.error('  cd scripts/scraper');
    console.error('  python jdih_ma_scraper.py --no-pdf --output-json ma_peraturan.json');
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

  // Filter baris yang punya title
  const rows = raw
    .filter((r, i) => {
      if (!r || !r.title) {
        console.warn(`  Skip baris ${i}: tidak ada title`);
        return false;
      }
      return true;
    })
    .map((r, i) => mapRow(r, i));

  console.log(`Baris siap di-import: ${rows.length}`);

  // Sync model (no alter — schema dikelola manual via schema.sql)
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

  // Summary
  const totalDB = await Rule.count();
  const fromMA  = await Rule.count({ where: { source: SOURCE } });

  console.log('\n=== Hasil Import JDIH MA ===');
  console.log(`Inserted : ${inserted}`);
  console.log(`Updated  : ${updated}`);
  console.log(`Failed   : ${failed}`);
  if (failed > 10) console.log(`  (dan ${failed - 10} error lainnya tidak ditampilkan)`);
  console.log(`\nTotal rules di DB        : ${totalDB}`);
  console.log(`Dari ${SOURCE} : ${fromMA}`);

  process.exit(failed > 0 && inserted + updated === 0 ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
const jsonArg = process.argv[2];
loadMA(jsonArg || DEFAULT_JSON);
