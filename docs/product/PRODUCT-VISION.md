# Jobward — Il prodotto finito

**Stato:** canonico (visione) · **Origine:** JW-CORE-01 (2026-11-21) · **Proprietario:** proprietario del prodotto.

Questo documento descrive Jobward **come prodotto ideale e completo**, indipendentemente dallo stato del repository e dalle milestone. Non è una specifica approvata per l'implementazione: le capacità entrano nella roadmap di implementazione solo con una decisione esplicita ([scope policy](../roadmap/scope-policy.md)). Lo stato reale è in [CURRENT-STATE](../status/CURRENT-STATE.md), il confronto in [GAP-ANALYSIS](../status/GAP-ANALYSIS.md), il percorso in [MASTER-FUNCTIONAL-ROADMAP](../roadmap/MASTER-FUNCTIONAL-ROADMAP.md).

Identità e principi: [CORE](CORE.md). Decisioni già prese che questa visione rispetta: [ADR-0009](../architecture/decisions/0009-application-lifecycle-and-statistics.md) (posizione ≠ fase ≠ esito), [ADR-0010](../architecture/decisions/0010-custom-fields-conservative-model.md), [ADR-0012](../architecture/decisions/0012-interview-tracking-and-workspace-modal.md) e, nel ramo non integrato, ADR-0016 «Smart Workspace» (decisioni D1–D13, [riferimento](../roadmap/MASTER-FUNCTIONAL-ROADMAP.md#riferimenti-smart-workspace)).

---

## 1. Esperienza principale

L'utente percorre undici passi; le informazioni restano collegate dall'inizio alla fine.

| #   | Passo                     | Che cosa offre Jobward                                                                                      |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | Scoprire un'opportunità   | Nulla da fare in Jobward: la scoperta avviene altrove. Jobward non aggrega né raschia annunci.              |
| 2   | Importarla o inserirla    | Inserimento rapido (titolo o URL); import strutturato con anteprima e conferma.                             |
| 3   | Salvarla senza candidarsi | L'opportunità finisce nell'**Inbox** (vista di sistema), senza bacheca né candidatura obbligatorie.         |
| 4   | Arricchirla               | Wizard progressivo e scheda dettagliata: azienda, ruolo, sede, RAL, requisiti, fonte, scadenza.             |
| 5   | Valutarla e confrontarla  | Valutazione personale, matrice comparativa, distanza dalla posizione di riferimento.                        |
| 6   | Decidere di candidarsi    | Azione esplicita «Candidati» che crea una **candidatura** collegata all'opportunità.                        |
| 7   | Registrare l'invio        | Data, canale, documenti inviati; snapshot dei dati dell'opportunità al momento dell'invio.                  |
| 8   | Gestire la selezione      | Stati canonici, transizioni validate, storico completo.                                                     |
| 9   | Colloqui e follow-up      | Round di colloquio, attività e follow-up con scadenze, suggerimenti deterministici.                         |
| 10  | Registrare l'esito        | Esito esplicito, distinto dalla fase; offerte ricevute con i loro termini.                                  |
| 11  | Analizzare il percorso    | Funnel, tempi di risposta, conversioni, confronti retributivi e geografici, con dati incompleti dichiarati. |

Percorsi di dettaglio e copertura attuale: [USER-JOURNEYS](USER-JOURNEYS.md).

## 2. Entità del dominio

Modello **concettuale**: non impone tabelle. La tabella finale confronta ogni entità con lo schema reale e indica la modellazione proposta.

### 2.1 Entità e relazioni

```text
User 1:N Workspace (membership con ruolo)
Workspace 1:N Opportunity, Company, Contact, Board, View, Workflow, Preference
Company 1:N Opportunity            Contact N:M Company / Opportunity / Application
Opportunity 1:N Application        (zero, una o più candidature nel tempo)
Application 1:N ApplicationEvent | Interview | Task | Note | Attachment
Application N:1 Workflow           (stati e transizioni ammessi)
Board 1:N Column;  Opportunity N:M Board (posizionamento manuale) — oppure Board = query (Smart Board)
View = (dataset/filtro + presentazione + ordinamento + raggruppamento)
Notification ← regole esplicite su Task, Interview, ApplicationEvent
```

### 2.2 Definizioni, ciclo di vita, proprietà e invarianti

| Entità                | Definizione                                     | Ciclo di vita                                                                            | Invarianti principali                                                                                                                        |
| --------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **User**              | Persona proprietaria dei dati.                  | creato → attivo → (cancellazione account con esportazione preventiva)                    | Email univoca; nessun dato visibile ad altri senza consenso.                                                                                 |
| **Opportunity**       | Offerta o possibilità professionale.            | nuova → in valutazione → (candidata) → archiviata                                        | Esiste senza candidatura e senza bacheca; titolo originale conservato; duplicati segnalati, mai fusi in silenzio.                            |
| **Application**       | Tentativo concreto su un'opportunità.           | in preparazione → inviata → selezione → offerta → chiusa con esito; riapribile           | Appartiene a una sola opportunità; stato cambiato solo da transizioni esplicite; numerazione per opportunità; snapshot all'invio immutabile. |
| **Company**           | Organizzazione riutilizzabile.                  | creata (anche implicitamente dall'opportunità) → arricchita → unita ad altra (esplicito) | Nome normalizzato per la ricerca di duplicati; mai creata da fonti esterne senza conferma.                                                   |
| **Contact**           | Persona di riferimento.                         | creato → collegato → archiviato                                                          | Dato personale di terzi: minimo indispensabile, esportabile, cancellabile.                                                                   |
| **Application Event** | Fatto immutabile del percorso.                  | registrato una volta; mai modificato                                                     | Origine dichiarata (`user`, `system`, `backfill`, `integration`); idempotente; nessun testo riservato nei metadati.                          |
| **Interview**         | Round di selezione di una candidatura.          | da programmare → programmato → svolto / annullato                                        | Appartiene alla candidatura; un round annullato è immutabile; esito solo se svolto.                                                          |
| **Task / Follow-up**  | Azione con scadenza (data di calendario).       | aperta → completata / annullata; riapribile                                              | Mai eliminata (solo annullata); legata a candidatura, opportunità o workspace.                                                               |
| **Board**             | Organizzazione per colonne.                     | creata → usata → eliminata (le opportunità restano)                                      | Eliminare una bacheca **non** elimina opportunità né candidature.                                                                            |
| **View**              | Presentazione configurabile di un dataset.      | creata → salvata → riusata                                                               | Non possiede dati; usa il motore di query condiviso.                                                                                         |
| **Filter**            | Condizione sui dati.                            | definito una volta, riusato in viste e insights                                          | Stessa semantica in TypeScript e SQL (test di conformità).                                                                                   |
| **Workflow**          | Stati e transizioni ammessi.                    | predefinito; personalizzabile entro regole                                               | Gli stati canonici restano mappabili per le statistiche.                                                                                     |
| **Notification**      | Avviso derivato da regole esplicite.            | generata → letta / ignorata                                                              | Mai creata senza regola attivata dall'utente; disattivabile.                                                                                 |
| **Attachment**        | File o riferimento collegato a una candidatura. | aggiunto → incluso nello snapshot d'invio → archiviato                                   | La versione inviata resta consultabile.                                                                                                      |
| **User Preference**   | Impostazione personale.                         | modificata dall'utente                                                                   | Sincronizzata lato server quando conta tra dispositivi; mai dato di dominio.                                                                 |

**Proprietà dei dati:** ogni entità appartiene a un workspace; l'accesso è verificato dal server e dal database (FK composite, [ADR-0007](../architecture/decisions/0007-database-tenant-isolation.md)). In un futuro uso collaborativo la condivisione è esplicita, granulare e revocabile.

### 2.3 Confronto con lo schema reale e modellazione proposta

| Entità            | Oggi in `main` (vedi [DATA-MODEL](../architecture/DATA-MODEL.md)) | Modellazione proposta                                                                                    | Dove è già progettata                   |
| ----------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Opportunity       | `cards` + `application_details` (insieme a Application)           | `cards` evolve in Opportunity con posizionamento facoltativo; dati professionali sull'opportunità        | SW.10-a (`0008`, ramo locale)           |
| Application       | fase/esito in `application_details`                               | tabella `applications` 1:N, snapshot all'invio, `origin` (`user`/`backfill`)                             | SW.10-b/d (`0009`, `0011`, ramo locale) |
| Application Event | `activity_events` legati alla scheda                              | aggiunta di `application_id` (facoltativo) e nuovi tipi                                                  | SW.10-c (`0010`, ramo locale)           |
| Interview         | legati alla scheda                                                | legati alla candidatura, numerazione per candidatura                                                     | D6, SW.12                               |
| Task / Follow-up  | `tasks` (scheda o workspace)                                      | collegabili anche alla candidatura                                                                       | da progettare                           |
| Company           | testo libero                                                      | entità facoltativa, creata su conferma, normalizzazione per duplicati                                    | **nuova proposta** (Stream B)           |
| Contact           | assente (intervistatori in JSON)                                  | entità facoltativa con collegamenti N:M                                                                  | **nuova proposta** (Stream C)           |
| Board             | contenitore obbligatorio                                          | bacheca canonica + personalizzate; N:M con opportunità; Smart Board = query                              | D5, D9, D11, SW.9, SW.13, SW.15         |
| View / Filter     | stato nell'URL, filtri SQL dedicati                               | motore di query unico (TS + SQL), viste salvate                                                          | SW.3 (ramo), SW.8                       |
| Workflow          | fisso nel codice                                                  | resta fisso finché non serve; eventuale personalizzazione con mappatura obbligatoria agli stati canonici | **nuova proposta** (P2)                 |
| Notification      | assente                                                           | regole esplicite, canale in-app prima di email                                                           | **richiede decisione** (scope policy)   |
| Attachment        | riferimenti URL                                                   | riferimenti + file facoltativi (storage dedicato) + snapshot                                             | **richiede decisione** (costi, privacy) |
| User Preference   | `localStorage`                                                    | preferenze lato server per ciò che deve seguire l'utente tra dispositivi                                 | **nuova proposta** (P2)                 |

## 3. Opportunity Center

Sezione dedicata a raccogliere, valutare e confrontare opportunità **prima e indipendentemente** dalla candidatura.

**Dati (tutti facoltativi tranne il titolo):** azienda · ruolo (titolo originale + ruolo normalizzato + ambito, D8) · settore · descrizione · fonte · URL · località · modalità di lavoro · tipologia contrattuale · RAL o intervallo retributivo (valuta, periodicità, lordo/netto o «non specificato») · benefit · requisiti · seniority · data di pubblicazione · data di scadenza · valutazione e preferenze personali (interesse, punteggio personale con criteri dichiarati, pro/contro).

**Capacità:**

- ricerca testuale insensibile agli accenti; filtri combinabili (AND tra gruppi, OR nel gruppo, valore «non specificato» filtrabile);
- ordinamento stabile su qualunque campo;
- confronto affiancato di 2–5 opportunità (matrice comparativa);
- valutazione geografica: distanza dalla posizione scelta dall'utente, calcolata da coordinate inserite o confermate dall'utente — mai inventate (D7);
- viste salvate riutilizzabili;
- azione «Candidati» che crea la candidatura collegata;
- segnalazione dei possibili duplicati (stessa azienda normalizzata + ruolo + URL), con fusione solo esplicita.

**Regole:** nessun campo obbligatorio oltre al titolo; un dato assente è mostrato come assente; le metriche escludono o dichiarano i dati mancanti.

## 4. Application Workspace

Gestione completa di ogni candidatura.

- **Stati canonici (proposta da riconciliare con SW.12):** `in preparazione` → `inviata` → `in selezione` → `colloqui` → `offerta` → `chiusa`. La chiusura richiede un **esito**: assunto, rifiutato dall'azienda, ritirata, nessuna risposta, offerta rifiutata. L'archiviazione è separata dallo stato. Oggi esistono già 10 stati di pipeline derivati con la stessa logica ([DATA-MODEL](../architecture/DATA-MODEL.md#ciclo-di-vita-della-candidatura)).
- **Transizioni:** avanzamento, chiusura, riapertura, correzione; ogni transizione è validata da una funzione pura condivisa, idempotente, con conferma per le azioni non di semplice avanzamento e avvisi di coerenza (es. colloqui futuri ancora programmati).
- **Eventi e storico:** ogni transizione registra un evento immutabile con origine; la timeline unisce eventi, note, attività e colloqui.
- **Colloqui:** round numerati, programmazione con fuso orario, riprogrammazione, esito e feedback, preparazione.
- **Contatti e comunicazioni:** persone collegate alla candidatura; registro dei contatti (email, telefonata, messaggio) inserito dall'utente.
- **Follow-up:** attività con scadenza, suggerite da regole deterministiche e mai create in automatico.
- **Offerte ricevute:** retribuzione, benefit, scadenza della risposta, confronto con altre offerte.
- **Esiti:** espliciti, con data; «nessuna risposta» è una scelta dell'utente, il silenzio non è un rifiuto (D12).

**Requisito fondamentale:** lo **stato della candidatura** è distinto dalla sua **posizione in una bacheca personalizzata**. Spostare una scheda in una bacheca personalizzata non cambia mai lo stato.

## 5. Progressive Wizard

Inserimento rapido all'inizio, arricchimento nelle fasi successive.

| Momento                  | Campi                                                                       | Regole                                                                                      |
| ------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Creazione (≤ 10 secondi) | **Titolo** obbligatorio; facoltativi azienda, URL                           | Salvataggio immediato; nessuna bacheca obbligatoria.                                        |
| Arricchimento            | sede, modalità, contratto, RAL, requisiti, seniority, scadenza, fonte, note | Salvataggio parziale per sezione; validazione per campo (URL, date, valuta ISO, min ≤ max). |
| Valutazione              | interesse, punteggio personale, pro/contro, posizione geografica            | Criteri del punteggio visibili; nessun punteggio automatico opaco.                          |
| Candidatura              | data e canale d'invio, documenti                                            | Crea la candidatura e lo snapshot; conferma esplicita.                                      |
| Selezione                | colloqui, contatti, follow-up, offerta, esito                               | Ogni sezione compare quando diventa pertinente.                                             |

Gestione dei dati mancanti: indicatori discreti di completezza, mai blocchi. Prevenzione dei duplicati: avviso non bloccante alla creazione. Modifica: sempre possibile, con guardia delle modifiche non salvate e controllo di concorrenza.

## 6. Smart Boards

- **Bacheca canonica:** rappresenta il workflow reale delle candidature. Le colonne corrispondono agli stati canonici; spostare una scheda **è** un'azione esplicita di transizione (con conferma quando richiesta) e aggiorna lo stato.
- **Bacheche personalizzate:** organizzazioni libere (colonne, colori, sfondi, campi personalizzati, etichette, densità, zoom) che **non** alterano lo stato canonico; al massimo propongono un cambio di stato come suggerimento non modale (comportamento già presente).
- **Smart Board (dataset):** una bacheca definita da una query anziché da un contenitore manuale (D11); nei raggruppamenti virtuali niente trascinamento che modifica attributi, solo azioni esplicite (D10).

Tutte le personalizzazioni esistenti (template, sfondi, Glass, zoom, densità, preferite) si preservano.

## 7. Smart Views

Viste multiple sulla stessa fonte di dati:

| Vista               | Scopo                                               |
| ------------------- | --------------------------------------------------- |
| Kanban              | Flusso per colonne o per stato                      |
| Tabella             | Confronto denso, ordinamento, colonne configurabili |
| Timeline            | Storia del percorso o della candidatura             |
| Calendario          | Colloqui, scadenze, follow-up                       |
| Mappa geografica    | Distribuzione e distanza delle opportunità          |
| Matrice comparativa | Confronto affiancato su criteri scelti              |
| Dashboard analitica | Insights configurabili                              |

**Motore condiviso:** un'unica definizione di query (filtri, ordinamento, raggruppamento) versionata, valutabile in TypeScript e compilata in SQL, con test di conformità tra le due implementazioni; usata da viste, Smart Boards e insights. Le viste sono configurabili, salvabili e riutilizzabili; non duplicano mai i dati.

## 8. Analytics

| Indicatore                    | Tipo                           | Note                                                                   |
| ----------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| Opportunità salvate           | esatto                         |                                                                        |
| Candidature inviate           | esatto                         | da evento/data d'invio, mai dal nome della colonna                     |
| Candidature attive            | esatto                         |                                                                        |
| Distribuzione degli stati     | esatto                         |                                                                        |
| Tempi di risposta             | esatto su dati completi        | popolazione e casi esclusi dichiarati                                  |
| Conversione tra fasi (funnel) | esatto per coorte              | coorte e finestra di osservazione esplicite; nessuna soglia universale |
| Colloqui ottenuti             | esatto                         |                                                                        |
| Follow-up in scadenza         | esatto                         |                                                                        |
| Distribuzione geografica      | esatto sui dati geolocalizzati | quota di opportunità senza posizione sempre mostrata                   |
| Confronti retributivi         | stima                          | valute e periodicità diverse non convertite in silenzio                |
| Evoluzione temporale          | esatto                         | nel fuso del workspace                                                 |
| Dati ricostruiti (`backfill`) | marcati                        | mai presentati come certi                                              |

Ogni metrica ha formula, popolazione, denominatore ed esclusioni documentati (specifica unica condivisa tra M4-C1 e SW.0c).

## 9. UX e interfaccia

Moderna, ordinata, reattiva, accessibile (WCAG 2.2 AA), responsive, usabile da telefono, personalizzabile senza eccessiva complessità. L'identità grafica esistente (palette indaco, [ADR-0015](../architecture/decisions/0015-ui-restyle-indaco.md); superfici Glass Subtle sul Kanban, [kanban-glass](../ux/kanban-glass.md)) **non** si riprogetta: si estende con il [design system](../ux/design-system.md) e i componenti in `apps/web/src/components/ui/`.

Sezioni e responsabilità del prodotto finito:

| Sezione             | Responsabilità                                           |
| ------------------- | -------------------------------------------------------- |
| Overview            | Che cosa richiede attenzione oggi; avanzamento sintetico |
| Inbox / Opportunità | Raccolta, valutazione, confronto delle opportunità       |
| Candidature         | Ciclo di vita, bacheca canonica, timeline                |
| Bacheche            | Organizzazioni personalizzate e Smart Boards             |
| Attività            | Scadenze, follow-up, preparazione                        |
| Calendario          | Colloqui e scadenze nel tempo                            |
| Insights            | Analisi del percorso                                     |
| Impostazioni        | Preferenze, etichette, campi, esportazione, account      |

Regole di interazione in [PRODUCT-PRINCIPLES](PRODUCT-PRINCIPLES.md).

## 10. Estensibilità (visione a lungo termine)

Le capacità seguenti fanno parte della visione ma **non** della roadmap approvata; sono descritte negli Stream F–G della [roadmap funzionale](../roadmap/MASTER-FUNCTIONAL-ROADMAP.md) e richiedono decisioni esplicite:

- API pubbliche documentate e versionate, con token e permessi granulari;
- import strutturato di offerte (incolla URL/testo, formati aperti), senza scraping né accessi presunti a piattaforme terze;
- collegamento ad assistenti (ChatGPT, Claude) tramite un server MCP con strumenti di lettura e scrittura autorizzati, auditati e revocabili — l'assistente propone, l'utente conferma;
- automazioni basate su eventi con regole esplicite; notifiche; sincronizzazioni controllate (calendario);
- workspace condivisi per accompagnamento professionale (career advisor, academy), con consenso del candidato.
