import React, { useState, useEffect } from 'react';
import { Search, Filter, FileText, AlertTriangle } from 'lucide-react';
import { useRuleStore } from '../store/rules';
import { RuleCard } from '../components/rules';

const RuleSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    regime: '',
    category: 'all',
    number: '',
    year: ''
  });
  const [searched, setSearched] = useState(false);
  
  const { searchRules, searchResults, regimes, categories, fetchRegimes, fetchCategories, loading } = useRuleStore();
  
  useEffect(() => {
    fetchRegimes();
    fetchCategories();
  }, [fetchRegimes, fetchCategories]);
  
  const hasActiveSearch = searchTerm.trim().length >= 2 ||
    selectedFilters.regime.trim() ||
    selectedFilters.number.trim() ||
    selectedFilters.year.trim() ||
    selectedFilters.category !== 'all';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (hasActiveSearch) {
      setSearched(true);
      searchRules(searchTerm.trim(), {
        ...selectedFilters,
        regime: selectedFilters.regime.trim(),
        number: selectedFilters.number.trim(),
        year: selectedFilters.year.trim()
      });
    }
  };

  const updateFilter = (key, value) => {
    setSelectedFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedFilters({ regime: '', category: 'all', number: '', year: '' });
    setSearched(false);
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 dark:bg-gray-800">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr_0.7fr_0.7fr_auto]">
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Kata kunci</span>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Judul, isi, atau kode peraturan"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Era / rezim</span>
              <input
                list="search-regime-options"
                type="text"
                placeholder="Ketik era/rezim"
                value={selectedFilters.regime}
                onChange={(e) => updateFilter('regime', e.target.value)}
                className="mt-1 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
              <datalist id="search-regime-options">
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
                value={selectedFilters.number}
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
                value={selectedFilters.year}
                onChange={(e) => updateFilter('year', e.target.value)}
                className="mt-1 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </label>

            <button
              type="submit"
              disabled={!hasActiveSearch || loading}
              className="inline-flex items-center justify-center gap-2 self-end px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <Search className="h-4 w-4" />
              {loading ? 'Mencari...' : 'Cari'}
            </button>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <select
              value={selectedFilters.category}
              onChange={(e) => updateFilter('category', e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            >
              <option value="all">Semua Kategori</option>
              {categories?.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

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
      </div>
      
      {searched && (
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
