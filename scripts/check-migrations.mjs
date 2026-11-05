// Verifica che le migrazioni committate corrispondano allo schema TypeScript.
// Esegue `drizzle-kit generate` su una COPIA temporanea della cartella migrazioni (nessuna
// modifica al repo): se genererebbe una nuova migrazione, lo schema è cambiato senza migrazione.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dbPkg = path.join(root, 'packages/database');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-migrations-'));
fs.cpSync(path.join(dbPkg, 'migrations'), path.join(tmp, 'migrations'), { recursive: true });
const config = path.join(tmp, 'drizzle.config.mjs');
// drizzle-kit risolve schema e out RELATIVAMENTE alla cartella del package (antepone "./").
const rel = (p) => path.relative(dbPkg, p);
fs.writeFileSync(
  config,
  `export default { dialect: 'sqlite', schema: ${JSON.stringify('./src/schema.ts')}, out: ${JSON.stringify(rel(path.join(tmp, 'migrations')))} };\n`,
);

const run = (args) =>
  spawnSync('pnpm', ['--filter', '@jobward/database', 'exec', 'drizzle-kit', ...args], {
    cwd: root,
    encoding: 'utf8',
  });

const gen = run(['generate', '--config', config, '--name', 'drift_check']);
const out = `${gen.stdout}${gen.stderr}`;
const added = fs
  .readdirSync(path.join(tmp, 'migrations'))
  .filter((f) => f.endsWith('.sql') && f.includes('drift_check'));
fs.rmSync(tmp, { recursive: true, force: true });

if (gen.status !== 0 || added.length > 0 || !/No schema changes/.test(out)) {
  console.error(
    '✖ Lo schema (packages/database/src/schema.ts) non corrisponde alle migrazioni committate.',
  );
  console.error(
    '  Esegui `pnpm db:generate`, rivedi l’SQL (D1 non supporta PRAGMA foreign_keys) e committa la migrazione.',
  );
  console.error(out.split('\n').slice(-8).join('\n'));
  process.exit(1);
}

const check = run(['check']);
if (check.status !== 0) {
  console.error('✖ drizzle-kit check ha rilevato incoerenze tra migrazioni e snapshot:');
  console.error(`${check.stdout}${check.stderr}`);
  process.exit(1);
}
console.log('Migrazioni coerenti con lo schema: OK');
