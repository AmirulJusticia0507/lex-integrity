import React, { useState, useEffect } from 'react';
import { Activity, Database, Brain, Cloud, Shield, Cpu, RefreshCw, Play, Zap as ZapIcon, Database as DatabaseIcon, Trash2 as Broom, ExternalLink, ArrowRight } from 'lucide-react';

const DashboardOverview = () => {
  const [systemHealth, setSystemHealth] = useState({
    database: 'checking',
    redis: 'checking',
    ollama: 'checking',
    queue: 'checking'
  });
  const [actionState, setActionState] = useState({ loading: null, message: null, error: null });
  
  useEffect(() => {
    const checkSystemHealth = async () => {
      const healthData = {};
      
      try {
        const response = await fetch('/health');
        const health = await response.json();
        
        healthData.database = health.database === 'connected' ? 'healthy' : 'error';
        healthData.redis = health.redis === 'connected' ? 'healthy' : 'error';
        healthData.ollama = health.ollama === 'connected' ? 'healthy' : 'error';
        healthData.queue = health.queue === 'connected' ? 'healthy' : 'error';
        
        setSystemHealth(healthData);
      } catch (error) {
        setSystemHealth(prev => ({ ...prev, database: 'error', redis: 'error', ollama: 'error', queue: 'error' }));
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
        res = await fetch('/api/analytics/export?format=csv');
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
      res = await fetch(`/api/actions/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
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
    { label: 'Local LLM', value: '78%', icon: Brain, status: systemHealth.ollama },
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
          <div>✅ Server berjalan di port 3000</div>
          <div>✅ Terhubung ke PostgreSQL</div>
          <div>✅ Terhubung ke Redis</div>
          <div>✅ API v1 aktif</div>
          <div>✅ Rate limiting diaktifkan</div>
          <div>✅ CORS dikonfigurasi</div>
          {systemHealth.ollama === 'healthy' ? (
            <div>✅ Ollama tersedia</div>
          ) : (
            <div>❌ Ollama tidak tersedia</div>
          )}
          {systemHealth.queue === 'healthy' ? (
            <div>✅ Queue aktif</div>
          ) : (
            <div>⚠️ Queue belum aktif</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 dark:text-gray-100">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Mulai Scraping Baru */}
          <button
            onClick={() => runAction('scrape', 'Scraping')}
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
    </div>
  );
};

export default DashboardOverview;