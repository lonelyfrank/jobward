#!/usr/bin/env node
// Azzera il database D1 LOCALE di sviluppo di questo checkout e riapplica le migrazioni.
// ATTENZIONE: il D1 locale contiene anche i DATI REALI del proprietario (identità dev). Prima di
// cancellare ne viene fatta una copia in `apps/api/.wrangler/backups/`. Richiede `--yes`.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wrangler = path.join(root, 'apps/api/.wrangler');
const state = path.join(wrangler, 'state');

if (!process.argv.includes('--yes')) {
  console.error(`Questo comando CANCELLA il database locale in ${state},`);
  console.error('compresi i dati reali inseriti nell’app (ne viene fatta prima una copia).');
  console.error('Per i soli dati demo non serve: usa Impostazioni → Dati demo → Rigenera.');
  console.error('Rilancia con: pnpm db:reset:local -- --yes');
  process.exit(1);
}
if (fs.existsSync(state)) {
  const stamp = new Date().toISOString().replaceAll(':', '-').replace(/\..+$/, '');
  const backup = path.join(wrangler, 'backups', `state-${stamp}`);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.cpSync(state, backup, { recursive: true });
  console.log(`Copia del database precedente: ${path.relative(root, backup)}`);
  console.log(
    `Per ripristinarla: ferma l'app, poi sostituisci ${path.relative(root, state)} con la copia.`,
  );
}
fs.rmSync(state, { recursive: true, force: true });
const run = spawnSync('pnpm', ['--filter', '@jobward/api', 'db:migrate:local'], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(run.status ?? 1);
