# ADR-0016 — Smart Workspace: Opportunity/Application, bacheche, viste e insights

**Stato:** Accettato come indirizzo architetturale, con tre decisioni **condizionate** (D2, D3, D12). **Aggiornamento 2026-11-10:** la scelta tecnica della D5 è stata presa — strategia «B ristretta», approvata in modo **condizionato** (vedi «Strategia B ristretta»); **SW.10 non è conclusa.** **Approvazione 2026-11-10:** il proprietario ha approvato il file `0008_cards_nullable_placement.sql` e la sequenza `0008` cards → `0009` applications → `0010` activity_events → `0011` backfill; SW.10-a è committata in locale, non integrata. **Aggiornamento 2026-11-12 (SW.10-d.1):** scritta la migrazione `0011_application_backfill` (solo dati, politica `sw10-backfill-policy/1`), provata **soltanto** su database sintetici; **non applicata a nessun database reale e non committata** · **Data:** 2026-11-09 · **Integra:** ADR-0004, ADR-0007, ADR-0008, ADR-0009, ADR-0010, ADR-0011, ADR-0012 · **Supera in parte:** ADR-0009 §2 («un solo modello di scheda, piatto»), soltanto a partire dall'implementazione delle milestone SW.10–SW.12 · **Roadmap:** [smart-workspace.md](../../roadmap/smart-workspace.md)

Questo ADR registra l'indirizzo, **non autorizza** migrazioni, dipendenze nuove, push, merge o deploy: ciascuna richiede un'approvazione separata (vedi «Conseguenze»).

## Contesto

L'audit P0 (2026-11-09) ha verificato sul codice, a partire da `origin/main` `c007e53`:

- `cards` e `application_details` sono in relazione 1:1 (`card_id` è la chiave primaria di `application_details`). Opportunity e Application non esistono come entità separate. `stage`, `outcome` e `applied_on` stanno in `application_details`.
- Una scheda appartiene a una sola bacheca e a una sola colonna: `cards.board_id` e `cards.column_id` sono `NOT NULL` con chiavi esterne composite. Eliminare una bacheca elimina le sue schede (`ON DELETE CASCADE`).
- Colloqui, note, documenti, etichette, valori dei campi personalizzati e attività puntano alla scheda (`card_id`); gli eventi di attività la referenziano con `ON DELETE SET NULL`.
- Colonna, fase ed esito sono indipendenti (ADR-0009 §1). I campi personalizzati sono per bacheca (ADR-0010) e i trigger impongono che campo e scheda stiano sulla stessa bacheca.
- Le migrazioni arrivano a `0007`. `db:check` impone che lo schema TypeScript corrisponda alle migrazioni; `db:upgrade-test` prova gli aggiornamenti su database popolato.
- La Timeline esiste solo per singola scheda. I filtri della Tabella sono lato server; al momento dell'audit il lavoro SW.1 (filtri del Kanban) era sul branch `feat/m5-sw1-smart-kanban`, non ancora committato.

L'obiettivo di prodotto è passare da un'applicazione centrata sulle bacheche a una centrata sulle opportunità e sulle candidature, senza perdere dati né funzioni e conservando il design visibile di Jobward.

## Decisioni

### D1 — Scope e naming · APPROVATA

Smart Workspace è un'iniziativa **separata** da M5 Public Readiness. Il perimetro comprende Opportunity/Application, Application-first, archivio condiviso, Smart Boards e Smart Views, Kanban e Tabella, Mappa e Matrice, Timeline autonoma, Insights. Gli impegni di M5 non cambiano. Registrazione in [milestones.md](../../roadmap/milestones.md) e [scope-policy.md](../../roadmap/scope-policy.md).

### D2 — Branch UI · CONDIZIONATA

Si preserva l'attuale design visibile. `ui/design-v2` e `feat/ui-dialogs-motion` **non** si integrano automaticamente. Prima di ogni integrazione si esegue un confronto read-only dei componenti rilevanti; si propongono **soltanto** le integrazioni necessarie, senza importare restyling non richiesti. Vedi «Decisioni condizionate».

### D3 — Sequenza rispetto a M4 · APPROVATA CON CONDIZIONI

Se il rilascio privato non è ancora avvenuto, si preferisce migrare il dominio **prima** della pubblicazione con dati utente reali. Il lavoro M4 non si interrompe né si modifica. L'ordine definitivo si stabilisce dopo aver verificato lo stato effettivo di staging, D1 e deploy. **Nessuna migrazione remota senza approvazione separata.** Vedi «Decisioni condizionate».

### D4 — Opportunity/Application · APPROVATA CON MODIFICHE

- Relazione **Opportunity 1:N Application**. Nessun limite rigido (non i 20 proposti nella RFC) come vincolo di dominio: le API usano paginazione e limiti operativi.
- **Candidatura corrente**, regola deterministica (`selectCurrentApplication`, funzione pura in `packages/shared`):
  1. si considerano «attive» le candidature con esito assente o `pending` e fase diversa da `closed`;
  2. se ce n'è almeno una attiva, è corrente quella con `sequence` più alta;
  3. altrimenti è corrente quella con `sequence` più alta tra tutte;
  4. senza candidature, la corrente è nulla.
- `sequence` è assegnata dal server, strettamente crescente per Opportunity e mai riusata: l'ordine è totale, non servono altri criteri di spareggio.
- **Ambiguità esplicita:** se le attive sono più di una, l'API espone `activeApplicationCount` e `currentApplication.ambiguous = true`, e l'interfaccia lo dichiara («N candidature attive: mostrata la più recente»). Le statistiche lavorano per candidatura, non per «corrente».
- Il puntatore `application_details.current_application_id` è denormalizzato, ricalcolato dalla stessa funzione nello stesso `batch` di ogni scrittura e verificato da un controllo di coerenza.
- Il tetto operativo di protezione per Opportunity (se serve) si fissa nel piano di migrazione: non è un vincolo di dominio, non tronca in silenzio.

### D5 — Opportunity indipendente dalle bacheche · NON APPROVATA la «Inbox» come bacheca obbligatoria

- Un'Opportunity esiste a prescindere dalle bacheche; salvarla non richiede di crearne una.
- **Inbox** è una **vista di sistema** (opportunità senza appartenenza a bacheche manuali), non una bacheca.
- Il passaggio dallo schema legacy avviene con **migrazioni additive** e senza eliminare subito `board_id`.
- **Vincolo tecnico verificato:** con `cards.board_id` e `cards.column_id` `NOT NULL` e FK composite, un'opportunità senza bacheca non è rappresentabile senza (a) ricostruire `cards`, con effetto su tutte le FK figlie e sul `PRAGMA foreign_keys` di D1, oppure (b) un riferimento tecnico di compatibilità non visibile all'utente. La scelta tra le opzioni si fa nel **piano di migrazione SW.6**, con approvazione prima di scrivere codice. L'opzione (b) è transitoria e va rimossa nel cleanup.
- Conseguenza di prodotto da approvare in SW.6: oggi l'eliminazione di una bacheca elimina le sue schede. Con opportunità indipendenti, eliminare una bacheca **non** deve eliminare le opportunità; richiede una modifica di servizio e di testo di conferma.
- **Esito (2026-11-10):** scelta l'opzione (a), ricostruzione di `cards` **una tantum** (migrazione `0008`); l'opzione (b) resta come ripiego, non adottata. Vedi «Strategia B ristretta».

### D6 — Colloqui · APPROVATA

I colloqui appartengono alla specifica **Application**. Numerazione e sequenza sono per candidatura. La timeline dell'Opportunity aggrega i colloqui di tutte le sue candidature. Identificatori e storico esistenti si preservano: nel backfill ogni colloquio mantiene `id`, `sequence` e dati, e riceve soltanto `application_id`.

Nota tecnica: l'unicità `(card_id, sequence)` di `interviews` è un **indice** (`CREATE UNIQUE INDEX`), quindi si sostituisce con `(application_id, sequence)` aggiungendo il nuovo indice ed eliminando il vecchio, senza ricostruire la tabella. Un colloquio non può esistere senza candidatura: l'invariante è imposta da trigger (le FK composite non si aggiungono con `ALTER`).

**Emendamento D6 (2026-11-12, approvato con SW.10-d.0c; in vigore dalla `0011`).** Il backfill `0011` **non** valorizza `interviews.application_id` né `application_details.current_application_id`: i colloqui di un'opportunità convertita restano senza `application_id` (e lo restano, oltre alle opportunità non convertite, finché non esiste una **fase di riconciliazione separata**, con propria approvazione, che li colleghi alla candidatura giusta). `id`, `sequence` e dati dei colloqui esistenti restano comunque invariati. Il vincolo «un colloquio non può esistere senza candidatura» vale **dopo** la riconciliazione e lo switch, non durante il backfill. Nessun collegamento automatico e nessun evento sintetico.

### D7 — Mappa · APPROVATA COME MVP CON LIMITAZIONI

Nessuna dipendenza obbligatoria da provider esterni; dati geografici e confini **incorporati**, compatibili con CSP e privacy. Non si inventano coordinate, distanze o tempi di percorrenza; un luogo non riconosciuto con certezza resta «non localizzabile». Niente routing, niente geolocalizzazione obbligatoria, niente servizi a pagamento. Ogni nuova libreria richiede verifica di licenza, dimensione del bundle e approvazione.

### D8 — Ruolo e ambito · APPROVATA

- Si conserva il titolo originale della posizione (`jobTitle`).
- Si aggiunge un campo **ruolo** strutturato ma flessibile, con una chiave di normalizzazione **deterministica** per ricerca e filtri (minuscole, accenti e spazi), non semantica.
- **Ambito professionale** è un attributo distinto dal ruolo e dal titolo.
- Nessuna tassonomia rigida, nessuna classificazione automatica ambigua, nessun riempimento automatico dei dati esistenti: l'utente sceglie esplicitamente. Valori suggeriti dai suoi stessi dati.

### D9 — Opportunity/Bacheca N:M · APPROVAZIONE DI PRINCIPIO

Il modello target supporta l'appartenenza **N:M** tra opportunità e bacheche manuali. Le Smart Boards usano regole e query, senza duplicare opportunità. La fase di introduzione della N:M si decide in base alle dipendenze tecniche; se il primo incremento funziona senza perdita di capacità, non serve introdurla subito. Nella roadmap è SW.15, dopo il dominio e le Smart Boards.

### D10 — Drag and drop · APPROVATA

Nei raggruppamenti virtuali il trascinamento che modifica attributi è inizialmente **disabilitato**. Per cambiare fase, priorità o altri campi si usano azioni esplicite e validate (per la fase, le regole di `evaluatePipelineTransition`). Le bacheche manuali conservano il comportamento attuale. Raggruppare non scrive mai.

### D11 — Smart Board e Smart View · APPROVATA

Sono concetti distinti.

- **Smart Board:** spazio organizzativo e dataset di riferimento (regole/query sull'archivio).
- **Smart View:** layout, filtri, ordinamenti, raggruppamenti, campi visibili e metriche.
- Una Smart Board può avere più Smart Views; le viste si applicano **sopra** il dataset e non duplicano i record canonici.

### D12 — Insights · APPROVAZIONE PARZIALE (condizionata)

Non si adotta universalmente la finestra di maturità di 14 giorni. Ogni metrica ha formula e denominatore espliciti. Si distinguono **candidature inviate**, **risposte ricevute**, **candidature aperte** e **coorti con finestra di osservazione definita**. Una candidatura senza risposta dopo 14 giorni **non** è considerata un rifiuto. Le definizioni vanno riconciliate con M4-C1 prima dell'implementazione. Vedi «Decisioni condizionate».

### D13 — Snapshot · APPROVATA

All'invio di una candidatura si registra uno snapshot dei dati rilevanti dell'opportunità (immutabile, versionato). Per le candidature legacy lo snapshot è **ricostruito** e marcato `source:'backfill'`: non è presentato come fatto storico certo.

**Semantica dei timestamp del backfill (2026-11-12).** Le candidature ricostruite ereditano `created_at`/`updated_at` da `application_details` **senza modifiche** (`details.created_at` è la prima scrittura dei dettagli, **non** la data di invio; `details.updated_at` è l'ultima). Lo snapshot di backfill usa `created_at = max(cards.updated_at, application_details.updated_at)`: un riferimento **tecnico** (ultima scrittura dei dati da cui è ricostruito), **mai** presentato come data storica di invio. La data storica, se nota, è `applied_on`, copiata com'è. La migrazione non legge l'orologio.

## Principi di migrazione (vincolanti per SW.6 e successive)

1. **expand → backfill → dual-write → switch → deprecate.** Nessun `DROP` di colonne legacy senza una migrazione dedicata e approvata.
2. Migrazioni additive, scritte a mano quando serve (`ALTER … ADD COLUMN`), con la stessa cura di `0003`/`0006`: prova di aggiornamento su database popolato, conservazione riga per riga, `foreign_key_check`, presenza dei vincoli, isolamento tra workspace, esito di rollback.
3. D1 non offre rollback transazionale delle migrazioni: il piano prevede export preventivo a carico del proprietario e codice che continua a leggere le colonne legacy finché lo switch non è verificato.
4. Il piano dettagliato di ogni migrazione è prodotto e **approvato prima** di scriverla. Nessuna migrazione remota senza approvazione separata.
5. Le uniche ricostruzioni di tabella previste nel dominio sono due: `cards` **una sola volta** (migrazione `0008`, posizionamento facoltativo) e `activity_events` (nuovi tipi di evento e `application_id`, con il precedente di `0004`/`0005`). _Emendato il 2026-11-10: il testo originale ammetteva la sola `activity_events`._ Nessun'altra tabella radice viene ricostruita; il modello finale non richiede ulteriori ricostruzioni di `cards` (dopo SW.15 `board_id`/`column_id` restano `NULL` e ignorati).
6. I campi personalizzati restano per bacheca; con la N:M il trigger «campo e scheda sulla stessa bacheca» si riscrive in «la scheda ha un posizionamento sulla bacheca del campo». Prima della N:M il comportamento non cambia.

## Strategia B ristretta (approvata in modo condizionato il 2026-11-10)

**Decisione.** La tabella fisica resta `cards`; viene ricostruita **una tantum** perché `board_id` e `column_id` diventino nullable, con `CHECK ((board_id IS NULL) = (column_id IS NULL))` e FK verso bacheca e colonna in `NO ACTION` (fail-closed: il database rifiuta di eliminare una bacheca che ha ancora schede). Tutto il resto del dominio (Application, snapshot, eventi) è additivo. L'alternativa A (bacheca di sistema invisibile) è **scartata come strategia primaria** e resta ripiego: rimanda il costo della ricostruzione e lascia nel modello una bacheca falsa che ogni query deve ricordarsi di escludere.

**Perché ora.** Secondo SW.0b (2026-11-10) non esistono D1 remoti né Worker Jobward nell'account controllato: la ricostruzione non è mai eseguita su dati remoti popolati. Lo spike SW.6 (database sintetici, 49.075 righe) l'ha provata: nessuna differenza di dati, ID invariati, 20 guasti iniettati con rollback totale, recupero verificato.

**Numerazione (approvata dal proprietario il 2026-11-10).** Il piano SW.6 ipotizzava `0011`. La ricostruzione ha elenchi di colonne **espliciti** (schema `0007`): una migrazione con numero inferiore che aggiungesse colonne a quelle tabelle (es. SW.7) e fosse applicata prima le farebbe perdere **in silenzio**. Per questo ha il numero lineare successivo, `0008`, e la sequenza scala: `0008` cards, poi `applications`, poi la ricostruzione di `activity_events`, poi il backfill; SW.7/SW.8/SW.9, SW.12 e le successive prendono i numeri successivi a `0011`, da ricontrollare contro `main` e gli altri branch prima di scrivere ciascuna (la tabella della [roadmap](../../roadmap/smart-workspace.md) li riporta come indicativi). Corollario: ogni migrazione che aggiunga colonne a `activity_events` deve avere un numero superiore a `0010`, che la ricostruisce con elenchi espliciti. **Ordine delle dipendenze:** `cards` per prima; `applications` dopo (una FK o un trigger verso una tabella non ancora esistente fa rifiutare _ogni_ INSERT sul figlio, anche con NULL: provato); gli eventi dopo `applications` (così la FK `application_id` è valida).

**Condizioni per l'applicazione reale** (nessuna migrazione è stata applicata a un database reale):

1. approvazione finale del proprietario dopo la revisione dei risultati dello spike e di SW.10-a;
2. copia del D1 locale persistente (come il `before-0004` già esistente) **prima** di applicarla, e verifica della copia;
3. su un D1 remoto, esecuzione solo con tabelle vuote o piccole: sulla fixture grande (49.075 righe) la ricostruzione richiede ~12,8 s localmente e il limite di esecuzione di D1 (30 s, valore documentato non riverificato) potrebbe avvicinarsi;
4. se lo staging verrà creato **dopo** le migrazioni del dominio nascerà già allo schema finale, vuoto: la ricostruzione non girerà mai su dati remoti. Se invece verrà creato a `0007` e popolato, serve una decisione separata;
5. nessuna migrazione remota senza approvazione separata (principio 4).

**Recupero.** Backup a freddo del file D1 prima di ogni migrazione ricostruttiva. Da export: `wrangler d1 export` completo **non è importabile con dati** (scrive le tabelle in ordine alfabetico con i propri `INSERT`: fallisce identico anche prima della ricostruzione) e, dopo la ricostruzione, nemmeno «schema + un solo file di dati» (`cards` non precede più i suoi figli in `sqlite_master` e il trigger dei campi personalizzati vede schede ancora assenti). La procedura verificata è: **schema** (`--no-data`), poi i **dati una tabella per file in ordine di dipendenza** (`users`, `workspaces`, `workspace_members`, `boards`, `board_columns`, `labels`, `cards`, `application_details`, `card_labels`, `custom_field_definitions`, `custom_field_values`, `interviews`, `card_notes`, `card_documents`, `tasks`, `activity_events`): database nuovo identico, `foreign_key_check` vuoto.

**Limiti della prova di atomicità.** Il file di migrazione e l'`INSERT` in `d1_migrations` sono inviati da wrangler come **una sola esecuzione**, che il codice di wrangler dichiara transazionale lato D1 («D1 runs your SQL in a transaction for you»). In locale l'annullamento è provato (20 guasti iniettati più 3 interruzioni brusche). Su un D1 **remoto** non è stata osservata: richiederebbe un D1 di prova, che non è autorizzato. Il `PRAGMA integrity_check` è rifiutato da D1 anche in locale: l'integrità si verifica con `foreign_key_check` e, nelle prove locali, con il CLI `sqlite3` su una copia chiusa.

**Anomalia non attribuita (D1 personale del proprietario).** Il D1 persistente locale del proprietario (`apps/api/.wrangler/state`, nel worktree principale; 3 schede) ha cambiato data di modifica tre volte il 2026-11-10 (04:25:50 e 04:55:34 durante le corse dello spike, 16:25:09 durante SW.10-a). Nessun processo di questo lavoro l'ha aperto (solo `stat`). La seconda modifica è avvenuta con quel worktree montato in **sola lettura** nel namespace dello spike e un secondo dopo la ripresa dalla sospensione della macchina (journal: `Lid closed. Suspending...` alle 04:39:55): l'autore è esterno, verosimilmente lo stack di sviluppo del proprietario (un `wrangler dev --env dev` attivo dall'8 novembre). La prima e la terza modifica **non sono attribuibili con certezza**; per la terza i test permanenti di SW.10-a non girano nel namespace in sola lettura dello spike, quindi un contributo di questo lavoro non è escluso in modo dimostrabile, ma nessun suo processo ha aperto quel file né gli ha applicato una migrazione. **Il proprietario (2026-11-10) non considera attribuite le modifiche osservate**: restano un'anomalia aperta, non una conferma.

**Stato.** SW.10-a (`0008`, `deleteBoard`, contratti, LEFT JOIN, test) è implementata, approvata (file e sequenza, 2026-11-10) e committata in locale nel branch `feat/m5-sw1-smart-kanban`; **non integrata, nessuna migrazione applicata a database reali** (restano la condizione 1–5 sopra). **SW.10-b** (`0009_applications_snapshots.sql`: `applications`, `application_snapshots`, `application_details.current_application_id`, `interviews.application_id`, 10 trigger) è **implementata e committata in locale** (2026-11-11), con le decisioni del proprietario: **D1** `applications_no_direct_delete` approvato in via **temporanea** (non è una decisione di prodotto: ritiro, archiviazione, eliminazione esplicita e cancellazione del workspace restano da distinguere; le sequenze assegnate non si riusano), **D2** sequenze strettamente crescenti, fingerprint univoco per opportunità, un solo snapshot di backfill per candidatura, backfill deterministico e idempotente, **D3** `interviews.application_id` in `NO ACTION` con `card_id` e vincoli legacy invariati. Solo strutture: nessun servizio le usa (niente dual-write, backfill, rotte o UI); **nessuna migrazione applicata a database reali**, nessun push. Garanzie, requisiti di concorrenza e semantica di stage/outcome nullable: [database.md](../database.md#candidature-e-snapshot-migrazione-0009-m5-sw10-b). **SW.10-c** (`0010_activity_events.sql`: ricostruzione di `activity_events` con `application_id` nullable — FK semplice `SET NULL` —, i tipi `application_created`, `card_placed`, `card_unplaced`, trigger di coerenza workspace/opportunità e vincoli di idempotenza e di payload per i soli tipi nuovi) è **implementata e committata in locale** (2026-11-11, revisione positiva), senza push. Decisioni del proprietario (2026-11-11): **D1** il backfill `0011` non genera eventi `application_created` (il database lo rifiuta per le candidature con `origin = 'backfill'`); **D2** `card_moved` resta; **D3** contratto futuro del posizionamento (`card_moved` tra colonne della stessa bacheca, `card_unplaced`, `card_placed`, trasferimento = coppia con lo stesso `operation_id`); **D4** chiavi di deduplica deterministiche con tipo, entità, operazione e bacheca; **D5** metadati JSON versionati senza testo libero; **D6** i nuovi eventi sono predisposti ma **non emessi**, `deleteBoard` non emette `card_unplaced`, la cronologia li esclude finché sono «dormienti». Dettagli: [database.md](../database.md#cronologia-e-candidature-migrazione-0010-m5-sw10-c). **SW.10 nel suo complesso non è conclusa:** restano SW.10-d (`0011`, backfill) e gli switch.

## Backfill delle candidature (`0011`, SW.10-d)

**Stato.** `packages/database/migrations/0011_application_backfill.sql` è scritta e provata su database **sintetici** (node:sqlite e D1 locale/workerd). **Non è stata applicata a nessun database reale** (né locale persistente, né staging, né produzione) e non è committata. Applicarla richiede approvazione separata, backup a freddo verificato e prova a secco su una **copia** (procedura: [database.md](../database.md#backfill-delle-candidature-migrazione-0011-m5-sw10-d)).

**Politica.** `sw10-backfill-policy/1`, definita e validata in SW.10-d.0b–d.0d (`sw10-d0d-final-classification-migration-readiness` (archivio storico)). Una candidatura si crea **solo** per le opportunità SUBMITTED (prova indipendente di invio: `applied_on` data valida con fase non preparatoria, oppure un evento `application_submitted` interpretabile, non di correzione) e DRAFT (fase `preparing` esplicita, senza evidenza contraria). La fase da sola, `stage_changed`, `card_moved`, le correzioni, i colloqui e gli esiti **non** sono prove di invio. AMBIGUOUS e NO_APPLICATION restano opportunità senza candidatura: nessuna riga, nessun evento, nessuna correzione automatica. Le decisioni Q1 (l'`application_submitted` della pipeline è evidenza) e Q2 (`stage_changed`/`card_moved`/correzioni non lo sono) sono confermate dal proprietario. Qualunque modifica di regole, evidenza o mappatura dati richiede una **nuova** `policyVersion`, un nuovo manifest e una nuova approvazione.

**Garanzie della migrazione.** Solo dati: scrive in `applications` e `application_snapshots`, mai in `cards`, `application_details`, `interviews`, `activity_events`; non collega nulla; non genera eventi; non legge l'orologio. Id deterministici (`app-bf-<card_id>`, `snap-bf-<card_id>`), `origin='backfill'`, `sequence=1`, `backfill_rule` = identificatore stabile della regola, `request_fingerprint` NULL. Idempotenza **per Opportunity**. Guardie nominate (`m11_g*`): lineage esatta 0000–0010, collegamenti legacy assenti, righe di backfill preesistenti coerenti, nessun conflitto con candidature non di backfill, nessuna esclusione silenziosa, nessuna riga non qualificata, copia fedele (valori, tipi, timestamp). Un conflitto non previsto è un **errore esplicito**, mai un'esclusione silenziosa. Il manifest (`scripts/audit/sw10d0/policy-manifest.json`) lega versione, hash del classificatore, hash del file e lineage attesa.

**Limiti dichiarati.** Atomicità su D1 **remoto** e Time Travel non verificati. Frequenze reali dei casi (falsi positivi/negativi) ignote fino alla prova a secco su una copia. I record AMBIGUOUS non hanno ancora un canale di risoluzione (servizio con `origin='user'`) né una riconciliazione dei colloqui: sono fasi successive.

## Alternative scartate

- **Bacheca interna invisibile come strategia primaria (opzione A di SW.6):** vedi «Strategia B ristretta»; resta ripiego.
- **Rinominare fisicamente `cards` in `opportunities`:** tocca ogni FK e la ricostruzione richiede `PRAGMA foreign_keys`; rischio non giustificato. Il dominio chiama `Opportunity` la scheda nei tipi di `shared`.
- **Inbox come bacheca obbligatoria** (RFC, D5): vincola l'Opportunity a una bacheca, contro il requisito di indipendenza.
- **Limite rigido di 20 candidature per Opportunity** (RFC, D4): un limite di dominio senza motivazione; sostituito da paginazione e tetti operativi.
- **Finestra di maturità di 14 giorni valida per tutte le metriche** (RFC, D12): trasforma il silenzio in un'informazione che non abbiamo.
- **Tassonomia fissa dei ruoli o classificazione automatica:** ambigua e contraria al principio «nessuna AI obbligatoria».
- **Provider esterni di mappe, geocoding o routing:** CSP (`connect-src 'self'`, `img-src 'self' data:`), privacy e gratuità.
- **Trascinamento che modifica attributi nei gruppi virtuali:** scritture come effetto collaterale di una vista (cfr. ADR-0009, alternative scartate).
- **Unire Smart Board e Smart View in un solo concetto:** confonde il dataset con la sua presentazione.

## Decisioni condizionate

| ID  | Condizione                                                                                                                                            | Evidenza finora                                                                                                                                                                                                                                                                                                                                 | Cosa resta da fare                                                                                                                               | Effetto finché è aperta                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| D2  | Confronto read-only dei componenti con `ui/design-v2` e `feat/ui-dialogs-motion`; integrare solo ciò che serve.                                       | Sovrapposizione di file verificata (2026-11-09): `ui-dialogs-motion` ∩ SW.1 = `opportunities/filters-panel.tsx`; `ui/design-v2` (non committato) tocca anche `routes/board.tsx`, `kanban/card-view.tsx`, `kanban/kanban-column.tsx`, `workspace-page-header.tsx`, `dialog.tsx` e la barra laterale. Nessun confronto di merito ancora eseguito. | Eseguire SW.0a: matrice componente per componente, con proposta minima di integrazione, approvata dal proprietario.                              | Nessuna integrazione automatica. SW.2 e SW.5 non toccano la struttura di `workspace-page-header` né la nav fuori da quanto dichiarato. |
| D3  | Verificare lo stato effettivo di staging, D1 e deploy prima di fissare l'ordine definitivo; non interrompere M4; migrazioni remote solo se approvate. | Dalla documentazione M4 (inventario Cloudflare M4.1-A del 2026-11-09, non ancora integrato in questo branch): staging **BLOCKED**, **0** database D1 nell'account inventariato, nessun deploy, migrazioni `0000`–`0007` solo locali; `milestones.md`: «RELEASE READY: no». È un'evidenza documentale, non una verifica live.                    | Eseguire SW.0b prima di SW.10: conferma dello stato (lettura autorizzata o dichiarazione del proprietario) e dei dati locali che vanno protetti. | Ordine preferito: dominio **prima** della pubblicazione con dati reali. Migrazioni solo locali.                                        |
| D12 | Riconciliare le definizioni con M4-C1; formule e denominatori espliciti per metrica.                                                                  | M4-C1 («Analytics & Insights») è nel [piano M4](../../roadmap/m4-private-release-plan.md#checkpoint-m4) come checkpoint da specificare; non esiste ancora una specifica di metriche approvata con cui riconciliare.                                                                                                                             | Eseguire SW.0c: specifica unica delle metriche (popolazioni, formule, denominatori, esclusi), condivisa con M4-C1, approvata prima di SW.18.     | Nessuna implementazione di Insights; nessuna soglia di maturità adottata.                                                              |

## Conseguenze

- Nessun cambiamento al codice applicativo, al database o alle API per effetto di questo ADR.
- Ogni milestone SW che introduce una migrazione, una dipendenza o un'integrazione con un altro branch passa da un'approvazione esplicita (vedi la roadmap).
- ADR-0009 §2 resta valido fino a SW.12; da allora l'Opportunity e la candidatura sono entità distinte, con le colonne legacy mantenute come specchio della candidatura corrente fino al cleanup.
- Le milestone M3/M4 e gli impegni di M5 Public Readiness non cambiano.
