# Attività e follow-up — Audit dell'esistente

**Data:** 2026-11-07 · **Baseline:** `origin/main` = `5a0d056eda` · **Natura:** sola analisi, nessuna implementazione.
Indice del pacchetto: [tasks-index.md](tasks-index.md).

Ogni voce indica se il comportamento è stato **verificato leggendo il codice** o solo **dedotto dai documenti**.

## 1. Sintesi

Il modulo non parte da zero, ma neppure da un modello pronto. Esistono **tabella, vocabolario di priorità,
indice, contatori in Overview e due tipi di evento** lasciati da M0; **non esiste alcun percorso di scrittura**,
alcun endpoint, alcuna pagina. L'unica schermata «Attività» è un segnaposto («In arrivo · M3»).

| Elemento                                       | Stato reale                                                                                                                          | Riutilizzabile?                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Tabella `tasks` (0000, ricostruita in 0001)    | Esiste, **mai scritta** da alcun servizio (solo dall'helper di test `seedTask`); vuota nei DB locali; il remoto **non è verificato** | **Sì**, con migrazione additiva (vedi §2)      |
| `PRIORITIES` (5 valori) condiviso con le card  | Esiste, usato da `cards.priority`                                                                                                    | **Sì**, stesso vocabolario                     |
| `createTaskInput` (Zod)                        | Esiste, usa `dueAt` come istante; **solo test**, nessun consumatore                                                                  | **Da sostituire** (semantica data/ora diversa) |
| Eventi `task_added`, `task_completed`          | Nel vocabolario e nel CHECK di `activity_events`; **nessuno li scrive**                                                              | Non necessari (vedi decisione D-06)            |
| Contatori Overview (aperte, scadute, prossime) | Query reali su `tasks`, sempre 0 perché la tabella è vuota                                                                           | **Sì**, da riallineare al nuovo modello        |
| Pagina `/tasks`                                | `ComingSoon` con `EmptyState`                                                                                                        | Da sostituire                                  |
| Voce di navigazione «Attività»                 | Presente (`nav.ts`)                                                                                                                  | Sì                                             |
| Azione rapida `prepare_followup`               | Apre **una nota** con intestazione suggerita; nessuna scadenza, nessun task                                                          | Da ripensare (T3)                              |
| «Prossima azione» della Panoramica             | Derivata **solo dai colloqui** (`overdue`, `record_feedback`, `schedule`)                                                            | Resta; non è un'attività dell'utente (D-11)    |

## 2. Database (verificato in `schema.ts` e nelle migrazioni)

`tasks` (da `0001_tenant_integrity.sql`):

| Colonna                    | Tipo / vincolo                                         | Osservazione                                                  |
| -------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| `id`                       | text PK                                                | UUID applicativo (ADR-0004)                                   |
| `workspace_id`             | text NOT NULL, FK → `workspaces` **ON DELETE CASCADE** | isolamento                                                    |
| `card_id`                  | text NULL                                              | nullo = attività del workspace                                |
| `title`                    | text NOT NULL                                          | **nessun CHECK** su lunghezza o vuoto (a differenza di notes) |
| `description`              | text NULL                                              |                                                               |
| `due_at`                   | integer NULL                                           | istante ms UTC                                                |
| `completed_at`             | integer NULL                                           | nullo = non completata                                        |
| `priority`                 | text NOT NULL DEFAULT `'none'`, CHECK nel vocabolario  | 5 valori                                                      |
| `created_at`, `updated_at` | integer NOT NULL                                       |                                                               |

- **FK composita** `(card_id, workspace_id)` → `cards(id, workspace_id)` **ON DELETE CASCADE**. Con `card_id` nullo la FK
  composita **non si applica** (semantica SQLite): corretto per le attività di workspace, e `workspace_id` resta protetto dalla FK
  semplice. Con `card_id` valorizzato il database **rifiuta** una card di un altro workspace: l'isolamento è già nel motore (ADR-0007).
- Indici: `tasks_workspace_open_due_idx (workspace_id, completed_at, due_at)` e `tasks_card_idx (card_id)`.
- **Mancano:** stato «annullata», tipo, fingerprint di idempotenza, data di scadenza di calendario, CHECK di coerenza,
  tetti per workspace, indici per l'ordinamento operativo.
- **Nessun inbound FK:** nessuna tabella referenzia `tasks`. È una foglia, quindi una ricostruzione (se mai servisse) non innesca cascate.
- **Le card non vengono mai cancellate** dall'API (solo archiviate: `archived_at`, ADR-0004 §6). La cascata su `card_id` è
  raggiungibile soltanto con la cancellazione del workspace o con una futura cancellazione definitiva.
- Il **fuso orario** è per workspace (`workspaces.timezone`, default `UTC`), scelto in onboarding e **non modificabile** da UI né API oggi.

## 3. Contratti e dominio condiviso (verificato)

- `packages/schemas/src/task.ts`: solo `createTaskInput` (title ≤ 200, description ≤ 10.000, `dueAt: instant`, `priority`, `cardId`).
  Nessuno schema di aggiornamento, di risposta, di filtro. Un unico test lo copre (`schemas.test.ts:187`).
- `packages/shared/src/constants.ts`: `ACTIVITY_EVENT_TYPES` contiene `task_added` e `task_completed`; `LIMITS` **non ha** tetti per le attività.
- `packages/shared/src/timeline.ts`: la sanitizzazione dei metadati conosce `taskId` per quei due tipi. **La UI web non li etichetta**
  (nessuna occorrenza in `apps/web`): se mai comparissero nella timeline mostrerebbero un'etichetta di ripiego.
- **Nessuna funzione pura** di classificazione di scadenze, ordinamento o riepilogo esiste in `packages/shared`.
- Date di calendario: precedente solido (`calendarDate`, `applied_on`, `formatCalendarDate` senza conversione di fuso).

## 4. API (verificato)

- Nessun modulo `tasks` in `apps/api/src/modules`; `app.ts` non monta alcuna rotta.
- `services/overview.ts` conta le aperte (`completed_at IS NULL`), le scadute (`due_at < now`) e prende le prime 5 con `due_at >= now`.
  **Rischi se si introduce «annullata»:** le annullate verrebbero contate come aperte; **e** le attività di card archiviate
  continuerebbero a pesare sui contatori. Entrambi i punti vanno corretti insieme al modello.
- I test dei contatori (`overview.test.ts`) popolano `tasks` con `seedTask({ dueAt })` e istanti relativi a `now`: andranno riscritti sul nuovo modello
  in T1 (non sono prove del comportamento a data di calendario).
- Convenzioni da seguire (verificate in `notes`, `documents`, `pipeline`): perimetro `?workspaceId=` + `workspaceScope`, 404 indistinguibile per workspace
  altrui, `parseJsonBody` Zod, ID di creazione generato dal client con replay 200 / payload diverso 409 (fingerprint SHA-256), tetti
  applicati atomicamente nello stesso `INSERT … SELECT`, `D1.batch()` per le operazioni composte, `409` su card archiviata, cursore opaco
  per la paginazione, DELETE → 204.
- Il vocabolario degli errori è chiuso (`API_ERROR_CODES`: nessun codice dedicato a stati/limiti; i servizi esistenti usano `conflict`).

## 5. Frontend (verificato)

- `/tasks` → `TasksPage` in `routes/coming-soon.tsx`; titolo di pagina e voce di menu già presenti.
- Overview (`routes/overview.tsx`): contatore «Attività aperte» con sottotitolo «N scadute» e lista «Prossime scadenze» che usa
  `formatDateTime(task.dueAt)`: **è la sola UI che oggi legge i task** e dovrà passare a una data di calendario.
- Detail della candidatura: sei schede; **nessuna sezione Attività**. La Panoramica ha «Prossima azione» (colloqui) e azioni rapide.
- Blocchi riutilizzabili per un modulo di scrittura (verificati): `useCreationOperation` (ID stabile, payload immutabile, retry senza
  doppioni), `ConfirmDialog`, `Dialog` (centrale, schermo intero a telefono), guardia delle bozze con `useBlocker`/`beforeunload`,
  `Field`/`Input`/`Textarea`, `EmptyState`, `WorkspacePageHeader`, `notify`, pattern `role="status"` per gli annunci, helper E2E `openTab`.
- Ricerca di card per il collegamento: `GET /opportunities?q=` e `GET /search` già filtrano nel workspace.
- Le rotte di dettaglio sono **annidate** (`/boards/:boardId/cards/:cardId`, `/opportunities/cards/:cardId`): un link da una task alla card
  richiede `boardId`, quindi la risposta delle task deve includere un **riepilogo della card** (id, boardId, titolo, azienda, archiviata).

## 6. Test e convenzioni (verificato)

Vitest nei quattro pacchetti (shared 599, schemas 49, web 142, API 389 — conteggi del [rapporto C3](c3-testing-report.md)); API su D1 reale
(`apps/api/test`, `m3-helpers.ts`); RTL nel web; Playwright E2E (176) con helper condivisi e **preview** (13) sulla build con CSP reale;
`db:check` (schema TS = migrazioni), `db:upgrade-test` (fixture popolata → migrazione, conservazione, rollback); test che **enumera le rotte**
`/api/v1` e ne verifica la protezione; axe e matrice responsive 6×2 nei workflow.

## 7. Cosa NON esiste (da non assumere)

Scadenze di calendario · stato «annullata» · tipo `follow_up` · API e UI di attività · paginazione di task · tetti per workspace · funzioni
pure di classificazione · eventi di attività nella timeline · suggerimenti contestuali · persistenza di «suggerimento ignorato» ·
collegamento attività ↔ colloquio · modifica del fuso del workspace.

## 8. Rischi emersi dall'audit

| #   | Rischio                                                                                                             | Dove si gestisce                 |
| --- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| A-1 | La tabella esiste già: un'ipotesi «nuova tabella `tasks`» creerebbe un duplicato o un conflitto di nome             | D-01 (riuso)                     |
| A-2 | `due_at` (istante) dà risultati diversi a seconda del fuso e dell'ora del giorno per un concetto che è «un giorno»  | D-03 (data di calendario)        |
| A-3 | Contatori Overview contano annullate e task di card archiviate                                                      | T1 (stesso commit del modello)   |
| A-4 | `activity_events.type` ha un CHECK: aggiungere tipi obbliga a ricostruire la tabella già ricostruita in 0004 e 0005 | D-06 (non aggiungere tipi)       |
| A-5 | La tabella è vuota **localmente**; non è verificata sul D1 remoto (nessun accesso, nessuna scrittura per vincolo)   | Prerequisito di T1               |
| A-6 | Il vocabolario d'errore è chiuso: i nuovi 409 distinti richiederebbero nuovi codici o `issues` strutturati          | [API](tasks-api-contracts.md) §6 |
