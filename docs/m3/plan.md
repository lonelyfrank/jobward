# M3 — Piano tecnico

**Stato corrente:** C1 e C2 integrati in `main` @ `8071759b6d` (PR #7, CI verde).
C3 autorizzato, implementato e verificato localmente sul branch `m3-c3-application-workflow-ui`, con quality gate locale superato:
[consegna](c3-delivery.md), [test](c3-testing-report.md), [problemi](c3-issue-register.md).
C4/C5 non avviati. Nessun push, PR, merge, deploy o D1 remoto per C3.
Le condizioni D4/D5 restano valide; la richiesta C3 include i test di integrazione/E2E e la sua documentazione.
Premessa: M2.5 ha già costruito modale, colloqui e cronologia di base ([audit §4](audit.md)). M3 **completa e collega**: non riscrive.

## 1. Decisioni approvate

Le decisioni adottate includono ora il superamento di D6 autorizzato in M3-C1. Le alternative sono conservate come motivazione; gli identificatori persistenti necessari restano secondo ADR-0014.

| #      | Decisione                   | Decisione adottata                                                                                                                                                                                                                                                                                                         | Alternativa valutata                                                                                                         |
| ------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Modello della pipeline      | **Stato generale _derivato_** da `stage` + `outcome` + `archivedAt` (che restano la fonte di verità). Nessuna colonna nuova, nessun backfill, compatibilità totale con i dati M2/M2.5. **Dieci** stati: i nove richiesti + **«Nessuna risposta»** (vedi §2.1).                                                             | Colonna `status` memorizzata con backfill: più semplice da interrogare, ma duplica la verità e rischia stati contraddittori. |
| **D2** | Schede della modale         | **Sei**: Panoramica · Colloqui · Timeline · Note · Documenti · **Dettagli** (il modulo di modifica di M2, che M3 elenca tra le funzioni da **mantenere**). `#cronologia` resta valido come alias di Timeline. A telefono la fila di schede scorre _dentro se stessa_ (la pagina non scorre in orizzontale).                | Fondere Dettagli in Panoramica: refactor di `card-detail.tsx` (716 righe) con rischio di regressione.                        |
| **D3** | Documenti                   | **Riferimenti, non file**: titolo, tipo (CV, lettera, annuncio, portfolio, altro), URL `http(s)` facoltativo, nota. **Nessun caricamento**: richiederebbe R2 (dipendenza cloud nuova, esclusa dal backlog fino a dopo M4), conflitta con la CSP e con la Local Edition.                                                    | Rimandare la scheda (nessun controllo finto); oppure R2 in una milestone dedicata.                                           |
| **D4** | Migrazione `0005`           | **Una sola**: tabelle `card_notes` e `card_documents` (additive) + colonna `dedupe_key` e tipo `application_reopened` su `activity_events`. Il tipo nuovo obbliga a **ricostruire `activity_events`** come in `0004` (stesso schema collaudato: guardia sui conteggi, trigger ricreati, `db:upgrade-test` su DB popolato). | Riusare `application_closed` con metadati «riaperta»: evita la ricostruzione ma falsa il significato dell'evento.            |
| **D5** | Anti-duplicazione dei retry | **Id generato dal client all'apertura del modulo** per le creazioni (colloqui, note, documenti): un secondo invio con lo stesso id restituisce la risorsa esistente senza un secondo evento (stesso id e dati diversi → 409). Gli eventi hanno `dedupe_key` univoca. Nessuna tabella di chiavi di idempotenza.             | Header `Idempotency-Key` + tabella dedicata: più generale, più codice e stato da ripulire.                                   |
| **D6** | Rename dei pacchetti        | **Autorizzato e implementato in M3-C1:** da `@meet-roulette/*` a `@jobward/*`, root `jobward`; nuovo [ADR-0014](../architecture/decisions/0014-jobward-technical-rebranding.md) supera il rinvio registrato in ADR-0013.                                                                                                   | Rinvio precedente superato dalla richiesta M3-C1.                                                                            |

Inoltre: la modalità di colloquio «altro» **non** si aggiunge (richiederebbe un'altra ricostruzione, di `interviews`): «non specificata» + testo libero in _luogo/link_ copre il caso. Da dichiarare come limitazione.

### 1.1 D4 — Condizioni vincolanti per `0005`

- **Conservazione integrale:** nessun reset, svuotamento o cancellazione di dati utente. La ricostruzione tecnica di `activity_events` è ammessa esclusivamente se conserva tutti gli eventi, con gli stessi ID, riferimenti, tipi, metadati e timestamp. Gli eventi preesistenti ricevono `dedupe_key = NULL`. Non modificare le migrazioni `0000`–`0004` già applicate.
- **Verifica dello schema:** inventariare e confrontare prima/dopo chiavi esterne (incluse azioni `ON DELETE`/`ON UPDATE`), indici, vincoli e trigger di isolamento. Ricreare quelli esistenti e aggiungere solo quelli previsti; verificare `foreign_key_check`, integrità e rifiuto di riferimenti fra workspace. Non basta confrontare i conteggi.
- **Upgrade reale da M2.5 popolato:** estendere `db:upgrade-test` con una fixture ferma a `0004`, contenente più workspace, candidature aperte/chiuse/archiviate, colloqui e tutti i tipi di evento esistenti. Applicare `0005` e confrontare tutte le righe e i valori; mantenere anche il test di upgrade M1 → ultima versione. Verificare rollback in caso di errore durante la copia, senza lasciare uno schema parziale.
- **Riapertura:** dopo l'upgrade provare chiusura → riapertura via API, presenza del tipo `application_reopened`, riferimenti corretti e lettura nella timeline. Un retry della stessa operazione deve lasciare un solo evento; una nuova chiusura/riapertura deve produrre un nuovo evento.
- La migrazione si considera accettata solo quando queste prove passano. **In M3.0 `0005` non viene creata né applicata.**

### 1.2 D5 — Contratto di idempotenza backend

- Il client genera un **ID stabile** all'apertura di un nuovo modulo di creazione (colloquio, nota, documento, incluso il round successivo) e lo conserva per doppio invio e retry dopo timeout/errori di rete. Un retry non genera un nuovo ID. Dopo una risposta incerta va prima risolta la stessa operazione; un nuovo ID identifica solo una nuova creazione intenzionale.
- Il backend valida e normalizza l'input e associa all'ID un **fingerprint immutabile della richiesta originale**, includendo workspace, candidatura e tutti i campi del payload. I valori generati dal server non devono alterarlo a ogni retry. Il confronto non usa la versione corrente della risorsa, che potrebbe essere stata modificata dopo la creazione. Il fingerprint deve essere persistente; nessun testo privato va copiato nella cronologia. La collocazione va definita nel contratto di persistenza di C2, senza introdurre una tabella generica di chiavi di idempotenza.
- **Stesso ID e stesso payload:** prima creazione 201, replay 200 con la stessa identità della risorsa, nessun nuovo round e nessun secondo evento. **Stesso ID e payload differente:** 409, senza modificare risorsa o cronologia. Il controllo rispetta sempre autorizzazione e isolamento del workspace.
- **Concorrenza:** il vincolo univoco sull'ID e la chiave evento costituiscono la garanzia persistente; un controllo `SELECT` seguito da `INSERT` non è sufficiente. Richieste simultanee identiche devono convergere sulla stessa risorsa; richieste simultanee differenti con lo stesso ID devono lasciare una sola creazione e restituire conflitto alla perdente. Anche l'assegnazione del numero di round e i tetti per scheda vanno verificati atomicamente.
- **Atomicità:** creazione del colloquio e registrazione dell'evento avvengono nella stessa `D1.batch()` transazionale, con guardie SQL e gestione dei conflitti coerenti. Un errore nell'evento deve annullare la creazione, e viceversa. `ON CONFLICT DO NOTHING` da solo non dimostra né equivalenza del payload né atomicità e non deve nascondere violazioni di altri vincoli.
- **Prove obbligatorie in C2:** retry sequenziali, retry dopo risposta persa, payload differente, concorrenza con payload uguale/diverso, più creazioni concorrenti con ID diversi, isolamento tra workspace, errore forzato nell'inserimento dell'evento e rollback completo. Verificare inoltre il replay dopo modifica della risorsa e impedire che un retry tardivo ricrei una risorsa eliminata.

### 1.3 Indicazione UX e loghi disponibili

**Panoramica diventa il centro operativo della candidatura:** stato e prossimi passi, prossimo colloquio, aggiornamenti recenti e accessi a note/documenti. Le azioni frequenti sono disponibili direttamente nella sezione pertinente (ad esempio completamento accanto al colloquio e aggiunta di una nota accanto alle note). **Dettagli conserva il modulo di modifica esistente.** Footer e card possono offrire scorciatoie, senza essere l'unico punto di accesso.

I due originali [`jobward.png`](../../jobward.png) (trasparente 866 × 288) e [`jobward-white.png`](../../jobward-white.png) (fondo bianco 2172 × 724) sono preservati. In M3-C1 il componente logo usa questi asset, con la variante su fondo bianco presentata su una targa chiara nel tema scuro. Simbolo compatto e favicon mostrano il simbolo originale tramite ritaglio di visualizzazione, senza nuovi disegni. La verifica E2E copre temi, proporzioni, dimensione compatta, mobile e nome accessibile.

## 2. Pipeline (M3.2)

### 2.1 Derivazione dello stato generale

Funzione pura `derivePipelineStatus({ stage, outcome, archivedAt })`:

| Stato (UI)       | Chiave         | Derivazione                                                                                            |
| ---------------- | -------------- | ------------------------------------------------------------------------------------------------------ |
| Archiviata       | `archived`     | `archivedAt ≠ null` — **precede** gli altri; lo stato sottostante si conserva e riappare al ripristino |
| Assunto/a        | `hired`        | `outcome = accepted`                                                                                   |
| Rifiutata        | `rejected`     | `outcome = rejected`                                                                                   |
| Ritirata         | `withdrawn`    | `outcome ∈ {withdrawn, offer_declined}` (il motivo specifico resta visibile come dettaglio)            |
| Nessuna risposta | `no_response`  | `outcome = no_response` — **aggiunta**: mapparla su «Rifiutata» affermerebbe un rifiuto mai comunicato |
| Offerta          | `offer`        | `stage = offer`                                                                                        |
| In colloqui      | `interviewing` | `stage = interviewing`                                                                                 |
| Screening        | `screening`    | `stage = in_contact` (la fase «In contatto» di M2: contatto con recruiter/HR)                          |
| Inviata          | `applied`      | `stage = applied`                                                                                      |
| Salvata          | `saved`        | `stage ∈ {null, saved, preparing}`                                                                     |

Gli esiti chiusi precedono la fase (una candidatura `closed`/`rejected` è «Rifiutata», qualunque fosse la fase). **Nessuna deduzione automatica**: la derivazione _legge_ dati inseriti dall'utente, non ne inventa. Test: tutte le 7 × 6 combinazioni fase/esito + archivio hanno uno stato unico e definito. Per `stage=closed` con `outcome=pending/null`, C1 restituisce il fallback neutro `saved` e la diagnostica `closed_without_outcome`; il motore richiede una correzione esplicita, senza attribuire una conclusione né modificare i dati.

### 2.2 Transizioni

Tabella pura `PIPELINE_TRANSITIONS` + `allowedTransitions(status)`; tipi di transizione: `advance` (avanzamento), `close` (verso uno stato chiuso), `reopen` (da chiuso a aperto), `correction` (qualunque → qualunque, marcata).

- **Avanzamento:** Salvata → Inviata → Screening → In colloqui → Offerta (si può saltare in avanti: ci si candida e si riceve subito un colloquio).
- **Chiusura:** da qualunque stato aperto verso Rifiutata / Ritirata / Nessuna risposta; **Assunto/a solo da Offerta**. Chiedere conferma; per Assunto/a, Rifiutata, Ritirata un dialogo esplicito.
- **Riapertura:** da chiuso a uno stato aperto (predefinito: quello precedente alla chiusura, letto dalla cronologia). Genera `application_reopened`.
- **Correzione:** «Correggi stato» consente qualunque destinazione, scrive l'evento con `kind: "correction"` e **non cancella** nulla: gli eventi sbagliati restano nello storico (append-only).
- Una candidatura archiviata non cambia stato: si ripristina prima (409, come oggi).

### 2.3 Scrittura

`POST /cards/:id/pipeline` `{ id, to, kind, expectedFrom }` — sottile involucro su `updateCard`: imposta `(stage, outcome, appliedOn?)` in **un'unica `batch()`**, con gli eventi esistenti (`stage_changed`, `application_submitted`, `application_closed`) più il nuovo `application_reopened`. `expectedFrom` dà un controllo ottimistico (409 se nel frattempo lo stato è cambiato). L'ID stabile identifica la singola transizione e i suoi retry: il solo confronto con lo stato di destinazione non distingue un retry da una nuova operazione dopo un ciclo di chiusura/riapertura. Replay della stessa operazione senza secondo evento, stesso ID con payload diverso → 409. `PATCH /cards/:id` (modulo Dettagli) continua a funzionare e produce gli stessi eventi: **una sola fonte di eventi**, nessun evento «pipeline» parallelo.

### 2.4 Coerenza con i colloqui (nessuno stato contraddittorio, nessun automatismo)

Funzione pura `pipelineConsistency(status, interviewSummary)` → elenco di _segnalazioni_, mai di modifiche:

| Situazione                                                       | Comportamento                                                                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Salvata/Inviata/Screening con colloqui programmati o completati  | Banner nella scheda: «Imposta “In colloqui”» (pulsante; già esiste in M2.5 per la fase)                          |
| Si chiude (Rifiutata/Ritirata/Assunto/a) con colloqui **futuri** | Il dialogo di chiusura chiede: _lasciali_ / _annullali_. Predefinito: **lasciali**. Mai annullamento silenzioso. |
| Colloqui programmati su una candidatura chiusa (già esistente)   | Segnalazione sulla card e nella scheda Colloqui                                                                  |
| In colloqui senza alcun colloquio registrato                     | Ammesso (colloqui informali): suggerimento di aggiungerne uno, nessun blocco                                     |
| Completare/creare/annullare un colloquio                         | **Non** cambia lo stato (regola M2.5 invariata)                                                                  |

## 3. Colloqui (M3.3)

Già implementati: entità, più round, creazione, modifica, riprogrammazione, annullamento, completamento, round successivo, esito, feedback, fuso, interlocutori, passati/futuri, prossimo appuntamento. M3 aggiunge soltanto:

1. **Id lato client** sulla creazione (D5) → niente round doppi con un retry.
2. **Coerenza con la pipeline** (§2.4) e il suggerimento di stato.
3. Test dei colloqui multipli estesi (≥ 3 round, riprogrammazione e annullamento senza sovrascrivere i precedenti, round successivo dopo un annullato).

## 4. Timeline e note (M3.4)

- **Fonti:** `activity_events` (sistema) ∪ `card_notes` (manuali). **Nessuna duplicazione**: il testo di una nota vive solo in `card_notes`; l'evento di sistema non lo copia (come per feedback e note dei colloqui).
- **Lettura:** `GET /cards/:id/timeline?before=&limit=` → voci `{ id, source: 'system' | 'note', kind, occurredAt, entity: { type, id } | null, data }`, ordinate per `(occurredAt desc, id desc, source desc)` — **ordine totale e stabile** a parità di istante; paginazione a cursore.
- **Collegamento alle entità:** `entity` punta a colloquio / nota / documento / scheda; la UI apre la scheda corretta.
- **Eventi mostrati:** creazione, invio, cambio stato (con _Offerta ricevuta_ derivata da `stage_changed → offer`), pianificazione/modifica/completamento/annullamento colloquio, feedback, chiusura, **riapertura** (nuovo, risolve M3-01), correzione. Distinti visivamente dalle note (icona + etichetta «Nota» per le manuali, testo accessibile, non solo colore).
- **Retry:** `activity_events.dedupe_key` (nullable, indice univoco parziale su `(workspace_id, dedupe_key)`), con conflitto gestito sul solo indice previsto e nel rispetto del contratto §1.2. Chiavi: `interview_created:<id>`, `note_added:<id>`, `application_reopened:<cardId>:<transitionId>`. L'ID di transizione è stabile per i retry e nuovo per una riapertura successiva; non usare soltanto stato o timestamp. Gli eventi esistenti restano con chiave nulla (compatibili). C1 serializza l’intento come array JSON `[type, entityType, entityId, operationId]` per evitare collisioni da separatori; C2 aggiungerà lo scope workspace e adotterà questo formato nella persistenza.
- **Note:** `card_notes(id, workspace_id, card_id, body ≤ 10.000, created_at, updated_at)`, chiave composita (scheda, workspace) come i colloqui; tetto 500 per scheda (atomico). Creazione, modifica, eliminazione **con conferma**; su candidatura archiviata sola lettura (409 in scrittura).

## 5. Documenti (M3.1, D3)

`card_documents(id, workspace_id, card_id, title ≤ 200, kind, url?, note?, created_at, updated_at)`, tetto 50. Nessun caricamento, nessun fetch dell'URL (niente SSRF, niente anteprime), apertura con `rel="noopener noreferrer"`. Dichiarato nell'interfaccia: _«Jobward conserva il riferimento, non il file.»_

## 6. Azioni rapide (M3.5)

Funzione pura `quickActions({ status, summary, hasNotes })` → elenco ordinato di id; la UI le associa ai gestori. Mostrate direttamente nelle sezioni pertinenti della Panoramica (§1.3) e nelle rispettive schede. Il piè di pagina offre scorciatoie; nella card Kanban compare solo la principale.

| Contesto              | Azioni (id)                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Salvata               | `mark_applied` (imposta Inviata e, se vuota, la data di invio = oggi; annullabile), `edit_info`                        |
| Inviata / Screening   | `add_interview`, `log_update` (apre una nota), `prepare_followup` (nota con intestazione suggerita — **nessun invio**) |
| Colloquio programmato | `open_interview`, `edit_interview`, `complete_interview`                                                               |
| Colloquio completato  | `add_feedback`, `schedule_next_round`, `record_result`                                                                 |
| Offerta               | `view_offer` (scheda Dettagli), `record_decision` (Assunto/a · Ritirata · Rifiutata, con conferma)                     |
| Chiusa                | `reopen`, `correct_status`                                                                                             |
| Archiviata            | `restore`                                                                                                              |

Ogni azione è un controllo reale e con etichetta; se non applicabile non compare (nessun pulsante disabilitato «finto»). Niente e-mail, niente AI.

## 7. Modale (M3.1)

Si estende il lavoro di M2.5 (Dialog `workspace`): **intestazione** con azienda · ruolo · **stato pipeline** (cambiabile da un menu delle sole transizioni consentite); **piè di pagina** con le azioni rapide e «Salva» quando il modulo è sporco; nuove schede Note/Documenti/Timeline. Accessibilità: si mantengono focus trap, ripristino, Esc con conferma se «sporco», `role=tablist` con frecce/Home/End, pannelli inattivi nascosti (M25-01), `prefers-reduced-motion`. Mobile: schermo intero, barra delle schede scorrevole, aree di tocco ≥ 44 px, nessuno scorrimento orizzontale della pagina (già verificato da E2E: si estende alle nuove schede).

## 8. Preparazione alla Local Edition

- **Dominio puro in `packages/shared`** (nessuna dipendenza nuova, nessun nuovo pacchetto): `pipeline.ts` (derivazione, transizioni, mappa verso `stage/outcome`, coerenza), `timeline.ts` (fusione, ordinamento, dedupe), `quick-actions.ts`. Nessun import di D1, Hono, React o autenticazione. Test unitari senza I/O.
- **Contratti** in `packages/schemas` (Zod) riutilizzabili da un'altra persistenza.
- I servizi ricevono già `workspaceId`/`actorUserId` come parametri; i nuovi fanno lo stesso. Le operazioni restano esportabili (JSON per entità, nessun id opaco legato a Cloudflare).
- **Dipendenze cloud residue** (da documentare nel report finale): SQL D1 con `batch()` atomico; Cloudflare Access per l'identità; Workers Static Assets per il frontend. M3-03 (regole dei colloqui mescolate al SQL) **resta aperto**, tranne per le parti toccate: lo stato di rifattorizzare tutto non è giustificato da M3.

## 9. Test (obbligatori, mappati)

| Richiesta                         | Dove                                                                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Transizioni (unit)                | `shared/pipeline.test.ts`: derivazione completa 7×6, grafo, riapertura, correzione, mappa `status → (stage,outcome)` round-trip    |
| Validazione                       | `schemas`: note, documenti, transizione, id client                                                                                 |
| API                               | `api/test/pipeline.test.ts`, `notes.test.ts`, `documents.test.ts`, `timeline.test.ts`: 409/404/isolamento tra workspace/archiviate |
| Persistenza                       | vincoli del DB (tetti, chiavi composite, `dedupe_key` univoca), `dedupe` su retry                                                  |
| **D5: concorrenza e atomicità**   | API + D1 reale: matrice §1.2, una sola risorsa/evento per ID, 409 per payload differente, rollback con errore evento               |
| **Compatibilità dati M2/M2.5**    | `db:upgrade-test` esteso: DB M2.5 popolato → `0005`; righe, trigger e cronologia identici; stato derivato di ogni scheda esistente |
| Colloqui multipli                 | API + E2E con ≥ 3 round                                                                                                            |
| Accessibilità delle modali        | E2E: focus trap, ripristino, Esc con modifiche, frecce tra schede, axe su ogni scheda, dialoghi di conferma                        |
| Panoramica operativa              | E2E desktop/mobile: azioni accessibili nelle sezioni pertinenti; modulo esistente mantenuto in Dettagli                            |
| E2E desktop **e** mobile (390 px) | `pipeline.spec.ts`, `notes-documents.spec.ts`, estensione di `interviews.spec.ts`                                                  |
| Chiusura e riapertura             | E2E + API: Assunto/a, Rifiutata, Ritirata, Nessuna risposta, riapertura, correzione, archiviazione                                 |
| Regressione                       | tutte le suite esistenti (472 unit/integrazione, 117 E2E, 11 preview) devono restare verdi; mutation check sulle nuove guardie     |
| Controlli di progetto             | `pnpm check` completo (typecheck, lint, format, contrasto, config, `db:check`, `db:upgrade-test`, test, build) + E2E + preview     |

Si dichiarerà verde solo ciò che è stato eseguito, con i conteggi.

## 10. Sequenza di commit (locali, con verifica a ogni passo)

**C0–C2 integrati; C3 autorizzato con test e documentazione del checkpoint. C4/C5 non avviati.** L’ordine segue le dipendenze tecniche: non richiede di riscrivere le parti già presenti di M2.5.

| #   | Commit                                                                             | Verifica prima del commit               |
| --- | ---------------------------------------------------------------------------------- | --------------------------------------- |
| C0  | **M3.0** audit, rebranding, ADR-0013; chiusura con decisioni approvate e relazione | typecheck, lint, format, unit web       |
| C1  | **M3.2** dominio puro: pipeline, timeline, azioni rapide + test                    | unit `shared`                           |
| C2  | **M3.2/3.4** migrazione `0005`, contratti, API, idempotenza                        | `db:check`, `db:upgrade-test`, test API |
| C3  | **M3.1/3.5** modale: stato, azioni, Timeline, Note, Documenti                      | unit web, typecheck, lint, bundle       |
| C4  | **E2E** desktop/mobile, accessibilità, chiusura/riapertura                         | E2E completi + preview                  |
| C5  | Documentazione `docs/m3`, registro dei problemi, relazione                         | `pnpm check` finale                     |

| Fase | Risultato previsto                                                                                  | Dipendenze e verifica di accettazione                                               |
| ---- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| M3.1 | Modale con sei schede, Panoramica operativa, Dettagli con modulo esistente, riferimenti documentali | C2 prima delle scritture; C3 per UI e navigazione; prove mobile/accessibilità in C4 |
| M3.2 | Dieci stati derivati, transizioni, chiusura, riapertura e correzione tracciate                      | C1 dominio; C2 API e migrazione con tutte le condizioni D4; C3 integrazione         |
| M3.3 | Creazioni colloquio idempotenti e coerenza con la pipeline, senza automatismi                       | C2 con tutte le condizioni D5; C3 azioni contestuali; C4 almeno tre round           |
| M3.4 | Timeline stabile e paginata, note manuali, collegamenti alle entità                                 | C1 ordinamento; C2 persistenza/contratti; C3 schede; C4 retry e cronologia          |
| M3.5 | Azioni rapide contestuali nelle sezioni pertinenti                                                  | C1 regole pure; C3 gestori reali; C4 verifica di ogni contesto su desktop/mobile    |

## 11. Rischi

| Rischio                                                   | Mitigazione                                                                                                            |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Ricostruzione di `activity_events` (R-01) su D1 remoto    | Stesso schema di `0004`; `upgrade-test` su DB popolato; **backup obbligatorio prima del deploy** (nessun deploy in M3) |
| Dieci stati contro nove inizialmente richiesti (D1)       | D1 approvata: mantenere «Nessuna risposta» distinta da «Rifiutata», senza attribuire un rifiuto mai comunicato         |
| Bundle: M2.5 +57 kB sul percorso iniziale, nessun budget  | Schede Note/Documenti/Timeline caricate pigramente (`lazy`); misura e confronto nel report finale                      |
| Regressioni sulla modale (716 righe in `card-detail.tsx`) | Nessuna riscrittura: nuove schede come componenti separati; tutti gli E2E di M2/M2.5 invariati e obbligatori           |
| M3 poggia su M2.5 non pubblicato                          | Ordine di integrazione: M2 (`6864d7a`) → M2.5 → M3; nessuna azione su remoto senza autorizzazione                      |
