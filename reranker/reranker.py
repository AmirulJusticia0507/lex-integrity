#!/usr/bin/env python3
"""
Cross-Encoder Reranker Service untuk Lex-Integrity
Menggunakan BGE-Reranker atau model serupa untuk reranking hasil hybrid search
"""

import os
import json
import logging
from typing import List, Dict, Any
from flask import Flask, request, jsonify
from sentence_transformers import CrossEncoder
import torch

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

MODEL_NAME = os.getenv('RERANKER_MODEL', 'BAAI/bge-reranker-base')
MODEL = None
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'

def load_model():
    global MODEL
    if MODEL is None:
        logger.info(f'Loading reranker model: {MODEL_NAME} on {DEVICE}')
        MODEL = CrossEncoder(MODEL_NAME, device=DEVICE, max_length=512)
        logger.info('Model loaded successfully')
    return MODEL

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model': MODEL_NAME,
        'device': DEVICE,
        'model_loaded': MODEL is not None
    })

@app.route('/rerank', methods=['POST'])
def rerank():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Invalid JSON'}), 400
        
        query = data.get('query', '')
        documents = data.get('documents', [])
        top_k = data.get('top_k', len(documents))
        
        if not query or not documents:
            return jsonify({'error': 'query and documents required'}), 400
        
        if not isinstance(documents, list):
            return jsonify({'error': 'documents must be a list'}), 400
        
        model = load_model()
        
        pairs = []
        for doc in documents:
            text = f"{doc.get('title', '')} {doc.get('content', '')}"
            pairs.append([query, text[:2000]])
        
        logger.info(f'Reranking {len(pairs)} documents for query: {query[:50]}...')
        scores = model.predict(pairs, batch_size=16, show_progress_bar=False)
        
        results = []
        for i, (doc, score) in enumerate(zip(documents, scores)):
            results.append({
                **doc,
                'rerank_score': float(score),
                'rerank_rank': i + 1
            })
        
        results.sort(key=lambda x: x['rerank_score'], reverse=True)
        
        for i, r in enumerate(results):
            r['rerank_rank'] = i + 1
        
        return jsonify({
            'results': results[:top_k],
            'model': MODEL_NAME
        })
    
    except Exception as e:
        logger.error(f'Rerank error: {e}')
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('RERANKER_PORT', 8001))
    load_model()
    app.run(host='0.0.0.0', port=port, threaded=False)