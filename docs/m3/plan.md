# M3 — Piano tecnico

**Stato:** proposta, in attesa di conferma delle decisioni D1–D6 (§1). Nessuna riga di M3.1–M3.5 è stata scritta.
Premessa: M2.5 ha già costruito modale, colloqui e cronologia di base ([audit §4](audit.md)). M3 **completa e collega**: non riscrive.

## 1. Decisioni da confermare

| #      | Decisione                               | Proposta (predefinita)                                                                                                                                                                                                                                                                                                     | Alternativa                                                                                                                  |
| ------ | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Modello della pipeline                  | **Stato generale _derivato_** da `stage` + `outcome` + `archivedAt` (che restano la fonte di verità). Nessuna colonna nuova, nessun backfill, compatibilità totale con i dati M2/M2.5. **Dieci** stati: i nove richiesti + **«Nessuna risposta»** (vedi §2.1).                                                             | Colonna `status` memorizzata con backfill: più semplice da interrogare, ma duplica la verità e rischia stati contraddittori. |
| **D2** | Schede della modale                     | **Sei**: Panoramica · Colloqui · Timeline · Note · Documenti · **Dettagli** (il modulo di modifica di M2, che M3 elenca tra le funzioni da **mantenere**). `#cronologia` resta valido come alias di Timeline. A telefono la fila di schede scorre _dentro se stessa_ (la pagina non scorre in orizzontale).                | Fondere Dettagli in Panoramica: refactor di `card-detail.tsx` (716 righe) con rischio di regressione.                        |
| **D3** | Documenti                               | **Riferimenti, non file**: titolo, tipo (CV, lettera, annuncio, portfolio, altro), URL `http(s)` facoltativo, nota. **Nessun caricamento**: richiederebbe R2 (dipendenza cloud nuova, esclusa dal backlog fino a dopo M4), conflitta con la CSP e con la Local Edition.                                                    | Rimandare la scheda (nessun controllo finto); oppure R2 in una milestone dedicata.                                           |
| **D4** | Migrazione `0005`                       | **Una sola**: tabelle `card_notes` e `card_documents` (additive) + colonna `dedupe_key` e tipo `application_reopened` su `activity_events`. Il tipo nuovo obbliga a **ricostruire `activity_events`** come in `0004` (stesso schema collaudato: guardia sui conteggi, trigger ricreati, `db:upgrade-test` su DB popolato). | Riusare `application_closed` con metadati «riaperta»: evita la ricostruzione ma falsa il significato dell'evento.            |
| **D5** | Anti-duplicazione dei retry             | **Id generato dal client all'apertura del modulo** per le creazioni (colloqui, note, documenti): un secondo invio con lo stesso id restituisce la risorsa esistente senza un secondo evento (stesso id e dati diversi → 409). Gli eventi hanno `dedupe_key` univoca. Nessuna tabella di chiavi di idempotenza.             | Header `Idempotency-Key` + tabella dedicata: più generale, più codice e stato da ripulire.                                   |
| **D6** | Rename dei pacchetti `@meet-roulette/*` | **Non ora** ([ADR-0013](../architecture/decisions/0013-rebranding-jobward.md)). Commit meccanico isolato, a richiesta.                                                                                                                                                                                                     | Farlo in M3.0.                                                                                                               |

Inoltre: la modalità di colloquio «altro» **non** si aggiunge (richiederebbe un'altra ricostruzione, di `interviews`): «non specificata» + testo libero in _luogo/link_ copre il caso. Da dichiarare come limitazione.

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

Gli esiti chiusi precedono la fase (una candidatura `closed`/`rejected` è «Rifiutata», qualunque fosse la fase). **Nessuna deduzione automatica**: la derivazione _legge_ dati inseriti dall'utente, non ne inventa. Test: tutte le 7 × 6 combinazioni fase/esito + archivio hanno uno stato unico e definito.

### 2.2 Transizioni

Tabella pura `PIPELINE_TRANSITIONS` + `allowedTransitions(status)`; tipi di transizione: `advance` (avanzamento), `close` (verso uno stato chiuso), `reopen` (da chiuso a aperto), `correction` (qualunque → qualunque, marcata).

- **Avanzamento:** Salvata → Inviata → Screening → In colloqui → Offerta (si può saltare in avanti: ci si candida e si riceve subito un colloquio).
- **Chiusura:** da qualunque stato aperto verso Rifiutata / Ritirata / Nessuna risposta; **Assunto/a solo da Offerta**. Chiedere conferma; per Assunto/a, Rifiutata, Ritirata un dialogo esplicito.
- **Riapertura:** da chiuso a uno stato aperto (predefinito: quello precedente alla chiusura, letto dalla cronologia). Genera `application_reopened`.
- **Correzione:** «Correggi stato» consente qualunque destinazione, scrive l'evento con `kind: "correction"` e **non cancella** nulla: gli eventi sbagliati restano nello storico (append-only).
- Una candidatura archiviata non cambia stato: si ripristina prima (409, come oggi).

### 2.3 Scrittura

`POST /cards/:id/pipeline` `{ to, kind, expectedFrom }` — sottile involucro su `updateCard`: imposta `(stage, outcome, appliedOn?)` in **un'unica `batch()`**, con gli eventi esistenti (`stage_changed`, `application_submitted`, `application_closed`) più il nuovo `application_reopened`. `expectedFrom` dà un controllo ottimistico (409 se nel frattempo lo stato è cambiato) e rende il retry sicuro: se lo stato è già `to` con lo stesso `kind`, risposta 200 senza secondo evento. `PATCH /cards/:id` (modulo Dettagli) continua a funzionare e produce gli stessi eventi: **una sola fonte di eventi**, nessun evento «pipeline» parallelo.

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
- **Lettura:** `GET /cards/:id/timeline?before=&limit=` → voci `{ id, source: 'system' | 'note', kind, occurredAt, entity: { type, id } | null, data }`, ordinate per `(occurredAt desc, id desc)` — **ordine totale e stabile** a parità di istante; paginazione a cursore.
- **Collegamento alle entità:** `entity` punta a colloquio / nota / documento / scheda; la UI apre la scheda corretta.
- **Eventi mostrati:** creazione, invio, cambio stato (con _Offerta ricevuta_ derivata da `stage_changed → offer`), pianificazione/modifica/completamento/annullamento colloquio, feedback, chiusura, **riapertura** (nuovo, risolve M3-01), correzione. Distinti visivamente dalle note (icona + etichetta «Nota» per le manuali, testo accessibile, non solo colore).
- **Retry:** `activity_events.dedupe_key` (nullable, indice univoco parziale su `(workspace_id, dedupe_key)`), inserimento `ON CONFLICT DO NOTHING`. Chiavi: `interview_created:<id>`, `note_added:<id>`, `application_reopened:<cardId>:<transizione>`. Gli eventi esistenti restano con chiave nulla (compatibili).
- **Note:** `card_notes(id, workspace_id, card_id, body ≤ 10.000, created_at, updated_at)`, chiave composita (scheda, workspace) come i colloqui; tetto 500 per scheda (atomico). Creazione, modifica, eliminazione **con conferma**; su candidatura archiviata sola lettura (409 in scrittura).

## 5. Documenti (M3.1, D3)

`card_documents(id, workspace_id, card_id, title ≤ 200, kind, url?, note?, created_at, updated_at)`, tetto 50. Nessun caricamento, nessun fetch dell'URL (niente SSRF, niente anteprime), apertura con `rel="noopener noreferrer"`. Dichiarato nell'interfaccia: _«Jobward conserva il riferimento, non il file.»_

## 6. Azioni rapide (M3.5)

Funzione pura `quickActions({ status, summary, hasNotes })` → elenco ordinato di id; la UI le associa ai gestori. Mostrate nella scheda Panoramica e nel piè di pagina; nella card Kanban solo la principale.

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
| **Compatibilità dati M2/M2.5**    | `db:upgrade-test` esteso: DB M2.5 popolato → `0005`; righe, trigger e cronologia identici; stato derivato di ogni scheda esistente |
| Colloqui multipli                 | API + E2E con ≥ 3 round                                                                                                            |
| Accessibilità delle modali        | E2E: focus trap, ripristino, Esc con modifiche, frecce tra schede, axe su ogni scheda, dialoghi di conferma                        |
| E2E desktop **e** mobile (390 px) | `pipeline.spec.ts`, `notes-documents.spec.ts`, estensione di `interviews.spec.ts`                                                  |
| Chiusura e riapertura             | E2E + API: Assunto/a, Rifiutata, Ritirata, Nessuna risposta, riapertura, correzione, archiviazione                                 |
| Regressione                       | tutte le suite esistenti (472 unit/integrazione, 117 E2E, 11 preview) devono restare verdi; mutation check sulle nuove guardie     |
| Controlli di progetto             | `pnpm check` completo (typecheck, lint, format, contrasto, config, `db:check`, `db:upgrade-test`, test, build) + E2E + preview     |

Si dichiarerà verde solo ciò che è stato eseguito, con i conteggi.

## 10. Sequenza di commit (locali, con verifica a ogni passo)

| #   | Commit                                                          | Verifica prima del commit               |
| --- | --------------------------------------------------------------- | --------------------------------------- |
| C0  | **M3.0** audit, rebranding, ADR-0013 _(fatto)_                  | typecheck, lint, format, unit web       |
| C1  | **M3.2** dominio puro: pipeline, timeline, azioni rapide + test | unit `shared`                           |
| C2  | **M3.2/3.4** migrazione `0005`, contratti, API, idempotenza     | `db:check`, `db:upgrade-test`, test API |
| C3  | **M3.1/3.5** modale: stato, azioni, Timeline, Note, Documenti   | unit web, typecheck, lint, bundle       |
| C4  | **E2E** desktop/mobile, accessibilità, chiusura/riapertura      | E2E completi + preview                  |
| C5  | Documentazione `docs/m3`, registro dei problemi, relazione      | `pnpm check` finale                     |

## 11. Rischi

| Rischio                                                   | Mitigazione                                                                                                            |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Ricostruzione di `activity_events` (R-01) su D1 remoto    | Stesso schema di `0004`; `upgrade-test` su DB popolato; **backup obbligatorio prima del deploy** (nessun deploy in M3) |
| Dieci stati contro nove richiesti (D1)                    | Decisione esplicita, reversibile: «Nessuna risposta» si può fondere in «Rifiutata» cambiando una riga della tabella    |
| Bundle: M2.5 +57 kB sul percorso iniziale, nessun budget  | Schede Note/Documenti/Timeline caricate pigramente (`lazy`); misura e confronto nel report finale                      |
| Regressioni sulla modale (716 righe in `card-detail.tsx`) | Nessuna riscrittura: nuove schede come componenti separati; tutti gli E2E di M2/M2.5 invariati e obbligatori           |
| M3 poggia su M2.5 non pubblicato                          | Ordine di integrazione: M2 (`6864d7a`) → M2.5 → M3; nessuna azione su remoto senza autorizzazione                      |
