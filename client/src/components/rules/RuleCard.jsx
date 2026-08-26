import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, AlertTriangle, Eye, BarChart2, Brain, ArrowRight } from 'lucide-react';
import { useRuleStore } from '../../store/rules';

const RuleCard = ({ rule }) => {
  const navigate = useNavigate();
  const { analyzeRule, clearError } = useRuleStore();
  const [isAnalyzing] = React.useState(false);
  
  const handleAnalyze = async () => {
    try {
      await analyzeRule(rule.rule_code);
    } catch (error) {
      clearError();
    }
  };
  
  const getCategoryStyle = (category) => {
    const styles = {
      'UU': { badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:ring-blue-800', accent: 'from-blue-500 to-indigo-500' },
      'PP': { badge: 'bg-green-50 text-green-700 ring-1 ring-green-200 dark:bg-green-900/40 dark:text-green-300 dark:ring-green-800', accent: 'from-green-500 to-emerald-500' },
      'Perpres': { badge: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:ring-purple-800', accent: 'from-purple-500 to-violet-500' },
      'Perda': { badge: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:ring-orange-800', accent: 'from-orange-500 to-amber-500' },
      'Permen': { badge: 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/40 dark:text-red-300 dark:ring-red-800', accent: 'from-red-500 to-rose-500' },
      'Lainnya': { badge: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-700/60 dark:text-gray-300 dark:ring-gray-600', accent: 'from-gray-400 to-gray-500' }
    };
    return styles[category] || styles['Lainnya'];
  };
  
  const getRegimeBadge = (regime) => {
    const badges = {
      'Prabowo Subianto': 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/40 dark:text-red-300 dark:ring-red-800',
      'Jokowi': 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:ring-sky-800',
      'SBY': 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:ring-yellow-800',
      'Megawati': 'bg-green-50 text-green-700 ring-1 ring-green-200 dark:bg-green-900/40 dark:text-green-300 dark:ring-green-800',
      'Reformasi': 'bg-purple-50 text-purple-700 ring-1 ring-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:ring-purple-800',
      'Orde Baru': 'bg-gray-100 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-700/60 dark:text-gray-300 dark:ring-gray-600',
      'Awal Kemerdekaan': 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:ring-indigo-800'
    };
    return badges[regime] || 'bg-gray-100 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-700/60 dark:text-gray-300 dark:ring-gray-600';
  };
  
  const categoryStyle = getCategoryStyle(rule.category);
  
  return (
    <div className="group relative flex flex-col h-full bg-white rounded-xl border border-gray-200/70 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${categoryStyle.accent}`} />
      
      <div className="flex flex-col flex-1 p-5">
        <div className="flex justify-between items-start gap-2 mb-3">
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${categoryStyle.badge}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
              {rule.category}
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold truncate max-w-[10rem] ${getRegimeBadge(rule.regime)}`}>
              {rule.regime}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 shrink-0 text-xs text-gray-500 dark:text-gray-400" title={`${rule.view_count || 0} kali dilihat`}>
            <Eye className="h-3.5 w-3.5" />
            {rule.view_count || 0}
          </span>
        </div>
        
        <h3 className="text-base font-semibold leading-snug text-gray-800 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors dark:text-gray-100 dark:group-hover:text-blue-400">
          {rule.title}
        </h3>
        
        <p className="text-sm text-gray-600 mb-4 line-clamp-3 leading-relaxed dark:text-gray-400">
          {rule.content ? rule.content.substring(0, 150) : 'Konten belum tersedia'}
        </p>
        
        <div className="mt-auto space-y-3">
          <div className="inline-flex items-center rounded-md bg-gray-50 border border-gray-200 px-2 py-1 dark:bg-gray-700/50 dark:border-gray-600">
            <span className="font-mono text-xs font-medium text-gray-700 dark:text-gray-200">{rule.rule_code}</span>
          </div>
          
          {rule.loopholes && rule.loopholes.length > 0 && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-2.5 dark:bg-yellow-900/20 dark:border-yellow-900/50">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                {rule.loopholes.length} Loophole terdeteksi
              </div>
              <ul className="mt-1.5 space-y-1">
                {rule.loopholes.slice(0, 2).map((loophole, index) => (
                  <li key={index} className="text-xs text-yellow-700 line-clamp-1 dark:text-yellow-300">• {loophole}</li>
                ))}
                {rule.loopholes.length > 2 && (
                  <li className="text-xs font-medium text-yellow-600 dark:text-yellow-400">+{rule.loopholes.length - 2} lainnya</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center justify-between gap-1 px-4 py-3 border-t border-gray-100 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-700/30">
        <button
          onClick={() => navigate(`/rules/${rule.rule_code}`)}
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors dark:text-blue-400 dark:hover:text-blue-300"
        >
          Detail
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
        <button
          onClick={() => navigate(`/rules/${rule.rule_code}?analysis=1`)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 text-xs font-medium transition-colors dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <BarChart2 className="h-3.5 w-3.5" />
          Analisis Kontradiksi
        </button>
        <button
          onClick={() => window.open(`/chat?rule_id=${rule.id}&rule_code=${encodeURIComponent(rule.rule_code)}&title=${encodeURIComponent(rule.title)}`, '_blank')}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1.5 text-white text-xs font-semibold shadow-sm hover:shadow-md hover:brightness-105 transition-all"
          title="Tanya AI"
        >
          <Brain className="h-3.5 w-3.5" />
          Tanya AI
        </button>
      </div>
    </div>
  );
};

export { RuleCard };