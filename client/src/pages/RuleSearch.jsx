import React, { useState } from 'react';
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
  
  const { searchRules, searchResults, regimes, categories, fetchRegimes, fetchCategories } = useRuleStore();
  
  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchRules(searchTerm);
    }
  }, [searchTerm, selectedFilters]);
  
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      searchRules(searchTerm);
    }
  };
  
  const getFilteredResults = () => {
    return searchResults.filter(rule => {
      const matchesRegime = selectedFilters.regime === 'all' || rule.regime === selectedFilters.regime;
      const matchesCategory = selectedFilters.category === 'all' || rule.category === selectedFilters.category;
      return matchesRegime && matchesCategory;
    });
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari peraturan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={selectedFilters.regime}
              onChange={(e) => setSelectedFilters(prev => ({ ...prev, regime: e.target.value }))}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Semua Era</option>
              {regimes?.map(regime => (
                <option key={regime} value={regime}>{regime}</option>
              ))}
            </select>
            
            <select
              value={selectedFilters.category}
              onChange={(e) => setSelectedFilters(prev => ({ ...prev, category: e.target.value }))}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
      
      {searchTerm && (
        <div className="bg-white rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              Hasil Pencarian ({getFilteredResults().length} peraturan ditemukan)
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getFilteredResults().map(rule => (
              <div key={rule.rule_code} className="relative">
                <RuleCard rule={rule} />
                {rule.loopholes.length > 0 && (
                  <div className="absolute top-2 right-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {getFilteredResults().length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Tidak ada peraturan yang ditemukan
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RuleSearch;