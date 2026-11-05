import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const problems = [];
for (const [dir, name] of [
  ['.', 'jobward'],
  ['apps/api', '@jobward/api'],
  ['apps/web', '@jobward/web'],
  ['packages/shared', '@jobward/shared'],
  ['packages/schemas', '@jobward/schemas'],
  ['packages/database', '@jobward/database'],
]) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, dir, 'package.json'), 'utf8'));
  if (pkg.name !== name) problems.push(`${dir}: nome pacchetto inatteso`);
}
const ignore = new Set([
  'node_modules',
  'dist',
  '.wrangler',
  'test-results',
  'test-results-preview',
  'playwright-report',
  'playwright-report-preview',
]);
function walk(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const file = path.posix.join(dir, entry.name);
    if (ignore.has(entry.name) || file.startsWith('packages/database/migrations')) continue;
    if (entry.isDirectory()) walk(file);
    else if (/\.(?:tsx?|m?js|jsonc?|ya?ml)$/.test(file) && file !== 'scripts/check-brand.mjs')
      check(file);
  }
}
function check(file) {
  const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
  for (const [index, line] of lines.entries()) {
    if (!/meet[-_ ]?roulette|meetroulette/i.test(line)) continue;
    // Eccezioni persistenti esplicite, non una tolleranza generica per i file di configurazione.
    const persistent =
      file === 'apps/api/wrangler.jsonc' &&
      (/^\s*"database_name": "meet-roulette(?:-local|-preview)?",?\s*$/.test(line) ||
        /^\s*"DEV_USER_EMAIL": "dev@meet-roulette.local",?\s*$/.test(line));
    if (!persistent) problems.push(`${file}:${index + 1}: riferimento legacy non autorizzato`);
  }
}
for (const dir of ['apps', 'packages', 'scripts', '.github']) walk(dir);
for (const file of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.base.json'])
  check(file);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    'Branding: 6 nomi workspace corretti; nessun riferimento legacy attivo fuori dalle eccezioni persistenti',
  );
