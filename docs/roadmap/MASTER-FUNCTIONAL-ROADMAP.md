# Master Functional Roadmap

**Stato:** canonico (pianificazione per capacità) · **Origine:** JW-CORE-01 (2026-11-21) · **Stato del codice di riferimento:** `main` `c007e53`.

Questa roadmap descrive l'evoluzione **per capacità di prodotto e dipendenze tecniche** verso il [prodotto ideale](../product/PRODUCT-VISION.md). Non sostituisce né amplia le milestone esistenti:

- **Milestone operative** (impegni): [milestones.md](milestones.md) (M0–M5) e [piano M4](m4-private-release-plan.md) (M4-C1…C5).
- **Iniziativa Smart Workspace** (separata da M5, decisione D1 del proprietario): roadmap SW.0a–SW.20 e ADR-0016 nel ramo locale (vedi [Riferimenti fuori da main](#riferimenti-smart-workspace)).
- **Vincolo:** [scope policy](scope-policy.md). Una voce marcata «richiede decisione» **non è approvata**; la presenza in questa roadmap non la assegna a nessuna milestone e nessun agente può implementarla senza una decisione esplicita del proprietario.

**Priorità:** P0 fondamentale (blocca la visione o è un impegno M4) · P1 importante · P2 evolutiva · P3 esplorativa.
**Stato verificato** (al 2026-11-21): Implementata · Parziale · Ramo locale (non integrato, non verificato qui) · Pianificata (in M4 o SW) · Proposta (solo visione) · Fuori roadmap (vietata dalla scope policy senza decisione). Nessuna percentuale di completamento: vedi [FEATURE-MATRIX](../status/FEATURE-MATRIX.md) per le evidenze.

**Aggiornamento v1 (2026-11-21):** la colonna «Stato» dell'indice riflette `jobward-v1` ([ADR-0017](../architecture/decisions/0017-local-v1-baseline.md), [FEATURE-MATRIX](../status/FEATURE-MATRIX.md)); i blocchi di dettaglio conservano l'analisi di JW-CORE-01.

Dipendenze e percorso critico: [DEPENDENCIES](DEPENDENCIES.md). Classificazione degli interventi (A/B/C): [IMPLEMENTATION-PLAN](IMPLEMENTATION-PLAN.md).

## Indice delle voci

| ID   | Nome                                             | Pr. | Stato                         | Aggancio            |
| ---- | ------------------------------------------------ | --- | ----------------------------- | ------------------- |
| A-01 | Separazione Opportunity / Application            | P0  | Implementata (v1)             | SW.10–SW.13         |
| A-02 | Politica unica delle transizioni                 | P0  | Implementata (v1)             | SW.12; nuovo        |
| A-03 | Storico eventi della candidatura                 | P0  | Parziale (v1)                 | SW.10-c, SW.12      |
| A-04 | Compatibilità legacy e coerenza                  | P0  | Superata (ADR-0017)           | SW.10-d, SW.11      |
| A-05 | Auditabilità delle modifiche                     | P1  | Parziale                      | nuovo               |
| A-06 | Deprecazione dei campi legacy                    | P2  | Pianificata                   | SW.20               |
| B-01 | Opportunity Center e Inbox                       | P0  | Implementata (v1, Inbox)      | SW.13, SW.14        |
| B-02 | Campi professionali estesi                       | P1  | Parziale (v1)                 | SW.7; nuovo         |
| B-03 | Ricerca e filtri dell'Opportunity Center         | P0  | Parziale                      | SW.3                |
| B-04 | Wizard progressivo                               | P1  | Implementata (v1.1)           | nuovo               |
| B-05 | Aziende e prevenzione dei duplicati              | P1  | Implementata (v1.1)           | nuovo               |
| B-06 | Import strutturato delle offerte                 | P2  | Proposta (richiede decisione) | backlog             |
| B-07 | Valutazione e confronto delle opportunità        | P1  | Pianificata                   | SW.16; backlog      |
| C-01 | Bacheca canonica del workflow                    | P1  | Implementata (v1.1)           | nuovo               |
| C-02 | Colloqui della candidatura                       | P1  | Parziale (v1)                 | D6, SW.12           |
| C-03 | Timeline della candidatura                       | P1  | Parziale                      | SW.12               |
| C-04 | Follow-up e scadenze della candidatura           | P1  | Parziale                      | nuovo               |
| C-05 | Contatti e comunicazioni                         | P2  | Proposta                      | nuovo               |
| C-06 | Notifiche e promemoria                           | P2  | Fuori roadmap                 | backlog             |
| C-07 | Allegati come file e snapshot d'invio            | P2  | Proposta (richiede decisione) | D13                 |
| C-08 | Offerte ricevute                                 | P2  | Proposta                      | backlog             |
| C-09 | Workflow configurabili                           | P3  | Proposta                      | nuovo               |
| D-01 | Bacheche personalizzate indipendenti dallo stato | P1  | Parziale (v1)                 | SW.13, SW.15        |
| D-02 | Selettore di layout e toolbar                    | P1  | Pianificata                   | SW.2                |
| D-03 | Motore di query condiviso                        | P0  | Implementata (v1)             | SW.3                |
| D-04 | Viste salvate                                    | P1  | Implementata (v1.1, tabella)  | SW.8                |
| D-05 | Timeline globale                                 | P1  | Pianificata                   | SW.5                |
| D-06 | Calendario                                       | P2  | Implementata (v1)             | nuovo               |
| D-07 | Mappa geografica                                 | P2  | Pianificata                   | SW.17               |
| D-08 | Preferenze utente lato server                    | P2  | Proposta                      | nuovo               |
| D-09 | Smart Boards e raggruppamenti virtuali           | P1  | Pianificata                   | SW.4, SW.9          |
| D-10 | Dashboard personalizzabili                       | P2  | Pianificata                   | SW.19               |
| E-01 | Specifica delle metriche e Insights di base      | P0  | Implementata (v1)             | M4-C1, SW.0c, SW.18 |
| E-02 | Funnel e indicatori temporali                    | P1  | Parziale (v1)                 | M4-C1, SW.18        |
| E-03 | Confronti retributivi e geografici               | P2  | Proposta                      | backlog, SW.17      |
| E-04 | Suggerimenti contestuali deterministici          | P2  | Parziale                      | M3 (S1–S3)          |
| F-01 | API pubblica documentata                         | P3  | Proposta (richiede decisione) | nuovo               |
| F-02 | Token, permessi e audit per integrazioni         | P3  | Proposta (richiede decisione) | nuovo               |
| F-03 | Server MCP per assistenti AI                     | P3  | Fuori roadmap                 | nuovo               |
| F-04 | Automazioni basate su eventi                     | P3  | Fuori roadmap                 | backlog             |
| F-05 | Calendario esterno (export/sync)                 | P3  | Fuori roadmap                 | backlog             |
| F-06 | Import da email e servizi esterni                | P3  | Fuori roadmap                 | backlog             |
| G-01 | Membership e ruoli attivi                        | P3  | Parziale (schema)             | M5                  |
| G-02 | Accompagnamento consensuale                      | P3  | Proposta (richiede decisione) | nuovo               |
| G-03 | Workspace di coorte                              | P3  | Proposta (richiede decisione) | nuovo               |
| H-01 | Accessibilità verificata                         | P1  | Parziale                      | M4-C3               |
| H-02 | Rate limiting e limiti d'uso                     | P1  | Proposta                      | M5                  |
| H-03 | Cloudflare Access reale                          | P0  | Pianificata                   | M4-C4               |
| H-04 | Staging e deploy privato                         | P0  | Fuori ciclo (ADR-0017)        | M4.1-A, M4-C4       |
| H-05 | Esportazione, backup, cancellazione              | P0  | Parziale (v1: export)         | M4-C2, M5           |
| H-06 | Osservabilità e strategia di rilascio            | P1  | Parziale                      | M4-C3, M4-C5        |
| H-07 | Multiutenza pubblica e autenticazione            | P2  | Pianificata                   | M5                  |
| H-08 | Costi e prestazioni                              | P1  | Proposta                      | M5                  |

---

## Stream A — Core Domain

### A-01 Separazione Opportunity / Application

- **Priorità** P0 · **Stato** Ramo locale: migrazioni `0008`–`0011` committate in locale su `feat/m5-sw1-smart-kanban`, mai pushate né applicate a DB reali · **Aggancio** SW.10–SW.13, decisioni D4, D5, D13.
- **Obiettivo:** un'opportunità esiste senza candidatura e senza bacheca; può avere più candidature nel tempo.
- **Problema risolto:** oggi scheda = opportunità = candidatura; non si salva un'offerta senza bacheca né ci si ricandida conservando lo storico ([GAP-ANALYSIS](../status/GAP-ANALYSIS.md)).
- **Comportamento atteso:** creare un'opportunità con il solo titolo; «Candidati» crea una candidatura con snapshot; candidatura «corrente» deterministica con flag di ambiguità (D4).
- **UX:** Inbox come vista di sistema; nella scheda, elenco delle candidature dell'opportunità.
- **Dati:** `cards` con posizionamento facoltativo, `applications` (sequenza, snapshot, origine), backfill marcato.
- **Dipendenze:** SW.6 (piano approvato), SW.0b (stato reale di staging/D1), D-03.
- **Impatto tecnico:** ricostruzione di tabelle su D1 senza transazioni interattive; cambio di semantica di `DELETE /boards/:id`; API nuove.
- **Accettazione:** nessuna perdita di dati legacy; ogni candidatura ricostruita marcata `backfill`; eliminare una bacheca non elimina opportunità.
- **Test:** upgrade su DB popolati sintetici, test di tenancy sulle nuove tabelle, E2E opportunità senza bacheca, prova a secco su copia autorizzata.
- **Rischi:** migrazione irreversibile su dati reali; branch lungo difficile da revisionare.
- **Specifiche:** ADR-0016 e roadmap SW (ramo); [PRODUCT-VISION §2](../product/PRODUCT-VISION.md#2-entità-del-dominio).

### A-02 Politica unica delle transizioni

- **Priorità** P0 · **Stato** Parziale: grafo puro e `POST /cards/:id/pipeline` implementati; `PATCH /cards/:id` accetta ancora `stage`/`outcome` senza grafo · **Aggancio** SW.12; intervento nuovo.
- **Obiettivo:** ogni cambio di stato passa da un'unica politica validata e idempotente.
- **Problema risolto:** due percorsi di scrittura dello stato (uno senza validazione né `dedupe_key`) rendono lo storico meno affidabile.
- **Comportamento atteso:** il percorso legacy è deprecato e poi rimosso, o reindirizzato alla politica; gli stati della candidatura sono definiti una volta.
- **UX:** nessun cambiamento visibile (la UI usa già la pipeline).
- **Dati:** `application_details.stage/outcome` oggi; `applications` dopo A-01.
- **Dipendenze:** decisione sul contratto API; coordinamento con A-01.
- **Impatto tecnico:** modifica di contratto (`updateCardInput`), test esistenti da adeguare.
- **Accettazione:** nessuna scrittura di stato fuori dalla politica; test che lo dimostra.
- **Test:** API (rifiuto o deprecazione dei campi), regressione della pipeline.
- **Rischi:** client esterni inesistenti oggi → rischio basso, ma è comunque una rottura di contratto.
- **Specifiche:** [BACKEND](../architecture/BACKEND.md#logica-di-dominio-rilevante), [WORKFLOWS](../features/WORKFLOWS.md).

### A-03 Storico eventi della candidatura

- **Priorità** P0 · **Stato** Ramo locale (`0010`: `application_id` facoltativo, tipi dormienti) · **Aggancio** SW.10-c, SW.12.
- **Obiettivo:** eventi immutabili collegati alla candidatura, con origine dichiarata.
- **Problema risolto:** gli eventi sono legati alla scheda; le attività non generano eventi; tre tipi ammessi non sono mai emessi.
- **Comportamento atteso:** ogni transizione, invio, colloquio e chiusura produce un evento collegato alla candidatura; origine `user`/`backfill`/`system`.
- **UX:** timeline per candidatura e globale (D-05).
- **Dati:** `activity_events` (+ `application_id`).
- **Dipendenze:** A-01.
- **Impatto tecnico:** ricostruzione di `activity_events` (precedenti `0004`, `0005`).
- **Accettazione:** conteggi e confronto riga per riga prima/dopo; nessun testo riservato nei metadati.
- **Test:** upgrade, idempotenza, whitelist dei metadati.
- **Rischi:** alterazione della cronologia esistente.
- **Specifiche:** [DATA-MODEL](../architecture/DATA-MODEL.md), roadmap SW.

### A-04 Compatibilità legacy e coerenza

- **Priorità** P0 · **Stato** Ramo locale (backfill `0011`, politica `sw10-backfill-policy/1`); SW.11 non avviata e non autorizzata · **Aggancio** SW.10-d, SW.11.
- **Obiettivo:** passare al nuovo dominio senza rompere letture e scritture esistenti.
- **Problema risolto:** i dati attuali sono nel modello «scheda unica».
- **Comportamento atteso:** doppia scrittura in un solo `batch`, controllo di coerenza, switch delle letture solo dopo verifica.
- **UX:** invariata durante la transizione.
- **Dati:** tutte le tabelle del dominio.
- **Dipendenze:** A-01.
- **Impatto tecnico:** alto; percorso critico SW.10 → SW.11 → SW.12.
- **Accettazione:** controllo di coerenza verde in CI; nessuna divergenza su dati sintetici e su copia autorizzata.
- **Test:** coerenza, upgrade, E2E completi.
- **Rischi:** doppia scrittura incoerente; costo di letture D1.
- **Specifiche:** roadmap SW e report SW.10-d (ramo).

### A-05 Auditabilità delle modifiche

- **Priorità** P1 · **Stato** Parziale (eventi con `operation_id` e impronta per pipeline e colloqui) · **Aggancio** nuovo.
- **Obiettivo:** sapere chi o che cosa ha cambiato un dato importante e da dove (UI, import, integrazione).
- **Problema risolto:** prerequisito di automazioni e integrazioni (Stream F) e dell'uso collaborativo (G).
- **Comportamento atteso:** origine registrata per le modifiche di stato; modifiche automatiche sempre tracciate.
- **UX:** indicazione dell'origine nella timeline.
- **Dati:** `activity_events` (origine), eventuale registro delle operazioni esterne.
- **Dipendenze:** A-03.
- **Impatto tecnico:** medio.
- **Accettazione:** ogni modifica non manuale è distinguibile.
- **Test:** API e timeline.
- **Rischi:** crescita dei dati; metadati sensibili.
- **Specifiche:** [SECURITY](../architecture/SECURITY.md#requisiti-per-estensioni-future).

### A-06 Deprecazione dei campi legacy

- **Priorità** P2 · **Stato** Pianificata · **Aggancio** SW.20.
- **Obiettivo:** rimuovere colonne e percorsi obsoleti dopo uno switch stabile (`tasks.due_at`, fase/esito sulla scheda, alias di contratto).
- **Problema risolto:** debito tecnico e ambiguità.
- **Comportamento atteso / UX:** nessun cambiamento visibile.
- **Dati:** `application_details`, `tasks.due_at`, `users.display_name` (da decidere).
- **Dipendenze:** A-04 stabile.
- **Impatto tecnico:** migrazione dedicata.
- **Accettazione / Test:** upgrade, nessun riferimento residuo (`grep` + typecheck).
- **Rischi:** rimozione prematura.
- **Specifiche:** roadmap SW.

## Stream B — Opportunity Management

### B-01 Opportunity Center e Inbox

- **Priorità** P0 · **Stato** Pianificata (oggi esiste la Tabella trasversale `/opportunities`) · **Aggancio** SW.13, SW.14, D5.
- **Obiettivo:** una sezione per raccogliere e valutare opportunità prima della candidatura.
- **Problema risolto:** Opportunity-first non è possibile finché la scheda richiede una bacheca.
- **Comportamento atteso:** Inbox (vista di sistema) delle opportunità senza candidatura; azione «Candidati».
- **UX:** evoluzione di `/opportunities`, senza riprogettare l'identità grafica.
- **Dati:** opportunità (A-01).
- **Dipendenze:** A-01, D-03.
- **Impatto tecnico:** API e UI nuove; cambio di eliminazione della bacheca.
- **Accettazione:** salvare, ritrovare e candidarsi senza mai creare una bacheca.
- **Test:** E2E del percorso J-01 passi 2–6.
- **Rischi:** doppia navigazione confusa durante la transizione.
- **Specifiche:** [OPPORTUNITIES](../features/OPPORTUNITIES.md), [PRODUCT-VISION §3](../product/PRODUCT-VISION.md#3-opportunity-center).

### B-02 Campi professionali estesi

- **Priorità** P1 · **Stato** Parziale (azienda, posizione, sede, modalità, contratto, RAL, fonte, URL, date esistono) · **Aggancio** SW.7 (ruolo/ambito, D8); resto nuovo.
- **Obiettivo:** aggiungere ruolo normalizzato e ambito, settore, benefit, requisiti, seniority, data di scadenza.
- **Problema risolto:** confronto e filtri limitati.
- **Comportamento atteso:** tutti facoltativi; titolo originale conservato; normalizzazione deterministica senza classificazione automatica.
- **UX:** sezioni progressive del wizard (B-04).
- **Dati:** colonne additive o tabella dedicata.
- **Dipendenze:** A-01 (su quale entità vivono), SW.6.
- **Impatto tecnico:** migrazione additiva.
- **Accettazione:** filtri e ordinamenti sui nuovi campi; «non specificato» filtrabile.
- **Test:** schemi, API, filtri, upgrade.
- **Rischi:** campi troppo specifici di un settore (usare i campi personalizzati).
- **Specifiche:** [OPPORTUNITIES](../features/OPPORTUNITIES.md).

### B-03 Ricerca e filtri dell'Opportunity Center

- **Priorità** P0 · **Stato** Parziale (filtri SQL dedicati in `main`; motore v2 nel ramo) · **Aggancio** SW.3.
- **Obiettivo:** filtri combinabili e ordinamenti identici in ogni vista.
- **Problema risolto:** filtri non condivisi tra viste; campi personalizzati non filtrabili.
- **Comportamento atteso:** stesso filtro in Tabella, Kanban, Insights.
- **UX:** pannello filtri esistente esteso.
- **Dati:** nessuno nuovo.
- **Dipendenze:** D-03.
- **Impatto tecnico:** sostituzione del compilatore SQL di `/opportunities`.
- **Accettazione:** test di conformità TS/SQL verdi.
- **Test:** fixture comuni, API, E2E di ricerca.
- **Rischi:** divergenza dei valutatori.
- **Specifiche:** `smart-query-engine.md` (ramo).

### B-04 Wizard progressivo

- **Priorità** P1 · **Stato** Proposta (oggi creazione rapida per titolo + modale a schede) · **Aggancio** nuovo.
- **Obiettivo:** inserimento in pochi secondi, arricchimento guidato per fasi.
- **Problema risolto:** la modale espone tutti i campi insieme.
- **Comportamento atteso:** fasi Creazione → Arricchimento → Valutazione → Candidatura → Selezione; salvataggio parziale.
- **UX:** [PRODUCT-VISION §5](../product/PRODUCT-VISION.md#5-progressive-wizard).
- **Dati:** nessuno nuovo (usa B-02).
- **Dipendenze:** B-02, A-01 (per la fase Candidatura).
- **Impatto tecnico:** solo frontend.
- **Accettazione:** creazione con il solo titolo; ogni sezione salvabile da sola.
- **Test:** componenti, E2E, axe.
- **Rischi:** duplicare la modale esistente invece di evolverla.
- **Specifiche:** [OPPORTUNITIES](../features/OPPORTUNITIES.md).

### B-05 Aziende e prevenzione dei duplicati

- **Priorità** P1 · **Stato** Proposta (azienda = testo libero) · **Aggancio** nuovo.
- **Obiettivo:** riutilizzare l'azienda tra opportunità; avvisare dei possibili duplicati.
- **Problema risolto:** ricandidature e aziende ripetute non sono collegate.
- **Comportamento atteso:** entità facoltativa creata su conferma; chiave di normalizzazione; fusione solo esplicita.
- **UX:** suggerimento non bloccante alla creazione.
- **Dati:** nuova tabella + riferimento facoltativo dall'opportunità.
- **Dipendenze:** A-01.
- **Impatto tecnico:** migrazione additiva, backfill facoltativo e marcato.
- **Accettazione:** nessuna fusione automatica.
- **Test:** normalizzazione (Unicode), tenancy, API.
- **Rischi:** falsi positivi.
- **Specifiche:** [OPPORTUNITIES](../features/OPPORTUNITIES.md).

### B-06 Import strutturato delle offerte

- **Priorità** P2 · **Stato** Proposta — **richiede decisione** («acquisizione assistita» è candidata nel [backlog](backlog.md), non approvata) · **Aggancio** backlog.
- **Obiettivo:** creare un'opportunità incollando URL o testo, con anteprima e conferma.
- **Problema risolto:** inserimento manuale lento.
- **Comportamento atteso:** estrazione deterministica di dati strutturati pubblici (es. metadati di annunci) dove disponibili; mai scraping, mai credenziali di terzi, mai accesso presunto ad API di piattaforme.
- **UX:** campo «Incolla link» nella creazione.
- **Dati:** opportunità + fonte.
- **Dipendenze:** B-02, B-05, A-05.
- **Impatto tecnico:** richieste in uscita dal Worker (privacy, costi, abusi).
- **Accettazione:** nessun dato salvato senza conferma.
- **Test:** fixture statiche, nessuna rete nei test.
- **Rischi:** termini d'uso delle piattaforme; fragilità.
- **Specifiche:** [INTEGRATIONS](../features/INTEGRATIONS.md).

### B-07 Valutazione e confronto delle opportunità

- **Priorità** P1 · **Stato** Pianificata (Matrice SW.16); valutazione personale proposta; «confronto economico» candidato nel backlog · **Aggancio** SW.16.
- **Obiettivo:** confrontare 2–5 opportunità su criteri scelti; valutazione personale con criteri dichiarati.
- **Problema risolto:** decisioni prese a memoria.
- **Comportamento atteso:** matrice affiancata; nessun punteggio automatico opaco.
- **UX:** vista Matrice.
- **Dati:** campi esistenti + valutazione personale.
- **Dipendenze:** D-03.
- **Impatto tecnico:** medio, soprattutto frontend.
- **Accettazione:** dati mancanti visibili; valute diverse non convertite in silenzio.
- **Test:** componenti, E2E, axe.
- **Rischi:** scivolare verso scoring AI (vietato senza decisione).
- **Specifiche:** [SMART-VIEWS](../features/SMART-VIEWS.md).

## Stream C — Application Workflow

### C-01 Bacheca canonica del workflow

- **Priorità** P1 · **Stato** Proposta (oggi le colonne hanno solo una `category` suggerita) · **Aggancio** nuovo (coerente con D10, D11).
- **Obiettivo:** una bacheca le cui colonne sono gli stati canonici; spostare = transizione esplicita.
- **Problema risolto:** l'utente oggi deve aprire la scheda per cambiare stato dopo uno spostamento.
- **Comportamento atteso:** il trascinamento invoca la pipeline (con conferma se non è un avanzamento); le bacheche personalizzate restano libere.
- **UX:** distinzione visiva tra bacheca canonica e personalizzate.
- **Dati:** nessuno nuovo (vista derivata dallo stato).
- **Dipendenze:** A-02, D-03.
- **Impatto tecnico:** medio.
- **Accettazione:** lo stato cambia solo per transizioni validate; nelle bacheche personalizzate mai.
- **Test:** E2E trascinamento con conferma e annullamento; pipeline.
- **Rischi:** confusione tra le due tipologie.
- **Specifiche:** [BOARDS](../features/BOARDS.md).

### C-02 Colloqui della candidatura

- **Priorità** P1 · **Stato** Pianificata (colloqui implementati per scheda) · **Aggancio** D6, SW.12.
- **Obiettivo:** i colloqui appartengono alla candidatura, numerati per candidatura.
- **Problema risolto:** con più candidature per opportunità i round si mescolerebbero.
- **Comportamento atteso / UX:** invariato per l'utente, con candidatura esplicita.
- **Dati:** `interviews.application_id` (NO ACTION, decisione D3 di SW.10-b).
- **Dipendenze:** A-01, A-04.
- **Impatto tecnico:** migrazione e API.
- **Accettazione / Test:** upgrade, idempotenza, E2E colloqui.
- **Rischi:** riassegnazione dei round legacy.
- **Specifiche:** [ADR-0012](../architecture/decisions/0012-interview-tracking-and-workspace-modal.md), roadmap SW.

### C-03 Timeline della candidatura

- **Priorità** P1 · **Stato** Parziale (timeline per scheda) · **Aggancio** SW.12.
- **Obiettivo:** storia completa per candidatura, con dati ricostruiti marcati.
- **Problema risolto:** con più candidature la timeline della scheda diventa ambigua.
- **Comportamento atteso:** filtro per candidatura; voci `backfill` visibili come tali.
- **UX:** scheda Timeline esistente.
- **Dati:** A-03.
- **Dipendenze:** A-03.
- **Impatto tecnico:** API timeline.
- **Accettazione / Test:** cursore stabile, nessun testo riservato.
- **Rischi:** prestazioni su storie lunghe.
- **Specifiche:** [APPLICATIONS](../features/APPLICATIONS.md).

### C-04 Follow-up e scadenze della candidatura

- **Priorità** P1 · **Stato** Parziale (attività per scheda o workspace) · **Aggancio** nuovo.
- **Obiettivo:** follow-up collegati alla candidatura e suggeriti dai suoi eventi.
- **Problema risolto:** con più candidature serve sapere a quale si riferisce un follow-up.
- **Comportamento atteso:** collegamento facoltativo alla candidatura; suggerimenti deterministici esistenti estesi.
- **UX:** sezione Attività della scheda.
- **Dati:** `tasks` + riferimento facoltativo.
- **Dipendenze:** A-01.
- **Impatto tecnico:** migrazione additiva.
- **Accettazione / Test:** nessuna creazione automatica; test delle regole.
- **Rischi:** —
- **Specifiche:** [WORKFLOWS](../features/WORKFLOWS.md).

### C-05 Contatti e comunicazioni

- **Priorità** P2 · **Stato** Proposta · **Aggancio** nuovo (tipo di evento `contact_logged` già ammesso e dormiente).
- **Obiettivo:** persone di riferimento e registro manuale dei contatti.
- **Problema risolto:** «a chi ho scritto e quando» oggi vive nelle note.
- **Comportamento atteso:** contatto facoltativo collegabile ad azienda, opportunità, candidatura, colloquio; registrazione manuale di email/telefonate.
- **UX:** sezione Contatti nella scheda; elenco contatti.
- **Dati:** nuova tabella + collegamenti; dati personali di terzi.
- **Dipendenze:** B-05, A-03.
- **Impatto tecnico:** migrazione additiva, privacy (esportazione e cancellazione).
- **Accettazione:** minimo indispensabile; esportabile e cancellabile.
- **Test:** tenancy, API, E2E.
- **Rischi:** GDPR per dati di terzi.
- **Specifiche:** [APPLICATIONS](../features/APPLICATIONS.md).

### C-06 Notifiche e promemoria

- **Priorità** P2 · **Stato** **Fuori roadmap** (scope policy: notifiche e scheduler non pianificati) · **Aggancio** backlog.
- **Obiettivo:** avvisare di scadenze e colloqui secondo regole attivate dall'utente.
- **Problema risolto:** follow-up dimenticati.
- **Comportamento atteso:** prima in-app (centro notifiche), poi canali esterni; sempre disattivabili.
- **UX:** centro notifiche, preferenze.
- **Dati:** regole, notifiche, preferenze (D-08).
- **Dipendenze:** D-08, A-05; per i canali esterni H-07 e F-02.
- **Impatto tecnico:** scheduler (Cron Trigger), invio email (servizio esterno, costi).
- **Accettazione:** nessuna notifica senza regola esplicita.
- **Test:** regole deterministiche con orologio controllato.
- **Rischi:** costi, spam, privacy.
- **Specifiche:** [WORKFLOWS](../features/WORKFLOWS.md).

### C-07 Allegati come file e snapshot d'invio

- **Priorità** P2 · **Stato** Proposta — **richiede decisione** (storage R2 non installato; costi e privacy) · **Aggancio** D13 (snapshot dei dati, non dei file).
- **Obiettivo:** conservare la versione inviata di CV e lettera.
- **Problema risolto:** i documenti sono solo link che possono cambiare.
- **Comportamento atteso:** riferimenti (come oggi) + file facoltativi; snapshot all'invio.
- **UX:** scheda Documenti.
- **Dati:** storage oggetti + metadati.
- **Dipendenze:** A-01, H-05 (export/backup dei file).
- **Impatto tecnico:** nuovo binding, CSP, limiti di dimensione.
- **Accettazione:** file isolati per workspace; inclusi nell'export.
- **Test:** upload, accesso negato fra workspace.
- **Rischi:** costi, malware, dati sensibili.
- **Specifiche:** [APPLICATIONS](../features/APPLICATIONS.md).

### C-08 Offerte ricevute

- **Priorità** P2 · **Stato** Proposta · **Aggancio** backlog («confronto economico delle offerte»).
- **Obiettivo:** registrare i termini di un'offerta (retribuzione, benefit, scadenza della risposta) e confrontarli.
- **Problema risolto:** lo stato `offer` non conserva i termini.
- **Comportamento atteso:** dati dell'offerta sulla candidatura; confronto con B-07.
- **UX / Dati:** sezione Offerta; campi sulla candidatura.
- **Dipendenze:** A-01, B-07.
- **Impatto tecnico:** migrazione additiva.
- **Accettazione / Test:** valute non convertite in silenzio.
- **Rischi:** —
- **Specifiche:** [APPLICATIONS](../features/APPLICATIONS.md).

### C-09 Workflow configurabili

- **Priorità** P3 · **Stato** Proposta · **Aggancio** nuovo.
- **Obiettivo:** stati personalizzati mappati sugli stati canonici.
- **Problema risolto:** processi di selezione particolari (concorsi pubblici, accademia).
- **Comportamento atteso:** ogni stato personalizzato ha uno stato canonico di riferimento per le statistiche.
- **Dipendenze:** A-02, E-01.
- **Impatto tecnico:** alto (motore di transizioni parametrico).
- **Accettazione / Test:** le metriche restano confrontabili.
- **Rischi:** complessità eccessiva rispetto al valore.
- **Specifiche:** [WORKFLOWS](../features/WORKFLOWS.md).

## Stream D — Smart Workspace

### D-01 Bacheche personalizzate indipendenti dallo stato

- **Priorità** P1 · **Stato** Parziale (bacheche libere esistono, ma sono contenitori obbligatori e 1:N) · **Aggancio** SW.13, SW.15, D5, D9.
- **Obiettivo:** organizzare liberamente senza toccare lo stato; una opportunità in più bacheche.
- **Comportamento atteso:** eliminare una bacheca scollega le opportunità; appartenenza N:M (ultima, D9).
- **UX:** invariata, con la conferma di eliminazione aggiornata.
- **Dati:** posizionamento facoltativo (`0008`, ramo), poi N:M.
- **Dipendenze:** A-01; per N:M anche il rifacimento del trigger dei campi personalizzati.
- **Impatto tecnico:** alto per N:M.
- **Accettazione / Test:** E2E eliminazione bacheca, campi personalizzati con N:M.
- **Rischi:** campi personalizzati per bacheca incompatibili con N:M.
- **Problema risolto / Specifiche:** [BOARDS](../features/BOARDS.md).

### D-02 Selettore di layout e toolbar

- **Priorità** P1 · **Stato** Pianificata · **Aggancio** SW.2 (subordinata a SW.0a/D2 per i file in comune con i rami UI).
- **Obiettivo / Comportamento:** passare tra viste della stessa fonte con un selettore unico.
- **UX:** evoluzione del selettore Kanban/Tabella esistente.
- **Dati:** nessuno. **Dipendenze:** SW.1, SW.0a. **Impatto:** frontend.
- **Accettazione / Test:** stato nell'URL; tastiera; axe.
- **Rischi:** conflitti con `feat/ui-dialogs-motion` e `ui/design-v2`.
- **Problema risolto / Specifiche:** [SMART-VIEWS](../features/SMART-VIEWS.md).

### D-03 Motore di query condiviso

- **Priorità** P0 · **Stato** Ramo locale (SW.1 Smart Filter, SW.3 motore v2 con compilatore SQL) · **Aggancio** SW.3.
- **Obiettivo:** una definizione versionata di filtri, ordinamenti e raggruppamenti valutabile in TS e SQL.
- **Problema risolto:** ogni vista ha oggi i suoi filtri; prerequisito di B-03, D-04, D-09, E-01.
- **Comportamento atteso:** compatibilità con lo schema `v:1`; conformità TS/SQL.
- **UX:** nessuna diretta.
- **Dati:** chiavi persistite per viste salvate.
- **Dipendenze:** SW.1.
- **Impatto tecnico:** medio-alto.
- **Accettazione / Test:** fixture comuni e test di conformità; Unicode.
- **Rischi:** divergenza dei valutatori.
- **Specifiche:** `smart-query-engine.md` (ramo).

### D-04 Viste salvate

- **Priorità** P1 · **Stato** Pianificata · **Aggancio** SW.8.
- **Obiettivo / Comportamento:** salvare e riusare combinazioni di filtri, ordinamento, raggruppamento e layout.
- **UX:** menu delle viste. **Dati:** tabella delle viste (migrazione). **Dipendenze:** D-03, SW.6.
- **Accettazione / Test:** una vista salvata riproduce gli stessi risultati in ogni layout.
- **Rischi:** versioning della definizione.
- **Problema risolto / Specifiche:** [SMART-VIEWS](../features/SMART-VIEWS.md).

### D-05 Timeline globale

- **Priorità** P1 · **Stato** Pianificata · **Aggancio** SW.5.
- **Obiettivo / Comportamento:** cronologia dell'intero percorso, filtrabile.
- **Dati:** A-03. **Dipendenze:** SW.0a; completa dopo A-03.
- **Accettazione / Test:** cursore, nessun testo riservato, dati `backfill` marcati.
- **Rischi:** prestazioni. **Specifiche:** [SMART-VIEWS](../features/SMART-VIEWS.md).

### D-06 Calendario

- **Priorità** P2 · **Stato** Proposta (non presente nella roadmap SW) · **Aggancio** nuovo.
- **Obiettivo / Comportamento:** colloqui, scadenze e follow-up su calendario mensile/settimanale, nel fuso del workspace.
- **Dati:** esistenti (`interviews.scheduled_at`, `tasks.due_on`). **Dipendenze:** D-02.
- **Impatto:** frontend. **Accettazione / Test:** fusi orari, tastiera, mobile.
- **Rischi:** confusione con integrazioni di calendario esterne (F-05, fuori roadmap).
- **Specifiche:** [SMART-VIEWS](../features/SMART-VIEWS.md).

### D-07 Mappa geografica

- **Priorità** P2 · **Stato** In corso (calcolo della distanza in `@jobward/shared`; migrazione e vista da approvare) · **Aggancio** SW.17, D7 (dati incorporati, nessun provider esterno, nessuna coordinata inventata).
- **Obiettivo:** distribuzione e distanza delle opportunità dalle posizioni scelte dall'utente.
- **Decisioni del proprietario (2026-11-22):** la posizione di casa si salva nei dati dell'utente, nella sezione **Profilo**, insieme ad altre posizioni catalogate (per esempio per valutare un trasferimento); ogni identità ha le sue, quindi la demo non vede quelle reali. Nella scheda Opportunità la vista **Mappa** confronta le distanze delle opportunità da queste posizioni, con copertura **almeno europea**. La vista Mappa si sviluppa dopo le ottimizzazioni in corso.
- **Dati:** geografia (migrazione), coordinate confermate dall'utente.
- **Dipendenze:** SW.7, SW.12. **Impatto:** licenze e dimensione del bundle.
- **Accettazione / Test:** opportunità senza posizione sempre conteggiate; nessuna chiamata esterna.
- **Rischi:** licenze dei dati geografici. **Specifiche:** [SMART-VIEWS](../features/SMART-VIEWS.md).

### D-08 Preferenze utente lato server

- **Priorità** P2 · **Stato** Proposta (solo `localStorage`) · **Aggancio** nuovo.
- **Obiettivo:** preferenze che seguono l'utente tra dispositivi (vista predefinita, posizione di riferimento, regole di notifica).
- **Dati:** tabella delle preferenze. **Dipendenze:** nessuna forte.
- **Accettazione / Test:** le preferenze locali restano valide come fallback.
- **Rischi:** sincronizzazione dei conflitti. **Specifiche:** [SMART-VIEWS](../features/SMART-VIEWS.md).

### D-09 Smart Boards e raggruppamenti virtuali

- **Priorità** P1 · **Stato** Pianificata · **Aggancio** SW.4, SW.9, D10, D11.
- **Obiettivo:** bacheche definite da query; raggruppamenti per attributo senza trascinamento che modifica attributi.
- **Dati:** definizione della Smart Board (migrazione). **Dipendenze:** D-03, D-04.
- **Accettazione / Test:** azioni esplicite al posto del trascinamento nei gruppi virtuali.
- **Rischi:** confusione con bacheche manuali. **Specifiche:** [BOARDS](../features/BOARDS.md).

### D-10 Dashboard personalizzabili

- **Priorità** P2 · **Stato** Pianificata · **Aggancio** SW.19.
- **Obiettivo:** composizione di widget di insights e viste.
- **Dati:** definizione delle dashboard (migrazione). **Dipendenze:** D-04, E-01.
- **Accettazione / Test:** ogni widget usa il motore di query e le metriche della specifica unica.
- **Rischi:** complessità. **Specifiche:** [ANALYTICS](../features/ANALYTICS.md).

### Campi integrativi dello Stream D

| Voce | Problema risolto                                                              | UX                                                  | Dati coinvolti                              | Impatto tecnico                                   |
| ---- | ----------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------- | ------------------------------------------------- |
| D-02 | Kanban e Tabella sono raggiungibili in modi diversi per bacheca e trasversale | selettore a icone unico nella toolbar               | nessuno                                     | frontend; file in comune con i rami UI            |
| D-04 | ogni ricerca o filtro utile va ricostruito a mano                             | menu «Viste» con salva, rinomina, elimina           | definizione versionata della query + layout | migrazione additiva, compatibilità delle versioni |
| D-05 | la storia del percorso è frammentata per scheda                               | pagina Timeline filtrabile per periodo e tipo       | eventi, note, attività, colloqui            | API aggregata a cursore                           |
| D-06 | colloqui e scadenze non si vedono nel tempo                                   | calendario mese/settimana/agenda, tastiera e mobile | `interviews.scheduled_at`, `tasks.due_on`   | frontend; fusi orari                              |
| D-07 | la distanza e la distribuzione geografica non sono valutabili                 | mappa con elenco accessibile equivalente            | geografia confermata dall'utente            | migrazione, licenze dei dati, bundle              |
| D-08 | le preferenze si perdono cambiando dispositivo                                | Impostazioni → Preferenze                           | preferenze per utente                       | migrazione additiva, fallback locale              |
| D-09 | le bacheche manuali non si aggiornano da sole                                 | bacheca creata da una vista, con gruppi virtuali    | definizione della Smart Board               | dipende dal motore di query                       |
| D-10 | non esiste una vista d'insieme personalizzabile                               | griglia di widget                                   | definizione della dashboard                 | migrazione; prestazioni delle query aggregate     |

## Stream E — Analytics & Decision Support

### E-01 Specifica delle metriche e Insights di base

- **Priorità** P0 (impegno M4) · **Stato** Pianificata; `/insights` è un segnaposto · **Aggancio** M4-C1, SW.0c (D12), SW.18.
- **Obiettivo:** una sola specifica di metriche (popolazione, formula, denominatore, esclusioni, coorti, finestre) e una prima pagina Insights.
- **Problema risolto:** rischio di due definizioni diverse (M4-C1 e SW.18).
- **Comportamento atteso:** metriche esatte distinte da stime; silenzio ≠ rifiuto; nessuna finestra universale di 14 giorni.
- **UX:** pagina Insights; Overview coerente.
- **Dati:** esistenti; dopo A-01 per candidatura.
- **Dipendenze:** SW.0c; idealmente A-01 (altrimenti metriche per scheda da migrare).
- **Impatto tecnico:** query aggregate indicizzate (costo D1).
- **Accettazione:** ogni numero riconducibile alla formula documentata.
- **Test:** fixture con risultati attesi calcolati a mano.
- **Rischi:** implementare M4-C1 prima di A-01 e doverlo rifare.
- **Specifiche:** [ANALYTICS](../features/ANALYTICS.md), [piano M4](m4-private-release-plan.md#handoff-preciso-a-m4-c1).

### E-02 Funnel e indicatori temporali

- **Priorità** P1 · **Stato** Pianificata · **Aggancio** M4-C1, SW.18.
- **Obiettivo / Comportamento:** conversione tra fasi per coorte, tempi di risposta, evoluzione nel tempo nel fuso del workspace.
- **Dati:** eventi (A-03). **Dipendenze:** E-01, A-03.
- **Accettazione / Test:** coorti e finestre esplicite; casi esclusi conteggiati.
- **Rischi:** dati legacy incompleti. **Problema risolto / Specifiche:** [ANALYTICS](../features/ANALYTICS.md).

### E-03 Confronti retributivi e geografici

- **Priorità** P2 · **Stato** Proposta · **Aggancio** backlog, SW.17.
- **Obiettivo / Comportamento:** distribuzione delle RAL per valuta e periodicità, senza conversioni silenziose; distribuzione geografica.
- **Dipendenze:** B-02, D-07. **Accettazione / Test:** valute separate; dati mancanti dichiarati.
- **Rischi:** interpretazioni errate di lordo/netto. **Specifiche:** [ANALYTICS](../features/ANALYTICS.md).

### E-04 Suggerimenti contestuali deterministici

- **Priorità** P2 · **Stato** Parziale (regole S1–S3 per le attività) · **Aggancio** M3; estensioni nuove.
- **Obiettivo:** evidenziare opportunità e candidature che richiedono attenzione con regole dichiarate (scadenze vicine, nessun aggiornamento da N giorni scelti dall'utente).
- **Comportamento atteso:** mai automatici, mai LLM, sempre spiegati e ignorabili.
- **Dipendenze:** E-01, D-08. **Accettazione / Test:** test delle regole con orologio controllato.
- **Rischi:** scivolare verso scoring AI (vietato senza decisione). **Specifiche:** [ANALYTICS](../features/ANALYTICS.md).

### Campi integrativi dello Stream E

| Voce | Problema risolto                                              | UX                                                     | Dati coinvolti                             | Impatto tecnico                  |
| ---- | ------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------ | -------------------------------- |
| E-02 | non si sa dove il percorso si interrompe né quanto si attende | funnel per coorte, grafici temporali                   | eventi di transizione e date d'invio       | query aggregate indicizzate      |
| E-03 | offerte non confrontabili su RAL e luogo                      | distribuzioni separate per valuta e periodicità, mappa | RAL, valuta, periodicità, base, geografia  | nessuna conversione automatica   |
| E-04 | opportunità rilevanti o trascurate non emergono               | evidenziazioni spiegate e ignorabili                   | scadenze, ultimi aggiornamenti, preferenze | regole pure in `packages/shared` |

## Stream F — Integrations & Automation

Tutto lo Stream F è **P3 e non approvato**. Integrazioni, notifiche e automazioni sono escluse dalla roadmap corrente o solo candidate nel backlog; le funzioni AI sono esplicitamente fuori dalla roadmap ([scope policy](scope-policy.md)). Nessuna piattaforma esterna si presume accessibile via API.

| ID   | Nome                              | Obiettivo e comportamento atteso                                                                                               | Dipendenze       | Rischi principali                                  |
| ---- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------- | -------------------------------------------------- |
| F-01 | API pubblica documentata          | Contratti versionati (OpenAPI generato dagli schemi Zod), accesso per token, stessa tenancy dell'app                           | F-02, A-02, H-02 | Superficie d'attacco; stabilità del contratto      |
| F-02 | Token, permessi e audit           | Token personali con ambiti minimi (lettura/scrittura per risorsa), revoca, registro delle operazioni con origine               | A-05, H-07       | Gestione dei segreti                               |
| F-03 | Server MCP per assistenti AI      | Strumenti di lettura e scrittura autorizzati per ChatGPT/Claude; l'assistente propone, l'utente conferma le scritture di stato | F-01, F-02, A-05 | **Fuori roadmap (AI)**; dati sensibili verso terzi |
| F-04 | Automazioni basate su eventi      | Regole «quando X allora proponi Y»; mai modifiche silenziose dello stato                                                       | A-03, A-05, C-06 | Comportamenti inattesi                             |
| F-05 | Calendario esterno                | Prima export ICS in sola lettura, poi eventuale sincronizzazione controllata                                                   | D-06, F-02       | OAuth, privacy                                     |
| F-06 | Import da email e servizi esterni | Inoltro di email o import da servizi che offrono API documentate, sempre con conferma                                          | B-06, F-02       | Privacy, termini d'uso                             |

Campi comuni alle voci F-01…F-06:

- **Priorità** P3 · **Stato verificato** nessun codice; F-01/F-02 «Proposta (richiede decisione)», F-03…F-06 «Fuori roadmap».
- **Problema risolto:** inserimento manuale ripetitivo; impossibilità di usare i propri dati da altri strumenti (assistenti, calendari) in modo controllato.
- **UX:** pagina «Integrazioni» nelle Impostazioni con elenco dei collegamenti attivi, ambiti concessi, registro delle operazioni e revoca; ogni scrittura proposta da un'integrazione appare come proposta da confermare.
- **Dati coinvolti:** token (solo impronta lato server), ambiti, registro delle operazioni; per F-05 eventi di calendario; per F-06 opportunità importate con fonte.
- **Impatto tecnico:** nuova superficie di autenticazione separata da Cloudflare Access; rate limiting (H-02); versionamento dei contratti; per F-04/F-05 scheduler (Cron Trigger).
- **Criteri di accettazione:** nessuna modifica di stato senza conferma dell'utente; revoca immediata; ogni operazione nel registro con origine; disattivare un'integrazione non altera i dati.
- **Test necessari:** autorizzazione per ambito e per workspace, revoca, idempotenza, limiti di frequenza, fixture statiche senza rete esterna.
- **Specifiche:** [INTEGRATIONS](../features/INTEGRATIONS.md), [SECURITY](../architecture/SECURITY.md#requisiti-per-estensioni-future), [PRODUCT-VISION §10](../product/PRODUCT-VISION.md#10-estensibilità-visione-a-lungo-termine).

Prima di qualsiasi lavoro su una voce serve la decisione del proprietario.

## Stream G — Collaborative Career Workspace

Separato dal prodotto personale e **P3, non approvato**. Esclude per principio recruiter, aziende, ATS e marketplace ([CORE §6](../product/CORE.md#6-non-obiettivi)).

| ID   | Nome                        | Obiettivo e comportamento atteso                                                                                                  | Dipendenze       | Rischi principali                                                |
| ---- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------- |
| G-01 | Membership e ruoli attivi   | Attivare `editor`/`viewer` già previsti dallo schema; inviti; revoca                                                              | H-07             | Escalation di privilegi                                          |
| G-02 | Accompagnamento consensuale | Il candidato condivide in modo granulare e revocabile progressi e candidature con un career advisor o mentor, che lascia feedback | G-01, A-05, F-02 | Privacy; deriva verso funzioni da recruiter                      |
| G-03 | Workspace di coorte         | Academy/bootcamp vedono dati aggregati o condivisi volontariamente dai propri studenti                                            | G-02, E-01       | Pressione sugli utenti; aggregazione che rivela dati individuali |

Campi comuni alle voci G-01…G-03:

- **Priorità** P3 · **Stato verificato** G-01 «Parziale (schema)»: `workspace_members.role` ammette owner/editor/viewer e la guardia di sola lettura per `viewer` esiste (`apps/api/src/middleware/workspace.ts`), ma nessun percorso assegna ruoli diversi da `owner`; G-02/G-03 nessun codice, «Proposta (richiede decisione)».
- **Problema risolto:** chi accompagna un candidato (advisor, mentor, academy) oggi riceve aggiornamenti a voce o via fogli condivisi.
- **UX:** il candidato sceglie che cosa condividere (intero workspace, singole candidature, solo statistiche) e con chi; l'accompagnatore vede uno spazio di sola lettura con commenti; indicatore visibile di ciò che è condiviso.
- **Dati coinvolti:** membership e ruoli, condivisioni granulari, commenti/feedback, aggregati di coorte.
- **Impatto tecnico:** autenticazione multiutente (H-07) prerequisito; autorizzazione per risorsa oltre che per workspace; audit (A-05).
- **Criteri di accettazione:** nessun accesso senza consenso esplicito e revocabile; la revoca è immediata; l'accompagnatore non può modificare stato né dati del candidato; aggregati di coorte senza dati individuali riconoscibili.
- **Test necessari:** isolamento per ruolo e per condivisione, revoca, enumerazione delle rotte protette estesa ai nuovi ruoli.
- **Specifiche:** [PERSONAS](../product/PERSONAS.md#personas-secondarie-evoluzione-futura-non-approvata), [CORE §3](../product/CORE.md#3-per-chi).

## Stream H — Platform & Sustainability

### H-01 Accessibilità verificata

- **Priorità** P1 · **Stato** Parziale (axe in 15/19 spec, tastiera, contrasto calcolato; mancano screen reader reali, Firefox/WebKit) · **Aggancio** M4-C3.
- **Obiettivo / Accettazione:** WCAG 2.2 AA verificata manualmente con screen reader su flussi principali. **Test:** axe, matrice browser.
- **Rischi:** regressioni con le nuove viste. **Specifiche:** [design system](../ux/design-system.md#accessibilità-implementata).

### H-02 Rate limiting e limiti d'uso

- **Priorità** P1 (prerequisito della multiutenza) · **Stato** Proposta (codice `rate_limited` inutilizzato) · **Aggancio** M5.
- **Obiettivo / Comportamento:** limiti per utente e per token; quote di archiviazione. **Dipendenze:** H-07.
- **Accettazione / Test:** 429 con `rate_limited`; test di carico locali. **Rischi:** falsi positivi. **Specifiche:** [SECURITY](../architecture/SECURITY.md).

### H-03 Cloudflare Access reale

- **Priorità** P0 · **Stato** Pianificata (codice implementato e testato; mai configurato) · **Aggancio** M4-C4.
- **Obiettivo / Accettazione:** applicazione Access per un solo utente, verificata con smoke test reale. **Dipendenze:** H-04.
- **Rischi:** esposizione via `workers.dev` (disattivato per configurazione). **Specifiche:** [authentication](../architecture/authentication.md).

### H-04 Staging e deploy privato

- **Priorità** P0 · **Stato** Pianificata, **BLOCKED** dal report M4.1-A (inventario/accesso incompleti, report non tracciato nel worktree principale) · **Aggancio** M4.1-A, M4-C4.
- **Obiettivo:** primo staging privato con D1 dedicato, poi deploy privato.
- **Dipendenze:** inventario Cloudflare completo, approvazioni del proprietario, decisione sull'ordine rispetto ad A-01 (SW.0b, D3).
- **Accettazione / Test:** `staging:preflight` verde, smoke test, piano di rollback provato. **Rischi:** dati reali prima della migrazione di dominio.
- **Specifiche:** [DEPLOYMENT](../development/DEPLOYMENT.md).

### H-05 Esportazione, backup, cancellazione

- **Priorità** P0 (export è impegno M4) · **Stato** Pianificata · **Aggancio** M4-C2 (export), M5 (cancellazione).
- **Obiettivo:** formato documentato di tutti i dati dell'utente; backup verificati; cancellazione completa.
- **Dipendenze:** decidere il formato prima o dopo A-01 (lo schema cambia). **Accettazione / Test:** export → import di prova su DB temporaneo.
- **Rischi:** export legato allo schema legacy. **Specifiche:** [database.md](../architecture/database.md#backup-e-ripristino-progettazione).

### H-06 Osservabilità e strategia di rilascio

- **Priorità** P1 · **Stato** Parziale (log strutturati minimi, `x-request-id`, governance PR/hotfix/release definita) · **Aggancio** M4-C3, M4-C5.
- **Obiettivo:** metriche di errore, registro dei problemi della beta, stati di rilascio verificati. **Test:** CI multi-browser (H-01).
- **Rischi:** log con dati personali. **Specifiche:** [piano M4](m4-private-release-plan.md#governance-di-integrazione-e-rilascio).

### H-07 Multiutenza pubblica e autenticazione

- **Priorità** P2 · **Stato** Pianificata · **Aggancio** M5.
- **Obiettivo:** registrazione pubblica, autenticazione propria o federata, più workspace, quote, GDPR. **Dipendenze:** H-02, H-05, H-08.
- **Rischi:** sicurezza e costi. **Specifiche:** [authentication §Evoluzione verso M5](../architecture/authentication.md#evoluzione-verso-m5-account-pubblici).

### H-08 Costi e prestazioni

- **Priorità** P1 · **Stato** Proposta · **Aggancio** M5.
- **Obiettivo:** misurare letture/scritture D1 per operazione, evitare N+1, indici misurati; limiti del piano da verificare sui valori correnti.
- **Accettazione / Test:** budget per endpoint misurato. **Rischi:** superamento dei limiti gratuiti.

### Campi integrativi dello Stream H

| Voce | Problema risolto                                            | UX                                             | Dati coinvolti                          | Impatto tecnico                                 |
| ---- | ----------------------------------------------------------- | ---------------------------------------------- | --------------------------------------- | ----------------------------------------------- |
| H-01 | accessibilità verificata solo con strumenti automatici      | nessun cambiamento atteso, correzioni puntuali | nessuno                                 | Firefox/WebKit in CI, sessioni manuali          |
| H-02 | un uso abusivo o un errore del client non ha limiti         | messaggio chiaro su 429                        | contatori per utente/token              | storage dei contatori (da scegliere)            |
| H-03 | l'app non è raggiungibile in modo sicuro fuori da localhost | login Cloudflare Access                        | email del proprietario (configurazione) | configurazione Cloudflare, nessun codice nuovo  |
| H-04 | nessun ambiente remoto in cui provare una release           | nessuno                                        | D1 di staging (vuoto o sintetico)       | risorse Cloudflare nuove, procedure di rollback |
| H-05 | i dati non sono portabili né cancellabili                   | Impostazioni → Esporta / Elimina account       | tutti i dati del workspace              | formato versionato; job di cancellazione        |
| H-06 | i problemi in uso reale non sono osservabili                | registro dei problemi della beta               | log senza dati personali                | metriche e allarmi                              |
| H-07 | un solo utente ammesso                                      | registrazione, login, gestione account         | utenti, sessioni, quote                 | autenticazione propria o federata; GDPR         |
| H-08 | costi e limiti D1 non misurati                              | nessuno                                        | nessuno                                 | misure per endpoint, indici, cache              |

---

## Riferimenti Smart Workspace

Con l'integrazione del ramo in `jobward-v1` sono disponibili: [ADR-0016](../architecture/decisions/0016-smart-workspace-domain.md) (D1–D13), [roadmap SW.0a–SW.20](smart-workspace.md), [motore di query](../architecture/smart-query-engine.md) e i report SW.10-d (storici, superati da [ADR-0017](../architecture/decisions/0017-local-v1-baseline.md)).

## Regola di manutenzione

Una voce cambia stato solo con un'evidenza nella [FEATURE-MATRIX](../status/FEATURE-MATRIX.md). Una nuova voce richiede ID nuovo nello stream corretto e il confronto con milestone e roadmap SW. Le priorità si cambiano solo su decisione del proprietario.
