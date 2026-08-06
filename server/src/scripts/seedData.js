// Script untuk seed data aturan
const seedData = require('../../../scripts/seedData');
const { Rule, connectDB } = require('../models/Rule');

const seedDatabase = async () => {
  try {
    await connectDB();
    
    // Hapus semua data aturan yang ada
    await Rule.deleteMany({});
    console.log('Data dihapus');
    
    // Insert data baru
    const insertedRules = await Rule.insertMany(seedData);
    console.log(`Database berhasil di-seed: ${insertedRules.length} aturan ditambahkan`);
    
    // Verifikasi data
    const count = await Rule.countDocuments();
    console.log(`Total aturan dalam database: ${count}`);
    
    // Tampilkan beberapa contoh
    const samples = await Rule.find().limit(5);
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