const express = require('express');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../models');
const Rule = require('../models/Rule');
const User = require('../models/User');
const Role = require('../models/Role');
const Analytics = require('../models/Analytics');

const router = express.Router();

const ROLE_PERMISSIONS = [
  'view_dashboard',
  'view_rules',
  'create_rules',
  'edit_rules',
  'delete_rules',
  'analyze_rules',
  'export_data',
  'manage_backup',
  'manage_users',
  'manage_roles'
];

const DEFAULT_ROLES = {
  admin: ROLE_PERMISSIONS,
  analyst: ['view_dashboard', 'view_rules', 'create_rules', 'edit_rules', 'analyze_rules', 'export_data'],
  user: ['view_dashboard', 'view_rules', 'analyze_rules', 'export_data']
};

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
    
    // Get 10 most recent rules for "Peraturan Terbaru"
    const recentRules = await Rule.findAll({
      attributes: ['rule_code', 'title', 'category', 'regime', 'publish_date', 'view_count', 'is_active'],
      order: [['created_at', 'DESC']],
      limit: 10,
      raw: true
    });

    const recentTimeline = await Rule.findAll({
      attributes: ['regime', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      where: { regime: { [Op.ne]: null } },
      group: ['regime'],
      order: [[sequelize.col('count'), 'DESC']],
      raw: true
    });

    const criticalCount = await Rule.findAll({
      attributes: ['regime', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      where: sequelize.literal(`jsonb_array_length("loopholes") > 0`),
      group: ['regime'],
      raw: true
    });

    res.json({
      success: true,
      data: {
        total_rules: totalRules,
        latest_regime: recentRules[0]?.regime || recentTimeline[0]?.regime || '-',
        critical_loopholes: criticalCount.reduce((s, r) => s + parseInt(r.count || 0), 0),
        regime_timeline: recentTimeline.map(r => ({ name: r.regime, value: parseInt(r.count || 0) })),
        category_distribution: rulesByCategory.map(r => ({ name: r.category, value: parseInt(r.count || 0) })),
        recent_rules: recentRules
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
    
    const { Ollama } = require('ollama');
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

// GET /api/analytics - Dashboard analytics (total views, trends, breakdowns)
router.get('/analytics', async (req, res) => {
  try {
    const rules = await Rule.findAll({
      attributes: ['id', 'regime', 'category', 'loopholes', 'view_count', 'publish_date', 'title', 'processed_at', 'content']
    });

    const total_views = rules.reduce((sum, r) => sum + (r.view_count || 0), 0);
    const rules_analyzed = rules.filter(r => r.processed_at).length;
    const critical_findings = rules.filter(r => Array.isArray(r.loopholes) && r.loopholes.length > 0).length;
    const engagement_rate = rules.length ? Math.round((total_views / rules.length) * 10) / 10 : 0;

    const viewTrendMap = {};
    const analysisTrendMap = {};
    const categoryMap = {};
    const regimeMap = {};
    rules.forEach(r => {
      if (r.publish_date) {
        const year = String(r.publish_date).slice(0, 4);
        viewTrendMap[year] = (viewTrendMap[year] || 0) + 1;
        analysisTrendMap[year] = (analysisTrendMap[year] || 0) + 1;
      }
      if (r.category) categoryMap[r.category] = (categoryMap[r.category] || 0) + 1;
      if (r.regime) regimeMap[r.regime] = (regimeMap[r.regime] || 0) + 1;
    });

    const toSeries = (map) => Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    res.json({
      success: true,
      data: {
        total_views,
        rules_analyzed,
        critical_findings,
        engagement_rate,
        view_trends: toSeries(viewTrendMap),
        analysis_trends: toSeries(analysisTrendMap),
        category_breakdown: toSeries(categoryMap),
        regime_evolution: toSeries(regimeMap)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/analytics/matrix - Laporan celah & risiko (critical loopholes + popular regulations)
router.get('/analytics/matrix', async (req, res) => {
  try {
    const { regime } = req.query;
    const where = {};
    if (regime && regime !== 'all') where.regime = regime;

    // Regime conflicts: jumlah rules per regime yang punya loopholes
    const rules = await Rule.findAll({
      attributes: ['id', 'regime', 'category', 'loopholes', 'view_count', 'publish_date', 'title'],
      where
    });

    const regimeConflictMap = {};
    const criticalCount = {};
    rules.forEach(r => {
      if (!r.regime) return;
      const arr = Array.isArray(r.loopholes) ? r.loopholes : [];
      if (arr.length > 0) {
        regimeConflictMap[r.regime] = (regimeConflictMap[r.regime] || 0) + 1;
        arr.forEach(l => {
          const text = String(l).trim();
          if (text) criticalCount[text] = (criticalCount[text] || 0) + 1;
        });
      }
    });

    const regime_conflicts = Object.entries(regimeConflictMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const timeMap = {};
    rules.forEach(r => {
      if (r.publish_date) {
        const year = String(r.publish_date).slice(0, 4);
        timeMap[year] = (timeMap[year] || 0) + 1;
      }
    });
    const time_series = Object.entries(timeMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const critical_loopholes = Object.entries(criticalCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([text]) => text);

    const popular_regulations = rules
      .filter(r => r.view_count > 0)
      .sort((a, b) => b.view_count - a.view_count)
      .slice(0, 5)
      .map(r => ({ title: r.title, view_count: r.view_count }));

    res.json({
      success: true,
      data: { regime_conflicts, time_series, critical_loopholes, popular_regulations }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/actions/scrape - Mulai scraping baru (jalankan scraper via subprocess)
router.post('/actions/scrape', async (req, res) => {
  try {
    const { sources = ['jdih.slemankab.go.id'], source = 'sleman' } = req.body;
    const { exec } = require('child_process');
    const path = require('path');
    const batchId = `batch_${Date.now()}`;
    const outPath = path.join(__dirname, '..', '..', '..', 'scripts', 'scraper', 'sleman_rules_tmp.json');

    if (source === 'sleman') {
      const cmd = `python "${path.join(process.cwd(), '..', '..', 'scripts', 'scraper', 'jdih_sleman_scraper.py')}" --no-pdf --output-json "${outPath}"`;
      exec(cmd, { maxBuffer: 1024 * 1024 * 5, detached: true, timeout: 300000 },
        (err, stdout, stderr) => {
          if (err) console.error('Scrape error:', err.message);
        });
      res.json({
        success: true,
        message: 'Scraping Sleman sedang dijalankan di latar belakang',
        data: { batch_id: batchId, source: 'jdih.slemankab.go.id', status: 'running' }
      });
    } else {
      const CrawlerService = require('../services/CrawlerService');
      await CrawlerService.queueScheduledScrape(sources, batchId);
      res.json({
        success: true,
        message: 'Scraping telah dijadwalkan',
        data: { batch_id: batchId, status: 'queued' }
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/actions/analyze-batch - Analisis batch via worker background process
router.post('/actions/analyze-batch', async (req, res) => {
  try {
    const { limit = 100 } = req.body;
    const { fork } = require('child_process');
    const path = require('path');
    // Worker.js memproses queue; pastikan worker berjalan di background
    const workerPath = path.join(__dirname, '..', 'worker.js');
    let worker;
    try { worker = fork(workerPath, [], { detached: true, stdio: 'ignore' }); } catch (e) {
      console.error('Spawn worker error:', e.message);
    }
    res.json({
      success: true,
      message: `Batch analisis LLM dimulai (worker terlanjur, limit ${limit})`,
      data: { status: 'started' }
    });
    if (worker) worker.unref();
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/analytics/export - Ekspor data rules
router.get('/analytics/export', async (req, res) => {
  try {
    const { format = 'json', regime } = req.query;
    const where = {};
    if (regime && regime !== 'all') where.regime = regime;
    const rules = await Rule.findAll({ where, raw: true });

    if (format === 'csv') {
      const headers = ['rule_code', 'title', 'category', 'regime', 'publish_date', 'source', 'is_active', 'view_count'];
      const esc = (v) => { const s = v == null ? '' : String(v); return `"${s.replace(/"/g, '""')}"`; };
      const lines = rules.map(r => headers.map(h => esc(r[h])).join(','));
      const csv = [headers.join(','), ...lines].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="rules_${Date.now()}.csv"`);
      return res.send(csv);
    }

    res.json({
      success: true,
      data: rules,
      count: rules.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/actions/clear-cache - Bersihkan cache Redis
router.post('/actions/clear-cache', async (req, res) => {
  try {
    const CacheService = require('../services/CacheService');
    await CacheService.connect();
    await CacheService.flush();
    res.json({
      success: true,
      message: 'Cache berhasil dibersihkan'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/regimes - Get all regimes for filter
router.get('/regimes', async (req, res) => {
  try {const regimes = await Rule.findAll({
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
  try {const categories = await Rule.findAll({
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

// GET /api/queue/stats - Get Bull queue statistics
router.get('/queue/stats', async (req, res) => {
  try {
    const Bull = require('bull');
    const queue = new Bull('rule processing', {
      redis: {
        port: parseInt(process.env.REDIS_PORT) || 6379,
        host: process.env.REDIS_HOST || 'localhost',
        password: process.env.REDIS_PASSWORD || undefined
      }
    });

    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount()
    ]);

    await queue.close();

    res.json({
      success: true,
      data: {
        waiting,
        active,
        completed,
        failed
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/users - List all user accounts (without passwords)
router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'role', 'created_at'],
      order: [['created_at', 'DESC']],
      raw: true
    });

    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/users - Create a new user account
router.post('/users', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Field wajib (username, email, password) harus diisi'
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password minimal 6 karakter'
      });
    }

    const existing = await User.findOne({
      where: { [Op.or]: [{ username }, { email }] }
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: existing.username === username
          ? 'Username sudah digunakan'
          : 'Email sudah terdaftar'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      role: role || 'user'
    });

    res.status(201).json({
      success: true,
      message: 'Akun berhasil dibuat',
      data: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        created_at: newUser.created_at
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/users/:id - Update a user account
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password, role } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan' });
    }

    const updates = {};
    if (username) {
      const dup = await User.findOne({ where: { username, id: { [Op.ne]: id } } });
      if (dup) return res.status(409).json({ success: false, error: 'Username sudah digunakan' });
      updates.username = username;
    }
    if (email) {
      const dup = await User.findOne({ where: { email, id: { [Op.ne]: id } } });
      if (dup) return res.status(409).json({ success: false, error: 'Email sudah terdaftar' });
      updates.email = email;
    }
    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({ success: false, error: 'Password minimal 6 karakter' });
      }
      updates.password = await bcrypt.hash(password, 10);
    }
    if (role) updates.role = role;

    await user.update(updates);

    res.json({
      success: true,
      message: 'Akun berhasil diperbarui',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        created_at: user.created_at
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/users/:id - Delete a user account
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedCount = await User.destroy({ where: { id } });
    if (deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan' });
    }
    res.json({ success: true, message: 'Akun berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/roles - List roles with permissions (seed defaults if empty)
router.get('/roles', async (req, res) => {
  try {
    const count = await Role.count();
    if (count === 0) {
      await Promise.all(Object.entries(DEFAULT_ROLES).map(([name, permissions]) =>
        Role.create({ name, permissions })
      ));
    }
    const roles = await Role.findAll({
      attributes: ['id', 'name', 'permissions', 'created_at'],
      order: [['name', 'ASC']],
      raw: true
    });
    res.json({
      success: true,
      data: roles,
      available_permissions: ROLE_PERMISSIONS
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/roles/:name - Update role permissions
router.put('/roles/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ success: false, error: 'Permissions harus berupa array' });
    }

    const valid = permissions.filter(p => ROLE_PERMISSIONS.includes(p));
    const role = await Role.findOne({ where: { name } });
    if (!role) {
      return res.status(404).json({ success: false, error: 'Role tidak ditemukan' });
    }

    await role.update({ permissions: valid });

    res.json({
      success: true,
      message: `Perizinan role "${name}" berhasil diperbarui`,
      data: { name: role.name, permissions: role.permissions }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
