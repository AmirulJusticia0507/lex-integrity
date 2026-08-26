const keycloakBase =
  process.env.REACT_APP_SSO_KEYCLOAK_BASE ||
  'https://sso.jogjaprov.go.id/realms/aptika/protocol/openid-connect';
const clientId = process.env.REACT_APP_SSO_CLIENT_ID || 'portal';
const scope = process.env.REACT_APP_SSO_SCOPE || 'openid profile email';

export const getLoginRedirectUri = () => {
  if (typeof window !== 'undefined') {
    return new URL('/login', window.location.origin).toString();
  }
  return '';
};

export function goGoogleLogin() {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getLoginRedirectUri(),
    response_type: 'code',
    scope,
    kc_idp_hint: 'google'
  });
  window.location.href = `${keycloakBase}/auth?${params.toString()}`;
}

export async function handleGoogleCallback(code) {
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: getLoginRedirectUri()
  });

  const resp = await fetch(`${keycloakBase}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  const tokenData = await resp.json();

  const msg = String(tokenData?.message || tokenData?.error_description || tokenData?.error || '').toLowerCase();
  if (msg.includes('akun telah ada')) {
    return { status: 'exists' };
  }

  if (!resp.ok || !tokenData?.access_token) {
    return { status: 'error', message: tokenData?.error_description || 'Login Google gagal: access_token tidak ditemukan.' };
  }

  const userinfoRes = await fetch(`${keycloakBase}/userinfo`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  if (!userinfoRes.ok) {
    return { status: 'error', message: 'Login Google gagal: tidak dapat mengambil profil pengguna.' };
  }
  const userinfo = await userinfoRes.json();

  // Tukar identitas SSO dengan sesi lokal (JWT internal) agar token
  // konsisten dengan middleware authenticateToken di backend.
  try {
    const ssoRes = await fetch('/api/auth/sso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sub: userinfo.sub,
        email: userinfo.email,
        preferred_username: userinfo.preferred_username,
        name: userinfo.name
      })
    });
    const ssoData = await ssoRes.json();
    if (ssoRes.ok && ssoData.success) {
      return {
        status: 'success',
        token: ssoData.data.token,
        user: ssoData.data.user
      };
    }
    return { status: 'error', message: ssoData.error || 'Login Google gagal: sinkronisasi akun ditolak server.' };
  } catch {
    // Backend tidak terjangkau -> fallback ke profil Keycloak apa adanya
    return {
      status: 'success',
      token: tokenData.access_token,
      user: {
        id: userinfo.sub,
        username: userinfo.preferred_username || userinfo.name || 'pengguna_sso',
        email: userinfo.email || '',
        role: 'user',
        name: userinfo.name || userinfo.preferred_username
      }
    };
  }
}
