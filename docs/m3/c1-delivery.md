# M3-C1 — Domain, Pipeline & Complete Rebranding

**Data:** 2026-11-05 · **Branch:** `m3-application-workflow` · **Base:** `00005509a5241942c818a6fe95b8a5a4e4d3ec76`

## Stato iniziale e perimetro

Il branch partiva pulito e sincronizzato con la baseline indicata. M3.0 era presente, mentre il dominio C1 non esisteva. I cinque pacchetti avevano scope legacy, le configurazioni Worker conservavano il nome precedente e il logo visibile era ancora il segnaposto. I due PNG originali erano già versionati.

La nuova autorizzazione supera D6, precedentemente rinviata, e consente il rebranding tecnico. **C2–C5 non sono stati avviati.** Nessuna nuova API pipeline, tabella, colonna persistente o migrazione `0005`; nessun push, PR, merge, deploy o intervento Cloudflare remoto. `main` resta `ba2ff11955e8b9c566ba6a3d9e05f99187e4ba35`.

## Checkpoint

| Area                  | Esito e prova                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1 — Audit            | [Inventario iniziale](c1-legacy-inventory.md) prodotto prima delle modifiche: 257 match della ricerca ampia in 146 file, inclusi falsi positivi Tailwind, storico e riferimenti persistenti |
| A2 — Pacchetti        | Root `jobward`; `@jobward/web`, `api`, `shared`, `schemas`, `database`; struttura invariata; lockfile rigenerato da pnpm, installazione frozen offline, nessuna nuova dipendenza o versione |
| A3 — Identità e asset | Branding centralizzato in `brand.ts`; PNG originali integri; nuovo wordmark, simbolo e favicon; temi chiaro/scuro, mobile, proporzioni, alt e axe verificati nel browser                    |
| A4 — Cloudflare       | Nomi configurati `jobward`, `jobward-dev`, `jobward-preview`, `jobward-test`; binding e ID D1 invariati; etichette D1 persistenti preservate                                                |
| A5 — Identità locale  | La SELECT Wrangler con il nome Worker nuovo ritrova l'utente dev esistente; procedura conservativa esplicita, con dry-run e collisioni testate su SQLite temporaneo                         |
| A6 — Tracciabilità    | [ADR-0014](../architecture/decisions/0014-jobward-technical-rebranding.md) sostituisce formalmente le parti superate di ADR-0013; storico conservato                                        |
| A7 — Verifica         | Guard `check:brand`, installazione frozen, typecheck, lint, format, test, migrazioni e build; nuovi controlli inclusi in CI e `pnpm check`                                                  |
| B1 — Derivazione      | Dieci stati derivati, precedenza archivio/esiti e diagnostica esplicita per `closed` senza esito                                                                                            |
| B2 — Transizioni      | Grafo, validazione, mapping, eventi, conferme e avvisi separati; nessuna query o modifica automatica                                                                                        |
| B3 — Colloqui         | Riepilogo puro M2.5 riusato tramite export retrocompatibile; avvisi su fase, appuntamenti, feedback, annullati e assenza di round                                                           |
| B4 — Timeline         | Modelli e collegamenti, metadati filtrati, ordinamento totale, dedupe di lettura e intenti di evento; riapertura predisposta solo nel dominio                                               |
| B5 — Azioni           | ID contestuali ordinati, indipendenti dai gestori UI; nessun pulsante o funzione simulata                                                                                                   |

## Contratti del dominio puro

Tutti i moduli risiedono in `packages/shared/src`, senza React, Zod, Hono, D1, autenticazione o dipendenze cloud. Il clock è un parametro di `summarizeInterviews()` e `createPipelineInterviewContext()`; nessun clock globale, UUID casuale o I/O nel nuovo dominio.

| Funzione / modello                                           | Contratto                                                                                                                                                                    |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `derivePipelineStatus(state)`                                | Legge `stage`, `outcome`, `archivedAt`; l'archivio prevale anche con timestamp `0`, poi gli esiti conclusivi e le fasi aperte                                                |
| `inspectPipelineState(state)`                                | Per `closed` con esito `pending/null` restituisce `saved` come fallback neutro e `closed_without_outcome`; non deduce una conclusione                                        |
| `resolvePipelineFields(status)`                              | Mappa canonica esplicita verso i valori persistenti esistenti; non aggiunge un campo status                                                                                  |
| `PIPELINE_TRANSITIONS` / `allowedTransitions(status, kind?)` | Grafo congelato; la lista predefinita comprende le transizioni ordinarie; le correzioni richiedono `kind='correction'` esplicito                                             |
| `evaluatePipelineTransition(request)`                        | Decisione discriminata `allowed/reason`, campi, intenti di evento, conferma e avvisi; controlla stato atteso, ID operazione e archivio; assunzione ordinaria solo da Offerta |
| `pipelineConsistency(status, context)`                       | Restituisce avvisi e suggerimenti; non aggiorna la pipeline e non annulla appuntamenti                                                                                       |
| `mergeTimeline(events, notes)`                               | Ordine decrescente per `(occurredAt, id, source)` con confronto binario; replay identici deduplicati, stessa identità con contenuti diversi rifiutata esplicitamente         |
| `safeTimelineMetadata(type, metadata)`                       | Whitelist di vocabolari, ID e dati strutturati; scarta note, feedback, titoli liberi e oggetti annidati                                                                      |
| `pipelineEventIntent()` / `timelineDedupeKey()`              | Intenzioni con chiave stabile per operazione ed entità; una nuova riapertura usa un nuovo ID; nessuna garanzia backend è dichiarata in C1                                    |
| `quickActions(context)`                                      | Azioni ordinate, senza duplicati; archiviate → solo ripristino, concluse → riapertura/correzione; gestori e UI restano a C3                                                  |

Le correzioni lasciano un intento con `kind=correction`, anche quando normalizzano soltanto `outcome=null` in `pending`. I casi legacy senza esito richiedono una correzione esplicita prima delle transizioni ordinarie. La riapertura riceve una destinazione esplicita: la scelta predefinita dalla cronologia verrà risolta nell'integrazione successiva.

`summarizeInterviews()` è stato spostato da `schemas` a `shared` senza cambiare il comportamento, accettando anche input readonly. `@jobward/schemas` mantiene il precedente export della funzione e di `InterviewSummaryRow`: i consumer M2.5 rimangono compatibili e non nasce un ciclo di dipendenze.

`application_reopened` esiste solo nel tipo di dominio. `ACTIVITY_EVENT_TYPES`, schema SQL e contratti API persistenti rimangono quelli attuali, fino a C2. Nessuna UI usa ancora il motore per imporre le nuove regole: le API esistenti continuano a comportarsi come in M2.5.

## Rebranding e compatibilità residue

- Rimossi scope legacy, vecchi nomi Worker configurati, abbreviazioni di animazioni/processi temporanei e URL legacy della fixture di autenticazione. Import, workflow e script usano il nuovo scope. Il lockfile differisce solo nei riferimenti workspace.
- `database_name` di produzione/dev/preview conserva le etichette esistenti. `database_id` e binding sono identici alla baseline. Non sono stati creati database sostitutivi.
- L'ambiente dev conserva `dev@meet-roulette.local` perché il database locale contiene già un utente con membership e dati. Il fallback nuovo e la preview isolata usano `dev@jobward.local`. La procedura di ADR-0014 non è stata applicata ai dati reali.
- Le chiavi browser `mr-theme` e `mr-sidebar-collapsed` vengono lette per compatibilità e copiate nelle nuove chiavi senza cancellazione; la preferenza nuova prevale. Le utility CSS `mr-*` sono margini, non nomenclatura applicativa.
- Documentazione storica, audit iniziali e ADR-0013 conservano i riferimenti datati. L'inventario iniziale non viene riscritto per nascondere le occorrenze originarie. Il guard automatico contiene le regole delle eccezioni persistenti.
- Gli originali `jobward.png` e `jobward-white.png` sono invariati. La variante con fondo bianco resta una targa chiara nel tema scuro; simbolo e favicon sono ritagli di visualizzazione dei pixel originali. Il file grande comporta un costo asset documentato nel registro problemi.

## Qualità e problemi aperti

Risultati effettivi e log: [testing report](c1-testing-report.md). Problemi ereditati, limiti e rischi: [issue register](c1-issue-register.md). Il primo giro E2E ha avuto un fallimento intermittente sulla navigazione dei filtri; la ripetizione isolata ricerca passa 16/16. Il giro completo finale passa **118/118**. Dopo la sola targa del simbolo compatto sono stati ripetuti il test marchio (**1/1**), la build/anteprima (**11/11**), typecheck e lint dei file toccati, tutti verdi. La causa del primo fallimento resta non conclusiva; non è stata modificata la logica della ricerca senza una riproduzione stabile.

## Readiness per C2

Il dominio è pronto per l'integrazione previa nuova autorizzazione. In C2 occorre definire DTO e persistenza del fingerprint immutabile della creazione, validazione backend e confronto dei payload, scoping workspace delle chiavi, concorrenza/atomicità SQL e `0005` conservativa. Tutte le condizioni D4/D5 del [piano](plan.md) restano obbligatorie: i test attuali non sostituiscono quelli futuri sull'upgrade M2.5 → `0005`, sugli errori dell'evento e sulle richieste concorrenti.

Il cursore della timeline dovrà rispettare anche `source` nel raro caso di ID uguali fra note ed eventi. Eventi, aggiornamento dei campi e scelta esplicita sugli appuntamenti futuri dovranno essere integrati atomicamente. C3 collegherà i gestori reali e la Panoramica operativa mantenendo il modulo Dettagli.

## Commit e file

L’URL di `origin` è stato allineato **solo nella configurazione Git locale** a `https://github.com/lonelyfrank/jobward.git`, senza fetch o push. Il riferimento remoto locale resta alla baseline.

Commit implementativi e di verifica, nell’ordine:

| Commit locale   | Contenuto                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| `021d152`       | refactor(brand): rename workspace packages to jobward                                                |
| `30faedf`       | chore(brand): align local configuration, original logos and development identity                     |
| `ddc515a`       | docs(brand): supersede ADR-0013 D6 and document infrastructure migration                             |
| `b5d1572`       | feat(m3-c1): add pure application pipeline domain                                                    |
| `22d4cf4`       | feat(m3-c1): add safe timeline models and event intents                                              |
| `838c1b2`       | feat(m3-c1): add transitions, interview consistency and contextual actions                           |
| `2e22821`       | test(m3-c1): enforce branding and complete regression verification                                   |
| `909189f`       | fix(brand): preserve compact logo contrast on dark surfaces                                          |
| Questa consegna | `docs(m3-c1): deliver checkpoint and verified test reports` — chiusura documentale dopo le verifiche |

File modificati o aggiunti rispetto alla baseline: **162**. Gli originali PNG e le migrazioni storiche non compaiono perché sono invariati.

<details>
<summary>Elenco completo dei file</summary>

```text
.github/workflows/ci.yml
README.md
apps/api/package.json
apps/api/src/app.ts
apps/api/src/env.ts
apps/api/src/lib/errors.ts
apps/api/src/middleware/auth.ts
apps/api/src/middleware/errors.ts
apps/api/src/middleware/guards.ts
apps/api/src/middleware/workspace.ts
apps/api/src/modules/boards/routes.ts
apps/api/src/modules/cards/routes.ts
apps/api/src/modules/columns/routes.ts
apps/api/src/modules/custom-fields/routes.ts
apps/api/src/modules/interviews/routes.ts
apps/api/src/modules/labels/routes.ts
apps/api/src/modules/opportunities/routes.ts
apps/api/src/modules/workspaces/routes.ts
apps/api/src/services/boards.ts
apps/api/src/services/card-rows.ts
apps/api/src/services/cards.ts
apps/api/src/services/columns.ts
apps/api/src/services/custom-fields.ts
apps/api/src/services/events.ts
apps/api/src/services/interview-summaries.ts
apps/api/src/services/interviews.ts
apps/api/src/services/labels.ts
apps/api/src/services/opportunities.ts
apps/api/src/services/ordering.ts
apps/api/src/services/overview.ts
apps/api/src/services/users.ts
apps/api/src/services/workspaces.ts
apps/api/test/application-details.test.ts
apps/api/test/auth.test.ts
apps/api/test/boards.test.ts
apps/api/test/cards.test.ts
apps/api/test/columns.test.ts
apps/api/test/custom-fields.test.ts
apps/api/test/database.test.ts
apps/api/test/helpers.ts
apps/api/test/interviews.test.ts
apps/api/test/kanban-isolation.test.ts
apps/api/test/labels.test.ts
apps/api/test/m2-isolation.test.ts
apps/api/test/opportunities.test.ts
apps/api/test/overview.test.ts
apps/api/test/tenant-integrity.test.ts
apps/api/wrangler.jsonc
apps/api/wrangler.test.jsonc
apps/web/e2e/brand.spec.ts
apps/web/package.json
apps/web/playwright.config.ts
apps/web/playwright.preview.config.ts
apps/web/public/favicon.svg
apps/web/public/theme-init.js
apps/web/src/app/app.test.tsx
apps/web/src/components/brand/logo.tsx
apps/web/src/components/ui/confirm-dialog.tsx
apps/web/src/components/ui/dialog.tsx
apps/web/src/components/ui/dropdown-menu.tsx
apps/web/src/components/ui/sheet.tsx
apps/web/src/components/ui/skeleton.tsx
apps/web/src/features/boards/api.ts
apps/web/src/features/boards/board-dialog.tsx
apps/web/src/features/boards/color-picker.tsx
apps/web/src/features/cards/card-detail.tsx
apps/web/src/features/cards/card-form.ts
apps/web/src/features/cards/card-history.tsx
apps/web/src/features/cards/smart-summary.tsx
apps/web/src/features/custom-fields/api.ts
apps/web/src/features/custom-fields/card-fields-section.tsx
apps/web/src/features/custom-fields/field-form.tsx
apps/web/src/features/custom-fields/fields-dialog.tsx
apps/web/src/features/custom-fields/value-editor.tsx
apps/web/src/features/custom-fields/values.test.ts
apps/web/src/features/custom-fields/values.ts
apps/web/src/features/interviews/api.ts
apps/web/src/features/interviews/interview-form.tsx
apps/web/src/features/interviews/interviews-tab.tsx
apps/web/src/features/kanban/board-state.test.ts
apps/web/src/features/kanban/board-state.ts
apps/web/src/features/kanban/card-view.tsx
apps/web/src/features/kanban/column-dialog.tsx
apps/web/src/features/kanban/delete-column-dialog.tsx
apps/web/src/features/kanban/global-create.tsx
apps/web/src/features/kanban/kanban-board.tsx
apps/web/src/features/kanban/kanban-card.tsx
apps/web/src/features/kanban/kanban-column.tsx
apps/web/src/features/kanban/mutations.ts
apps/web/src/features/kanban/quick-create.tsx
apps/web/src/features/labels/api.ts
apps/web/src/features/labels/label-chip.tsx
apps/web/src/features/labels/label-picker.tsx
apps/web/src/features/labels/labels-manager.tsx
apps/web/src/features/opportunities/api.ts
apps/web/src/features/opportunities/filters-panel.tsx
apps/web/src/features/opportunities/opportunities-view.tsx
apps/web/src/features/opportunities/results.tsx
apps/web/src/features/opportunities/table-state.ts
apps/web/src/features/overview/api.ts
apps/web/src/features/workspace/api.ts
apps/web/src/features/workspace/context.tsx
apps/web/src/features/workspace/onboarding.tsx
apps/web/src/hooks/use-sidebar-collapsed.ts
apps/web/src/layouts/app-shell.tsx
apps/web/src/layouts/topbar.tsx
apps/web/src/lib/api.test.ts
apps/web/src/lib/api.ts
apps/web/src/lib/brand.ts
apps/web/src/lib/labels.ts
apps/web/src/lib/salary.ts
apps/web/src/lib/storage.test.ts
apps/web/src/lib/storage.ts
apps/web/src/lib/theme.test.ts
apps/web/src/lib/theme.ts
apps/web/src/lib/zod-config.ts
apps/web/src/routes/boards.tsx
apps/web/src/routes/settings.tsx
apps/web/src/styles/index.css
apps/web/src/test/fixtures.ts
docs/architecture/authentication.md
docs/architecture/decisions/0013-rebranding-jobward.md
docs/architecture/decisions/0014-jobward-technical-rebranding.md
docs/architecture/decisions/README.md
docs/architecture/overview.md
docs/m3/c1-delivery.md
docs/m3/c1-issue-register.md
docs/m3/c1-legacy-inventory.md
docs/m3/c1-testing-report.md
docs/m3/plan.md
package.json
packages/database/package.json
packages/database/src/schema.ts
packages/schemas/package.json
packages/schemas/src/board.ts
packages/schemas/src/card.ts
packages/schemas/src/custom-field.ts
packages/schemas/src/interview.ts
packages/schemas/src/label.ts
packages/schemas/src/opportunity.ts
packages/schemas/src/primitives.ts
packages/schemas/src/task.ts
packages/schemas/src/workspace.ts
packages/shared/package.json
packages/shared/src/index.ts
packages/shared/src/interviews.ts
packages/shared/src/pipeline-consistency.test.ts
packages/shared/src/pipeline-consistency.ts
packages/shared/src/pipeline-transitions.test.ts
packages/shared/src/pipeline-transitions.ts
packages/shared/src/pipeline.test.ts
packages/shared/src/pipeline.ts
packages/shared/src/quick-actions.test.ts
packages/shared/src/quick-actions.ts
packages/shared/src/timeline.test.ts
packages/shared/src/timeline.ts
pnpm-lock.yaml
scripts/check-brand.mjs
scripts/check-migrations.mjs
scripts/rename-dev-identity.mjs
scripts/rename-dev-identity.test.mjs
scripts/test-migration-upgrade.mjs
```

</details>
