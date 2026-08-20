const { sequelize, Rule } = require('../models');
const fs = require('fs');
const path = require('path');

const SOURCE = 'jogja.prov.go.id';
const BATCH_SIZE = 1000;
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'exports');

async function exportData() {
  try {
    await sequelize.authenticate();
    console.log('DB connected');

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Count total
    const total = await Rule.count({ where: { source: SOURCE } });
    console.log(`Total ${SOURCE} records: ${total}`);

    // Export as JSON (split by batch)
    const jsonPath = path.join(OUTPUT_DIR, `jogja_${Date.now()}.json`);
    const jsonStream = fs.createWriteStream(jsonPath);
    jsonStream.write('[\n');

    let offset = 0;
    let first = true;
    let exported = 0;

    while (offset < total) {
      const records = await Rule.findAll({
        where: { source: SOURCE },
        limit: BATCH_SIZE,
        offset,
        order: [['id', 'ASC']],
        raw: true
      });

      for (const r of records) {
        if (!first) jsonStream.write(',\n');
        first = false;
        jsonStream.write(JSON.stringify(r));
        exported++;
      }

      offset += BATCH_SIZE;
      console.log(`Exported ${exported}/${total}`);
    }

    jsonStream.write('\n]');
    jsonStream.end();

    console.log(`JSON export done: ${jsonPath}`);

    // Export as SQL INSERT (optional)
    const sqlPath = path.join(OUTPUT_DIR, `jogja_${Date.now()}.sql`);
    const sqlStream = fs.createWriteStream(sqlPath);
    sqlStream.write(`-- Jogja JDIH Export ${new Date().toISOString()}\n\n`);

    offset = 0;
    exported = 0;

    while (offset < total) {
      const records = await Rule.findAll({
        where: { source: SOURCE },
        limit: BATCH_SIZE,
        offset,
        order: [['id', 'ASC']],
        raw: true
      });

      for (const r of records) {
        const cols = Object.keys(r).join(', ');
        const vals = Object.values(r).map(v => {
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
          if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
          return v;
        }).join(', ');
        sqlStream.write(`INSERT INTO rules (${cols}) VALUES (${vals}) ON CONFLICT (rule_code) DO NOTHING;\n`);
        exported++;
      }
      offset += BATCH_SIZE;
    }

    sqlStream.end();
    console.log(`SQL export done: ${sqlPath}`);

    process.exit(0);
  } catch (err) {
    console.error('Export error:', err);
    process.exit(1);
  }
}

exportData();