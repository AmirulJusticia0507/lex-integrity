import fs from 'fs';
import pg from 'pg';
const { Client } = pg;

const railwayUrl = process.env.RAILWAY_DATABASE_URL;
if (!railwayUrl) { console.error('Set RAILWAY_DATABASE_URL'); process.exit(1); }
const remote = new Client({ connectionString: railwayUrl, ssl: { rejectUnauthorized: false } });
await remote.connect();

// kumpulkan semua file
const files = [
  'scripts/scraper/sleman_rules.json',
  'scripts/scraper/un_ilc_docs.json',
  'scripts/exports/source_jdih_kemlu_go_id_2026-08-21T03-14-32.json',
  'scripts/exports/source_legal_un_org_ilc_2026-08-21T03-14-35.json',
];
let all = [];
for (const f of files) {
  try {
    const data = JSON.parse(fs.readFileSync(f,'utf8'));
    const arr = Array.isArray(data) ? data : [data];
    console.log(`${f}: ${arr.length}`);
    all.push(...arr);
  } catch(e){ console.log(`${f} skip: ${e.message}`)}
}
console.log(`total loaded: ${all.length}`);
// dedupe by rule_code
const map = new Map();
for (const r of all) if (r.rule_code) map.set(r.rule_code, r);
console.log(`unique: ${map.size}`);
const uniq = [...map.values()];

// ambil kolom remote
const { rows: colsRows } = await remote.query(`SELECT column_name FROM information_schema.columns WHERE table_name='rules'`);
const remoteCols = new Set(colsRows.map(r=>r.column_name));
console.log('remote cols', [...remoteCols].slice(0,5), '...');

const BATCH=500;
let ok=0, skip=0;
for (let i=0;i<uniq.length;i+=BATCH){
  const batch = uniq.slice(i,i+BATCH);
  const cols = Object.keys(batch[0]).filter(c=>remoteCols.has(c));
  const values=[]; const ph=[];
  for (const row of batch){
    const rowPh = cols.map(c=>{
      let v=row[c];
      if (typeof v==='object' && v!==null) v=JSON.stringify(v);
      if (typeof v==='string' && v.length>500 && ['title','slug','rule_code'].includes(c)) v=v.slice(0,500);
      values.push(v);
      return `$${values.length}`;
    });
    ph.push(`(${rowPh.join(',')})`);
  }
  try{
    await remote.query(`INSERT INTO rules (${cols.join(',')}) VALUES ${ph.join(',')} ON CONFLICT (rule_code) DO NOTHING`, values);
    ok+=batch.length;
  }catch(e){
    console.log(`batch ${i} err: ${e.message}`);
    skip+=batch.length;
  }
  console.log(`${ok}/${uniq.length}`);
}
const { rows:[{count}]} = await remote.query('SELECT COUNT(*) FROM rules');
console.log(`Done. Railway rule_count: ${count}`);
await remote.end();
