import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, FileSearch, Megaphone, Gavel, Scale,
  ShieldCheck, Users, Landmark, CheckCircle2, ExternalLink
} from 'lucide-react';
import { authFetch } from '../utils/http';
import LoadingScreen from '../components/layout/LoadingScreen';

// Institusi tujuan disesuaikan dengan jenjang peraturan
function targetInstitution(category = '') {
  const c = category.toLowerCase();
  if (/perda|pergub|perda\s*istimewa/.test(c)) {
    return {
      ppid: 'PPID Provinsi/Kabupaten-Kota setempat',
      uji: 'Mahkamah Agung (penguji materiil Perda terhadap peraturan yang lebih tinggi)',
      aspirasi: 'DPRD daerah setempat'
    };
  }
  if (/permen|perpres|^pp\b|kepmen/.test(c)) {
    return {
      ppid: 'PPID kementerian/lembaga penerbit aturan',
      uji: 'Mahkamah Agung (penguji materiil peraturan di bawah undang-undang)',
      aspirasi: 'Kementerian/lembaga terkait & DPR'
    };
  }
  return {
    ppid: 'PPID instansi penerbit (kementerian/lembaga/DPR)',
    uji: 'Mahkamah Konstitusi (jika menguji UU terhadap UUD 1945) atau Mahkamah Agung',
    aspirasi: 'DPR RI / DPD'
  };
}

const ACTIONS = [
  {
    icon: FileSearch,
    color: 'from-sky-500 to-blue-600',
    title: '1. Ajukan Permohonan Informasi Publik',
    dasar: 'UU No. 14/2008 (KIP)',
    desc: 'Jika dokumen resmi peraturan ini tidak ditemukan, badan publik WAJIB memberikannya saat diminta. Ini hak Anda.',
    getSteps: (t) => [
      `Temukan PPID terdekat melalui ppid.go.id atau situs resmi ${t.ppid}.`,
      'Ajukan permohonan secara online/tulis: sebutkan judul & nomor peraturan yang diminta.',
      'Badan publik wajib menjawab maksimal 10 hari kerja (bisa diperpanjang 7 hari).',
      'Jika ditolak/diam: ajukan sengketa ke Komisi Informasi (ki.go.id).'
    ]
  },
  {
    icon: Megaphone,
    color: 'from-orange-500 to-amber-600',
    title: '2. Sampaikan Aspirasi & Masukan',
    dasar: 'UU No. 12/2011 (Pembentukan Peraturan)',
    desc: 'Masyarakat berhak berpartisipasi dalam pembentukan dan perbaikan peraturan — termasuk mengusulkan perubahan/pencabutan.',
    getSteps: (t) => [
      `Kirim masukan tertulis ke ${t.aspirasi} melalui kanal resmi/surat.`,
      'Buat atau dukung petisi daring sebagai tekanan publik yang terdokumentasi.',
      'Manfaatkan momen rapat dengar pendapat (RDPU) — pendaftaran dibuka publik.'
    ]
  },
  {
    icon: Gavel,
    color: 'from-purple-500 to-violet-600',
    title: '3. Pengujian Peraturan',
    dasar: 'UU No. 48/2009 & UU No. 24/2003',
    desc: 'Jika isi peraturan dinilai bertentangan dengan peraturan lebih tinggi, dapat diajukan pengujian.',
    getSteps: (t) => [
      `Sasaran pengujian: ${t.uji}.`,
      'Hanya pihak yang dirugikan langsung (legal standing) yang dapat mengajukan — gabungkan dengan warga lain/organisasi.',
      'Butuh pendampingan advokat: gunakan jalur bantuan hukum (kartu 5).'
    ]
  },
  {
    icon: ShieldCheck,
    color: 'from-red-500 to-rose-600',
    title: '4. Lapor ke Ombudsman RI',
    dasar: 'UU No. 37/2008',
    desc: 'Apabila penyelenggaraan layanan publik berbasis aturan ini lambat, berbiaya ilegal, atau diskriminatif — itu maladministrasi.',
    getSteps: () => [
      'Lapor via ombudsman.go.id, aplikasi Lapor!, datangi cabang Ombudsman terdekat.',
      'Lampirkan bukti pengalaman (foto, surat, kronologi) — semakin spesifik semakin kuat.',
      'Ombudsman dapat merekomendasikan perbaikan bahkan revisi aturan.'
    ]
  },
  {
    icon: Users,
    color: 'from-emerald-500 to-green-600',
    title: '5. Advokasi Kolektif & Bantuan Hukum',
    dasar: 'UU No. 16/2011 (Bantuan Hukum)',
    desc: 'Isu satu orang mudah diabaikan; isu kolektif sulit diabaikan. Rangkul komunitas, akademisi, dan media.',
    getSteps: () => [
      'Hubungi lembaga bantuan hukum (LBH) atau fakultas hukum universitas — banyak yang punya layanan konsultasi gratis.',
      'Bangun dukungan komunitas terdampak, susun dokumen posisi bersama.',
      'Libatkan media arus utama/peneliti agar isu mendapat perhatian publik.'
    ]
  }
];

const CitizenActionGuide = () => {
  const { rule_code } = useParams();
  const navigate = useNavigate();
  const [rule, setRule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    authFetch(`/api/rules/${encodeURIComponent(rule_code)}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.error || 'Peraturan tidak ditemukan');
        setRule(json.data);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [rule_code]);

  if (loading) return <LoadingScreen label="Menyiapkan panduan aksi..." />;

  if (error && !rule) {
    return (
      <div className="bg-white rounded-xl p-10 text-center dark:bg-gray-800">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => navigate('/rules')} className="text-blue-600 hover:text-blue-800 font-medium">
          Kembali ke Explorer
        </button>
      </div>
    );
  }

  const hasSource = Boolean(
    rule.source_url ||
    (typeof rule.content === 'string' && rule.content.trim().startsWith('{') &&
      (() => { try { return JSON.parse(rule.content)?.source_url; } catch { return false; } })())
  );
  const targets = targetInstitution(rule.category);
  const loopholes = Array.isArray(rule.loopholes) ? rule.loopholes : [];

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(`/rules/${rule_code}`)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Detail Peraturan
      </button>

      {/* Header status */}
      <div className={`rounded-xl shadow-md p-6 border-l-4 ${
        hasSource ? 'border-blue-500 bg-white dark:bg-gray-800 dark:border-blue-500'
                  : 'border-yellow-500 bg-yellow-50 dark:bg-gray-800'
      }`}>
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            hasSource ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-yellow-100 dark:bg-yellow-900/30'
          }`}>
            <Scale className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 leading-snug dark:text-gray-100">{rule.title}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-gray-100 ring-1 ring-gray-200 font-mono dark:bg-gray-700 dark:ring-gray-600 dark:text-gray-300">
                {rule.rule_code}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {rule.category}
              </span>
              {hasSource ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" /> Dokumen sumber tersedia
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
                  <AlertTriangle className="h-3 w-3" /> Dokumen resmi belum tersedia di sistem
                </span>
              )}
            </div>
          </div>
          {!hasSource && rule.pdf_url && (
            <a
              href={rule.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-700 hover:bg-white transition-colors shrink-0 dark:border-gray-600 dark:text-gray-200"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Coba PDF terdaftar
            </a>
          )}
        </div>
        {!hasSource && (
          <p className="mt-3 text-sm text-yellow-800 dark:text-yellow-300">
            Dokumen sumber tidak dapat diakses — jangan khawatir, sebagai warga Anda tetap punya
            beberapa jalur resmi untuk memperoleh dokumen ini sekaligus memperbaiki aturannya:
          </p>
        )}
      </div>

      {/* Poin dari analisis */}
      {loopholes.length > 0 && (
        <div className="rounded-xl shadow-md p-6 bg-white dark:bg-gray-800">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3 dark:text-gray-100">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Poin Kuat dari Analisis (untuk disampaikan)
          </h2>
          <ul className="space-y-2">
            {loopholes.map((l, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-yellow-500 shrink-0" />
                {l}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Kutip poin-poin ini saat menulis permohonan, masukan, atau laporan Anda.
          </p>
        </div>
      )}

      {/* Kartu aksi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <div key={action.title} className="bg-white rounded-xl shadow-md overflow-hidden flex flex-col dark:bg-gray-800">
              <div className={`p-4 bg-gradient-to-r ${action.color}`}>
                <div className="flex items-center gap-2.5 text-white">
                  <Icon className="h-5 w-5 shrink-0" />
                  <h3 className="font-semibold leading-tight">{action.title}</h3>
                </div>
                <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-medium">
                  Dasar: {action.dasar}
                </span>
              </div>
              <div className="p-4 flex flex-col flex-1">
                <p className="text-sm text-gray-600 mb-3 leading-relaxed dark:text-gray-300">{action.desc}</p>
                <ol className="space-y-2 mt-auto">
                  {action.getSteps(targets).map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 dark:bg-gray-700 dark:text-gray-300">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          );
        })}
      </div>

      {/* Disclaimer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-start gap-3">
          <Landmark className="h-5 w-5 text-blue-600 mt-0.5 shrink-0 dark:text-blue-400" />
          <p className="text-sm text-gray-700 leading-relaxed dark:text-gray-300">
            Panduan ini bersifat edukatif, bukan nasihat hukum. Untuk kasus spesifik, konsultasikan
            dengan penasihat hukum atau lembaga bantuan hukum. Seluruh jalur di atas adalah mekanisme legal
            yang dilindungi undang-undang.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CitizenActionGuide;
