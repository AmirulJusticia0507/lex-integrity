// Service for business logic
import { Op } from 'sequelize';
import Rule from '../models/Rule.js';

export const searchRules = async (filters) => {
  const {
    search,
    regime,
    category,
    limit = 20,
    page = 1
  } = filters;
  
  const where = {};
  
  if (search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { content: { [Op.iLike]: `%${search}%` } },
      { rule_code: { [Op.iLike]: `%${search}%` } }
    ];
  }
  
  if (regime) where.regime = regime;
  if (category) where.category = category;
  
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  const { count, rows: rules } = await Rule.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    offset,
    limit: parseInt(limit)
  });
  
  return {
    rules,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil(count / limit)
    }
  };
};

export const getRuleByCode = async (rule_code) => {
  const rule = await Rule.findOne({ where: { rule_code } });
  if (!rule) {
    throw new Error('Peraturan tidak ditemukan');
  }
  
  await Rule.update(
    { view_count: rule.view_count + 1 },
    { where: { rule_code } }
  );
  
  return rule;
};

export default {
  searchRules,
  getRuleByCode
};

