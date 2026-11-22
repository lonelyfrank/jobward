# Bacheche

**Stato:** canonico · **Verificato su:** `jobward-v1` `b34c032` (2026-11-22, PID-01). Obiettivo: [PRODUCT-VISION §6 Smart Boards](../product/PRODUCT-VISION.md#6-smart-boards).

## Ambito

Bacheche, colonne, Kanban, personalizzazione visiva; in futuro bacheca canonica, bacheche personalizzate e Smart Boards.

## Stato attuale

- **Bacheche** (BRD-01): creazione da template (Job Search Standard, Minimal, Custom — `packages/shared/src/templates.ts`), preferite, ordine da menu, eliminazione con conferma. **L'eliminazione scollega le opportunità**, che restano in Opportunità senza bacheca con tutto il loro storico (`apps/web/src/features/boards/delete-board-description.tsx`). Tetti: 100 bacheche per workspace; 30 colonne e 2000 schede per bacheca ([ADR-0008](../architecture/decisions/0008-kanban-ordering-and-board-loading.md)).
- **Colonne** (BRD-02): crea, rinomina, colore (8 token), categoria di fase facoltativa (solo suggerimento), ordine; eliminazione con spostamento delle schede.
- **Kanban** (BRD-03): trascinamento di schede e colonne con mouse, touch e tastiera; menu «Sposta in»; aggiornamento ottimistico con annullamento; archiviazione con «Annulla»; creazione rapida; suggerimento di fase non modale dopo lo spostamento verso una colonna con categoria.
- **Personalizzazione** (BRD-04): 8 sfondi o tinta, colonne Glass Subtle con alternative accessibili, zoom 0,25–1,5 e densità per dispositivo ([kanban-glass](../ux/kanban-glass.md), [board-backgrounds](../ux/board-backgrounds.md)).
- Campi personalizzati definiti per bacheca.
- **Bacheca canonica «Pipeline»** (PIP-01, `/pipeline`): colonne Da candidare, Inviate, Primo contatto, Colloqui, Offerta, Chiuse; trascinare o usare «Sposta in…» apre sempre la conferma della transizione.

## Regole vincolanti

- Spostare una scheda non cambia fase né esito ([ADR-0009](../architecture/decisions/0009-application-lifecycle-and-statistics.md)).
- Ogni interazione di trascinamento ha un'alternativa da tastiera o menu.
- Le personalizzazioni esistenti si preservano nelle evoluzioni.
- Nei raggruppamenti virtuali futuri niente trascinamento che modifica attributi (D10); Smart Board ≠ Smart View (D11).

## Gap e voci di roadmap

| Gap                                    | Voce |
| -------------------------------------- | ---- |
| Appartenenza N:M                       | D-01 |
| Smart Boards e raggruppamenti virtuali | D-09 |

## Dettaglio storico

Architettura, interazioni, ordinamento e accessibilità di M1 e il Kanban Glass di M3.UI.2 sono nell'archivio storico non pubblicato ([ADR-0018](../architecture/decisions/0018-launch-repository-and-docs-archive.md)); le decisioni valide sono in [ADR-0008](../architecture/decisions/0008-kanban-ordering-and-board-loading.md) e [kanban-glass](../ux/kanban-glass.md).
