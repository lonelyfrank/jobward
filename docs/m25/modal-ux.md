# M2.5 — Modale della candidatura: UX e accessibilità

## Struttura

```
┌ Intestazione (fissa) ─────────────────────────────────────────────────┐
│ Titolo · Azienda · Posizione            [Apri annuncio] [+ Colloquio] [×]│
│ Fase · Esito · Priorità · Colonna · Archiviata                          │
├ Schede ───────────────────────────────────────────────────────────────┤
│ Panoramica │ Colloqui (n) │ Dettagli │ Cronologia                       │
├ Corpo (scorrevole) ───────────────────────────────────────────────────┤
│ …                                                                       │
├ Piè di pagina (persistente) ──────────────────────────────────────────┤
│ Archivia            «Modifiche non salvate»   Annulla modifiche  Salva  │
└────────────────────────────────────────────────────────────────────────┘
```

- **Desktop (≥ `md`)**: centrata, `min(1000px, 100vw − 2rem)`, altezza massima `90dvh` (misurate dagli E2E a 1024 e 1360 px).
- **Telefono**: schermo intero (`h-dvh`), schede scorrevoli in orizzontale, pulsanti ≥ 44 px, «+ Colloquio» resta raggiungibile in intestazione.
- **Variante dedicata `workspace` del `Dialog`**: i dialog piccoli (nuova bacheca, colonna, conferme…) non cambiano. Radix Dialog resta la base: focus trap, `aria-modal`, Esc, nome accessibile (il titolo della finestra è il titolo della scheda).

## Schede

| Scheda                                                                                                                                               | Contenuto                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Panoramica**                                                                                                                                       | **Riepilogo**: fase (+ esito) con aggiornamento rapido, prossimo colloquio, prossima azione, «in breve» (retribuzione, sede, data di candidatura); sotto, i _dati principali_ (titolo, azienda, colonna, priorità, fase, esito, etichette) |
| **Colloqui**                                                                                                                                         | i round in ordine, azioni per round, modulo di creazione/modifica, suggerimento di fase                                                                                                                                                    |
| **Dettagli**                                                                                                                                         | Opportunità, Candidatura, Campi personalizzati (sezioni comprimibili come in M2)                                                                                                                                                           |
| **Cronologia**                                                                                                                                       | eventi con frasi leggibili, date di creazione/aggiornamento                                                                                                                                                                                |
| **Attività** non c'è: non è operativa (M3) e non si mostrano controlli finti. Tutte le schede sono _funzionali_ (azioni vere), nessuna è decorativa. |

Il modulo dei dati (Panoramica + Dettagli) è **un solo form** con un solo «Salva» (invariato da M2: invia solo i campi cambiati); i pannelli restano montati e nascosti (`display:none`) così le bozze non si perdono cambiando scheda. I colloqui hanno moduli propri con le loro azioni (salvataggio per round, stato di caricamento ed errore).

## Navigazione e indirizzo

- La scheda attiva è nell'indirizzo (`…/cards/:id#colloqui|#dettagli|#cronologia`): condivisibile, sopravvive al refresh; cambiare scheda **sostituisce** la voce di cronologia.
- Dalla bacheca, dalla Tabella e da Opportunità si apre la stessa modale sotto la stessa rotta; chiudere riporta alla stessa vista **con la stessa ricerca/filtri** e il **focus sul link di partenza**.
- **Esc**, **X**, clic fuori e **Indietro** chiudono (provato: «indietro» dopo l'apertura chiude la modale).

## Modifiche non salvate

Un registro (ref, senza re-render) raccoglie le bozze: modulo dei dati, modulo di un colloquio, riprogrammazione, feedback. Provare a **uscire** (cambia il percorso) è intercettato da `useBlocker`: compare «Hai modifiche non salvate» con _Torna alla scheda_ (predefinito, la bozza resta) ed _Esci senza salvare_. Cambiare scheda interna non è bloccato. Ricaricare o chiudere il browser passa da `beforeunload`. Dopo l'archiviazione il registro si svuota.

## Aggiornamento rapido della fase

Dal riepilogo (e dal suggerimento in «Colloqui») la fase si aggiorna **subito**, con feedback e stato di caricamento. Per non creare finte modifiche non salvate, i campi del modulo che l'utente **non ha toccato** seguono il valore salvato; quelli in modifica restano com'erano (provato).

## Movimento ridotto

Le animazioni d'ingresso usano le stesse keyframe del resto dell'app, azzerate da `prefers-reduced-motion` (regola globale). Nessun movimento è necessario per usare la modale.

## Accessibilità (WCAG 2.2 AA)

- `tablist`/`tab`/`tabpanel` Radix: frecce, Home/End, `aria-selected`, pannelli collegati; **i pannelli inattivi sono fuori dall'albero di accessibilità** (difetto M25-01 trovato dagli E2E: con `forceMount` Radix non li nascondeva).
- Round come `article` con nome «Round N: titolo»; stato e esito in testo (mai solo colore); date in `<time>`.
- Errori per campo con `aria-invalid`/`aria-describedby` e `role=alert`; conferme con `AlertDialog` (focus iniziale sull'opzione sicura).
- axe: zero violazioni su Panoramica, Colloqui (vuota, con round, con modulo aperto a 390 px, scuro), Dettagli, Cronologia.

## Limiti dichiarati

Nessuna prova con screen reader reali né con Firefox/WebKit; l'elenco dei fusi orari è l'intera lista del browser (lungo ma funzionante con tastiera); i round non si riordinano a mano.
