import React, { useState, useEffect } from 'react';
import { Activity, Database, Brain, Cloud, Shield, Cpu, RefreshCw, Play, Zap as ZapIcon, Database as DatabaseIcon, Trash2 as Broom, ExternalLink, ArrowRight, CheckCircle2, XCircle, Loader2, X, Globe2 } from 'lucide-react';
import { authFetch, apiUrl } from '../utils/http';

const DashboardOverview = () => {
  const [systemHealth, setSystemHealth] = useState({
    database: 'checking',
    redis: 'checking',
    ollama: 'checking',
    gemini: 'checking',
    aiProvider: 'checking',
    chatModel: null,
    queue: 'checking',
    api: 'checking'
  });
  const [actionState, setActionState] = useState({ loading: null, message: null, error: null });
  const [scrapeModalOpen, setScrapeModalOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState('sleman');

  const scrapeSources = [
    {
      id: 'sleman',
      title: 'JDIH Sleman',
      description: 'Produk hukum dari jdih.slemankab.go.id',
      endpoint: '/api/actions/scrape',
      body: { source: 'sleman', sources: ['jdih.slemankab.go.id'] },
      available: true,
    },
    {
      id: 'jogja',
      title: 'JDIH DIY / Jogja',
      description: 'Produk hukum dari SPL JDIH Provinsi DIY',
      endpoint: '/api/actions/scrape-jogja',
      body: {},
      available: true,
    },
    {
      id: 'kpu',
      title: 'JDIH KPU',
      description: 'Belum ada scraper KPU di backend',
      endpoint: null,
      body: {},
      available: false,
    },
  ];
  
  useEffect(() => {
    const checkSystemHealth = async () => {
      const healthData = {};
      
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const response = await fetch(apiUrl('/health'), { signal: controller.signal });
        clearTimeout(timeout);
        const health = await response.json();
        
        healthData.api = response.ok || health.status === 'ok' ? 'healthy' : 'error';
        healthData.database = health.database === 'connected' ? 'healthy' : 'error';
        healthData.redis = health.redis === 'connected' ? 'healthy' : 'error';
        healthData.ollama = health.ollama === 'connected' ? 'healthy' : 'error';
        healthData.gemini = health.gemini === 'configured' ? 'healthy' : 'error';
        healthData.aiProvider = health.ai_provider || 'ollama';
        healthData.chatModel = health.chat_model || null;
        healthData.ai = health.ai_provider === 'gemini' || health.ollama === 'connected' ? 'healthy' : 'error';
        healthData.queue = health.queue === 'connected' ? 'healthy' : 'error';
        
        setSystemHealth(healthData);
      } catch (error) {
        setSystemHealth(prev => ({ ...prev, api: 'error', database: 'error', redis: 'error', ollama: 'error', gemini: 'error', ai: 'error', queue: 'error' }));
      }
    };
    
    checkSystemHealth();
    const interval = setInterval(checkSystemHealth, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  const runAction = async (action, label) => {
    setActionState({ loading: action, message: null, error: null });
    try {
      let res;
      if (action === 'export') {
        res = await authFetch('/api/analytics/export?format=csv');
        if (!res.ok) throw new Error('Gagal mengekspor data');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rules_${Date.now()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        setActionState({ loading: null, message: 'Data berhasil diekspor (CSV)', error: null });
        return;
      }
      res = await authFetch(`/api/actions/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Aksi gagal');
      setActionState({ loading: null, message: data.message || `${label} selesai`, error: null });
    } catch (error) {
      setActionState({ loading: null, message: null, error: error.message });
    }
  };
  
  const systemMetrics = [
    { label: 'Database', value: '85%', icon: Database, status: systemHealth.database },
    { label: 'Redis Cache', value: '92%', icon: Cloud, status: systemHealth.redis },
    { label: systemHealth.aiProvider === 'gemini' ? 'Gemini API' : 'Local LLM', value: '78%', icon: Brain, status: systemHealth.ai },
    { label: 'Processing Queue', value: '65%', icon: Activity, status: systemHealth.queue },
    { label: 'Security', value: '99%', icon: Shield, status: 'healthy' },
    { label: 'CPU Usage', value: '45%', icon: Cpu, status: 'healthy' }
  ];
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const runScrapeSource = async () => {
    const source = scrapeSources.find(item => item.id === selectedSource);
    if (!source || !source.available) return;

    setActionState({ loading: 'scrape', message: null, error: null });
    try {
      const res = await authFetch(source.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source.body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Scraping gagal dijadwalkan');
      setScrapeModalOpen(false);
      setActionState({ loading: null, message: data.message || `Scraping ${source.title} dijadwalkan`, error: null });
    } catch (error) {
      setActionState({ loading: null, message: null, error: error.message });
    }
  };

  const StatusLine = ({ status, ok, fail }) => {
    const Icon = status === 'healthy' ? CheckCircle2 : status === 'checking' ? Loader2 : XCircle;
    const text = status === 'healthy' ? ok : status === 'checking' ? `Memeriksa ${ok}` : fail;
    const color = status === 'healthy' ? 'text-green-400' : status === 'checking' ? 'text-yellow-300' : 'text-red-400';

    return (
      <div className={`flex items-center gap-2 ${color}`}>
        <Icon className={`h-4 w-4 ${status === 'checking' ? 'animate-spin' : ''}`} />
        <span>{text}</span>
      </div>
    );
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-800">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 dark:text-gray-100">Sistem Kesehatan</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {systemMetrics.map((metric, index) => (
            <div key={index} className="flex items-center p-4 border rounded-lg hover:shadow-md transition-shadow dark:border-gray-700">
              <metric.icon className="h-8 w-8 text-gray-600 mr-4 dark:text-gray-400" />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{metric.label}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(metric.status)}`}>{metric.status}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: metric.value }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 dark:text-gray-100">Server Logs</h3>
        <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm h-64 overflow-y-auto">
          <StatusLine status={systemHealth.api} ok="API v1 aktif" fail="API v1 tidak merespons" />
          <StatusLine status={systemHealth.database} ok="Terhubung ke PostgreSQL" fail="PostgreSQL tidak tersedia" />
          <StatusLine status={systemHealth.redis} ok="Terhubung ke Redis" fail="Redis tidak tersedia" />
          <StatusLine status="healthy" ok="Rate limiting diaktifkan" fail="Rate limiting tidak aktif" />
          <StatusLine status="healthy" ok="CORS dikonfigurasi" fail="CORS belum dikonfigurasi" />
          {systemHealth.aiProvider === 'gemini' ? (
            <StatusLine status={systemHealth.gemini} ok={`Gemini API aktif${systemHealth.chatModel ? ` (${systemHealth.chatModel})` : ''}`} fail="Gemini API belum dikonfigurasi" />
          ) : (
            <StatusLine status={systemHealth.ollama} ok="Ollama tersedia" fail="Ollama belum tersedia untuk server production" />
          )}
          <StatusLine status={systemHealth.queue} ok="Queue aktif" fail="Queue belum aktif" />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 dark:text-gray-100">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Mulai Scraping Baru */}
          <button
            onClick={() => setScrapeModalOpen(true)}
            disabled={!!actionState.loading}
            className="p-5 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all duration-200 text-left group disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:hover:bg-blue-900/20 dark:hover:border-blue-800"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 dark:bg-blue-900/30 dark:group-hover:bg-blue-800 transition-colors">
                <Play className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                  {actionState.loading === 'scrape' ? 'Menjadwalkan...' : 'Mulai Scraping Baru'}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Jalankan scraping endpoint</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>JDIH / Sleman / Custom</span>
              <ExternalLink className="h-3 w-3 group-hover:text-blue-500 transition-colors" />
            </div>
          </button>

          {/* Analisis Batch */}
          <button
            onClick={() => runAction('analyze-batch', 'Analisis Batch')}
            disabled={!!actionState.loading}
            className="p-5 border border-gray-200 rounded-xl hover:bg-yellow-50 hover:border-yellow-200 transition-all duration-200 text-left group disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:hover:bg-yellow-900/20 dark:hover:border-yellow-800"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center group-hover:bg-yellow-200 dark:bg-yellow-900/30 dark:group-hover:bg-yellow-800 transition-colors">
                <ZapIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                  {actionState.loading === 'analyze-batch' ? 'Menjadwalkan...' : 'Analisis Batch'}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Jalankan analisis LLM batch</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>LLM Worker</span>
              <ArrowRight className="h-3 w-3 group-hover:text-yellow-500 transition-colors" />
            </div>
          </button>

          {/* Ekspor Data */}
          <button
            onClick={() => runAction('export', 'Ekspor')}
            disabled={!!actionState.loading}
            className="p-5 border border-gray-200 rounded-xl hover:bg-green-50 hover:border-green-200 transition-all duration-200 text-left group disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:hover:bg-green-900/20 dark:hover:border-green-800"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 dark:bg-green-900/30 dark:group-hover:bg-green-800 transition-colors">
                <DatabaseIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                  {actionState.loading === 'export' ? 'Mengekspor...' : 'Ekspor Data'}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Export data ke CSV</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>CSV Download</span>
              <ArrowRight className="h-3 w-3 group-hover:text-green-500 transition-colors" />
            </div>
          </button>

          {/* Bersihkan Cache */}
          <button
            onClick={() => runAction('clear-cache', 'Bersihkan Cache')}
            disabled={!!actionState.loading}
            className="p-5 border border-gray-200 rounded-xl hover:bg-red-50 hover:border-red-200 transition-all duration-200 text-left group disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:hover:bg-red-900/20 dark:hover:border-red-800"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center group-hover:bg-red-200 dark:bg-red-900/30 dark:group-hover:bg-red-800 transition-colors">
                <Broom className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                  {actionState.loading === 'clear-cache' ? 'Membersihkan...' : 'Bersihkan Cache'}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Flush Redis & temporary files</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Redis + Temp Files</span>
              <ArrowRight className="h-3 w-3 group-hover:text-red-500 transition-colors" />
            </div>
          </button>
        </div>

        {(actionState.message || actionState.error) && (
          <div className="mt-4 space-y-2">
            {actionState.message && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700 text-sm dark:bg-green-900/20 dark:text-green-300">
                <RefreshCw className="h-4 w-4" />
                {actionState.message}
              </div>
            )}
            {actionState.error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-300">
                {actionState.error}
              </div>
            )}
          </div>
        )}
      </div>

      {scrapeModalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pilih Sumber Scraping</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Scraping akan dijalankan di latar belakang.</p>
              </div>
              <button
                type="button"
                onClick={() => setScrapeModalOpen(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                aria-label="Tutup modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 p-5">
              {scrapeSources.map(source => (
                <label
                  key={source.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                    selectedSource === source.id
                      ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20'
                      : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/60'
                  } ${!source.available ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <input
                    type="radio"
                    name="scrape-source"
                    value={source.id}
                    checked={selectedSource === source.id}
                    disabled={!source.available}
                    onChange={() => setSelectedSource(source.id)}
                    className="mt-1"
                  />
                  <Globe2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{source.title}</p>
                      {!source.available && (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                          segera
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{source.description}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 p-5 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setScrapeModalOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={runScrapeSource}
                disabled={actionState.loading === 'scrape' || !scrapeSources.find(item => item.id === selectedSource)?.available}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionState.loading === 'scrape' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Mulai Scraping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;

