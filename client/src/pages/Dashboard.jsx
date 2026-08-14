import React, { useState, useEffect } from 'react';
import { LineChart, BarChart, PieChart } from '../components/charts';
import { RuleCard } from '../components/rules';
import { useRuleStore } from '../store/rules';
import { TrendingUp, Users, FileText, AlertTriangle } from 'lucide-react';

const Dashboard = () => {
  const { rules, stats, fetchDashboardData } = useRuleStore();
  const [selectedRegime, setSelectedRegime] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  
  useEffect(() => {
    fetchDashboardData(selectedRegime, timeRange);
  }, [selectedRegime, timeRange]);
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Rules" value={stats.total_rules} icon={FileText} />
        <StatCard title="Latest Regime" value={stats.latest_regime} icon={TrendingUp} />
        <StatCard title="Critical Loopholes" value={stats.critical_loopholes} icon={AlertTriangle} />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LineChart data={stats.regime_timeline} title="Peraturan per Era" />
        <PieChart data={stats.category_distribution} title="Distribusi Kategori" />
      </div>
      
      <div className="bg-white rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Peraturan Terbaru</h3>
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
  <div className="bg-white rounded-lg p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
      <Icon className="h-8 w-8 text-blue-600" />
    </div>
  </div>
);

export default Dashboard;