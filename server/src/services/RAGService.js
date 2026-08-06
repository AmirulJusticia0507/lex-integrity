const { Rule } = require('../models');
const { getEmbedding } = require('../utils/embedding');
const cacheService = require('./CacheService');

class RAGService {
  async analyzeRule(rule) {
    try {
      // Check cache first
      const cachedAnalysis = await cacheService.getRuleAnalysis(rule.rule_code);
      if (cachedAnalysis) {
        return cachedAnalysis;
      }
      
      // Perform analysis using Local LLM
      const analysis = await this.performLLMAnalysis(rule.content);
      
      // Extract structured data from analysis
      const extracted = this.extractFromAnalysis(analysis);
      
      // Combine with existing rule data
      const enhancedRule = {
        ...rule.toObject(),
        ...extracted,
        analysis_timestamp: new Date()
      };
      
      // Cache the analysis
      await cacheService.setRuleAnalysis(rule.rule_code, extracted, 3600);
      
      return enhancedRule;
    } catch (error) {
      console.error('RAG analysis error:', error);
      throw error;
    }
  }

  async performLLMAnalysis(content) {
    // This would integrate with Local LLM (Ollama/DeepSeek/Mistral)
    // For now, return mock analysis
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`
          Loopholes: ["Wewenang diskresi tanpa kriteria yang jelas", "Potensi konflik kepentingan"]
          Impacts: ["Risiko korupsi", "Reduksi transparansi"]
          Sanctions: { administrative: "Pencabutan SK Terkait", criminal: "Pasal 3 UU Tipikor" }
        `);
      }, 100);
    });
  }

  extractFromAnalysis(analysis) {
    // Extract loopholes, impacts, sanctions from LLM response
    const lines = analysis.split('\n').filter(line => line.trim());
    const result = {
      loopholes: [],
      impacts: [],
      sanctions: { administrative: '', criminal: '' }
    };
    
    lines.forEach(line => {
      if (line.includes('Loopholes:')) {
        const loopholesText = line.split('Loopholes:')[1].trim();
        result.loopholes = JSON.parse(loopholesText.replace(/'/g, '"'));
      } else if (line.includes('Impacts:')) {
        const impactsText = line.split('Impacts:')[1].trim();
        result.impacts = JSON.parse(impactsText.replace(/'/g, '"'));
      } else if (line.includes('Sanctions:')) {
        const sanctionsText = line.split('Sanctions:')[1].trim();
        try {
          result.sanctions = JSON.parse(sanctionsText.replace(/'/g, '"'));
        } catch (e) {
          // Parse fallback
          result.sanctions.administrative = sanctionsText.match(\"\"\"administratif.*?(?=\\n|$)\"\"\")?.[0] || '';
          result.sanctions.criminal = sanctionsText.match(\"\"\"kriminal.*?(?=\\n|$)\"\"\")?.[0] || '';
        }
      }
    });
    
    return result;
  }

  async detectConflicts(ruleCode) {
    try {
      // Check cache first
      const cachedSimilar = await cacheService.getSimilarRules(ruleCode);
      if (cachedSimilar.length > 0) {
        return cachedSimilar;
      }
      
      // Find semantically similar rules
      const rule = await Rule.findOne({ rule_code: ruleCode });
      if (!rule) return [];
      
      // Use MongoDB text search for semantic similarity
      const similarRules = await Rule.aggregate([
        {
          $text: { $search: rule.title + ' ' + rule.content }
        },
        {
          $match: {
            rule_code: { $ne: ruleCode },
            is_active: true
          }
        },
        {
          $project: {
            rule_code: 1,
            title: 1,
            regime: 1,
            category: 1,
            similarity_score: { $meta: 'textScore' }
          }
        },
        {
          $sort: { similarity_score: { $meta: 'textScore' }, similarity_score: -1 }
        },
        { $limit: 10 }
      ]);
      
      // Cache the results
      await cacheService.setSimilarRules(ruleCode, similarRules, 1800);
      
      return similarRules;
    } catch (error) {
      console.error('Conflict detection error:', error);
      return [];
    }
  }

  async extractRelations(content) {
    // Extract derived rules and relationships from content
    // This would use NLP models or pattern matching
    return [];
  }
}

module.exports = new RAGService();