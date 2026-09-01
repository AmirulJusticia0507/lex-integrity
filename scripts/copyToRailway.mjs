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

// Ambil kolom yang ada di remote untuk hindari mismatch (embedding dll)
async function getRemoteColumns(client, table) {
  const { rows } = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1`, [table]);
  return new Set(rows.map(r => r.column_name));
}

const tables = ['users', 'roles', 'rules'];
for (const table of tables) {
  try {
    const { rows } = await local.query(`SELECT * FROM ${table}`);
    console.log(`[${table}] local: ${rows.length} rows`);
    if (rows.length === 0) continue;
    const remoteCols = await getRemoteColumns(remote, table);
    console.log(`[${table}] remote cols: ${[...remoteCols].join(',')}`);
    // truncate remote then insert
    await remote.query(`TRUNCATE ${table} RESTART IDENTITY CASCADE`);
    // Batch insert 500 rows biar cepat via public proxy
    const BATCH = 500;
    let ok = 0;
    const sampleCols = Object.keys(rows[0]).filter(c => remoteCols.has(c));
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const cols = sampleCols;
      const values = [];
      const placeholders = batch.map((row, bi) => {
        const rowVals = cols.map(c => {
          let v = row[c];
          if (table === 'roles' && c === 'permissions' && typeof v === 'object') v = JSON.stringify(v);
          values.push(v);
          return `$${values.length}`;
        });
        return `(${rowVals.join(',')})`;
      }).join(',');
      await remote.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${placeholders}`, values);
      ok += batch.length;
      console.log(`[${table}] ${ok}/${rows.length}`);
    }
    console.log(`[${table}] copied ${ok}/${rows.length}`);
  } catch (e) {
    console.log(`[${table}] skip: ${e.message}`);
    console.error(e);
  }
}
await local.end();
await remote.end();
console.log('Done');
