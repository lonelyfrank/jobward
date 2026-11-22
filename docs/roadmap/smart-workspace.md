# Smart Workspace — roadmap eseguibile

> **Avviso (PID-01, 2026-11-22): documento storico.** Il ramo `feat/m5-sw1-smart-kanban` è stato integrato in `jobward-v1` e il percorso di migrazione `0008`–`0011` qui descritto è stato **sostituito** dalla base unica `0000_jobward_v1` ([ADR-0017](../architecture/decisions/0017-local-v1-baseline.md)); il worktree `/home/frank/jobward-smart-workspace` non è più quello ufficiale. Le decisioni D1–D13 restano in [ADR-0016](../architecture/decisions/0016-smart-workspace-domain.md); capacità future in [MASTER-FUNCTIONAL-ROADMAP](MASTER-FUNCTIONAL-ROADMAP.md) (stream D); stato reale in [FEATURE-MATRIX](../status/FEATURE-MATRIX.md). I percorsi `scripts/audit/`, `scripts/spike/` e `scripts/test-migration-*` citati sotto non esistono su `jobward-v1`.

**Stato:** indirizzo architetturale approvato il 2026-11-09 ([ADR-0016](../architecture/decisions/0016-smart-workspace-domain.md)); implementazione limitata a SW.1, SW.3, SW.10-a/b/c (committate in locale nel branch, **non integrate in `main`**: nessun push né PR; **SW.10 nel suo complesso non è conclusa**; **SW.10-d.1 (2026-11-12): `0011` scritta e provata solo su database sintetici, non committata, non applicata a database reali**). Iniziativa **separata** da M5 Public Readiness: gli impegni di M5 non cambiano ([scope policy](scope-policy.md)).

**Branch e worktree ufficiali dell'iniziativa:** repository `/home/frank/jobward`, worktree `/home/frank/jobward-smart-workspace`, branch `feat/m5-sw1-smart-kanban`. Il nome del branch non limita il perimetro. Baseline verificata il 2026-11-09: `origin/main` = `c007e53` (locale e remoto coincidono).

Questo documento è la roadmap di riferimento; le decisioni sono nell'ADR-0016. Se i due divergono, vale l'ADR.

## Obiettivo

Passare da un'applicazione centrata sulle bacheche a una centrata su **opportunità** e **candidature**, conservando l'attuale design visibile di Jobward e tutte le funzioni esistenti. Una persona può registrare un'opportunità senza creare una bacheca, inviare più candidature nel tempo alla stessa opportunità, consultare un archivio unico, organizzarlo in bacheche manuali o Smart Boards, filtrare e raggruppare, cambiare layout senza duplicare dati, salvare viste, vedere luoghi su una mappa, analizzare eventi in una Timeline separata e leggere statistiche attendibili.

## Regole operative (vincolanti)

1. Il lavoro si svolge nel worktree e nel branch dell'iniziativa; lo stato Git e le modifiche non committate si verificano prima di ogni intervento e si preservano tutte.
2. Nessun altro branch o worktree viene creato in automatico. Nessun reset, clean, stash o checkout distruttivo.
3. Non si modificano il worktree principale, quelli di M4 né quello del restyling UI. Nessuna integrazione automatica da altri branch.
4. Le implementazioni procedono per milestone progressive e verificabili.
5. **Prima di ogni modifica strutturale al database si produce un piano di migrazione e lo si fa approvare** (SW.6 per le migrazioni previste; piani aggiuntivi per le altre).
6. Nessun push, merge, deploy, **migrazione remota** o commit senza autorizzazione esplicita.
7. Fuori perimetro, per scope policy: AI/LLM, funzioni per recruiter/ATS/marketplace, notifiche, scheduler, integrazioni con calendari o email esterni, servizi a pagamento.

## Decisioni di indirizzo (sintesi)

| ID  | Decisione                                                                                 | Stato                   |
| --- | ----------------------------------------------------------------------------------------- | ----------------------- |
| D1  | Smart Workspace separato da M5; perimetro registrato nei documenti di roadmap             | Approvata               |
| D2  | Preservare il design visibile; nessuna integrazione automatica dei branch UI              | **Condizionata**        |
| D3  | Dominio prima della pubblicazione con dati reali, se possibile; M4 intatto                | **Condizionata**        |
| D4  | Opportunity 1:N Application; nessun tetto di dominio; candidatura corrente deterministica | Approvata con modifiche |
| D5  | Opportunity indipendente dalle bacheche; Inbox = vista di sistema; migrazioni additive    | Inbox-bacheca respinta  |
| D6  | Colloqui appartengono alla Application; numerazione per candidatura                       | Approvata               |
| D7  | Mappa MVP con dati incorporati, senza provider esterni né coordinate inventate            | Approvata con limiti    |
| D8  | Ruolo strutturato e normalizzato, ambito distinto, titolo originale conservato            | Approvata               |
| D9  | N:M Opportunity/bacheche manuali: principio approvato, fase da decidere                   | Principio               |
| D10 | Nei gruppi virtuali niente drag and drop che modifica attributi; azioni esplicite         | Approvata               |
| D11 | Smart Board (dataset) e Smart View (presentazione) distinte                               | Approvata               |
| D12 | Insights con formule esplicite; niente finestra universale di 14 giorni                   | **Condizionata**        |
| D13 | Snapshot all'invio; legacy ricostruito e marcato `backfill`                               | Approvata               |

### Decisioni condizionate: gate ancora da chiudere

| Gate      | Decisione | Attività (sola lettura)                                                                                                                                             | Esito atteso                                                                  | Blocca                                  |
| --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------- |
| **SW.0a** | D2        | Matrice componente per componente tra il branch e `ui/design-v2` / `feat/ui-dialogs-motion`: cosa cambia nel design visibile, cosa serve davvero a Smart Workspace. | Elenco minimo di integrazioni proposte, approvate una per una.                | Parte strutturale di SW.2 e nav di SW.5 |
| **SW.0b** | D3        | Verifica dello stato effettivo di staging, D1 e deploy (lettura autorizzata o conferma del proprietario) e dei dati locali del proprietario da proteggere.          | Ordine definitivo rispetto a M4; scelta dell'opzione di SW.6.                 | SW.10                                   |
| **SW.0c** | D12       | Specifica unica delle metriche condivisa con M4-C1: popolazioni, formule, denominatori, esclusi, coorti e finestre di osservazione.                                 | Documento approvato; nessuna soglia universale; il silenzio non è un rifiuto. | SW.18                                   |

Evidenza raccolta finora per D3 (documentale, non live): staging bloccato, 0 database D1 nell'account inventariato, nessun deploy, migrazioni `0000`–`0007` solo locali.

### Stato di avanzamento

| Voce        | Stato                                                                                                                                                                                                                                                                                          | Esito e verifiche                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SW.0a**   | Eseguito in sola lettura (2026-11-09); D2 resta condizionata                                                                                                                                                                                                                                   | Per chiudere SW.1 non serve integrare nulla. `ui/design-v2` (non committato, su base vecchia) cambia anche l'aspetto di card e colonne del Kanban e il modello di navigazione su telefono: non si importa. `feat/ui-dialogs-motion` è quasi tutta estetica e animazione; l'unica modifica funzionale è il fix dei tooltip (`tooltip.tsx`, keyframe e test), da approvare prima di SW.2. Nessuna integrazione approvata.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **SW.1**    | Chiusa, READY (2026-11-10); committata in locale, non integrata in `main`                                                                                                                                                                                                                      | Filtri dinamici del Kanban nell'indirizzo; trascinamento con filtri; C1 (avviso «creata ma nascosta dai filtri» con «Ripristina filtri») e C2 (avviso unico sui parametri non validi, indirizzo riscritto senza nuova voce di cronologia); tono `info` nei messaggi. Verifiche: `pnpm check` exit 0 (shared 666, schemas 65, web 244, api 441 test), E2E Kanban e ricerca 83 passati, E2E completa 257 passati e 1 saltato (`workspace-visual`, richiede `WORKSPACE_VISUAL_DIR`), anteprima 14/14. Limiti noti: C1 copre solo la creazione; Kanban e Tabella restano con filtri separati fino a SW.3; provato solo su Chromium (mobile emulato a 390 e 320 px), nessun dispositivo reale né screen reader.                                                                                                                                                                                                                                                                |
| **SW.3**    | Chiusa; committata in locale, non integrata in `main`. D1 approvata (chiavi persistite per SW.6/SW.7), D2 approvata in via temporanea                                                                                                                                                          | Motore di query v2 condiviso (`packages/shared`, compilatore SQL in `apps/api`), `v:1` convertito, parametro `where` solo lato API. Verifiche: `pnpm check` exit 0 (shared 795, schemas 71, web 281, api 455 test), E2E completa 257 passati e 1 saltato, anteprima 14/14. Compromesso temporaneo sulla normalizzazione dei testi (non è equivalenza Unicode completa) e soluzione definitiva proposta: [smart-query-engine.md](../architecture/smart-query-engine.md). I filtri avanzati `where` non sono esposti in UI fino a SW.8 e nessuna vista li applica in modo invisibile.                                                                                                                                                                                                                                                                                                                                                                                       |
| **SW.10-a** | **Chiusa (2026-11-10): migrazione `0008` e sequenza `0008`–`0011` approvate; committata in locale, non integrata. SW.10 nel suo complesso NON è conclusa.** Nessuna migrazione applicata a database reali                                                                                      | Migrazione `0008` (ricostruzione una tantum di `cards`: `board_id`/`column_id` nullable, CHECK della coppia, FK `NO ACTION`, trigger NULL-safe); `deleteBoard` scollega le opportunità invece di eliminarle; contratti con `PlacedCard`; `LEFT JOIN` in Tabella, ricerca e Overview; testo di conferma aggiornato. Prove su database sintetici: [ADR-0016](../architecture/decisions/0016-smart-workspace-domain.md). Restano SW.10-b (`0009`, applications, snapshot), SW.10-c (`0010`, eventi), SW.10-d (`0011`, backfill) e gli switch.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **SW.10-b** | **Chiusa (2026-11-11): D1 (temporanea), D2 e D3 approvate; committata in locale, non integrata.** Nessuna migrazione applicata a database reali                                                                                                                                                | Migrazione `0009_applications_snapshots`: tabelle `applications` e `application_snapshots` (immutabili, `source` `submit`/`backfill`), colonne nullable `application_details.current_application_id` e `interviews.application_id`, indici e 10 trigger; costanti `APPLICATION_ORIGINS` e `SNAPSHOT_SOURCES`. Solo strutture: nessun servizio, rotta o UI le usa; nessun backfill né dual-write; `card_id` e `UNIQUE(card_id, sequence)` dei colloqui restano; note e documenti senza `application_id` (S6-10 → SW.14). Prove: `apps/api/test/applications-schema.test.ts`, `scripts/test-migration-applications.mjs` (in `db:upgrade-test`). Dettagli: [database.md](../architecture/database.md#candidature-e-snapshot-migrazione-0009-m5-sw10-b).                                                                                                                                                                                                                      |
| **SW.10-c** | **Implementata e committata in locale (2026-11-11), revisione positiva, nessun push.** Nessuna migrazione applicata a database reali                                                                                                                                                           | Migrazione `0010_activity_events`: ricostruzione di `activity_events` (tabella foglia) con `application_id` nullable (FK semplice `SET NULL`), tipi `application_created`/`card_placed`/`card_unplaced`, 3 trigger di coerenza e 4 `CHECK` per i soli tipi nuovi; eventi storici conservati byte per byte. Tipi «dormienti»: predisposti, **non emessi** (`deleteBoard` invariato), esclusi dalla cronologia. Chiavi di deduplica `applicationCreatedDedupeKey`/`placementDedupeKey`. Prove: `scripts/test-migration-activity-events.mjs` (in `db:upgrade-test`), `apps/api/test/activity-events-schema.test.ts`, `packages/shared/src/timeline.test.ts`. Dettagli: [database.md](../architecture/database.md#cronologia-e-candidature-migrazione-0010-m5-sw10-c).                                                                                                                                                                                                        |
| **SW.10-d** | **d.0–d.0d (audit della politica) chiusi; d.1 (migrazione `0011`) scritta in locale il 2026-11-12, NON committata, NON applicata a database reali.** Restano: revisione, prova a secco su una **copia** approvata dal proprietario, backup verificato, approvazione separata per ogni ambiente | Migrazione `0011_application_backfill` (solo dati): politica `sw10-backfill-policy/1`; candidatura solo per SUBMITTED e DRAFT; AMBIGUOUS e NO_APPLICATION escluse senza correzioni automatiche; idempotenza per Opportunity; guardie nominate di lineage, collegamenti, conflitti, esclusioni silenziose e copia fedele; nessun evento, nessun collegamento (`current_application_id`, `interviews.application_id` restano NULL: riconciliazione = fase separata); snapshot con `created_at = max(cards.updated_at, application_details.updated_at)` (riferimento tecnico, non data di invio). Prove: `scripts/test-migration-application-backfill.mjs` (in `db:upgrade-test`, D1 locale), `scripts/audit/sw10d0/backfill-validation.mjs`, `apps/api/test/application-backfill.test.ts`; manifest `scripts/audit/sw10d0/policy-manifest.json`. Dettagli: [ADR-0016](../architecture/decisions/0016-smart-workspace-domain.md), [database.md](../architecture/database.md) |

## Classificazione degli interventi

1. **Indipendenti dal nuovo dominio, realizzabili subito:** SW.1, SW.2, SW.3, SW.4, SW.5 (e i gate di sola lettura SW.0a/0c).
2. **Dipendenti dal nuovo dominio:** SW.11, SW.12, SW.13, SW.14, SW.16 (per le dimensioni di candidatura), SW.18.
3. **Richiedono approvazione architetturale o di migrazione:** SW.6, SW.7, SW.8, SW.9, SW.10, SW.12, SW.15, SW.17, SW.19 e ogni integrazione da altri branch.
4. **Differibili:** SW.15 (N:M, se non serve), SW.17 (Mappa), SW.19 (Dashboard), SW.20 (cleanup).

SW.7, SW.8 e SW.9 sono tecnicamente indipendenti dal dominio, ma si scrivono solo dopo l'approvazione del piano di migrazione di SW.6.

## Roadmap

| ID    | Milestone                                             | Classe | Migrazione (indicativa) | Dipende da                   | Approvazioni richieste               |
| ----- | ----------------------------------------------------- | ------ | ----------------------- | ---------------------------- | ------------------------------------ |
| SW.1  | Consolidamento Smart Kanban (esiste)                  | 1      | —                       | —                            | Commit                               |
| SW.2  | Selettore layout a icone e toolbar                    | 1      | —                       | SW.1, SW.0a                  | Commit                               |
| SW.3  | Motore di query v2 (TypeScript e SQL)                 | 1      | —                       | SW.1                         | Commit                               |
| SW.4  | Raggruppamenti virtuali e azioni esplicite            | 1      | —                       | SW.3                         | Commit                               |
| SW.5  | Timeline autonoma v0                                  | 1      | —                       | SW.0a                        | Commit                               |
| SW.6  | Piano di migrazione dettagliato                       | 3      | — (documento)           | decisioni D1–D13             | **Approvazione del piano**           |
| SW.7  | Ruolo e ambito                                        | 1, 3   | `0012`                  | SW.6, SW.3                   | Piano di migrazione                  |
| SW.8  | Smart Views                                           | 1, 3   | `0013`                  | SW.3, SW.6                   | Piano di migrazione                  |
| SW.9  | Smart Boards                                          | 1, 3   | `0014`                  | SW.8, SW.4                   | Piano di migrazione                  |
| SW.10 | Dominio: expand e backfill                            | 3      | `0008`–`0011`           | SW.6, **SW.0b**              | Piano; migrazione remota separata    |
| SW.11 | Dual-write e controllo di coerenza                    | 2      | —                       | SW.10                        | Commit                               |
| SW.12 | API delle candidature, switch delle letture, colloqui | 2, 3   | `0015`                  | SW.11                        | Piano di migrazione                  |
| SW.13 | Opportunità indipendenti dalle bacheche e vista Inbox | 2, 3   | secondo SW.6            | SW.12, SW.9                  | Piano; modifica eliminazione bacheca |
| SW.14 | UX Application-first                                  | 2      | —                       | SW.13                        | Commit                               |
| SW.15 | Appartenenza N:M alle bacheche manuali                | 3, 4   | `0016`                  | SW.13, SW.6                  | Piano di migrazione                  |
| SW.16 | Vista Matrice                                         | 1, 2   | —                       | SW.3 (SW.12 per candidatura) | Commit                               |
| SW.17 | Geografia e Mappa MVP                                 | 3, 4   | `0017`                  | SW.7, SW.12                  | Licenze, bundle, migrazione          |
| SW.18 | Insights                                              | 2      | —                       | SW.12, **SW.0c**, SW.7       | Specifica metriche                   |
| SW.19 | Dashboard                                             | 4      | `0018`                  | SW.8, SW.18                  | Piano di migrazione                  |
| SW.20 | Deprecazione dei campi legacy e cleanup               | 3, 4   | da definire             | SW.12 stabile                | Migrazione dedicata                  |

I numeri di migrazione sono **indicativi**: la numerazione è lineare e va ricontrollata contro `main` e gli altri branch prima di scrivere ogni migrazione. **Aggiornamento 2026-11-10 (sequenza approvata dal proprietario):** `0008` è la ricostruzione di `cards` (SW.10-a, già scritta). La ricostruzione ha elenchi di colonne espliciti, quindi nessuna migrazione che modifichi quelle tabelle può precederla: la sequenza del dominio è `0008` cards → `0009` applications → `0010` ricostruzione di `activity_events` → `0011` backfill, e le migrazioni di SW.7, SW.8, SW.9, SW.12, SW.15, SW.17 e SW.19 prendono i numeri successivi, riportati nella tabella (`0012`–`0018`) come previsione da ricontrollare prima di scrivere ciascuna.

### Dettaglio delle milestone

**SW.1 — Consolidamento Smart Kanban.**

- _Funzioni:_ filtri dinamici del Kanban (creazione, invio, aggiornamento, fase, azienda, priorità, modalità, contratto, etichette, località), URL come stato, trascinamento con filtri attivi. Da completare: avviso quando una scheda appena creata è nascosta dai filtri; avviso sugli indirizzi ripuliti.
- _File:_ il lavoro esistente (8 file modificati, 14 nuovi in `packages/shared`, `packages/schemas`, `apps/web/src/features/kanban`, `routes/board.tsx`, `apps/web/e2e`).
- _Rischi:_ conflitti di file con i branch UI (D2); nessuna migrazione.
- _Accettazione:_ `pnpm check`, E2E e anteprima restano verdi dopo le aggiunte. Commit solo su approvazione.

**SW.2 — Selettore layout a icone.**

- _Funzioni:_ un selettore a icone (Kanban, Tabella; Mappa e Matrice compaiono solo quando esistono) al posto dei due controlli testuali; densità Compatta/Informativa mantenuta come impostazione della sola Kanban; layout nell'indirizzo; etichette accessibili e tooltip.
- _File:_ `routes/board.tsx`, nuovo componente in `components/ui`, spec con le 11 occorrenze delle stringhe attuali (`board-background`, `interviews`, `search`, anteprima).
- _Rischi:_ sovrapposizione con il restyling (D2); regressioni dei test accoppiati ai nomi.
- _Test:_ componente, E2E con tastiera, 320 e 390 px, axe.
- _Accettazione:_ stessi percorsi URL, stesso design visibile, nessuna funzione finta; la Timeline non è nel selettore.

**SW.3 — Motore di query v2.**

- _Funzioni:_ definizione versionata (`v:2`) con gruppi AND/OR, operatori tipizzati, gestione esplicita dei valori nulli, filtri per ruolo, azienda, modalità, sede, fase, priorità, etichette, RAL e date; valutatore TypeScript (evoluzione di SW.1) e compilatore SQL con colonne in whitelist e parametri legati; conversione dalla configurazione `v:1`; la Tabella usa la stessa definizione.
- _Stato (2026-11-10):_ implementata senza ruolo e RAL (dipendono da SW.7); il testo usa una normalizzazione limitata e temporanea, da sostituire con chiavi persistite (vedi [smart-query-engine.md](../architecture/smart-query-engine.md) §4, da includere nel piano SW.6/SW.7).
- _RAL:_ confrontabile solo con importo lordo dichiarato, stessa valuta e periodo mensile o annuale; gli altri casi sono esclusi e contati.
- _Rischi:_ divergenza tra i due valutatori; limite di parametri legati su D1 (da provare).
- _Test:_ stesse fixture sui due valutatori; `test:search:d1`.
- _Accettazione:_ risultati identici tra Kanban e Tabella a parità di filtri; nessun cambio di comportamento dei filtri esistenti.

**SW.4 — Raggruppamenti virtuali e azioni esplicite (D10).**

- _Funzioni:_ «Raggruppa per» (fase, azienda, modalità, priorità, periodo, etichetta) in Kanban e Tabella; gruppo «Non indicato» ultimo; etichette multiple dichiarate; trascinamento che modifica attributi disabilitato; azioni esplicite «Imposta fase…» (regole di transizione) e «Imposta priorità…».
- _Test:_ raggruppare non scrive; le azioni esplicite validano e scrivono; bacheche manuali invariate.
- _Accettazione:_ nessun cambio di fase come effetto di un raggruppamento.

**SW.5 — Timeline autonoma v0.**

- _Funzioni:_ rotta e voce di navigazione proprie, fuori dal selettore dei layout; eventi di sistema, colloqui, attività con data, date di invio e creazione; filtri per periodo e tipo; raggruppamento giorno/settimana/mese nel fuso del workspace; eventi ricostruiti marcati `derived` e nascosti se esiste l'evento reale; mai testo di note nei metadati. Nessuna integrazione con calendari esterni.
- _Evoluzione:_ dopo SW.12 aggrega i colloqui di tutte le candidature dell'Opportunity (D6).
- _Rischi:_ voce di navigazione in conflitto con la barra laterale del restyling (D2).
- _Accettazione:_ ordine totale e stabile, nessun duplicato né salto tra pagine, coerenza con la cronologia di scheda.

**SW.6 — Piano di migrazione dettagliato (documento).**

- _Contenuto:_ per ogni migrazione `0008`–`0018`: tabelle e colonne, trigger, indici, backfill, ordine, verifiche di integrità, rollback, prova di aggiornamento; scelta fra le opzioni di D5 (riferimento tecnico di compatibilità o ricostruzione di `cards`); eliminazione di bacheca che non elimina le opportunità; tetto operativo per le candidature; riscrittura di `activity_events`; sostituzione dell'indice dei colloqui; colonne di ruolo e ambito; schema di Smart Views/Boards; tempi della N:M.
- _Accettazione:_ approvazione scritta del proprietario. Nessuna migrazione prima.

**SW.7 — Ruolo e ambito (D8).** Colonne additive per ruolo, chiave di normalizzazione, ambito e relativa chiave; titolo originale invariato; suggerimenti dai dati dell'utente; filtri e ricerca sulle chiavi; nessun riempimento automatico. _Test:_ upgrade `0007→0008`, normalizzazione (accenti, maiuscole, spazi), isolamento. _Accettazione:_ filtrare per ruolo e per ambito funziona in Kanban e Tabella; i valori nulli restano «non indicato».

**SW.8 — Smart Views (D11).** Tabella delle viste con layout, filtri, ordinamenti, raggruppamenti, campi visibili e metriche; appartenenza a una bacheca o all'archivio; tetto per workspace; vista non valida con ripiego sicuro. _Accettazione:_ creare, applicare, rinominare, eliminare; una vista non duplica record.

**SW.9 — Smart Boards (D11).** Bacheca di tipo smart con dataset (regole/query), più Smart Views; i gruppi virtuali dipendono dalla vista. _Rischio:_ creare un'opportunità da una Smart Board che non corrisponde al dataset (avviso esplicito). _Accettazione:_ nessuna scheda duplicata; le bacheche manuali esistenti sono invariate.

**SW.10 — Dominio: expand e backfill (D4, D6, D13).** Tabella delle candidature, puntatore alla candidatura corrente, stato dell'opportunità separato dalla fase, `application_id` nei figli, riscrittura controllata di `activity_events`, backfill idempotente con identificatori deterministici. _Backfill (emendato con SW.10-d.0d, politica `sw10-backfill-policy/1`):_ una candidatura **solo** per le opportunità con prova indipendente di invio (SUBMITTED) o bozza esplicita (DRAFT); colloqui, esiti, fase o correzioni da soli **non** bastano; le altre restano opportunità pure (AMBIGUOUS e NO_APPLICATION, senza correzioni automatiche); snapshot `backfill` etichettato; note e documenti restano a livello Opportunity. _Verifiche:_ conservazione riga per riga, esattamente una candidatura per ogni opportunità SUBMITTED/DRAFT e nessuna per le altre, stessi `id` e `sequence` dei colloqui (il collegamento `application_id` è una **riconciliazione separata**, non fa parte della `0011`: emendamento D6), specchio legacy uguale, `foreign_key_check` vuoto, isolamento tra workspace, rollback senza schema parziale. _Accettazione:_ nuovo script di upgrade in `db:upgrade-test`, `db:check` verde, numeri di Overview e ricerca identici su base di prova.

**SW.11 — Dual-write e coerenza.** Ogni scrittura di pipeline, scheda e colloquio aggiorna candidatura e colonne legacy nello stesso `batch`; funzione pura `selectCurrentApplication` (D4); controllo di coerenza in CI. _Accettazione:_ parità di stato su tutte le transizioni consentite.

**SW.12 — API delle candidature, switch, colloqui per candidatura.** Endpoint additivi per opportunità e candidature con paginazione; `/cards/*` resta come facciata di compatibilità; Overview, ricerca e statistiche leggono le candidature; colloqui con sequenza per candidatura (indice sostituito, trigger sull'invariante); `ambiguous` esposto. _Accettazione:_ rotte nuove protette dai test di enumerazione, formati di errore invariati, numeri golden invariati.

**SW.13 — Opportunità indipendenti e Inbox.** Creare un'opportunità senza scegliere né creare una bacheca; Inbox come vista di sistema; spostare dentro e fuori da una bacheca; l'eliminazione di una bacheca non elimina le opportunità (testo di conferma aggiornato). _Accettazione:_ nessuna bacheca imposta; nessuna perdita di dati su bacheche esistenti.

**SW.14 — UX Application-first.** Wizard rapido con salvataggio anticipato (identificatore dal client, idempotente), nuova candidatura, sezione «Candidature» nel dettaglio con colloqui e cronologia filtrati per candidatura, dati utili per fase (da `quickActions`), mobile, tablet e desktop nel linguaggio visivo attuale. _Accettazione:_ da telefono si registra un'opportunità con il solo titolo; candidature successive non perdono i colloqui precedenti.

**SW.15 — N:M (D9).** Tabella di appartenenza per bacheche manuali; trigger dei campi personalizzati riscritto; «Aggiungi dall'archivio». Si anticipa solo se serve la multi-appartenenza o se il cleanup la richiede. _Accettazione:_ nessuna duplicazione; rimuovere un'appartenenza non cancella dati.

**SW.16 — Matrice.** Pivot a una o due dimensioni da un elenco chiuso, dall'aggregato server; tabella accessibile; su telefono elenco di gruppi. _Accettazione:_ il totale coincide con il conteggio della Tabella a parità di filtri.

**SW.17 — Geografia e Mappa MVP (D7).** Località strutturata (paese, regione, città) con riconoscimento esatto su dati incorporati; luoghi non riconosciuti → «non localizzabile»; nessuna coordinata inventata; nessun routing o geolocalizzazione. Verifica di licenza dei dati, dimensione del bundle (caricamento a richiesta) e approvazione di ogni libreria. _Accettazione:_ CSP invariata; nessuna richiesta di rete a terzi.

**SW.18 — Insights (D12).** Metriche per candidature **inviate**, **risposte ricevute**, **aperte** e **coorti con finestra di osservazione dichiarata**; ogni valore con numeratore, denominatore, esclusi e affidabilità (`inferred` quando si dedurrebbe da stato e non da eventi); il silenzio non è un rifiuto; coerenza con filtri e permessi; confronti per ruolo e modalità sui campi di SW.7. _Prerequisito:_ SW.0c approvata. _Accettazione:_ calcoli verificati a mano sulle fixture.

**SW.19 — Dashboard.** Widget da metriche e viste salvate, tetto per workspace. Differibile.

**SW.20 — Deprecazione e cleanup.** Le colonne legacy non vengono più scritte; il riferimento tecnico di compatibilità (se scelto) si rimuove con una migrazione dedicata e approvata. Nessun `DROP` automatico.

## Dipendenze critiche

1. **SW.6 (piano di migrazione approvato)** blocca ogni migrazione: SW.7–SW.10, SW.12, SW.15, SW.17, SW.19.
2. **SW.0b (stato effettivo di staging, D1, deploy)** blocca SW.10 e fissa l'ordine definitivo rispetto a M4.
3. **Scelta dell'opzione di D5 in SW.6** (riferimento tecnico di compatibilità oppure ricostruzione di `cards`) condiziona SW.13 e l'eventuale cleanup SW.20.
4. **SW.3 (motore di query)** è il prerequisito di SW.4, SW.8, SW.9, SW.16 e SW.18: le viste e gli insights devono ereditare gli stessi filtri.
5. **SW.10 → SW.11 → SW.12** è una catena stretta: nessuno switch prima del dual-write verificato; il cleanup solo dopo uno switch stabile.
6. **Riscrittura di `activity_events`** (nuovi tipi di evento, `application_id`) è l'unico passaggio di ricostruzione di tabella nel dominio: è un prerequisito della Timeline di candidatura e degli Insights.
7. **SW.0c (specifica metriche condivisa con M4-C1)** blocca SW.18 ed evita due definizioni diverse delle stesse statistiche.
8. **SW.0a (confronto UI)** condiziona le parti strutturali di SW.2 e SW.5 per i file in comune con i branch di restyling.
9. **Integrazione verso `main`:** `main` è protetta (PR obbligatoria, due check richiesti, history lineare, squash). Un unico branch lungo non è revisionabile; le PR andranno ricavate a fette per milestone, su autorizzazione.
10. **Numerazione delle migrazioni** lineare: da ricontrollare contro `main` e gli altri branch prima di ogni migrazione; il lavoro M4 non aggiunge migrazioni (verificato il 2026-11-09 sui documenti M4).

Percorso critico: SW.1 → SW.3 → SW.6 → SW.10 → SW.11 → SW.12 → SW.13 → SW.14. Tutto il resto si inserisce attorno a questo percorso senza allungarlo.

## Rischi principali

| Rischio                                                                    | Mitigazione                                                                                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Migrazione su D1 senza rollback transazionale                              | Piano approvato; prova di aggiornamento; export preventivo del proprietario; letture legacy valide fino allo switch |
| Riscrittura di `activity_events` altera la cronologia                      | Precedente `0004`/`0005`; conteggi e confronto riga per riga                                                        |
| Doppia scrittura incoerente                                                | Un solo `batch`; controllo di coerenza in CI                                                                        |
| Valutatori TypeScript e SQL divergono                                      | Fixture comuni; test di conformità                                                                                  |
| `cards.board_id` obbligatorio contraddice l'indipendenza dell'Opportunity  | Decisione in SW.6; ogni opzione ha costo dichiarato; nessuna scelta implicita                                       |
| Eliminazione di bacheca che elimina le schede                              | Cambio di comportamento esplicito in SW.13, con testo di conferma e test                                            |
| Campi personalizzati per bacheca incompatibili con la N:M                  | Trigger riscritto in SW.15; N:M per ultima                                                                          |
| Sovrapposizione con i branch di restyling                                  | SW.0a; nessuna integrazione automatica; modifiche piccole nei file in comune                                        |
| Candidature attive multiple: «corrente» ambigua                            | Regola deterministica, `ambiguous` esposto, statistiche per candidatura                                             |
| Dati ricostruiti presentati come certi                                     | `backfill` e `inferred` sempre visibili; nessun valore storico inventato                                            |
| Metriche duplicate o incoerenti con M4-C1                                  | SW.0c prima di SW.18                                                                                                |
| Costo di letture D1 con piano gratuito (da verificare sui limiti correnti) | Nessuna N+1; aggregati indicizzati; misura prima di aggiungere indici                                               |
| Branch lungo e revisione impraticabile                                     | Commit per milestone su approvazione; PR a fette su autorizzazione                                                  |

## Strategia di test

- **Unitari** (`shared`, `schemas`): motore di query, normalizzazione, regola della candidatura corrente, formule, fuso e cambio d'ora, parser degli indirizzi.
- **API su D1 locale:** isolamento con fixture multi-workspace, idempotenza, tetti operativi, formato degli errori, enumerazione automatica delle rotte.
- **Migrazioni:** uno script per migrazione nel modello di `scripts/test-migration-*.mjs`, aggiunto a `db:upgrade-test`; `db:check` per la coerenza tra schema e migrazioni.
- **Conformità:** le stesse fixture sul valutatore TypeScript e su quello SQL.
- **Golden:** Overview e ricerca prima e dopo lo switch.
- **E2E (Chromium)** e **anteprima** sulla build di produzione: tastiera, 320 e 390 px, axe, trascinamento con filtri e gruppi.
- **Dichiarazioni oneste:** Firefox, WebKit, dispositivi fisici e screen reader reali non sono coperti; ogni report lo ripete.

## Definition of Done (ogni milestone)

1. `pnpm check` e `pnpm test:e2e` verdi; `pnpm test:preview` verde per percorsi con CSP o modali; `db:upgrade-test` esteso se c'è una migrazione.
2. Nessuna regressione dei gate esistenti (ricerca, attività, timeline, zoom, background, Glass).
3. Test del comportamento nuovo, con numeri reali nel report; mai test dichiarati senza averli eseguiti.
4. Mobile (320 e 390 px), tastiera e axe verificati per le interfacce.
5. Report con file toccati, rischi residui e ciò che non è stato provato.
6. Stato Git controllato prima e dopo; nessun commit, push, merge o deploy senza approvazione.
7. Per le migrazioni: piano approvato prima, prova di aggiornamento, verifiche di integrità e rollback documentati; nessuna migrazione remota senza approvazione separata.

## Git e worktree

- Tutto in un solo worktree e un solo branch; i lavori sono **seriali**. Il parallelismo vale solo come analisi dei conflitti, se in futuro fossero autorizzati altri worktree.
- Zone di conflitto note: barra degli strumenti e intestazione (`routes/board.tsx`, `workspace-page-header.tsx`), Kanban (`features/kanban/*`), Opportunità e Tabella (`features/opportunities/*`), barra laterale (`layouts/nav.ts`, `sidebar.tsx`), servizi di dominio (`services/{cards,pipeline,interviews}.ts`), migrazioni.
- Se in futuro fossero autorizzati altri worktree, potrebbero procedere senza conflitti sostanziali SW.3 (solo `shared`, `schemas`, `api`), SW.5 (file nuovi più una voce di navigazione) e SW.2 (solo interfaccia). Mai in parallelo le milestone con migrazione.
- Divergenza da `origin/main`: si controlla sui riferimenti locali; un `git fetch` solo se autorizzato.

## Primo incremento consigliato

**SW.1 — Consolidamento Smart Kanban**, preceduto dal gate di sola lettura **SW.0a** (confronto UI). Motivi: il codice esiste ed è verificato, non richiede migrazioni né dipendenze, sblocca SW.2–SW.4 e il motore di query, e il confronto UI riduce il rischio di conflitti prima di toccare la barra degli strumenti. In parallelo (documenti, sola lettura) si possono preparare SW.6 e SW.0c, che sono sul percorso critico.
