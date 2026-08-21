// Export data by source to JSON + SQL
const fs = require('fs');
const path = require('path');
const Rule = require('../models/Rule');
const sequelize = require('../config/database');

const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', 'scripts', 'exports');

async function exportSource(source) {
  try {
    if (!source) {
      console.error('Usage: node exportSource.js <source>');
      console.error('Example: node exportSource.js jdih.kemlu.go.id');
      console.error('Example: node exportSource.js legal.un.org/ilc');
      process.exit(1);
    }

    await sequelize.authenticate();
    console.log('Database connected');

    const docs = await Rule.findAll({
      where: { source },
      order: [['id', 'ASC']]
    });

    if (docs.length === 0) {
      console.log(`No records found for source: ${source}`);
      process.exit(0);
    }

    console.log(`Found ${docs.length} records for ${source}`);

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeSource = source.replace(/[^\w]/g, '_');

    // Export JSON
    const jsonFile = path.join(OUTPUT_DIR, `source_${safeSource}_${timestamp}.json`);
    const jsonData = docs.map(d => d.toJSON());
    fs.writeFileSync(jsonFile, JSON.stringify(jsonData, null, 2), 'utf-8');
    console.log(`JSON exported: ${jsonFile} (${(fs.statSync(jsonFile).size / 1024 / 1024).toFixed(2)} MB)`);

    // Export SQL
    const sqlFile = path.join(OUTPUT_DIR, `source_${safeSource}_${timestamp}.sql`);
    const columns = Object.keys(docs[0].toJSON());
    const colList = columns.map(c => `"${c}"`).join(', ');

    let sql = `-- Export of ${docs.length} records from rules where source = '${source}'\n`;
    sql += `-- Generated at ${new Date().toISOString()}\n\n`;

    for (const doc of docs) {
      const values = columns.map(c => {
        const v = doc.get(c);
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
        if (v instanceof Date) return `'${v.toISOString()}'`;
        if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
        return v;
      }).join(', ');
      sql += `INSERT INTO rules (${colList}) VALUES (${values}) ON CONFLICT (rule_code) DO NOTHING;\n`;
    }

    fs.writeFileSync(sqlFile, sql, 'utf-8');
    console.log(`SQL exported: ${sqlFile} (${(fs.statSync(sqlFile).size / 1024 / 1024).toFixed(2)} MB)`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

const source = process.argv[2];
exportSource(source);