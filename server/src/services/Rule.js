// Service for business logic
const Rule = require('../models/Rule');
const { getAnalytics, getRecentRules } = require('./Analytics');

const searchRules = async (filters) => {
  const {
    search,
    regime,
    category,
    limit = 20,
    page = 1
  } = filters;
  
  const filter = {};
  
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { content: { $regex: search, $options: 'i' } },
      { rule_code: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (regime) filter.regime = regime;
  if (category) filter.category = category;
  
  const skip = (page - 1) * limit;
  
  const [rules, total] = await Promise.all([
    Rule.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Rule.countDocuments(filter)
  ]);
  
  return {
    rules,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

const getRuleByCode = async (rule_code) => {
  const rule = await Rule.findOne({ rule_code });
  if (!rule) {
    throw new Error('Peraturan tidak ditemukan');
  }
  
  await Rule.updateOne({ rule_code }, { $inc: { view_count: 1 } });
  
  return rule;
};

module.exports = {
  searchRules,
  getRuleByCode
};