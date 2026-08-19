import React, { useState, useEffect } from 'react';
import { BarChart, LineChart, PieChart } from '../components/charts';
import { useAnalyticsStore } from '../store/analytics';
import { TrendingUp, Users, FileText, AlertTriangle } from 'lucide-react';

const Analytics = () => {
  const [timeRange, setTimeRange] = useState('30d');
  const { stats, fetchAnalytics } = useAnalyticsStore();
  
  useEffect(() => {
    fetchAnalytics(timeRange);
  }, [timeRange]);
  
  const statsCards = [
    { title: 'Total Views', value: stats.total_views, icon: Users },
    { title: 'Rules Analyzed', value: stats.rules_analyzed, icon: FileText },
    { title: 'Critical Findings', value: stats.critical_findings, icon: AlertTriangle },
    { title: 'Engagement Rate', value: stats.engagement_rate, icon: TrendingUp }
  ];
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold dark:text-gray-100">Dashboard Analytics</h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
          <option value="1y">Last Year</option>
        </select>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card, index) => (
          <div key={index} className="bg-white rounded-lg p-6 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{card.title}</p>
                <p className="text-2xl font-bold dark:text-gray-100">{card.value}</p>
              </div>
              <card.icon className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChart data={stats.view_trends} title="View Trends" />
        <LineChart data={stats.analysis_trends} title="Analysis Trends" />
        <PieChart data={stats.category_breakdown} title="Category Breakdown" />
        <LineChart data={stats.regime_evolution} title="Regime Evolution" />
      </div>
    </div>
  );
};

export default Analytics;