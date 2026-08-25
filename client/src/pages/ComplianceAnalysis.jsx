import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain, Search, AlertTriangle, CheckCircle, ShieldAlert, Scale,
  FileText, ChevronRight, Loader2, Circle, ArrowRight, RefreshCw,
  Zap, Database, Cpu, Info, XCircle, Activity
} from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// ── Color map untuk fairness_score ──────────────────────────────────────────
const FAIRNESS_CONFIG = {
  HIGH_RISK_UNFAIR: {
    label: 'RISIKO TINGGI — TIDAK ADIL',
    bg: 'bg-red-500/20',
    border: 'border-red-500',
    text: 'text-red-400',
    dot: 'bg-red-500',
    icon: XCircle,
  },
  MODERATE: {
    label: 'MODERAT',
    bg: 'bg-amber-500/20',
    border: 'border-amber-500',
    text: 'text-amber-400',
    dot: 'bg-amber-500',
    icon: AlertTriangle,
  },
  FAIR: {
    label: 'ADIL',
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500',
    text: 'text-emerald-400',
    dot: 'bg-emerald-500',
    icon: CheckCircle,
  },
};

// ── Compliance Matrix Table ──────────────────────────────────────────────────
function ComplianceMatrixTable({ data, chunks }) {
  if (!data) return null;
  const fairness = FAIRNESS_CONFIG[data.fairness_score] || FAIRNESS_CONFIG.MODERATE;
  const FairnessIcon = fairness.icon;

  const rows = [
    {
      id: 'contradiction',
      label: 'Kontradiksi Terdeteksi',
      value: data.has_contradiction === true
        ? <span className="flex items-center gap-1.5 text-red-400 font-semibold"><AlertTriangle className="h-4 w-4" /> YA</span>
        : data.has_contradiction === false
          ? <span className="flex items-center gap-1.5 text-emerald-400 font-semibold"><CheckCircle className="h-4 w-4" /> TIDAK</span>
          : <span className="text-gray-400">—</span>,
    },
    {
      id: 'source',
      label: 'Aturan Sumber (UU Utama)',
      value: <span className="font-mono text-sky-300 bg-sky-900/30 px-2 py-0.5 rounded text-xs">{data.source_rule || '—'}</span>,
    },
    {
      id: 'conflict',
      label: 'Aturan Turunan / Konflik',
      value: <span className="font-mono text-amber-300 bg-amber-900/20 px-2 py-0.5 rounded text-xs">{data.conflicting_rule || '—'}</span>,
    },
    {
      id: 'loopholes',
      label: 'Celah Hukum (Loopholes)',
      value: <p className="text-gray-300 text-sm leading-relaxed">{data.loopholes_detected || '—'}</p>,
    },
    {
      id: 'impact',
      label: 'Dampak Kemanusiaan',
      value: <p className="text-gray-300 text-sm leading-relaxed">{data.humanitarian_impact || '—'}</p>,
    },
    {
      id: 'fairness',
      label: 'Skor Keadilan',
      value: (
        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${fairness.bg} ${fairness.border} ${fairness.text}`}>
          <span className={`w-2 h-2 rounded-full ${fairness.dot}`} />
          {fairness.label}
        </span>
      ),
    },
    {
      id: 'sanction',
      label: 'Rekomendasi Sanksi',
      value: <p className="text-gray-300 text-sm leading-relaxed">{data.recommended_sanction || '—'}</p>,
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 backdrop-blur overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700 bg-slate-900/40">
        <Scale className="h-5 w-5 text-sky-400" />
        <h3 className="font-bold text-white text-lg">Compliance Matrix</h3>
        <div className={`ml-auto flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${fairness.bg} ${fairness.border} ${fairness.text}`}>
          <FairnessIcon className="h-3.5 w-3.5" />
          {fairness.label}
        </div>
      </div>
      <div className="divide-y divide-slate-700/60">
        {rows.map(row => (
          <div key={row.id} className="grid grid-cols-[220px_1fr] gap-4 px-6 py-4 hover:bg-slate-700/20 transition-colors">
            <div className="flex items-start gap-2 pt-0.5">
              <ChevronRight className="h-4 w-4 text-sky-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm font-semibold text-slate-400 uppercase tracking-wide">{row.label}</span>
            </div>
            <div>{row.value}</div>
          </div>
        ))}
      </div>

      {/* Retrieved Chunks */}
      {chunks && chunks.length > 0 && (
        <div className="border-t border-slate-700 px-6 py-4 bg-slate-900/30">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Database className="h-3.5 w-3.5" /> Pasal Relevan yang Diambil dari Database
          </p>
          <div className="flex flex-wrap gap-2">
            {chunks.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-slate-700 border border-slate-600 text-slate-300 hover:border-sky-500 transition-colors" title={c.title}>
                <FileText className="h-3 w-3 text-sky-400 flex-shrink-0" />
                <span className="font-mono font-medium text-sky-300">{c.code}</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400 max-w-[140px] truncate">{c.jurisdiction}</span>
                {c.similarity != null && (
                  <span className="ml-1 text-emerald-400 font-mono">{(c.similarity * 100).toFixed(1)}%</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Hierarchy Graph (canvas-free SVG-based) ──────────────────────────────────
function HierarchyGraph({ data, chunks }) {
  if (!data) return null;
  const fairness = FAIRNESS_CONFIG[data.fairness_score] || FAIRNESS_CONFIG.MODERATE;

  const nodeW = 180, nodeH = 52, gap = 40;
  const svgW  = 640;
  const svgH  = 320;

  const nodes = [
    { id: 'root',   x: svgW / 2 - nodeW / 2, y: 20,            label: data.source_rule || 'UU Utama',          color: '#38bdf8', icon: '⚖️', type: 'root' },
    { id: 'derive', x: svgW / 2 - nodeW / 2, y: 20 + nodeH + gap, label: data.conflicting_rule || 'Aturan Turunan', color: '#a855f7', icon: '📄', type: 'derived' },
    { id: 'risk',   x: svgW / 2 - nodeW / 2, y: 20 + (nodeH + gap) * 2, label: `Risiko: ${data.fairness_score || 'MODERATE'}`,  color: fairness.dot.replace('bg-', '#').replace('-500',''), icon: '⚠️', type: 'risk' },
  ];

  // Add chunks as side nodes
  const chunkNodes = (chunks || []).slice(0, 4).map((c, i) => ({
    id:    `chunk-${i}`,
    x:     i % 2 === 0 ? 20 : svgW - nodeW - 20,
    y:     60 + Math.floor(i / 2) * (nodeH + gap),
    label: c.code,
    color: '#22c55e',
    icon:  '📋',
    type:  'local',
  }));

  const edges = [
    { from: 'root', to: 'derive', label: 'mandates', color: '#38bdf8', dash: false },
    { from: 'derive', to: 'risk',  label: 'contradicts', color: '#ef4444', dash: true },
    ...chunkNodes.map(cn => ({ from: 'root', to: cn.id, label: 'overlaps', color: '#f59e0b', dash: true })),
  ];

  function getCenter(node) {
    return { cx: node.x + nodeW / 2, cy: node.y + nodeH / 2 };
  }

  function findNode(id) {
    return [...nodes, ...chunkNodes].find(n => n.id === id);
  }

  const riskColorMap = {
    'bg-red-500':     '#ef4444',
    'bg-amber-500':   '#f59e0b',
    'bg-emerald-500': '#10b981',
  };
  const riskColor = riskColorMap[fairness.dot] || '#f59e0b';

  nodes[2].color = riskColor;

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 backdrop-blur overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700 bg-slate-900/40">
        <Activity className="h-5 w-5 text-purple-400" />
        <h3 className="font-bold text-white text-lg">Hierarchy Conflict Graph</h3>
        <div className="ml-auto flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-sky-400 inline-block" /> Mandates</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-red-400 border-dashed border-b inline-block" /> Contradicts</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-400 inline-block" style={{ borderTop: '2px dashed' }} /> Overlaps</span>
        </div>
      </div>
      <div className="p-4 flex justify-center overflow-x-auto">
        <svg width={svgW} height={svgH} className="max-w-full">
          <defs>
            <marker id="arrow-blue"   markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#38bdf8" /></marker>
            <marker id="arrow-red"    markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" /></marker>
            <marker id="arrow-yellow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" /></marker>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Edges */}
          {edges.map((e, i) => {
            const from = findNode(e.from);
            const to   = findNode(e.to);
            if (!from || !to) return null;
            const { cx: x1, cy: y1 } = getCenter(from);
            const { cx: x2, cy: y2 } = getCenter(to);
            const markerId = e.color === '#38bdf8' ? 'arrow-blue' : e.color === '#ef4444' ? 'arrow-red' : 'arrow-yellow';
            return (
              <g key={i}>
                <line x1={x1} y1={y1 + nodeH/2 - 2} x2={x2} y2={y2 - nodeH/2 + 2}
                  stroke={e.color} strokeWidth={1.5}
                  strokeDasharray={e.dash ? '6,3' : undefined}
                  markerEnd={`url(#${markerId})`}
                  opacity={0.7}
                />
                <text x={(x1 + x2) / 2 + 6} y={(y1 + y2) / 2} fill={e.color} fontSize="10" opacity={0.8}>{e.label}</text>
              </g>
            );
          })}

          {/* Main nodes */}
          {[...nodes, ...chunkNodes].map(node => (
            <g key={node.id} transform={`translate(${node.x},${node.y})`} filter="url(#glow)">
              <rect width={nodeW} height={nodeH} rx={12} ry={12}
                fill="rgba(15,23,42,0.85)" stroke={node.color} strokeWidth={1.5}
              />
              <text x={12} y={20} fontSize="16">{node.icon}</text>
              <text x={34} y={18} fill={node.color} fontSize="11" fontWeight="bold" fontFamily="monospace">
                {node.type === 'root' || node.type === 'derived' ? node.label?.slice(0,22) : node.label?.slice(0,18)}
              </text>
              <text x={34} y={34} fill="#94a3b8" fontSize="9.5" fontFamily="sans-serif">
                {node.type === 'root' ? 'UU Utama' : node.type === 'derived' ? 'Aturan Turunan' : node.type === 'risk' ? 'Risk Node' : 'Chunk DB'}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ── Status Bar ───────────────────────────────────────────────────────────────
function AgentStatusBar({ status }) {
  if (!status) return null;
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${status.agent_available ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-red-500 text-red-400 bg-red-500/10'}`}>
        <Cpu className="h-3 w-3" />
        {status.agent_model}
        {status.agent_available ? ' ✓' : ' ✗'}
      </span>
      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${status.pgvector_ready ? 'border-sky-500 text-sky-400 bg-sky-500/10' : 'border-slate-600 text-slate-500 bg-slate-800'}`}>
        <Database className="h-3 w-3" />
        pgvector {status.pgvector_ready ? '✓' : '— fallback fulltext'}
      </span>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ComplianceAnalysis() {
  const [query,     setQuery]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState(null);
  const [agentStatus, setAgentStatus] = useState(null);
  const [error,     setError]     = useState('');
  const [history,   setHistory]   = useState([]);
  const [activeTab, setActiveTab] = useState('table');

  // Fetch agent status on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/analyze/status`)
      .then(r => r.json())
      .then(d => { if (d.success !== false) setAgentStatus(d.data); })
      .catch(() => {});
  }, []);

  const [elapsed, setElapsed] = useState(0);

  const handleAnalyze = useCallback(async () => {
    const q = query.trim();
    if (!q || q.length < 5) {
      setError('Masukkan minimal 5 karakter untuk analisis.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    setElapsed(0);

    // Start elapsed timer
    const timer = setInterval(() => setElapsed(s => s + 1), 1000);

    // AbortController untuk timeout 5 menit
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 300000); // 5 menit

    try {
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userQuery: q, limit: 5 }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || json.error || 'Gagal menganalisis.');

      setResult(json);
      setHistory(prev => [{ query: q, result: json, ts: new Date() }, ...prev].slice(0, 10));
    } catch (e) {
      if (e.name === 'AbortError') {
        setError('Analisis melebihi batas waktu 5 menit. Coba query yang lebih singkat.');
      } else {
        setError(e.message);
      }
    } finally {
      clearTimeout(timeoutId);
      clearInterval(timer);
      setLoading(false);
    }
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAnalyze();
  };

  const exampleQueries = [
    'Apakah Perda retribusi parkir bertentangan dengan UU LLAJ?',
    'Celah hukum dalam regulasi tambang di wilayah adat Kalimantan',
    'Konflik antara UU Cipta Kerja dan hak buruh informal',
    'Pasal karet dalam UU ITE yang mengancam kebebasan berpendapat',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <div className="relative px-6 pt-8 pb-6 border-b border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-r from-sky-900/20 via-purple-900/10 to-slate-900/0 pointer-events-none" />
        <div className="relative max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-purple-600 flex items-center justify-center shadow-lg shadow-sky-500/30">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Analisis Kepatuhan Regulasi</h1>
              <p className="text-slate-400 text-sm">RAG Pipeline · lex-integrity-agent (DeepSeek-R1 14b) · Local AI</p>
            </div>
            <div className="ml-auto">
              <AgentStatusBar status={agentStatus} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Query Input */}
        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 backdrop-blur p-6 space-y-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <Search className="h-4 w-4 text-sky-400" />
            Isu Hukum / Pertanyaan Publik
          </label>
          <textarea
            id="compliance-query-input"
            rows={3}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Contoh: Apakah Perda retribusi parkir Sleman bertentangan dengan UU LLAJ No.22/2009?"
            className="w-full bg-slate-900/70 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 resize-none transition-all text-sm"
          />
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {exampleQueries.map((q, i) => (
                <button key={i} onClick={() => setQuery(q)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-slate-600 text-slate-400 hover:border-sky-500 hover:text-sky-300 transition-colors">
                  {q.length > 40 ? q.slice(0, 40) + '…' : q}
                </button>
              ))}
            </div>
            <button
              id="analyze-submit-btn"
              onClick={handleAnalyze}
              disabled={loading || !query.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 text-white font-semibold text-sm transition-all shadow-lg shadow-sky-500/20 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Menganalisis…</>
                : <><Zap className="h-4 w-4" /> Analisis (Ctrl+Enter)</>
              }
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Pipeline: Query → {agentStatus?.pgvector_ready ? 'Embedding → pgvector search' : 'Full-text search'} → RAG Context → lex-integrity-agent → JSON
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-8 text-center space-y-4">
            <div className="flex items-center justify-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
                <div className="absolute inset-0 rounded-full border-4 border-t-sky-500 animate-spin" />
                <Brain className="absolute inset-0 m-auto h-6 w-6 text-sky-400" />
              </div>
            </div>
            <div>
              <p className="text-white font-semibold">lex-integrity-agent sedang menganalisis…</p>
              <p className="text-slate-400 text-sm mt-1">DeepSeek-R1 14b membutuhkan waktu 1–3 menit untuk inferensi lokal</p>
            </div>
            <div className="flex items-center justify-center gap-6 text-xs text-slate-500">
              <span className="flex items-center gap-1.5 text-emerald-400"><CheckCircle className="h-3.5 w-3.5" /> Retrieval selesai</span>
              <span className="flex items-center gap-1.5 text-sky-400 animate-pulse"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Inferensi LLM…</span>
              <span className="flex items-center gap-1.5"><Circle className="h-3.5 w-3.5" /> Format JSON</span>
            </div>
            <div className="text-slate-500 text-sm font-mono">
              {Math.floor(elapsed / 60).toString().padStart(2,'0')}:{(elapsed % 60).toString().padStart(2,'0')} berlalu
            </div>
            <div className="w-full bg-slate-700 rounded-full h-1 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-sky-500 to-purple-500 rounded-full animate-pulse" style={{ width: `${Math.min(elapsed * 2, 90)}%`, transition: 'width 1s linear' }} />
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-4">
            {/* Meta badge */}
            <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700">
                <Cpu className="h-3 w-3 text-purple-400" /> {result.meta?.model}
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700">
                <Database className="h-3 w-3 text-sky-400" /> {result.meta?.retrieval_method} · {result.meta?.chunks_found} pasal ditemukan
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700">
                <Info className="h-3 w-3 text-slate-400" /> {new Date().toLocaleString('id-ID')}
              </span>
              <button onClick={handleAnalyze} className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 hover:border-sky-500 hover:text-sky-300 transition-colors">
                <RefreshCw className="h-3 w-3" /> Re-analisis
              </button>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 bg-slate-800/80 rounded-xl p-1 w-fit border border-slate-700">
              {[
                { id: 'table', label: 'Compliance Matrix', icon: Scale },
                { id: 'graph', label: 'Hierarchy Graph',   icon: Activity },
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                    <Icon className="h-4 w-4" /> {tab.label}
                  </button>
                );
              })}
            </div>

            {activeTab === 'table' && (
              <ComplianceMatrixTable data={result.data} chunks={result.retrieved_chunks} />
            )}
            {activeTab === 'graph' && (
              <HierarchyGraph data={result.data} chunks={result.retrieved_chunks} />
            )}
          </div>
        )}

        {/* History */}
        {history.length > 1 && (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-5">
            <h4 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4" /> Riwayat Analisis Sesi Ini
            </h4>
            <div className="space-y-2">
              {history.slice(1).map((h, i) => {
                const fairness = FAIRNESS_CONFIG[h.result?.data?.fairness_score] || FAIRNESS_CONFIG.MODERATE;
                return (
                  <button key={i} onClick={() => { setResult(h.result); setQuery(h.query); setActiveTab('table'); }}
                    className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900/50 hover:bg-slate-700/40 border border-slate-700/50 hover:border-slate-600 transition-colors">
                    <ArrowRight className="h-3.5 w-3.5 text-sky-400 flex-shrink-0" />
                    <span className="text-sm text-slate-300 truncate flex-1">{h.query}</span>
                    <span className={`flex-shrink-0 w-2 h-2 rounded-full ${fairness.dot}`} />
                    <span className={`flex-shrink-0 text-xs ${fairness.text}`}>{h.result?.data?.fairness_score}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="text-center py-16 text-slate-600">
            <Brain className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-semibold">Masukkan isu hukum untuk dianalisis</p>
            <p className="text-sm mt-1">AI akan menelusuri 24.000+ regulasi dan menghasilkan analisis keadilan struktural</p>
          </div>
        )}
      </div>
    </div>
  );
}
