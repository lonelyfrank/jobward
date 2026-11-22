# Backend

**Stato:** canonico · **Verificato su:** `jobward-v1` `b34c032` (2026-11-22, PID-01: conteggi, moduli e invarianti; suite non rieseguita). Endpoint in [API-CONTRACTS](API-CONTRACTS.md); sicurezza in [SECURITY](SECURITY.md); dati in [DATA-MODEL](DATA-MODEL.md).

## Stack

Cloudflare Worker con **Hono**, D1 (SQLite) tramite `drizzle-orm` e SQL esplicito (`d1.prepare`), `jose` per la verifica dei JWT di Cloudflare Access, Zod tramite `@jobward/schemas`. Lo stesso Worker serve la SPA con il binding `ASSETS` (`run_worker_first: ["/api/*"]`): un'unica origine, nessun CORS. Nessun KV, R2, Durable Object o coda. Versioni motivate in [ADR-0002](decisions/0002-stack-and-versions.md).

## Catena di una richiesta (`apps/api/src/app.ts`)

```text
requestId → requestLogger → apiSecurityHeaders            (tutte le richieste)
/api/health                                               (pubblica)
/api/v1/*: csrfGuard → payloadLimit → db → authenticate   (tutte)
  rotte di dominio: workspaceScope (membership, ?workspaceId) → idParam → handler → service
```

## Strati

| Strato       | Dove                              | Responsabilità                                                                                                                                                                                                             |
| ------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rotte        | `src/modules/<risorsa>/routes.ts` | Parsing (`parseJsonBody`, `parseQuery`), chiamata al servizio, validazione della risposta                                                                                                                                  |
| Servizi      | `src/services/*.ts`               | Regole applicative e SQL, sempre filtrate per `workspace_id` preso dal contesto (mai dal corpo)                                                                                                                            |
| Dominio puro | `packages/shared/src`             | Pipeline e transizioni, ordinamento, attività, suggerimenti, timeline, colloqui, motore di query (`smart-query`, `smart-filter`), insights (`computeInsights`), aziende (chiave di normalizzazione): funzioni pure testate |
| Persistenza  | `packages/database`               | Schema, migrazioni, vincoli e trigger di integrità                                                                                                                                                                         |

## Logica di dominio rilevante

- **Pipeline** (`services/pipeline.ts`): rivalida con `evaluatePipelineTransition`, poi un solo `batch`: evento con `dedupe_key` univoco (claim), eventuale annullamento dei colloqui futuri, upsert dei dettagli con confronto e scambio, aggiornamento di scheda e bacheca. Un fallimento → controllo di replay → 409.
- **Transizioni ammesse** (`packages/shared/src/pipeline-transitions.ts`): `advance` solo in avanti tra stati aperti; `close` verso rejected/withdrawn/no_response, `hired` solo da `offer`; `reopen` da chiuso a qualsiasi aperto; `correction` verso qualsiasi stato non archiviato; nessuna transizione da o verso `archived`. Conferma obbligatoria per tutto tranne `advance`.
- **Candidature** (`services/applications.ts`, v1): elenco con snapshot, nuova candidatura (solo se la corrente è chiusa o assente, idempotente per id), correzione di data d'invio e canale. La pipeline crea la candidatura n. 1 con snapshot al primo avanzamento. `PATCH /cards/:id` non scrive più fase/esito/data ([ADR-0017](decisions/0017-local-v1-baseline.md)).
- **Eventi** (`services/events.ts`, `cards.ts`, `interviews.ts`, `pipeline.ts`): solo eventi significativi, metadati in whitelist (`packages/shared/src/timeline.ts`). Le attività non scrivono eventi: la timeline le deriva dalle righe.
- **Aziende** (`services/companies.ts`): elenco, dettaglio, modifica; chiave di normalizzazione per l'avviso dei duplicati (`GET /opportunities/duplicates`).
- **Viste salvate** (`services/saved-views.ts`): al massimo 50 per workspace.
- **Insights, Calendario, Esportazione** (`services/insights.ts`, `calendar.ts`, `export.ts`): letture aggregate; il calendario accetta intervalli di al massimo 62 giorni; l'esportazione JSON **non include** ancora `companies` e `saved_views`.
- **Ordinamento** (`services/ordering.ts` + `packages/shared/src/ordering.ts`): lettura dei vicini, decisione pura `placeAfter`, scrittura in `batch` con guardia; ribilanciamento con `UPDATE … FROM`.
- **Ricerca** (`services/search-text.ts`): sottostringa letterale con `instr(lower(…))` e piegatura degli accenti, **senza `LIKE`** (D1 limita i pattern a 50 byte). Questo supera di fatto [ADR-0011](decisions/0011-search-and-table-state.md), che resta formalmente «Accettato»: vedi [AUDIT-REPORT](../status/AUDIT-REPORT.md#incongruenze-documentali).
- **Filtri** (`services/opportunities.ts`, contratto in `packages/schemas/src/opportunity.ts`): AND tra gruppi, OR nel gruppo, valore `none` per «non specificato». Il motore di query condiviso TS/SQL (`packages/shared/src/smart-query.ts` in memoria, `services/query-sql.ts` su SQL: `compileWhere`/`compileOrderBy`) è integrato in v1; la parità tra i due è provata da `test/query-parity.test.ts` ([motore di query](smart-query-engine.md)).

## Limiti e invarianti applicativi

Un workspace posseduto per utente; tetti (100 bacheche per workspace; per bacheca 30 colonne e 2000 schede, [ADR-0008](decisions/0008-kanban-ordering-and-board-loading.md)); massimo 500 attività aperte; corpo ≤ 64 KiB. Valori in `packages/shared/src/constants.ts` (`LIMITS`).

## Codice dormiente noto

Ruoli `editor`/`viewer` non assegnabili · codice di errore `rate_limited` mai usato · tipi di evento `contact_logged`, `task_added`, `task_completed` mai emessi · `quickActions` non usato fuori dal suo test · `THEME_PREFERENCES` senza endpoint · schemi `meResponse`, `workspaceResponse`, `overviewResponse` non applicati · `users.display_name` e `tasks.due_at` non usati.

## Test

35 file in `apps/api/test/` (più gli helper) eseguiti con `@cloudflare/vitest-plugin` nel runtime Workers su D1 con le migrazioni reali. Esito dell'ultima esecuzione completa: [AUDIT-REPORT](../status/AUDIT-REPORT.md#verifiche-v1). Elenco e ambiti in [TESTING](../development/TESTING.md).
