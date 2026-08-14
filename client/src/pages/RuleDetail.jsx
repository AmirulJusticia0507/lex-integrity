import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { FileText, AlertTriangle, ArrowLeft, RefreshCw, Search, Scale } from 'lucide-react';
import { useRuleStore } from '../store/rules';

const RuleDetail = () => {
  const { rule_code } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoAnalyze = searchParams.get('analysis') === '1';
  const { fetchRuleByCode, fetchRuleConflicts, analyzeRule } = useRuleStore();
  const [rule, setRule] = useState(null);
  const [conflicts, setConflicts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchRuleByCode(rule_code);
        setRule(data);
      } catch (e) {
        setError(e.message || 'Gagal memuat peraturan');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [rule_code, fetchRuleByCode]);

  useEffect(() => {
    if (autoAnalyze && rule && !conflicts && !analyzing) {
      handleAnalyze();
    }
  }, [autoAnalyze, rule]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      await analyzeRule(rule_code);
      const data = await fetchRuleConflicts(rule_code);
      setConflicts(data);
    } catch (e) {
      setError(e.message || 'Gagal analisis kontradiksi');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleLoadConflicts = async () => {
    setError(null);
    try {
      const data = await fetchRuleConflicts(rule_code);
      setConflicts(data);
    } catch (e) {
      setError(e.message || 'Gagal memuat kontradiksi');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20 text-gray-500">Memuat peraturan...</div>;
  }

  if (error && !rule) {
    return (
      <div className="bg-white rounded-lg p-10 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => navigate('/rules')}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          Kembali ke Explorer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/rules')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Explorer
      </button>

      <div className="bg-white rounded-lg p-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">{rule.category}</span>
          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">{rule.regime}</span>
          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{rule.rule_code}</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">{rule.title}</h1>

        <p className="text-gray-700 whitespace-pre-wrap mb-6">{rule.content}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rule.loopholes && rule.loopholes.length > 0 && (
            <div className="border rounded-lg p-4">
              <h3 className="flex items-center gap-2 font-semibold text-gray-800 mb-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Loopholes / Pasal Karet
              </h3>
              <ul className="space-y-2">
                {rule.loopholes.map((item, i) => (
                  <li key={i} className="text-sm text-yellow-700 flex items-start">
                    <span className="mr-2">•</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rule.impacts && rule.impacts.length > 0 && (
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-3">Dampak</h3>
              <ul className="space-y-2">
                {rule.impacts.map((item, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start">
                    <span className="mr-2">•</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {rule.sanctions && (rule.sanctions.administrative || rule.sanctions.criminal) && (
          <div className="border rounded-lg p-4 mt-6">
            <h3 className="font-semibold text-gray-800 mb-3">Sanksi</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {rule.sanctions.administrative && (
                <div>
                  <span className="text-gray-500">Administratif:</span>
                  <span className="ml-2 text-gray-800">{rule.sanctions.administrative}</span>
                </div>
              )}
              {rule.sanctions.criminal && (
                <div>
                  <span className="text-gray-500">Pidana:</span>
                  <span className="ml-2 text-gray-800">{rule.sanctions.criminal}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mt-6">
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {analyzing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
            {analyzing ? 'Menganalisis...' : 'Analisis Kontradiksi'}
          </button>
          <button
            onClick={handleLoadConflicts}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Search className="h-4 w-4" />
            Muat Kontradiksi
          </button>
        </div>

        {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
      </div>

      {conflicts && (
        <div className="bg-white rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Hasil Analisis Kontradiksi</h3>

          <div className="mb-4">
            <p className="text-sm text-gray-500">Peraturan sumber:</p>
            <p className="font-medium text-gray-800">
              {conflicts.source_rule?.title || rule.title}
            </p>
          </div>

          <h4 className="font-medium text-gray-700 mb-3">Peraturan Serupa / Terkait</h4>
          {conflicts.similar_rules && conflicts.similar_rules.length > 0 ? (
            <ul className="space-y-2">
              {conflicts.similar_rules.map((r) => (
                <li key={r.rule_code || r.id}>
                  <Link
                    to={`/rules/${r.rule_code}`}
                    className="flex items-start gap-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <FileText className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{r.title}</p>
                      <p className="text-xs text-gray-500">
                        {r.rule_code} • {r.regime} • {r.category}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">
              Tidak ada peraturan serupa yang ditemukan.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default RuleDetail;