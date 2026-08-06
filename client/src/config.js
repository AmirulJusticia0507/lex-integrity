// Theme configuration for Lex-Integrity
export const theme = {
  colors: {
    // Primary slate dark theme
    primary: {
      bg: '#0f172a',      // slate-900
      surface: '#1e293b',  // slate-800
      accent: '#38bdf8',   // sky-400
      warning: '#f59e0b',  // amber-500
      critical: '#ef4444',  // red-500
      text: '#f8fafc',     // slate-50
      textSecondary: '#94a3b8', // slate-400
      border: '#334155',   // slate-700
    },
    // Node colors (from graph.md)
    nodes: {
      root: '#38bdf8',      // blue-400 (UU Utama)
      derived: '#22c55e',    // green-500 (PP / Perpres)
      local: '#a855f7',      // purple-500 (Perda / Permen)
      risk: '#ef4444',       // red-500 (Risk / Loophole)
    },
    // Edge colors
    edges: {
      mandates: '#38bdf8',   // solid blue
      contradicts: '#ef4444', // red dashed
      overlaps: '#f59e0b',    // yellow
    },
  },
  // Typography
  fontFamily: {
    ui: 'Inter, system-ui, sans-serif',
    code: 'Fira Code, JetBrains Mono, monospace',
  },
  // Breakpoints
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
};

// API configuration
export const apiConfig = {
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  endpoints: {
    health: '/api/health',
    rules: {
      list: '/api/rules',
      detail: (ruleCode) => `/api/rules/${ruleCode}`,
      create: '/api/rules',
      update: (ruleCode) => `/api/rules/${ruleCode}`,
      delete: (ruleCode) => `/api/rules/${ruleCode}`
    },
    analytics: '/api/rules/analytics/overview',
    search: '/api/rules/search/suggestions',
    queue: '/api/queue/stats'
  }
};

// UI constants
export const uiConstants = {
  searchForm: {
    regimes: [
      'Orde Baru',
      'Reformasi',
      'Megawati',
      'SBY',
      'Jokowi',
      'Prabowo Subianto'
    ],
    categories: ['UU', 'PP', 'Perpres', 'Perda', 'Permen'],
    riskToggleLabel: 'Hanya tampilkan pasal yang terindikasi Loophole'
  },
  graph: {
    nodeTypes: {
      root: 'Root Node (UU Utama)',
      derived: 'Derived Node (PP / Perpres)',
      local: 'Local Node (Perda / Permen)',
      risk: 'Risk / Loophole Node'
    },
    edgeTypes: {
      mandates: 'Mandates (UU memerintahkan pembuatan PP)',
      contradicts: 'Contradicts (Aturan turunan bertentangan)',
      overlaps: 'Overlaps (Tumpang tindih wewenang)'
    }
  },
  table: {
    columns: [
      'ID Pasal',
      'Aturan Utama',
      'Aturan Turunan',
      'Potensi Celah / Abuse of Power',
      'Konsekuensi & Dampak',
      'Rekomendasi Sanksi'
    ]
  }
};

// Animation durations
export const animations = {
  fast: 0.2,
  normal: 0.3,
  slow: 0.5,
};

// Local storage keys
export const storageKeys = {
  auth: 'lex_integrity_auth',
  theme: 'lex_integrity_theme',
  searchHistory: 'lex_integrity_search_history',
  viewPreferences: 'lex_integrity_view_preferences'
};