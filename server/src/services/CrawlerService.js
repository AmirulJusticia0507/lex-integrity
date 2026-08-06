const { Rule } = require('../models');
const redis = require('redis');
const { Queue } = require('bull');

class CrawlerService {
  constructor() {
    this.queue = new Queue('rule processing', {
      redis: {
        port: parseInt(process.env.REDIS_PORT) || 6379,
        host: process.env.REDIS_HOST || 'localhost',
        password: process.env.REDIS_PASSWORD || undefined
      }
    });
    this.setupProcessors();
  }

  setupProcessors() {
    // Processor for rule analysis
    this.queue.process('process-rule', 5, async (job) => {
      const { rule_data, user_id } = job.data;
      
      try {
        // Perform RAG analysis on the rule
        const RAGService = require('./RAGService');
        const analysis = await RAGService.analyzeRule(rule_data);
        
        // Update rule in database
        await Rule.findOneAndUpdate(
          { rule_code: rule_data.rule_code },
          { 
            $set: {
              loopholes: analysis.loopholes || [],
              impacts: analysis.impacts || [],
              sanctions: analysis.sanctions || { administrative: '', criminal: '' }
            }
          }
        );
        
        return { success: true, analyzed_rule: analysis };
      } catch (error) {
        console.error('Rule processing failed:', error);
        throw error;
      }
    });

    // Processor for scheduled scraping
    this.queue.process('scrape-batch', 3, async (job) => {
      const { scraper_config, batch_id } = job.data;
      
      try {
        // Import and run scraper
        const { runScraper } = require('../utils/scraper');
        const results = await runScraper(scraper_config);
        
        return { success: true, results, batch_id };
      } catch (error) {
        console.error('Scraper batch failed:', error);
        throw error;
      }
    });
  }

  async queueRuleProcessing(ruleData, userId = null) {
    return this.queue.add('process-rule', {
      rule_data: ruleData,
      user_id: userId
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
  }

  async queueScheduledScrape(sources, batchId) {
    return this.queue.add('scrape-batch', {
      scraper_config: {
        sources,
        batch_id: batchId,
        scheduled_at: new Date()
      }
    }, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    });
  }

  async getQueueStats() {
    const waiting = await this.queue.getWaiting();
    const active = await this.queue.getActive();
    const completed = await this.queue.getCompleted();
    const failed = await this.queue.getFailed();
    
    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length
    };
  }

  async close() {
    await this.queue.close();
  }
}

module.exports = new CrawlerService();