# Smart Views

**Stato:** canonico · **Verificato su:** `jobward-v1` `b34c032` (2026-11-22, PID-01). Obiettivo: [PRODUCT-VISION §7](../product/PRODUCT-VISION.md#7-smart-views).

## Ambito

Rappresentazioni multiple della stessa fonte di dati, motore condiviso di query, viste salvate, preferenze.

## Stato attuale

| Vista               | In `jobward-v1`                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| Kanban              | ✅ per bacheca                                                                                 |
| Tabella             | ✅ per bacheca e trasversale (`/opportunities`), stato nell'URL, elenco a schede su telefono   |
| Timeline            | 🟡 solo per singola scheda                                                                     |
| Calendario          | ✅ mensile (agenda su telefono): colloqui, scadenze delle attività e degli annunci (CAL-01)    |
| Mappa               | ⬜                                                                                             |
| Matrice comparativa | ⬜                                                                                             |
| Dashboard           | 🟡 Overview con contatori e pagina Insights fissa (ANA-02); nessuna dashboard personalizzabile |

- Selettore Kanban/Tabella nella bacheca (`apps/web/src/routes/board.tsx`).
- Filtri implementati in SQL per `GET /opportunities`; il Kanban carica tutte le schede attive della bacheca.
- **Viste salvate** (VIE-01) solo nell'Opportunity Center, al massimo 50; preferenze di dispositivo (colonne visibili, densità, zoom) in `localStorage`.
- Smart Filter e Smart Kanban (SW.1) e motore di query v2 TS/SQL (SW.3) integrati in v1 ([motore di query](../architecture/smart-query-engine.md)).

## Regole vincolanti

- Le viste non possiedono dati ([CORE §4.4](../product/CORE.md#44-data-driven-workspace)).
- Un filtro ha lo stesso significato in ogni vista e negli insights (PP-07).
- Mappa: nessun provider esterno, nessuna coordinata inventata (D7).

## Gap e voci di roadmap

| Gap                                                 | Voce |
| --------------------------------------------------- | ---- |
| Selettore di layout unico                           | D-02 |
| Motore di query condiviso (esteso alle altre viste) | D-03 |
| Timeline globale                                    | D-05 |
| Mappa                                               | D-07 |
| Preferenze lato server                              | D-08 |
| Matrice comparativa                                 | B-07 |

## Dettaglio storico

[ADR-0011](../architecture/decisions/0011-search-and-table-state.md) (stato della tabella; la parte sulla ricerca è superata) · [smart-query-engine](../architecture/smart-query-engine.md).
