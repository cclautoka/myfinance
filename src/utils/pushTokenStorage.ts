const PUSH_TOKEN_STORAGE_KEY = 'finance-push-device-token';

export function readStoredPushToken(): string {
  try {
    return (localStorage.getItem(PUSH_TOKEN_STORAGE_KEY) ?? '').trim();
  } catch {
    return '';
  }
}

export function writeStoredPushToken(token: string): void {
  try {
    if (token) localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
