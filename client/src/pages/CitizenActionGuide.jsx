import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileSearch,
  Gavel,
  Landmark,
  Megaphone,
  Scale,
  ShieldCheck,
  Users
} from 'lucide-react';
import { authFetch } from '../utils/http';
import LoadingScreen from '../components/layout/LoadingScreen';

function targetInstitution(category = '') {
  const c = category.toLowerCase();
  if (/perda|pergub|perbup|perwal|perda\s*istimewa/.test(c)) {
    return {
      ppid: 'PPID Provinsi/Kabupaten/Kota atau instansi penerbit',
      uji: 'Mahkamah Agung untuk pengujian materiil peraturan di bawah undang-undang',
      aspirasi: 'DPRD daerah setempat dan kepala daerah/instansi penerbit'
    };
  }
  if (/permen|perpres|^pp\b|kepmen|peraturan menteri/.test(c)) {
    return {
      ppid: 'PPID kementerian/lembaga penerbit aturan',
      uji: 'Mahkamah Agung untuk pengujian materiil peraturan di bawah undang-undang',
      aspirasi: 'Kementerian/lembaga terkait dan DPR RI'
    };
  }
  return {
    ppid: 'PPID instansi penerbit aturan',
    uji: 'Mahkamah Konstitusi untuk UU terhadap UUD 1945, atau Mahkamah Agung untuk aturan di bawah UU',
    aspirasi: 'DPR RI/DPD atau instansi penerbit aturan'
  };
}

const ACTIONS = [
  {
    icon: FileSearch,
    color: 'from-sky-500 to-blue-600',
    title: '1. Minta Dokumen Resmi',
    dasar: 'UU No. 14/2008 tentang KIP',
    desc: 'Jika dasar hukum, naskah akademik, atau dokumen resmi belum jelas, warga dapat meminta informasi ke badan publik.',
    getSteps: (t) => [
      `Ajukan permohonan informasi ke ${t.ppid}.`,
      'Sebutkan nama/nomor aturan, dokumen yang diminta, dan alasan kebutuhan informasi.',
      'Jika tidak dijawab atau ditolak, ajukan keberatan lalu sengketa ke Komisi Informasi.'
    ]
  },
  {
    icon: Megaphone,
    color: 'from-orange-500 to-amber-600',
    title: '2. Kirim Masukan Perbaikan',
    dasar: 'UU No. 12/2011',
    desc: 'Masyarakat berhak memberi masukan atas pembentukan, perubahan, atau evaluasi peraturan.',
    getSteps: (t) => [
      `Kirim masukan tertulis ke ${t.aspirasi}.`,
      'Cantumkan pasal/ketentuan yang dianggap merugikan atau multitafsir.',
      'Minta klarifikasi, revisi, pencabutan, atau pedoman pelaksanaan yang lebih jelas.'
    ]
  },
  {
    icon: ShieldCheck,
    color: 'from-red-500 to-rose-600',
    title: '3. Laporkan Dampak Layanan Publik',
    dasar: 'UU No. 37/2008',
    desc: 'Jika aturan dipakai untuk pelayanan yang lambat, diskriminatif, pungutan liar, atau penolakan tanpa alasan, laporkan sebagai dugaan maladministrasi.',
    getSteps: () => [
      'Laporkan melalui SP4N LAPOR! atau Ombudsman RI.',
      'Lampirkan kronologi, tanggal kejadian, nama instansi, bukti surat, foto, atau tangkapan layar.',
      'Simpan nomor tiket laporan untuk pemantauan dan eskalasi.'
    ]
  },
  {
    icon: Gavel,
    color: 'from-purple-500 to-violet-600',
    title: '4. Pertimbangkan Uji Materi',
    dasar: 'UU No. 48/2009 dan UU No. 24/2003',
    desc: 'Jika substansi aturan bertentangan dengan aturan yang lebih tinggi, warga/kelompok terdampak dapat menyiapkan jalur pengujian.',
    getSteps: (t) => [
      `Cek forum pengujian yang relevan: ${t.uji}.`,
      'Kumpulkan bukti kerugian langsung atau potensi kerugian yang konkret.',
      'Konsultasikan legal standing dan petitum dengan advokat atau lembaga bantuan hukum.'
    ]
  },
  {
    icon: Users,
    color: 'from-emerald-500 to-green-600',
    title: '5. Bangun Advokasi Kolektif',
    dasar: 'UU No. 16/2011',
    desc: 'Masalah regulasi sering lebih kuat jika disuarakan bersama warga terdampak, komunitas, akademisi, atau organisasi bantuan hukum.',
    getSteps: () => [
      'Susun kronologi bersama dan kumpulkan pola kerugian dari beberapa warga.',
      'Minta pendampingan LBH, klinik hukum kampus, atau organisasi masyarakat sipil.',
      'Publikasikan temuan secara bertanggung jawab dengan data dan dokumen yang bisa diverifikasi.'
    ]
  }
];

const OFFICIAL_CHANNELS = [
  { label: 'SP4N LAPOR!', url: 'https://www.lapor.go.id/', note: 'aduan layanan publik lintas instansi' },
  { label: 'Ombudsman RI', url: 'https://ombudsman.go.id/', note: 'maladministrasi layanan publik' },
  { label: 'Komisi Informasi', url: 'https://komisiinformasi.go.id/', note: 'sengketa informasi publik' },
  { label: 'Komnas HAM', url: 'https://www.komnasham.go.id/', note: 'indikasi pelanggaran hak asasi' },
  { label: 'Bantuan Hukum BPHN', url: 'https://sidbankum.bphn.go.id/', note: 'mencari organisasi bantuan hukum' }
];

function resolveSource(rule) {
  if (rule.source_url) return rule.source_url;
  try {
    const parsed = typeof rule.content === 'string' && rule.content.trim().startsWith('{')
      ? JSON.parse(rule.content)
      : null;
    return parsed?.source_url || null;
  } catch {
    return null;
  }
}

function makeDraft(rule, targets, loopholes, impacts) {
  const issueLines = loopholes.length
    ? loopholes.map((item, index) => `${index + 1}. ${item}`).join('\n')
    : '1. [Tuliskan poin cacat, kontradiksi, atau pasal yang bermasalah]';
  const impactLines = impacts.length
    ? impacts.map((item, index) => `${index + 1}. ${item}`).join('\n')
    : '1. [Tuliskan dampak nyata yang dialami warga]';

  return `Perihal: Permohonan klarifikasi/evaluasi atas ${rule.title}

Kepada Yth. ${targets.ppid} / instansi penerbit peraturan,

Saya mengajukan permohonan klarifikasi dan evaluasi atas produk hukum berikut:
Nama peraturan: ${rule.title}
Kode/nomor: ${rule.rule_code || '-'}
Kategori: ${rule.category || '-'}

Poin yang perlu diklarifikasi:
${issueLines}

Dampak yang dirasakan/berpotensi dirasakan warga:
${impactLines}

Permohonan:
1. Mohon diberikan dokumen resmi, dasar pertimbangan, atau naskah akademik terkait aturan tersebut.
2. Mohon dilakukan klarifikasi atas ketentuan yang berpotensi menimbulkan ketidakpastian atau kerugian warga.
3. Jika benar terdapat masalah, mohon dipertimbangkan revisi, pencabutan, atau pedoman pelaksanaan yang lebih jelas.

Lampiran yang dapat disertakan:
1. Tangkapan layar/dokumen aturan.
2. Kronologi kejadian atau dampak yang dialami.
3. Bukti surat, foto, kuitansi, atau komunikasi dengan instansi terkait.

Hormat saya,
[Nama]
[Kontak]
[Alamat domisili]`;
}

const CitizenActionGuide = () => {
  const { rule_code } = useParams();
  const navigate = useNavigate();
  const [rule, setRule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

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

  const sourceUrl = resolveSource(rule);
  const hasSource = Boolean(sourceUrl || rule.pdf_url);
  const targets = targetInstitution(rule.category);
  const loopholes = Array.isArray(rule.loopholes) ? rule.loopholes : [];
  const impacts = Array.isArray(rule.impacts) ? rule.impacts : [];
  const draft = makeDraft(rule, targets, loopholes, impacts);

  const copyDraft = async () => {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(`/rules/${rule_code}`)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Detail Peraturan
      </button>

      <div className={`rounded-xl shadow-md p-6 border-l-4 ${
        hasSource ? 'border-blue-500 bg-white dark:bg-gray-800' : 'border-yellow-500 bg-yellow-50 dark:bg-gray-800'
      }`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            hasSource ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-yellow-100 dark:bg-yellow-900/30'
          }`}>
            <Scale className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
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
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              Panduan ini membantu warga mengubah temuan analisis menjadi langkah yang bisa dilakukan: minta dokumen,
              kirim masukan, laporkan dampak layanan publik, atau cari bantuan hukum.
            </p>
          </div>
          {(sourceUrl || rule.pdf_url) && (
            <a
              href={sourceUrl || rule.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Buka Sumber
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="bg-white rounded-xl shadow-md p-5 dark:bg-gray-800">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900 mb-3 dark:text-gray-100">
            <Scale className="h-5 w-5 text-blue-500" />
            Dampak ke Warga
          </h2>
          {impacts.length > 0 ? (
            <ul className="space-y-2">
              {impacts.map((impact, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300">{impact}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Dampak belum tersimpan. Isi bagian dampak pada draft sesuai pengalaman warga yang terdampak.
            </p>
          )}
        </section>

        <section className="bg-white rounded-xl shadow-md p-5 lg:col-span-2 dark:bg-gray-800">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900 mb-3 dark:text-gray-100">
            <Landmark className="h-5 w-5 text-emerald-600" />
            Kanal Tindak Lanjut
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {OFFICIAL_CHANNELS.map((channel) => (
              <a
                key={channel.url}
                href={channel.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-lg border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-blue-900/20"
              >
                <span className="flex items-center justify-between gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {channel.label}
                  <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
                </span>
                <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{channel.note}</span>
              </a>
            ))}
          </div>
        </section>
      </div>

      {loopholes.length > 0 && (
        <section className="rounded-xl shadow-md p-6 bg-white dark:bg-gray-800">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3 dark:text-gray-100">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Poin Analisis untuk Disampaikan
          </h2>
          <ul className="space-y-2">
            {loopholes.map((loophole, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-yellow-500 shrink-0" />
                {loophole}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-white rounded-xl shadow-md p-6 dark:bg-gray-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              <Megaphone className="h-5 w-5 text-orange-500" />
              Draft Aduan / Permohonan Klarifikasi
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Sesuaikan identitas, kronologi, dan bukti sebelum dikirim ke kanal resmi.
            </p>
          </div>
          <button
            type="button"
            onClick={copyDraft}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Tersalin' : 'Salin Draft'}
          </button>
        </div>
        <textarea
          value={draft}
          readOnly
          rows={18}
          className="mt-4 w-full rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-xs leading-relaxed text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <section key={action.title} className="bg-white rounded-xl shadow-md overflow-hidden flex flex-col dark:bg-gray-800">
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
            </section>
          );
        })}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-start gap-3">
          <Landmark className="h-5 w-5 text-blue-600 mt-0.5 shrink-0 dark:text-blue-400" />
          <p className="text-sm text-gray-700 leading-relaxed dark:text-gray-300">
            Panduan ini bersifat edukatif, bukan nasihat hukum. Untuk kasus spesifik, konsultasikan
            dengan penasihat hukum atau lembaga bantuan hukum. Jalur di atas adalah mekanisme legal yang
            dapat digunakan warga secara bertanggung jawab.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CitizenActionGuide;
