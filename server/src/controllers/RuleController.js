const { Op } = require('sequelize');
const Rule = require('../models/Rule');

class RuleController {
  async getAllRules(req, res) {
    try {
      const { search, regime, category, limit = 20, page = 1, is_active } = req.query;

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
      if (is_active !== undefined) where.is_active = is_active === 'true';

      const limitNum = parseInt(limit);
      const offset = (parseInt(page) - 1) * limitNum;

      const { count, rows: rules } = await Rule.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit: limitNum,
        offset
      });

      res.json({
        success: true,
        data: rules,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total: count,
          pages: Math.ceil(count / limitNum)
        }
      });
    } catch (error) {
      console.error('Get all rules error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getRuleByCode(req, res) {
    try {
      const { rule_code } = req.params;

      const rule = await Rule.findOne({ where: { rule_code } });
      if (!rule) {
        return res.status(404).json({
          success: false,
          error: 'Peraturan tidak ditemukan'
        });
      }

      // Increment view count
      await Rule.update(
        { view_count: rule.view_count + 1, updated_at: new Date() },
        { where: { rule_code } }
      );

      const updatedRule = await Rule.findOne({ where: { rule_code } });

      res.json({
        success: true,
        data: updatedRule
      });
    } catch (error) {
      console.error('Get rule by code error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async createRule(req, res) {
    try {
      const ruleData = req.body;

      if (!ruleData.rule_code || !ruleData.title || !ruleData.content) {
        return res.status(400).json({
          success: false,
          error: 'Field wajib (rule_code, title, content) harus diisi'
        });
      }

      const existingRule = await Rule.findOne({ where: { rule_code: ruleData.rule_code } });
      if (existingRule) {
        return res.status(409).json({
          success: false,
          error: 'Peraturan dengan rule_code ini sudah ada'
        });
      }

      const newRule = await Rule.create({
        rule_code: ruleData.rule_code,
        title: ruleData.title,
        regime: ruleData.regime || 'Lainnya',
        category: ruleData.category || 'Lainnya',
        content: ruleData.content,
        loopholes: ruleData.loopholes || [],
        impacts: ruleData.impacts || [],
        sanctions: ruleData.sanctions || { administrative: '', criminal: '' },
        view_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      });

      console.log(`Rule created: ${ruleData.rule_code}`);

      res.status(201).json({
        success: true,
        message: 'Peraturan berhasil dibuat',
        data: newRule
      });
    } catch (error) {
      console.error('Create rule error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateRule(req, res) {
    try {
      const { rule_code } = req.params;
      const updates = req.body;

      const rule = await Rule.findOne({ where: { rule_code } });
      if (!rule) {
        return res.status(404).json({
          success: false,
          error: 'Peraturan tidak ditemukan'
        });
      }

      const { rule_code: _rc, id, created_at, ...safeUpdates } = updates;
      safeUpdates.updated_at = new Date();

      await Rule.update(safeUpdates, { where: { rule_code } });
      const updatedRule = await Rule.findOne({ where: { rule_code } });

      console.log(`Rule updated: ${rule_code}`);

      res.json({
        success: true,
        data: updatedRule
      });
    } catch (error) {
      console.error('Update rule error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteRule(req, res) {
    try {
      const { rule_code } = req.params;

      const deletedRule = await Rule.findOne({ where: { rule_code } });
      if (!deletedRule) {
        return res.status(404).json({
          success: false,
          error: 'Peraturan tidak ditemukan'
        });
      }

      await Rule.destroy({ where: { rule_code } });

      console.log(`Rule deleted: ${rule_code}`);

      res.json({
        success: true,
        message: 'Peraturan berhasil dihapus',
        data: deletedRule
      });
    } catch (error) {
      console.error('Delete rule error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getRuleAnalytics(req, res) {
    try {
      const sequelize = Rule.sequelize;

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

      res.json({
        success: true,
        data: {
          total_rules: totalRules,
          rules_by_regime: rulesByRegime,
          rules_by_category: rulesByCategory,
          average_views: avgViewsResult.avgViews || 0,
          average_loopholes_by_category: avgLoopholesByCategory
        }
      });
    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async searchSuggestions(req, res) {
    try {
      const { q } = req.query;
      if (!q || q.length < 2) {
        return res.json({
          success: true,
          data: []
        });
      }

      const suggestions = await Rule.findAll({
        attributes: ['title', 'rule_code', 'regime', 'category'],
        where: {
          [Op.or]: [
            { title: { [Op.iLike]: `%${q}%` } },
            { rule_code: { [Op.iLike]: `%${q}%` } }
          ]
        },
        order: [['title', 'ASC']],
        limit: 10
      });

      res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      console.error('Search suggestions error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new RuleController();