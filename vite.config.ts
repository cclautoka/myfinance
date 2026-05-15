import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

// https://vite.dev/config/
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8787';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts')) return 'recharts';
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'react-vendor';
        },
      },
    },
  },
  server: {
    proxy: {
      '/v1': { target: apiProxyTarget, changeOrigin: true },
    },
  },
  define: {
    __BUILD_SHA__: JSON.stringify(
      process.env.DOKPLOY_GIT_SHA ??
        process.env.GITHUB_SHA ??
        (() => {
          try {
            return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
              .toString('utf8')
              .trim();
          } catch {
            return 'dev';
          }
        })(),
    ),
    __BUILD_TIME_ISO__: JSON.stringify(new Date().toISOString()),
  },
});
