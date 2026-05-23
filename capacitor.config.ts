import type { CapacitorConfig } from '@capacitor/cli';

/** Must match `.env.capacitor` `VITE_PUBLIC_NOTIFY_URL` host so native WebView is same-origin with the API (avoids CORS / “Failed to fetch”). */
const API_HOST = (() => {
  try {
    const raw =
      process.env.VITE_PUBLIC_NOTIFY_URL?.trim() ||
      process.env.CAPACITOR_API_HOST?.trim() ||
      'https://finance.solofi.cloud/v1/notify';
    return new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname;
  } catch {
    return 'finance.solofi.cloud';
  }
})();

const config: CapacitorConfig = {
  appId: 'cloud.solofi.finance',
  appName: 'Our Finance',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: API_HOST,
  },
};

export default config;
