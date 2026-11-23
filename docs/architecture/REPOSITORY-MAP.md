# Mappa della repository

**Stato:** canonico · **Verificato su:** `jobward-v1` `b34c032` (2026-11-22, PID-01). Dove si trova che cosa. Moduli, invarianti e test per sottosistema: [CHANGE-IMPACT](CHANGE-IMPACT.md). Per il perché: [overview](overview.md) e [ADR](decisions/README.md).

## Monorepo (pnpm workspace, monolite modulare — [ADR-0001](decisions/0001-modular-monolith-monorepo.md))

```text
jobward/
├── AGENTS.md / CLAUDE.md        bootstrap per agenti (L0)
├── README.md                    ingresso del progetto
├── apps/
│   ├── web/                     SPA React 19 (Vite 8) — @jobward/web
│   │   ├── src/app/             provider (TanStack Query) e router (react-router, tabella di rotte nel codice)
│   │   ├── src/routes/          schermate: overview, boards, board(+kanban/table), pipeline, opportunities, companies, company,
│   │   │                        tasks, calendar, insights, settings, profile, help, not-found
│   │   ├── src/features/        per dominio: applications, boards, calendar, cards, companies, custom-fields, documents,
│   │   │                        export, insights, interviews, kanban, labels, notes, opportunities (+ map/), overview,
│   │   │                        pipeline, pipeline-board, places, saved-views, tasks, timeline, workspace
│   │   ├── src/components/ui/   design system (dialog, button, menu, tabs, notices, …)
│   │   ├── src/layouts/         AppShell, Sidebar, menu utente, navigazione (nessuna topbar)
│   │   ├── src/lib/             client API, tema, storage, formattazione, salario, sfondi
│   │   ├── src/styles/          token CSS (index.css), Glass (glass.css), bacheca (board.css)
│   │   ├── public/              _headers (CSP), theme-init.js, sfondi, favicon
│   │   ├── e2e/                 Playwright sullo stack di sviluppo (23 spec)
│   │   └── e2e-preview/         Playwright sulla build di produzione (1 spec)
│   └── api/                     Worker Cloudflare con Hono — @jobward/api
│       ├── src/app.ts           catena dei middleware e montaggio delle rotte
│       ├── src/modules/<risorsa>/routes.ts   rotte HTTP (21 moduli)
│       ├── src/services/        logica di dominio e SQL (29 file)
│       ├── src/middleware/      auth, guards (CSRF, payload), request (header, log), workspace (tenancy), errors
│       ├── src/lib/             verifica JWT Access, errori, validazione Zod
│       ├── test/                Vitest nel runtime Workers su D1 reale (35 file)
│       ├── wrangler.jsonc       produzione (inerte, fail-closed), env dev, env preview
│       ├── wrangler.test.jsonc  binding di test (DB)
├── packages/
│   ├── database/                schema Drizzle (src/schema.ts) + migrazioni 0000_jobward_v1, 0001_companies, 0002_saved_views — @jobward/database
│   ├── schemas/                 contratti Zod di input/output dell'API — @jobward/schemas
│   └── shared/                  dominio puro senza dipendenze: costanti, pipeline e transizioni, ordinamento,
│                                attività e suggerimenti, timeline, colloqui, template, smart-query/smart-filter,
│                                insights, aziende — @jobward/shared
├── scripts/                     verifiche, reset e dati demo (vedi sotto)
├── docs/                        documentazione — indice in docs/INDEX.md
└── .github/workflows/ci.yml     CI: job quality + job e2e (PR e push verso main)
```

## Dipendenze tra pacchetti

```text
apps/web  ──► @jobward/schemas, @jobward/shared
apps/api  ──► @jobward/schemas, @jobward/shared, @jobward/database
@jobward/database ──► @jobward/shared (vocabolari per i CHECK)
```

## Script (`scripts/`)

| Script                                           | Comando                                      | Scopo ed effetti                                                                                                                                                                                |
| ------------------------------------------------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-contrast.mjs`                             | `pnpm check:contrast`                        | Contrasto WCAG dei token colore, tema chiaro e scuro; sola lettura                                                                                                                              |
| `check-docs.mjs`                                 | `pnpm check:docs`                            | Limiti di dimensione (L0/L1/L3, documenti, immagini), collegamenti relativi, nessun rimando all'archivio; sola lettura                                                                          |
| `check-migrations.mjs`                           | `pnpm db:check`                              | Schema TypeScript coerente con gli SQL (`drizzle-kit` su copia temporanea); non vede trigger e viste                                                                                            |
| `db-reset-local.mjs`                             | `pnpm db:reset:local -- --yes`               | **Cancella** tutto `apps/api/.wrangler/state` del checkout e riapplica le migrazioni; senza `--yes` si rifiuta                                                                                  |
| `seed-demo.mjs`                                  | `pnpm db:seed:demo`                          | Rigenera il profilo Dati demo tramite `POST /api/v1/demo/reset` sull'API avviata; non tocca i dati reali                                                                                        |
| `apps/web/scripts/capture-guide-screenshots.mjs` | `pnpm docs:screenshots`                      | Rigenera i Dati demo e salva le schermate della guida in `docs/user/images/`; richiede `pnpm dev`                                                                                               |
| `apps/web/scripts/build-europe-map.mjs`          | `node apps/web/scripts/build-europe-map.mjs` | Rigenera i confini incorporati della vista Mappa (`map/europe-map.json`) da Natural Earth (`world-atlas`, dipendenza di sviluppo); nessuna rete ([ADR-0019](decisions/0019-opportunity-map.md)) |

Gli strumenti di staging, di marchio e di upgrade delle migrazioni sono stati rimossi in v1 ([ADR-0017](decisions/0017-local-v1-baseline.md)) e restano nella storia git.

## Dove intervenire (scorciatoie)

| Voglio cambiare…       | File di partenza                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| una rotta API          | `apps/api/src/modules/<risorsa>/routes.ts` → `apps/api/src/services/<risorsa>.ts` → `packages/schemas/src/<risorsa>.ts` |
| una regola di dominio  | `packages/shared/src/` (funzione pura + test accanto)                                                                   |
| lo schema del database | `packages/database/src/schema.ts` + nuova migrazione (vedi [database.md](database.md#migrazioni))                       |
| una schermata          | `apps/web/src/routes/` → `apps/web/src/features/<dominio>/`                                                             |
| un componente base     | `apps/web/src/components/ui/`                                                                                           |
| un token visivo        | `apps/web/src/styles/index.css` (poi `pnpm check:contrast`)                                                             |
| la CSP o gli header    | `apps/web/public/_headers` e `apps/api/src/middleware/request.ts`                                                       |
