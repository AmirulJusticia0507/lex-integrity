import pg from 'pg';
const { Client } = pg;

const localUrl = process.env.LOCAL_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/lex_integrity';
const railwayUrl = process.env.RAILWAY_DATABASE_URL;
if (!railwayUrl) {
  console.error('Set RAILWAY_DATABASE_URL dulu. Contoh: $env:RAILWAY_DATABASE_URL="postgresql://postgres:...@...proxy.rlwy.net:1234/railway"; node scripts/copyToRailway.mjs');
  process.exit(1);
}
console.log('Local:', localUrl.replace(/:[^@]+@/, ':***@'));
console.log('Railway:', railwayUrl.replace(/:[^@]+@/, ':***@'));

const local = new Client({ connectionString: localUrl });
const remote = new Client({ connectionString: railwayUrl, ssl: { rejectUnauthorized: false } });
await local.connect();
await remote.connect();

const tables = ['users', 'roles', 'rules'];
for (const table of tables) {
  try {
    const { rows } = await local.query(`SELECT * FROM ${table}`);
    console.log(`[${table}] local: ${rows.length} rows`);
    if (rows.length === 0) continue;
    // truncate remote then insert
    await remote.query(`TRUNCATE ${table} RESTART IDENTITY CASCADE`);
    for (const row of rows) {
      const cols = Object.keys(row);
      const vals = cols.map((_, i) => `$${i+1}`);
      await remote.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${vals.join(',')})`, Object.values(row));
    }
    console.log(`[${table}] copied ${rows.length}`);
  } catch (e) {
    console.log(`[${table}] skip: ${e.message}`);
  }
}
await local.end();
await remote.end();
console.log('Done');
