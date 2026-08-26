import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Globe, Landmark, Building2, Home, AlertTriangle, GitBranch, FileText, Info, Network, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { authFetch } from '../utils/http';
import LoadingScreen from '../components/layout/LoadingScreen';

const LEVEL_ICONS = {
  internasional: Globe,
  nasional: Landmark,
  provinsi: Building2,
  kabupaten_kota: Home
};

const LEVEL_COLORS = {
  internasional: 'from-indigo-500 to-blue-500',
  nasional: 'from-blue-500 to-cyan-500',
  provinsi: 'from-teal-500 to-emerald-500',
  kabupaten_kota: 'from-amber-500 to-orange-500'
};

const LEVEL_DESC = {
  internasional: 'Traktat, konvensi & dokumen hukum internasional (mis. UN ILC).',
  nasional: 'UU, PP, Perpres, Permen dan peraturan setingkat.',
  provinsi: 'Perda & Pergub tingkat provinsi.',
  kabupaten_kota: 'Perda Kab/Kota, Perbup & peraturan daerah tingkat bawah.'
};

const RuleHierarchy = () => {
  const { rule_code } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openLevels, setOpenLevels] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    authFetch(`/api/rules/${encodeURIComponent(rule_code)}/hierarchy`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.error || 'Gagal memuat hierarki');
        setData(json.data);
        // Default terbuka: jenjang milik peraturan sumber;
        // bila kosong, buka jenjang pertama yang berisi aturan
        const srcLevel = json.data.source_rule.level;
        const firstFilled = json.data.levels.find((l) => l.rules.length > 0)?.key;
        const target = json.data.levels.some((l) => l.key === srcLevel && l.rules.length > 0)
          ? srcLevel
          : firstFilled;
        setOpenLevels(target ? { [target]: true } : {});
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [rule_code]);

  if (loading) return <LoadingScreen label="Menganalisis hierarki peraturan..." />;

  if (error && !data) {
    return (
      <div className="bg-white rounded-xl p-10 text-center dark:bg-gray-800">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => navigate('/rules')} className="text-blue-600 hover:text-blue-800 font-medium">
          Kembali ke Explorer
        </button>
      </div>
    );
  }

  const { source_rule: source, levels, stats } = data;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(`/rules/${source.rule_code}`)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Detail Peraturan
      </button>

      {/* Kartu sumber */}
      <div className="bg-white rounded-xl shadow-md p-6 dark:bg-gray-800">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
              <Network className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-snug dark:text-gray-100">{source.title}</h1>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 ring-1 ring-gray-200 font-mono dark:bg-gray-700 dark:ring-gray-600 dark:text-gray-200">
                  {source.rule_code}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  {source.category}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  {source.level}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-3 text-center">
            <div className="rounded-lg border border-gray-200 px-4 py-2 dark:border-gray-700">
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{stats.total_related}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Terkait</p>
            </div>
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2 dark:border-yellow-900/50 dark:bg-yellow-900/20">
              <p className="text-lg font-bold text-yellow-700 dark:text-yellow-400">{stats.with_loopholes}</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-500">Berloophole</p>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-gray-500 flex items-start gap-1.5 dark:text-gray-400">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Hierarki disusun otomatis dari klasifikasi jenjang JDIH berdasarkan kategori &amp; sumber,
          lalu dipasangkan antar jenjang memakai kemiripan kata kunci judul/dokumen.
        </p>
      </div>

      {/* Accordion jenjang */}
      <div className="space-y-3">
        <div className="flex justify-end">
          <button
            onClick={() => {
              const allOpen = levels.every((l) => openLevels[l.key]);
              setOpenLevels(Object.fromEntries(levels.map((l) => [l.key, !allOpen])));
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
            {levels.every((l) => openLevels[l.key]) ? 'Tutup Semua' : 'Buka Semua'}
          </button>
        </div>

        {levels.map((level) => {
          const Icon = LEVEL_ICONS[level.key];
          const isOpen = Boolean(openLevels[level.key]);
          return (
            <div key={level.key} className="bg-white rounded-xl shadow-md overflow-hidden dark:bg-gray-800">
              {/* Header accordion */}
              <button
                onClick={() => setOpenLevels((prev) => ({ ...prev, [level.key]: !prev[level.key] }))}
                className={`w-full flex items-center justify-between gap-3 px-5 py-3 bg-gradient-to-r ${LEVEL_COLORS[level.key]} text-left`}
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-2.5 text-white">
                  <Icon className="h-5 w-5 shrink-0" />
                  <div>
                    <h2 className="font-semibold leading-tight">Jenjang {level.label}</h2>
                    <p className="text-xs opacity-90 leading-tight">{LEVEL_DESC[level.key]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-bold">
                    {level.rules.length} terkait
                  </span>
                  {level.rules.some((r) => r.loophole_count > 0) && (
                    <span title="Ada aturan berloophole di jenjang ini" className="text-yellow-200">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                  )}
                  <ChevronDown
                    className={`h-5 w-5 text-white transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              {/* Konten collapsible */}
              <div
                style={{ maxHeight: isOpen ? '1200px' : '0px' }}
                className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
              >
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {level.rules.length === 0 && (
                    <p className="px-5 py-6 text-sm text-gray-400 text-center dark:text-gray-500">
                      Tidak ditemukan peraturan sejenjang yang berkaitan.
                    </p>
                  )}
                  {level.rules.map((r) => (
                    <Link
                      key={r.rule_code}
                      to={`/rules/${r.rule_code}`}
                      className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group dark:hover:bg-gray-700/50"
                    >
                      <FileText className="h-4 w-4 text-gray-300 mt-0.5 shrink-0 group-hover:text-blue-500 transition-colors" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-600 transition-colors dark:text-gray-200 dark:group-hover:text-blue-400">
                          {r.title}
                        </p>
                        <p className="text-xs text-gray-500 truncate mt-0.5 dark:text-gray-400">
                          {r.rule_code} • {r.category} • {r.regime}
                          {r.publish_date ? ` • ${r.publish_date}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {r.loophole_count > 0 && (
                          <span
                            title={`${r.loophole_count} loophole terdeteksi`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:ring-yellow-900"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            {r.loophole_count}
                          </span>
                        )}
                        <span
                          title="Skor kemiripan kata kunci"
                          className="w-14 h-1.5 rounded-full bg-gray-100 overflow-hidden hidden sm:block dark:bg-gray-700"
                        >
                          <span
                            className="block h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600"
                            style={{ width: `${Math.min(100, r.similarity)}%` }}
                          />
                        </span>
                        <span className="text-xs text-gray-400 w-9 text-right tabular-nums">{r.similarity}%</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rantai turunan eksplisit */}
      {source.derived_rules?.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 dark:bg-gray-800">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4 dark:text-gray-100">
            <GitBranch className="h-5 w-5 text-blue-600" />
            Rantai Turunan Terdokumentasi
          </h2>
          <ul className="space-y-2">
            {source.derived_rules.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <GitBranch className="h-3.5 w-3.5 text-blue-400 mt-1 shrink-0" />
                {typeof d === 'string' ? d : JSON.stringify(d)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default RuleHierarchy;
