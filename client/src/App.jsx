import React from 'react';
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
import Analytics from './pages/Analytics';
import DashboardOverview from './pages/DashboardOverview';
import DataManagement from './pages/DataManagement';
import ChatPage from './pages/ChatPage';
import About from './pages/About';
import LoginPage from './pages/LoginPage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { Sidebar, PageWrapper } from './components/layout';
import { AuthProvider, RequireAuth } from './components/auth/AuthContext';
import './index.css';

const AUTH_PATHS = ['/login', '/forgot-password', '/reset-password'];

function AnimatedRoutes() {
  const location = useLocation();
  const isAuth = AUTH_PATHS.includes(location.pathname);

  if (isAuth) {
    return (
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </AnimatePresence>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <main className="ml-64 p-8">
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
