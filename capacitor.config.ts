import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Keep default WebView host (localhost). Do not set `server.hostname` to the API
 * domain — Capacitor can intercept same-host fetches and break auth; use absolute
 * `VITE_PUBLIC_NOTIFY_URL` in `.env.capacitor` plus server CORS instead.
 */
const config: CapacitorConfig = {
  appId: 'cloud.solofi.finance',
  appName: 'Our Finance',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
};

export default config;
