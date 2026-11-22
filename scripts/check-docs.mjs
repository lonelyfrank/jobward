#!/usr/bin/env node
/**
 * Controllo della documentazione (ADR-0018, docs/agents/MEMORY-SYSTEM.md):
 *  1. limiti di dimensione dei file di bootstrap letti a ogni sessione (L0, L1, L3);
 *  2. limite per singolo documento e per immagine, e peso totale delle immagini in docs/;
 *  3. collegamenti relativi validi in ogni Markdown (file e immagini; le ancore non si controllano);
 *  4. nessun riferimento alle cartelle storiche rimosse dalla repository.
 * Esce con codice 1 e un elenco di errori se qualcosa non va.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KB = 1024;

/** Limiti in byte: ~3,7 byte per token per l'italiano. */
const BUDGETS = [
  { label: 'L0 (AGENTS.md + CLAUDE.md)', files: ['AGENTS.md', 'CLAUDE.md'], max: 4500 },
  { label: 'L1 (CONTEXT-ROUTER)', files: ['docs/agents/CONTEXT-ROUTER.md'], max: 5500 },
  { label: 'L3 (CURRENT-CONTEXT)', files: ['docs/agents/CURRENT-CONTEXT.md'], max: 3000 },
];
const MAX_DOC = 60 * KB;
const MAX_IMAGE = 400 * KB;
const MAX_IMAGES_TOTAL = 4 * 1024 * KB;
const IMAGE = /\.(png|jpe?g|webp|gif|svg)$/i;

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.wrangler',
  'dist',
  'playwright-report',
  'test-results',
  '.e2e-state',
  '.e2e-state-preview',
]);
/** Cartelle rimosse con ADR-0018: non devono ricomparire, né come file né come riferimento. */
const ARCHIVED =
  /docs\/(?:m0h|m1|m2|m25|m3|m3-ui1|m3-ui2|m4)\/|roadmap\/sw10-|roadmap\/m0-delivery\.md/;
const ARCHIVED_DIRS = ['m0h', 'm1', 'm2', 'm25', 'm3', 'm3-ui1', 'm3-ui2', 'm4'];
/** Gli unici file che nominano l'archivio, per descriverlo. */
const ARCHIVE_DESCRIBERS = new Set([
  'docs/history/README.md',
  'docs/architecture/decisions/0018-launch-repository-and-docs-archive.md',
  'scripts/check-docs.mjs',
]);
const SOURCE = /\.(md|ts|tsx|mjs|js|jsonc?|css|ya?ml)$|(^|\/)_headers$/;

const errors = [];
const rel = (path) => relative(root, path).split('\\').join('/');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

// 1. Bootstrap
for (const budget of BUDGETS) {
  const size = budget.files.reduce((sum, file) => sum + statSync(join(root, file)).size, 0);
  if (size > budget.max) {
    errors.push(`${budget.label}: ${size} byte, limite ${budget.max}. Accorcia o sposta in L2.`);
  }
}

const files = walk(root);

// 2. Dimensioni in docs/
let imagesTotal = 0;
for (const path of files) {
  const name = rel(path);
  if (!name.startsWith('docs/')) continue;
  const { size } = statSync(path);
  if (name.endsWith('.md') && size > MAX_DOC) {
    errors.push(`${name}: ${Math.round(size / KB)} KB, limite ${MAX_DOC / KB} KB per documento.`);
  }
  if (IMAGE.test(name)) {
    imagesTotal += size;
    if (size > MAX_IMAGE) {
      errors.push(`${name}: immagine di ${Math.round(size / KB)} KB, limite ${MAX_IMAGE / KB} KB.`);
    }
  }
}
if (imagesTotal > MAX_IMAGES_TOTAL) {
  errors.push(`Immagini in docs/: ${Math.round(imagesTotal / KB)} KB in totale, limite 4 MB.`);
}
for (const dir of ARCHIVED_DIRS) {
  if (existsSync(join(root, 'docs', dir)))
    errors.push(`docs/${dir}/ esiste: archiviata da ADR-0018.`);
}

// 3. Collegamenti relativi e 4. riferimenti all'archivio
const LINK = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
for (const path of files) {
  const name = rel(path);
  if (!SOURCE.test(name)) continue;
  const text = readFileSync(path, 'utf8');

  if (!ARCHIVE_DESCRIBERS.has(name)) {
    text.split('\n').forEach((line, index) => {
      if (ARCHIVED.test(line)) {
        errors.push(`${name}:${index + 1}: rimanda all'archivio storico (ADR-0018).`);
      }
    });
  }

  if (!name.endsWith('.md')) continue;
  const withoutCode = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const match of withoutCode.matchAll(LINK)) {
    const target = match[1];
    if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target)) continue;
    const file = decodeURIComponent(target.split('#')[0].split('?')[0]);
    if (!file) continue;
    if (!existsSync(resolve(dirname(path), file))) {
      errors.push(`${name}: collegamento rotto → ${target}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Controllo documentazione: ${errors.length} problemi`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log('Documentazione: limiti, collegamenti e archivio OK');
