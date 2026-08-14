const Redis = require('redis');

class CacheService {
  constructor() {
    this.redis = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.redis = Redis.createClient({
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
      
      await this.redis.connect();
      this.isConnected = true;
      console.log('Connected to Redis Cache');
    } catch (error) {
      console.error('Redis connection error:', error);
      this.isConnected = false;
    }
  }

  async getRuleAnalysis(ruleCode) {
    if (!this.isConnected) return null;
    
    try {
      const cacheKey = `rule_analysis:${ruleCode}`;
      const cached = await this.redis.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async setRuleAnalysis(ruleCode, analysis, ttl = 3600) {
    if (!this.isConnected) return;
    
    try {
      const cacheKey = `rule_analysis:${ruleCode}`;
      await this.redis.setEx(cacheKey, ttl, JSON.stringify(analysis));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async getSimilarRules(ruleCode, limit = 5) {
    if (!this.isConnected) return [];
    
    try {
      const cacheKey = `similar_rules:${ruleCode}`;
      const cached = await this.redis.get(cacheKey);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('Cache get error:', error);
      return [];
    }
  }

  async setSimilarRules(ruleCode, similarRules, ttl = 1800) {
    if (!this.isConnected) return;
    
    try {
      const cacheKey = `similar_rules:${ruleCode}`;
      await this.redis.setEx(cacheKey, ttl, JSON.stringify(similarRules));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async flush() {
    if (!this.isConnected) return;
    await this.redis.flushAll();
  }

  async close() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

module.exports = new CacheService();