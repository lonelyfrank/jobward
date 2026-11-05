# ADR-0008 — Kanban: ordinamento su D1, caricamento della bacheca, libreria di trascinamento

**Stato:** Accettato · **Data:** 2026-11-05 · **Integra:** ADR-0004, ADR-0007

## Contesto

M1 introduce spostamenti e riordini di bacheche, colonne e schede su D1, che **non offre transazioni interattive**
(non si può leggere, decidere e scrivere nella stessa transazione) ma esegue un `batch()` in modo atomico.
Servono inoltre decisioni sul volume dei dati caricati, sulla libreria di trascinamento e sul significato delle colonne.

## Decisioni

1. **Ordinamento**: posizioni intere con gap (1024) come da ADR-0004, calcolate da funzioni **pure condivise**
   (`packages/shared/src/ordering.ts`) usate sia dal server sia dal client (aggiornamento ottimistico). Si indica sempre
   il **vicino** ("dopo la scheda X"; `null` = in cima), mai un indice: resta corretto anche se la lista è cambiata.
2. **Scrittura**: leggere i vicini → decidere con `placeAfter` → un solo `batch()` che porta nel SQL le condizioni
   ancora necessarie (scheda ancora nella colonna di origine, non archiviata, bacheca coerente). Il ribilanciamento
   è **una sola istruzione** `UPDATE … FROM (SELECT row_number() …)`, non una per riga (limiti D1 su parametri e query).
3. **Ordine canonico** `(position, id)`: totale e deterministico anche con posizioni duplicate, che sono tollerate
   (si risolvono al primo ribilanciamento) invece di essere impedite con un vincolo che renderebbe fragile la concorrenza.
4. **Caricamento**: la bacheca carica **tutte** le schede attive in una richiesta (`GET /boards/:id`). Tetti applicati in
   modo atomico nel SQL dell'`INSERT`: 100 bacheche per workspace, 30 colonne per bacheca, 2000 schede per bacheca
   (archiviate comprese). Nessuna paginazione finché le bacheche restano di poche centinaia di schede.
5. **Libreria**: `@dnd-kit/core` 6.3.1 + `@dnd-kit/sortable` 10.0.0 (API stabile, tastiera e annunci per screen reader
   integrati, peer React ≥ 16.8). **Non** `@dnd-kit/react` 0.5.3: ancora 0.x. Il trascinamento è un miglioramento:
   ogni azione ha l'alternativa da menu.
6. **Eliminazione di colonne**: mai in cascata sulle schede. Colonna con schede (anche archiviate) → 409 con messaggio,
   oppure spostamento esplicito delle schede in un'altra colonna della stessa bacheca nello **stesso** `batch()`.
7. **Semantica**: la **categoria** di una colonna è un'etichetta informativa. Spostare una scheda **non** scrive
   `stage` né `outcome` e non emette `stage_changed` (vedi `docs/m1/board-interactions.md`).
8. **Autorizzazione**: ogni rotta di dominio passa dal middleware `workspaceScope` (`?workspaceId=` → `requireMembership`),
   unico punto di verifica; i servizi non ricevono mai il workspace dal body. Il ruolo `viewer` (predisposto) può solo leggere.

## Alternative scartate

- **Indice implicito (0..n) con rinumerazione** a ogni spostamento: riscrive l'intera colonna.
- **Posizioni frazionarie (REAL)**: perdono precisione (già scartate in ADR-0004).
- **Una `UPDATE` per riga nel ribilanciamento**: supera i limiti di D1 su colonne grandi.
- **`SET position = (sottoquery con rango)`**: la sottoquery rilegge lo stato già modificato e **inverte l'ordine**
  (difetto reale, trovato da test: M1-03). `UPDATE … FROM` calcola prima tutti i ranghi.
- **Vincolo `UNIQUE(column_id, position)`**: trasformerebbe ogni corsa concorrente in un errore e complicherebbe il ribilanciamento.
- **Paginazione per colonna**: complessità non giustificata dal volume atteso.
- **Sottomenu annidato "Sposta in…"**: poco affidabile con puntatore e touch; sostituito da voci piatte (M1-08).

## Conseguenze

- Due spostamenti concorrenti non corrompono mai l'ordine: al peggio l'utente vede la scheda vicino al punto previsto
  o riceve un 409 con un messaggio chiaro (ancora cambiata, scheda già spostata/archiviata).
- La cronologia (`activity_events`) conserva i **nomi** delle colonne al momento dello spostamento.
- Le richieste che modificano dati inviano sempre un corpo JSON (anche `{}`), perché lo richiede la protezione CSRF.
- Una modifica a una scheda non ha token di versione: vale l'ultima scrittura (limite noto, vedi issue register).
