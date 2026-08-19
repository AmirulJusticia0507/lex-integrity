import React, { useState, useEffect } from 'react';
import { Search, Filter, FileText, AlertTriangle } from 'lucide-react';
import { useRuleStore } from '../store/rules';
import { RuleCard } from '../components/rules';

const RuleSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    regime: 'all',
    category: 'all',
    dateRange: { start: '', end: '' }
  });
  
  const { searchRules, searchResults, regimes, categories, fetchRegimes, fetchCategories, loading } = useRuleStore();
  
  useEffect(() => {
    fetchRegimes();
    fetchCategories();
  }, [fetchRegimes, fetchCategories]);
  
  useEffect(() => {
    const hasTerm = searchTerm.trim().length >= 2;
    const hasFilter = selectedFilters.regime !== 'all' || selectedFilters.category !== 'all';
    if (hasTerm || hasFilter) {
      searchRules(searchTerm.trim(), selectedFilters);
    }
  }, [searchTerm, selectedFilters, searchRules]);

  const hasActiveSearch = searchTerm.trim().length >= 2 ||
    selectedFilters.regime !== 'all' || selectedFilters.category !== 'all';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (hasActiveSearch) {
      searchRules(searchTerm.trim(), selectedFilters);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 dark:bg-gray-800">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari peraturan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={selectedFilters.regime}
              onChange={(e) => setSelectedFilters(prev => ({ ...prev, regime: e.target.value }))}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            >
              <option value="all">Semua Era</option>
              {regimes?.map(regime => (
                <option key={regime} value={regime}>{regime}</option>
              ))}
            </select>
            
            <select
              value={selectedFilters.category}
              onChange={(e) => setSelectedFilters(prev => ({ ...prev, category: e.target.value }))}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            >
              <option value="all">Semua Kategori</option>
              {categories?.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Cari
            </button>
          </div>
        </form>
      </div>
      
      {hasActiveSearch && (
        <div className="bg-white rounded-lg p-6 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold dark:text-gray-100">
              Hasil Pencarian ({searchResults.length} peraturan ditemukan)
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map(rule => (
              <div key={rule.rule_code} className="relative">
                <RuleCard rule={rule} />
                {rule.loopholes && rule.loopholes.length > 0 && (
                  <div className="absolute top-2 right-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {searchResults.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Tidak ada peraturan yang ditemukan
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RuleSearch;