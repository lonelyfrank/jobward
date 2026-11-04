# M0 — Relazione di consegna

**Branch:** `m0-foundation` · **Data:** 2026-11-04 · **Stato:** completata, in attesa di revisione. Non è stato fatto merge su `main`, né deploy, né release.

## 1. Che cosa è stato implementato

**Fondamenta**

- Monorepo pnpm (`apps/web`, `apps/api`, `packages/{database,schemas,shared}`), TypeScript strict, ESLint type-aware + jsx-a11y, Prettier, `catalog` di versioni con i vincoli motivati.
- CI GitHub Actions (quality + E2E).
- Schema D1/Drizzle completo (13 tabelle, 1 migrazione `0000_init`) con vincoli CHECK, FK `RESTRICT`/`CASCADE`/`SET NULL` e tenancy per `workspace_id`.
- Schemi Zod per tutte le entità, inclusa la validazione dei campi personalizzati per tipo e la serializzazione senza perdita di tipo.
- Template di bacheca (Job Search Standard, Minimal, Custom) come **dati**.

**API (Worker + Hono)**

- `GET /api/health` (pubblica), `GET /api/v1/me`, `GET|POST /api/v1/workspaces`, `GET /api/v1/overview`.
- Middleware: id di correlazione, log privi di segreti, header di sicurezza, protezione CSRF, limite payload 64 KiB, errori standardizzati.
- Accesso privato del proprietario tramite Cloudflare Access con verifica del JWT, fail-closed ([ADR-0003](../architecture/decisions/0003-authentication-strategy.md)).
- Ownership verificata da un unico punto (`requireMembership`); limite MVP di un workspace applicato in modo atomico.

**Frontend (React)**

- App shell: sidebar comprimibile (drawer su mobile), topbar, main; routing; skip link; focus gestito a ogni navigazione.
- Design system con token semantici, tema chiaro/scuro/sistema (senza flash), identità propria (marchio a ruota, verde "feltro").
- Onboarding funzionante, Overview con dati reali, Bacheche (template letti dai dati), Opportunità/Attività/Insights come stati vuoti dichiarati, Impostazioni funzionanti, 404 dentro la shell.
- Le funzioni future sono **dichiarate** ("In arrivo · Mx", controlli disabilitati con descrizione accessibile): nessuna è simulata. Nessun dato dimostrativo.

## 2. Test eseguiti e risultati

Tutti eseguiti in questa sessione, dall'inizio, nello stato finale del codice.

| Controllo                                                   | Comando               | Risultato                                                                                |
| ----------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------- |
| Typecheck (strict)                                          | `pnpm typecheck`      | ✅ 5 package, 0 errori                                                                   |
| Lint                                                        | `pnpm lint`           | ✅ 0 errori, 0 warning (`--max-warnings=0`)                                              |
| Formattazione                                               | `pnpm format:check`   | ✅                                                                                       |
| Contrasto WCAG dei token                                    | `pnpm check:contrast` | ✅ 38 coppie (chiaro + scuro)                                                            |
| Unit `shared`                                               | `pnpm test`           | ✅ 5/5                                                                                   |
| Unit `schemas`                                              | `pnpm test`           | ✅ 24/24                                                                                 |
| Integrazione API (runtime Workers, D1 con migrazioni reali) | `pnpm test`           | ✅ 46/46 (auth, CSRF, limiti, ownership, overview, integrità DB, log)                    |
| Componenti (RTL)                                            | `pnpm test`           | ✅ 26/26                                                                                 |
| Build                                                       | `pnpm build`          | ✅ frontend + dry-run di pacchettizzazione del Worker (con configurazione di produzione) |
| **E2E** (Chromium, stack reale: Vite → Worker → D1 locale)  | `pnpm test:e2e`       | ✅ 11/11, ~43 s                                                                          |

**Totale: 101 test unit/integrazione/componenti + 11 E2E, tutti passati.**

Verifiche aggiuntive eseguite a mano:

- **Mutation check** sulla sicurezza: rimuovendo deliberatamente il controllo del proprietario e quello di ownership, i test corrispondenti **falliscono** (poi ripristinati).
- **axe** verificato su una pagina volutamente scorretta: rileva `color-contrast`, `image-alt`, `label` — quindi le scansioni sull'app sono significative.
- Flusso di sviluppo del README provato con `curl` su `wrangler dev`: migrazione, health, identità dev, creazione workspace, 415 su `text/plain`.
- Ispezione visiva (screenshot) di onboarding, Overview in chiaro e scuro, Bacheche, mobile e drawer.

**Difetti trovati e corretti grazie ai controlli**

1. Bordo dei controlli a 1.5:1 (WCAG 1.4.11 richiede ≥ 3:1) → portato a 3.35 (chiaro) / 4.01 (scuro).
2. Rischio di deploy accidentale di `--env dev` (accesso senza autenticazione) → la modalità dev ora richiede anche un hostname di loopback (test dedicato).
3. `packages/schemas` usava `URL` senza dichiarare un ambiente: passava il typecheck solo per `@types/node` incluso implicitamente → `lib` esplicita.
4. Dipendenze pubblicate lo stesso giorno aggirate da pnpm con eccezioni automatiche → rimosse, fissate versioni precedenti.

## 3. Decisioni architetturali (ADR)

[0001](../architecture/decisions/0001-modular-monolith-monorepo.md) monolite modulare · [0002](../architecture/decisions/0002-stack-and-versions.md) stack e versioni · [0003](../architecture/decisions/0003-authentication-strategy.md) autenticazione · [0004](../architecture/decisions/0004-data-conventions.md) convenzioni dati · [0005](../architecture/decisions/0005-design-system-and-ui.md) design system · [0006](../architecture/decisions/0006-testing-strategy.md) test.

Variazioni rispetto alla specifica, tutte motivate: TypeScript 6.0 (non 7) per `typescript-eslint`; ESLint 9 (non 10) per `jsx-a11y`; `@cloudflare/vitest-plugin` al posto del pool deprecato; componenti "in stile shadcn" scritti a mano; `GET /me` aggiunto; `overview` con `workspaceId` come parametro di query.

## 4. File

144 file aggiunti, nessuno modificato (la repository era vuota). Per area: `apps/web` 52 · `apps/api` 32 · `packages/schemas` 12 · `packages/database` 8 · `packages/shared` 7 · `docs` 20 · configurazione root, CI e script.

## 5. Definition of Done — verifica punto per punto

| Criterio                                  | Esito | Evidenza / nota                                                                                               |
| ----------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| Struttura coerente                        | ✅    | Come da specifica                                                                                             |
| Frontend e API si avviano localmente      | ✅    | E2E + prova manuale con `curl`                                                                                |
| Database con migrazioni iniziali          | ✅    | `0000_init.sql`, applicata in locale e nei test                                                               |
| Layout coerente; navigazione funzionante  | ✅    | Test componenti + E2E                                                                                         |
| Light e dark mode                         | ✅    | Test, E2E, screenshot                                                                                         |
| Schermate vuote curate                    | ✅    | Ispezione visiva                                                                                              |
| Responsive nei breakpoint verificati      | ⚠️    | Verificati **1360 px (desktop) e 390 px (mobile)**. **Tablet (768–1024 px) non verificato in modo specifico** |
| Configurazione senza segreti              | ✅    | Revisione dei file; produzione fail-closed                                                                    |
| Autenticazione definita; accessi protetti | ✅/⚠️ | Definita e testata con chiavi locali. **Mai provata contro un vero Cloudflare Access** (non configurato)      |
| Build, lint, typecheck verificati         | ✅    | Sezione 2                                                                                                     |
| Test previsti per M0 eseguiti             | ✅    | Sezione 2                                                                                                     |
| README aggiornato                         | ✅    | Comandi provati                                                                                               |
| Roadmap chiara per M1                     | ✅    | [milestones.md](milestones.md#m1--boards--cards-piano)                                                        |

## 6. Problemi e limiti noti (da conoscere prima di fidarsi)

- **CI non eseguita**: nessun remoto GitHub configurato; il workflow è verificato solo localmente nei suoi comandi (le versioni delle action `@v4` non sono state controllate).
- **Cloudflare Access non provato dal vivo**: la verifica del JWT è testata con chiavi generate localmente, non con il JWKS reale del team. Va fatta una prova end-to-end al primo deploy privato.
- **`public/_headers` (CSP e header) non verificato**: è presente nel build, ma non ho verificato che Workers Static Assets lo applichi (in locale gli asset non sono serviti dal Worker).
- **Nessun rate limiting** applicativo (rimandato a M5: vedi [authentication.md](../architecture/authentication.md)).
- **Accessibilità**: verifica automatica (axe, contrasto) ma **nessun audit manuale con screen reader**; la conformità WCAG 2.2 AA non è dichiarata, solo l'obiettivo.
- **CSP** con `style-src 'unsafe-inline'`.
- **Solo Chromium** negli E2E (build di fallback di Playwright, perché Fedora non è ufficialmente supportata).
- **Bundle JS ≈ 645 kB** (≈ 170 kB gzip): il build segnala il warning di Vite; in backlog.
- Se un utente avesse più workspace (impossibile oggi per il limite MVP), l'interfaccia userebbe il primo.
- `database_id` D1 in `wrangler.jsonc` è un **segnaposto**: va sostituito prima di qualsiasi deploy.

## 7. Funzionalità ancora mancanti

Tutto ciò che è dichiarato "In arrivo" nell'interfaccia: bacheche, colonne, schede, Kanban e drag & drop, pannello di dettaglio (M1) · informazioni professionali nell'UI, campi personalizzati nell'UI, etichette, filtri, ricerca, vista tabella (M2) · attività, scadenze, cronologia (M3) · statistiche, esportazione dati, deploy privato, audit di sicurezza e accessibilità (M4). Backup/ripristino e cancellazione account sono solo **progettati** ([database.md](../architecture/database.md)).

## 8. Preparazione necessaria per M1

Già pronti: schema, schemi Zod, template, pattern API/ownership/errori, test su D1, shell e componenti.

Da fare all'avvio di M1: installare `@dnd-kit/*`; decidere paginazione del carico schede, elenco chiuso di colori/icone e regola del cambio di fase proposto; implementare e testare l'algoritmo delle posizioni a gap ([ADR-0004](../architecture/decisions/0004-data-conventions.md)). Piano dettagliato in 11 passi in [milestones.md](milestones.md#m1--boards--cards-piano).

## 9. Come provarla

```bash
pnpm install && pnpm db:migrate:local && pnpm dev   # poi apri http://localhost:5173
pnpm check && pnpm test:e2e                          # quality gate completo
```
