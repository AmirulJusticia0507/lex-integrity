// Script untuk seed data aturan
const seedData = require('../../../scripts/seedData');
const Rule = require('../models/Rule');

const seedDatabase = async () => {
  try {
    await Rule.sync({ alter: true });
    
    // Hapus semua data aturan yang ada
    await Rule.destroy({ truncate: true });
    console.log('Data dihapus');
    
    // Insert data baru
    const dataToInsert = Array.isArray(seedData) ? seedData : (seedData.rules || []);
    const insertedRules = await Rule.bulkCreate(dataToInsert);
    console.log(`Database berhasil di-seed: ${insertedRules.length} aturan ditambahkan`);
    
    // Verifikasi data
    const count = await Rule.count();
    console.log(`Total aturan dalam database: ${count}`);
    
    // Tampilkan beberapa contoh
    const samples = await Rule.findAll({ limit: 5 });
    console.log('Contoh aturan:');
    samples.forEach(rule => {
      console.log(`- ${rule.rule_code}: ${rule.title}`);
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error saat seed database:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;