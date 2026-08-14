// Konfigurasi server Express
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: 'Terlalu banyak permintaan dari IP ini'
});
app.use('/api/', limiter);

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
    const Rule = require('./models/Rule');
    const sequelize = Rule.sequelize;
    await sequelize.authenticate();
    const [results] = await sequelize.query('SELECT COUNT(*) as cnt FROM rules');
    const count = results[0].cnt || 0;
    health.database = 'connected';
    health.rule_count = count;
  } catch (error) {
    health.database = 'disconnected';
    health.database_error = error.message;
  }
  
  const statusCode = health.redis === 'connected' && health.database === 'connected' ? 200 : 503;
  res.status(statusCode).json(health);
});

// API Routes
app.use('/api', require('./routes/api'));

// 404 handler
app.use('*', (req, res) => {
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
    const Rule = require('./models/Rule');
    const User = require('./models/User');
    const Analytics = require('./models/Analytics');
    
    await Rule.sync();
    await User.sync();
    await Analytics.sync();
    console.log('📊 Database tables synced');
    
    const server = app.listen(PORT, () => {
      console.log(`Server berjalan di port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    
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