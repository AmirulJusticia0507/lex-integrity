#!/usr/bin/env node
/**
 * RAG Evaluation Harness - RAGAS-style metrics
 * Usage: node src/scripts/evaluateRAG.js [--dataset=golden.json] [--output=results.json]
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { Ollama } from 'ollama';
import 'dotenv/config';

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_DATABASE || 'lex_integrity',
  password: process.env.DB_PASSWORD || 'admin123',
  port: parseInt(process.env.DB_PORT) || 5432,
});

const ollama = new Ollama({
  host: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
});

const AGENT_MODEL = process.env.OLLAMA_AGENT_MODEL || 'lex-integrity-agent:latest';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

const DEFAULT_GOLDEN_SET = [
  {
    id: 'gold-001',
    query: 'Apakah Perda Sleman No 5/2023 bertentangan dengan UU 23/2014 tentang Pemerintahan Daerah?',
    expected_rules: ['UU-23-2014', 'PERDA-SLEMAN-5-2023'],
    expected_contradiction: true,
    category: 'hierarchy_conflict'
  },
  {
    id: 'gold-002',
    query: 'Apa sanksi bagi pejabat yang menyalahgunakan wewenang diskresi dalam Peraturan Daerah?',
    expected_rules: ['UU-30-2014', 'UU-28-1999'],
    expected_contradiction: false,
    category: 'sanction_lookup'
  },
  {
    id: 'gold-003',
    query: 'Bagaimana dampak humaniter dari Perpres tentang Rute Transmigrasi terhadap masyarakat adat?',
    expected_rules: ['UU-18-2012', 'PERPRES-TRANSMIGRASI'],
    expected_contradiction: null,
    category: 'humanitarian_impact'
  },
  {
    id: 'gold-004',
    query: 'Apakah pasal karet dalam Perda Retribusi Daerah berpotensi korupsi?',
    expected_rules: ['UU-28-2009', 'PERDA-RETRIBUSI'],
    expected_contradiction: true,
    category: 'loophole_detection'
  },
  {
    id: 'gold-005',
    query: 'Konflik antara UU Cipta Kerja dan Peraturan Menteri Ketenagakerjaan tentang PHK',
    expected_rules: ['UU-11-2020', 'PERMEN-KENAKER-PHK'],
    expected_contradiction: true,
    category: 'hierarchy_conflict'
  },
];

function loadGoldenSet(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.log('Using default golden set');
    return DEFAULT_GOLDEN_SET;
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return Array.isArray(data) ? data : data.test_cases || DEFAULT_GOLDEN_SET;
}

async function retrieveContext(query, limit = 5) {
  const embedRes = await ollama.embeddings({ model: EMBED_MODEL, prompt: query });
  const vectorStr = JSON.stringify(embedRes.embedding);
  
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

async function generateAnswer(query, contextChunks) {
  const contextText = contextChunks
    .map((c, i) => `[${i + 1}] ${c.rule_code} - ${c.title}:\n${(c.content || '').slice(0, 600)}`)
    .join('\n\n---\n\n');
  
  const prompt = `Diberikan kumpulan pasal & regulasi hukum berikut dari database:

${contextText}

Pertanyaan / Isu Publik: "${query}"

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
  
  const response = await ollama.generate({
    model: AGENT_MODEL,
    prompt,
    stream: false,
    format: 'json',
    think: false,
    options: { temperature: 0.15, num_ctx: 4096, top_p: 0.9 },
  });
  
  let result = response.response || '';
  result = result.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  
  try { return JSON.parse(result); } catch (_) {}
  
  const fence = result.match(/```json\s*([\s\S]*?)```/i)?.[1] || result.match(/```\s*([\s\S]*?)```/)?.[1];
  if (fence) { try { return JSON.parse(fence.trim()); } catch (_) {} }
  
  const braceStart = result.indexOf('{');
  const braceEnd = result.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    try { return JSON.parse(result.slice(braceStart, braceEnd + 1)); } catch (_) {}
  }
  
  return { parse_error: true, raw: result };
}

function calculateRetrievalMetrics(retrieved, expected) {
  const retrievedCodes = retrieved.map(r => r.rule_code);
  const relevant = new Set(expected);
  const retrievedRelevant = retrievedCodes.filter(c => relevant.has(c));
  
  const recall = relevant.size > 0 ? retrievedRelevant.length / relevant.size : 0;
  const precision = retrievedCodes.length > 0 ? retrievedRelevant.length / retrievedCodes.length : 0;
  
  let mrr = 0;
  for (let i = 0; i < retrievedCodes.length; i++) {
    if (relevant.has(retrievedCodes[i])) {
      mrr = 1 / (i + 1);
      break;
    }
  }
  
  let ndcg = 0;
  if (retrievedRelevant.length > 0) {
    const dcg = retrievedCodes.reduce((sum, code, idx) => {
      return sum + (relevant.has(code) ? 1 / Math.log2(idx + 2) : 0);
    }, 0);
    const ideal = Array.from(relevant).slice(0, retrievedCodes.length)
      .reduce((sum, _, idx) => sum + 1 / Math.log2(idx + 2), 0);
    ndcg = ideal > 0 ? dcg / ideal : 0;
  }
  
  return { recall, precision, mrr, ndcg, retrieved_count: retrievedCodes.length };
}

function calculateGenerationMetrics(generated, expected) {
  const metrics = {
    contradiction_accuracy: null,
    has_source_rule: !!generated.source_rule,
    has_conflicting_rule: !!generated.conflicting_rule,
    has_loopholes: !!generated.loopholes_detected && generated.loopholes_detected.length > 10,
    has_humanitarian_impact: !!generated.humanitarian_impact && generated.humanitarian_impact.length > 10,
    has_fairness_score: !!generated.fairness_score,
    has_sanction: !!generated.recommended_sanction,
    json_valid: !generated.parse_error,
  };
  
  if (expected.expected_contradiction !== null && generated.has_contradiction !== undefined) {
    metrics.contradiction_accuracy = generated.has_contradiction === expected.expected_contradiction;
  }
  
  return metrics;
}

async function runEvaluation(goldenSet, outputFile) {
  console.log(`Running evaluation on ${goldenSet.length} test cases...\n`);
  
  const results = [];
  let totals = {
    recall: 0, precision: 0, mrr: 0, ndcg: 0,
    contradiction_accuracy: 0, contradiction_count: 0,
    json_valid: 0, source_rule: 0, conflicting_rule: 0,
    loopholes: 0, humanitarian: 0, fairness: 0, sanction: 0,
  };
  
  for (const testCase of goldenSet) {
    console.log(`[${testCase.id}] ${testCase.query.slice(0, 80)}...`);
    
    const retrieved = await retrieveContext(testCase.query, 5);
    const retrievalMetrics = calculateRetrievalMetrics(retrieved, testCase.expected_rules);
    
    const generated = await generateAnswer(testCase.query, retrieved);
    const generationMetrics = calculateGenerationMetrics(generated, testCase);
    
    const result = {
      test_case: testCase,
      retrieved: retrieved.map(r => ({ rule_code: r.rule_code, similarity: r.similarity })),
      retrieval_metrics: retrievalMetrics,
      generated,
      generation_metrics: generationMetrics,
    };
    
    results.push(result);
    
    totals.recall += retrievalMetrics.recall;
    totals.precision += retrievalMetrics.precision;
    totals.mrr += retrievalMetrics.mrr;
    totals.ndcg += retrievalMetrics.ndcg;
    
    if (generationMetrics.contradiction_accuracy !== null) {
      totals.contradiction_accuracy += generationMetrics.contradiction_accuracy ? 1 : 0;
      totals.contradiction_count++;
    }
    if (generationMetrics.json_valid) totals.json_valid++;
    if (generationMetrics.has_source_rule) totals.source_rule++;
    if (generationMetrics.has_conflicting_rule) totals.conflicting_rule++;
    if (generationMetrics.has_loopholes) totals.loopholes++;
    if (generationMetrics.has_humanitarian_impact) totals.humanitarian++;
    if (generationMetrics.has_fairness_score) totals.fairness++;
    if (generationMetrics.has_sanction) totals.sanction++;
    
    console.log(`  Recall: ${retrievalMetrics.recall.toFixed(3)} | MRR: ${retrievalMetrics.mrr.toFixed(3)} | JSON: ${generationMetrics.json_valid ? '✓' : '✗'}`);
  }
  
  const n = goldenSet.length;
  const summary = {
    retrieval: {
      avg_recall: totals.recall / n,
      avg_precision: totals.precision / n,
      avg_mrr: totals.mrr / n,
      avg_ndcg: totals.ndcg / n,
    },
    generation: {
      contradiction_accuracy: totals.contradiction_count > 0 ? totals.contradiction_accuracy / totals.contradiction_count : null,
      json_validity_rate: totals.json_valid / n,
      source_rule_rate: totals.source_rule / n,
      conflicting_rule_rate: totals.conflicting_rule / n,
      loopholes_rate: totals.loopholes / n,
      humanitarian_impact_rate: totals.humanitarian / n,
      fairness_score_rate: totals.fairness / n,
      sanction_rate: totals.sanction / n,
    },
    total_cases: n,
    timestamp: new Date().toISOString(),
  };
  
  console.log('\n========== EVALUATION SUMMARY ==========');
  console.log(`Retrieval:`);
  console.log(`  Recall@5:     ${summary.retrieval.avg_recall.toFixed(3)}`);
  console.log(`  Precision@5:  ${summary.retrieval.avg_precision.toFixed(3)}`);
  console.log(`  MRR@5:        ${summary.retrieval.avg_mrr.toFixed(3)}`);
  console.log(`  NDCG@5:       ${summary.retrieval.avg_ndcg.toFixed(3)}`);
  console.log(`Generation:`);
  console.log(`  Contradiction Acc: ${summary.generation.contradiction_accuracy !== null ? summary.generation.contradiction_accuracy.toFixed(3) : 'N/A'}`);
  console.log(`  JSON Validity:     ${summary.generation.json_validity_rate.toFixed(3)}`);
  console.log(`  Source Rule:       ${summary.generation.source_rule_rate.toFixed(3)}`);
  console.log(`  Conflicting Rule:  ${summary.generation.conflicting_rule_rate.toFixed(3)}`);
  console.log(`  Loopholes:         ${summary.generation.loopholes_rate.toFixed(3)}`);
  console.log(`  Humanitarian:      ${summary.generation.humanitarian_impact_rate.toFixed(3)}`);
  console.log(`  Fairness Score:    ${summary.generation.fairness_score_rate.toFixed(3)}`);
  console.log(`  Sanction:          ${summary.generation.sanction_rate.toFixed(3)}`);
  
  if (outputFile) {
    fs.writeFileSync(outputFile, JSON.stringify({ summary, results }, null, 2));
    console.log(`\nResults saved to ${outputFile}`);
  }
  
  return { summary, results };
}

async function main() {
  const args = process.argv.slice(2);
  const datasetFile = args.find(a => a.startsWith('--dataset='))?.split('=')[1];
  const outputFile = args.find(a => a.startsWith('--output='))?.split('=')[1] || 'evaluation_results.json';
  
  const goldenSet = loadGoldenSet(datasetFile);
  
  try {
    await runEvaluation(goldenSet, outputFile);
  } catch (err) {
    console.error('Evaluation failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();