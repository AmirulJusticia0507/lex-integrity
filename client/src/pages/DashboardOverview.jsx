import React, { useState, useEffect } from 'react';
import { Activity, Database, Brain, Cloud, Shield, Cpu } from 'lucide-react';

const DashboardOverview = () => {
  const [systemHealth, setSystemHealth] = useState({
    database: 'checking',
    redis: 'checking',
    ollama: 'checking',
    queue: 'checking'
  });
  
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
            <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Mulai Scraping Baru
            </button>
            <button className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              Analisis Batch
            </button>
            <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              Ekspor Data
            </button>
            <button className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
              Bersihkan Cache
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;