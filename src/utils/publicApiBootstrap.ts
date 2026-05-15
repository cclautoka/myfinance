import { readNotifyRelayConfig, resolveNotifyRelayUrl, writeNotifyRelayConfig } from './notifyRelayConfig';

/** Ensure relay + server storage use the fixed same-origin API path. */
export function bootstrapPublicApiConfig(): void {
  const cfg = readNotifyRelayConfig();
  const url = resolveNotifyRelayUrl();
  if (cfg.url === url && cfg.enabled) return;
  writeNotifyRelayConfig({
    ...cfg,
    enabled: true,
    url,
  });
}
