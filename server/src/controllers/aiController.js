/**
 * aiController.js
 * RAG Pipeline Controller: Embedding → pgvector Search → lex-integrity-agent LLM → JSON Response
 */

import { Pool } from 'pg';
import { Ollama } from 'ollama';
import { 
  finalResponseValidator, 
  validateAndRepair, 
  createFallbackResponse 
} from '../utils/schemaValidator.js';
import { applyGuardrails, moderateInput } from '../utils/guardrails.js';

// ── PostgreSQL pool (raw, untuk query pgvector) ─────────────────────────────
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_DATABASE || 'lex_integrity',
  password: process.env.DB_PASSWORD || 'admin123',
  port: parseInt(process.env.DB_PORT) || 5432,
});

// ── Ollama client ────────────────────────────────────────────────────────────
const ollama = new Ollama({
  host: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
});

// ── Cross-Encoder Reranker client ────────────────────────────────────────────
const RERANKER_URL = process.env.RERANKER_URL || 'http://localhost:8001';
const RERANKER_ENABLED = process.env.RERANKER_ENABLED === 'true';

async function rerankDocuments(query, documents, topK = 5) {
  if (!RERANKER_ENABLED || !documents.length) return documents;
  
  try {
    const response = await fetch(`${RERANKER_URL}/rerank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, documents, top_k: topK }),
      timeout: 10000
    });
    
    if (!response.ok) {
      console.warn('[AI] Reranker service error:', response.status);
      return documents;
    }
    
    const data = await response.json();
    return data.results || documents;
  } catch (err) {
    console.warn('[AI] Reranker unavailable, skipping:', err.message);
    return documents;
  }
}

const AGENT_MODEL  = process.env.OLLAMA_AGENT_MODEL  || 'lex-integrity-agent:latest';
const EMBED_MODEL  = process.env.OLLAMA_EMBED_MODEL  || 'nomic-embed-text';

// RRF config
const RRF_K = parseInt(process.env.RRF_K || '60');
const HYBRID_ALPHA = parseFloat(process.env.HYBRID_ALPHA || '0.5');

// ── HyDE (Hypothetical Document Embeddings) Query Expansion ──────────────────
const HYDE_ENABLED = process.env.HYDE_ENABLED === 'true';
const HYDE_MODEL = process.env.HYDE_MODEL || AGENT_MODEL;

async function hydeExpandQuery(userQuery) {
  if (!HYDE_ENABLED) return userQuery;
  
  try {
    const hydePrompt = `Berikut adalah pertanyaan hukum Indonesia. Tulis sebuah dokumen hipotetis (jawaban/analisis singkat) yang relevan untuk pertanyaan ini. 
Fokus pada: pasal/UU/Peraturan yang relevan, konsep hukum kunci, dan argumen hukum.

Pertanyaan: "${userQuery}"

Dokumen Hipotetis:`;

    const response = await ollama.generate({
      model: HYDE_MODEL,
      prompt: hydePrompt,
      stream: false,
      options: {
        temperature: 0.3,
        num_ctx: 2048,
        top_p: 0.9,
      },
    });
    
    const hypotheticalDoc = response.response || '';
    const expanded = `${userQuery}\n\n${hypotheticalDoc.slice(0, 1000)}`;
    
    console.log('[AI] HyDE expanded query:', expanded.slice(0, 200) + '...');
    return expanded;
  } catch (err) {
    console.warn('[AI] HyDE expansion failed, using original query:', err.message);
    return userQuery;
  }
}

// ── Helper: apakah pgvector extension + kolom embedding tersedia ─────────────
async function hasPgvector() {
  try {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='rules' AND column_name='embedding'`
    );
    return rows.length > 0;
  } catch (_) {
    return false;
  }
}

// ── Helper: cari chunk terdekat pakai pgvector (rules + rule_chunks) ─────────
async function vectorSearch(queryEmbedding, limit = 20) {
  const vectorStr = JSON.stringify(queryEmbedding);
  
  // Search in rules table
  const { rows: ruleRows } = await pool.query(
    `SELECT rule_code, regime, category, title, content,
            1 - (embedding <=> $1::vector) AS similarity,
            'rule' AS source_type
     FROM rules
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [vectorStr, limit]
  );
  
  // Search in rule_chunks table
  const { rows: chunkRows } = await pool.query(
    `SELECT rc.rule_code, r.regime, r.category, r.title, rc.chunk_text AS content,
            1 - (rc.embedding <=> $1::vector) AS similarity,
            'chunk' AS source_type,
            rc.chunk_metadata
     FROM rule_chunks rc
     JOIN rules r ON r.rule_code = rc.rule_code
     WHERE rc.embedding IS NOT NULL
       AND r.is_active = true
     ORDER BY rc.embedding <=> $1::vector
     LIMIT $2`,
    [vectorStr, limit]
  );
  
  const combined = [...ruleRows, ...chunkRows]
    .sort((a, b) => a.similarity - b.similarity) // cosine distance: lower = better
    .slice(0, limit);
  
  return combined.map((r, i) => ({ ...r, _vectorRank: i + 1 }));
}

// ── Helper: BM25 search menggunakan ts_rank_cd (PostgreSQL full-text) ────────
async function bm25Search(userQuery, limit = 20) {
  const terms = userQuery
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 10);
  
  if (terms.length === 0) {
    const { rows } = await pool.query(
      `SELECT rule_code, regime, category, title, content, 1.0 AS similarity, 'rule' AS source_type
       FROM rules ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return rows.map((r, i) => ({ ...r, _bm25Rank: i + 1 }));
  }

  const tsQuery = terms.map(t => `${t}:*`).join(' | ');
  
  // Search in rules
  const { rows: ruleRows } = await pool.query(
    `SELECT rule_code, regime, category, title,
            LEFT(content, 1200) AS content,
            ts_rank_cd(
              to_tsvector('indonesian', COALESCE(title,'') || ' ' || COALESCE(content,'')),
              to_tsquery('indonesian', $1)
            ) AS similarity,
            'rule' AS source_type
     FROM rules
     WHERE to_tsvector('indonesian', COALESCE(title,'') || ' ' || COALESCE(content,''))
           @@ to_tsquery('indonesian', $1)
        OR title ILIKE $2
     ORDER BY similarity DESC
     LIMIT $3`,
    [tsQuery, `%${terms[0]}%`, limit]
  );
  
  // Search in rule_chunks
  const { rows: chunkRows } = await pool.query(
    `SELECT rc.rule_code, r.regime, r.category, r.title,
            LEFT(rc.chunk_text, 1200) AS content,
            ts_rank_cd(
              to_tsvector('indonesian', COALESCE(r.title,'') || ' ' || COALESCE(rc.chunk_text,'')),
              to_tsquery('indonesian', $1)
            ) AS similarity,
            'chunk' AS source_type,
            rc.chunk_metadata
     FROM rule_chunks rc
     JOIN rules r ON r.rule_code = rc.rule_code
     WHERE to_tsvector('indonesian', COALESCE(r.title,'') || ' ' || COALESCE(rc.chunk_text,''))
           @@ to_tsquery('indonesian', $1)
        OR r.title ILIKE $2
     ORDER BY similarity DESC
     LIMIT $3`,
    [tsQuery, `%${terms[0]}%`, limit]
  );
  
  const combined = [...ruleRows, ...chunkRows]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
  
  return combined.map((r, i) => ({ ...r, _bm25Rank: i + 1 }));
}

// ── Helper: Reciprocal Rank Fusion (RRF) untuk gabungkan vector + BM25 ───────
function reciprocalRankFusion(vectorResults, bm25Results, k = RRF_K) {
  const scores = new Map();
  
  for (const [idx, doc] of vectorResults.entries()) {
    const key = doc.rule_code;
    const prev = scores.get(key) || { doc, rrfScore: 0, vectorRank: null, bm25Rank: null };
    prev.vectorRank = idx + 1;
    prev.rrfScore += 1 / (k + idx + 1);
    scores.set(key, prev);
  }
  
  for (const [idx, doc] of bm25Results.entries()) {
    const key = doc.rule_code;
    const prev = scores.get(key) || { doc, rrfScore: 0, vectorRank: null, bm25Rank: null };
    prev.bm25Rank = idx + 1;
    prev.rrfScore += 1 / (k + idx + 1);
    scores.set(key, prev);
  }
  
  return Array.from(scores.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map(({ doc, rrfScore, vectorRank, bm25Rank }) => ({
      ...doc,
      similarity: rrfScore,
      _vectorRank: vectorRank,
      _bm25Rank: bm25Rank,
      _rrfScore: rrfScore
    }));
}

// ── Helper: Hybrid Search (Vector + BM25 + RRF) ──────────────────────────────
async function hybridSearch(queryEmbedding, userQuery, limit = 5) {
  const searchLimit = Math.max(limit * 3, 20);
  
  const [vectorResults, bm25Results] = await Promise.all([
    vectorSearch(queryEmbedding, searchLimit),
    bm25Search(userQuery, searchLimit)
  ]);
  
  const fused = reciprocalRankFusion(vectorResults, bm25Results);
  return fused.slice(0, limit);
}

// ── Helper: fallback full-text search kalau belum ada pgvector ───────────────
async function fulltextSearch(userQuery, limit = 5) {
  return bm25Search(userQuery, limit);
}

// ── Helper: bangun konteks teks dari chunk yang ditemukan ────────────────────
function buildContext(chunks) {
  if (!chunks || chunks.length === 0) return 'Tidak ada data regulasi yang relevan ditemukan.';
  return chunks
    .map((c, i) => {
      const sourceLabel = c.source_type === 'chunk' ? 'CHUNK' : 'RULE';
      const meta = c.chunk_metadata ? ` [${c.chunk_metadata.headingPath || 'pasal'}]` : '';
      return `[${i + 1}] [${sourceLabel}] [YURISDIKSI: ${(c.regime || 'UMUM').toUpperCase()}] ` +
        `${c.rule_code} - ${c.title}${meta}:\n${(c.content || '').slice(0, 800)}`;
    })
    .join('\n\n---\n\n');
}

// ── Helper: ekstrak sitasi dari response LLM ─────────────────────────────────
function extractCitations(resultJson, chunks) {
  const citations = [];
  const textFields = [
    resultJson.loopholes_detected,
    resultJson.humanitarian_impact,
    resultJson.recommended_sanction,
    resultJson.source_rule,
    resultJson.conflicting_rule
  ].filter(Boolean);
  
  const fullText = textFields.join(' ').toLowerCase();
  
  for (const chunk of chunks) {
    const code = (chunk.rule_code || '').toLowerCase();
    const title = (chunk.title || '').toLowerCase();
    
    if (code && fullText.includes(code)) {
      citations.push({
        rule_code: chunk.rule_code,
        title: chunk.title,
        jurisdiction: chunk.regime || 'Umum',
        similarity: chunk.similarity ? parseFloat(Number(chunk.similarity).toFixed(4)) : null,
        matched_by: 'rule_code'
      });
    } else if (title && fullText.includes(title.slice(0, 30))) {
      citations.push({
        rule_code: chunk.rule_code,
        title: chunk.title,
        jurisdiction: chunk.regime || 'Umum',
        similarity: chunk.similarity ? parseFloat(Number(chunk.similarity).toFixed(4)) : null,
        matched_by: 'title'
      });
    }
  }
  
  // Dedup by rule_code
  const seen = new Set();
  return citations.filter(c => {
    if (seen.has(c.rule_code)) return false;
    seen.add(c.rule_code);
    return true;
  });
}

// ── Helper: parse JSON dari respons LLM yang mungkin mixed dengan 
function extractJson(raw) {
  // Hapus blok 
  const stripped = raw.replace(/thinking[\s\S]*?<\/think>/gi, '').trim();

  // Coba schema validation dengan auto-repair
  const { valid, data, repaired, errors } = validateAndRepair(stripped, finalResponseValidator, 'single_pass');
  
  if (valid && data) {
    if (repaired) console.log('[AI] Single-pass response auto-repaired');
    return { ...data, _validation: { valid: true, repaired } };
  }
  
  // Fallback ke logika ekstrak lama
  try { return { ...JSON.parse(stripped), _validation: { valid: false, fallback: 'direct_parse' } }; } catch (_) {}
  
  const fence = stripped.match(/```json\s*([\s\S]*?)```/i)?.[1] || stripped.match(/```\s*([\s\S]*?)```/)?.[1];
  if (fence) { 
    try { return { ...JSON.parse(fence.trim()), _validation: { valid: false, fallback: 'fence_parse' } }; } catch (_) {} 
  }
  
  const braceStart = stripped.indexOf('{');
  const braceEnd   = stripped.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    try { return { ...JSON.parse(stripped.slice(braceStart, braceEnd + 1)), _validation: { valid: false, fallback: 'brace_parse' } }; } catch (_) {}
  }
  
  // Final fallback
  return createFallbackResponse(stripped, errors?.map(e => e.message).join('; ') || 'All parsing attempts failed');
}

// ── MAIN CONTROLLER: POST /api/analyze ──────────────────────────────────────
export const analyzeRegulatoryCompliance = async (req, res) => {
  try {
    const { userQuery, useVector = true, useHybrid = true, limit = 5 } = req.body;

    if (!userQuery || String(userQuery).trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'userQuery minimal 5 karakter',
      });
    }

    const cleanQuery = String(userQuery).trim();

    // ── Input Guardrails ───────────────────────────────────────────────────────
    const inputCheck = moderateInput(cleanQuery);
    if (!inputCheck.safe) {
      return res.status(400).json({
        success: false,
        error: 'Query tidak memenuhi kebijakan keamanan',
        violations: inputCheck.violations
      });
    }

    let chunks = [];
    let retrievalMethod = 'fulltext';

    // ── 0. HyDE Query Expansion ──────────────────────────────────────────────
    const searchQuery = await hydeExpandQuery(cleanQuery);
    const usedHyde = searchQuery !== cleanQuery;

    // ── 1. Hybrid Search (Vector + BM25 + RRF) ──────────────────────────────
    if (useVector && useHybrid && await hasPgvector()) {
      try {
        const embedRes = await ollama.embeddings({
          model: EMBED_MODEL,
          prompt: searchQuery,
        });
        const queryVector = embedRes.embedding;
        chunks = await hybridSearch(queryVector, searchQuery, limit);
        if (chunks.length > 0) retrievalMethod = 'hybrid_rrf';
      } catch (embedErr) {
        console.warn('[AI] Hybrid search gagal, fallback ke vector only:', embedErr.message);
      }
    }

    // ── 2. Vector Only (jika hybrid gagal atau tidak diminta) ─────────────────
    if (chunks.length === 0 && useVector && await hasPgvector()) {
      try {
        const embedRes = await ollama.embeddings({
          model: EMBED_MODEL,
          prompt: searchQuery,
        });
        const queryVector = embedRes.embedding;
        chunks = await vectorSearch(queryVector, limit);
        if (chunks.length > 0) retrievalMethod = 'pgvector';
      } catch (embedErr) {
        console.warn('[AI] Embedding gagal, fallback ke BM25:', embedErr.message);
      }
    }

    // ── 3. Fallback ke BM25/Full-text Search ──────────────────────────────────
    if (chunks.length === 0) {
      chunks = await bm25Search(searchQuery, limit);
      retrievalMethod = 'bm25';
    }

    // ── 4. Cross-Encoder Reranking ────────────────────────────────────────────
    let reranked = false;
    if (RERANKER_ENABLED && chunks.length > 1) {
      const beforeRerank = chunks.map(c => c.rule_code).join(', ');
      chunks = await rerankDocuments(cleanQuery, chunks, limit);
      const afterRerank = chunks.map(c => c.rule_code).join(', ');
      if (beforeRerank !== afterRerank) {
        retrievalMethod += '+rerank';
        reranked = true;
      }
    }

    const contextText = buildContext(chunks);

    // ── 4. Bangun prompt untuk lex-integrity-agent ───────────────────────────
    const promptPayload = `Diberikan kumpulan pasal & regulasi hukum berikut dari database:

${contextText}

Pertanyaan / Isu Publik: "${cleanQuery}"

Tugas Agent:
Analisis isu di atas secara jujur, adil, berempati, dan berpijak pada kemanusiaan serta keadilan sosial.
Kembalikan respons HANYA dalam format JSON valid berikut (TANPA teks di luar JSON):

{
  "has_contradiction": true,
  "source_rule": "Kode pasal/UU utama",
  "conflicting_rule": "Kode pasal turunan/Perda yang berpotensi konflik",
  "loopholes_detected": "Analisis celah diskresi atau pasal karet",
  "humanitarian_impact": "Dampak nyata terhadap ruang hidup, hak warga rentan, dan keadilan sosial",
  "fairness_score": "HIGH_RISK_UNFAIR",
  "recommended_sanction": "Rekomendasi sanksi administrasi / pidana yang adil"
}`;

    // ── 5. Panggil lex-integrity-agent via Ollama ────────────────────────────
    const ollamaRes = await ollama.generate({
      model: AGENT_MODEL,
      prompt: promptPayload,
      stream: false,
      format: 'json',
      think: process.env.OLLAMA_THINK === 'true',
      keep_alive: `${parseInt(process.env.OLLAMA_KEEP_ALIVE_MIN || 30)}m`,
      options: {
        temperature: 0.15,
        num_ctx: 4096,
        top_p: 0.9,
      },
    });

    const rawResponse = ollamaRes.response || '';
    const resultJson  = extractJson(rawResponse);

    // ── Output Guardrails ──────────────────────────────────────────────────────
    const { output: guardedOutput, violations, passed, critical_count, warning_count } = applyGuardrails(resultJson);
    
    if (!passed && critical_count > 0) {
      console.warn('[AI] Output guardrails CRITICAL violations:', violations.filter(v => v.type === 'prohibited_content' || v.type === 'invalid_fairness_score'));
    } else if (warning_count > 0) {
      console.log('[AI] Output guardrails warnings:', warning_count);
    }

    // ── 6. Ekstrak sitasi dari response LLM ──────────────────────────────────
    const citations = extractCitations(guardedOutput, chunks);

    // ── 7. Kirim respons ke React Dashboard ─────────────────────────────────
    return res.status(200).json({
      success: true,
      data: guardedOutput,
      citations,
      guardrails: {
        passed,
        critical_violations: critical_count,
        warnings: warning_count,
        violation_details: violations
      },
      retrieved_chunks: chunks.map(c => ({
        code:           c.rule_code,
        title:          c.title,
        jurisdiction:   c.regime || 'Umum',
        similarity:     c.similarity ? parseFloat(Number(c.similarity).toFixed(4)) : null,
        vector_rank:    c._vectorRank || null,
        bm25_rank:      c._bm25Rank || null,
        rrf_score:      c._rrfScore ? parseFloat(Number(c._rrfScore).toFixed(6)) : null,
        rerank_score:   c.rerank_score ? parseFloat(Number(c.rerank_score).toFixed(4)) : null,
        rerank_rank:    c.rerank_rank || null,
      })),
      meta: {
        model:            AGENT_MODEL,
        retrieval_method: retrievalMethod,
        chunks_found:     chunks.length,
        query:            cleanQuery,
        rrf_k:            RRF_K,
        reranker_enabled: RERANKER_ENABLED,
        reranker_used:    reranked,
        hyde_enabled:     HYDE_ENABLED,
        hyde_used:        usedHyde,
      },
    });

  } catch (error) {
    console.error('[AI] analyzeRegulatoryCompliance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal melakukan analisis RAG AI.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ── Multi-Hop Reasoning Agent ───────────────────────────────────────────────
import { analyzeMultiHop } from '../services/MultiHopAgent.js';

export const analyzeMultiHopCompliance = async (req, res) => {
  try {
    const { userQuery, maxHops = 4, stream = false } = req.body;

    if (!userQuery || String(userQuery).trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'userQuery minimal 5 karakter',
      });
    }

    const cleanQuery = String(userQuery).trim();

    // ── Input Guardrails ───────────────────────────────────────────────────────
    const inputCheck = moderateInput(cleanQuery);
    if (!inputCheck.safe) {
      return res.status(400).json({
        success: false,
        error: 'Query tidak memenuhi kebijakan keamanan',
        violations: inputCheck.violations
      });
    }

    if (stream) {
      // SSE streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const result = await analyzeMultiHop(cleanQuery, {
          maxHops: parseInt(maxHops),
          onProgress: (progress) => sendEvent({ type: 'progress', ...progress })
        });
        sendEvent({ type: 'complete', data: result });
        res.end();
      } catch (err) {
        sendEvent({ type: 'error', error: err.message });
        res.end();
      }
      return;
    }

    // Non-streaming
    const result = await analyzeMultiHop(cleanQuery, { maxHops: parseInt(maxHops) });

    // ── Output Guardrails ──────────────────────────────────────────────────────
    const { output: guardedResult, violations, passed, critical_count, warning_count } = applyGuardrails(result);

    return res.status(200).json({
      success: true,
      data: guardedResult,
      guardrails: {
        passed,
        critical_violations: critical_count,
        warnings: warning_count,
        violation_details: violations
      },
      meta: {
        model: AGENT_MODEL,
        retrieval_method: 'multi_hop_react',
        max_hops: maxHops,
        query: cleanQuery,
      },
    });

  } catch (error) {
    console.error('[AI] analyzeMultiHopCompliance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal melakukan analisis multi-hop.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ── CONTROLLER: GET /api/analyze/status ─────────────────────────────────────
export const getAgentStatus = async (req, res) => {
  try {
    const models = await ollama.list();
    const agentFound = (models.models || []).some(m => m.name === AGENT_MODEL);
    const pgvector   = await hasPgvector();
    
    let rerankerStatus = { available: false };
    if (RERANKER_ENABLED) {
      try {
        const rr = await fetch(`${RERANKER_URL}/health`, { timeout: 3000 });
        if (rr.ok) rerankerStatus = await rr.json();
      } catch (_) {}
    }

    return res.status(200).json({
      success: true,
      data: {
        agent_model:       AGENT_MODEL,
        agent_available:   agentFound,
        embed_model:       EMBED_MODEL,
        pgvector_ready:    pgvector,
        retrieval_methods: ['hybrid_rrf', 'pgvector', 'bm25'],
        rrf_k:             RRF_K,
        reranker:          rerankerStatus,
        hyde_enabled:      HYDE_ENABLED,
        hyde_model:        HYDE_MODEL,
        ollama_models:     (models.models || []).map(m => m.name),
      },
    });
  } catch (error) {
    return res.status(200).json({
      success: false,
      data: {
        agent_model:     AGENT_MODEL,
        agent_available: false,
        pgvector_ready:  false,
        error:           error.message,
      },
    });
  }
};