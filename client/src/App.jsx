import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
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
import About from './pages/About';
import LoginPage from './pages/LoginPage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { Sidebar } from './components/layout';
import './index.css';

const AUTH_PATHS = ['/login', '/forgot-password', '/reset-password'];

function Layout() {
  const location = useLocation();
  const isAuth = AUTH_PATHS.includes(location.pathname);

  if (isAuth) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <RuleProvider>
        <AnalyticsProvider>
          <Layout />
          <Toaster position="top-right" />
        </AnalyticsProvider>
      </RuleProvider>
    </Router>
  );
}

export default App;