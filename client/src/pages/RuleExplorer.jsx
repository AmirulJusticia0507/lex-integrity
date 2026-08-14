import React, { useState, useEffect } from 'react';
import { Search, Filter, TreePine, AlertTriangle } from 'lucide-react';
import { useRuleStore } from '../store/rules';
import { RuleGraph } from '../components/graphs';
import { RuleCard } from '../components/rules';

const RuleExplorer = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    regime: 'all',
    category: 'all',
    has_loopholes: false
  });
  const [showGraph, setShowGraph] = useState(false);
  
  const { rules, fetchRules, fetchRegimes, fetchCategories, regimes, categories } = useRuleStore();
  
  useEffect(() => {
    fetchRegimes();
    fetchCategories();
  }, [fetchRegimes, fetchCategories]);
  
  useEffect(() => {
    fetchRules({
      search: searchTerm,
      regime: selectedFilters.regime === 'all' ? undefined : selectedFilters.regime,
      category: selectedFilters.category === 'all' ? undefined : selectedFilters.category,
      is_active: true
    });
  }, [searchTerm, selectedFilters, fetchRules]);
  
  const filteredRules = rules.filter(rule => {
    const matchesLoopholes = !selectedFilters.has_loopholes || rule.loopholes.length > 0;
    return matchesLoopholes;
  });
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari peraturan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
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
          
          <label className="flex items-center px-4 py-2 border rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={selectedFilters.has_loopholes}
              onChange={(e) => setSelectedFilters(prev => ({ ...prev, has_loopholes: e.target.checked }))}
              className="mr-2"
            />
            <span className="text-sm">Hanya yang memiliki celah</span>
          </label>
        </div>
        
        <button
          onClick={() => setShowGraph(!showGraph)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <TreePine className="h-4 w-4" />
          {showGraph ? 'Sembunyikan Grafik' : 'Tampilkan Grafik'}
        </button>
      </div>
      
      {showGraph && (
        <div className="bg-white rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Graf Relasi Peraturan</h3>
          <RuleGraph rules={filteredRules} />
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRules.map(rule => (
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
    </div>
  );
};

export default RuleExplorer;