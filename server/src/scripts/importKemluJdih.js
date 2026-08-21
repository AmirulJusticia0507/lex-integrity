// Script untuk import dokumen hukum dari jdih.kemlu.go.id ke PostgreSQL
const Rule = require('../models/Rule');
const sequelize = require('../config/database');

const API_URL = 'https://jdih.kemlu.go.id/panel/items/dokumen_hukum';
const SOURCE = 'jdih.kemlu.go.id';

function makeRuleCode(jenis, nomor, tahun) {
  const cleanJenis = (jenis || 'DOKUMEN').toUpperCase().replace(/\s+/g, '_');
  return `KEMLU-${cleanJenis}-${nomor}-${tahun}`;
}

function mapStatusToActive(status) {
  if (!status) return true;
  const s = status.toLowerCase();
  return !s.includes('tidak berlaku') && !s.includes('dicabut') && !s.includes('berakhir');
}

async function importKemluJdih() {
  try {
    console.log('Mengambil data dari API...');
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { data } = await response.json();
    console.log(`Ditemukan ${data.length} dokumen`);

    await sequelize.authenticate();
    console.log('Database connected');
    await Rule.sync();

    const mapped = data
      .filter(r => r && r.judul && r.nomor_dokumen && r.tahun)
      .map(r => ({
        rule_code: makeRuleCode(r.jenis_dokumen, r.nomor_dokumen, r.tahun),
        title: r.judul.length > 500 ? r.judul.slice(0, 497) + '...' : r.judul,
        category: r.jenis_dokumen || 'Peraturan',
        regime: 'Kementerian Luar Negeri',
        publish_date: r.tanggal_penetapan || r.tanggal_pengundangan || null,
        content: r.sumber || null,
        derived_rules: {
          tema: r.tema,
          keterangan: r.keterangan,
          isbn_issn: r.isbn_issn,
          pengarang: r.pengarang,
          subjek: r.subjek,
          bidang_hukum: r.bidang_hukum,
          urusan_pemerintahan: r.urusan_pemerintahan,
          peraturan_terkait: r.peraturan_terkait,
          post_tags: r.post_tags,
          dokumen_old: r.dokumen_old,
        },
        is_active: mapStatusToActive(r.status),
        pdf_url: r.dokumen_utama ? `https://jdih.kemlu.go.id/panel/items/dokumen_hukum/${r.id}/files/${r.dokumen_utama}` : null,
        source: SOURCE,
        processed_at: new Date().toISOString(),
        processed_by: 'import-kemlu-jdih-api',
        processing_method: 'api_import',
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
    const kemlu = await Rule.count({ where: { source: SOURCE } });
    console.log(`\nSelesai. Inserted: ${inserted}, Updated: ${updated}, Failed: ${failed}`);
    console.log(`Total rules di DB: ${total}, dari KEMLU: ${kemlu}`);

    process.exit(0);
  } catch (error) {
    console.error('Error saat import:', error);
    process.exit(1);
  }
}

importKemluJdih();