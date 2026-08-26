import axios from 'axios';

const TOKEN_KEY = 'lex_auth_token';
const USER_KEY = 'lex_auth_user';

export const getToken = () => localStorage.getItem(TOKEN_KEY);

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
export function authFetch(input, init = {}) {
  const headers = new Headers(init.headers || {});
  const token = getToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}
