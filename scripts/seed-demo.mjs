#!/usr/bin/env node
// Rigenera i DATI DEMO (profilo «Dati demo» di Impostazioni) tramite l'API locale in esecuzione.
// Agisce solo sull'identità demo (DEMO_USER_EMAIL): i dati reali dell'identità dev non vengono toccati.
// Equivale al pulsante «Rigenera dati demo». Richiede `pnpm dev` (o `pnpm dev:api`) avviato.
// Uso: `pnpm db:seed:demo` · API diversa: `JOBWARD_API_URL=http://localhost:8787 pnpm db:seed:demo`.
const base = (process.env.JOBWARD_API_URL ?? 'http://localhost:8787').replace(/\/$/, '');

let res;
try {
  res = await fetch(`${base}/api/v1/demo/reset`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-jobward-profile': 'demo' },
    body: '{}',
  });
} catch {
  console.error(`API non raggiungibile su ${base}. Avvia prima \`pnpm dev\` e riprova.`);
  process.exit(1);
}
if (res.status !== 201) {
  console.error(`Rigenerazione non riuscita (HTTP ${res.status}): ${await res.text()}`);
  console.error('Il profilo demo esiste solo con AUTH_MODE=dev (wrangler --env dev).');
  process.exit(1);
}
const { workspace } = await res.json();
console.log(
  `Dati demo rigenerati: workspace «${workspace.name}». In app: Impostazioni → Dati demo.`,
);
