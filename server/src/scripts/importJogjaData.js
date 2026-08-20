const { sequelize, Rule } = require('../models');
const fs = require('fs');
const path = require('path');

const SOURCE = 'jogja.prov.go.id';
const BATCH_SIZE = 500;

async function importData(filePath) {
  try {
    await sequelize.authenticate();
    console.log('DB connected');

    const ext = path.extname(filePath).toLowerCase();
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      process.exit(1);
    }

    if (ext === '.json') {
      await importFromJSON(filePath);
    } else if (ext === '.sql') {
      await importFromSQL(filePath);
    } else {
      console.error('Unsupported format. Use .json or .sql');
      process.exit(1);
    }

    process.exit(0);
  } catch (err) {
    console.error('Import error:', err);
    process.exit(1);
  }
}

async function importFromJSON(filePath) {
  console.log('Reading JSON...');
  const content = fs.readFileSync(filePath, 'utf8');
  const records = JSON.parse(content);
  console.log(`Total records to import: ${records.length}`);

  // Clear existing
  console.log('Clearing existing Jogja data...');
  await Rule.destroy({ where: { source: 'jogja.prov.go.id' } });

  let imported = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await Rule.bulkCreate(batch, { 
      updateOnDuplicate: [
        'title', 'regime', 'category', 'content', 'is_active', 
        'publish_date', 'pdf_url', 'slug', 'view_count', 
        'download_count', 'processed_at', 'processed_by', 'processing_method'
      ],
      validate: false 
    });
    imported += batch.length;
    console.log(`Imported ${imported}/${records.length}`);
  }
  console.log('JSON import complete!');
}

async function importFromSQL(filePath) {
  console.log('Reading SQL...');
  const content = fs.readFileSync(filePath, 'utf8');
  const statements = content.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));

  console.log(`Executing ${statements.length} statements...`);
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (stmt) {
      try {
        await sequelize.query(stmt);
        if (i % 1000 === 0) console.log(`Executed ${i}/${statements.length}`);
      } catch (e) {
        console.warn(`Statement ${i} failed (ignored):`, e.message);
      }
    }
  }
  console.log('SQL import complete!');
}

// Usage: node importJogjaData.js <file-path>
const fileArg = process.argv[2];
if (!fileArg) {
  console.log('Usage: node importJogjaData.js <path-to-json-or-sql>');
  console.log('Example: node importJogjaData.js exports/jogja_12345.json');
  process.exit(1);
}

importData(fileArg);