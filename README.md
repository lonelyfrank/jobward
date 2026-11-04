# Meet Roulette

**Il workspace del candidato per organizzare la ricerca del lavoro.**

Meet Roulette aiuta chi cerca lavoro a raccogliere le opportunità, organizzarle in bacheche con colonne
personalizzabili, tenere traccia di candidature, colloqui e contatti, e capire a che punto è la propria ricerca.
È uno strumento **per il candidato**: non pubblica offerte, non è un social network professionale, non è un
ATS per recruiter e non invia candidature al posto tuo. Funziona per qualsiasi settore.

## Problemi che risolve

- Le offerte interessanti sono sparse tra link, email, note e screenshot.
- Dopo qualche settimana non è più chiaro a chi si è scritto, quando e con quale risposta.
- Gli strumenti generici (fogli di calcolo, board Kanban) non distinguono la _posizione_ di una scheda dall'_esito_ di una candidatura, e rendono difficile ogni statistica.
- Dimenticare un follow-up costa un'opportunità.

## Stato effettivo del progetto

**Milestone corrente: M0 — Foundation & Initial Workspace**, consolidata da **M0.H — Hardening** (branch `m0h-hardening`, in attesa di revisione).

M0.H ha verificato la baseline, eseguito audit di sicurezza, database, frontend e deployabilità, e corretto i difetti trovati (isolamento tra workspace nel database, header e cache degli asset, accessibilità del drawer e del menu, e altri): [`docs/m0h/delivery.md`](docs/m0h/delivery.md). **Non è "production ready"**: Cloudflare Access reale e la CI su GitHub non sono ancora stati provati.

| Area                                                           | Stato                                                       |
| -------------------------------------------------------------- | ----------------------------------------------------------- |
| Monorepo, tooling, CI                                          | ✅ Implementato                                             |
| Schema database completo + migrazioni                          | ✅ Implementato e testato su D1                             |
| API: health, `me`, workspace (lista/creazione), overview       | ✅ Implementate, protette, testate                          |
| Accesso privato del proprietario (Cloudflare Access)           | ✅ Implementato e testato; **da configurare** per il deploy |
| App shell, design system, tema chiaro/scuro, responsive        | ✅ Implementato                                             |
| Onboarding (creazione workspace)                               | ✅ Funzionante                                              |
| Overview con dati reali (a zero finché non ci sono schede)     | ✅ Funzionante                                              |
| Impostazioni (tema, info workspace/account)                    | ✅ Funzionanti                                              |
| **Bacheche, colonne, schede, Kanban, drag & drop**             | ⏳ **M1** — non ancora disponibili                          |
| Campi professionali, etichette, filtri, ricerca, vista tabella | ⏳ M2                                                       |
| Attività, scadenze, cronologia                                 | ⏳ M3                                                       |
| Insights, esportazione dati, deploy privato                    | ⏳ M4                                                       |

Le funzioni non ancora disponibili sono mostrate come tali nell'interfaccia (badge _"In arrivo · Mx"_ e
controlli disabilitati): nessuna di esse simula un comportamento. Non esistono dati dimostrativi: l'app
parte vuota e ogni numero deriva dal database.

Dettagli: [`docs/roadmap/m0-delivery.md`](docs/roadmap/m0-delivery.md) · [`docs/m0h/delivery.md`](docs/m0h/delivery.md).

## Stack

| Livello  | Tecnologie                                                                                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend | React 19, TypeScript (strict), Vite, React Router, Tailwind CSS 4, Radix UI, Lucide, TanStack Query, React Hook Form, Zod                                         |
| Backend  | Cloudflare Workers, Hono, Zod, jose (verifica JWT)                                                                                                                |
| Database | Cloudflare D1 (SQLite), Drizzle ORM, migrazioni SQL versionate                                                                                                    |
| Qualità  | Vitest, React Testing Library, `@cloudflare/vitest-plugin` (test nel runtime Workers), Playwright + axe, ESLint (type-aware + jsx-a11y), Prettier, GitHub Actions |

Le versioni e i vincoli di compatibilità sono motivati in [`pnpm-workspace.yaml`](pnpm-workspace.yaml) e in
[ADR-0002](docs/architecture/decisions/0002-stack-and-versions.md). dnd-kit e R2 non sono installati: arrivano con M1.

## Requisiti per lo sviluppo locale

- **Node.js ≥ 22.22** (vedi `.nvmrc`)
- **pnpm 12** (`corepack enable` oppure `npm i -g pnpm`)
- Nessun account Cloudflare è necessario: D1 gira in locale tramite Miniflare/Wrangler.
- Per gli E2E: Chromium di Playwright (`pnpm --filter @meet-roulette/web exec playwright install chromium`).

## Installazione e avvio

```bash
pnpm install

# 1. Applica le migrazioni al database D1 locale (crea apps/api/.wrangler/state)
pnpm db:migrate:local

# 2. Avvia API e frontend insieme…
pnpm dev
# …oppure separatamente, in due terminali:
pnpm dev:api    # Worker su http://localhost:8787  (wrangler dev --env dev)
pnpm dev:web    # Frontend su http://localhost:5173 (proxy /api → 8787)
```

Apri <http://localhost:5173>. Al primo avvio vedrai l'onboarding: crea il workspace e arriverai all'Overview.
Per ripartire da zero cancella `apps/api/.wrangler/state` e rilancia `pnpm db:migrate:local`.

## Configurazione e variabili d'ambiente

**Nessun segreto è presente nella repository né raggiunge il frontend.** Le variabili del Worker sono in
[`apps/api/wrangler.jsonc`](apps/api/wrangler.jsonc):

| Variabile            | Produzione (default) | Sviluppo (`--env dev`)    | Note                                                    |
| -------------------- | -------------------- | ------------------------- | ------------------------------------------------------- |
| `ENVIRONMENT`        | `production`         | `development`             |                                                         |
| `AUTH_MODE`          | `access`             | `dev`                     | `dev` è rifiutata se non su `localhost` e `development` |
| `OWNER_EMAIL`        | _da impostare_       | —                         | Unico account ammesso in produzione                     |
| `ACCESS_TEAM_DOMAIN` | _da impostare_       | —                         | Es. `miotuo.cloudflareaccess.com`                       |
| `ACCESS_AUD`         | _da impostare_       | —                         | Audience tag dell'applicazione Access                   |
| `DEV_USER_EMAIL`     | —                    | `dev@meet-roulette.local` | Identità fittizia locale                                |
| `APP_ORIGIN`         | —                    | `http://localhost:5173`   | Origine aggiuntiva ammessa dalla protezione CSRF        |

Con i valori di produzione vuoti l'API **rifiuta ogni richiesta** (fail-closed: provato anche eseguendo la configurazione di produzione su workerd).
`workers_dev` e `preview_urls` sono disattivati in produzione (Access non protegge `*.workers.dev`): il deploy richiede un **dominio personalizzato**.
L'ambiente `preview` (`wrangler dev --env preview`) serve la build di produzione con identità di sviluppo, per le prove locali. Il deploy non fa parte di M0;
la procedura è in [`docs/architecture/authentication.md`](docs/architecture/authentication.md).

## Migrazioni del database

Lo schema vive in [`packages/database/src/schema.ts`](packages/database/src/schema.ts).

```bash
pnpm db:generate            # genera una nuova migrazione SQL in packages/database/migrations
pnpm db:migrate:local       # la applica al D1 locale
```

Le migrazioni generate vanno **riviste e committate**. Non si modificano migrazioni già applicate: se ne crea una nuova.
**D1 non supporta `PRAGMA foreign_keys`**: se drizzle-kit propone di ricreare una tabella, l'SQL va riscritto a mano (esempio e guardia di sicurezza in `0001_tenant_integrity.sql`). `pnpm db:check` fallisce se lo schema diverge dalle migrazioni.
Vedi [`docs/architecture/database.md`](docs/architecture/database.md).

## Test e quality gate

```bash
pnpm typecheck        # TypeScript strict su tutti i package
pnpm lint             # ESLint (type-aware, hooks, a11y), zero warning ammessi
pnpm format:check     # Prettier
pnpm check:contrast   # contrasto WCAG dei token colore, tema chiaro e scuro
pnpm check:config     # invarianti di sicurezza della configurazione Cloudflare (wrangler.jsonc)
pnpm db:check         # schema TypeScript coerente con le migrazioni committate
pnpm test             # unit + integrazione (shared, schemas, API nel runtime Workers, web)
pnpm build            # build frontend + dry-run di pacchettizzazione del Worker
pnpm test:e2e         # Playwright su stack di sviluppo (porte 5199/8799, DB pulito a ogni esecuzione)
pnpm test:preview     # Playwright sulla BUILD di produzione servita da Static Assets (porta 8797):
                      # header, CSP reale, fallback SPA, instradamento /api/*
pnpm check            # typecheck + lint + format + contrasto + config + db + test + build
```

## Struttura della repository

```text
meet-roulette/
├── apps/
│   ├── web/                 # SPA React (Vite)
│   │   ├── src/app/         #   provider e router
│   │   ├── src/components/  #   ui/ (design system), brand/
│   │   ├── src/features/    #   workspace/ (gate, onboarding), overview/
│   │   ├── src/layouts/     #   AppShell, Sidebar, Topbar
│   │   ├── src/routes/      #   schermate
│   │   ├── src/lib/         #   client API, tema, formattazione
│   │   └── e2e/             #   test Playwright
│   └── api/                 # Worker Hono
│       ├── src/modules/     #   rotte per risorsa (health, me, workspaces, overview)
│       ├── src/services/    #   logica di dominio e accesso ai dati
│       ├── src/middleware/  #   auth, CSRF, limiti, errori, log
│       └── test/            #   test di integrazione nel runtime Workers
├── packages/
│   ├── database/            # schema Drizzle + migrazioni SQL
│   ├── schemas/             # schemi Zod (contratti API, validazione dominio)
│   └── shared/              # costanti di dominio, template di bacheca, codici d'errore
├── docs/                    # architettura, prodotto, UX, roadmap
├── scripts/                 # strumenti di verifica (contrasto colori)
└── .github/workflows/       # CI
```

## Documentazione

- Architettura: [`docs/architecture/overview.md`](docs/architecture/overview.md) · [database](docs/architecture/database.md) · [autenticazione](docs/architecture/authentication.md) · [decisioni (ADR)](docs/architecture/decisions/)
- Prodotto: [visione](docs/product/vision.md) · [requisiti](docs/product/requirements.md) · [modello di dominio](docs/product/domain-model.md) · [user stories](docs/product/user-stories.md)
- UX: [architettura dell'informazione](docs/ux/information-architecture.md) · [design system](docs/ux/design-system.md) · [schermate](docs/ux/screens.md)
- Roadmap: [milestone](docs/roadmap/milestones.md) · [consegna M0](docs/roadmap/m0-delivery.md) · [backlog](docs/roadmap/backlog.md)
- Hardening M0.H: [consegna](docs/m0h/delivery.md) · [registro dei problemi](docs/m0h/issue-register.md) · [baseline](docs/m0h/audit-baseline.md) · [sicurezza](docs/m0h/security-audit.md) · [database](docs/m0h/database-audit.md) · [frontend](docs/m0h/frontend-audit.md) · [test](docs/m0h/testing-report.md) · [readiness Cloudflare](docs/m0h/cloudflare-readiness.md)
