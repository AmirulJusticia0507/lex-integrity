import React from 'react';
import { Scale, FileText, Brain, Database, Cpu, Cloud, Shield, AlertTriangle, Search, BarChart2, GitBranch, Bot } from 'lucide-react';

const About = () => {
  const stack = [
    { icon: Scale, title: 'React 18 + Tailwind CSS', desc: 'Frontend SPA dengan CRA (react-scripts 5), styling utility-first Tailwind CSS.' },
    { icon: Database, title: 'Node.js + Express', desc: 'Backend REST API dengan Express, Sequelize ORM, dan Redis untuk antrian.' },
    { icon: Shield, title: 'PostgreSQL', desc: 'Database relasional menyimpan peraturan, hasil analisis, dan metadata scraping.' },
    { icon: Brain, title: 'Ollama (Local LLM)', desc: 'Model bahasa lokal (default deepseek-r1:14b) untuk chat dan analisis kontradiksi, 100% offline.' },
    { icon: FileText, title: 'Scraper Python', desc: 'Skrip scraping JDIH Sleman, JDIH Nasional, DPR & DPRD untuk mengambil dokumen peraturan.' },
    { icon: GitBranch, title: 'Halaman Utama', desc: 'Dashboard, Explorer, Legal Matrix, Analytics, Data Management, dan Chat AI.' }
  ];

  const features = [
    { icon: Search, title: 'Explorer Peraturan', desc: 'Telusuri produk hukum dengan filter era, kategori, dan celah (loopholes).' },
    { icon: AlertTriangle, title: 'Deteksi Loopholes', desc: 'Identifikasi pasal karet dan celah hukum pada setiap dokumen.' },
    { icon: Brain, title: 'Analisis Kontradiksi', desc: 'AI membandingkan peraturan terkait untuk menemukan inkonsistensi.' },
    { icon: BarChart2, title: 'Legal Matrix', desc: 'Matriks konflik antar peraturan per era dan kategori.' },
    { icon: Bot, title: 'Chat AI', desc: 'Tanya AI tentang peraturan tertentu, percakapan tersimpan per hari.' },
    { icon: Cloud, title: 'Scraping Terjadwal', desc: 'Otomatis memperbarui data dari sumber JDIH secara berkala.' }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-8 dark:bg-gray-800">
        <div className="flex items-center gap-4 mb-4">
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
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
          Lex-Integrity adalah platform analisis kepatuhan regulasi berbasis AI untuk produk hukum
          Indonesia. Sistem ini menggabungkan <b>scraping otomatis</b> dari berbagai sumber JDIH,
          <b> database terpusat</b> dengan PostgreSQL, serta <b> model bahasa lokal (LLM)</b> untuk
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
            Semua pemrosesan AI berjalan <b>100% lokal dan offline</b> menggunakan Ollama —
            tidak ada data yang dikirim ke server pihak ketiga.
          </p>
        </div>
      </div>
    </div>
  );
};

export default About;