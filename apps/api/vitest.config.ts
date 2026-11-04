import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  // Le migrazioni reali del progetto vengono applicate al D1 di test:
  // i test girano sullo stesso schema che arriverà in produzione.
  const migrations = await readD1Migrations(
    path.resolve(import.meta.dirname, '../../packages/database/migrations'),
  );

  return {
    plugins: [
      cloudflareTest({
        // Configurazione dedicata ai test: niente asset statici da costruire.
        wrangler: { configPath: './wrangler.test.jsonc' },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
      }),
    ],
    test: {
      include: ['test/**/*.test.ts'],
      setupFiles: ['./test/setup.ts'],
    },
  };
});
