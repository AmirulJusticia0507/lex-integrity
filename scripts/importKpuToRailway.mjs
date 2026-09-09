import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

const railwayUrl = process.env.RAILWAY_DATABASE_URL;
const jsonPath = process.env.KPU_JSON_PATH || path.join('scripts', 'scraper', 'kpu_peraturan.json');

if (!railwayUrl) {
  console.error('Set RAILWAY_DATABASE_URL dulu.');
  process.exit(1);
}

const items = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
const rows = items.filter((item) => item.rule_code && item.title);
const truncate = (value, max) => String(value || '').slice(0, max);

console.log(`KPU JSON: ${items.length} items`);
console.log(`Importable: ${rows.length} items`);

const client = new Client({
  connectionString: railwayUrl,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

await client.query(`
  SELECT setval(
    pg_get_serial_sequence('rules', 'id'),
    COALESCE((SELECT MAX(id) FROM rules), 1),
    true
  )
`);

let imported = 0;
for (const item of rows) {
  await client.query(
    `
      INSERT INTO rules (
        rule_code,
        title,
        regime,
        category,
        content,
        source,
        source_url,
        pdf_url,
        download_count,
        view_count,
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,NOW(),NOW())
      ON CONFLICT (rule_code) DO UPDATE SET
        title = EXCLUDED.title,
        regime = EXCLUDED.regime,
        category = EXCLUDED.category,
        content = EXCLUDED.content,
        source = EXCLUDED.source,
        source_url = EXCLUDED.source_url,
        pdf_url = EXCLUDED.pdf_url,
        download_count = EXCLUDED.download_count,
        view_count = EXCLUDED.view_count,
        is_active = true,
        updated_at = NOW()
    `,
    [
      item.rule_code,
      truncate(item.title, 500),
      'Pemilu',
      truncate(item.category || 'Peraturan Komisi', 100),
      item.title,
      item.source || 'jdih.kpu.go.id',
      item.detail_url || null,
      item.preview_url || item.download_url || null,
      Number(item.downloads || 0),
      Number(item.views || 0),
    ],
  );
  imported += 1;
  if (imported % 50 === 0 || imported === rows.length) {
    console.log(`Imported ${imported}/${rows.length}`);
  }
}

const { rows: countRows } = await client.query(
  `SELECT COUNT(*)::int AS count FROM rules WHERE source = 'jdih.kpu.go.id'`,
);
console.log(`Railway KPU rules: ${countRows[0].count}`);

await client.end();
