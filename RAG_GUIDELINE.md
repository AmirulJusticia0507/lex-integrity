# RAG (Retrieval-Augmented Generation) Implementation Guide

## Overview

Project ini menggunakan arsitektur RAG **multi-lapis** untuk analisis integritas hukum:

| Layer | Lokasi | Fungsi Utama |
|-------|--------|--------------|
| **Layer 1: Embedding & Hybrid Search** | `server/src/controllers/aiController.js` | Vector (pgvector) + BM25 + Reciprocal Rank Fusion |
| **Layer 2: Cross-Encoder Reranker** | `server/src/services/reranker/reranker.py` | BGE-Reranker-base precision reranking |
| **Layer 3: Query Expansion (HyDE)** | `server/src/controllers/aiController.js` | Hypothetical Document Embeddings |
| **Layer 4: Adaptive Chunking** | `server/src/utils/chunking.js` | Semantic/heading-aware legal document splitting |
| **Layer 5: Multi-Hop Reasoning (ReAct)** | `server/src/services/MultiHopAgent.js` | Iterative search + reasoning for complex queries |
| **Layer 6: LLM Analysis Agent** | `server/src/services/RAGService.js` + `Modelfile` | Deep legal reasoning, loophole detection, fairness scoring |
| **Layer 7: Schema Validation** | `server/src/utils/schemaValidator.js` | JSON Schema validation with auto-repair |
| **Layer 8: Guardrails** | `server/src/utils/guardrails.js` | Safety, legal context, disclaimers |

---

## Architecture Diagram

```
User Query
    │
    ▼
┌─────────────────────────────────────────┐
│  Input Guardrails (moderateInput)       │
└─────────────────────────────────────────┘
    │
    ├──► SINGLE-PASS MODE: POST /api/analyze
    │       │
    │       ├──► 1. HyDE Query Expansion (optional)
    │       │
    │       ├──► 2. Hybrid Search (Vector + BM25 + RRF)
    │       │       ├──► pgvector cosine similarity (rules + rule_chunks)
    │       │       ├──► BM25/ts_rank_cd (PostgreSQL full-text)
    │       │       └──► Reciprocal Rank Fusion (k=60)
    │       │
    │       ├──► 3. Cross-Encoder Reranker (optional)
    │       │       └──► BGE-Reranker-base via Python microservice
    │       │
    │       ├──► 4. Build Context (adaptive chunks)
    │       │
    │       ├──► 5. LLM Generation (lex-integrity-agent)
    │       │
    │       ├──► 6. Schema Validation (JSON Schema + auto-repair)
    │       │
    │       ├──► 7. Output Guardrails (safety, legal context, disclaimers)
    │       │
    │       └──► 8. Citations Extraction + Response
    │
    └──► MULTI-HOP MODE: POST /api/analyze/multi-hop
            │
            ├──► 1. Decompose Query → Sub-questions
            │
            ├──► 2. For each sub-question (max 4 hops):
            │       ├──► Retrieve Evidence (Hybrid Search)
            │       ├──► Reason Step (Schema validated)
            │       └──► Check if more search needed
            │
            ├──► 3. Synthesize Final Answer (Schema validated)
            │
            ├──► 4. Output Guardrails
            │
            └──► 5. Return with full reasoning_chain
```

---

## API Endpoints

### POST /api/analyze — Single-Pass RAG Analysis

**Request:**
```json
{
  "userQuery": "string (min 5 chars)",
  "useVector": true,
  "useHybrid": true,
  "limit": 5
}
```

**Response includes:**
- `data`: Validated analysis output
- `citations`: Auto-extracted rule citations
- `guardrails`: `{ passed, critical_violations, warnings, violation_details }`
- `retrieved_chunks`: With `vector_rank`, `bm25_rank`, `rrf_score`, `rerank_score`, `rerank_rank`
- `meta`: `retrieval_method` (hybrid_rrf/pgvector/bm25+rerank), `hyde_used`, `reranker_used`

### POST /api/analyze/multi-hop — Multi-Hop ReAct Analysis

**Request:**
```json
{
  "userQuery": "string (min 5 chars)",
  "maxHops": 4,
  "stream": false
}
```

**Response includes:**
- `data`: Final analysis with `reasoning_chain` array
- `guardrails`: Same as single-pass
- `meta`: `retrieval_method: "multi_hop_react"`

**Streaming (SSE):** Set `"stream": true` for real-time progress events.

### GET /api/analyze/status

Returns model availability, pgvector status, reranker status, HyDE status, retrieval methods.

---

## Components Detail

### 1. aiController.js — Main RAG Pipeline Controller

**File:** `server/src/controllers/aiController.js`

**Key Functions:**
- `hybridSearch()` — Vector + BM25 + RRF
- `hydeExpandQuery()` — HyDE query expansion
- `rerankDocuments()` — Cross-encoder reranker client
- `extractJson()` — Schema-validated JSON parsing with auto-repair
- `extractCitations()` — Citation tracking from LLM output
- `analyzeRegulatoryCompliance` — Single-pass endpoint
- `analyzeMultiHopCompliance` — Multi-hop endpoint (streaming + non-streaming)

### 2. MultiHopAgent.js — ReAct Multi-Hop Reasoning

**File:** `server/src/services/MultiHopAgent.js`

**Flow:**
1. **Decompose** — Break complex query into atomic sub-questions
2. **Iterate** — For each sub-question: Retrieve → Reason → Check confidence
3. **Synthesize** — Combine reasoning chain into final answer
4. **Validate** — All steps validated against JSON Schema

**Exported:** `analyzeMultiHop(query, { maxHops, onProgress })`

### 3. Reranker Service — Cross-Encoder Reranking

**File:** `server/src/services/reranker/reranker.py` (Python Flask)

**Model:** `BAAI/bge-reranker-base` (configurable via `RERANKER_MODEL`)

**Endpoint:** `POST /rerank` — `{ query, documents[], top_k }` → scored results

**Docker:** `server/src/services/reranker/Dockerfile` — included in `docker-compose.yml`

### 4. Adaptive Chunking — Legal Document Splitting

**File:** `server/src/utils/chunking.js`

**Strategies:**
- `chunkLegalDocument()` — Heading-aware (BAB → BAGIAN → PARAGRAF → PASAL → AYAT → HURUF)
- `chunkByPasal()` — Article-based splitting with context preservation
- `extractPasalReferences()` — Auto-extract Pasal references from text
- `enrichChunkWithReferences()` — Add metadata to chunks

**Embedding Generation:** `server/src/scripts/generateEmbeddings.js` — Batch process rules → rule_chunks table

### 5. Schema Validator — JSON Schema Validation

**File:** `server/src/utils/schemaValidator.js`

**Schemas:**
- `FINAL_RESPONSE_SCHEMA` — Main analysis output (strict)
- `DECOMPOSITION_SCHEMA` — Sub-questions from decomposition
- `REASONING_STEP_SCHEMA` — Individual reasoning steps

**Features:**
- Zero-dependency validator (no AJV needed)
- Auto-repair for common issues (missing fields, enum fixes, range clamping)
- Fallback response generation when validation fails completely

### 6. Guardrails — Safety & Legal Compliance

**File:** `server/src/utils/guardrails.js`

**Input Guardrails (`moderateInput`):**
- Malicious intent detection (hack, exploit, violence, terrorism)
- Length limits

**Output Guardrails (`applyGuardrails`):**
- Prohibited content patterns (violence, illegal advice, PII)
- Legal context validation (Indonesian law references required)
- Fairness score enum validation
- Rule code citation consistency check
- Minimum content length enforcement
- PII sanitization (credit card, SSN, email)
- Auto-disclaimers for contradictions, high-risk scores, sanctions

**Output:** `{ output, violations[], passed, critical_count, warning_count }`

---

## Database Schema Updates

### New Tables

```sql
-- rule_chunks for adaptive chunking embeddings
CREATE TABLE rule_chunks (
    id SERIAL PRIMARY KEY,
    rule_code VARCHAR(100) NOT NULL REFERENCES rules(rule_code) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    chunk_metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(768),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rule_code, chunk_text)
);

CREATE INDEX idx_rule_chunks_embedding ON rule_chunks 
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
```

### Updated Rules Table
```sql
ALTER TABLE rules ADD COLUMN embedding vector(768);
CREATE INDEX idx_rules_embedding ON rules USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

---

## Environment Variables

```env
# Hybrid Search (Vector + BM25) + RRF
RRF_K=60
HYBRID_ALPHA=0.5

# Cross-Encoder Reranker
RERANKER_ENABLED=false
RERANKER_URL=http://localhost:8001
RERANKER_MODEL=BAAI/bge-reranker-base

# HyDE Query Expansion
HYDE_ENABLED=false
HYDE_MODEL=lex-integrity-agent:latest

# Multi-Hop Reasoning
MAX_HOPS=4
MAX_SUB_QUERIES=3

# Chunking
CHUNK_STRATEGY=pasal          # 'pasal' | 'semantic'
CHUNK_MAX_SIZE=1200
BATCH_SIZE=50
```

---

## Setup & Running

### 1. Start Ollama & Models
```bash
ollama serve
ollama pull deepseek-r1:8b
ollama pull nomic-embed-text
ollama create lex-integrity-agent -f Modelfile
```

### 2. Database Setup
```bash
psql -U postgres -d lex_integrity -f server/schema.sql
```

### 3. Generate Embeddings (for existing rules)
```bash
cd server
npm run embeddings
# Or with custom params:
CHUNK_STRATEGY=pasal CHUNK_MAX_SIZE=1200 node src/scripts/generateEmbeddings.js
```

### 4. Start Reranker (Optional)
```bash
docker-compose up -d reranker
# Enable in .env: RERANKER_ENABLED=true
```

### 5. Start Backend
```bash
cd server && npm run dev
```

### 6. Run Evaluation
```bash
# Quick test with golden set
npm run evaluate:golden

# Custom dataset
npm run evaluate -- --dataset=custom.json --output=results.json
```

---

## Testing Examples

### Single-Pass Query
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"userQuery": "Apakah Perda Sleman No 5/2023 bertentangan dengan UU 23/2014?"}'
```

### Multi-Hop Query (Complex Hierarchy)
```bash
curl -X POST http://localhost:3000/api/analyze/multi-hop \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"userQuery": "Bagaimana rantai kontradiksi dari UU Cipta Kerja ke Peraturan Menteri Ketenagakerjaan tentang PHK, lalu ke Perda Daerah yang mengatur PHK?"}'
```

### Streaming Multi-Hop
```bash
curl -X POST http://localhost:3000/api/analyze/multi-hop \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"userQuery": "...", "stream": true}' \
  --no-buffer
```

---

## Evaluation

**Golden Set:** `server/src/scripts/golden_set.json` — 10 test cases covering:
- Hierarchy conflicts (UU vs Perda)
- Loophole detection (pasal karet)
- Sanction lookup
- Humanitarian impact

**Metrics (RAGAS-style):**
- Retrieval: Recall@5, Precision@5, MRR@5, NDCG@5
- Generation: Contradiction accuracy, JSON validity, field completeness

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| `agent_available: false` | Model belum di-create | `ollama create lex-integrity-agent -f Modelfile` |
| `pgvector_ready: false` | Extension/column missing | Run schema.sql |
| `reranker: unavailable` | Service down | `docker-compose up -d reranker` |
| Slow response (>30s) | Cold start Ollama | Set `OLLAMA_KEEP_ALIVE_MIN=60` |
| JSON parse error | DeepSeek `thinking` block | `OLLAMA_THINK=false` (default) |
| Empty chunks | No matching rules | Check data ingestion, run embeddings |
| Schema validation fails | LLM output format drift | Check `_validation` in response, auto-repair logs |
| Guardrails critical | Prohibited content | Review violation details, adjust query |

---

## Future Improvements

- [ ] Replace `RAGService.mockLLM` dengan real Ollama call
- [ ] Incremental embedding pipeline (DB triggers / CDC)
- [ ] Observability (Langfuse / Phoenix tracing)
- [ ] A/B testing framework (prompt, temperature, model variants)
- [ ] Streaming response for single-pass mode
- [ ] Fine-tuning pipeline (LoRA on legal corpus)
- [ ] Human feedback loop (RLHF from thumbs up/down)
- [ ] Multi-modal (PDF table extraction, OCR for scanned regulations)