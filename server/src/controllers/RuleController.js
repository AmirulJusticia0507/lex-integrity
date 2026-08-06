const { Rule } = require('../models');
const logger = require('../utils/logger');

class RuleController {
  async getAllRules(req, res) {
    try {
      const { search, regime, category, limit = 20, page = 1, is_active } = req.query;
      
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
      if (is_active !== undefined) filter.is_active = is_active === 'true';
      
      const skip = (page - 1) * limit;
      const limitNum = parseInt(limit);
      
      const [rules, total] = await Promise.all([
        Rule.find(filter)
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(limitNum),
        Rule.countDocuments(filter)
      ]);
      
      res.json({
        success: true,
        data: rules,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      logger.error('Get all rules error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getRuleByCode(req, res) {
    try {
      const { rule_code } = req.params;
      
      const rule = await Rule.findOne({ rule_code });
      if (!rule) {
        return res.status(404).json({
          success: false,
          error: 'Peraturan tidak ditemukan'
        });
      }
      
      // Increment view count
      await Rule.updateOne({ rule_code }, { $inc: { view_count: 1 } });
      
      res.json({
        success: true,
        data: rule
      });
    } catch (error) {
      logger.error('Get rule by code error:', error);
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
      
      const existingRule = await Rule.findOne({ rule_code: ruleData.rule_code });
      if (existingRule) {
        return res.status(409).json({
          success: false,
          error: 'Peraturan dengan rule_code ini sudah ada'
        });
      }
      
      const newRule = new Rule({
        rule_code: ruleData.rule_code,
        title: ruleData.title,
        regime: ruleData.regime || 'Lainnya',
        category: ruleData.category || 'Lainnya',
        content: ruleData.content,
        derived_rules: ruleData.derived_rules || [],
        loopholes: ruleData.loopholes || [],
        impacts: ruleData.impacts || [],
        sanctions: ruleData.sanctions || { administrative: '', criminal: '' },
        publish_date: ruleData.publish_date || null,
        source: ruleData.source || null,
        pdf_url: ruleData.pdf_url || null,
        created_at: new Date()
      });
      
      await newRule.save();
      
      logger.info(`Rule created: ${ruleData.rule_code}`);
      
      res.status(201).json({
        success: true,
        message: 'Peraturan berhasil dibuat',
        data: newRule
      });
    } catch (error) {
      logger.error('Create rule error:', error);
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
      
      const updatedRule = await Rule.findOneAndUpdate(
        { rule_code },
        { $set: updates, $currentDate: { updated_at: true } },
        { new: true, runValidators: true }
      );
      
      if (!updatedRule) {
        return res.status(404).json({
          success: false,
          error: 'Peraturan tidak ditemukan'
        });
      }
      
      logger.info(`Rule updated: ${rule_code}`);
      
      res.json({
        success: true,
        data: updatedRule
      });
    } catch (error) {
      logger.error('Update rule error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteRule(req, res) {
    try {
      const { rule_code } = req.params;
      
      const deletedRule = await Rule.findOneAndDelete({ rule_code });
      if (!deletedRule) {
        return res.status(404).json({
          success: false,
          error: 'Peraturan tidak ditemukan'
        });
      }
      
      logger.info(`Rule deleted: ${rule_code}`);
      
      res.json({
        success: true,
        message: 'Peraturan berhasil dihapus',
        data: deletedRule
      });
    } catch (error) {
      logger.error('Delete rule error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getRuleAnalytics(req, res) {
    try {
      const overview = await Promise.all([
        Rule.countDocuments(),
        Rule.aggregate([{ $group: { _id: '$regime', count: { $sum: 1 } } }]),
        Rule.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
        Rule.aggregate([{ $group: { _id: null, avgViews: { $avg: '$view_count' } } }]),
        Rule.aggregate([
          { $group: { _id: '$category', avgLoopholes: { $avg: { $size: '$loopholes' } } } }
        ])
      ]);
      
      res.json({
        success: true,
        data: {
          total_rules: overview[0],
          rules_by_regime: overview[1],
          rules_by_category: overview[2],
          average_views: overview[3][0]?.avgViews || 0,
          average_loopholes_by_category: overview[4]
        }
      });
    } catch (error) {
      logger.error('Get analytics error:', error);
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
      
      const suggestions = await Rule.aggregate([
        {
          $match: {
            $or: [
              { title: { $regex: q, $options: 'i' } },
              { rule_code: { $regex: q, $options: 'i' } }
            ]
          }
        },
        {
          $project: {
            title: 1,
            rule_code: 1,
            regime: 1,
            category: 1,
            score: { $cond: [{ $eq: ['$title', q] }, 10, 1] }
          }
        },
        { $sort: { score: -1, title: 1 } },
        { $limit: 10 }
      ]);
      
      res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      logger.error('Search suggestions error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new RuleController();