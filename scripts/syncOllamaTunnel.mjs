#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const service = process.env.RAILWAY_SERVICE_ID || 'c2cb93bb-b30c-4c6c-97ae-94ee154cc954';

async function main() {
  let tunnelsRes;
  try {
    tunnelsRes = await fetch('http://127.0.0.1:4040/api/tunnels');
  } catch {
    throw new Error('ngrok API not reachable. Start ngrok with `ngrok http 11434`, then run this command in another terminal.');
  }
  if (!tunnelsRes.ok) {
    throw new Error(`ngrok API unavailable: HTTP ${tunnelsRes.status}`);
  }

  const tunnels = await tunnelsRes.json();
  const publicUrl = tunnels.tunnels?.find(tunnel => tunnel.public_url?.startsWith('https://'))?.public_url;
  if (!publicUrl) {
    throw new Error('No active HTTPS ngrok tunnel found. Run `ngrok http 11434` first.');
  }

  const tagsRes = await fetch(`${publicUrl}/api/tags`, {
    headers: {
      'ngrok-skip-browser-warning': 'true',
      'User-Agent': 'LexIntegrityBackend/1.0',
    },
  });
  if (!tagsRes.ok) {
    throw new Error(`Ollama tunnel check failed: HTTP ${tagsRes.status}`);
  }

  const railwayCommand = ['variable', 'set', `OLLAMA_BASE_URL=${publicUrl}`, '--service', service];
  const command = process.platform === 'win32' ? 'cmd.exe' : 'railway';
  const args = process.platform === 'win32' ? ['/c', 'railway', ...railwayCommand] : railwayCommand;

  execFileSync(command, args, {
    stdio: 'inherit',
  });

  console.log(`OLLAMA_BASE_URL synced: ${publicUrl}`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
