import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, BarChart, PieChart } from '../components/charts';
import { RuleCard } from '../components/rules';
import { LoadingScreen } from '../components/layout';
import { useRuleStore } from '../store/rules';
import { TrendingUp, Users, FileText, AlertTriangle, ArrowRight } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { rules, stats, fetchDashboardData } = useRuleStore();
  const [selectedRegime, setSelectedRegime] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    Promise.resolve(fetchDashboardData(selectedRegime, timeRange)).finally(() => {
      if (!cancelled) setInitialLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedRegime, timeRange, fetchDashboardData]);

  if (initialLoading && !stats.total_rules) {
    return <LoadingScreen label="Menyiapkan dashboard..." />;
  }
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Rules" value={stats.total_rules} icon={FileText} />
        <StatCard title="Latest Regime" value={stats.latest_regime} icon={TrendingUp} />
        <StatCard title="Critical Loopholes" value={stats.critical_loopholes} icon={AlertTriangle} />
      </div>
      
      <LineChart data={stats.regime_timeline} title="Peraturan per Era" />
      <PieChart data={stats.category_distribution} title="Distribusi Kategori" />
      
      <div className="bg-white rounded-xl shadow-md p-6 dark:bg-gray-800">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold dark:text-gray-100">Peraturan Terbaru</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{rules.length} peraturan terbaru</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/rules')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors dark:text-blue-400 dark:hover:bg-gray-700"
          >
            Lihat Semua
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rules.map(rule => (
            <RuleCard key={rule.rule_code} rule={rule} />
          ))}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon }) => (
  <div className="bg-white rounded-lg p-6 dark:bg-gray-800">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-bold dark:text-gray-100">{value}</p>
      </div>
      <Icon className="h-8 w-8 text-blue-600" />
    </div>
  </div>
);

export default Dashboard;