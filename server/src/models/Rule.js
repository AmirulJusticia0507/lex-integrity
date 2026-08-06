const mongoose = require('mongoose');

// Koneksi ke MongoDB
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lex_integrity';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

connectDB();

// Definisikan schema untuk aturan
const ruleSchema = new mongoose.Schema({
  // Basic metadata
  rule_code: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  regime: { type: String, required: true, index: true },
  category: { type: String, required: true, enum: ['UU', 'PP', 'Perpres', 'Perda', 'Permen', 'Lainnya'], index: true },
  content: { type: String, required: true },
  
  // Hierarchy relationships
  derived_rules: [{
    rule_code: { type: String, ref: 'Rule' },
    relation: String
  }],
  
  // Risk analysis
  loopholes: [String], // Array of identified loopholes
  impacts: [String],   // Array of potential impacts
  
  // Sanctions
  sanctions: {
    administrative: String,
    criminal: String
  },
  
  // Metadata
  publish_date: String,
  source: String, // setneg, kemenkumham, pemprov, dpr, dprd
  pdf_url: String,
  text_content: String, // Extracted text from PDF
  
  // Analytics
  view_count: { type: Number, default: 0 },
  last_viewed: Date,
  similarity_score: Number, // For RAG similarity
  
  // System fields
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  is_active: { type: Boolean, default: true }
}, {
  collection: 'rules'
});

// Index untuk pencarian teks
ruleSchema.index({ title: 'text', content: 'text' });

// Model
const Rule = mongoose.model('Rule', ruleSchema);

module.exports = {
  Rule,
  connectDB
};