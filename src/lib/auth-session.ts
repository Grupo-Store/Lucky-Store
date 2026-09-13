const AUTH_KEYS = ['access_token', 'refresh_token', 'user_email'] as const;
export const SESSION_ENDED_EVENT = 'auth:session-ended';

// Do not carry the old persistent login into a new tab session.
for (const key of AUTH_KEYS) localStorage.removeItem(key);

export function clearAuthSession() {
  for (const key of AUTH_KEYS) sessionStorage.removeItem(key);
  window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
}

export function saveAuthTokens(tokens: { access_token: string; refresh_token: string }) {
  sessionStorage.setItem('access_token', tokens.access_token);
  sessionStorage.setItem('refresh_token', tokens.refresh_token);
}
