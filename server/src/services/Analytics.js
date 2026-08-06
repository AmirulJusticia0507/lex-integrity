// Analytics utilities
const Rule = require('./Rule');

const getAnalytics = async () => {
  const overview = await Promise.all([
    Rule.countDocuments(),
    Rule.aggregate([{ $group: { _id: '$regime', count: { $sum: 1 } } }]),
    Rule.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    Rule.aggregate([{ $group: { _id: null, avgViews: { $avg: '$view_count' } } }]),
    Rule.aggregate([
      { $group: { _id: '$category', avgLoopholes: { $avg: { $size: '$loopholes' } } } }
    ])
  ]);
  
  return {
    total_rules: overview[0],
    rules_by_regime: overview[1],
    rules_by_category: overview[2],
    average_views: overview[3][0]?.avgViews || 0,
    average_loopholes_by_category: overview[4]
  };
};

const getRecentRules = async (limit = 5) => {
  return await Rule.find()
    .sort({ created_at: -1 })
    .limit(limit)
    .select('rule_code title regime category created_at view_count');
};

module.exports = {
  getAnalytics,
  getRecentRules
};