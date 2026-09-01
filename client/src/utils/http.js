import axios from 'axios';
import { apiConfig } from '../config';

const TOKEN_KEY = 'lex_auth_token';
const USER_KEY = 'lex_auth_user';

export const API_BASE = (apiConfig.baseURL || '').replace(/\/$/, '');

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export function apiUrl(path) {
  if (!path) return API_BASE;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/')) return `${API_BASE}${path}`;
  return `${API_BASE}/${path}`;
}

if (API_BASE) {
  axios.defaults.baseURL = API_BASE;
}

export function handleUnauthorized() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (!window.location.pathname.startsWith('/login')) {
    window.location.replace('/login');
  }
}

// Lampirkan token ke semua request axios
axios.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Sesi berakhir -> bersihkan dan kembali ke halaman login
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      handleUnauthorized();
    }
    return Promise.reject(error);
  }
);

// Pengganti fetch untuk endpoint terproteksi: otomatis menyertakan Bearer token
// Juga prepend API_BASE jika input adalah path relatif /api/...
export function authFetch(input, init = {}) {
  const headers = new Headers(init.headers || {});
  const token = getToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const url = typeof input === 'string' && input.startsWith('/api') ? apiUrl(input) : input;
  return fetch(url, { ...init, headers });
}
