/**
 * aiController.js
 * RAG Pipeline Controller: Embedding → pgvector Search → lex-integrity-agent LLM → JSON Response
 */

const { Pool } = require('pg');
const { Ollama } = require('ollama');

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

const AGENT_MODEL  = process.env.OLLAMA_AGENT_MODEL  || 'lex-integrity-agent:latest';
const EMBED_MODEL  = process.env.OLLAMA_EMBED_MODEL  || 'nomic-embed-text';

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

// ── Helper: cari chunk terdekat pakai pgvector ───────────────────────────────
async function vectorSearch(queryEmbedding, limit = 5) {
  const vectorStr = JSON.stringify(queryEmbedding);
  const { rows } = await pool.query(
    `SELECT rule_code, regime, category, title, content,
            1 - (embedding <=> $1::vector) AS similarity
     FROM rules
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [vectorStr, limit]
  );
  return rows;
}

// ── Helper: fallback full-text search kalau belum ada pgvector ───────────────
async function fulltextSearch(userQuery, limit = 5) {
  const terms = userQuery.split(/\s+/).filter(w => w.length > 3).slice(0, 6);
  if (terms.length === 0) {
    const { rows } = await pool.query(
      `SELECT rule_code, regime, category, title, content, 1.0 AS similarity
       FROM rules ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  }
  const tsQuery = terms.join(' | ');
  const { rows } = await pool.query(
    `SELECT rule_code, regime, category, title,
            LEFT(content, 800) AS content,
            ts_rank_cd(to_tsvector('indonesian', COALESCE(title,'') || ' ' || COALESCE(content,'')),
                       to_tsquery('indonesian', $1)) AS similarity
     FROM rules
     WHERE to_tsvector('indonesian', COALESCE(title,'') || ' ' || COALESCE(content,''))
           @@ to_tsquery('indonesian', $1)
        OR title ILIKE $2
     ORDER BY similarity DESC
     LIMIT $3`,
    [tsQuery, `%${terms[0]}%`, limit]
  );
  return rows;
}

// ── Helper: bangun konteks teks dari chunk yang ditemukan ────────────────────
function buildContext(chunks) {
  if (!chunks || chunks.length === 0) return 'Tidak ada data regulasi yang relevan ditemukan.';
  return chunks
    .map((c, i) =>
      `[${i + 1}] [YURISDIKSI: ${(c.regime || 'UMUM').toUpperCase()}] ` +
      `${c.rule_code} - ${c.title}:\n${(c.content || '').slice(0, 600)}`
    )
    .join('\n\n---\n\n');
}

// ── Helper: parse JSON dari respons LLM yang mungkin mixed dengan <think> ────
function extractJson(raw) {
  // Hapus blok <think>...</think> dari DeepSeek-R1
  const stripped = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Coba parse langsung
  try { return JSON.parse(stripped); } catch (_) {}

  // Coba ekstrak blok ```json ... ```
  const fence = stripped.match(/```json\s*([\s\S]*?)```/i)?.[1] || stripped.match(/```\s*([\s\S]*?)```/)?.[1];
  if (fence) { try { return JSON.parse(fence.trim()); } catch (_) {} }

  // Coba ekstrak dari { ... } pertama yang valid
  const braceStart = stripped.indexOf('{');
  const braceEnd   = stripped.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    try { return JSON.parse(stripped.slice(braceStart, braceEnd + 1)); } catch (_) {}
  }

  // Kembalikan fallback terstruktur
  return {
    has_contradiction: null,
    source_rule: 'Tidak dapat di-parse',
    conflicting_rule: '-',
    loopholes_detected: stripped.slice(0, 300),
    humanitarian_impact: 'Respons LLM tidak dalam format JSON yang valid.',
    fairness_score: 'MODERATE',
    recommended_sanction: '-',
  };
}

// ── MAIN CONTROLLER: POST /api/analyze ──────────────────────────────────────
exports.analyzeRegulatoryCompliance = async (req, res) => {
  try {
    const { userQuery, useVector = true, limit = 5 } = req.body;

    if (!userQuery || String(userQuery).trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'userQuery minimal 5 karakter',
      });
    }

    const cleanQuery = String(userQuery).trim();
    let chunks = [];
    let retrievalMethod = 'fulltext';

    // ── 1. Coba Vector Search (jika pgvector & embedding model tersedia) ────
    if (useVector && await hasPgvector()) {
      try {
        const embedRes = await ollama.embeddings({
          model: EMBED_MODEL,
          prompt: cleanQuery,
        });
        const queryVector = embedRes.embedding;
        chunks = await vectorSearch(queryVector, limit);
        if (chunks.length > 0) retrievalMethod = 'pgvector';
      } catch (embedErr) {
        console.warn('[AI] Embedding gagal, fallback ke fulltext:', embedErr.message);
      }
    }

    // ── 2. Fallback ke Full-text Search ─────────────────────────────────────
    if (chunks.length === 0) {
      chunks = await fulltextSearch(cleanQuery, limit);
      retrievalMethod = 'fulltext';
    }

    const contextText = buildContext(chunks);

    // ── 3. Bangun prompt untuk lex-integrity-agent ───────────────────────────
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

    // ── 4. Panggil lex-integrity-agent via Ollama ────────────────────────────
    const ollamaRes = await ollama.generate({
      model: AGENT_MODEL,
      prompt: promptPayload,
      stream: false,
      format: 'json',
      options: {
        temperature: 0.15,
        num_ctx: 4096,
        top_p: 0.9,
      },
    });

    const rawResponse = ollamaRes.response || '';
    const resultJson  = extractJson(rawResponse);

    // ── 5. Kirim respons ke React Dashboard ─────────────────────────────────
    return res.status(200).json({
      success: true,
      data: resultJson,
      retrieved_chunks: chunks.map(c => ({
        code:         c.rule_code,
        title:        c.title,
        jurisdiction: c.regime || 'Umum',
        similarity:   c.similarity ? parseFloat(Number(c.similarity).toFixed(4)) : null,
      })),
      meta: {
        model:            AGENT_MODEL,
        retrieval_method: retrievalMethod,
        chunks_found:     chunks.length,
        query:            cleanQuery,
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

// ── CONTROLLER: GET /api/analyze/status ─────────────────────────────────────
exports.getAgentStatus = async (req, res) => {
  try {
    const models = await ollama.list();
    const agentFound = (models.models || []).some(m => m.name === AGENT_MODEL);
    const pgvector   = await hasPgvector();

    return res.status(200).json({
      success: true,
      data: {
        agent_model:     AGENT_MODEL,
        agent_available: agentFound,
        embed_model:     EMBED_MODEL,
        pgvector_ready:  pgvector,
        ollama_models:   (models.models || []).map(m => m.name),
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
