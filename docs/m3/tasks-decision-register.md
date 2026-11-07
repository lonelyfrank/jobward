# Attività e follow-up — Registro e matrice delle decisioni

**Stato:** le decisioni sotto sono **raccomandazioni; quelle elencate in «Approvazioni» sono state approvate dall'utente il 2026-11-07** (alcune con condizioni). Nessuna è stata applicata al codice. · **Baseline:** `5a0d056eda`.
Indice: [tasks-index.md](tasks-index.md). Ogni decisione riporta la **reversibilità**: quelle «onerose» vanno approvate prima di M3-T1, perché toccano dati o contratti pubblici.

## Approvazioni del 2026-11-07

| ID   | Esito                     | Condizione dell'utente                                      | Stato della condizione                                                                                                 |
| ---- | ------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| D-01 | Approvata con condizione  | previa verifica di schema e dati                            | locale verificata; **D1 remoto non verificabile** (nessun database nell'account accessibile) → **in sospeso**          |
| D-03 | Approvata                 | —                                                           | —                                                                                                                      |
| D-05 | Approvata                 | —                                                           | —                                                                                                                      |
| D-06 | Approvata con condizione  | dichiarare i limiti rispetto a un registro storico completo | **soddisfatta**: sei limiti elencati in [readiness §4](m3-t1-readiness.md)                                             |
| D-13 | Approvata con condizione  | subordinata alla verifica su D1                             | runtime D1 locale (workerd) **verificato**; remoto **in sospeso**: comandi in [readiness §3.3](m3-t1-readiness.md)     |
| —    | Estensione Overview       | obbligatoriamente retrocompatibile                          | **proposta corretta**: `dueAt` resta intero (derivato), `dueOn` e due contatori solo additivi; test di contratto in T1 |
| —    | Roadmap T0→T1→T2→T3→C4→C5 | —                                                           | confermata                                                                                                             |

Le altre decisioni (D-02, D-04, D-07…D-12, D-14) **non sono state oggetto di approvazione esplicita**: restano raccomandazioni, ma non sono fra quelle indicate come bloccanti.
**Correzione emersa alla verifica:** D-03 prevedeva `dueAt → dueOn` nell'Overview (breaking): **ritirato**. Vedi [readiness §5](m3-t1-readiness.md).

---

## Sintesi

| ID   | Questione                             | Scelta raccomandata                                                                  | Reversibilità                    | Richiede approvazione prima di T1 |
| ---- | ------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------- | --------------------------------- |
| D-01 | Entità                                | **Una** Task con `kind` (riuso della tabella `tasks`)                                | media (separare dopo è costoso)  | **Sì**                            |
| D-02 | Stati persistenti                     | `open`/`done`/`cancelled`, **derivati** da `completedAt`/`cancelledAt`               | facile (colonna additiva)        | no                                |
| D-03 | Scadenze                              | **Solo data di calendario** (`due_on`)                                               | media (ora aggiungibile dopo)    | **Sì**                            |
| D-04 | Collegamento alla card                | Facoltativo, ricollegabile, `ON DELETE CASCADE`                                      | media                            | no                                |
| D-05 | Cancellazione e archiviazione         | Nessuna cancellazione definitiva; annulla; card archiviata = sola lettura ed esclusa | facile (DELETE aggiungibile)     | **Sì**                            |
| D-06 | Eventi                                | Voci di Timeline **derivate dalle righe**; nessun nuovo tipo in `activity_events`    | facile (si può aggiungere audit) | **Sì**                            |
| D-07 | Paginazione                           | **Cursore** opaco                                                                    | difficile (contratto pubblico)   | no                                |
| D-08 | Limiti per workspace                  | 500 aperte · 5.000 totali · 200/2.000 caratteri                                      | facile (costanti)                | no                                |
| D-09 | Suggerimenti                          | Calcolati, mai creano; «Non ora» **per dispositivo**                                 | facile                           | no                                |
| D-10 | Idempotenza e concorrenza             | ID client + fingerprint; CAS su `updated_at` monotono; comandi idempotenti           | media                            | no                                |
| D-11 | Task manuali vs scadenze dei colloqui | **Separate**; nessun legame task↔colloquio in T1–T4                                  | facile (`interview_id` additivo) | no                                |
| D-12 | Task di candidature chiuse            | Restano valide e modificabili; la chiusura **informa**, non annulla                  | facile                           | no                                |
| D-13 | Strategia di migrazione               | **Solo `ADD COLUMN`** con CHECK cross-colonna; nessuna ricostruzione                 | n/a (additiva)                   | **Sì**                            |
| D-14 | Vocabolario d'errore                  | Nessun nuovo `ApiErrorCode`; tutti i 409 `conflict`                                  | facile (campo `reason` additivo) | no                                |

---

## D-01 — Task unica con tipi, o più entità?

|                        |                                                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Alternative**        | (a) una **Task** con `kind` (`general`/`follow_up`/`preparation`) sulla tabella esistente · (b) tabelle separate `tasks` e `follow_ups` · (c) nuova tabella `tasks_v2`                            |
| **Vantaggi di (a)**    | un solo elenco, un solo ordinamento, un solo insieme di API/contatori; riusa tabella, FK composita e indice già presenti; follow-up «reale» senza duplicare logica                                |
| **Svantaggi di (a)**   | un campo `kind` da mantenere; eventuali attributi specifici del follow-up andrebbero in colonne nullable                                                                                          |
| **Rischi**             | tentazione di aggiungere tipi: ogni tipo nuovo ha un costo in UI e suggerimenti → si limitano a tre                                                                                               |
| **Perché non (b)/(c)** | (b) due elenchi da fondere e due ordinamenti; nessuna esigenza strutturale incompatibile emersa dall'audit. (c) duplicherebbe una tabella che esiste, vuota, e già conforme all'isolamento tenant |
| **Scelta**             | **(a)**                                                                                                                                                                                           |
| **Impatto**            | T1: colonna `kind`; T2: icona/etichetta, filtro; T3: suggerimenti usano `kind`; se mai servisse separare, si migra con `kind` come discriminante                                                  |

## D-02 — Stati persistenti minimi

|                      |                                                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Alternative**      | (a) colonna `status` + timestamp · (b) **solo timestamp** (`completedAt`, `cancelledAt`), stato derivato · (c) più stati (`in_progress`, `blocked`, `snoozed`) |
| **Vantaggi di (b)**  | una sola verità; `completedAt` già esiste ed è usato da Overview; il CHECK impedisce l'incoerenza; nessun backfill                                             |
| **Svantaggi di (b)** | filtrare per stato = predicato su due colonne (risolto da indici parziali)                                                                                     |
| **Rischi**           | (a) produrrebbe stati contraddittori (`status='done'` senza `completedAt`); (c) moltiplica UI e transizioni senza esigenza                                     |
| **Scelta**           | **(b)**: tre stati; la condizione temporale (`overdue/today/soon/later/none`) è **derivata** e non si salva mai                                                |
| **Impatto**          | T1: `cancelled_at` + CHECK; funzione pura `taskStatus`; T2: UI legge `status` dalla risposta                                                                   |

## D-03 — Scadenze: solo data o anche data-ora?

|                      |                                                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Alternative**      | (a) **data di calendario** `YYYY-MM-DD` (`due_on`) · (b) istante (`due_at` esistente) · (c) entrambi                                                                                                                            |
| **Vantaggi di (a)**  | concetto naturale («entro venerdì»); nessuna ambiguità di fuso/DST; classificazione = confronto fra date; ordinamento indipendente da «oggi» (cursore stabile); precedente nel repo (`applied_on`)                              |
| **Svantaggi di (a)** | niente orario (es. «richiama alle 15»)                                                                                                                                                                                          |
| **Rischi**           | (b) «scaduta» cambia a seconda di ora e fuso per un concetto che è un giorno; senza promemoria l'ora non ha consumatori. (c) raddoppia le regole                                                                                |
| **Scelta**           | **(a)**. `due_at` resta come colonna **legacy non usata** (nessuna ricostruzione per rimuoverla). L'orario si può aggiungere **dopo** come colonna `due_time` nullable, senza toccare `due_on`                                  |
| **Impatto**          | T1: `due_on` + CHECK; **Overview retrocompatibile** (`dueAt` resta come primo istante del giorno, si aggiunge `dueOn`; vedi [contratti §5](tasks-api-contracts.md)); test API dei contatori riscritti; T2: `formatCalendarDate` |

## D-04 — Collegamento alla card facoltativo?

|                     |                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Alternative**     | (a) **facoltativo**, ricollegabile · (b) obbligatorio · (c) due tabelle (task di card / di workspace)                       |
| **Vantaggi di (a)** | soddisfa «Aggiornare il CV», «Aggiornare il portfolio»; la FK composita già gestisce NULL; nessun caso speciale nel dominio |
| **Svantaggi**       | l'elenco deve gestire due forme di riga (con/senza chip)                                                                    |
| **Rischi**          | integrità con card archiviata/cancellata → vedi D-05                                                                        |
| **Scelta**          | **(a)**; modifica del collegamento consentita (stesso workspace, card non archiviata)                                       |
| **Impatto**         | T1: `PATCH cardId`; T2: combobox; T3: sezione nella candidatura                                                             |

## D-05 — Cancellazione e archiviazione

|                             |                                                                                                                                                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Alternative per la task** | (a) DELETE definitivo senza lapide · (b) DELETE con lapide (come note/documenti) · (c) **solo annullamento**, nessuna cancellazione                                                                                                                                                                     |
| **Alternative per la card** | task invariate e visibili · task **sola lettura ed escluse da elenco/contatori** (derivato, reversibile) · annullamento automatico · `SET NULL`                                                                                                                                                         |
| **Vantaggi di (c)**         | reversibile, idempotente, nessuna lapide né «scrubbing»; niente retry tardivo che ricrea una risorsa eliminata (rischio dichiarato in piano M3 §1.2)                                                                                                                                                    |
| **Svantaggi di (c)**        | le annullate restano (tetto totale 5.000, filtro «Annullate»); nessuna pulizia fino a una decisione dedicata (M4)                                                                                                                                                                                       |
| **Rischi**                  | (a) retry tardivo ricrea la task; (b) complessità sproporzionata; annullare in automatico alla archiviazione **distruggerebbe l'intento** e non si annullerebbe al ripristino; `SET NULL` trasforma silenziosamente task di candidatura in task di workspace e, con FK composita, azzera `workspace_id` |
| **Scelta**                  | **(c)** + card archiviata → task **invariate, sola lettura, escluse** (derivato: il ripristino le riporta tali e quali) + `ON DELETE CASCADE` per card/workspace (nessun riferimento pendente)                                                                                                          |
| **Impatto**                 | T1: guardia SQL su card archiviata, filtro nelle query, nessun `DELETE`; T2: filtro «Annullate»; T3: sezione sola lettura; M4: eventuale purga/export                                                                                                                                                   |

## D-06 — Eventi: `activity_events` o modello dedicato?

|                            |                                                                                                                                                                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Alternative**            | (A) scrivere gli esistenti `task_added`/`task_completed` · (B) aggiungere `task_reopened`/`task_cancelled` ricostruendo `activity_events` (3ª volta) · (C) **voci derivate dalle righe `tasks`** (come le note) · (D) tabella `task_events`         |
| **Vantaggi di (C)**        | nessuna migrazione di `activity_events`, nessuna duplicazione (fatto in un solo posto), coerente con piano M3 §4; tre voci per task con card (creata/completata/annullata)                                                                          |
| **Svantaggi di (C)**       | non è un registro d'audit: la riapertura **cancella** la voce «completata» (rappresenta lo stato corrente); richiede una terza fonte nel merge della Timeline e nel cursore                                                                         |
| **Rischi**                 | (A) lascia una «completata» riaperta nella Timeline (incoerente con la lista); (B) terza ricostruzione di una tabella già ricostruita in 0004 e 0005: rischio R-01 ripetuto per beneficio basso; (D) tabella e fonte nuove, duplicazione potenziale |
| **Scelta**                 | **(C)**. `task_added`/`task_completed` restano nel vocabolario come **riservati e non scritti**. Nessun registro eventi del workspace in UI                                                                                                         |
| **Se serve un vero audit** | decisione separata (M4): preferire (D) o (B) con la guardia di 0005, non ora                                                                                                                                                                        |
| **Impatto**                | T1: nessuna scrittura di eventi; T3: `source: 'task'` in `timeline.ts`, schema risposta, UI con icona/testo; test di ordine totale con tre fonti                                                                                                    |

## D-07 — Paginazione: offset o cursore?

|                     |                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Alternative**     | (a) offset/limit · (b) **cursore** opaco con chiave completa                                                                               |
| **Vantaggi di (b)** | stabile con inserimenti/completamenti fra pagine (nessun duplicato né salto); coerente con note e timeline; l'ordine non dipende da «oggi» |
| **Svantaggi**       | niente «vai a pagina N» (non serve); cursore da validare (manomissione → 400)                                                              |
| **Rischi**          | contratto pubblico: scegliere male ora costa dopo                                                                                          |
| **Scelta**          | **(b)**, `limit` 1–100 (50), `cursor`/`nextCursor`                                                                                         |
| **Impatto**         | T1: codifica/validazione cursore + test; T2: «Carica altre»                                                                                |

## D-08 — Limiti per workspace

|                 |                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Alternative** | nessun tetto · solo totale · **aperte + totale**                                                                                |
| **Scelta**      | **500 aperte, 5.000 totali**; titolo 200, descrizione 2.000; atomici nell'`INSERT … SELECT` (e nella riapertura)                |
| **Motivo**      | proteggono pagina e costi come i tetti esistenti (500 note/card ecc.); il totale è necessario perché **non si cancella** (D-05) |
| **Rischio**     | utente reale che supera 5.000: improbabile; sbloccato da una futura purga                                                       |
| **Impatto**     | T1: `LIMITS` e test di atomicità; messaggi 409 chiari                                                                           |

## D-09 — Suggerimenti contestuali senza creazione automatica

|                                |                                                                                                                                                                                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Alternative**                | (a) nessun suggerimento · (b) **suggerimenti calcolati, non invasivi, mai creano** · (c) creazione automatica da regole approvate                                                                                                                               |
| **Vantaggi di (b)**            | aiuta senza decidere al posto dell'utente; funzione pura testabile; nessun dato nuovo                                                                                                                                                                           |
| **Svantaggi**                  | «Non ora» memorizzato **per dispositivo** (`localStorage`): non si sincronizza fra dispositivi                                                                                                                                                                  |
| **Alternative per la memoria** | tabella `task_suggestion_dismissals` (cross-device) — scartata ora: tabella e API per un dettaglio di conforto                                                                                                                                                  |
| **Rischi**                     | ripetizione: attenuata dalla regola «nessuna `follow_up` **in qualunque stato** (anche annullata) → non si ripropone» e dall'anchor per colloquio; la regola S2/S3 usa «task creata **dopo** il colloquio» come proxy del legame (limite dichiarato, vedi D-11) |
| **Scelta**                     | **(b)**. Nessuna regola di creazione automatica (c) è approvata                                                                                                                                                                                                 |
| **Impatto**                    | T3: `task-suggestions.ts`, riga nella Panoramica, `localStorage` con `try/catch`                                                                                                                                                                                |

## D-10 — Idempotenza e concorrenza delle scritture

|                     |                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Alternative**     | (a) nessuna · (b) header `Idempotency-Key` + tabella · (c) **ID del client + fingerprint** (come note) + CAS su `updated_at` + comandi idempotenti · (d) colonna `revision`                            |
| **Vantaggi di (c)** | coerente con C2; nessuna tabella; PK come garanzia di unicità                                                                                                                                          |
| **Svantaggi**       | `updated_at` deve essere **strettamente monotono** (`max(now, old+1)`); `PATCH` richiede `expectedUpdatedAt` (nuovo rispetto alle PATCH legacy delle card, ma analogo a `expectedFrom` della pipeline) |
| **Rischi**          | (d) funziona ma aggiunge una colonna: rinviata, additiva se mai servisse                                                                                                                               |
| **Scelta**          | **(c)**                                                                                                                                                                                                |
| **Impatto**         | T1: servizio e test di concorrenza; T2: gestione 409 «Modificata altrove»                                                                                                                              |

## D-11 — Attività manuali vs scadenze dei colloqui

|                     |                                                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Alternative**     | (a) **separate**: colloqui nel loro modulo, task manuali · (b) generare task per i colloqui · (c) vista «Agenda» unificata · (d) `interview_id` sulle task |
| **Vantaggi di (a)** | nessun doppione (un colloquio ha già data/ora, round e «Prossima azione»); nessuna sincronizzazione task↔colloquio                                         |
| **Svantaggi**       | la pagina Attività non mostra i colloqui; la preparazione al colloquio è legata alla card, non al colloquio (proxy «creata dopo il colloquio»)             |
| **Rischi**          | (b) sincronizzazione e annullamenti incoerenti; (d) FK e regole di annullamento aggiuntive per un beneficio solo di precisione                             |
| **Scelta**          | **(a)**; (c) e (d) sono evoluzioni possibili e additive, non necessarie per le tre domande                                                                 |
| **Impatto**         | T3: S2/S3 con proxy; nessun cambiamento ai colloqui                                                                                                        |

## D-12 — Attività di candidature chiuse

|                     |                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Alternative**     | (a) restano valide e modificabili · (b) annullate alla chiusura · (c) sola lettura                                                  |
| **Vantaggi di (a)** | casi reali: ringraziare, chiedere feedback, ricontattare dopo un rifiuto; nessun automatismo; la riapertura non richiede ripristini |
| **Svantaggi**       | task aperte su candidature chiuse possono accumularsi                                                                               |
| **Mitigazione**     | la **conferma di chiusura informa** («Hai N attività aperte») con link; nessuna azione automatica                                   |
| **Scelta**          | **(a)**; l'**archiviazione** è la via per toglierle dalla vista operativa (D-05)                                                    |
| **Impatto**         | T3: avviso nella conferma di chiusura (`PipelineConfirmation`)                                                                      |

## D-13 — Strategia di migrazione di `tasks`

|                     |                                                                                                                                                                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Alternative**     | (A) **solo `ADD COLUMN`** con CHECK di colonna anche cross-colonna · (B) ricostruzione guidata di `tasks` · (C) invarianti nel solo service layer                                                                                                                                            |
| **Evidenza**        | esperimento isolato (SQLite 3.51.2): CHECK cross-colonna accettati in `ADD COLUMN`, applicati a `INSERT` e `UPDATE`, **validati sulle righe esistenti** (una riga legacy violante interrompe la migrazione); riga legacy conservata — dettagli in [architettura §4.1](tasks-architecture.md) |
| **Vantaggi di (A)** | nessuna ricostruzione, nessun rischio sui dati, niente trigger, ADR-0007 rispettato                                                                                                                                                                                                          |
| **Svantaggi**       | vincoli «di tabella» scritti sulle colonne nuove; **rischio di deriva SQL ↔ schema TS** (non vista da `db:check`, che confronta TS e snapshot)                                                                                                                                               |
| **Mitigazioni**     | test di **presenza dei vincoli** su D1 reale; `db:upgrade-test` con task legacy; verifica sul runtime D1 locale (workerd) come primo passo di T1                                                                                                                                             |
| **Rischi residui**  | la versione di SQLite di D1 remoto non è verificata da qui; la tabella remota non è verificata vuota                                                                                                                                                                                         |
| **Scelta**          | **(A)**; (B) solo se il passo di verifica mostrasse un limite del runtime D1                                                                                                                                                                                                                 |
| **Impatto**         | T1: `0006` additiva, snapshot, test; **nessuna** ricostruzione di `activity_events`                                                                                                                                                                                                          |

## D-14 — Vocabolario d'errore

|                 |                                                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Alternative** | (a) nessun codice nuovo, 409 = `conflict` + messaggio · (b) nuovi codici (`task_limit_reached`, `stale`, …) · (c) campo `reason` additivo in `issues`     |
| **Scelta**      | **(a)**: coerente con C2 e col client attuale (che tratta ogni 409 come «aggiorna e riprova»). (c) si introduce solo se la UI ne avesse bisogno meccanico |
| **Impatto**     | T1: messaggi stabili e testati; nessuna modifica a `API_ERROR_CODES`                                                                                      |

---

## Decisioni da non assumere senza approvazione esplicita

1. **D-01 + D-03 + D-13** insieme: riuso della tabella, date-only e migrazione additiva — definiscono lo schema.
2. **D-05**: nessuna cancellazione definitiva.
3. **D-06**: nessun nuovo evento / nessuna terza ricostruzione di `activity_events`.
4. ~~Cambio di contratto di `upcomingTasks`~~ **ritirato**: l'estensione di Overview deve essere retrocompatibile (v. §Approvazioni).

Tutte le altre sono reversibili con modifiche additive.
