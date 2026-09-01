import React, { useState, useEffect } from 'react';
import { BarChart, LineChart, PieChart } from '../components/charts';
import { useAnalyticsStore } from '../store/analytics';
import { TrendingUp, Users, FileText, AlertTriangle, BarChart2, ArrowUpRight } from 'lucide-react';

const RANGES = [
  { value: '7d',  label: '7 Hari' },
  { value: '30d', label: '30 Hari' },
  { value: '90d', label: '90 Hari' },
  { value: '1y',  label: '1 Tahun' },
];

const StatCard = ({ title, value, icon: Icon, color, accent }) => (
  <div className={`relative overflow-hidden rounded-xl p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow`}>
    <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-[4rem] ${accent} opacity-10`} />
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</p>
        <p className="mt-1.5 text-2xl font-bold text-gray-800 dark:text-gray-100">{value ?? '—'}</p>
      </div>
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
    </div>
    <div className="mt-3 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
      <ArrowUpRight className="h-3 w-3" />
      <span>Live data</span>
    </div>
  </div>
);

/* Wrapper dengan isolation agar Recharts tidak tembus z-index lain */
const ChartBox = ({ children }) => (
  <div style={{ isolation: 'isolate', minWidth: 0, overflow: 'hidden' }}>
    {children}
  </div>
);

const Analytics = () => {
  const [timeRange, setTimeRange] = useState('30d');
  const { stats, fetchAnalytics } = useAnalyticsStore();

  useEffect(() => {
    fetchAnalytics(timeRange);
  }, [timeRange]);

  const statsCards = [
    { title: 'Total Views',       value: stats.total_views,       icon: Users,         color: 'bg-blue-500',    accent: 'bg-blue-500' },
    { title: 'Rules Analyzed',    value: stats.rules_analyzed,    icon: FileText,      color: 'bg-indigo-500',  accent: 'bg-indigo-500' },
    { title: 'Critical Findings', value: stats.critical_findings, icon: AlertTriangle, color: 'bg-rose-500',    accent: 'bg-rose-500' },
    { title: 'Engagement Rate',   value: stats.engagement_rate,   icon: TrendingUp,    color: 'bg-emerald-500', accent: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-6" style={{ isolation: 'isolate' }}>

      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
            <BarChart2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Dashboard Analytics</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Statistik &amp; tren peraturan</p>
          </div>
        </div>

        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 self-start sm:self-auto">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setTimeRange(r.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                timeRange === r.value
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Baris 1: 4 Stat cards ─────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card, i) => (
          <StatCard key={i} {...card} />
        ))}
      </div>

      {/* ── Baris 2: 2 chart berdampingan ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ minWidth: 0 }}>
        <ChartBox>
          <LineChart
            data={stats.analysis_trends}
            title="Analysis Trends"
            height={260}
            description="Tren jumlah peraturan yang berhasil dianalisis dari waktu ke waktu. Lonjakan menunjukkan periode aktif pembuatan atau pembaruan regulasi."
          />
        </ChartBox>
        <ChartBox>
          <BarChart
            data={stats.view_trends}
            title="View Trends"
            height={260}
            description="Volume akses peraturan per tahun terbit. Batang tinggi mengindikasikan regulasi dari era tersebut paling banyak diakses dan dipelajari pengguna."
          />
        </ChartBox>
      </div>

      {/* ── Baris 3: 2 chart berdampingan ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ minWidth: 0 }}>
        <ChartBox>
          <PieChart
            data={stats.category_breakdown}
            title="Category Breakdown"
            height={260}
            description="Distribusi peraturan berdasarkan kategori hukum. Proporsi terbesar menunjukkan bidang regulasi yang paling banyak diterbitkan dalam rentang waktu yang dipilih."
          />
        </ChartBox>
        <ChartBox>
          <LineChart
            data={stats.regime_evolution}
            title="Regime Evolution"
            height={260}
            description="Evolusi jumlah peraturan antar rezim pemerintahan. Perbandingan ini mencerminkan perubahan prioritas legislasi dan produktivitas regulasi setiap era."
          />
        </ChartBox>
      </div>

    </div>
  );
};

export default Analytics;