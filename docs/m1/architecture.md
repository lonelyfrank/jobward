# M1 — Architettura

Obiettivo: il primo workspace Kanban realmente utilizzabile (bacheche, colonne, schede, dettaglio, trascinamento) sopra
le fondamenta di M0/M0.H, senza riscrivere nulla di ciò che esisteva. Decisioni: [ADR-0008](../architecture/decisions/0008-kanban-ordering-and-board-loading.md).

## Panoramica

```
Browser (React 19, TanStack Query, dnd-kit)
   │  /api/v1/…?workspaceId=…   (stessa origine, JSON, CSRF: Content-Type + Origin)
   ▼
Worker (Hono)
   authenticate ─► workspaceScope ─► route (Zod) ─► service ─► D1 (batch atomico)
                       │                               │
                requireMembership                 FK composite + trigger (ADR-0007)
```

| Livello      | Dove                                                       | Responsabilità                                                                                                        |
| ------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Contratti    | `packages/schemas/src/{board,card,overview}.ts`            | Input e risposte validati da **entrambi** i lati (il client rifiuta risposte di forma inattesa)                       |
| Ordinamento  | `packages/shared/src/ordering.ts`                          | Funzioni pure `placeAfter`, `applyPlacement`, `anchorBefore` (usate da server e client)                               |
| Template     | `packages/shared/src/templates.ts`                         | Dati dei template; il server li usa per creare bacheca + colonne                                                      |
| Perimetro    | `apps/api/src/middleware/workspace.ts`                     | **Unico** punto che verifica l'appartenenza al workspace (riusa `requireMembership`) e blocca le scritture a `viewer` |
| Servizi      | `apps/api/src/services/{boards,columns,cards,ordering}.ts` | Regole di dominio e scritture (`batch()` con condizioni nel SQL)                                                      |
| Rotte        | `apps/api/src/modules/{boards,columns,cards}/routes.ts`    | Validazione input, codici HTTP, validazione della risposta con lo schema condiviso                                    |
| Cache client | `apps/web/src/features/boards/api.ts`                      | Chiavi qualificate dal workspace; invalidazione dei riepiloghi                                                        |
| Stato Kanban | `apps/web/src/features/kanban/board-state.ts`              | Funzioni pure sullo stato della bacheca (spostamenti locali, contatori) — testate in isolamento                       |
| Mutazioni    | `apps/web/src/features/kanban/mutations.ts`                | Aggiornamento ottimistico, rollback, coda seriale per bacheca                                                         |
| Interfaccia  | `apps/web/src/{routes,features}/…`                         | Galleria, bacheca, colonne, schede, pannello di dettaglio, archiviate, creazione rapida globale                       |

## Cambiamenti rispetto a M0/M0.H

| Cambiamento                                                                                 | Motivo                                                                                          |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Migrazione `0002_activity_events_trigger_fix`                                               | Il trigger di `0001` impediva di eliminare una bacheca con eventi (M1-01, P1)                   |
| `Variables.workspaceId` e middleware `workspaceScope`; l'overview lo riusa                  | Un solo controllo di appartenenza, nessuna duplicazione                                         |
| `createCardInput.details`: da `applicationDetailsInput` a `cardDetailsInput` (azienda, URL) | Solo i campi **completi** in M1; i campi di M2 sono rifiutati con 400, non ignorati             |
| `createBoardInput.templateId`, nuovi `update*Input`, `moveInput`, `moveCardInput`, risposte | Contratti di M1                                                                                 |
| `OverviewResponse.recentCards`                                                              | "Accesso alle opportunità recenti"                                                              |
| `LIMITS`: bacheche/colonne/schede per contenitore                                           | Tetti atomici (ADR-0008)                                                                        |
| `RouteHandle.fullBleed`; la bacheca usa tutta l'area                                        | Scorrimento orizzontale delle colonne                                                           |
| Token `accent-*` (8 colori) + 16 coppie nel controllo di contrasto                          | Colori di bacheche/colonne: token, mai CSS arbitrario                                           |
| Componenti: `Dialog`, `ConfirmDialog`, `Textarea`, `NoticeProvider`, voci di menu           | Primitive Radix, nessun nuovo design system                                                     |
| Dipendenze: `@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0, `@dnd-kit/utilities` 3.2.2   | Trascinamento                                                                                   |
| Regola ESLint nei test: `no-unsafe-return` disattivata                                      | Le risposte JSON dei test sono `any` per scelta (come le altre regole `no-unsafe-*` già spente) |

## Modello dei dati usato

`boards`, `board_columns`, `cards`, `application_details` (solo `company`, `source_url`), `activity_events` (`card_created`,
`card_moved`, `priority_changed`, `card_archived`, `card_restored`). Nessuna nuova tabella: lo schema di M0 era già sufficiente.
Ogni `INSERT` valorizza `workspace_id` **derivandolo dal genitore nel SQL** (`INSERT … SELECT … FROM board_columns`), non dall'input.

## Limiti dichiarati

Vedi [issue-register.md](issue-register.md) (sezione "Limiti noti").
