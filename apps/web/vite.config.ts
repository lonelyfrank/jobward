import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 5173,
    // In sviluppo l'API gira in `wrangler dev` (porta 8787): il proxy mantiene
    // la stessa origine per il browser, come in produzione.
    proxy: { '/api': process.env['API_PROXY_TARGET'] ?? 'http://localhost:8787' },
  },
  build: {
    sourcemap: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          // Vendor stabili (cambiano solo con gli aggiornamenti delle dipendenze) separati dal
          // codice dell'app: dopo un deploy il browser rivalida (304) ciò che non è cambiato.
          groups: [
            {
              name: 'vendor-react',
              test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // Test di navigazione con più passaggi: sotto carico superano i 5 s predefiniti.
    testTimeout: 20_000,
  },
});
