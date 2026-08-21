// Import UN ILC docs dari JSON ke PostgreSQL
const fs = require('fs');
const path = require('path');
const Rule = require('../models/Rule');
const sequelize = require('../config/database');

const JSON_FILE = path.join(__dirname, '..', '..', '..', 'scripts', 'scraper', 'un_ilc_docs.json');
const SOURCE = 'legal.un.org/ilc';

function makeRuleCode(symbol, sessionNumber, year) {
  // Symbol format: A/CN.4/782, A/CN.4/L.1004/Rev.1, etc.
  const clean = symbol.replace(/[^\w]/g, '_');
  return `ILC-${year}-${sessionNumber}-${clean}`.slice(0, 100);
}

function mapDocTypeToCategory(docType) {
  switch (docType) {
    case 'General': return 'General Document';
    case 'Limited': return 'Limited Document';
    case 'SummaryRecord': return 'Summary Record';
    default: return 'Document';
  }
}

async function importUnIlc() {
  try {
    console.log('Reading JSON file...');
    if (!fs.existsSync(JSON_FILE)) {
      throw new Error(`File not found: ${JSON_FILE}`);
    }
    const docs = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
    console.log(`Loaded ${docs.length} documents`);

    await sequelize.authenticate();
    console.log('Database connected');
    await Rule.sync();

    const mapped = docs
      .filter(d => d && d.symbol && d.title)
      .map(d => ({
        rule_code: makeRuleCode(d.symbol, d.session_number, d.session_year),
        title: d.title.length > 500 ? d.title.slice(0, 497) + '...' : d.title,
        category: mapDocTypeToCategory(d.doc_type),
        regime: 'International Law Commission (UN)',
        publish_date: null, // ILC docs don't have simple publish dates
        content: JSON.stringify({
          symbol: d.symbol,
          doc_type: d.doc_type,
          session_year: d.session_year,
          session_number: d.session_number,
          session_label: d.session_label,
          additional_docs: d.additional_docs,
          source_url: d.source_url,
          scraped_at: d.scraped_at
        }, null, 2),
        derived_rules: {
          symbol: d.symbol,
          doc_type: d.doc_type,
          session_year: d.session_year,
          session_number: d.session_number,
          session_label: d.session_label,
          additional_docs: d.additional_docs,
          pdf_url: d.pdf_url
        },
        is_active: true,
        pdf_url: d.pdf_url,
        source: SOURCE,
        processed_at: new Date().toISOString(),
        processed_by: 'import-un-ilc-scraper',
        processing_method: 'scrape_import',
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
    const ilc = await Rule.count({ where: { source: SOURCE } });
    console.log(`\nSelesai. Inserted: ${inserted}, Updated: ${updated}, Failed: ${failed}`);
    console.log(`Total rules di DB: ${total}, dari ILC: ${ilc}`);

    process.exit(0);
  } catch (error) {
    console.error('Error saat import:', error);
    process.exit(1);
  }
}

importUnIlc();