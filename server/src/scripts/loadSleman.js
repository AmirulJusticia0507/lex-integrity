// Script untuk load hasil scraping JDIH Sleman ke PostgreSQL
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Rule from '../models/Rule.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE = 'jdih.slemankab.go.id';

async function loadSleman(jsonPath) {
  try {
    await Rule.sync();
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // Filter hanya data dari source Sleman & map ke kolom rules
    const rows = raw
      .filter((r) => r && r.title && r.rule_code)
      .map((r) => ({
        rule_code: r.rule_code,
        title: r.title.length > 500 ? r.title.slice(0, 497) + '...' : r.title,
        category: r.category || 'Lainnya',
        regime: r.regime || null,
        publish_date: r.publish_date || null,
        pdf_url: r.pdf_url || null,
        source: SOURCE,
        is_active: typeof r.is_active === 'boolean' ? r.is_active : true,
        processed_at: new Date().toISOString(),
        processed_by: 'scraper-jdih-sleman',
        processing_method: 'scrape',
      }));

    console.log(`Total baris siap di-import: ${rows.length}`);

    // Upsert berdasarkan rule_code (hindari duplikat saat re-run)
    let inserted = 0, updated = 0, failed = 0;
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
      } catch (e) {
        failed++;
        if (failed <= 5) console.error(`Gagal import ${row.rule_code}:`, e.message);
      }
    }

    const total = await Rule.count();
    const sleman = await Rule.count({ where: { source: SOURCE } });
    console.log(`Selesai. Inserted: ${inserted}, Updated: ${updated}, Failed: ${failed}`);
    console.log(`Total rules di DB: ${total}, dari Sleman: ${sleman}`);

    process.exit(0);
  } catch (error) {
    console.error('Error saat load:', error);
    process.exit(1);
  }
}

loadSleman(path.join(__dirname, '..', '..', '..', 'scripts', 'scraper', 'sleman_rules.json'));