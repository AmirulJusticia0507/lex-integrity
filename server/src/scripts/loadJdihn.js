// Script untuk load hasil scraping JDIH Nasional (jdihn.go.id) ke PostgreSQL
const path = require('path');
const fs = require('fs');
const Rule = require('../models/Rule');

const SOURCE = 'jdihn.go.id';

function makeRuleCode(title, docId) {
  // Contoh title: "Peraturan Daerah Kabupaten Nomor 10 Tahun 2026 Tentang ..."
  const m = title.match(/Peraturan (?:Daerah|Pemerintah|Presiden|Bupati|Walikota|Gubernur|Menteri[^ ]*|Badan|Bersama)\s+.*?Nomor\s+(\d+)\s+Tahun\s+(\d{4})/i);
  if (m) return `PERATURAN-${m[1]}-${m[2]}`;
  const m2 = title.match(/Peraturan\s+(\w+)\s+Nomor\s+(\d+)\s+Tahun\s+(\d{4})/i);
  if (m2) return `PERATURAN-${m2[2]}-${m2[3]}`;
  return `JDIHN-${docId}`;
}

async function loadJdihn(jsonPath) {
  try {
    await Rule.sync();
    const rows = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    const mapped = rows
      .filter((r) => r && r.title && r.doc_id)
      .map((r) => ({
        rule_code: makeRuleCode(r.title, r.doc_id),
        title: r.title.length > 500 ? r.title.slice(0, 497) + '...' : r.title,
        category: r.type || 'Peraturan',
        regime: 'Nasional',
        publish_date: null,
        pdf_url: r.doc_id ? `https://jdihn.go.id/doc/${r.doc_id}` : null,
        source: SOURCE,
        is_active: r.status === 'Tidak Berlaku' ? false : true,
        processed_at: new Date().toISOString(),
        processed_by: 'scraper-jdihn-browser',
        processing_method: 'scrape',
      }));

    console.log(`Total baris siap di-import: ${mapped.length}`);

    let inserted = 0, updated = 0, failed = 0;
    for (const row of mapped) {
      try {
        const existing = await Rule.findOne({ where: { rule_code: row.rule_code } });
        if (existing) {
          await Rule.update(row, { where: { rule_code: row.rule_code } });
          updated++;
        } else {
          await Rule.create(row);
          inserted++;
        }
      } catch (e) {
        failed++;
        if (failed <= 5) console.error(`Gagal import ${row.rule_code}:`, e.message);
      }
    }

    const total = await Rule.count();
    const jdihn = await Rule.count({ where: { source: SOURCE } });
    console.log(`Selesai. Inserted: ${inserted}, Updated: ${updated}, Failed: ${failed}`);
    console.log(`Total rules di DB: ${total}, dari JDIHN: ${jdihn}`);

    process.exit(0);
  } catch (error) {
    console.error('Error saat load:', error);
    process.exit(1);
  }
}

loadJdihn(path.join(__dirname, '..', '..', '..', 'scripts', 'scraper', 'jdihn_docs.json'));
