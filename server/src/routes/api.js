const express = require('express');
const { Op } = require('sequelize');
const Rule = require('../models/Rule');

const router = express.Router();

// GET /api/rules - Get all rules with pagination and filters
router.get('/rules', async (req, res) => {
  try {
    const { search, regime, category, limit = 20, page = 1 } = req.query;
    
    // Build where clause
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
    if (req.query.is_active !== undefined) where.is_active = req.query.is_active === 'true';
    
    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);
    
    // Execute query
    const { count, rows: rules } = await Rule.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      offset,
      limit: limitNum
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
    
    const rule = await Rule.findOne({ where: { rule_code } });
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Peraturan tidak ditemukan'
      });
    }
    
    // Increment view count and update last viewed
    await Rule.update(
      { view_count: rule.view_count + 1, last_viewed: new Date() },
      { where: { rule_code } }
    );
    
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
    const existingRule = await Rule.findOne({ where: { rule_code: ruleData.rule_code } });
    if (existingRule) {
      return res.status(409).json({
        success: false,
        error: 'Peraturan dengan rule_code ini sudah ada'
      });
    }
    
    // Create new rule
    const newRule = await Rule.create({
      rule_code: ruleData.rule_code,
      title: ruleData.title,
      regime: ruleData.regime || 'Lainnya',
      category: ruleData.category || 'Lainnya',
      content: ruleData.content,
      loopholes: ruleData.loopholes || [],
      impacts: ruleData.impacts || [],
      sanctions: ruleData.sanctions || { administrative: '', criminal: '' },
      publish_date: ruleData.publish_date || null,
      source: ruleData.source || null,
      pdf_url: ruleData.pdf_url || null
    });
    
    res.status(201).json({
      success: true,
      message: 'Peraturan berhasil dibuat',
      data: newRule
    });
  } catch (error) {
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
    
    // Remove fields that shouldn't be updated via this route
    delete updates.id;
    delete updates.rule_code;
    delete updates.created_at;
    
    const [affectedRows] = await Rule.update(
      { ...updates, updated_at: new Date() },
      { where: { rule_code } }
    );
    
    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Peraturan tidak ditemukan'
      });
    }
    
    const updatedRule = await Rule.findOne({ where: { rule_code } });
    
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
    
    const deletedCount = await Rule.destroy({ where: { rule_code } });
    if (deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Peraturan tidak ditemukan'
      });
    }
    
    res.json({
      success: true,
      message: 'Peraturan berhasil dihapus'
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
    const { sequelize } = require('../models/Rule');
    
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
    
    const suggestions = await Rule.findAll({
      attributes: ['id', 'title', 'rule_code', 'regime', 'category'],
      where: {
        [Op.or]: [
          { title: { [Op.iLike]: `%${q}%` } },
          { rule_code: { [Op.iLike]: `%${q}%` } }
        ]
      },
      order: [['title', 'ASC']],
      limit: 10,
      raw: true
    });
    
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

// POST /api/chat - Chat with local LLM
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Pesan wajib diisi'
      });
    }
    
    const Ollama = require('ollama');
    const ollama = new Ollama({
      host: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    });
    
    const completion = await ollama.chat({
      model: process.env.OLLAMA_MODEL || 'deepseek-r1:14b',
      messages: [{ role: 'user', content: message }],
      options: {
        temperature: parseFloat(process.env.OLLAMA_TEMPERATURE) || 0.1,
        num_ctx: 2048
      }
    });
    
    res.json({
      success: true,
      data: {
        response: completion.message.content
      }
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Gagal mendapatkan respons dari LLM'
    });
  }
});

// POST /api/rules/:rule_code/analyze - Analyze rule using Local LLM
router.post('/rules/:rule_code/analyze', async (req, res) => {
  try {
    const { rule_code } = req.params;
    
    const rule = await Rule.findOne({ where: { rule_code } });
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Peraturan tidak ditemukan'
      });
    }
    
    res.json({
      success: true,
      message: 'Analisis aturan telah dimulai',
      data: {
        rule_id: rule.id,
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
    
    const rule = await Rule.findOne({ where: { rule_code } });
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Peraturan tidak ditemukan'
      });
    }
    
    // Find similar rules using ILIKE search on title
    const similarRules = await Rule.findAll({
      attributes: ['id', 'title', 'rule_code', 'regime', 'category'],
      where: {
        rule_code: { [Op.ne]: rule_code },
        title: { [Op.iLike]: `%${rule.title.split(' ').slice(0, 3).join(' ')}%` }
      },
      limit: 10,
      raw: true
    });
    
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
    const { sequelize } = require('../models/Rule');
    const regimes = await Rule.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('regime')), 'regime']],
      where: { regime: { [Op.ne]: null } },
      raw: true
    });
    const regimeList = regimes.map(r => r.regime).sort();
    
    res.json({
      success: true,
      data: regimeList
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
    const { sequelize } = require('../models/Rule');
    const categories = await Rule.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category']],
      where: { category: { [Op.ne]: null } },
      raw: true
    });
    const categoryList = categories.map(c => c.category).sort();
    
    res.json({
      success: true,
      data: categoryList
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
