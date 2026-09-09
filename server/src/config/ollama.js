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
    fetch: ollamaFetch
  });
}

export function getOllamaBaseUrl() {
  return process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
}
