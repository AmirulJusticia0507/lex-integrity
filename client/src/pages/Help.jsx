import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Scale, ArrowLeft, HelpCircle, BookOpen, MessageSquare, Search, BarChart2, Brain, Database, Mail, Github, ChevronDown, FileText, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

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

const FAQItem = ({ question, answer }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg dark:border-gray-700">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors dark:text-gray-200 dark:hover:bg-gray-700/50"
      >
        {question}
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ml-2 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">
          {answer}
        </div>
      )}
    </div>
  );
};

const faqData = [
  {
    q: 'Apa itu Lex-Integrity?',
    a: 'Lex-Integrity adalah platform analisis kepatuhan regulasi berbasis AI untuk produk hukum Indonesia. Platform ini membantu Anda menjelajahi, menganalisis, dan memahami peraturan perundang-undangan secara lebih mudah.'
  },
  {
    q: 'Bagaimana cara mendaftar akun baru?',
    a: 'Klik tombol "Masuk" di halaman login, lalu pilih "Daftar Akun Baru". Isi nama, email, dan kata sandi Anda. Setelah itu, Anda akan langsung bisa menggunakan seluruh fitur platform.'
  },
  {
    q: 'Apakah data saya aman?',
    a: 'Ya. Seluruh data disimpan secara lokal (on-premise). Tidak ada data pribadi yang dikirim ke server pihak ketiga. Proses analisis AI juga berjalan 100% offline menggunakan Ollama.'
  },
  {
    q: 'Bagaimana cara menggunakan fitur Chat AI?',
    a: 'Navigasi ke menu "Chat AI" di sidebar. Ketik pertanyaan Anda di kolom pesan, dan AI akan memberikan analisis berdasarkan konteks peraturan yang tersedia di basis data.'
  },
  {
    q: 'Apa itu Compliance AI?',
    a: 'Compliance AI adalah fitur untuk menganalisis kepatuhan suatu produk hukum terhadap regulasi lainnya. Anda bisa mendeteksi potensi kontradiksi, overlap, dan kekosongan hukum (loopholes).'
  },
  {
    q: 'Bagaimana cara mencari peraturan tertentu?',
    a: 'Gunakan menu "Explorer" untuk menelusuri seluruh peraturan, atau "Search" untuk pencarian lanjutan berdasarkan kata kunci, jenis peraturan, tahun, dan lembaga pengeluar.'
  },
  {
    q: 'Sumber data peraturan dari mana?',
    a: 'Data bersumber dari JDIH (Jaringan Dokumentasi dan Informasi Hukum) resmi seperti JDIH MA, JDIH MK, Kemendagri, dan portal peraturan.go.id. Data diperbarui secara berkala melalui scraper otomatis.'
  },
  {
    q: 'Mode gelap (dark mode) ada?',
    a: 'Ya. Klik ikon bulan/matahari di sidebar untuk beralih antara mode terang dan gelap. Preferensi Anda akan tersimpan otomatis.'
  }
];

const Help = () => {
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
            Bantuan
          </h1>
          <p className="text-sm text-gray-500 mt-2 dark:text-gray-400">
            Panduan penggunaan dan pertanyaan umum seputar Lex-Integrity
          </p>
        </div>

        {/* FAQ */}
        <Section icon={HelpCircle} title="Pertanyaan Umum (FAQ)">
          <div className="space-y-3">
            {faqData.map((item, i) => (
              <FAQItem key={i} question={item.q} answer={item.a} />
            ))}
          </div>
        </Section>

        {/* Panduan Penggunaan */}
        <Section icon={BookOpen} title="Panduan Penggunaan">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            1. Explorer Peraturan
          </h3>
          <p>
            Menu <b>Explorer</b> menampilkan seluruh peraturan dalam format kartu. Gunakan filter di bagian atas
            untuk mempersempit hasil berdasarkan jenis peraturan, tahun, lembaga, atau status. Klik kartu untuk
            melihat detail lengkap termasuk teks asli, hierarki, dan analisis AI.
          </p>

          <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mt-4">
            <Search className="h-4 w-4 text-blue-500" />
            2. Pencarian Lanjutan
          </h3>
          <p>
            Menu <b>Search</b> memungkinkan pencarian berdasarkan kata kunci, pasal tertentu, atau frasa hukum.
            Hasil pencarian menampilkan peraturan yang paling relevan beserta skor kecocokan.
          </p>

          <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mt-4">
            <BarChart2 className="h-4 w-4 text-blue-500" />
            3. Legal Matrix
          </h3>
          <p>
            Menu <b>Legal Matrix</b> menampilkan visualisasi hubungan antar peraturan dalam format matriks.
            Anda dapat melihat peraturan mana yang saling merujuk, mencabut, atau berkonflik satu sama lain.
          </p>

          <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mt-4">
            <Brain className="h-4 w-4 text-blue-500" />
            4. Compliance AI
          </h3>
          <p>
            Menu <b>Compliance AI</b> menganalisis kepatuhan suatu produk hukum. Upload atau pilih peraturan,
            lalu sistem akan mendeteksi potensi kontradiksi, overlap, dan kekosongan hukum secara otomatis
            menggunakan pemrosesan AI lokal.
          </p>

          <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mt-4">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            5. Chat AI
          </h3>
          <p>
            Menu <b>Chat AI</b> memungkinkan Anda berinteraksi dengan AI untuk bertanya tentang peraturan,
            meminta penjelasan pasal, atau analisis singkat. Semua jawaban bersumber dari basis data peraturan
            yang tersedia dan diproses sepenuhnya secara offline.
          </p>

          <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mt-4">
            <ShieldCheck className="h-4 w-4 text-blue-500" />
            6. Mode Gelap (Dark Mode)
          </h3>
          <p>
            Klik ikon <b>bulan/matahari</b> di sidebar untuk beralih antara mode terang dan gelap.
            Preferensi tampilan akan tersimpan secara otomatis di browser Anda.
          </p>
        </Section>

        {/* Kontak Support */}
        <Section icon={Mail} title="Kontak Support">
          <p>
            Jika Anda mengalami kendala atau memiliki pertanyaan lebih lanjut, jangan ragu untuk menghubungi kami:
          </p>
          <div className="mt-3 space-y-2">
            <p className="flex items-center gap-2">
              <span className="font-medium text-gray-800 dark:text-gray-200">Amirul Putra Justicia</span>
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-500" />
              Email:{' '}
              <a href="mailto:amiruljusticia0507@gmail.com" className="text-blue-600 hover:underline dark:text-blue-400">
                amiruljusticia0507@gmail.com
              </a>
            </p>
            <p className="flex items-center gap-2">
              <Github className="h-4 w-4 text-blue-500" />
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
          </div>
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
            Kami biasanya merespons dalam waktu 1-2 hari kerja.
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

export default Help;
