import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { RuleProvider } from './store/rules';
import { AnalyticsProvider } from './store/analytics';
import { Toaster } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import RuleExplorer from './pages/RuleExplorer';
import LegalMatrix from './pages/LegalMatrix';
import RuleSearch from './pages/RuleSearch';
import RuleDetail from './pages/RuleDetail';
import RuleHierarchy from './pages/RuleHierarchy';
import Analytics from './pages/Analytics';
import DashboardOverview from './pages/DashboardOverview';
import DataManagement from './pages/DataManagement';
import ChatPage from './pages/ChatPage';
import ComplianceAnalysis from './pages/ComplianceAnalysis';
import About from './pages/About';
import PrivacyPolicy from './pages/PrivacyPolicy';
import LoginPage from './pages/LoginPage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { Sidebar, PageWrapper } from './components/layout';
import { AuthProvider, RequireAuth } from './components/auth/AuthContext';
import './utils/http';
import './index.css';

const STANDALONE_PATHS = ['/login', '/forgot-password', '/reset-password', '/privacy'];

function AnimatedRoutes() {
  const location = useLocation();
  const isStandalone = STANDALONE_PATHS.includes(location.pathname);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lex_sidebar_collapsed') === 'true';
    }
    return false;
  });

  useEffect(() => {
    const handler = (e) => setSidebarCollapsed(e.detail?.collapsed ?? false);
    document.addEventListener('sidebar-collapse', handler);
    return () => document.removeEventListener('sidebar-collapse', handler);
  }, []);

  const mainMargin = sidebarCollapsed ? 'ml-16' : 'ml-64';
  const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-64';

  if (isStandalone) {
    return (
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
        </Routes>
      </AnimatePresence>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <main className={`${mainMargin} p-8 transition-all duration-300`}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/"
              element={
                <PageWrapper>
                  <RequireAuth>
                    <Dashboard />
                  </RequireAuth>
                </PageWrapper>
              }
            />
            <Route
              path="/rules"
              element={
                <PageWrapper>
                  <RequireAuth>
                    <RuleExplorer />
                  </RequireAuth>
                </PageWrapper>
              }
            />
            <Route
              path="/rules/:rule_code"
              element={
                <PageWrapper>
                  <RequireAuth>
                    <RuleDetail />
                  </RequireAuth>
                </PageWrapper>
              }
            />
            <Route
              path="/rules/:rule_code/hierarchy"
              element={
                <PageWrapper>
                  <RequireAuth>
                    <RuleHierarchy />
                  </RequireAuth>
                </PageWrapper>
              }
            />
            <Route
              path="/rules/search"
              element={
                <PageWrapper>
                  <RequireAuth>
                    <RuleSearch />
                  </RequireAuth>
                </PageWrapper>
              }
            />
            <Route
              path="/matrix"
              element={
                <PageWrapper>
                  <RequireAuth>
                    <LegalMatrix />
                  </RequireAuth>
                </PageWrapper>
              }
            />
            <Route
              path="/analytics"
              element={
                <PageWrapper>
                  <RequireAuth>
                    <Analytics />
                  </RequireAuth>
                </PageWrapper>
              }
            />
            <Route
              path="/dashboard"
              element={
                <PageWrapper>
                  <RequireAuth>
                    <DashboardOverview />
                  </RequireAuth>
                </PageWrapper>
              }
            />
            <Route
              path="/data"
              element={
                <PageWrapper>
                  <RequireAuth>
                    <DataManagement />
                  </RequireAuth>
                </PageWrapper>
              }
            />
            <Route
              path="/chat"
              element={
                <PageWrapper>
                  <RequireAuth>
                    <ChatPage />
                  </RequireAuth>
                </PageWrapper>
              }
            />
            <Route
              path="/compliance"
              element={
                <PageWrapper>
                  <RequireAuth>
                    <ComplianceAnalysis />
                  </RequireAuth>
                </PageWrapper>
              }
            />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </AnimatePresence>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <RuleProvider>
        <AnalyticsProvider>
          <AuthProvider>
            <AnimatedRoutes />
            <Toaster position="top-right" />
          </AuthProvider>
        </AnalyticsProvider>
      </RuleProvider>
    </Router>
  );
}

export default App;