// Root application component
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import { apiConfig } from './config';
import { motion, AnimatePresence } from 'framer-motion';

// Components
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import SearchPage from './pages/SearchPage';
import GraphPage from './pages/GraphPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AdminPanel from './pages/AdminPanel';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';

// Setup axios interceptor
axios.defaults.baseURL = apiConfig.baseURL;

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check API health on app load
    const checkHealth = async () => {
      try {
        const response = await axios.get(apiConfig.endpoints.health);
        if (response.data.status === 'ok') {
          setIsLoading(false);
        } else {
          setError('API tidak sehat');
        }
      } catch (err) {
        setError('Gagal terhubung ke API');
        console.error('Health check error:', err);
      }
    };

    checkHealth();
  }, []);

  if (isLoading) {
    return <LoadingSpinner message="Memulai Lex-Integrity..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="bg-slate-800 p-8 rounded-lg shadow-xl text-center max-w-md">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Error</h2>
          <p className="text-slate-300 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-sky-500 hover:bg-sky-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-slate-900 text-slate-50 font-inter">
          <Navigation />
          
          <main className="pt-16">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/graph" element={<GraphPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/admin" element={<AdminPanel />} />
              </Routes>
            </AnimatePresence>
          </main>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;