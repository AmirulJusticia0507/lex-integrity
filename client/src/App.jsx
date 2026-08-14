import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { RuleProvider } from './store/rules';
import { AnalyticsProvider } from './store/analytics';
import { Toaster } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import RuleExplorer from './pages/RuleExplorer';
import LegalMatrix from './pages/LegalMatrix';
import RuleSearch from './pages/RuleSearch';
import RuleDetail from './pages/RuleDetail';
import Analytics from './pages/Analytics';
import DashboardOverview from './pages/DashboardOverview';
import DataManagement from './pages/DataManagement';
import ChatPage from './pages/ChatPage';
import { Sidebar } from './components/layout';
import './index.css';

function App() {
  return (
    <Router>
      <RuleProvider>
        <AnalyticsProvider>
          <div className="min-h-screen bg-gray-50">
            <Sidebar />
            <main className="ml-64 p-8">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/rules" element={<RuleExplorer />} />
                <Route path="/rules/:rule_code" element={<RuleDetail />} />
                <Route path="/rules/search" element={<RuleSearch />} />
                <Route path="/matrix" element={<LegalMatrix />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/dashboard" element={<DashboardOverview />} />
                <Route path="/data" element={<DataManagement />} />
                <Route path="/chat" element={<ChatPage />} />
              </Routes>
            </main>
          </div>
          <Toaster position="top-right" />
        </AnalyticsProvider>
      </RuleProvider>
    </Router>
  );
}

export default App;