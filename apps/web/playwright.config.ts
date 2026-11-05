import { defineConfig, devices } from '@playwright/test';

/**
 * E2E su stack reale: browser → Vite (proxy) → Worker (wrangler dev) → D1 locale.
 * Il database parte pulito a ogni esecuzione (.e2e-state viene ricreato), quindi i
 * test non dipendono da dati preesistenti. Nessun dato reale, nessun servizio remoto.
 */
const API = 'pnpm --filter @meet-roulette/api exec wrangler';
const STATE = '../../.e2e-state';
// Porte dedicate: non collidono con i server di sviluppo già attivi (5173/8787).
const WEB_PORT = Number(process.env['E2E_WEB_PORT'] ?? 5199);
const API_PORT = Number(process.env['E2E_API_PORT'] ?? 8799);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  // In CI il primo caricamento a freddo di Vite (ottimizzazione delle dipendenze) può superare i
  // 5 s predefiniti: il primo test risultava "flaky" (M2-00). Più margine, non meno controlli.
  expect: { timeout: process.env['CI'] ? 15_000 : 5_000 },
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      cwd: '../..',
      command: `rm -rf .e2e-state && ${API} d1 migrations apply DB --local --env dev --persist-to ${STATE} && ${API} dev --env dev --port ${API_PORT} --var APP_ORIGIN:http://localhost:${WEB_PORT} --persist-to ${STATE}`,
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      cwd: '../..',
      command: `pnpm --filter @meet-roulette/web exec vite --port ${WEB_PORT} --strictPort`,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
