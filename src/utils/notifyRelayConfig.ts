/** localStorage keys for optional Dokploy (or any) notify relay — never stores finance data, only URL + secret. */

export const NOTIFY_RELAY_ENABLED_KEY = 'finance-notify-relay-enabled';
export const NOTIFY_RELAY_URL_KEY = 'finance-notify-relay-url';
export const NOTIFY_RELAY_SECRET_KEY = 'finance-notify-relay-secret';

export type NotifyRelayConfig = {
  enabled: boolean;
  url: string;
  secret: string;
};

export function readNotifyRelayConfig(): NotifyRelayConfig {
  try {
    return {
      enabled: localStorage.getItem(NOTIFY_RELAY_ENABLED_KEY) === '1',
      url: (localStorage.getItem(NOTIFY_RELAY_URL_KEY) ?? '').trim(),
      secret: (localStorage.getItem(NOTIFY_RELAY_SECRET_KEY) ?? '').trim(),
    };
  } catch {
    return { enabled: false, url: '', secret: '' };
  }
}

export function writeNotifyRelayConfig(c: NotifyRelayConfig): void {
  try {
    if (c.enabled) localStorage.setItem(NOTIFY_RELAY_ENABLED_KEY, '1');
    else localStorage.removeItem(NOTIFY_RELAY_ENABLED_KEY);
    localStorage.setItem(NOTIFY_RELAY_URL_KEY, c.url.trim());
    localStorage.setItem(NOTIFY_RELAY_SECRET_KEY, c.secret);
  } catch {
    /* ignore */
  }
}
