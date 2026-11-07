# Attività e follow-up — Architettura proposta

**Stato:** proposta, **nessun file SQL, endpoint o componente creato** · **Baseline:** `5a0d056eda`.
Indice: [tasks-index.md](tasks-index.md) · Contratti: [tasks-api-contracts.md](tasks-api-contracts.md).

## 1. Principi

1. **Riuso** della tabella `tasks` esistente: migrazione **additiva** (nessuna ricostruzione).
2. **Una sola verità**: stato e condizione temporale si **derivano**; non si memorizzano valori ridondanti.
3. **Dominio puro** in `packages/shared` (nessun I/O, nessun `Date.now()` interno): `oggi` è sempre un argomento.
4. **Isolamento garantito dal motore** (FK composita già presente) **e** dal service layer (`workspaceScope`).
5. **Coerenza con M3-C2**: ID del client, fingerprint, tetti atomici, cursore opaco, `D1.batch()`.
6. Nessuna dipendenza nuova.

## 2. Mappa dei moduli

| Livello    | File (da creare in T1–T3)                                          | Contenuto                                                                                             |
| ---------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `shared`   | `tasks.ts`, `task-dates.ts`, `task-suggestions.ts` (+ test)        | vocabolari, stato derivato, classificazione, ordinamento, riepilogo, suggerimenti — **funzioni pure** |
| `shared`   | `constants.ts` (esteso)                                            | `TASK_KINDS`, nuovi `LIMITS` (tetti, pagina)                                                          |
| `schemas`  | `task.ts` (riscritto)                                              | input di creazione/modifica/filtri, risposte, cursore                                                 |
| `database` | `schema.ts`, migrazione `0006_…sql`, snapshot                      | colonne, CHECK, indici                                                                                |
| `api`      | `services/tasks.ts`, `modules/tasks/routes.ts`                     | CRUD, comandi di stato, riepilogo; `services/overview.ts` riallineato                                 |
| `web`      | `features/tasks/*`, `routes/tasks.tsx` (sostituisce `coming-soon`) | pagina, riga, modulo, hook, sezione nella candidatura, suggerimenti                                   |

## 3. Dominio puro (`packages/shared`)

Tutte le funzioni sono deterministiche e testabili senza I/O.

```ts
export const TASK_KINDS = ['general', 'follow_up', 'preparation'] as const;
export type TaskStatus = 'open' | 'done' | 'cancelled';
export type TaskDue = 'overdue' | 'today' | 'soon' | 'later' | 'none';
export const TASK_SOON_DAYS = 3;

taskStatus({ completedAt, cancelledAt }): TaskStatus       // cancelledAt ha precedenza solo in caso di dati incoerenti
localDate(instantMs, timeZone): string                      // 'YYYY-MM-DD' nel fuso IANA (Intl, mai Date locale)
addDays(date: string, n: number): string                    // aritmetica su giorni di calendario (epoch-day UTC, senza DST)
daysBetween(from: string, to: string): number               // differenza intera di giorni di calendario
classifyDue(dueOn: string | null, status: TaskStatus, today: string): TaskDue   // solo `open`; altrimenti 'none'
completedLate(dueOn, completedAt, timeZone): boolean
compareTasks(a, b): number                                  // ordine operativo: dueOn ASC (null ultimo), priorità DESC, createdAt ASC, id ASC
summarizeTasks(rows, today): { open, today, overdue, noDue, done }   // usata dai test come oracolo dell'SQL
taskDueLabel(...)                                           // NON qui: i testi italiani stanno nel web
```

Regole implementative:

- `localDate` usa `Intl.DateTimeFormat('en-CA', { timeZone, year, month, day })` con `formatToParts`; un fuso non valido solleva errore (il fuso del workspace è già validato da `timezoneSchema`).
- `addDays`/`daysBetween` convertono `YYYY-MM-DD` in **giorni da epoca UTC** (`Date.UTC(y, m-1, d) / 86_400_000`): niente fuso, niente DST, anni bisestili corretti.
- Nessuna funzione legge l'orologio; i servizi passano `Date.now()` una sola volta e lo convertono con `localDate`.
- Il test di parità **SQL ↔ funzione pura**: lo stesso insieme di righe deve produrre gli stessi conteggi e lo stesso ordine con `summarizeTasks`/`compareTasks` e con la query (oracolo).

## 4. Schema dati proposto (D1/Drizzle)

Numero di migrazione: **`0006`** (ultima esistente `0005_m3_c2_notes_documents_dedupe.sql`; da riconfermare all'avvio di T1). Nome suggerito: `0006_m3_t1_tasks.sql`.

### 4.1 Cambiamenti alla tabella `tasks`

| Colonna               | Tipo / vincolo                                                                                                             | Note                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `kind`                | `text NOT NULL DEFAULT 'general' CHECK (kind IN ('general','follow_up','preparation'))`                                    | **nuova**                                                                  |
| `due_on`              | `text NULL CHECK (due_on IS NULL OR (due_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(due_on) = due_on))` | **nuova**; `date()` restituisce NULL per date impossibili (30 febbraio)    |
| `cancelled_at`        | `integer NULL`                                                                                                             | **nuova**                                                                  |
| `request_fingerprint` | `text NULL CHECK (request_fingerprint IS NULL OR length(request_fingerprint) = 64)`                                        | **nuova**; SHA-256 della richiesta di creazione, mai testo riservato       |
| `due_at`              | invariata                                                                                                                  | **legacy, non più letta né scritta**; resta per non ricostruire la tabella |
| (table CHECK)         | `tasks_not_done_and_cancelled`: `completed_at IS NULL OR cancelled_at IS NULL`                                             | impedisce stati contraddittori                                             |
| (table CHECK)         | `tasks_title_valid`: `length(title) BETWEEN 1 AND 200`                                                                     | oggi assente                                                               |
| (table CHECK)         | `tasks_description_valid`: `description IS NULL OR length(description) <= 2000`                                            |                                                                            |

Nel **modello TypeScript** i tre vincoli «(table CHECK)» sono `check()` di tabella; nell'**SQL della migrazione** sono scritti come CHECK di colonna sulle colonne nuove (`cancelled_at`, `kind`), per il motivo qui sotto.

**Strategia di migrazione ([D-13](tasks-decision-register.md)).** In SQLite `ALTER TABLE … ADD COLUMN` non aggiunge CHECK di tabella, ma accetta un CHECK **di colonna che
referenzia altre colonne** della stessa riga. Verificato con un esperimento isolato (SQLite 3.51.2, tabella `tasks` con una riga legacy):

| Prova                                                                    | Esito                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| CHECK sulla colonna nuova che usa `completed_at`/`title` (altre colonne) | accettato                                                          |
| `INSERT` con `completed_at` e `cancelled_at` entrambi valorizzati        | **rifiutato**                                                      |
| `UPDATE` che porta la riga nello stesso stato incoerente                 | **rifiutato**                                                      |
| titolo vuoto, `kind` non valido, `due_on = '2026-02-30'`                 | **rifiutati**                                                      |
| riga legacy preesistente (`due_at` valorizzato)                          | **conservata** identica                                            |
| `ADD COLUMN … CHECK` quando una riga legacy lo viola                     | la migrazione **si interrompe** (guardia naturale, non silenziosa) |

Opzioni valutate:

| Opzione                                                                             | Pro                                                                                  | Contro                                                                                                |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **A. Solo `ADD COLUMN`** con CHECK di colonna (anche cross-colonna), nessun trigger | **nessuna ricostruzione, nessun rischio sui dati**, invarianti nel motore (ADR-0007) | i CHECK di tabella vivono attaccati alle colonne nuove (semanticamente curioso; documentato nell'SQL) |
| B. Ricostruzione guidata di `tasks` (stile 0004/0005)                               | SQL finale «pulito»                                                                  | ricostruisce una tabella senza necessità; richiede guardia e prove di conservazione                   |
| C. Invarianti solo nel service layer                                                | più semplice                                                                         | contraddice ADR-0007 (difesa in profondità): scartata                                                 |

**Raccomandazione: A.** Il modello TypeScript dichiara comunque i CHECK come di tabella (`check(...)`): `db:check` confronta **schema TS ↔ snapshot di drizzle**, non il testo SQL,
quindi non vede la differenza; per evitare derive fra SQL scritto a mano e schema si aggiunge un **test di presenza dei vincoli** (apertura di `tasks` su D1 reale: ogni invariante
viene violato di proposito e deve essere rifiutato). Da confermare in T1 con un primo passo di verifica sul runtime D1 locale (workerd), che è il runtime dei test API.

**Condizioni vincolanti** (stile D4 del [piano M3](plan.md)): nessuna modifica a `0000`–`0005`; `db:upgrade-test` esteso con una fixture ferma a `0005` **che contiene task legacy**
(con `due_at`, card collegata, più workspace) → applica `0006` → confronta riga per riga i valori, esegue `foreign_key_check` e prova il rifiuto di riferimenti fra workspace;
prova che una riga legacy incoerente interrompe la migrazione senza lasciare uno schema parziale; il test esistente M1 → ultima versione resta.

### 4.2 Indici

| Indice                                                                                              | Serve a                                    |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `tasks_open_due_idx (workspace_id, due_on, id) WHERE completed_at IS NULL AND cancelled_at IS NULL` | elenco operativo, contatori, ordinamento   |
| `tasks_done_idx (workspace_id, completed_at, id) WHERE completed_at IS NOT NULL`                    | elenco «Completate» (ordine decrescente)   |
| `tasks_card_idx (card_id)` (esistente) → `(workspace_id, card_id, due_on)`                          | sezione «Attività» di una candidatura      |
| `tasks_workspace_open_due_idx` (esistente)                                                          | **eliminato**: basato su `due_at` (legacy) |

Le annullate si leggono con scansione del workspace (insieme piccolo: tetto 5.000 totali): nessun indice dedicato.

### 4.3 Integrità e tenant

- `workspace_id` NOT NULL con FK `ON DELETE CASCADE` (invariata).
- FK composita `(card_id, workspace_id) → cards(id, workspace_id)` `ON DELETE CASCADE` (invariata): una card di un altro workspace è **rifiutata dal motore**; con `card_id` nullo la FK non si applica (corretto).
- **L'archiviazione non è nel motore:** «non si crea né modifica una task di una card archiviata» è una guardia SQL nello stesso `INSERT … SELECT`/`UPDATE … WHERE` (come note e colloqui), verificata da test.
- Cancellazione: **task** — nessuna cancellazione definitiva (v. §7); **card** — non cancellabili da API; se rimosse, le task cadono con la card; **workspace** — cascata su tutto, come oggi.
- Nessun trigger nuovo (opzione A).

### 4.4 Tetti atomici

Nella creazione: `INSERT INTO tasks … SELECT … WHERE (SELECT count(*) FROM tasks WHERE workspace_id = ? AND completed_at IS NULL AND cancelled_at IS NULL) < 500 AND (SELECT count(*) FROM tasks WHERE workspace_id = ?) < 5000 [AND EXISTS(card non archiviata del workspace)]`.
Se `meta.changes = 0` si rilegge per distinguere: replay (ID esistente, stesso fingerprint), payload diverso, tetto, card assente/archiviata. La **riapertura** applica lo stesso tetto delle aperte nell'`UPDATE … WHERE`.

### 4.5 Idempotenza e fingerprint

Come per le note: `request_fingerprint = SHA-256(canonicalJson([ 'task:create', { workspaceId, id, title, description, kind, priority, dueOn, cardId } ]))`, calcolato **dal payload normalizzato originale**, mai ricalcolato dalla riga corrente. Stesso ID + stesso fingerprint → **200** con la risorsa esistente; stesso ID + fingerprint diverso → **409**. La chiave primaria è la garanzia di unicità (un `SELECT` seguito da `INSERT` non basta).

### 4.6 Backup e migrazioni

Additiva rispetto a `0005`; non modifica `0000`–`0005`. Applicazione remota **non** in T1 (nessun deploy): prima di qualsiasi applicazione su D1 remoto, backup/Time Travel e **conteggio in sola lettura** di `tasks` (atteso 0). Impatto sul backup: nessuno; sull'export (M4): il nuovo formato è per-entità, senza ID opachi di Cloudflare.

## 5. Mutazioni e concorrenza

| Operazione                  | Meccanismo                                                                                                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crea                        | `INSERT … SELECT` guardato (tetti, card), PK + fingerprint per l'idempotenza                                                                                                     |
| Modifica campi              | **compare-and-swap** su `updated_at`: `UPDATE … WHERE id=? AND workspace_id=? AND updated_at=?`; `changes = 0` → rilettura → 404 o 409                                           |
| Completa / Riapri / Annulla | **comandi idempotenti per stato**: stato già raggiunto → 200 senza ritoccare i timestamp; transizione non ammessa → 409; `UPDATE … WHERE` con la condizione di stato di partenza |
| Monotonia                   | `updated_at = max(now, vecchio + 1)`: il token cambia **sempre**, anche con due scritture nello stesso millisecondo                                                              |

Una colonna `revision` è stata valutata e scartata (D-10): `updated_at` monotono è sufficiente, senza colonna aggiuntiva; si può aggiungere in modo additivo.
Le scritture singole sono una sola istruzione (atomica per D1); non servono transazioni interattive. Nessuna operazione compone più tabelle.

## 6. Eventi e Timeline

**Decisione ([D-06](tasks-decision-register.md)): nessun nuovo tipo in `activity_events`.**

| Opzione                                                                                        | Esito                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Riusare `task_added`/`task_completed`, scrivendoli                                          | nessuna migrazione, ma **riapertura, annullamento e cambio scadenza non hanno evento**; una «completata» riaperta resta nello storico → timeline in contraddizione con la lista     |
| B. Aggiungere `task_reopened`, `task_cancelled` → **terza ricostruzione** di `activity_events` | storico completo, ma 3ª ricostruzione di una tabella già ricostruita in 0004 e 0005; rischio R-01 ripetuto per un beneficio basso; vietato proporlo senza alternative: eccole sotto |
| **C. Voci derivate dalle righe di `tasks` (come le note)**                                     | **scelta**: nessuna ricostruzione, nessuna duplicazione (il fatto vive in una sola tabella), coerente con piano M3 §4 (`card_notes` → timeline)                                     |
| D. Tabella `task_events` dedicata                                                              | scartata: tabella nuova e una terza fonte da fondere per un valore marginale                                                                                                        |

Con **C**, la Timeline di una candidatura (T3) aggiunge una **terza fonte** `source: 'task'` con tre voci derivabili per task con card: `task_created` (`createdAt`), `task_completed` (`completedAt`), `task_cancelled` (`cancelledAt`).
`id` di voce = `<taskId>:created|completed|cancelled`; l'ordine totale esistente `(occurredAt desc, id desc, source desc)` resta valido, così come il cursore. Le voci riportano **titolo** della task?
**No: solo `taskId`, tipo di voce e `kind`** (nessun testo libero nei metadati, come per il resto della cronologia; il titolo si legge dall'entità collegata se ancora presente).
`task_added`/`task_completed` restano nel vocabolario come **riservati e non scritti** (documentato) per non produrre duplicati.

**Attività generale (workspace):** nessun registro eventi di workspace in UI; le righe sono il registro.

## 7. Eliminazione e annullamento ([D-05](tasks-decision-register.md))

| Opzione                                       | Esito                                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DELETE definitivo senza lapide                | un retry tardivo di `POST` ricreerebbe la task cancellata (rischio dichiarato in piano M3 §1.2)                                                         |
| DELETE con lapide (come note/documenti)       | corretto ma aggiunge colonne, CHECK e logica di «scrubbing» per un'azione poco frequente                                                                |
| **Solo annullamento (nessuna cancellazione)** | **scelta per T1–T4**: reversibile, idempotente, nessuna lapide; costo: le annullate restano (tetto totale 5.000) e sono visibili nel filtro «Annullate» |

La cancellazione definitiva (e il relativo svuotamento) è rimandata a una decisione separata legata all'esportazione/pulizia dati (M4).

## 8. Suggerimenti contestuali (`task-suggestions.ts`)

```ts
suggestTasks({ status, appliedOn, interviews: { id, sequence, status, scheduledAt, completedAt, createdAt }[],
               tasks: { kind, status, createdAt }[], today, timeZone, dismissed: ReadonlySet<string> }): TaskSuggestion[]
// TaskSuggestion = { key: string, rule: 'S1'|'S2'|'S3', kind, title, dueOn, anchor: string }
```

- **Pura**: nessuna lettura di database; la UI passa i dati già caricati (card, colloqui, task della card).
- `key = rule + ':' + anchor` (S1: `appliedOn` o `'none'`; S2/S3: `interviewId`): stabile per il «non ora».
- Restituisce **al più una** suggestion per volta, con priorità S3 > S2 > S1, e solo per card **non archiviata e non chiusa** (le chiuse non hanno più follow-up da pianificare in modo proattivo).
- Il «non ora» è memorizzato in `localStorage` con chiave qualificata dal workspace (`jobward:task-suggestion:<workspaceId>:<key>`), con `try/catch` (lo storage può non esserci) e senza dati riservati ([D-09](tasks-decision-register.md)).
- Le regole e i loro anchor sono in [product-spec §8](tasks-product-spec.md); i casi di prova in [testing-plan](tasks-testing-plan.md).

## 9. Impatto su moduli esistenti

| Modulo                                     | Cambiamento                                                                                                                   | Checkpoint         |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `services/overview.ts`, `OverviewResponse` | `openTasks`/`overdueTasks`/`upcomingTasks` da `due_on`, `cancelled_at`, card non archiviate; `dueAt` → `dueOn` nella risposta | T1 (API) + T2 (UI) |
| `routes/overview.tsx`                      | «Prossime scadenze» usa `formatCalendarDate`; contatore invariato nella forma                                                 | T2                 |
| `createTaskInput` + test                   | riscritto                                                                                                                     | T1                 |
| `routes/coming-soon.tsx`                   | `TasksPage` rimossa                                                                                                           | T2                 |
| `quickActions.prepare_followup`            | da «nota con intestazione» a «pianifica follow-up» (apre il modulo task)                                                      | T3                 |
| `timeline.ts` + UI Timeline                | terza fonte `task`                                                                                                            | T3                 |
| `refreshWorkflow` (cache web)              | invalida `tasks` e riepilogo dopo mutazioni; **pipeline/archiviazione** invalidano anche le task della card                   | T2/T3              |
| Test API contatori                         | riscritti                                                                                                                     | T1                 |

## 10. Cache e coerenza lato web

- Chiavi TanStack Query qualificate dal workspace: `['tasks', workspaceId, view, cardId?]` e `['tasks', workspaceId, 'summary']`.
- Dopo una mutazione: invalidare le liste coinvolte, il riepilogo, l'Overview e la sezione della card; **nessun aggiornamento ottimistico** della classificazione (la risposta porta `today`).
- Ogni risposta include `today` e `timeZone` del workspace: la UI classifica con **quella** data, non con l'orologio del browser (evita il disallineamento a mezzanotte fra dispositivi).
- Archiviazione di una card: invalida le liste di task (le task della card escono dall'elenco operativo).
