# M3-C3 — Application Workflow UI & Integration

**Data:** 2026-11-07 · **Branch:** `m3-c3-application-workflow-ui`
**Baseline verificata:** `origin/main` = `8071759b6d2faaf985a129cfd4618dedece65956`.

> **Aggiornamento 2026-11-07:** questo documento è lo stato **alla consegna** e non è riscritto. Dopo la consegna C3 è stata pubblicata su `main` (`5a0d056eda`) e la CI remota è risultata **rossa** (test preview, race di sincronizzazione; nessun difetto di prodotto). Esito, causa e correzione: [c3-closure.md](c3-closure.md).

**Esito:** M3-C3 completato e verificato localmente. Tutti i comandi obbligatori verdi;
1.179 test unitari/integrazione, 176 E2E e 13 preview passati. Il collector visuale opzionale
preesistente resta opt-in. Nessun P0/P1 aperto noto. CI del branch non eseguita, perché non è stato effettuato push.

## Audit iniziale

Fetch eseguito prima delle modifiche. Working tree pulito, checkout iniziale sul branch C2
(`4c1140d`), con albero identico a main. Nessun commit successivo alla baseline richiesta.
[PR #7](https://github.com/lonelyfrank/jobward/pull/7) integrata; nessuna PR aperta.
[Ultima CI di main](https://github.com/lonelyfrank/jobward/actions/runs/42278691374):
completata con successo su `8071759b6d`. Il precedente fallimento di `ab73c1a` è quindi
superato: i report C1/C2 e di stabilizzazione restano documenti storici.

Letti README, piano M3, consegne C1/C2, stabilizzazione CI, roadmap e ADR-0007/0009/0012.
Inventariati contratti schemas/shared, servizi e rotte C2, modale, colloqui, Kanban, Tabella,
workspace e cache. Nessuna nuova dipendenza, migrazione o infrastruttura.

## Architettura e interfaccia

- Sei schede: Panoramica, Colloqui, Timeline, Note, Documenti, Dettagli.
- Hash canonici: percorso senza hash (Panoramica), `#colloqui`, `#timeline`, `#note`,
  `#documenti`, `#dettagli`. `#cronologia` resta alias; `#panoramica` ricade su Panoramica.
  Ogni cambio scheda crea una voce di cronologia; back/forward attraversano le schede.
- Pannelli montati dopo la prima visita e poi conservati. Nuove schede caricate con
  `React.lazy`; query abilitate quando attive. Le bozze sopravvivono al cambio scheda.
- Moduli dedicati `features/pipeline`, `notes`, `documents`, `timeline`; la modale
  mantiene il modulo M2, campi professionali, salvataggio differenziale, etichette e campi custom.
- Stato generale derivato esclusivamente da `derivePipelineStatus(stage, outcome, archivedAt)`,
  condiviso da header, riepilogo, Kanban e Tabella. Fase/esito originali restano leggibili.
- Panoramica: ruolo/azienda, stato, data invio, prossimo colloquio, prossima azione,
  aggiornamento, annuncio, avvisi e accessi a note/documenti/timeline.
- Azioni e destinazioni filtrate da `allowedTransitions` e `evaluatePipelineTransition`.
  Nessun secondo grafo frontend. Dialogo con origine, destinazione, effetti e warning del dominio.
  Le risposte API mostrano anche warning server, replay e numero di colloqui annullati.
  Dopo la conferma gli avvisi descrivono la scelta già effettuata, senza chiedere nuovamente di gestire gli appuntamenti.

### Componenti e moduli

| Nuovo/modificato                                | Responsabilità                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| PipelinePanel / PipelineConfirmation            | Azioni consentite, origine/destinazione, warning, gestione colloqui e retry      |
| PipelineStatusBadge / presentation              | Stato derivato e vocabolario UI comune                                           |
| NotesTab / NoteForm                             | Note CRUD paginate, validazione 10.000 caratteri, bozze e conferme               |
| DocumentsTab / DocumentForm                     | Riferimenti CRUD, URL http(s), PATCH differenziale                               |
| TimelineTab / useTimeline                       | Timeline canonica, cursori, stato vuoto/errore/retry, dedupe senza riordino      |
| useCreationOperation / refreshWorkflow          | Ciclo di vita ID/payload e invalidazioni mirate                                  |
| CardDetailRoute / CardDetailForm / SmartSummary | Sei schede, cronologia URL, riepilogo operativo, guardia e preservazione dati M2 |
| InterviewForm / InterviewsTab / API             | ID client, retry immutabile, preservazione round e coerenza pipeline             |
| CardView / ResultsTable / ResultsList           | Stato generale coerente nelle viste                                              |
| ConfirmDialog / Textarea / apiRequest           | Conferma scorrevole e disabilitabile, ref per focus, DELETE 204                  |

## Percorso legacy e compatibilità

La UI non invia più stage/outcome attraverso `PATCH /cards/:id`: i vecchi selettori attivi
e gli aggiornamenti rapidi sono sostituiti dalla pipeline con conferma e idempotenza.
Il suggerimento dopo uno spostamento apre la gestione della candidatura; quello nei colloqui
preseleziona il passaggio appropriato. Spostare una card non cambia fase/esito.

Il PATCH legacy resta compatibile per altri client, con i test API M2/M2.5 invariati.
I valori storici `preparing` e `offer_declined` sono conservati e leggibili con la loro
etichetta specifica; le nuove transizioni UI scrivono la mappa canonica C1.
Questo evita percorsi concorrenti con conferme e conseguenze diverse. Gli E2E storici
continuano a verificare persistenza, dati economici, statistiche, custom field, etichette,
round, programmazione, feedback e annullamento; usano ora il percorso UI pipeline.

Non si annullano colloqui automaticamente. Il dialogo offre `keep` (default) o `cancel`
quando il dominio segnala appuntamenti futuri. Solo gli appuntamenti programmati con data
futura vengono annullati; round da programmare, passati e feedback restano conservati.

## Contratti, ID e cache

| Operazione | Contratto utilizzato                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Pipeline   | POST /cards/:id/pipeline, corpo esatto C2 con ID stabile, expectedFrom, appliedOn facoltativa e futureInterviews quando applicabile |
| Timeline   | GET /cards/:id/timeline?limit=25&before=; ordine e cursore decisi dal backend                                                       |
| Note       | GET paginato + POST con id/body; PATCH body; DELETE 204                                                                             |
| Documenti  | GET + POST id/title/kind/url/note; PATCH differenziale; DELETE 204                                                                  |
| Colloqui   | POST esistente con id client, incluse fasi successive; operazioni M2.5 conservate                                                   |

Un modulo genera UUID all'apertura. Alla prima richiesta conserva una copia immutabile del
payload. Dopo rete/5xx/risposta invalida i campi sono bloccati e il retry riusa ID e payload:
nessun retry automatico. Un 400 consente correzioni; un 409 richiede aggiornamento esplicito
e una nuova operazione consapevole. L'abbandono di una bozza richiede conferma e segnala
che una risposta persa potrebbe nascondere una creazione riuscita. Nessun contenuto riservato
viene scritto in log o diagnostica frontend.

Le chiavi sono qualificate dal workspace. `refreshWorkflow` riallinea card, bacheca coinvolta,
timeline e risorsa modificata; invalida i riepiloghi esistenti (overview, elenco bacheche,
ricerche/tabella). La pipeline riallinea anche i colloqui. Nessuna invalidazione globale
del client; nessun aggiornamento ottimistico della pipeline.

## C2-03: note paginate

Conservato l'endpoint C2 senza parametri, con la stessa forma `{ notes }`.
Parametri opzionali `limit=1..50` e `before` attivano `{ notes, nextCursor }`;
la UI chiede sempre 25 righe, con LIMIT SQL di 26 per verificare la pagina successiva.

Il caso massimo ASCII passa da circa 5.000.000 caratteri (500 × 10.000) a 250.000
caratteri per risposta UI, oltre al piccolo overhead JSON: riduzione del 95% del testo
iniziale. Nessuna paginazione fittizia. Ordinamento stabile (created_at, id) decrescente,
cursore opaco, filtro workspace e lapidi conservati. Test dedicati verificano parità
di timestamp, inserimenti/eliminazioni fra pagine, limiti, 404 e compatibilità.

## Riservatezza, accessibilità e limiti

Timeline solo dall'endpoint canonico: nessuna ricostruzione da API diverse, dedupe solo
per fonte/ID senza riordinare. `application_reopened` ha etichetta dedicata.
I nomi di colonna e i testi riservati dei colloqui non vengono recuperati dalla cronologia legacy.
Documenti esclusivamente riferimenti: URL http(s) validati anche prima del rendering del link,
apertura con noopener/noreferrer, nessun upload o HTML arbitrario.

Guardia delle bozze estesa a note/documenti e richieste ambigue; refresh protetto da beforeunload,
uscita dalla modale da useBlocker. Archiviazione impedita quando esistono bozze; se una bozza nasce durante la richiesta,
la successiva chiusura passa comunque dal blocker e conserva il testo. Un errore di
ricaricamento in background conserva i moduli già caricati. Dialoghi lunghi scorrono anche
su schermi piccoli; target mobile ≥44 px, temi e reduced motion ereditati dal design system.
Nessuna estensione del Glass Subtle.

Risultati e limiti effettivi: [testing report](c3-testing-report.md).
Problemi residui/readiness: [issue register](c3-issue-register.md).
Nessun push, PR, merge, deploy o D1 remoto.

## Consegna e readiness

Otto commit locali coerenti: paginazione backend; adapter e ID; editor Note/Documenti;
pipeline e timeline; integrazione della modale e colloqui; regressioni frontend e protezione
bozze; E2E/preview; consegna documentale. Working tree consegnato pulito.

**Pronto per revisione M3-C4**, con la verifica remota C3 ancora da eseguire dopo eventuale
autorizzazione al push. I limiti dei dispositivi reali e quelli ereditati da C2 sono espliciti
nel registro. Nessuna funzionalità dei checkpoint successivi è stata avviata.
