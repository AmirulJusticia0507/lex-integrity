/**
 * Multi-Hop Reasoning Agent (ReAct Pattern) for Legal Analysis
 * Supports iterative search + reasoning for complex multi-level legal queries
 * (e.g., UU → PP → Perpres → Perda conflict chains)
 */

import { Ollama } from 'ollama';
import { Pool } from 'pg';
import { 
  finalResponseValidator, 
  decompositionValidator, 
  reasoningStepValidator,
  validateAndRepair,
  createFallbackResponse
} from '../utils/schemaValidator.js';

const ollama = new Ollama({
  host: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
});

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_DATABASE || 'lex_integrity',
  password: process.env.DB_PASSWORD || 'admin123',
  port: parseInt(process.env.DB_PORT) || 5432,
});

const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
const AGENT_MODEL = process.env.OLLAMA_AGENT_MODEL || 'lex-integrity-agent:latest';
const MAX_HOPS = parseInt(process.env.MAX_HOPS || '4');
const MAX_SUB_QUERIES = parseInt(process.env.MAX_SUB_QUERIES || '3');

const SYSTEM_PROMPT = `Kamu adalah Lex-Integrity Multi-Hop Agent. Tugasmu: menganalisis isu hukum kompleks dengan penalaran bertahap (multi-hop).

PRINSIP:
1. DEKOMPOSISI: Pecah pertanyaan kompleks menjadi sub-pertanyaan atomik
2. RETRIEVAL ITERATIF: Cari bukti untuk setiap sub-pertanyaan
3. SINTESIS: Gabungkan temuan → kesimpulan akhir
4. FORMAT: Output HANYA JSON valid sesuai schema

SCHEMA OUTPUT AKHIR:
{
  "has_contradiction": boolean,
  "source_rule": "string",
  "conflicting_rule": "string", 
  "loopholes_detected": "string",
  "humanitarian_impact": "string",
  "fairness_score": "HIGH_RISK_UNFAIR" | "MODERATE" | "FAIR",
  "recommended_sanction": "string",
  "reasoning_chain": [
    {"step": 1, "sub_question": "...", "evidence": [...], "conclusion": "..."}
  ],
  "confidence": 0.0-1.0
}`;

async function embedQuery(text) {
  const res = await ollama.embeddings({ model: EMBED_MODEL, prompt: text });
  return res.embedding;
}

async function vectorSearch(queryVec, limit = 5) {
  const vectorStr = JSON.stringify(queryVec);
  const { rows } = await pool.query(`
    SELECT rule_code, regime, category, title, content,
           1 - (embedding <=> $1::vector) AS similarity
    FROM rules
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT $2
  `, [vectorStr, limit]);
  return rows;
}

async function bm25Search(query, limit = 5) {
  const terms = query.split(/\s+/).filter(w => w.length > 2).slice(0, 10);
  if (!terms.length) return [];
  const tsQuery = terms.map(t => `${t}:*`).join(' | ');
  const { rows } = await pool.query(`
    SELECT rule_code, regime, category, title, LEFT(content, 1200) AS content,
           ts_rank_cd(to_tsvector('indonesian', COALESCE(title,'') || ' ' || COALESCE(content,'')),
                      to_tsquery('indonesian', $1)) AS similarity
    FROM rules
    WHERE to_tsvector('indonesian', COALESCE(title,'') || ' ' || COALESCE(content,''))
          @@ to_tsquery('indonesian', $1)
    ORDER BY similarity DESC LIMIT $2
  `, [tsQuery, limit]);
  return rows;
}

async function hybridSearch(query, limit = 5) {
  const vec = await embedQuery(query);
  const [v, b] = await Promise.all([vectorSearch(vec, limit * 2), bm25Search(query, limit * 2)]);
  const fused = reciprocalRankFusion(v, b);
  return fused.slice(0, limit);
}

function reciprocalRankFusion(vecRes, bm25Res, k = 60) {
  const scores = new Map();
  vecRes.forEach((r, i) => {
    const key = r.rule_code;
    const prev = scores.get(key) || { doc: r, score: 0, vRank: null, bRank: null };
    prev.vRank = i + 1;
    prev.score += 1 / (k + i + 1);
    scores.set(key, prev);
  });
  bm25Res.forEach((r, i) => {
    const key = r.rule_code;
    const prev = scores.get(key) || { doc: r, score: 0, vRank: null, bRank: null };
    prev.bRank = i + 1;
    prev.score += 1 / (k + i + 1);
    scores.set(key, prev);
  });
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .map(({ doc, score, vRank, bRank }) => ({ ...doc, similarity: score, _vRank: vRank, _bRank: bRank }));
}

function buildContext(chunks) {
  return chunks.map((c, i) =>
    `[${i + 1}] [${c.regime}] ${c.rule_code} - ${c.title}:\n${c.content?.slice(0, 800)}`
  ).join('\n\n---\n\n');
}

async function llmGenerate(prompt, format = 'json', options = {}) {
  const res = await ollama.generate({
    model: AGENT_MODEL,
    prompt,
    stream: false,
    format,
    think: false,
    options: { temperature: 0.15, num_ctx: 4096, top_p: 0.9, ...options },
  });
  return res.response || '';
}

function parseJsonSafe(text) {
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  try { return JSON.parse(stripped); } catch (_) {}
  const fence = stripped.match(/```json\s*([\s\S]*?)```/i)?.[1] || stripped.match(/```\s*([\s\S]*?)```/)?.[1];
  if (fence) { try { return JSON.parse(fence.trim()); } catch (_) {} }
  const bs = stripped.indexOf('{'), be = stripped.lastIndexOf('}');
  if (bs !== -1 && be > bs) { try { return JSON.parse(stripped.slice(bs, be + 1)); } catch (_) {} }
  return null;
}

/**
 * DECOMPOSITION: Break complex query into atomic sub-questions
 */
async function decomposeQuery(userQuery) {
  const prompt = `${SYSTEM_PROMPT}

PERTANYAAN UTAMA: "${userQuery}"

Tugas: Dekomposisi pertanyaan di atas menjadi 2-3 sub-pertanyaan ATOMIK yang harus dijawab untuk menyelesaikan analisis. 
Setiap sub-pertanyaan harus:
- Fokus pada SATU aspek hukum spesifik
- Dapat dijawab dengan pencarian regulasi tunggal
- Saling terhubung membentuk rantai logis

Kembalikan HANYA JSON:
{
  "sub_questions": [
    {"id": 1, "question": "...", "focus": "hierarchy|loophole|sanction|impact|definition"},
    {"id": 2, "question": "...", "focus": "..."}
  ],
  "reasoning": "Alasan dekomposisi ini"
}`;
  
  const raw = await llmGenerate(prompt);
  const { valid, data, repaired } = validateAndRepair(raw, decompositionValidator, 'decompose');
  
  if (!valid || !data?.sub_questions?.length) {
    console.warn('[MultiHop] Decomposition validation failed, using fallback');
    return [{ id: 1, question: userQuery, focus: 'general' }];
  }
  
  if (repaired) console.log('[MultiHop] Decomposition auto-repaired');
  return data.sub_questions;
}

/**
 * RETRIEVAL: Search evidence for a sub-question
 */
async function retrieveEvidence(subQuestion, previousContext = []) {
  const searchQuery = previousContext.length > 0 
    ? `${subQuestion}\nKonteks: ${previousContext.slice(-2).map(c => c.conclusion).join(' ')}`
    : subQuestion;
  
  const chunks = await hybridSearch(searchQuery, 5);
  return chunks;
}

/**
 * REASONING: Analyze evidence for a sub-question
 */
async function reasonStep(subQuestion, evidence, previousSteps = []) {
  const contextText = buildContext(evidence);
  const prevSummary = previousSteps.map(s => `Step ${s.step}: ${s.conclusion}`).join('\n');
  
  const prompt = `${SYSTEM_PROMPT}

SUB-PERTANYAAN (Step ${previousSteps.length + 1}): "${subQuestion.question}"
FOKUS: ${subQuestion.focus}

KONTEKS SEBELUMNYA:
${prevSummary || '(tidak ada)'}

BUKTI DITEMUKAN:
${contextText || '(tidak ada bukti relevan)'}

Tugas: Analisis bukti di atas untuk menjawab sub-pertanyaan. Berikan kesimpulan ringkas + level kepercayaan.

Kembalikan HANYA JSON:
{
  "step": ${previousSteps.length + 1},
  "sub_question": "${subQuestion.question}",
  "evidence_used": ["rule_code1", "rule_code2"],
  "conclusion": "Kesimpulan singkat untuk sub-pertanyaan ini",
  "confidence": 0.0-1.0,
  "needs_more_search": false
}`;
  
  const raw = await llmGenerate(prompt);
  const { valid, data, repaired } = validateAndRepair(raw, reasoningStepValidator, 'reason');
  
  if (!valid || !data) {
    console.warn('[MultiHop] Reasoning step validation failed');
    return {
      step: previousSteps.length + 1,
      sub_question: subQuestion.question,
      evidence_used: evidence.map(e => e.rule_code).slice(0, 3),
      conclusion: 'Gagal memvalidasi penalaran langkah ini',
      confidence: 0.3,
      needs_more_search: false
    };
  }
  
  if (repaired) console.log(`[MultiHop] Step ${data.step} auto-repaired`);
  return data;
}

/**
 * SYNTHESIS: Combine all steps into final answer
 */
async function synthesizeFinal(userQuery, reasoningChain) {
  const chainSummary = reasoningChain.map(s => 
    `Step ${s.step} [${s.confidence.toFixed(2)}]: ${s.sub_question} → ${s.conclusion}`
  ).join('\n');
  
  const prompt = `${SYSTEM_PROMPT}

PERTANYAAN UTAMA: "${userQuery}"

REASONING CHAIN:
${chainSummary}

Tugas: Sintesis rantai penalaran di atas menjadi jawaban akhir yang KOMPLEKS, JUJUR, ADIL, BEREMPATI.
Pertimbangkan: hierarki hukum (UU > PP > Perpres > Perda), HAM, kemanusiaan, keadilan sosial.

Kembalikan HANYA JSON FINAL (schema di SYSTEM_PROMPT). Pastikan reasoning_chain mencakup semua step.`;
  
  const raw = await llmGenerate(prompt);
  const { valid, data, repaired } = validateAndRepair(raw, finalResponseValidator, 'synthesize');
  
  if (!valid || !data) {
    console.error('[MultiHop] Final synthesis validation failed');
    return createFallbackResponse(raw, 'Final response schema validation failed');
  }
  
  if (repaired) console.log('[MultiHop] Final response auto-repaired');
  
  // Ensure reasoning_chain is included
  return {
    ...data,
    reasoning_chain: reasoningChain
  };
}

/**
 * MAIN ENTRY: Multi-hop analysis
 */
export async function analyzeMultiHop(userQuery, options = {}) {
  const { maxHops = MAX_HOPS, onProgress } = options;
  const reasoningChain = [];
  let previousContext = [];
  
  // 1. DECOMPOSE
  if (onProgress) onProgress({ phase: 'decompose', message: 'Mendekomposisi pertanyaan...' });
  const subQuestions = await decomposeQuery(userQuery);
  if (onProgress) onProgress({ phase: 'decompose_done', subQuestions });
  
  // 2. ITERATIVE RETRIEVAL + REASONING
  for (let i = 0; i < Math.min(subQuestions.length, maxHops); i++) {
    const sq = subQuestions[i];
    if (onProgress) onProgress({ phase: 'retrieve', step: i + 1, subQuestion: sq.question });
    
    const evidence = await retrieveEvidence(sq, previousContext);
    if (onProgress) onProgress({ phase: 'retrieve_done', step: i + 1, evidenceCount: evidence.length });
    
    if (onProgress) onProgress({ phase: 'reason', step: i + 1 });
    const stepResult = await reasonStep(sq, evidence, reasoningChain);
    reasoningChain.push(stepResult);
    previousContext.push(stepResult);
    
    if (onProgress) onProgress({ phase: 'reason_done', step: i + 1, conclusion: stepResult.conclusion });
    
    // Early stop jika confidence tinggi & tidak butuh search lagi
    if (stepResult.confidence > 0.85 && !stepResult.needs_more_search && i >= 1) break;
  }
  
  // 3. SYNTHESIZE
  if (onProgress) onProgress({ phase: 'synthesize', message: 'Menyintesiskan jawaban akhir...' });
  const finalAnswer = await synthesizeFinal(userQuery, reasoningChain);
  
  if (onProgress) onProgress({ phase: 'complete', answer: finalAnswer });
  
  return {
    ...finalAnswer,
    reasoning_chain: reasoningChain,
    meta: {
      total_steps: reasoningChain.length,
      sub_questions: subQuestions.length,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * SIMPLE MODE: Single-pass with expanded context (fallback)
 */
export async function analyzeSinglePass(userQuery, chunks) {
  const contextText = buildContext(chunks);
  const prompt = `${SYSTEM_PROMPT}

KONTEKS REGULASI:
${contextText}

PERTANYAAN: "${userQuery}"

Analisis langsung (single-pass). Kembalikan JSON FINAL.`;
  
  const raw = await llmGenerate(prompt);
  return parseJsonSafe(raw);
}

export default { analyzeMultiHop, analyzeSinglePass, decomposeQuery, retrieveEvidence, reasonStep, synthesizeFinal };