import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, AlertTriangle, TrendingUp, Users, BarChart2, Brain } from 'lucide-react';
import { useRuleStore } from '../../store/rules';

const RuleCard = ({ rule }) => {
  const navigate = useNavigate();
  const { analyzeRule, clearError } = useRuleStore();
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      await analyzeRule(rule.rule_code);
    } catch (error) {
      clearError();
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const getCategoryColor = (category) => {
    const colors = {
      'UU': 'bg-blue-100 text-blue-800',
      'PP': 'bg-green-100 text-green-800',
      'Perpres': 'bg-purple-100 text-purple-800',
      'Perda': 'bg-orange-100 text-orange-800',
      'Permen': 'bg-red-100 text-red-800',
      'Lainnya': 'bg-gray-100 text-gray-800'
    };
    return colors[category] || colors['Lainnya'];
  };
  
  const getRegimeColor = (regime) => {
    const colors = {
      'Prabowo Subianto': 'bg-red-100 text-red-800',
      'Jokowi': 'bg-blue-100 text-blue-800',
      'SBY': 'bg-yellow-100 text-yellow-800',
      'Megawati': 'bg-green-100 text-green-800',
      'Reformasi': 'bg-purple-100 text-purple-800',
      'Orde Baru': 'bg-gray-100 text-gray-800',
      'Awal Kemerdekaan': 'bg-indigo-100 text-indigo-800'
    };
    return colors[regime] || 'bg-gray-100 text-gray-800';
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 p-6 dark:bg-gray-800">
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getCategoryColor(rule.category)}`}>{
            rule.category
          }</span>
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getRegimeColor(rule.regime)}`}>{
            rule.regime
          }</span>
        </div>
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
          <FileText className="h-4 w-4 mr-1" />
          <span>{rule.view_count || 0} kali dilihat</span>
        </div>
      </div>
      
      <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2 dark:text-gray-100">
        {rule.title}
      </h3>
      
      <p className="text-sm text-gray-600 mb-4 line-clamp-3 dark:text-gray-400">
        {rule.content ? rule.content.substring(0, 150) : 'Konten belum tersedia'}
      </p>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Kode:</span>
          <span className="font-mono font-medium dark:text-gray-200">{rule.rule_code}</span>
        </div>
        
        {rule.loopholes && rule.loopholes.length > 0 && (
          <div className="flex items-start">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <span className="text-sm text-gray-600">Loopholes:</span>
              <ul className="text-sm mt-1 space-y-1">
                {rule.loopholes.slice(0, 2).map((loophole, index) => (
                  <li key={index} className="text-yellow-700">• {loophole}</li>
                ))}
                {rule.loopholes.length > 2 && (
                  <li className="text-yellow-700">• +{rule.loopholes.length - 2} lainnya</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={() => navigate(`/rules/${rule.rule_code}`)}
          className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
        >
          Lihat Detail
        </button>
        <button
          onClick={() => navigate(`/rules/${rule.rule_code}?analysis=1`)}
          className="text-gray-600 hover:text-gray-800 text-sm transition-colors"
        >
          Analisis Kontradiksi
        </button>
        <button
          onClick={() => window.open(`/chat?rule_id=${rule.id}&rule_code=${encodeURIComponent(rule.rule_code)}&title=${encodeURIComponent(rule.title)}`, '_blank')}
          className="text-orange-600 hover:text-orange-800 font-medium text-sm transition-colors flex items-center gap-1"
          title="Tanya AI"
        >
          <Brain className="h-4 w-4" />
          Tanya AI
        </button>
      </div>
    </div>
  );
};

export { RuleCard };