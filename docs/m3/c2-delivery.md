# M3-C2 — Database, pipeline e API

**Data:** 2026-11-06 · **Branch:** `m3-c2-pipeline-notes-api` · **Base:** `af09c94` (stabilizzazione, vedi [ci-stabilization](ci-stabilization.md)) su `origin/main` `ab73c1a`

Nessun push, merge, deploy o operazione su D1 remoto. C3–C5 non sono stati avviati: nessuna modifica a interfaccia, navigazione o design (l'unico tocco al web è nel branch di stabilizzazione).

## Migrazione `0005_m3_c2_notes_documents_dedupe`

Migrazioni `0000`–`0004` invariate. Una sola migrazione, con il suo snapshot drizzle (`db:check` verde).

| Oggetto                         | Cambiamento                                                                                                                                                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `card_notes` (nuova)            | `id` (generato dal client), `workspace_id`, `card_id`, `body` 1–10.000, `request_fingerprint`, `created_at`, `updated_at`, `deleted_at`. FK composita (scheda, workspace) `ON DELETE CASCADE`.                                                            |
| `card_documents` (nuova)        | come sopra + `title` 1–200, `kind` (`cv`, `cover_letter`, `job_posting`, `portfolio`, `other`), `url` (solo `http(s)`), `note`.                                                                                                                           |
| `interviews`                    | `+ request_fingerprint` (NULL per i round esistenti, nessun backfill).                                                                                                                                                                                    |
| `activity_events` (ricostruita) | `+ dedupe_key`, `+ operation_id`, `+ request_fingerprint`; tipo `application_reopened` nel CHECK; indice univoco parziale `(workspace_id, dedupe_key)`; indice parziale `(workspace_id, operation_id)`; due CHECK di coerenza; indici e trigger ricreati. |

**Dove vive il fingerprint** (decisione di C2, richiesta da D5): è una colonna della riga creata (`card_notes`, `card_documents`, `interviews`) o degli eventi della transizione (`activity_events`). È lo SHA-256 della richiesta normalizzata (workspace, scheda, tutti i campi; mai valori generati dal server), scritto una volta e mai ricalcolato dalla versione corrente. Nessuna tabella generica di chiavi di idempotenza, nessun testo riservato nella cronologia.

**Lapide per l'eliminazione.** Eliminare una nota o un documento imposta `deleted_at` e azzera testo, URL, nota e fingerprint (CHECK del database). Un retry tardivo della creazione trova la lapide e riceve 409: non ricrea la risorsa. Le lapidi non contano per i tetti e quelle più vecchie di 30 giorni vengono ripulite alla successiva eliminazione sulla stessa scheda.

**Conservazione dei dati** (guardia nella migrazione, prima di qualunque `DROP`): stesso numero di righe **e** nessuna riga che differisca per id, riferimenti, tipo, metadati, timestamp. Senza `PRAGMA` (non affidabile su D1): `activity_events` è una foglia.

## Contratti API (`packages/schemas`, tutti `strict`)

Tutte le rotte sono sotto `/api/v1`, con `?workspaceId=`. Una risorsa inesistente o di un altro workspace dà sempre 404. Le scritture su candidature archiviate dànno 409; le letture no.

| Rotta                                    | Corpo / query                                                    | Esito                                                                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /cards/:id/pipeline`               | `{ id, to, kind, expectedFrom?, appliedOn?, futureInterviews? }` | 200 `{ card, transition{id,kind,from,to}, replayed, cancelledInterviews, warnings[] }`; 409 stato incompatibile, ID riusato, stato cambiato; 400 input |
| `GET /cards/:id/timeline`                | `?before=<cursore>&limit=1..50` (25)                             | 200 `{ entries[], nextCursor }`                                                                                                                        |
| `GET/POST /cards/:id/notes`              | POST `{ id, body }`                                              | POST 201 prima volta, **200 replay**, 409 ID riusato con richiesta diversa / nota eliminata / tetto 500                                                |
| `PATCH/DELETE /notes/:id`                | PATCH `{ body }`                                                 | DELETE 204, ripetibile (retry dopo risposta persa)                                                                                                     |
| `GET/POST /cards/:id/documents`          | POST `{ id, title, kind?, url?, note? }`                         | come le note; tetto 50                                                                                                                                 |
| `PATCH/DELETE /documents/:id`            | PATCH parziale (`null` azzera `url`/`note`)                      | come le note                                                                                                                                           |
| `POST /cards/:id/interviews` (esistente) | `+ id?` facoltativo                                              | senza `id`: M2.5 invariato (201). Con `id`: 201, replay **200**, 409 se richiesta diversa                                                              |

`id` = `clientIdSchema`: `[A-Za-z0-9_-]{16,64}` (UUID compresi), generato dal client all'apertura del modulo.

### Transizioni (`POST /cards/:id/pipeline`)

Il motore puro di C1 (`evaluatePipelineTransition`) decide; il servizio rivalida e scrive in **una sola `batch()`**:

1. eventi, ciascuno inseribile solo se la scheda ha ancora la fase/esito osservati (compare-and-swap in SQL); il primo è il «claim» dell'operazione (indice univoco `dedupe_key`);
2. facoltativo (`futureInterviews: 'cancel'`, solo chiudendo; predefinito `keep`): annullamento dei colloqui **programmati e futuri**, con un evento ciascuno, solo se il claim esiste;
3. upsert di fase/esito/data di invio (stesso compare-and-swap) e «touch» di scheda e bacheca.

Replay (stesso `id`, stessa richiesta) → 200 con `replayed: true`, nessun nuovo evento, anche se lo stato è andato avanti. Stesso `id` con qualunque campo diverso (o su un'altra scheda) → 409 senza scritture. «Assente» e `keep` sono la stessa richiesta. Un guasto in un qualsiasi inserimento annulla tutto, compresi annullamenti di colloqui e claim: lo stesso `id` riesce poi come prima operazione.

Il modulo Dettagli (`PATCH /cards/:id`) è invariato, tranne che riportare un esito conclusivo a «in corso» registra ora lo stesso evento `application_reopened` (una sola fonte di eventi). L'interfaccia mostra per ora la dicitura generica «Aggiornamento» per il nuovo tipo: l'etichetta dedicata è lavoro di C3.

### Timeline

Eventi di sistema ∪ note, ordine totale `(occurredAt, id, source)` decrescente (la `mergeTimeline` di C1), cursore opaco `[istante, id, source]` che rispetta il tie-break per `source`. Espone solo ID, tipo, istante, entità collegata e metadati della **whitelist** del dominio. Non espone autore, `dedupe_key`, `operation_id`, fingerprint, titoli o note dei colloqui, nomi di colonna. Il testo di una nota compare solo come nota.

## Risultati esatti dei controlli

| Controllo                                                           | Risultato                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck` · `lint` · `format:check`                          | verdi                                                                                                                                                                                                                                                                                                                                                |
| `check:contrast` · `check:config` · `check:brand` · `test:identity` | verdi                                                                                                                                                                                                                                                                                                                                                |
| `pnpm db:check`                                                     | «Migrazioni coerenti con lo schema: OK»                                                                                                                                                                                                                                                                                                              |
| `pnpm db:upgrade-test`                                              | M1 → `0005` (test storico, esteso) **OK**; M2.5 popolato → `0005` **OK** (script `test-migration-m3c2.mjs`, ~2,5 min)                                                                                                                                                                                                                                |
| `pnpm test`                                                         | shared **599**, schemas **49**, web **128**, api **386** — 1.162 passati, 0 falliti (prima di C2: 597 / 43 / 128 / 310)                                                                                                                                                                                                                              |
| `pnpm build`                                                        | verde                                                                                                                                                                                                                                                                                                                                                |
| `pnpm test:e2e` (CI=true)                                           | **153 passati, 1 skipped, 0 falliti, 0 flaky** (10,0 min)                                                                                                                                                                                                                                                                                            |
| `pnpm test:preview`                                                 | **12 passati**                                                                                                                                                                                                                                                                                                                                       |
| Mutation check sulle nuove guardie                                  | 12 guasti iniettati: 10 catturati subito; 1 sopravvissuto reale (guardia «archiviata» dei documenti mascherata da un'altra guardia SQL, ma con messaggio sbagliato) → test rafforzati sul messaggio e ora catturato; 1 mutante **equivalente** (ignorare la lapide nel replay: il fingerprint azzerato produce comunque 409, doppia barriera voluta) |

Test nuovi in `apps/api/test`: `pipeline` (25), `notes` (17), `documents` (11), `timeline` (10), `interview-idempotency` (13) + 6 di schemi e 2 di dominio. Coprono: retry sequenziali, retry dopo risposta persa, payload diverso, concorrenza (identiche / diverse con stesso ID / ID diversi / operazioni diverse sullo stesso stato / tetto a un posto libero), isolamento fra workspace (404, nessuna perdita di informazioni, ID uguali in workspace diversi), errore forzato nell'inserimento di un evento con rollback completo (trigger di guasto), replay dopo modifica, retry tardivo dopo eliminazione, paginazione senza salti né duplicati con istanti e ID ripetuti, cursori manipolati, riservatezza dei metadati.

Lo script M2.5 → `0005` verifica su un database popolato (14 tabelle, 19 eventi: tutti i 17 tipi, 2 workspace, schede aperte/chiuse/archiviate): ogni riga di ogni tabella preesistente identica campo per campo; 27 chiavi esterne con le azioni, tutti gli indici e i 5 trigger identici; `foreign_key_check` pulito; rifiuto dei riferimenti fra workspace; rollback con errore **durante la copia** (guardia) e **dopo la ricostruzione** (schema e dati identici a prima, poi la migrazione riesce); infine `wrangler dev` reale sul database aggiornato: chiusura → riapertura, `application_reopened` con riferimenti corretti nella timeline, retry = un solo evento, nuova chiusura/riapertura = secondo evento, stato legacy «Chiusa» senza esito rifiutato.

## Difetti trovati e corretti durante C2

- Un `CHECK` che valuta a NULL **passa** in SQL: `length(NULL) = 64` lasciava creare note e documenti vivi senza fingerprint. Rilevato dallo script di upgrade; corretto con `coalesce` e coperto da test di database.
- Il test M1 → ultima versione confrontava `SELECT *` di `activity_events`: reso esplicito sulle colonne preesistenti.

## Problemi aperti e rischi

| ID    | Priorità | Descrizione                                                                                                                                                                                                          |
| ----- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C2-01 | P2       | **CI remota non eseguita**: nessun push. Tutto verificato in locale (Linux, Node 22.23.1, Chromium). Da confermare con GitHub Actions su entrambi i branch.                                                          |
| C2-02 | P2       | `0005` ricostruisce `activity_events` anche su D1 remoto: **backup/Time Travel obbligatorio prima del deploy** (R-01). La transazione è provata solo con D1 locale (wrangler); su D1 remoto va provato su una copia. |
| C2-03 | P3       | `GET /cards/:id/notes` non è paginato (fino a 500 note da 10.000 caratteri ≈ 5 MB). La timeline lo è. Valutare un limite prima della scheda Note di C3.                                                              |
| C2-04 | P3       | `PRAGMA integrity_check` non è consentito da D1 (`SQLITE_AUTH`): lo script usa `foreign_key_check` e confronti strutturali. Le FK si leggono dal DDL perché `pragma_foreign_key_list` come tabella è bloccata.       |
| C2-05 | P3       | Le lapidi restano fino a 30 giorni dopo l'ultima eliminazione sulla scheda; senza altre eliminazioni persistono (poche decine di byte, nessun dato utente).                                                          |
| C2-06 | P3       | Gli eventi creati prima di C2 non hanno chiavi: i retry di PATCH/azioni M2 non sono idempotenti (fuori perimetro D5, che riguarda colloqui, note, documenti e transizioni).                                          |
| C2-07 | P3       | `application_reopened` appare nel dettaglio scheda come «Aggiornamento» finché C3 non aggiunge l'etichetta.                                                                                                          |
| C2-08 | P3       | Cancellazione dei colloqui futuri: «futuro» = programmato con data ≥ ora della richiesta; i «da programmare» restano (scelta conservativa, da confermare in C3 con la UX del dialogo).                               |
| C2-09 | Info     | `wrangler` mostra ancora `database_name` `meet-roulette` (etichetta D1 persistente conservata da ADR-0014).                                                                                                          |

Problemi M3 ereditati: **M3-01** (riapertura senza traccia) e **M3-02** (retry di creazione colloquio duplicabile) **risolti**. M3-03 resta come in C1.

## Readiness per M3-C3

**Pronto, con riserve C2-01 e C2-03.** Il backend offre quanto C3 richiede: transizioni con conferma/avvisi (`warnings`, `cancelledInterviews`), idempotenza per ogni creazione (il client deve generare l'ID all'apertura del modulo e riusarlo per i retry), note e documenti con tetti e lapidi, timeline paginata e riservata. Prima di C3 conviene: far girare la CI remota; decidere se paginare le note; aggiungere l'etichetta di `application_reopened` nella cronologia.

## File

Nuovi: `packages/database/migrations/0005_m3_c2_notes_documents_dedupe.sql` e `meta/0005_snapshot.json`; `packages/schemas/src/{pipeline,note,document,timeline}.ts`; `apps/api/src/services/{idempotency,pipeline,notes,documents,timeline}.ts`; `apps/api/src/modules/{notes,documents}/routes.ts`; `scripts/test-migration-m3c2.mjs`; test API `{pipeline,notes,documents,timeline,interview-idempotency}.test.ts` e `m3-helpers.ts`.
Modificati: `packages/database/src/schema.ts`, `migrations/meta/_journal.json`; `packages/shared/src/constants.ts` (+ `timeline.test.ts`); `packages/schemas/src/{index,primitives,interview,schemas.test}.ts`; `apps/api/src/{app.ts,modules/cards/routes.ts,services/cards.ts,services/interviews.ts}`; `apps/api/test/database.test.ts`; `scripts/test-migration-upgrade.mjs`; `package.json` (`db:upgrade-test`).
