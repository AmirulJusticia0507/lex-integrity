import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Scale, ArrowLeft, Shield, Database, Brain, Cookie, Lock, Share2, Clock, Mail, UserCheck, Server, Eye } from 'lucide-react';

const LAST_UPDATED = '26 Agustus 2026';

const Section = ({ icon: Icon, title, children }) => (
  <section className="bg-white rounded-xl shadow-sm border border-gray-200/70 p-6 md:p-8 dark:bg-gray-800 dark:border-gray-700">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 dark:bg-blue-900/40">
        <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
    </div>
    <div className="space-y-3 text-sm text-gray-700 leading-relaxed dark:text-gray-300">{children}</div>
  </section>
);

const storageTable = [
  {
    key: 'lex_auth_token',
    jenis: 'localStorage',
    tujuan: 'Menyimpan token sesi login agar Anda tetap masuk setelah menutup browser.',
    retensi: 'Sampai Anda keluar (logout) atau sesi kedaluwarsa.'
  },
  {
    key: 'lex_auth_user',
    jenis: 'localStorage',
    tujuan: 'Menyimpan ringkasan profil akun (nama, email, peran) untuk tampilan antarmuka.',
    retensi: 'Sampai Anda keluar (logout).'
  },
  {
    key: 'lex_dark_mode',
    jenis: 'localStorage',
    tujuan: 'Mengingat preferensi mode gelap/terang.',
    retensi: 'Persisten hingga dihapus oleh pengguna.'
  },
  {
    key: 'lex_sidebar_collapsed',
    jenis: 'localStorage',
    tujuan: 'Mengingat keadaan sidebar (lebar/ringkas).',
    retensi: 'Persisten hingga dihapus oleh pengguna.'
  },
  {
    key: 'lex_chat_sessions',
    jenis: 'localStorage',
    tujuan: 'Menyimpan riwayat percakapan Chat AI di perangkat Anda.',
    retensi: 'Persisten hingga Anda menghapus riwayat atau data browser.'
  }
];

const PrivacyPolicy = () => {
  useEffect(() => {
    const saved = localStorage.getItem('lex_dark_mode');
    if (saved === 'true') document.documentElement.classList.add('dark');
    return () => document.documentElement.classList.remove('dark');
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Scale className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 dark:text-gray-100">Lex-Integrity</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">AI Policy & Regulatory Compliance Matrix</p>
            </div>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Beranda
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-5">
        <div className="mb-2">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Kebijakan Privasi &amp; Cookies
          </h1>
          <p className="text-sm text-gray-500 mt-2 dark:text-gray-400">
            Terakhir diperbarui: <span className="font-medium text-gray-700 dark:text-gray-300">{LAST_UPDATED}</span>
          </p>
        </div>

        <Section icon={Eye} title="1. Pendahuluan">
          <p>
            Kami menghargai privasi Anda. Kebijakan ini menjelaskan bagaimana Lex-Integrity — platform analisis
            kepatuhan regulasi berbasis AI untuk produk hukum Indonesia — mengumpulkan, menggunakan, menyimpan,
            dan melindungi data Anda saat Anda mengakses serta menggunakan layanan ini.
          </p>
          <p>
            Dengan mengakses dan menggunakan Lex-Integrity, Anda dianggap telah membaca, memahami, dan menyetujui
            praktik yang dijelaskan dalam kebijakan ini. Kebijakan ini disusun dengan mempertimbangkan ketentuan
            Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).
          </p>
        </Section>

        <Section icon={Database} title="2. Informasi yang Kami Kumpulkan">
          <p>Kami mengumpulkan jenis informasi berikut:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <b>Data Akun.</b> Nama, alamat email, nama pengguna, dan kata sandi (disimpan dalam bentuk hash
              terenkripsi, bukan teks asli) saat Anda mendaftar atau masuk.
            </li>
            <li>
              <b>Data Peraturan.</b> Dokumen dan metadata produk hukum Indonesia (UU, PP, Perpres, Perda, Permen,
              dll.) yang bersumber dari kanal resmi JDIH — data ini bersifat publik dan bukan data pribadi Anda.
            </li>
            <li>
              <b>Riwayat Percakapan AI.</b> Pertanyaan dan jawaban pada fitur Chat AI, tersimpan di perangkat Anda
              (localStorage) dan/atau basis data lokal untuk perbaikan kualitas layanan.
            </li>
            <li>
              <b>Log Sistem.</b> Catatan teknis seperti waktu akses, aktivitas API, dan status layanan untuk
              keperluan keamanan serta pemecahan masalah.
            </li>
          </ul>
        </Section>

        <Section icon={Brain} title="3. Pemrosesan AI 100% Lokal">
          <p>
            Seluruh pemrosesan kecerdasan buatan (analisis kontradiksi, deteksi loopholes, dan Chat AI) berjalan{' '}
            <b>sepenuhnya secara lokal dan offline</b> menggunakan model bahasa lokal melalui Ollama.
          </p>
          <p>
            <b>Tidak ada data pribadi maupun isi dokumen yang dikirim ke server pihak ketiga</b>, cloud AI, atau
            layanan eksternal mana pun dalam proses inferensi model.
          </p>
        </Section>

        <Section icon={Server} title="4. Cara Kami Menggunakan Informasi">
          <ul className="list-disc pl-5 space-y-2">
            <li>Menyediakan akses ke fitur platform (explorer peraturan, legal matrix, analytics, chat AI).</li>
            <li>Memverifikasi identitas dan mengelola sesi login serta hak akses pengguna.</li>
            <li>Mengingat preferensi tampilan agar pengalaman penggunaan lebih nyaman.</li>
            <li>Memantau kesehatan sistem (database, cache, LLM worker) dan mencegah penyalahgunaan.</li>
          </ul>
        </Section>

        <Section icon={Cookie} title="5. Cookies & Penyimpanan Lokal">
          <p>
            Lex-Integrity tidak menggunakan cookie pelacak (tracking cookies) dari pihak ketiga. Kami hanya
            menggunakan penyimpanan lokal browser (<i>localStorage</i>) untuk keperluan fungsional berikut:
          </p>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left border border-gray-200 rounded-lg overflow-hidden dark:border-gray-700">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-700/60 dark:text-gray-400">
                  <th className="px-4 py-3">Kunci / Kuki</th>
                  <th className="px-4 py-3">Tujuan</th>
                  <th className="px-4 py-3">Retensi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {storageTable.map((row) => (
                  <tr key={row.key} className="align-top">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-gray-800 dark:text-gray-200">{row.key}</span>
                      <br />
                      <span className="text-xs text-gray-400">{row.jenis}</span>
                    </td>
                    <td className="px-4 py-3">{row.tujuan}</td>
                    <td className="px-4 py-3">{row.retensi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Anda dapat menghapus penyimpanan lokal kapan saja melalui pengaturan browser Anda. Perlu dicatat,
            menghapus kunci autentikasi akan mengakhiri sesi login Anda.
          </p>
        </Section>

        <Section icon={Share2} title="6. Berbagi Data kepada Pihak Ketiga">
          <p>
            Kami <b>tidak menjual, menyewakan, atau membagikan</b> data pribadi Anda kepada pihak ketiga untuk
            tujuan komersial apa pun. Karena seluruh infrastruktur (PostgreSQL, Redis, Ollama) berjalan pada
            server lokal Anda sendiri, data tidak meninggalkan lingkungan sistem tersebut.
          </p>
          <p>
            Pengecualian hanya dilakukan bila diwajibkan oleh peraturan perundang-undangan atau perintah hukum
            yang sah dari otoritas berwenang.
          </p>
        </Section>

        <Section icon={Lock} title="7. Penyimpanan & Keamanan Data">
          <ul className="list-disc pl-5 space-y-2">
            <li>Kata sandi disimpan dalam bentuk hash yang tidak dapat dibaca manusia.</li>
            <li>Akses API dilindungi autentikasi berbasis token serta rate limiting.</li>
            <li>Basis data dan layanan pendukung berjalan di lingkungan lokal/tertutup.</li>
            <li>Kami menerapkan prinsip minimalisasi data: hanya mengumpulkan data yang benar-benar diperlukan.</li>
          </ul>
        </Section>

        <Section icon={UserCheck} title="8. Hak-Hak Anda">
          <p>Berdasarkan UU PDP, Anda berhak untuk:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Meminta akses dan salinan data pribadi yang kami proses.</li>
            <li>Meminta perbaikan atas data yang tidak akurat atau tidak lengkap.</li>
            <li>Meminta penghapusan data pribadi Anda dari sistem kami.</li>
            <li>Menarik persetujuan pemrosesan data kapan saja.</li>
            <li>Mengajukan keberatan atau keluhan terkait pemrosesan data pribadi.</li>
          </ul>
          <p>
            Permintaan dapat diajukan melalui kontak pada bagian bawah kebijakan ini dan akan kami tanggapi dalam
            waktu yang wajar.
          </p>
        </Section>

        <Section icon={Clock} title="9. Perubahan Kebijakan">
          <p>
            Kebijakan ini dapat diperbarui dari waktu ke waktu seiring perkembangan layanan. Setiap perubahan
            material akan diumumkan melalui halaman ini beserta tanggal pembaruan terbaru. Kami menyarankan Anda
            meninjau kebijakan ini secara berkala.
          </p>
        </Section>

        <Section icon={Mail} title="10. Kontak">
          <p>
            Untuk pertanyaan, permintaan, atau keluhan terkait Kebijakan Privasi &amp; Cookies ini, silakan hubungi:
          </p>
          <p>
            <b>Amirul Putra Justicia</b>
            <br />
            Email: <a href="mailto:amiruljusticia0507@gmail.com" className="text-blue-600 hover:underline dark:text-blue-400">amiruljusticia0507@gmail.com</a>
            <br />
            GitHub:{' '}
            <a
              href="https://github.com/AmirulJusticia0507"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              github.com/AmirulJusticia0507
            </a>
          </p>
        </Section>

        <p className="text-center text-sm text-gray-500 pt-4 dark:text-gray-400">
          © {new Date().getFullYear()} <span className="font-medium text-gray-700 dark:text-gray-300">Amirul Putra Justicia</span>.
          Hak cipta dilindungi.
        </p>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
