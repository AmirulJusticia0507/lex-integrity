/**
 * Migrasi idempoten: tambah kolom source_url pada tabel rules
 * dan backfill dari field JSON "source_url" di kolom content (hasil scraping lama).
 * Jalankan: node src/scripts/addSourceUrl.js
 */
const sequelize = require('../config/database');

(async () => {
  try {
    await sequelize.authenticate();

    const [colExists] = await sequelize.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name='rules' AND column_name='source_url'"
    );
    if (colExists.length === 0) {
      await sequelize.query('ALTER TABLE rules ADD COLUMN source_url VARCHAR(1000)');
      console.log('Kolom source_url ditambahkan.');
    } else {
      console.log('Kolom source_url sudah ada.');
    }

    // Backfill dari content JSONB hasil scraper UN ILC
    const [, meta] = await sequelize.query(`
      UPDATE rules
      SET source_url = content::jsonb->>'source_url'
      WHERE source_url IS NULL
        AND content LIKE '%"source_url"%'
        AND content::text LIKE '{%'
    `);
    console.log(`Baris di-backfill: ${meta.rowCount ?? 'ok'}`);

    // Juga ambil pdf_url dari derived_rules bila kosong sebagai sumber dokumen utama
    const [rows] = await sequelize.query(`
      SELECT rule_code, derived_rules FROM rules
      WHERE source_url IS NULL AND derived_rules::text LIKE '%pdf_url%' LIMIT 5
    `);
    console.log(`Contoh baris dengan pdf_url di derived_rules: ${rows.length}`);

    process.exit(0);
  } catch (error) {
    console.error('Migrasi gagal:', error.message);
    process.exit(1);
  }
})();
