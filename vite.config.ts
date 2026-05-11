import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
