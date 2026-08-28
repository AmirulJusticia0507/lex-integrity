// Analytics utilities
import { Op } from 'sequelize';
import { sequelize } from '../models/index.js';
import Rule from '../models/Rule.js';

export const getAnalytics = async () => {
  const totalRules = await Rule.count();
  
  const rulesByRegime = await Rule.findAll({
    attributes: ['regime', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['regime'],
    raw: true
  });
  
  const rulesByCategory = await Rule.findAll({
    attributes: ['category', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['category'],
    raw: true
  });
  
  const avgViewsResult = await Rule.findOne({
    attributes: [[sequelize.fn('AVG', sequelize.col('view_count')), 'avgViews']],
    raw: true
  });
  
  const avgLoopholesByCategory = await Rule.findAll({
    attributes: [
      'category',
      [sequelize.fn('AVG', sequelize.fn('jsonb_array_length', sequelize.col('loopholes'))), 'avgLoopholes']
    ],
    group: ['category'],
    raw: true
  });
  
  return {
    total_rules: totalRules,
    rules_by_regime: rulesByRegime,
    rules_by_category: rulesByCategory,
    average_views: avgViewsResult.avgViews || 0,
    average_loopholes_by_category: avgLoopholesByCategory
  };
};

export const getRecentRules = async (limit = 5) => {
  return await Rule.findAll({
    attributes: ['rule_code', 'title', 'regime', 'category', 'created_at', 'view_count'],
    order: [['created_at', 'DESC']],
    limit
  });
};

export default {
  getAnalytics,
  getRecentRules
};