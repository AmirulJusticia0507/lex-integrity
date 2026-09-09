import { Ollama } from 'ollama';

const ollamaFetch = (url, options = {}) => fetch(url, {
  ...options,
  headers: {
    ...options.headers,
    'ngrok-skip-browser-warning': 'true'
  }
});

export function createOllamaClient() {
  return new Ollama({
    host: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    headers: {
      'ngrok-skip-browser-warning': 'true',
      'User-Agent': 'LexIntegrityBackend/1.0'
    },
    fetch: ollamaFetch
  });
}

export const ollamaHeaders = {
  'ngrok-skip-browser-warning': 'true',
  'User-Agent': 'LexIntegrityBackend/1.0'
};

export function getOllamaBaseUrl() {
  const rawUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const markdownUrl = rawUrl.match(/\]\((https?:\/\/[^)]+)\)/);
  return (markdownUrl?.[1] || rawUrl).replace(/^<|>$/g, '').trim();
}

export async function fetchOllama(path, options = {}) {
  const base = getOllamaBaseUrl().replace(/\/$/, '');
  return fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...ollamaHeaders,
      ...options.headers
    }
  });
}
