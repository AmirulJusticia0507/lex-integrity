// Seed data for lex-integrity rules
// 10 example rules covering different eras and categories

module.exports = [
  {
    "rule_code": "UU-2024-1-P4",
    "title": "UU No. 1 Tahun 2024 Pasal 4",
    "regime": "Prabowo Subianto",
    "category": "UU",
    "content": "Setiap warga negara berkewajiban taat dan mematuhi peraturan perundang-undangan yang berlaku. Pemerintah wajib melindungi dan melayani masyarakat dengan adil dan merata. Pelanggaran terhadap ketentuan ini dapat dikenakan sanksi administratif maupun pidana sesuai dengan peraturan perundang-undangan.",
    "derived_rules": [],
    "loopholes": [],
    "impacts": ["Landasan hukum untuk kebijakan afirmatif"],
    "sanctions": {
      "administrative": "Pencabutan SK Terkait",
      "criminal": "Pasal 3 UU Tipikor"
    },
    "view_count": 412
  },
  {
    "rule_code": "PP-2024-12-P8",
    "title": "PP No. 12 Tahun 2024 Pasal 8",
    "regime": "Prabowo Subianto",
    "category": "PP",
    "content": "Untuk melaksanakan ketentuan Pasal 4, Pemerintah menetapkan peraturan lebih lanjut mengenai mekanisme pelayanan publik, kriteria keadilan, dan standar operasional prosedur. Ketentuan ini berlaku selama 5 tahun sejak diundangkan dan dapat diperpanjang berdasarkan evaluasi kinerja.",
    "derived_rules": [],
    "loopholes": ["Diskresi Menteri tanpa kriteria yang jelas"],
    "impacts": ["Risiko ekologis tinggi", "Monopoli izin"],
    "sanctions": {
      "administrative": "Pencabutan SK Terkait",
      "criminal": "Pasal 3 UU Tipikor"
    },
    "view_count": 356
  },
  {
    "rule_code": "PERDA-2025-2-P3",
    "title": "Perda No. 2 Tahun 2025 Pasal 3",
    "regime": "Prabowo Subianto",
    "category": "Perda",
    "content": "Pemerintah daerah dapat menetapkan peraturan tambahan yang lebih ketat dari peraturan nasional untuk melindungi sumber daya lokal, lingkungan hidup, dan budaya masyarakat adat. Peraturan ini harus disahkan oleh DPRD dan dilaporkan kepada Pemerintah Pusat.",
    "derived_rules": [
      { "rule_code": "PERMEN-2025-1-P5", "relation": "Implementasi_Teknis" }
    ],
    "loopholes": ["Pengalihan wewenang tanpa persetujuan DPRD"],
    "impacts": ["Tumpang tindih alokasi APBD", "Konflik kewenangan"],
    "sanctions": {
      "administrative": "Pembatalan via Judicial Review",
      "criminal": "Ps 368-369 KUHP"
    },
    "view_count": 289
  },
  {
    "rule_code": "PERMEN-2025-1-P5",
    "title": "Permen No. 1 Tahun 2025 Pasal 5",
    "regime": "Prabowo Subianto",
    "category": "Permen",
    "content": "Menteri bertanggung jawab atas implementasi teknis seluruh peraturan perundang-undangan yang menjadi domain kementerian. Menteri dapat memberikan diskresi dalam batas tertentu dengan mempertimbangkan efisiensi dan efektivitas pelayanan. Diskresi harus dilaporkan kepada Presiden dan dapat dibatalkan jika bertentangan dengan hukum.",
    "derived_rules": [],
    "loopholes": ["Wewenang diskresi tanpa kriteria yang jelas"],
    "impacts": ["Potensi konflik kepentingan", "Reduksi transparansi"],
    "sanctions": {
      "administrative": "Pencabutan SK Menteri",
      "criminal": "Pasal 420 UU Tipikor"
    },
    "view_count": 245
  },
  {
    "rule_code": "UU-1968-5-P2",
    "title": "UU No. 5 Tahun 1968 Pasal 2",
    "regime": "Orde Baru",
    "category": "UU",
    "content": "Pemerintah memiliki wewenang penuh untuk mengatur dan mengawasi seluruh aspek kehidupan berbangsa dan bernegara demi keamanan dan ketertiban. Kebijakan pemerintah tidak dapat diganggu gugat kecuali oleh hukum atau ketentuan Konstitusi.",
    "derived_rules": [
      { "rule_code": "UU-1970-8-P1", "relation": "Pelaksanaan_Lebih_Lanjut" }
    ],
    "loopholes": ["Wewenang absolut pemerintah"],
    "impacts": ["Pembatasan hak sipil", "Penyalahgunaan kekuasaan"],
    "sanctions": {
      "administrative": "Pencabutan SK",
      "criminal": "Ps 2-3 UU Penyalahgunaan Lupa"
    },
    "view_count": 198
  },
  {
    "rule_code": "UU-2000-10-P1",
    "title": "UU No. 10 Tahun 2000 Pasal 1",
    "regime": "Reformasi",
    "category": "UU",
    "content": "Kedaulatan berada di tangan rakyat dan dilaksanakan menurut Undang-Undang Dasar. Kekuasaan pemerintah dibatasi oleh sistem checks and balances. Rakyat memiliki hak untuk mengawasi dan mengevaluasi kinerja pemerintah.",
    "derived_rules": [
      { "rule_code": "UU-2004-7-P3", "relation": "Implementasi_Lebih_Lanjut" }
    ],
    "loopholes": ["Potensi konflik antar lembaga"],
    "impacts": ["Tumpang tindih kewenangan"],
    "sanctions": {
      "administrative": "Perbaikan sistem",
      "criminal": "Ps 5-6 UU Perbaikan Sistem"
    },
    "view_count": 167
  },
  {
    "rule_code": "UU-2004-7-P3",
    "title": "UU No. 7 Tahun 2004 Pasal 3",
    "regime": "SBY",
    "category": "UU",
    "content": "Pemerintah berupaya mewujudkan good governance dan clean government. Reformasi birokrasi dilakukan untuk meningkatkan efisiensi, efektivitas, dan akuntabilitas. Transparansi dan partisipasi publik ditingkatkan dalam proses pengambilan kebijakan.",
    "derived_rules": [],
    "loopholes": ["Potensi politik uang dalam reformasi"],
    "impacts": ["Biaya reformasi tinggi", "Risiko korupsi"],
    "sanctions": {
      "administrative": "Evaluasi kinerja periodik",
      "criminal": "Ps 11-12 UU Tipikor"
    },
    "view_count": 145
  },
  {
    "rule_code": "UU-2012-11-P7",
    "title": "UU No. 11 Tahun 2012 Pasal 7",
    "regime": "Jokowi",
    "category": "UU",
    "content": "Pemerintah menerapkan reformasi peraturan perundang-undangan untuk menciptakan ekosistem bisnis yang kondusif. Percepatan pelayanan perizinan dan pengurangan birokrasi dilakukan untuk meningkatkan investasi dan daya saing nasional. Kebijakan ini menggunakan pendekatan digital dan partisipatif.",
    "derived_rules": [],
    "loopholes": ["Potensi konflik kepentingan dalam investasi"],
    "impacts": ["Meningkatkan investasi asing", "Potensi eksploitasi sumber daya"],
    "sanctions": {
      "administrative": "Pembekuan proyek",
      "criminal": "Pasal 2-3 UU Investasi"
    },
    "view_count": 123
  },
  {
    "rule_code": "PP-2001-6-P4",
    "title": "PP No. 6 Tahun 2001 Pasal 4",
    "regime": "Megawati",
    "category": "PP",
    "content": "Pemerintah mengawasi dan mengendalikan sumber daya alam untuk kesejahteraan rakyat. Pengelolaan sumber daya harus memperhatikan kelestarian lingkungan dan hak masyarakat adat. Setiap pelanggaran akan dikenakan sanksi administratif dan pidana.",
    "derived_rules": [],
    "loopholes": ["Potensi korupsi dalam pengelolaan SDA"],
    "impacts": ["Risiko konflik masyarakat", "Kerusakan lingkungan"],
    "sanctions": {
      "administrative": "Pembekuan izin usaha",
      "criminal": "Ps 6-7 UU SDA"
    },
    "view_count": 101
  },
  {
    "rule_code": "UU-1972-3-P2",
    "title": "UU No. 3 Tahun 1972 Pasal 2",
    "regime": "Awal Kemerdekaan",
    "category": "UU",
    "content": "Negara menjamin hak setiap warga atas perlindungan dan kepastian hukum. Pemerintah wajib menyediakan akses terhadap keadilan yang setara dan terjangkau. Setiap pelanggaran hak tersebut dapat dikenakan sanksi berat.",
    "derived_rules": [],
    "loopholes": ["Potensi korupsi peradilan"],
    "impacts": ["Ketidakadilan hukum", "Erosi kepercayaan publik"],
    "sanctions": {
      "administrative": "Pembatalan keputusan",
      "criminal": "Ps 4-5 UU Perlindungan Hukum"
    },
    "view_count": 89
  }
];