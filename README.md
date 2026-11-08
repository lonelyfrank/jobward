# Jobward

> **Identità tecnica.** I pacchetti usano `@jobward/*` e i Worker configurati usano nomi Jobward. Per conservare l'accesso ai dati esistenti restano le etichette D1 e l'identità dev già popolata; motivazioni e procedura conservativa in [ADR-0014](docs/architecture/decisions/0014-jobward-technical-rebranding.md). Nessuna risorsa remota è stata rinominata.

**Il workspace del candidato per organizzare la ricerca del lavoro.**

Jobward aiuta chi cerca lavoro a raccogliere le opportunità, organizzarle in bacheche con colonne
personalizzabili, tenere traccia di candidature, colloqui e contatti, e capire a che punto è la propria ricerca.
È uno strumento **per il candidato**: non pubblica offerte, non è un social network professionale, non è un
ATS per recruiter e non invia candidature al posto tuo. Funziona per qualsiasi settore.

## Problemi che risolve

- Le offerte interessanti sono sparse tra link, email, note e screenshot.
- Dopo qualche settimana non è più chiaro a chi si è scritto, quando e con quale risposta.
- Gli strumenti generici (fogli di calcolo, board Kanban) non distinguono la _posizione_ di una scheda dall'_esito_ di una candidatura, e rendono difficile ogni statistica.
- Dimenticare un follow-up costa un'opportunità.

## Stato effettivo del progetto

**Stato corrente (2026-11-08): M3 CODE COMPLETE.** PR #10 integrata con squash su `main` `9a48f0b`; [CI post-merge 42526187028](https://github.com/lonelyfrank/jobward/actions/runs/42526187028) **completed / success: 2/2 job e 13/13 gate verdi**. Evidenze e SHA completi nel [report di stabilizzazione](docs/m3/stabilization/final-report.md).

**RELEASE READY: no.** D1 remoto e Cloudflare Access non verificati in questa chiusura; nessun deploy staging né smoke test reale eseguito. Migrazioni `0000`–`0007` esclusivamente locali. Restano aperti i rischi P2/P3 e i due advisory moderati della toolchain dev; nessuna risoluzione dichiarata senza prove. Evidenze nel [report di stabilizzazione](docs/m3/stabilization/final-report.md) e nel [quality gate](docs/m3/stabilization/quality-gate.md).

[Consegna finale M3](docs/m3/m3-final-delivery.md) · [registro dei problemi](docs/m3/m3-final-issue-register.md) · [progettazione](docs/m3/tasks-index.md).

**M3-C3 è chiusa:** la correzione del test preview (PR #8, causa in [chiusura C3](docs/m3/c3-closure.md)) è in `main` e la CI di `main` sul commit `7bf462e` è verde ([run 42363749545](https://github.com/lonelyfrank/jobward/actions/runs/42363749545)). C3 collega pipeline, note, riferimenti documentali e timeline alle sei schede della modale ([consegna](docs/m3/c3-delivery.md) · [verifiche](docs/m3/c3-testing-report.md), documenti storici).

M2 trasforma il Kanban in uno strumento da **confrontare e personalizzare**: dati professionali completi, fase ed esito indipendenti dalla colonna, campi personalizzati per bacheca, etichette, ricerca e filtri, vista Tabella ([`docs/m2/delivery.md`](docs/m2/delivery.md)). M1 aveva reso l'app **utilizzabile**: si creano bacheche da template, si personalizzano le colonne, si registrano opportunità con il solo titolo, si modificano e si spostano (trascinamento con mouse, tastiera e touch, oppure da menu), si archiviano e si ripristinano, e tutto persiste: [`docs/m1/delivery.md`](docs/m1/delivery.md).

M0.H ha verificato la baseline, eseguito audit di sicurezza, database, frontend e deployabilità, e corretto i difetti trovati (isolamento tra workspace nel database, header e cache degli asset, accessibilità del drawer e del menu, e altri): [`docs/m0h/delivery.md`](docs/m0h/delivery.md). **Non è "production ready"**: Cloudflare Access reale e deploy privato restano da configurare e provare. Lo stato corrente della CI è quello del run M3 indicato sopra; i risultati C2/C3 restano evidenze storiche.

| Area                                                                                                | Stato                                                                                                           |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Monorepo, tooling, CI                                                                               | ✅ Implementato                                                                                                 |
| Schema database completo + migrazioni                                                               | ✅ Implementato e testato su D1                                                                                 |
| API: health, `me`, workspace (lista/creazione), overview                                            | ✅ Implementate, protette, testate                                                                              |
| Accesso privato del proprietario (Cloudflare Access)                                                | ✅ Implementato e testato; **da configurare** per il deploy                                                     |
| App shell, design system, tema chiaro/scuro, responsive                                             | ✅ Implementato                                                                                                 |
| Onboarding (creazione workspace)                                                                    | ✅ Funzionante                                                                                                  |
| Overview con dati reali (a zero finché non ci sono schede)                                          | ✅ Funzionante                                                                                                  |
| Impostazioni (tema, info workspace/account)                                                         | ✅ Funzionanti                                                                                                  |
| **Bacheche** (template, preferite, ordine, eliminazione con conferma)                               | ✅ **M1** — funzionanti                                                                                         |
| **Colonne** (crea, rinomina, colore, fase, ordine, eliminazione controllata)                        | ✅ **M1** — funzionanti                                                                                         |
| **Schede** (creazione rapida, dettaglio, priorità, azienda, URL, cronologia, archivio)              | ✅ **M1** — funzionanti                                                                                         |
| **Kanban interattivo** (trascinamento, tastiera, touch, menu, rollback)                             | ✅ **M1** — funzionante                                                                                         |
| **Dati professionali** (posizione, sede, modalità, contratto, retribuzione, date, fase, esito)      | ✅ **M2** — funzionanti                                                                                         |
| **Campi personalizzati** (8 tipi, per bacheca) ed **etichette**                                     | ✅ **M2** — funzionanti                                                                                         |
| **Ricerca, filtri e vista Tabella** (anche da telefono), Kanban ↔ Tabella                           | ✅ **M2** — funzionanti                                                                                         |
| **Modale della candidatura e colloqui** (più round, feedback, prossimo colloquio sulla card Kanban) | ✅ **M2.5** — funzionanti                                                                                       |
| **Pipeline, note, documenti e timeline paginata**                                                   | ✅ **M3-C3** — in `main`; stabilizzazione locale e **CI sorgenti verde; merge e baseline finale da verificare** |
| **Attività, follow-up e scadenze** (pagina, sezione nella candidatura, suggerimenti, Timeline)      | ✅ **M3** — integrate in `main`; **CI sorgenti verde; merge e baseline finale da verificare**                   |
| Insights, esportazione dati, deploy privato                                                         | ⏳ M4                                                                                                           |

Le funzioni non ancora disponibili (M4) sono mostrate come tali nell'interfaccia (badge _"In arrivo · Mx"_ e
controlli disabilitati): nessuna di esse simula un comportamento. Non esistono dati dimostrativi: l'app
parte vuota e ogni numero deriva dal database.

Dettagli: [`docs/m1/delivery.md`](docs/m1/delivery.md) · [`docs/m0h/delivery.md`](docs/m0h/delivery.md) · [`docs/roadmap/m0-delivery.md`](docs/roadmap/m0-delivery.md).

## Stack

| Livello  | Tecnologie                                                                                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend | React 19, TypeScript (strict), Vite, React Router, Tailwind CSS 4, Radix UI, Lucide, TanStack Query, React Hook Form, Zod                                         |
| Backend  | Cloudflare Workers, Hono, Zod, jose (verifica JWT)                                                                                                                |
| Database | Cloudflare D1 (SQLite), Drizzle ORM, migrazioni SQL versionate                                                                                                    |
| Qualità  | Vitest, React Testing Library, `@cloudflare/vitest-plugin` (test nel runtime Workers), Playwright + axe, ESLint (type-aware + jsx-a11y), Prettier, GitHub Actions |

Le versioni e i vincoli di compatibilità sono motivati in [`pnpm-workspace.yaml`](pnpm-workspace.yaml) e in
[ADR-0002](docs/architecture/decisions/0002-stack-and-versions.md). `@dnd-kit/core` + `@dnd-kit/sortable` sono usati dal Kanban (M1, [ADR-0008](docs/architecture/decisions/0008-kanban-ordering-and-board-loading.md)); R2 non è installato.

## Requisiti per lo sviluppo locale

- **Node.js ≥ 22.22** (vedi `.nvmrc`)
- **pnpm 12** (`corepack enable` oppure `npm i -g pnpm`)
- Nessun account Cloudflare è necessario: D1 gira in locale tramite Miniflare/Wrangler.
- Per gli E2E: Chromium di Playwright (`pnpm --filter @jobward/web exec playwright install chromium`).

## Installazione e avvio

```bash
pnpm install

# 1. Applica le migrazioni al database D1 locale (crea apps/api/.wrangler/state)
pnpm db:migrate:local

# 2. Avvia API e frontend insieme…
pnpm dev
# …oppure separatamente, in due terminali:
pnpm dev:api    # Worker su http://localhost:8787  (wrangler dev --env dev)
pnpm dev:web    # Frontend su http://localhost:5174 (proxy /api → 8787)
```

Apri <http://localhost:5174>. Al primo avvio vedrai l'onboarding: crea il workspace e arriverai all'Overview.
Per ripartire da zero cancella `apps/api/.wrangler/state` e rilancia `pnpm db:migrate:local`.
La porta del frontend è fissa: se è occupata, Vite si ferma. Per usare una porta diversa, allinea la porta di Vite e `APP_ORIGIN` del Worker dev, così anche i salvataggi mantengono la stessa origine autorizzata.

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
| `DEV_USER_EMAIL`     | —                    | `dev@meet-roulette.local` | Identità dev persistente preservata; vedi ADR-0014      |
| `APP_ORIGIN`         | —                    | `http://localhost:5174`   | Origine aggiuntiva ammessa dalla protezione CSRF        |

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
pnpm db:upgrade-test  # un database di M1 popolato viene portato all'ultima migrazione senza perdere dati
pnpm test             # unit + integrazione (shared, schemas, API nel runtime Workers, web)
pnpm build            # build frontend + dry-run di pacchettizzazione del Worker
pnpm test:e2e         # Playwright su stack di sviluppo (porte 5199/8799, DB pulito a ogni esecuzione)
pnpm test:preview     # Playwright sulla BUILD di produzione servita da Static Assets (porta 8797):
                      # header, CSP reale, fallback SPA, instradamento /api/*
pnpm check            # typecheck + lint + format + contrasto + config + db + test + build
```

## Struttura della repository

```text
jobward/
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
│   └── shared/              # dominio puro (pipeline, colloqui, timeline, azioni), costanti
├── docs/                    # architettura, prodotto, UX, roadmap
├── scripts/                 # strumenti di verifica (contrasto colori)
└── .github/workflows/       # CI
```

## Documentazione

- Architettura: [`docs/architecture/overview.md`](docs/architecture/overview.md) · [database](docs/architecture/database.md) · [autenticazione](docs/architecture/authentication.md) · [decisioni (ADR)](docs/architecture/decisions/)
- Prodotto: [visione](docs/product/vision.md) · [requisiti](docs/product/requirements.md) · [modello di dominio](docs/product/domain-model.md) · [user stories](docs/product/user-stories.md)
- UX: [architettura dell'informazione](docs/ux/information-architecture.md) · [design system](docs/ux/design-system.md) · [schermate](docs/ux/screens.md)
- Roadmap: [perimetro e politica](docs/roadmap/scope-policy.md) · [milestone](docs/roadmap/milestones.md) · [consegna M0](docs/roadmap/m0-delivery.md) · [backlog](docs/roadmap/backlog.md)
- M3 (stato corrente): [consegna finale](docs/m3/m3-final-delivery.md) · [problemi](docs/m3/m3-final-issue-register.md) · [chiusura C3](docs/m3/c3-closure.md) · [Attività e follow-up — progettazione](docs/m3/tasks-index.md) · [roadmap Attività](docs/m3/tasks-roadmap.md) · [decisioni](docs/m3/tasks-decision-register.md)
- M2.5: [consegna](docs/m25/delivery.md) · [architettura](docs/m25/architecture.md) · [modale e UX](docs/m25/modal-ux.md) · [colloqui](docs/m25/interview-domain.md) · [contratti API](docs/m25/api-contracts.md) · [migrazione](docs/m25/database-migration.md) · [test](docs/m25/testing-report.md) · [problemi](docs/m25/issue-register.md)
- M2: [consegna](docs/m2/delivery.md) · [architettura](docs/m2/architecture.md) · [ciclo della candidatura](docs/m2/application-lifecycle.md) · [campi personalizzati](docs/m2/custom-fields.md) · [etichette](docs/m2/labels.md) · [ricerca e filtri](docs/m2/search-and-filtering.md) · [tabella](docs/m2/table-view.md) · [contratti API](docs/m2/api-contracts.md) · [UX](docs/m2/ux-review.md) · [test](docs/m2/testing-report.md) · [problemi](docs/m2/issue-register.md)
- M1: [consegna](docs/m1/delivery.md) · [architettura](docs/m1/architecture.md) · [contratti API](docs/m1/api-contracts.md) · [interazioni](docs/m1/board-interactions.md) · [ordinamento](docs/m1/kanban-ordering.md) · [accessibilità](docs/m1/accessibility.md) · [test](docs/m1/testing-report.md) · [problemi](docs/m1/issue-register.md)
- Hardening M0.H: [consegna](docs/m0h/delivery.md) · [registro dei problemi](docs/m0h/issue-register.md) · [baseline](docs/m0h/audit-baseline.md) · [sicurezza](docs/m0h/security-audit.md) · [database](docs/m0h/database-audit.md) · [frontend](docs/m0h/frontend-audit.md) · [test](docs/m0h/testing-report.md) · [readiness Cloudflare](docs/m0h/cloudflare-readiness.md)

### M3-C1 — Dominio e rebranding tecnico

Disponibili in `@jobward/shared` le funzioni pure di pipeline, transizioni, coerenza dei colloqui, timeline e azioni contestuali. Il backend C2 è integrato in main; la UI C3 è implementata e verificata localmente nel branch dedicato. Pacchetti, Worker configurati, logo e favicon seguono il nome Jobward; dati e migrazioni storiche sono preservati.

- [Consegna C1](docs/m3/c1-delivery.md) · [test](docs/m3/c1-testing-report.md) · [problemi e limiti](docs/m3/c1-issue-register.md).
- `pnpm check:brand` verifica scope e riferimenti attivi; `pnpm test:identity` prova su database temporanei la procedura conservativa dell'identità locale. Entrambi fanno parte di `pnpm check` e della CI.

### M3.UI.1 — Navigazione, azioni contestuali e ricerca globale

La navbar superiore lascia spazio agli header delle viste, con ricerca globale e menu contestuale.
L’account è nella sidebar; opportunità, bacheche e colloqui sono ricercabili nel workspace autorizzato.
Questa consegna UI non anticipa le funzionalità di dominio/API M3-C2–C5 o M4.

- [Consegna e architettura](docs/m3-ui1/delivery.md) · [audit delle azioni](docs/m3-ui1/audit.md) · [test](docs/m3-ui1/testing-report.md) · [screenshot prima/dopo](docs/m3-ui1/screenshots.md).
