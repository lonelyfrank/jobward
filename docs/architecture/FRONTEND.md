# Frontend

**Stato:** canonico · **Verificato su:** `jobward-v1` `b34c032` (2026-11-22, PID-01). Design visivo: [design system](../ux/design-system.md), [sidebar](../ux/sidebar.md), [kanban-glass](../ux/kanban-glass.md), [sfondi](../ux/board-backgrounds.md). Regole di interazione: [PRODUCT-PRINCIPLES](../product/PRODUCT-PRINCIPLES.md).

## Stack

React 19 (StrictMode) · react-router 8 con tabella di rotte nel codice e caricamento lazy (`src/app/router.tsx`) · TanStack Query 5 (`staleTime` 15 s, niente refetch al focus; query infinite per note e timeline) · react-hook-form + Zod con gli schemi di `@jobward/schemas` · Tailwind CSS 4 con token CSS e `@theme inline` · Radix UI · lucide-react · @dnd-kit (Kanban) · Vite 8. Interfaccia **solo in italiano**, senza libreria i18n.

## Mappa delle rotte

Tutte dentro `WorkspaceGate` (chiama `/me`; 401/403 → «Accesso non autorizzato»; nessun workspace → onboarding) e `AppShell`.

| Percorso                               | File                                             | Funzione                                                                                                                                                                  |
| -------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                    | `routes/overview.tsx`                            | 5 contatori, checklist «Inizia da qui», schede e bacheche recenti, scadenze                                                                                               |
| `/boards`                              | `routes/boards.tsx`                              | Galleria (preferite / tutte), creazione da template, modifica, eliminazione                                                                                               |
| `/boards/:boardId`                     | `routes/board.tsx` + `board-kanban.tsx`          | Kanban, selettore Kanban/Tabella, densità, menu azioni della bacheca                                                                                                      |
| `/boards/:boardId/table`               | `routes/board-table.tsx`                         | Tabella delle opportunità limitata alla bacheca                                                                                                                           |
| `…/cards/:cardId`                      | `features/cards/card-detail-route.tsx`           | Modale della scheda come rotta figlia (Kanban, Tabella, Pipeline, Opportunità)                                                                                            |
| `/pipeline`                            | `routes/pipeline.tsx`                            | Bacheca canonica per stato della candidatura; spostare = transizione confermata                                                                                           |
| `/opportunities`                       | `routes/opportunities.tsx`                       | Opportunity Center: schede Tutte / Inbox / Candidature, ricerca, filtri, colonne, viste salvate                                                                           |
| `/companies` · `/companies/:companyId` | `routes/companies.tsx`, `company.tsx`            | Elenco delle aziende e dettaglio con opportunità e candidature                                                                                                            |
| `/tasks`                               | `routes/tasks.tsx`                               | Attività con viste `all/open/done/overdue/no_due/cancelled` (`?vista=`)                                                                                                   |
| `/insights`                            | `routes/insights.tsx`                            | Insights: indicatori, funnel, stati, tempi di risposta, settimane                                                                                                         |
| `/calendar`                            | `routes/calendar.tsx`                            | Calendario mensile (agenda su telefono) di colloqui e scadenze                                                                                                            |
| `/settings` · `/profile` · `/help`     | `routes/settings.tsx`, `profile.tsx`, `help.tsx` | Etichette, tema, informazioni, esportazione JSON, selettore Dati demo (solo sviluppo, `features/workspace/data-profile-settings.tsx`); nessuna cancellazione dell'account |
| `*`                                    | `routes/not-found.tsx`                           | 404                                                                                                                                                                       |

Navigazione laterale: Overview, Pipeline, Bacheche, Opportunità, Aziende, Attività, Calendario, Insights (`src/layouts/nav.ts`); menu account con Profilo, Impostazioni, Aiuto. Nessuna rotta `/inbox`: l'Inbox è una scheda di Opportunità. Il router non definisce `errorElement`.

## Funzioni principali (dove vivono)

| Funzione                                                   | Cartella                                                                                                         | Note                                                                                                                                                                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kanban                                                     | `features/kanban/`                                                                                               | Trascinamento di schede e colonne (mouse, touch, tastiera), menu «Sposta in», archivia con Annulla, creazione rapida, zoom 0,25–1,5 per bacheca, densità, sfondi, colonne Glass; suggerimento di fase non modale dopo uno spostamento |
| Tabella / Opportunità                                      | `features/opportunities/`                                                                                        | Stato completo nell'URL, intestazioni ordinabili (`aria-sort`), colonne visibili per dispositivo, elenco a schede su telefono; niente modifica inline né selezione multipla                                                           |
| Modale della scheda                                        | `features/cards/` + `pipeline/`, `interviews/`, `timeline/`, `notes/`, `documents/`, `custom-fields/`, `labels/` | 6 schede: Panoramica (riepilogo, pipeline, attività, campi base, etichette), Colloqui, Timeline, Note, Documenti, Dettagli; guardia delle modifiche non salvate                                                                       |
| Attività                                                   | `features/tasks/`                                                                                                | Pagina e sezione nella scheda; suggerimenti deterministici con «non ora» salvato per dispositivo                                                                                                                                      |
| Ricerca globale                                            | `features/workspace/`                                                                                            | Ctrl/Cmd+K, debounce 250 ms, gruppi Opportunità/Bacheche/Colloqui                                                                                                                                                                     |
| Creazione guidata                                          | `features/kanban/global-create.tsx`                                                                              | Quattro passi (Annuncio, Dettagli, Valutazione, Candidatura), solo il titolo obbligatorio, avviso dei duplicati, «Nessuna bacheca (Inbox)»                                                                                            |
| Viste salvate, aziende, calendario, insights, esportazione | `features/saved-views/`, `companies/`, `calendar/`, `insights/`, `export/`                                       | Le viste salvate esistono solo in Opportunità                                                                                                                                                                                         |
| Overview                                                   | `features/overview/`                                                                                             | Contatori e scadenze; le analisi sono in Insights                                                                                                                                                                                     |

**Non esistono:** mappa, vista timeline globale, matrice comparativa, contatti, notifiche, importazione, caricamento file, cambio workspace, condivisione, logout (l'autenticazione è esterna), cancellazione dell'account.

## Client API

`src/lib/api.ts`: `apiRequest(path, schema, …)` chiama `/api/v1…` sulla stessa origine e **valida con Zod ogni risposta** (`invalid_response` in caso di discrepanza); errori come `ApiRequestError { status, code, requestId, issues }`. `scoped()` aggiunge `workspaceId`. Gli aggiornamenti ottimistici del Kanban si annullano in caso di errore (`features/kanban/mutations.ts`).

## Design system e accessibilità

Token in `src/styles/index.css` (`:root` e `.dark`), Glass in `src/styles/glass.css` (con alternative per trasparenza ridotta, contrasto elevato, colori forzati). Componenti in `src/components/ui/`: button, dialog (center/drawer/workspace/search), confirm-dialog, sheet, dropdown-menu, tabs, tooltip, segmented-control, field, input/select, textarea, badge, surface, skeleton, empty-state, notices (errori persistenti `role="alert"`, successi `role="status"`). Skip link, focus gestito alla navigazione, anello `:focus-visible`, riduzione del movimento globale, trascinamento da tastiera con annunci in italiano, axe nella maggior parte degli spec E2E, matrice di larghezze 320–1360 px. Tema chiaro/scuro/sistema applicato prima del primo paint (`public/theme-init.js`).

## Persistenza locale

Solo `localStorage` per preferenze del dispositivo: tema (`jobward-theme`), barra laterale compressa (`jobward-sidebar-collapsed`), densità, zoom per bacheca, colonne visibili della Tabella, «non ora» dei suggerimenti. Le chiavi legacy `mr-`/`mr.` sono ancora lette per migrazione.

## Codice dormiente noto

prop `milestone` di `EmptyState` sempre nulla nell'Overview · commenti superati in `layouts/app-shell.tsx` e `features/workspace/onboarding.tsx` · `Loading()` duplicato in `workspace-gate.tsx` · commento di `lib/theme.ts` che cita un controllo del tema nel menu utente inesistente.

## Test

28 file Vitest, 23 spec Playwright sullo stack di sviluppo e 1 spec sulla build di produzione (conteggio dei file tracciati a `b34c032`; esiti nell'[AUDIT-REPORT](../status/AUDIT-REPORT.md#verifiche-v1)). Dettagli in [TESTING](../development/TESTING.md).
