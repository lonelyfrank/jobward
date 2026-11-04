import { defineConfig } from 'drizzle-kit';

// Le migrazioni vengono GENERATE da drizzle-kit e APPLICATE da `wrangler d1 migrations apply`.
// drizzle-kit non si connette mai al database: serve solo per produrre SQL versionato.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema.ts',
  out: './migrations',
});
