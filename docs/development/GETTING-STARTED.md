# Primi passi

**Stato:** canonico · Contenuto spostato dal README in JW-CORE-01 (2026-11-21) e verificato su `jobward-v1` `b34c032` (PID-01, 2026-11-22). Guida per chi usa l'app: [docs/user](../user/README.md). Comandi completi in [COMMANDS](COMMANDS.md).

## Requisiti

- **Node.js ≥ 22.22** (`engines` in `package.json`; `.nvmrc` indica solo la major `22`)
- **pnpm 12** (`corepack enable` oppure `npm i -g pnpm`)
- Nessun account Cloudflare: D1 gira in locale tramite Miniflare/Wrangler.
- Per gli E2E: Chromium di Playwright (`pnpm --filter @jobward/web exec playwright install chromium`).

## Installazione e avvio

```bash
pnpm install

# 1. Solo la prima volta: crea il database D1 locale (apps/api/.wrangler/state)
pnpm db:reset:local -- --yes

# 2. Avvia API e frontend insieme…
pnpm dev
# …oppure separatamente, in due terminali:
pnpm dev:api    # Worker su http://localhost:8787  (wrangler dev --env dev)
pnpm dev:web    # Frontend su http://localhost:5174 (proxy /api → 8787)
```

Apri <http://localhost:5174>. Al primo avvio vedrai l'onboarding (identità `dev@jobward.local`, i tuoi dati).

**Dati reali e dati demo.** In sviluppo esistono due profili nello stesso D1 locale, isolati come due utenti diversi: **I miei dati** (`DEV_USER_EMAIL`) e **Dati demo** (`DEMO_USER_EMAIL`, `frank@demo.jobward.local`). Si passa dall'uno all'altro in **Impostazioni → Dati demo**: la scelta resta nel browser (`localStorage`) e il client API invia `x-jobward-profile: demo`. La prima volta il profilo demo viene popolato da `POST /api/v1/demo/reset` (servizio `apps/api/src/services/demo.ts`: ~16 opportunità, candidature in ogni fase, colloqui, attività, note, viste salvate, con date relative a oggi); **Rigenera dati demo** o `pnpm db:seed:demo` (con l'API avviata) lo ricreano da capo. Con Cloudflare Access l'header è ignorato e il selettore non compare.

Per ripartire da zero: `pnpm db:reset:local -- --yes` **cancella anche i dati reali** del checkout; prima ne copia lo stato in `apps/api/.wrangler/backups/`.
La porta del frontend è fissa: se è occupata, Vite si ferma. Per usare una porta diversa, allinea la porta di Vite e `APP_ORIGIN` del Worker dev, così anche i salvataggi mantengono la stessa origine autorizzata.

> **Dati locali persistenti.** `apps/api/.wrangler/state` contiene il database di sviluppo del checkout. Sia nel worktree principale `/home/frank/jobward` sia in `jobward-core-docs` contiene dati personali reali del proprietario (identità dev): non cancellarlo, non aprirlo e non usarlo per prove senza autorizzazione; per le dimostrazioni usa il profilo **Dati demo**. Per esperimenti usa directory temporanee (come fanno gli E2E con `.e2e-state`).

## Configurazione e variabili d'ambiente

**Nessun segreto è presente nella repository né raggiunge il frontend.** Le variabili del Worker sono in
[`apps/api/wrangler.jsonc`](../../apps/api/wrangler.jsonc):

| Variabile            | Livello principale (inerte) | Sviluppo (`--env dev`)     | Note                                                         |
| -------------------- | --------------------------- | -------------------------- | ------------------------------------------------------------ |
| `ENVIRONMENT`        | `production`                | `development`              |                                                              |
| `AUTH_MODE`          | `access`                    | `dev`                      | `dev` è rifiutata se non su `localhost` e `development`      |
| `OWNER_EMAIL`        | _vuota_                     | —                          | Unico account ammesso                                        |
| `ACCESS_TEAM_DOMAIN` | _vuota_                     | —                          | Es. `miotuo.cloudflareaccess.com`                            |
| `ACCESS_AUD`         | _vuota_                     | —                          | Audience tag dell'applicazione Access                        |
| `DEV_USER_EMAIL`     | —                           | `dev@jobward.local`        | Identità locale: i tuoi dati reali                           |
| `DEMO_USER_EMAIL`    | —                           | `frank@demo.jobward.local` | Identità del profilo Dati demo (diversa da `DEV_USER_EMAIL`) |
| `APP_ORIGIN`         | —                           | `http://localhost:5174`    | Origine aggiuntiva ammessa dalla protezione CSRF             |

Con i valori vuoti l'API **rifiuta ogni richiesta** (fail-closed: provato anche eseguendo la configurazione su workerd). Il livello principale ha un identificativo D1 segnaposto: **non esiste un ambiente di produzione**.
`workers_dev` e `preview_urls` sono disattivati (Access non protegge `*.workers.dev`): un deploy richiede un **dominio personalizzato**.
L'ambiente `preview` (`wrangler dev --env preview`) serve la build di produzione con un'identità di sviluppo diversa (`dev@jobward.local`), per le prove locali.
Nessun ambiente remoto nel ciclo corrente: [DEPLOYMENT](DEPLOYMENT.md). Autenticazione: [authentication](../architecture/authentication.md).

## Migrazioni del database

Lo schema vive in [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts).

```bash
pnpm db:generate            # genera una nuova migrazione SQL in packages/database/migrations
pnpm db:migrate:local       # la applica al D1 locale
```

Le migrazioni generate vanno **riviste e committate**. Non si modificano migrazioni già applicate: se ne crea una nuova.
**D1 non supporta `PRAGMA foreign_keys`**: se drizzle-kit propone di ricreare una tabella, l'SQL va riscritto a mano (gli esempi storici sono nella storia git, migrazioni M0–SW.10 precedenti a ADR-0017). `pnpm db:check` fallisce se lo schema diverge dalle migrazioni.
Dalla v1 lo schema parte da un'unica migrazione di base (`0000_jobward_v1.sql`, [ADR-0017](../architecture/decisions/0017-local-v1-baseline.md)); le migrazioni successive sono additive. Un database creato con le vecchie migrazioni va ricreato con `pnpm db:reset:local -- --yes`. Vedi [DATA-MODEL](../architecture/DATA-MODEL.md).
