import { defineConfig, devices } from '@playwright/test';

/**
 * Anteprima della BUILD di produzione: Worker + Static Assets (stesso percorso di deploy),
 * con identità di sviluppo e D1 locale. Verifica ciò che `vite dev` non mostra: header e CSP
 * reali, fallback SPA, instradamento /api/*. Richiede `pnpm --filter @jobward/web build`.
 */
const PORT = Number(process.env['PREVIEW_PORT'] ?? 8797);
const API = 'pnpm --filter @jobward/api exec wrangler';
const STATE = '../../.e2e-state-preview';

export default defineConfig({
  testDir: './e2e-preview',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI']
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report-preview' }]]
    : 'list',
  outputDir: 'test-results-preview',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    cwd: '../..',
    command: `rm -rf .e2e-state-preview && ${API} d1 migrations apply DB --local --env preview --persist-to ${STATE} && ${API} dev --env preview --port ${PORT} --persist-to ${STATE}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
