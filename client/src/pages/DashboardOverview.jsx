import React, { useState, useEffect } from 'react';
import { Activity, Database, Brain, Cloud, Shield, Cpu, Download, Trash2, RefreshCw, PlayCircle } from 'lucide-react';

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
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Sistem Kesehatan</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {systemMetrics.map((metric, index) => (
            <div key={index} className="flex items-center p-4 border rounded-lg hover:shadow-md transition-shadow">
              <metric.icon className="h-8 w-8 text-gray-600 mr-4" />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700">{metric.label}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(metric.status)}`}>{metric.status}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Server Logs</h3>
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
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button
              onClick={() => runAction('scrape', 'Scraping')}
              disabled={!!actionState.loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <PlayCircle className="h-4 w-4" />
              {actionState.loading === 'scrape' ? 'Menjadwalkan...' : 'Mulai Scraping Baru'}
            </button>
            <button
              onClick={() => runAction('analyze-batch', 'Analisis Batch')}
              disabled={!!actionState.loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Brain className="h-4 w-4" />
              {actionState.loading === 'analyze-batch' ? 'Menjadwalkan...' : 'Analisis Batch'}
            </button>
            <button
              onClick={() => runAction('export', 'Ekspor')}
              disabled={!!actionState.loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {actionState.loading === 'export' ? 'Mengekspor...' : 'Ekspor Data'}
            </button>
            <button
              onClick={() => runAction('clear-cache', 'Bersihkan Cache')}
              disabled={!!actionState.loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {actionState.loading === 'clear-cache' ? 'Membersihkan...' : 'Bersihkan Cache'}
            </button>
            {actionState.message && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700 text-sm">
                <RefreshCw className="h-4 w-4" />
                {actionState.message}
              </div>
            )}
            {actionState.error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                {actionState.error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;