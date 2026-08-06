const express = require('express');
const { Rule, User, Analytics } = require('../models');
const { generateToken } = require('../middleware/auth');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/rules - Get all rules with pagination and filters
router.get('/rules', async (req, res) => {
  try {
    const { search, regime, category, limit = 20, page = 1 } = req.query;
    
    // Build filter
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
    if (req.query.is_active !== undefined) filter.is_active = req.query.is_active === 'true';
    
    // Pagination
    const skip = (page - 1) * limit;
    const limitNum = parseInt(limit);
    
    // Execute queries
    const [rules, total] = await Promise.all([
      Rule.find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('derived_rules.rule_code'),
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/rules/:rule_code - Get rule by rule_code
router.get('/rules/:rule_code', async (req, res) => {
  try {
    const { rule_code } = req.params;
    
    const rule = await Rule.findOne({ rule_code })
      .populate('derived_rules.rule_code')
      .lean();
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Peraturan tidak ditemukan'
      });
    }
    
    // Increment view count and update last viewed
    await Rule.updateOne({ rule_code }, { 
      $inc: { view_count: 1 },
      $set: { last_viewed: new Date() }
    });
    
    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/rules - Create new rule (async processing)
router.post('/rules', async (req, res) => {
  try {
    const ruleData = req.body;
    
    // Validasi data wajib
    if (!ruleData.rule_code || !ruleData.title || !ruleData.content) {
      return res.status(400).json({
        success: false,
        error: 'Field wajib (rule_code, title, content) harus diisi'
      });
    }
    
    // Check if rule already exists
    const existingRule = await Rule.findOne({ rule_code: ruleData.rule_code });
    if (existingRule) {
      return res.status(409).json({
        success: false,
        error: 'Peraturan dengan rule_code ini sudah ada'
      });
    }
    
    // Create new rule
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
    
    // Add to processing queue for LLM analysis (optional)
    // await queue.add('process-rule', { rule_data: newRule.toObject(), user_id: req.user?.id });
    
    res.status(201).json({
      success: true,
      message: 'Peraturan berhasil dibuat',
      data: newRule
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Peraturan dengan rule_code ini sudah ada'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/rules/:rule_code - Update rule
router.put('/rules/:rule_code', async (req, res) => {
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
    
    res.json({
      success: true,
      data: updatedRule
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/rules/:rule_code - Delete rule
router.delete('/rules/:rule_code', async (req, res) => {
  try {
    const { rule_code } = req.params;
    
    const deletedRule = await Rule.findOneAndDelete({ rule_code });
    if (!deletedRule) {
      return res.status(404).json({
        success: false,
        error: 'Peraturan tidak ditemukan'
      });
    }
    
    res.json({
      success: true,
      message: 'Peraturan berhasil dihapus',
      data: deletedRule
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/rules/analytics/overview - Get analytics overview
router.get('/rules/analytics/overview', async (req, res) => {
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/rules/search/suggestions - Get search suggestions
router.get('/rules/search/suggestions', async (req, res) => {
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/rules/:rule_code/analyze - Analyze rule using Local LLM
router.post('/rules/:rule_code/analyze', async (req, res) => {
  try {
    const { rule_code } = req.params;
    const { user_id } = req.body;
    
    const rule = await Rule.findOne({ rule_code });
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Peraturan tidak ditemukan'
      });
    }
    
    // Add to processing queue for LLM analysis
    // await queue.add('process-rule', { rule_data: rule.toObject(), user_id });
    
    res.json({
      success: true,
      message: 'Analisis aturan telah dimulai',
      data: {
        rule_id: rule._id,
        status: 'queued'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/rules/:rule_code/conflicts - Get rule conflicts using RAG matrix
router.get('/rules/:rule_code/conflicts', async (req, res) => {
  try {
    const { rule_code } = req.params;
    
    const rule = await Rule.findOne({ rule_code });
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Peraturan tidak ditemukan'
      });
    }
    
    // Find similar rules using text search
    const similarRules = await Rule.aggregate([
      {
        $text: { $search: rule.title }
      },
      {
        $project: {
          title: 1,
          rule_code: 1,
          regime: 1,
          category: 1,
          score: { $meta: 'textScore' }
        }
      },
      { $sort: { score: { $meta: 'textScore' }, score: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({
      success: true,
      data: {
        source_rule: rule,
        similar_rules: similarRules
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/regimes - Get all regimes for filter
router.get('/regimes', async (req, res) => {
  try {
    const regimes = await Rule.distinct('regime');
    res.json({
      success: true,
      data: regimes.sort()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/categories - Get all categories for filter
router.get('/categories', async (req, res) => {
  try {
    const categories = await Rule.distinct('category');
    res.json({
      success: true,
      data: categories.sort()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;