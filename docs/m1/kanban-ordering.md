# M1 — Ordinamento del Kanban

Implementa ADR-0004 (posizioni con gap) nei limiti di D1 (nessuna transazione interattiva): [ADR-0008](../architecture/decisions/0008-kanban-ordering-and-board-loading.md).
Codice: `packages/shared/src/ordering.ts` (puro) · `apps/api/src/services/ordering.ts` (SQL) · `apps/web/src/features/kanban/board-state.ts` (client).

## Modello

Ogni lista ordinata (bacheche di un workspace, colonne di una bacheca, schede di una colonna) ha posizioni intere distanziate di
`POSITION_GAP = 1024`. Ordine canonico: `(position, id)` — coincide con `ORDER BY position, id` in SQL.
Si indica il **vicino** (`afterId`, `null` = in cima), mai un indice.

## Algoritmo `placeAfter(siblings, afterId)`

`siblings` = la lista di destinazione **senza** l'elemento spostato.

| Caso                                       | Posizione assegnata                      | Ribilanciamento |
| ------------------------------------------ | ---------------------------------------- | --------------- |
| Lista vuota                                | `1024`                                   | no              |
| In cima                                    | `primo − 1024` (può essere negativa: ok) | no              |
| In fondo                                   | `ultimo + 1024`                          | no              |
| Tra `p` e `n`, `n − p ≥ 2`                 | `p + ⌊(n − p) / 2⌋`                      | no              |
| `n − p < 2` (gap esaurito o **duplicati**) | tra i vicini ribilanciati                | **sì**          |
| Ancora non presente                        | `anchor_not_found` → **409**             | —               |

Ribilanciamento: i fratelli ricevono `(i + 1) × 1024` con **una sola istruzione**
`UPDATE t SET position = r.rn * 1024 FROM (SELECT id, row_number() OVER (ORDER BY position, id) AS rn …) r WHERE t.id = r.id`;
l'elemento spostato va a `(indice + 1) × 1024 + 512`.

> **Trappola verificata (M1-03)**: `SET position = (SELECT … rango …)` NON è equivalente. La sottoquery è rivalutata per riga
> sullo stato già modificato e l'ordine si inverte. `UPDATE … FROM` calcola prima tutti i ranghi. Coperto da test sul
> ribilanciamento (colonna da 150 righe) e sull'eliminazione di colonna con spostamento.

## Scrittura su D1

1. **Lettura** dei vicini (fuori transazione).
2. **Decisione** con la funzione pura.
3. **`batch()` atomico**: [ribilanciamento] + `UPDATE` della scheda condizionato (`id`, `workspace_id`, `column_id = colonna letta`,
   `archived_at IS NULL`) + evento condizionato (`WHERE EXISTS` sulla scheda aggiornata) + aggiornamento di `boards.updated_at`.
4. Se l'`UPDATE` non cambia nessuna riga → **409** (scheda spostata/archiviata da altri). Se la colonna di destinazione è
   sparita, la FK composita `cards_column_fk` fa fallire **tutto** il batch → **409**; nulla resta a metà.

Creazione: la posizione ("in fondo") è calcolata **dentro** l'`INSERT … SELECT` (`COALESCE(max(position),0)+1024`), insieme al tetto
di schede per bacheca: nessuna finestra di concorrenza tra lettura e scrittura.

## Casi verificati

| Caso                                                                           | Dove                                                                                 |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Inserimento iniziale, in cima, in mezzo, in fondo                              | `ordering.test.ts`, `kanban-ordering.test.ts`                                        |
| Spostamento tra colonne (anche in colonna vuota)                               | `kanban-ordering.test.ts`, E2E                                                       |
| Riordino nella stessa colonna                                                  | idem                                                                                 |
| Gap esaurito → ribilanciamento                                                 | `kanban-ordering.test.ts` (14 inserimenti ripetuti nello stesso punto; gap 10/11/12) |
| Posizioni duplicate                                                            | `kanban-ordering.test.ts` (500/500/500)                                              |
| Colonna grande (150 righe, oltre i limiti di parametri)                        | `kanban-ordering.test.ts`                                                            |
| Proprietà: 400 mosse casuali ⇒ ordine atteso, posizioni distinte               | `ordering.test.ts`                                                                   |
| Aggiornamenti concorrenti (20 mosse simultanee; stessa scheda verso 2 colonne) | `kanban-ordering.test.ts`                                                            |
| Errore di persistenza / atomicità                                              | `kanban-ordering.test.ts`, E2E (risposta 500 intercettata → rollback)                |
| Ancora altrui, colonna altrui, colonna di un'altra bacheca                     | `kanban-ordering.test.ts`, `kanban-isolation.test.ts`                                |

## Limiti noti

- Due mosse concorrenti possono lasciare **posizioni duplicate** tra schede non coinvolte; l'ordine resta stabile (per `id`) e si risolve al primo ribilanciamento.
- Il client calcola la posizione **senza** conoscere le schede archiviate della colonna; la differenza è ininfluente (il server riallinea alla fine).
- Nessun token di versione: ultima scrittura vince.
