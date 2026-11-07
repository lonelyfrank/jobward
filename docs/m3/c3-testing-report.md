# M3-C3 — Rapporto di verifica

**Data:** 2026-11-07 · **Ambiente:** Linux, Node 22.23.1, pnpm 12.15.0, Chromium Playwright.
**Branch:** `m3-c3-application-workflow-ui`, base `8071759b6d`.

> **Aggiornamento 2026-11-07:** questo documento è lo stato **alla consegna** e non è riscritto. Dopo la consegna C3 è stata pubblicata su `main` (`5a0d056eda`) e la CI remota è risultata **rossa** (test preview, race di sincronizzazione; nessun difetto di prodotto). Esito, causa e correzione: [c3-closure.md](c3-closure.md).

## Stato delle verifiche

**Quality gate locale superato.** Tutti i comandi obbligatori terminati con codice 0.
Ultimo giro E2E: 176 passati, 1 collector visuale opzionale preesistente non eseguito,
0 fallimenti e 0 retry automatici (14,0 minuti). I risultati intermedi non sono conteggiati come gate superato.

| Comando              | Esito finale                                                            |
| -------------------- | ----------------------------------------------------------------------- |
| pnpm typecheck       | Verde                                                                   |
| pnpm lint            | Verde                                                                   |
| pnpm format:check    | Verde                                                                   |
| pnpm check:contrast  | Verde                                                                   |
| pnpm check:config    | Verde                                                                   |
| pnpm check:brand     | Verde                                                                   |
| pnpm test:identity   | Verde                                                                   |
| pnpm db:check        | Verde                                                                   |
| pnpm db:upgrade-test | Verde: M1/M2.5 → 0005, conservazione e rollback                         |
| pnpm test            | Verde: shared 599, schemas 49, web 142, API 389; 1.179 totali           |
| pnpm build           | Verde: Vite + Worker dry-run, nessun deploy                             |
| pnpm test:e2e        | Verde: 176 passati, 1 collector opzionale preesistente; exit 0, 0 retry |
| pnpm test:preview    | Verde: 13/13, compreso C3 sotto CSP reale                               |

## Copertura nuova

- Unit frontend: derivazione/precedenze e azioni disponibili dal dominio, sei hash e alias,
  ID validi generati all'apertura, snapshot payload immutabile, 400/409, ordine/deduplicazione
  timeline e dicitura di riapertura.
- Integrazione frontend: note CRUD inclusa DELETE 204, documenti create/update e URL vietati,
  risposta persa e replay 200, 409 e nuovo ID esplicito, pipeline con warning/keep,
  invalidazioni mirate e isolamento delle cache non coinvolte, cursore timeline e retry di pagina,
  guardia uscita/refresh, bozze fra schede/back/forward, ID del colloquio.
  I test di navigazione attendono la selezione ARIA della scheda, non solo il commit anticipato dell’URL.
- API: paginazione note opt-in, limite reale e dimensione risposta, timestamp uguali, nuovi
  inserimenti/eliminazioni fra pagine, legacy senza cursore, limiti/cursori invalidi, workspace
  altrui/risorsa assente, letture su archiviate.
- E2E reali: creazione opportunità, invio con data, avanzamento e allineamento Kanban/Tabella;
  colloquio futuro, chiusura keep/cancel, riapertura e timeline; note/documenti CRUD e apertura URL.
- Risposta persa dopo commit D1 per tutte le quattro creazioni/transizioni: la rete browser
  perde la risposta solo dopo route.fetch riuscito; si confrontano i due payload, si esige
  replay 200 e si verifica che risorsa/evento non siano duplicati.
- Concorrenza: modifica server tra apertura del dialogo e conferma, 409, aggiornamento
  esplicito, nuova transizione coerente.
- Navigazione: sei schede da Kanban/Tabella, hash diretti e alias legacy, refresh e back/forward.
- Responsive: 320×568, 390×844, 768×1024, 1024×768, 1366×768, 1920×1080; entrambi i temi,
  sei schede, assenza overflow pagina, target mobile, bozze lunghe, dirty guard, axe e reduced motion.

## Diagnostica dei primi giri

- Due selettori RTL intercettavano lo stesso errore due volte (Field + alert): eliminata
  la duplicazione nell'editor, conservando l'annuncio e il testo digitato.
- Miniflare nel sandbox non poteva aprire loopback (EPERM): test API/E2E eseguiti con
  autorizzazione per il runtime locale, senza cambiare configurazioni o toccare dati remoti.
- Un primo giro browser è stato interrotto: una modifica CSS eseguita durante la run
  aveva introdotto sintassi JSX errata. Corretta la sintassi e ripetuta la run dai sorgenti fermi;
  quel giro interrotto non costituisce verifica.
- La nuova cronologia URL ha esposto due navigazioni Radix (focus + mouse-down) per gesto:
  aggiunta guardia sincrona sulla destinazione. Back/forward verificati nel browser.
- Riprodotta una perdita di bozza durante l’archiviazione in volo: il callback svuotava
  il registro prima della chiusura. Rimosso il bypass; la nuova regressione è rossa prima
  della correzione e verde dopo. Anche l’archiviazione passa sempre dal blocker.
- Gli avvisi pre-transizione sui colloqui futuri non devono chiedere una seconda scelta
  dopo il successo: il risultato conferma ora conservazione o annullamento già effettuati.
- Il trigger dell’editor era ancora disabilitato al tentativo di ripristinare il focus:
  ripristino spostato dopo il commit. Test reale per note e documenti.
- Il test di refresh annullato attendeva un evento load inesistente dopo la scelta dell’utente:
  ora esercita location.reload e verifica beforeunload/dismiss senza attesa del caricamento.
- Un avviso presente in due pannelli montati rendeva ambiguo un selettore E2E: selettore
  limitato al pannello attivo. Lo stesso vale per la nota presente sia nell’elenco sia nella Timeline
  della preview. Il test M1 usa il ruolo textbox per distinguere il campo «Note» dalla nuova scheda
  e seleziona Dettagli prima di verificarne la persistenza dopo la riapertura.
  I primi giri E2E interrotti/falliti non sono conteggiati come gate superato.
  Nessun test disabilitato o trasformato in skip. Il collector opzionale preesistente
  `workspace-visual.spec.ts` richiede WORKSPACE_VISUAL_DIR e conserva il proprio opt-in;
  non è una regressione nascosta né un nuovo skip introdotto da C3.

## Chiusura del processo E2E

Una prima esecuzione completa aveva già prodotto 176 passati ma il wrapper della shell
ha restituito 143 dopo il riepilogo. Quel codice non è stato considerato un gate verde.
Ripetuto lo stesso `pnpm test:e2e`, sugli stessi sorgenti e senza retry automatici, con un
supervisore locale separato che registra l'esito: **176 passati ed exit 0**.
Log locale: `/tmp/jobward-c3-e2e-final.log`; codice registrato: `/tmp/jobward-c3-e2e-exit`.
Nessuna modifica ai test o al prodotto per nascondere la terminazione del wrapper.

## Matrice e build

La matrice dedicata e la ripetizione nella suite completa sono passate per tutte le combinazioni:

| Risoluzione | Chiaro | Scuro |
| ----------- | ------ | ----- |
| 320×568     | Verde  | Verde |
| 390×844     | Verde  | Verde |
| 768×1024    | Verde  | Verde |
| 1024×768    | Verde  | Verde |
| 1366×768    | Verde  | Verde |
| 1920×1080   | Verde  | Verde |

Screenshot della Panoramica e dell’editor documentale prodotti dagli E2E nella cartella
ignorata `apps/web/test-results/`: 24 immagini. Ispezionati anche campioni a 320 px chiaro/scuro
e a 1920 px. Non sostituiscono prove con dispositivi reali.
Chunk lazy effettivi della build: Timeline 4,44 kB (gzip 1,95), Note 5,97 kB (2,62),
Documenti 7,11 kB (2,88), oltre ai moduli condivisi. Nessuna nuova dipendenza.

## Locale e GitHub Actions

La run remota [42278691374](https://github.com/lonelyfrank/jobward/actions/runs/42278691374)
è verde sulla **baseline main**, non sulle modifiche C3.
La CI di questo branch non è stata eseguita: push e apertura PR non sono autorizzati.
Le verifiche browser automatiche non equivalgono a prove con tastiera virtuale e screen reader reali.
