# Test

**Stato:** canonico · **Verificato su:** `jobward-v1` (2026-11-21); gli esiti per suite sono nell'[AUDIT-REPORT](../status/AUDIT-REPORT.md#verifiche-v1). Strategia: [ADR-0006](../architecture/decisions/0006-testing-strategy.md). Comandi: [COMMANDS](COMMANDS.md).

## Suite

| Suite                      | Dove                                      | Ambiente                                                                                  | Esito 2026-11-21                                       |
| -------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Dominio puro               | `packages/shared/src/*.test.ts` (13 file) | Vitest, Node                                                                              | 805 ✅                                                 |
| Contratti                  | `packages/schemas/src/schemas.test.ts`    | Vitest, Node                                                                              | 71 ✅                                                  |
| API e database             | `apps/api/test/*.test.ts` (33 file)       | `@cloudflare/vitest-plugin`, runtime Workers, D1 di test con migrazioni reali             | 485 ✅                                                 |
| Frontend                   | `apps/web/src/**/*.test.ts(x)` (27 file)  | Vitest, jsdom, React Testing Library                                                      | 287 ✅                                                 |
| E2E                        | `apps/web/e2e/*.spec.ts` (22 spec)        | Playwright Chromium, 1 worker; Vite → `wrangler dev` → D1 locale ricreato in `.e2e-state` | 258 ✅, 1 saltato, 1 intermittente (vedi AUDIT-REPORT) |
| Preview                    | `apps/web/e2e-preview/preview.spec.ts`    | build di produzione su Static Assets (porta 8797): `_headers`, CSP, fallback SPA          | 14 ✅                                                  |
| Coerenza schema/migrazioni | `scripts/check-migrations.mjs`            | `drizzle-kit` su copia temporanea                                                         | ✅                                                     |

## Ambiti dei test API (`apps/api/test`)

| Area                       | File                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Autenticazione e sicurezza | `auth`, `security-hardening` (enumera le rotte), `logging`, `health`                                                |
| Isolamento                 | `ownership`, `kanban-isolation`, `m2-isolation`, `tenant-integrity`, `database`, `demo`                             |
| Bacheche e Kanban          | `boards`, `columns`, `cards`, `kanban-ordering`                                                                     |
| Dati e personalizzazione   | `application-details`, `custom-fields`, `labels`, `saved-views`, `map-places` (posizioni, coordinate, città, mappa) |
| Ricerca                    | `opportunities`, `global-search`, `search-d1-boundaries`                                                            |
| Candidatura                | `pipeline`, `interviews`, `interview-idempotency`, `notes`, `notes-pagination`, `documents`, `timeline`             |
| Attività e Overview        | `tasks`, `overview`, `workspaces`                                                                                   |

Helper senza test: `helpers.ts`, `kanban-helpers.ts`, `m3-helpers.ts`, `setup.ts`.

**Verifica per mutazione dei test di isolamento.** Un test di isolamento vale solo se fallisce quando il controllo manca. Per provarlo, togli in locale il filtro `workspace_id` dal servizio interessato (o `workspaceScope` dalla rotta) ed esegui il test: deve diventare rosso. Poi ripristina il codice.

## Spec E2E (`apps/web/e2e`)

`app`, `boards`, `kanban`, `kanban-zoom`, `kanban-glass`, `board-background`, `details`, `interviews`, `tasks`, `workflow`, `customization`, `search`, `search-history`, `workspace-actions`, `sidebar`, `hardening` (larghezze 320–1360 px), `stabilization` (target touch), `brand`, `workspace-visual`, `map` (coordinate, posizioni, vista Mappa, nessuna richiesta esterna). Controlli axe tramite `expectNoA11yViolations` in 15 spec su 19.

La spec `opportunities-sidebar` verifica la sidebar delle opportunità a 320, 390, 768, 1024, 1366 e 1920 px, navbar compressa, tutte le colonne visibili, accessibilità e coerenza bacheca/colonna/cronologia. Usa risposte API isolate e non modifica il database dell'app aperta.

La spec `insights-layout` verifica il carosello, dimensioni uniformi, navigazione, ridimensionamento, scorrimento interno, accessibilità e grafico delle fonti con dati mancanti, singoli e numerosi. Usa risposte simulate senza modificare i dati locali.

La spec `overview-layout` forza lo scorrimento con elenchi simulati lunghi: verifica titoli fermi, pannelli indipendenti, Home senza scorrimento su desktop, divisore centrale, accessibilità e contenuti raggiungibili su telefono e finestre basse.

## Regole

- I test usano solo database temporanei o di test; mai `apps/api/.wrangler/state`.
- E2E e preview usano porte dedicate e `reuseExistingServer: false`: possono girare accanto a un `wrangler dev` sulla porta 8787, ma **non** due esecuzioni E2E in parallelo nello stesso worktree (condividono `.e2e-state`).
- Un fallimento si riporta con l'output completo; non si modificano test o codice solo per farli passare.
- Copertura mancante nota: solo Chromium; nessuna verifica con screen reader reali; nessun test di carico.
