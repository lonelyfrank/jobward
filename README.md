# Jobward

**Smart Career Workspace — il tuo spazio per organizzare, gestire e comprendere il percorso professionale.**

Jobward trasforma opportunità lavorative, candidature, colloqui, attività e informazioni in un unico ambiente collegato. È uno strumento **per il candidato**, in qualsiasi settore: non pubblica offerte, non è un social network professionale, non è un ATS per recruiter e non invia candidature al posto tuo. Identità e principi: [docs/product/CORE.md](docs/product/CORE.md).

## Problemi che risolve

- Le offerte interessanti sono sparse tra link, email, note e screenshot.
- Dopo qualche settimana non è più chiaro a chi si è scritto, quando e con quale risposta.
- Gli strumenti generici (fogli di calcolo, board Kanban) non distinguono la _posizione_ di una scheda dall'_esito_ di una candidatura, e rendono difficile ogni statistica.
- Dimenticare un follow-up costa un'opportunità.

## Stato

**Jobward v1 — applicazione locale.** Si esegue in locale; questo ramo `main` è ripartito da un unico commit al lancio ([ADR-0018](docs/architecture/decisions/0018-launch-repository-and-docs-archive.md)). Multiutenza e ambienti remoti si valuteranno dopo ([ADR-0017](docs/architecture/decisions/0017-local-v1-baseline.md)). Dettagli: [stato corrente](docs/status/CURRENT-STATE.md) · funzioni ed evidenze: [matrice delle funzionalità](docs/status/FEATURE-MATRIX.md).

Oggi puoi:

- **salvare un'opportunità senza candidarti** (Inbox) o in una bacheca con l'inserimento guidato in quattro passi (basta il titolo; avviso se l'hai già salvata), e arricchirla con dati professionali, livello di esperienza, scadenza, requisiti, benefit, interesse personale, campi personalizzati ed etichette;
- **candidarti** con un clic: la candidatura fotografa i dati dell'annuncio; dopo una chiusura puoi **ricandidarti** conservando lo storico;
- seguire le candidature nella bacheca canonica **Pipeline**, con transizioni validate e sempre confermate, **colloqui** a round, note, documenti e **timeline**;
- organizzare con **bacheche** Kanban accessibili (mouse, tastiera, touch) e Smart Filter, o nella **Tabella** dell'Opportunity Center (Tutte / Inbox / Candidature) con **viste salvate**;
- raccogliere le opportunità per **azienda**;
- pianificare **attività e follow-up** con suggerimenti deterministici e vederli nel **Calendario** con colloqui e scadenze;
- leggere gli **Insights** (funnel, stati, tempi di risposta con dati mancanti dichiarati, candidature per settimana);
- **esportare** tutti i tuoi dati in JSON.

Nessun dato inventato: ogni numero deriva dal database; le funzioni assenti non sono simulate.

## Stack

| Livello  | Tecnologie                                                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend | React 19, TypeScript (strict), Vite, React Router, Tailwind CSS 4, Radix UI, Lucide, TanStack Query, React Hook Form, Zod                                                                                    |
| Backend  | Cloudflare Workers, Hono, Zod, jose (verifica JWT)                                                                                                                                                           |
| Database | Cloudflare D1 (SQLite), Drizzle ORM, migrazioni SQL versionate                                                                                                                                               |
| Qualità  | Vitest, React Testing Library, `@cloudflare/vitest-plugin` (test nel runtime Workers), Playwright + axe, ESLint (type-aware + jsx-a11y), Prettier; GitHub Actions configurata ma inattiva sulla linea locale |

Versioni e vincoli: [`pnpm-workspace.yaml`](pnpm-workspace.yaml) e [ADR-0002](docs/architecture/decisions/0002-stack-and-versions.md).

## Avvio rapido

Requisiti: Node.js ≥ 22.22, pnpm 12. Nessun account Cloudflare necessario.

```bash
pnpm install
pnpm db:reset:local -- --yes   # solo la prima volta: crea il D1 locale (copia e cancella quello esistente)
pnpm dev                       # API :8787 + web http://localhost:5174
```

Dati di esempio per mostrare l'app: **Impostazioni → Dati demo** (profilo separato, i dati reali restano intatti).

Configurazione, variabili e migrazioni: [docs/development/GETTING-STARTED.md](docs/development/GETTING-STARTED.md).

## Verifiche

```bash
pnpm check          # typecheck, lint, format, contrasto, schema/migrazioni, test, build (~2–3 min)
pnpm test:e2e       # Playwright sullo stack di sviluppo
pnpm test:preview   # Playwright sulla build di produzione
```

Tutti i comandi: [docs/development/COMMANDS.md](docs/development/COMMANDS.md) · test: [docs/development/TESTING.md](docs/development/TESTING.md).

## Struttura

`apps/web` (SPA React) · `apps/api` (Worker Hono + D1) · `packages/database` (schema e migrazioni) · `packages/schemas` (contratti Zod) · `packages/shared` (dominio puro) · `scripts/` (verifiche, reset e dati demo) · `docs/`. Mappa completa: [docs/architecture/REPOSITORY-MAP.md](docs/architecture/REPOSITORY-MAP.md).

## Documentazione

- **Indice generale:** [docs/INDEX.md](docs/INDEX.md)
- **Guida per chi usa l'app:** [docs/user](docs/user/README.md)
- **Prodotto:** [Core](docs/product/CORE.md) · [visione del prodotto finito](docs/product/PRODUCT-VISION.md) · [glossario](docs/product/DOMAIN-GLOSSARY.md)
- **Roadmap:** [perimetro (vincolante)](docs/roadmap/scope-policy.md) · [milestone](docs/roadmap/milestones.md) · [piano M4](docs/roadmap/m4-private-release-plan.md) · [roadmap funzionale](docs/roadmap/MASTER-FUNCTIONAL-ROADMAP.md)
- **Architettura:** [panoramica](docs/architecture/overview.md) · [modello dati](docs/architecture/DATA-MODEL.md) · [API](docs/architecture/API-CONTRACTS.md) · [sicurezza](docs/architecture/SECURITY.md) · [ADR](docs/architecture/decisions/README.md)
- **Storico delle milestone:** non pubblicato ([ADR-0018](docs/architecture/decisions/0018-launch-repository-and-docs-archive.md)); indice in [docs/history/README.md](docs/history/README.md)
- **Per agenti AI:** [AGENTS.md](AGENTS.md)
