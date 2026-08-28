#!/usr/bin/env node
/**
 * Generate embeddings for rules using adaptive chunking
 * Usage: node src/scripts/generateEmbeddings.js [--batch-size=50] [--model=nomic-embed-text]
 */

import { Pool } from 'pg';
import { Ollama } from 'ollama';
import { chunkLegalDocument, chunkByPasal, enrichChunkWithReferences } from '../utils/chunking.js';
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

const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 50;
const CHUNK_MAX_SIZE = parseInt(process.env.CHUNK_MAX_SIZE) || 1200;
const CHUNK_STRATEGY = process.env.CHUNK_STRATEGY || 'pasal'; // 'pasal' | 'semantic'

async function ensureEmbeddingColumn() {
  const { rows } = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='rules' AND column_name='embedding'
  `);
  
  if (rows.length === 0) {
    console.log('Adding embedding column to rules table...');
    await pool.query('ALTER TABLE rules ADD COLUMN embedding vector(768)');
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS rules_embedding_idx 
      ON rules USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);
    console.log('Embedding column and index created');
  }
}

async function getRulesWithoutEmbedding(limit) {
  const { rows } = await pool.query(`
    SELECT rule_code, title, content, regime, category
    FROM rules
    WHERE embedding IS NULL
      AND content IS NOT NULL
      AND LENGTH(content) > 50
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);
  return rows;
}

async function getEmbedding(text) {
  const response = await ollama.embeddings({
    model: EMBED_MODEL,
    prompt: text,
  });
  return response.embedding;
}

function chunkContent(content, title, strategy) {
  if (strategy === 'pasal') {
    return chunkByPasal(content, { maxChunkSize: CHUNK_MAX_SIZE });
  }
  return chunkLegalDocument(content, { maxChunkSize: CHUNK_MAX_SIZE });
}

async function processRule(rule) {
  const chunks = chunkContent(rule.content, rule.title, CHUNK_STRATEGY);
  const enriched = enrichChunkWithReferences(chunks);
  
  const results = [];
  for (const chunk of enriched) {
    try {
      const embedding = await getEmbedding(chunk.text);
      results.push({
        rule_code: rule.rule_code,
        chunk_text: chunk.text,
        chunk_metadata: chunk.metadata,
        embedding: JSON.stringify(embedding),
      });
    } catch (err) {
      console.error(`  Embedding error for ${rule.rule_code}:`, err.message);
    }
  }
  return results;
}

async function saveChunks(chunkResults) {
  if (!chunkResults.length) return 0;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const cr of chunkResults) {
      await client.query(`
        INSERT INTO rule_chunks (rule_code, chunk_text, chunk_metadata, embedding)
        VALUES ($1, $2, $3, $4::vector)
        ON CONFLICT (rule_code, chunk_text) DO UPDATE SET
          chunk_metadata = EXCLUDED.chunk_metadata,
          embedding = EXCLUDED.embedding,
          updated_at = NOW()
      `, [cr.rule_code, cr.chunk_text, JSON.stringify(cr.chunk_metadata), cr.embedding]);
    }
    
    await client.query('COMMIT');
    return chunkResults.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  console.log('Starting embedding generation...');
  console.log(`Model: ${EMBED_MODEL}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Chunk strategy: ${CHUNK_STRATEGY}`);
  console.log(`Max chunk size: ${CHUNK_MAX_SIZE}`);
  
  await ensureEmbeddingColumn();
  
  let totalProcessed = 0;
  let totalChunks = 0;
  
  while (true) {
    const rules = await getRulesWithoutEmbedding(BATCH_SIZE);
    if (rules.length === 0) break;
    
    console.log(`\nProcessing batch of ${rules.length} rules...`);
    
    for (const rule of rules) {
      console.log(`  Processing: ${rule.rule_code} - ${rule.title.slice(0, 60)}`);
      
      try {
        const chunkResults = await processRule(rule);
        const saved = await saveChunks(chunkResults);
        totalChunks += saved;
        totalProcessed++;
        
        // Also update the main rule with a representative embedding (first chunk)
        if (chunkResults.length > 0) {
          await pool.query(
            'UPDATE rules SET embedding = $1::vector WHERE rule_code = $2',
            [chunkResults[0].embedding, rule.rule_code]
          );
        }
        
        console.log(`    → ${saved} chunks saved`);
      } catch (err) {
        console.error(`  Failed: ${rule.rule_code}`, err.message);
      }
    }
  }
  
  console.log(`\n✅ Done! Processed ${totalProcessed} rules, ${totalChunks} chunks`);
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});