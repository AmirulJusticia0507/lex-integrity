// Konfigurasi server Express
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy (CRA dev proxy & production LB send X-Forwarded-For)
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Rate limiting (keyed by client IP; safe now that trust proxy is on)
const fs = require('fs');
const path = require('path');

const RATE_LIMIT_FILE = path.join(__dirname, '..', 'rate-limit.json');

function loadRateLimitSettings() {
  try {
    if (fs.existsSync(RATE_LIMIT_FILE)) {
      return JSON.parse(fs.readFileSync(RATE_LIMIT_FILE, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return {};
}

function createLimiter(settings) {
  if (!settings || settings.enabled === false) return null;
  return rateLimit({
    windowMs: settings.windowMs || 60000,
    max: settings.max === -1 ? 0 : (settings.max || 100),
    keyGenerator: (req) => req.ip,
    message: 'Terlalu banyak permintaan dari IP ini',
    standardHeaders: true,
    legacyHeaders: false,
  });
}

let globalLimiter = createLimiter({ windowMs: 60000, max: 100 });

function reloadRateLimit(allSettings) {
  globalLimiter = createLimiter(allSettings.api);
  console.log(`⚡ Rate-limit reloaded: api=${allSettings.api?.enabled ? allSettings.api.max + '/' + allSettings.api.windowMs + 'ms' : 'off'}`);
}

app.reloadRateLimit = reloadRateLimit;

app.use('/api/', (req, res, next) => {
  if (!globalLimiter) return next();
  globalLimiter(req, res, next);
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Redis client
const redis = require('redis').createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD || undefined,
  socket: {
    reconnectStrategy: (options) => {
      if (options.total_retry_time > 1000 * 60 * 60) {
        return new Error('Redis reconnect time exceeded');
      }
      return options.errorCount > 10 ? new Error('Redis max retries reached') : null;
    }
  }
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    timestamp: new Date().toISOString(),
    status: 'ok'
  };
  
  try {
    await redis.ping();
    health.redis = 'connected';
  } catch (error) {
    health.redis = 'disconnected';
    health.redis_error = error.message;
  }
  
  try {
    const sequelize = require('./config/database');
    await sequelize.authenticate();
    const [results] = await sequelize.query('SELECT COUNT(*) as cnt FROM rules');
    const count = results[0].cnt || 0;
    health.database = 'connected';
    health.rule_count = count;
  } catch (error) {
    health.database = 'disconnected';
    health.database_error = error.message;
  }
  
  // Check Ollama availability (server-side, avoids browser CORS)
  try {
    const ollamaHost = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const ollamaRes = await fetch(`${ollamaHost}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    if (ollamaRes.ok) {
      const tags = await ollamaRes.json();
      health.ollama = 'connected';
      health.ollama_models = (tags.models || []).map(m => m.name);
    } else {
      health.ollama = 'disconnected';
    }
  } catch (error) {
    health.ollama = 'disconnected';
    health.ollama_error = error.message;
  }
  
  // Check Bull queue availability
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
    health.queue = 'connected';
    health.queue_stats = { waiting, active, completed, failed };
  } catch (error) {
    health.queue = 'disconnected';
    health.queue_error = error.message;
  }
  
  const statusCode = health.redis === 'connected' && health.database === 'connected' ? 200 : 503;
  res.status(statusCode).json(health);
});

// API Routes
app.use('/api', require('./routes/api'));

// 404 handler (path-less middleware avoids decodeURIComponent on stray
// literal %PUBLIC_URL%/... requests that the CRA proxy may forward)
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Terjadi kesalahan pada server',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const startServer = async () => {
  try {
    await redis.connect();
    
    // Sync database tables
    const { sequelize } = require('./models');
    
    await sequelize.sync();
    console.log('📊 Database tables synced');
    
    const server = app.listen(PORT, () => {
      console.log(`Server berjalan di port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Naikkan timeout untuk inferensi LLM 14b (bisa sampai 5 menit)
    server.timeout          = 600000; // 10 menit max
    server.keepAliveTimeout = 620000;
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM diterima, menghentikan server...');
      server.close(() => {
        console.log('Server ditutup');
        redis.quit();
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('Gagal memulai server:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };