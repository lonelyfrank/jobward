# M0.H — Audit del database

Schema: [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts) · Migrazioni: `0000_init`, **`0001_tenant_integrity`** (nuova) · Test: `apps/api/test/database.test.ts`, `tenant-integrity.test.ts`.

## 1. Verifica di ciò che già funzionava (schema di M0)

| Tema                                | Esito | Evidenza                                                                                                                  |
| ----------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------- |
| FK attive (D1 le applica)           | ✅    | Violazioni rifiutate                                                                                                      |
| CHECK sui vocabolari                | ✅    | Priorità, fase, esito, tipi, ruoli, categorie                                                                             |
| Unique                              | ✅    | `users.email` (minuscola, univoca), etichette univoche per workspace senza distinguere maiuscole                          |
| Intervallo retributivo              | ✅    | `salary_min <= salary_max`                                                                                                |
| Timestamp                           | ✅    | Interi ms UTC generati dal server                                                                                         |
| Concorrenza: limite di un workspace | ✅    | `INSERT … SELECT … WHERE` + `batch()`: 3 richieste simultanee → 1×201, 2×409                                              |
| Concorrenza: primo accesso          | ✅    | `INSERT … ON CONFLICT DO NOTHING` + riletture                                                                             |
| Cascade di bacheca/workspace        | ✅    | Sonda e test: l'eliminazione riesce e rimuove tutto il contenuto, solo quello                                             |
| Archiviazione                       | ✅    | `archived_at` + indice `(workspace_id, archived_at)`; il riepilogo esclude le archiviate                                  |
| Indici                              | ✅    | Presenti per le query note (posizione, workspace+archiviazione, attività aperte per scadenza). Nessuno superfluo evidente |

## 2. Difetto trovato (H-01, P1): nessun isolamento tra workspace **nel database**

Ogni tabella portava `workspace_id`, ma i riferimenti erano **FK semplici**. Sonda sullo schema di M0 (tutte accettate):

| Inserimento                                        | Esito su M0 |
| -------------------------------------------------- | ----------- |
| scheda `workspace=A` su bacheca **e** colonna di B | accettato   |
| scheda su bacheca di A ma colonna di B             | accettato   |
| `card_labels`: scheda di A + etichetta di B        | accettato   |
| attività `workspace=B` su scheda di A              | accettato   |
| `application_details` `workspace=B` su scheda di A | accettato   |
| evento di attività `workspace=B` su scheda di A    | accettato   |

**Dove si garantiva?** Solo (in prospettiva) dal service layer, che in M0 non scrive in quelle tabelle. La domanda della specifica — _una risorsa non deve poter essere associata a una risorsa di un altro workspace, anche con ID formalmente validi_ — richiedeva di garantirlo **anche** nel database: un bug in un servizio di M1 non deve poter violare l'isolamento tra utenti.

## 3. Correzione: migrazione `0001_tenant_integrity`

### FK composite

| Figlio                     | Riferimento                                                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `board_columns`            | `(board_id, workspace_id)` → `boards(id, workspace_id)` · cascade                                                                                                    |
| `cards`                    | `(board_id, workspace_id)` → `boards` · cascade                                                                                                                      |
| `cards`                    | `(column_id, board_id, workspace_id)` → `board_columns(id, board_id, workspace_id)` · **no action** — la colonna è della **stessa bacheca e dello stesso workspace** |
| `application_details`      | `(card_id, workspace_id)` → `cards(id, workspace_id)` · cascade                                                                                                      |
| `custom_field_definitions` | `(board_id, workspace_id)` → `boards` · cascade                                                                                                                      |
| `custom_field_values`      | `(card_id, workspace_id)` → `cards` · `(field_id, workspace_id)` → `custom_field_definitions`                                                                        |
| `card_labels`              | **colonna `workspace_id` aggiunta**; `(card_id, workspace_id)` → `cards`, `(label_id, workspace_id)` → `labels`                                                      |
| `tasks`                    | `(card_id, workspace_id)` → `cards`. `card_id` NULL (attività del workspace): la FK composita non si applica                                                         |

Indici univoci di appoggio: `boards(id, workspace_id)`, `board_columns(id, board_id, workspace_id)`, `cards(id, workspace_id)`, `custom_field_definitions(id, workspace_id)`, `labels(id, workspace_id)`.

### Trigger (dove una FK non basta)

| Trigger                                           | Garanzia                                                                                                                                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activity_events_tenant_{insert,update}`          | scheda, bacheca e **autore** (membro del workspace) appartengono al workspace dell'evento. Una FK composita con `SET NULL` azzererebbe anche `workspace_id` (NOT NULL), quindi serve un trigger |
| `custom_field_values_board_match_{insert,update}` | il campo appartiene alla **stessa bacheca** della scheda (stesso workspace non basta)                                                                                                           |
| `cards_board_change_custom_values`                | una scheda con valori di campi non cambia bacheca finché li ha                                                                                                                                  |

### `RESTRICT` → `NO ACTION` su `cards.column_id` (H-01b)

Con `RESTRICT` (immediato) la riuscita di `DELETE board` dipendeva dall'ordine interno con cui SQLite eseguiva le cascade. `NO ACTION` verifica a **fine istruzione**: una colonna con schede resta non eliminabile da sola, mentre bacheca/workspace (che rimuovono colonne e schede nella stessa istruzione) riescono in modo deterministico. Testato in entrambi i sensi.

### Perché la migrazione è scritta a mano e com'è resa sicura (H-01c)

SQLite non permette `ADD FOREIGN KEY`: le 7 tabelle vanno ricreate. drizzle-kit genera la tecnica copia/rinomina con `PRAGMA foreign_keys=OFF`, **non affidabile su D1**, e nel caso `card_labels` selezionava una colonna inesistente. Analisi richiesta dalla regola "non modificare migrazioni applicate senza analizzare":

- `0000_init` **non è stata toccata**. `0001` è incrementale.
- **Nessun endpoint di M0 inserisce righe** nelle 7 tabelle ricreate: in ogni database prodotto dal codice di M0 sono **vuote** (solo `users`, `workspaces`, `workspace_members` possono contenere dati, e non vengono toccate).
- Per non fidarsi di quest'ipotesi, la migrazione apre con una **guardia**: `CREATE TABLE _m0h_guard (… CHECK (… = 0))`, vi inserisce la somma delle righe delle 7 tabelle, poi la elimina. Se qualcuna non è vuota il `CHECK` fallisce, la transazione viene annullata **prima di qualunque operazione distruttiva**.
- Si eliminano prima i figli, poi i genitori; si ricreano genitori prima dei figli con il **nome finale** (niente rinomine, niente `PRAGMA`).

**Provato:** (1) su un DB creato da M0 **con dati** (utente, workspace, membership) e migrato con `wrangler d1 migrations apply`: dati intatti, 5 trigger, 2 migrazioni registrate; (2) test automatico: su un DB con una riga in `board_columns` la guardia **interrompe** la migrazione, la riga resta e nessun trigger/tabella di guardia viene creato; svuotata la tabella, la migrazione si applica. (3) `pnpm db:check`: schema e snapshot drizzle coerenti (nessuna migrazione spuria).

### Test (`tenant-integrity.test.ts`, 19 test)

Ogni test negativo ha un **controllo positivo** (l'operazione legittima riesce), così non passa "perché tutto fallisce". Eseguiti **senza** la migrazione: 14 falliscono, 5 (positivi e cascata) passano — come atteso.

## 4. Operazioni concorrenti e M1

| Tema                                       | Valutazione                                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Spostamento schede (M1)                    | D1 non ha transazioni interattive: ADR-0004 prevede `batch()` con condizioni nel SQL. Le nuove FK impediscono comunque di spostare una scheda in una colonna di un'altra bacheca (testato anche in `UPDATE`) |
| Creazione di bacheca + colonne da template | `batch()` atomico: le FK composite richiedono `workspace_id` coerente, quindi il servizio deve valorizzarlo in **ogni** `INSERT` (errore immediato altrimenti)                                               |
| Posizioni                                  | Nessun vincolo di unicità (scelta di ADR-0004): l'algoritmo e i test di ribilanciamento sono compito di M1 (R-11)                                                                                            |
| Valori dei campi personalizzati            | Coerenza scheda↔campo: DB (trigger). Validità del valore rispetto al tipo: service layer con `validateCustomFieldValue` (M2) (R-10)                                                                          |
| Archiviazione                              | Una scheda archiviata conserva colonna e dati; il riepilogo la esclude                                                                                                                                       |
| Cambio bacheca di una scheda               | Bloccato dal trigger se ha valori di campi della bacheca di origine: M1 non lo prevede, ma l'invariante vale se lo si introduce                                                                              |

## 5. Limiti

- I **trigger** vivono solo nell'SQL di `0001` (drizzle non li modella); un test ne verifica l'esistenza e la documentazione lo dichiara (R-06). Una futura ricostruzione di tabelle con drizzle-kit **non** li ricreerebbe: va scritta a mano.
- Provato su D1 **locale** (Miniflare/workerd); la migrazione su D1 remoto non è stata eseguita (nessun account).
