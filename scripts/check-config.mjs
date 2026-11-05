// Invarianti di sicurezza della configurazione Cloudflare. Gira in CI e in `pnpm check`:
// una modifica pericolosa al livello di PRODUZIONE di wrangler.jsonc fa fallire il controllo.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

/** Parser JSONC minimale: toglie commenti (rispettando le stringhe) e virgole finali. */
function parseJsonc(text) {
  let out = '',
    i = 0,
    inStr = false;
  while (i < text.length) {
    const c = text[i],
      n = text[i + 1];
    if (inStr) {
      out += c;
      if (c === '\\') {
        out += n;
        i += 2;
        continue;
      }
      if (c === '"') inStr = false;
      i++;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && n === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

const errors = [];
const expect = (cond, msg) => {
  if (!cond) errors.push(msg);
};

const cfg = parseJsonc(fs.readFileSync(path.join(root, 'apps/api/wrangler.jsonc'), 'utf8'));
const prod = cfg.vars ?? {};

// --- Produzione (livello superiore): fail-closed, nessun accesso senza Cloudflare Access.
expect(prod.ENVIRONMENT === 'production', 'produzione: ENVIRONMENT deve essere "production"');
expect(prod.AUTH_MODE === 'access', 'produzione: AUTH_MODE deve essere "access" (mai "dev")');
for (const k of ['OWNER_EMAIL', 'ACCESS_TEAM_DOMAIN', 'ACCESS_AUD']) {
  expect(
    prod[k] === '',
    `produzione: ${k} deve restare vuoto nel repo (si imposta al deploy, fail-closed finché manca)`,
  );
}
expect(!('DEV_USER_EMAIL' in prod), 'produzione: DEV_USER_EMAIL non deve esistere');
expect(!('APP_ORIGIN' in prod), 'produzione: APP_ORIGIN non è previsto (stessa origine)');
expect(
  cfg.workers_dev === false,
  'produzione: workers_dev deve essere false (Access non protegge *.workers.dev)',
);
expect(cfg.preview_urls === false, 'produzione: preview_urls deve essere false');
expect(
  cfg.assets?.not_found_handling === 'single-page-application',
  'assets: fallback SPA richiesto',
);
expect(
  JSON.stringify(cfg.assets?.run_worker_first) === '["/api/*"]',
  'assets: run_worker_first deve essere ["/api/*"] (le API passano dal Worker, gli asset no)',
);
expect(
  cfg.d1_databases?.some((d) => d.binding === 'DB'),
  'D1: binding "DB" mancante',
);
expect(
  !(cfg.vars && Object.keys(cfg.vars).some((k) => /SECRET|PASSWORD|TOKEN|KEY/i.test(k))),
  'nessun segreto nelle vars (usare wrangler secret)',
);

// --- Ambienti locali: mai identità di sviluppo con ENVIRONMENT diverso da development.
const envs = cfg.env ?? {};
expect(
  JSON.stringify(Object.keys(envs).sort()) === '["dev","preview"]',
  `ambienti ammessi: dev, preview (trovati: ${Object.keys(envs)})`,
);
for (const [name, e] of Object.entries(envs)) {
  expect(
    e.vars?.ENVIRONMENT === 'development',
    `env.${name}: ENVIRONMENT deve essere "development"`,
  );
  expect(e.vars?.AUTH_MODE === 'dev', `env.${name}: AUTH_MODE deve essere "dev"`);
  for (const d of e.d1_databases ?? []) {
    expect(
      /^local-/.test(d.database_id),
      `env.${name}: database_id deve iniziare con "local-" (mai un ID reale)`,
    );
  }
}
expect(
  Boolean(envs.preview?.assets),
  'env.preview: assets richiesti (anteprima della build di produzione)',
);
// `assets` è ereditato dal livello superiore: se env.dev non lo ridefinisce, Wrangler richiede la build
// (apps/web/dist) anche in sviluppo e fallisce su un clone pulito o in un job CI senza build.
expect(
  Boolean(envs.dev?.assets),
  'env.dev: deve ridefinire `assets` (altrimenti eredita ../web/dist e richiede la build)',
);
expect(
  !/web\/dist/.test(envs.dev?.assets?.directory ?? ''),
  'env.dev: assets.directory non deve puntare alla build (apps/web/dist)',
);
expect(
  fs.existsSync(path.resolve(root, 'apps/api', envs.dev?.assets?.directory ?? 'inesistente')),
  'env.dev: assets.directory deve esistere nel repo (senza build)',
);

// --- Il placeholder D1 di produzione non deve sembrare un ID reale.
expect(
  cfg.d1_databases?.every((d) => /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(d.database_id)),
  'D1 di produzione: database_id deve restare il segnaposto finché non si crea il database',
);

// --- Nessun file con segreti tracciato.
const tracked = fs.existsSync(path.join(root, '.gitignore'))
  ? fs.readFileSync(path.join(root, '.gitignore'), 'utf8')
  : '';
for (const pattern of ['.dev.vars', '.env'])
  expect(tracked.includes(pattern), `.gitignore deve ignorare ${pattern}`);

if (errors.length) {
  console.error(
    '✖ Configurazione Cloudflare non conforme:\n' + errors.map((e) => '  - ' + e).join('\n'),
  );
  process.exit(1);
}
console.log('Configurazione Cloudflare: invarianti di sicurezza OK');
