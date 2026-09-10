import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, FileText, GitBranch, Scale, Megaphone } from 'lucide-react';
import { authFetch } from '../utils/http';
import LoadingScreen from '../components/layout/LoadingScreen';

function list(value) {
  return Array.isArray(value) ? value : [];
}

const RuleDefects = () => {
  const { rule_code } = useParams();
  const navigate = useNavigate();
  const [rule, setRule] = useState(null);
  const [conflicts, setConflicts] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      authFetch(`/api/rules/${encodeURIComponent(rule_code)}`).then(r => r.json()),
      authFetch(`/api/rules/${encodeURIComponent(rule_code)}/conflicts`).then(r => r.json()),
    ])
      .then(([ruleJson, conflictsJson]) => {
        if (cancelled) return;
        if (!ruleJson.success) throw new Error(ruleJson.error || 'Peraturan tidak ditemukan');
        setRule(ruleJson.data);
        setConflicts(conflictsJson.success ? conflictsJson.data : null);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [rule_code]);

  if (loading) return <LoadingScreen label="Membaca cacat regulasi..." />;

  if (error || !rule) {
    return (
      <div className="bg-white rounded-xl p-10 text-center dark:bg-gray-800">
        <p className="text-red-600 mb-4">{error || 'Peraturan tidak ditemukan'}</p>
        <button onClick={() => navigate('/rules')} className="text-blue-600 hover:text-blue-800 font-medium">
          Kembali ke Rules
        </button>
      </div>
    );
  }

  const loopholes = list(rule.loopholes);
  const impacts = list(rule.impacts);
  const related = list(conflicts?.similar_rules);

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(`/rules/${rule.rule_code}`)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Detail Peraturan
      </button>

      <div className="bg-white rounded-xl shadow-md p-6 dark:bg-gray-800">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center shrink-0 dark:bg-red-900/30">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 leading-snug dark:text-gray-100">
              Titik Cacat Produk Hukum
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{rule.title}</p>
            <div className="flex flex-wrap gap-2 mt-3 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-gray-100 ring-1 ring-gray-200 font-mono dark:bg-gray-700 dark:ring-gray-600 dark:text-gray-200">
                {rule.rule_code}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {rule.category}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                {related.length} aturan pembanding
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="bg-white rounded-xl shadow-md p-5 dark:bg-gray-800">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900 mb-3 dark:text-gray-100">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Apa yang cacat?
          </h2>
          {loopholes.length > 0 ? (
            <ul className="space-y-3">
              {loopholes.map((item, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold text-yellow-700 dark:text-yellow-400">Temuan {i + 1}: </span>
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Belum ada loophole tersimpan. Jalankan analisis kontradiksi dulu agar poin cacatnya muncul.
            </p>
          )}
        </section>

        <section className="bg-white rounded-xl shadow-md p-5 dark:bg-gray-800">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900 mb-3 dark:text-gray-100">
            <Scale className="h-5 w-5 text-blue-500" />
            Dampaknya ke warga
          </h2>
          {impacts.length > 0 ? (
            <ul className="space-y-3">
              {impacts.map((item, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300">{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Dampak belum tersedia. Gunakan halaman panduan warga untuk menyusun keberatan atau permintaan informasi.
            </p>
          )}
        </section>

        <section className="bg-white rounded-xl shadow-md p-5 dark:bg-gray-800">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900 mb-3 dark:text-gray-100">
            <Megaphone className="h-5 w-5 text-orange-500" />
            Bisa melakukan apa?
          </h2>
          <div className="space-y-2">
            <Link
              to={`/rules/${rule.rule_code}/aksi-warga`}
              className="block rounded-lg border border-orange-200 px-3 py-2 text-sm text-orange-700 hover:bg-orange-50 dark:border-orange-900 dark:text-orange-300 dark:hover:bg-orange-900/20"
            >
              Buka Panduan Aksi Warga
            </Link>
            <Link
              to={`/rules/${rule.rule_code}/source`}
              className="block rounded-lg border border-teal-200 px-3 py-2 text-sm text-teal-700 hover:bg-teal-50 dark:border-teal-900 dark:text-teal-300 dark:hover:bg-teal-900/20"
            >
              Lihat dokumen sumber
            </Link>
          </div>
        </section>
      </div>

      <section className="bg-white rounded-xl shadow-md p-6 dark:bg-gray-800">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4 dark:text-gray-100">
          <GitBranch className="h-5 w-5 text-purple-600" />
          Bertentangan / berkaitan dengan aturan mana?
        </h2>
        {related.length > 0 ? (
          <div className="space-y-2">
            {related.map((item) => (
              <Link
                key={item.rule_code || item.id}
                to={`/rules/${item.rule_code}`}
                className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-700"
              >
                <FileText className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {item.rule_code} - {item.regime || '-'} - {item.category || '-'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Belum ada aturan pembanding yang ditemukan otomatis.
          </p>
        )}
      </section>
    </div>
  );
};

export default RuleDefects;
