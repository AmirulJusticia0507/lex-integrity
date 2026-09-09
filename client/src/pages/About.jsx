import React from 'react';
import { Link } from 'react-router-dom';
import { Scale, FileText, Brain, Database, Cpu, Cloud, Shield, AlertTriangle, Search, BarChart2, GitBranch, Bot, Github, Key, Zap, Lock, Save, RefreshCw, UserCheck } from 'lucide-react';

const About = () => {
  const stack = [
    { icon: Scale, title: 'React 18 + Tailwind CSS', desc: 'Frontend SPA dengan CRA (react-scripts 5), styling utility-first Tailwind CSS.' },
    { icon: Database, title: 'Node.js + Express', desc: 'Backend REST API dengan Express, Sequelize ORM, dan Redis untuk antrian & cache.' },
    { icon: Shield, title: 'PostgreSQL', desc: 'Database relasional menyimpan peraturan, hasil analisis, dan metadata scraping.' },
    { icon: Brain, title: 'Gemini + Ollama', desc: 'Provider AI fleksibel: Gemini untuk production, Ollama local untuk agent Lex Integrity.' },
    { icon: FileText, title: 'Scraper Python/Node', desc: 'Scraper JDIH Sleman, JDIH DIY/Jogja, KPU, JDIHN, DPR, dan DPRD.' },
    { icon: Key, title: 'JWT + Role-Based Auth', desc: 'Proteksi endpoint sensitif, guard admin, sinkronisasi SSO Google ke akun lokal.' },
    { icon: Zap, title: 'Node-Cron Scheduler', desc: 'Penjadwalan scraping dan backup dinamis dari UI Data Management.' },
    { icon: Save, title: 'Backup & Restore Otomatis', desc: 'Backup JSON manual dan terjadwal dengan cron, toggle aktif, dan retensi yang bisa diubah.' },
    { icon: GitBranch, title: 'Halaman Utama', desc: 'Dashboard, Explorer, Legal Matrix, Analytics, Data Management, Chat AI, Compliance.' }
  ];

  const features = [
    { icon: Search, title: 'Explorer Peraturan', desc: 'Telusuri produk hukum dengan filter era, kategori, dan celah (loopholes).' },
    { icon: AlertTriangle, title: 'Deteksi Loopholes', desc: 'Identifikasi pasal karet dan celah hukum pada setiap dokumen.' },
    { icon: Brain, title: 'Analisis Kontradiksi', desc: 'AI membandingkan peraturan terkait untuk menemukan inkonsistensi.' },
    { icon: BarChart2, title: 'Legal Matrix', desc: 'Matriks konflik antar peraturan per era dan kategori.' },
    { icon: Bot, title: 'Chat AI', desc: 'Tanya AI tentang peraturan tertentu, lanjutkan sesi riwayat, hapus chat, dan lihat progress saat AI berpikir.' },
    { icon: Cloud, title: 'Scraping Multi-Sumber', desc: 'Scraping manual dan terjadwal untuk JDIH Jogja, Sleman, KPU, dan sumber queue lain.' },
    { icon: Lock, title: 'Login Google SSO', desc: 'OAuth2/OIDC via Keycloak (sso.jogjaprov.go.id) + sinkronisasi akun lokal.' },
    { icon: Save, title: 'Backup Dinamis', desc: 'Jadwal backup bisa diedit dari UI: cron, status aktif, dan retensi.' },
    { icon: Key, title: 'Keamanan JWT', desc: 'Proteksi endpoint sensitif, guard admin/superadmin, role permission, dan interceptor token global.' },
    { icon: RefreshCw, title: 'Loading Spinner Bermerek', desc: 'LoadingScreen terpusat saat login ke dashboard, logout, dan refresh halaman terproteksi.' },
    { icon: UserCheck, title: 'Kartu Peraturan Modern', desc: 'UI card hover-lift, aksen gradasi kategori, badge soft, tombol aksi jelas.' },
    { icon: Zap, title: 'Grafik Lebar Penuh', desc: 'Grafik era full-width, pie chart dengan legenda rapi horizontal wrap.' }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-8 dark:bg-gray-800">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center">
              <Scale className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Lex-Integrity</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                AI Policy & Regulatory Compliance Matrix
              </p>
            </div>
          </div>
          <a
            href="https://github.com/AmirulJusticia0507"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Github className="h-5 w-5" />
            GitHub
          </a>
        </div>
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
          Lex-Integrity adalah platform analisis kepatuhan regulasi berbasis AI untuk produk hukum
          Indonesia. Sistem ini menggabungkan <b>scraping otomatis</b> dari berbagai sumber JDIH,
          <b> database terpusat</b> dengan PostgreSQL, serta <b> provider AI Gemini/Ollama</b> untuk
          menganalisis kontradiksi antar peraturan dan menjawab pertanyaan seputar dokumen hukum.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-8 dark:bg-gray-800">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Dibangun Dengan</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stack.map((item, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-5 dark:border-gray-700">
              <item.icon className="h-6 w-6 text-blue-600 mb-3" />
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">{item.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-8 dark:bg-gray-800">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Fitur Utama</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 dark:bg-gray-700">
                <item.icon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">{item.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-start gap-3">
          <Cpu className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            AI dapat berjalan memakai <b>Gemini API untuk production</b> atau <b>Ollama local</b>
            untuk pengembangan dan agent Lex Integrity. Mode local tetap tersedia saat endpoint
            Ollama diekspos ke backend.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 text-center dark:bg-gray-800">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          © {new Date().getFullYear()} <span className="font-medium text-gray-700 dark:text-gray-300">Amirul Putra Justicia</span>.
          Hak cipta dilindungi.
        </p>
        <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">
          Dibangun dengan AI-LLM terintegrasi: Gemini API dan Ollama Local LLM.
        </p>
        <p className="text-xs mt-2">
          <Link to="/privacy" className="text-blue-600 hover:underline dark:text-blue-400">
            Kebijakan Privasi &amp; Cookies
          </Link>
        </p>
      </div>
    </div>
  );
};

export default About;