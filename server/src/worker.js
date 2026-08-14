// BullMQ worker untuk memproses peraturan dengan LLM
require('dotenv').config();

const Bull = require('bull');
const redis = require('redis').createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const Rule = require('./models/Rule');
const { Ollama } = require('ollama');

const ollama = new Ollama({
  host: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
});

// Queue untuk pemrosesan aturan
const ruleProcessingQueue = new Bull('rule processing', {
  redis: { port: 6379, host: 'localhost', password: process.env.REDIS_PASSWORD || undefined }
});

// Worker untuk memproses tugas
ruleProcessingQueue.process('process-rule', 5, async (job) => {
  const { rule_data, user_id } = job.data;
  
  try {
    console.log(`Memproses aturan: ${rule_data.rule_code} untuk pengguna: ${user_id}`);
    
    // Proses teks dengan LLM lokal
    const analysis_prompt = `
    Anda adalah ahli hukum AI yang mengkhususkan diri dalam peraturan Indonesia.
    Menganalisis teks peraturan berikut dan mengidentifikasi:
    1. Pasal karet (loopholes) yang mungkin disalahgunakan
    2. Potensi kontradiksi dengan peraturan di atasnya
    3. Dampak kebijakan dan sanksi yang disarankan
    
    Format hasil sebagai JSON dengan field berikut:
    - rule_code: (sama seperti input)
    - title: (sama seperti input)
    - extracted_loopholes: (daftar string)
    - extracted_impacts: (daftar string)
    - suggested_sanctions: { administrative: string, criminal: string }
    
    Teks Peraturan:
    ${rule_data.content}
    
    Respon HANYA dalam format JSON yang valid.
    `;
    
    // Panggil LLM lokal (Ollama)
    const ollama_model = process.env.OLLAMA_MODEL || 'deepseek-r1:14b';
    const ollama_url = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    
    const completion = await ollama.chat({
      model: ollama_model,
      messages: [{ role: 'user', content: analysis_prompt }],
      options: {
        temperature: parseFloat(process.env.OLLAMA_TEMPERATURE) || 0.1,
        num_ctx: 2048
      }
    });
    
    let analysis_result;
    try {
      // Coba ekstrak JSON dari respons
      const response_text = completion.message.content;
      const json_match = response_text.match(/\{[^]+\}/);
      if (json_match) {
        analysis_result = JSON.parse(json_match[0]);
      } else {
        analysis_result = JSON.parse(response_text);
      }
    } catch (parse_error) {
      console.error('Gagal parsing respons LLM:', parse_error);
      analysis_result = {
        rule_code: rule_data.rule_code,
        title: rule_data.title,
        extracted_loopholes: ['Analisis gagal, perlu review manual'],
        extracted_impacts: ['Dampak tidak teridentifikasi'],
        suggested_sanctions: { administrative: 'Perlu review hukum', criminal: 'Perlu review hukum' }
      };
    }
    
    // Merge data yang sudah di-analyze
    const toStringArray = (value) => {
      if (!Array.isArray(value)) return [];
      return value.map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.text || JSON.stringify(item);
        return String(item);
      }).filter((item) => typeof item === 'string' && item.length > 0);
    };

    const toSanctions = (value) => {
      const fallback = { administrative: 'Perlu review hukum', criminal: 'Perlu review hukum' };
      if (!value || typeof value !== 'object') return fallback;
      const admin = typeof value.administrative === 'string' ? value.administrative : fallback.administrative;
      const criminal = typeof value.criminal === 'string' ? value.criminal : fallback.criminal;
      return { administrative: admin, criminal };
    };

    const enriched_rule = {
      ...rule_data,
      loopholes: toStringArray(analysis_result.extracted_loopholes),
      impacts: toStringArray(analysis_result.extracted_impacts),
      sanctions: toSanctions(analysis_result.suggested_sanctions),
      processed_at: new Date().toISOString(),
      processed_by: 'ollama-' + ollama_model,
      confidence_score: 0.85
    };
    
    // Simpan ke database (upsert behavior)
    let saved_rule = await Rule.findOne({ where: { rule_code: enriched_rule.rule_code } });
    if (saved_rule) {
      await Rule.update(enriched_rule, { where: { rule_code: enriched_rule.rule_code } });
      saved_rule = await Rule.findOne({ where: { rule_code: enriched_rule.rule_code } });
    } else {
      saved_rule = await Rule.create(enriched_rule);
    }
    
    console.log(`Aturan berhasil diproses: ${saved_rule.rule_code}`);
    return { rule_id: saved_rule.id, status: 'completed' };
    
  } catch (error) {
    console.error(`Gagal memproses aturan ${job.data.rule_data.rule_code}:`, error);
    throw error; // BullMQ akan mencoba ulang (max 3 kali)
  }
});

// Worker untuk operasi batch
ruleProcessingQueue.process('batch-process', 3, async (job) => {
  const { rule_ids } = job.data;
  
  try {
    console.log(`Memproses batch ${rule_ids.length} aturan`);
    
    const results = [];
    for (const rule_id of rule_ids) {
      const rule = await Rule.findByPk(rule_id);
      if (!rule) {
        results.push({ rule_id, status: 'not_found' });
        continue;
      }
      
      // Proses aturan dengan LLM
      const analysis_prompt = `Analisis aturan hukum: ${rule.title}\n${rule.content}\nIdentifikasi loopholes, dampak, dan sanksi.`;
      
      const completion = await ollama.chat({
        model: process.env.OLLAMA_MODEL || 'deepseek-r1:14b',
        messages: [{ role: 'user', content: analysis_prompt }],
        options: { temperature: 0.1 }
      });
      
      // Parse hasil (implementasi serupa dengan di atas)
      const analysis_result = JSON.parse(completion.message.content.match(/\{[^]+\}/)[0]);
      
      await Rule.update(
        {
          loopholes: analysis_result.extracted_loopholes || [],
          impacts: analysis_result.extracted_impacts || [],
          sanctions: analysis_result.suggested_sanctions || { administrative: 'TBD', criminal: 'TBD' },
          processed_at: new Date().toISOString(),
          processing_method: 'batch'
        },
        { where: { id: rule_id } }
      );
      
      const updated_rule = await Rule.findByPk(rule_id);
      
      results.push({
        rule_id: rule_id,
        status: 'completed',
        rule_code: updated_rule.rule_code,
        extracted_loopholes_count: updated_rule.loopholes.length
      });
    }
    
    return { processed: results.length, results };
    
  } catch (error) {
    console.error('Gagal memproses batch:', error);
    throw error;
  }
});

// Queue event handlers
ruleProcessingQueue.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

ruleProcessingQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});

ruleProcessingQueue.on('progress', (job, progress) => {
  console.log(`Job ${job.id} progress: ${progress}%`);
});

console.log('Worker started and listening for jobs...');

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing queues...');
  ruleProcessingQueue.close();
  redis.quit();
});