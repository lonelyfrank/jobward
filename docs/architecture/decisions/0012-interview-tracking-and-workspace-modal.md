# ADR-0012 — Tracciamento dei colloqui e modale della candidatura

**Stato:** Accettato · **Data:** 2026-11-05 · **Integra:** ADR-0007, ADR-0009

## Contesto

Dopo M2 la scheda ha dati, etichette e campi, ma non un modo strutturato per seguire il percorso di selezione (più colloqui, date, feedback). Il pannello laterale è inoltre stretto per ospitare un riepilogo e più schede.

## Decisioni

1. **Entità dedicata `interviews`**, non campi personalizzati: servono stati, date con fuso, numero d'ordine stabile, esito proprio, cronologia e vincoli di coerenza (CHECK) che un campo generico non può dare.
2. **Stato ≠ esito del round ≠ esito della candidatura.** `status` è organizzativo; `result` esiste solo a colloquio completato (CHECK); l'esito generale della scheda non si tocca mai da qui. Nessun automatismo su colonna, fase, esito, statistiche: l'unico aiuto è un suggerimento di fase che richiede un clic.
3. **Round non eliminabili, annullabili.** `sequence` stabile e mai riusato; uno storico completo, anche per candidature archiviate (scritture bloccate, letture no).
4. **Riepilogo calcolato dal server in una query per bacheca/pagina** con una funzione pura condivisa (`summarizeInterviews`); lo porta la scheda (`interviewSummary`) a Kanban, tabella e pannello. Nessuna query per scheda; nessuna nota nel riepilogo.
5. **«Prossima azione» derivata dai dati**, mai inventata (data trascorsa > feedback mancante > da programmare). «Attività aperte» non si mostra finché non esistono attività creabili (M3).
6. **Cronologia senza testi riservati**: gli eventi contengono id, numero del round, date, esito; non note né feedback.
7. **Migrazione `0004` con ricostruzione controllata di `activity_events`** (nuovi tipi di evento): copia + guardia sui conteggi prima del `DROP`, nessun `PRAGMA`, **trigger di isolamento ricreati**. Scritta a mano perché quella di drizzle-kit non li ricreava.
8. **Modale `workspace` come variante del `Dialog`** (non modifica i dialog piccoli): schermo intero a telefono, `min(1000px, …)`/`90dvh` da `md`. Schede Radix con pannelli montati e nascosti (le bozze non si perdono); scheda attiva nell'indirizzo (`#colloqui`).
9. **Guardia delle modifiche non salvate** con `useBlocker` + registro a ref (nessun re-render) + `beforeunload`.
10. **Card Kanban a due densità** (compatta/informativa), preferenza locale; i dati arrivano già nella risposta della bacheca.
11. **Date**: istante UTC + fuso IANA scelto; conversioni con `Intl` (nessuna libreria di date nuova).

## Alternative scartate

- **Tabella `tasks` per i colloqui**: M3 la userà per attività e scadenze; mescolare i due concetti avrebbe anticipato M3.
- **Campo `next_action` su `application_details`**: un dato in più da tenere allineato; la derivazione dai colloqui è sufficiente e non può essere obsoleta.
- **Eliminazione dei round**: perde lo storico e rende instabile la numerazione.
- **Cambiare la fase alla creazione del primo colloquio**: effetto collaterale che falserebbe le statistiche.
- **Tabs con montaggio condizionale**: perde le bozze del modulo cambiando scheda.

## Conseguenze

Il peso della bacheca cresce di pochi byte per scheda (`interviewSummary`). La migrazione `0004` è la prima che ricostruisce una tabella con dati: per questo è coperta da `db:upgrade-test` con cronologia reale.
