import React, { useState, useEffect } from 'react';
import { Search, Filter, TreePine, AlertTriangle } from 'lucide-react';
import { useRuleStore } from '../store/rules';
import { RuleGraph } from '../components/graphs';
import { RuleCard } from '../components/rules';

const RuleExplorer = () => {
  const [filters, setFilters] = useState({
    search: '',
    regime: '',
    number: '',
    year: '',
    category: 'all',
    has_loopholes: false
  });
  const [showGraph, setShowGraph] = useState(false);
  
  const { rules, fetchRules, fetchRegimes, fetchCategories, regimes, categories, loading } = useRuleStore();
  
  useEffect(() => {
    fetchRegimes();
    fetchCategories();
  }, [fetchRegimes, fetchCategories]);
  
  const runSearch = React.useCallback(() => {
    fetchRules({
      search: filters.search.trim(),
      regime: filters.regime.trim() || undefined,
      number: filters.number.trim(),
      year: filters.year.trim(),
      category: filters.category === 'all' ? undefined : filters.category,
      is_active: true
    });
  }, [filters, fetchRules]);

  useEffect(() => {
    fetchRules({ is_active: true });
  }, [fetchRules]);

  const handleSubmit = (e) => {
    e.preventDefault();
    runSearch();
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    const next = { search: '', regime: '', number: '', year: '', category: 'all', has_loopholes: false };
    setFilters(next);
    fetchRules({ is_active: true });
  };
  
  const filteredRules = rules.filter(rule => {
    const matchesLoopholes = !filters.has_loopholes || rule.loopholes.length > 0;
    return matchesLoopholes;
  });
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 dark:bg-gray-800">
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr_0.7fr_0.7fr_auto]">
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Kata kunci</span>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Judul, isi, atau kode peraturan"
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  className="pl-10 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Era / rezim</span>
              <input
                list="regime-options"
                type="text"
                placeholder="Contoh: Reformasi"
                value={filters.regime}
                onChange={(e) => updateFilter('regime', e.target.value)}
                className="mt-1 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
              <datalist id="regime-options">
                {regimes?.map(regime => (
                  <option key={regime} value={regime} />
                ))}
              </datalist>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Nomor</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="17"
                value={filters.number}
                onChange={(e) => updateFilter('number', e.target.value)}
                className="mt-1 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Tahun</span>
              <input
                type="number"
                min="1800"
                max="2100"
                placeholder="2024"
                value={filters.year}
                onChange={(e) => updateFilter('year', e.target.value)}
                className="mt-1 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 self-end px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <Search className="h-4 w-4" />
              {loading ? 'Mencari...' : 'Cari'}
            </button>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <select
                value={filters.category}
                onChange={(e) => updateFilter('category', e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              >
                <option value="all">Semua Kategori</option>
                {categories?.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>

              <label className="flex items-center px-4 py-2 border rounded-lg cursor-pointer dark:border-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={filters.has_loopholes}
                  onChange={(e) => updateFilter('has_loopholes', e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm">Hanya yang memiliki celah</span>
              </label>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <Filter className="h-4 w-4" />
              Reset Filter
            </button>
          </div>
        </form>
        
        <button
          onClick={() => setShowGraph(!showGraph)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <TreePine className="h-4 w-4" />
          {showGraph ? 'Sembunyikan Grafik' : 'Tampilkan Grafik'}
        </button>
      </div>
      
      {showGraph && (
        <div className="bg-white rounded-lg p-6 dark:bg-gray-800">
          <h3 className="text-lg font-semibold mb-4 dark:text-gray-100">Graf Relasi Peraturan</h3>
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
