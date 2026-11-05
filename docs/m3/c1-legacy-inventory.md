# M3-C1 — Inventario legacy prima delle modifiche

Baseline: `00005509a5241942c818a6fe95b8a5a4e4d3ec76`, branch `m3-application-workflow`, working tree iniziale pulito. Inventario generato prima di modificare il codice attivo. Ricerca case-insensitive: `meet[-_ ]?roulette`, `meetroulette`, abbreviazioni `mr-`/`mr_`, su tutti i file tracciati leggibili (incluso lockfile e workflow). Nessun match nelle migrazioni SQL o negli snapshot storici.

## Classificazione iniziale

| Categoria                                                   | Occorrenze |
| ----------------------------------------------------------- | ---------: |
| codice/configurazione/documentazione corrente               |        197 |
| identità di sviluppo persistente                            |          2 |
| infrastruttura/configurazione (da verificare singolarmente) |         10 |
| storico                                                     |         19 |
| test                                                        |         29 |

Le righe Wrangler richiedono una distinzione puntuale: `name` Worker rinominabile nel codice senza deploy; `database_id` e binding invariati; `database_name` e identità dev vanno verificati sui dati esistenti prima di qualsiasi variazione. La classificazione storica include audit e consegne già datati: non riscriverli come se fossero stati prodotti con il nome nuovo.

Le occorrenze `mr-*` includono utility Tailwind di margine (`-mr-1`, `mr-auto`): sono falsi positivi della ricerca ampia e restano invariate. Le chiavi browser sono invece riferimenti persistenti e richiedono compatibilità di lettura.

## Dettaglio per file e riga

### `.github/workflows/ci.yml`

- Riga 68, codice/configurazione/documentazione corrente: `- run: pnpm --filter @meet-roulette/web exec playwright install --with-deps chromium`
- Riga 73, codice/configurazione/documentazione corrente: `- run: pnpm --filter @meet-roulette/web build`

### `README.md`

- Riga 3, codice/configurazione/documentazione corrente: `> **Nota sul nome.** Il progetto si chiamava _Meet Roulette_ ed è stato rinominato **Jobward**. Il nome visibile è già Jobward; gli identificatori tecnici (pacchetti ʼ@meet-roulette/*ʼ, nomi di Worker e database D1, identità di sviluppo) mantengono il nome storico per non perdere dati né rompere gli ambienti: strategia in [ADR-0013](docs/architecture/decisions/0013-rebranding-jobward.md).`
- Riga 71, codice/configurazione/documentazione corrente: `- Per gli E2E: Chromium di Playwright (ʼpnpm --filter @meet-roulette/web exec playwright install chromiumʼ).`
- Riga 103, identità di sviluppo persistente: `| ʼDEV_USER_EMAILʼ     | —                    | ʼdev@meet-roulette.localʼ | Identità fittizia locale                                |`
- Riga 145, codice/configurazione/documentazione corrente: `meet-roulette/`

### `apps/api/package.json`

- Riga 2, codice/configurazione/documentazione corrente: `"name": "@meet-roulette/api",`
- Riga 15, codice/configurazione/documentazione corrente: `"@meet-roulette/database": "workspace:*",`
- Riga 16, codice/configurazione/documentazione corrente: `"@meet-roulette/schemas": "workspace:*",`
- Riga 17, codice/configurazione/documentazione corrente: `"@meet-roulette/shared": "workspace:*",`

### `apps/api/src/app.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { createDb } from '@meet-roulette/database';`

### `apps/api/src/env.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import type { Database } from '@meet-roulette/database';`

### `apps/api/src/lib/errors.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import type { ApiErrorCode } from '@meet-roulette/shared';`

### `apps/api/src/middleware/auth.ts`

- Riga 43, identità di sviluppo persistente: `email = (env.DEV_USER_EMAIL ?? 'dev@meet-roulette.local').toLowerCase();`

### `apps/api/src/middleware/errors.ts`

- Riga 3, codice/configurazione/documentazione corrente: `import type { ApiErrorBody, ApiErrorCode } from '@meet-roulette/shared';`

### `apps/api/src/middleware/guards.ts`

- Riga 3, codice/configurazione/documentazione corrente: `import { LIMITS } from '@meet-roulette/shared';`

### `apps/api/src/middleware/workspace.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { idSchema } from '@meet-roulette/schemas';`

### `apps/api/src/modules/boards/routes.ts`

- Riga 16, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`

### `apps/api/src/modules/cards/routes.ts`

- Riga 15, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`

### `apps/api/src/modules/columns/routes.ts`

- Riga 7, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`

### `apps/api/src/modules/custom-fields/routes.ts`

- Riga 7, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`

### `apps/api/src/modules/interviews/routes.ts`

- Riga 6, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`

### `apps/api/src/modules/labels/routes.ts`

- Riga 8, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`

### `apps/api/src/modules/opportunities/routes.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { opportunitiesQuery, opportunitiesResponse } from '@meet-roulette/schemas';`

### `apps/api/src/modules/workspaces/routes.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { createWorkspaceInput } from '@meet-roulette/schemas';`

### `apps/api/src/services/boards.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { newId, schema, type Database } from '@meet-roulette/database';`
- Riga 8, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`
- Riga 9, codice/configurazione/documentazione corrente: `import { getBoardTemplate, LIMITS, POSITION_GAP } from '@meet-roulette/shared';`

### `apps/api/src/services/card-rows.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { schema, type Database } from '@meet-roulette/database';`
- Riga 2, codice/configurazione/documentazione corrente: `import { EMPTY_INTERVIEW_SUMMARY, type Card } from '@meet-roulette/schemas';`

### `apps/api/src/services/cards.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { newId, schema, type Database } from '@meet-roulette/database';`
- Riga 9, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`
- Riga 10, codice/configurazione/documentazione corrente: `import { salaryIssues } from '@meet-roulette/schemas';`
- Riga 11, codice/configurazione/documentazione corrente: `import { LIMITS, POSITION_GAP } from '@meet-roulette/shared';`

### `apps/api/src/services/columns.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { newId, schema, type Database } from '@meet-roulette/database';`
- Riga 2, codice/configurazione/documentazione corrente: `import type { Column, CreateColumnInput, UpdateColumnInput } from '@meet-roulette/schemas';`
- Riga 3, codice/configurazione/documentazione corrente: `import { LIMITS, POSITION_GAP } from '@meet-roulette/shared';`

### `apps/api/src/services/custom-fields.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { newId, type Database } from '@meet-roulette/database';`
- Riga 15, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`
- Riga 16, codice/configurazione/documentazione corrente: `import { LIMITS, POSITION_GAP } from '@meet-roulette/shared';`

### `apps/api/src/services/events.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { newId } from '@meet-roulette/database';`

### `apps/api/src/services/interview-summaries.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import type { Database } from '@meet-roulette/database';`
- Riga 7, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`

### `apps/api/src/services/interviews.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { newId, type Database } from '@meet-roulette/database';`
- Riga 7, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`
- Riga 8, codice/configurazione/documentazione corrente: `import { LIMITS } from '@meet-roulette/shared';`

### `apps/api/src/services/labels.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { newId, type Database } from '@meet-roulette/database';`
- Riga 2, codice/configurazione/documentazione corrente: `import type { CreateLabelInput, Label, UpdateLabelInput } from '@meet-roulette/schemas';`
- Riga 3, codice/configurazione/documentazione corrente: `import { LIMITS } from '@meet-roulette/shared';`

### `apps/api/src/services/opportunities.ts`

- Riga 5, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`
- Riga 6, codice/configurazione/documentazione corrente: `import { DEFAULT_SORT_DIR } from '@meet-roulette/schemas';`
- Riga 7, codice/configurazione/documentazione corrente: `import { CONTRACT_TYPES, OUTCOMES, PRIORITIES, STAGES, WORK_MODES } from '@meet-roulette/shared';`
- Riga 8, codice/configurazione/documentazione corrente: `import type { Database } from '@meet-roulette/database';`

### `apps/api/src/services/ordering.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { POSITION_GAP, placeAfter, type Positioned } from '@meet-roulette/shared';`

### `apps/api/src/services/overview.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { schema, type Database } from '@meet-roulette/database';`
- Riga 2, codice/configurazione/documentazione corrente: `import type { OverviewResponse } from '@meet-roulette/schemas';`
- Riga 3, codice/configurazione/documentazione corrente: `import { SUBMITTED_STAGES } from '@meet-roulette/shared';`

### `apps/api/src/services/users.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { newId, schema, type Database } from '@meet-roulette/database';`

### `apps/api/src/services/workspaces.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { newId, schema, type Database } from '@meet-roulette/database';`
- Riga 2, codice/configurazione/documentazione corrente: `import type { CreateWorkspaceInput, Workspace } from '@meet-roulette/schemas';`

### `apps/api/test/application-details.test.ts`

- Riga 2, test: `import { cardResponse } from '@meet-roulette/schemas';`

### `apps/api/test/auth.test.ts`

- Riga 107, test: `'https://meet-roulette-dev.example.workers.dev/api/v1/me',`

### `apps/api/test/boards.test.ts`

- Riga 1, test: `import { BOARD_TEMPLATES } from '@meet-roulette/shared';`
- Riga 57, test: `const { LIMITS } = await import('@meet-roulette/shared');`

### `apps/api/test/cards.test.ts`

- Riga 263, test: `const { LIMITS } = await import('@meet-roulette/shared');`

### `apps/api/test/columns.test.ts`

- Riga 1, test: `import { LIMITS } from '@meet-roulette/shared';`

### `apps/api/test/custom-fields.test.ts`

- Riga 7, test: `} from '@meet-roulette/schemas';`
- Riga 8, test: `import { LIMITS } from '@meet-roulette/shared';`
- Riga 9, test: `import { newId, schema } from '@meet-roulette/database';`

### `apps/api/test/database.test.ts`

- Riga 2, test: `import { newId, schema } from '@meet-roulette/database';`

### `apps/api/test/helpers.ts`

- Riga 2, test: `import { createDb, newId, schema } from '@meet-roulette/database';`

### `apps/api/test/interviews.test.ts`

- Riga 7, test: `} from '@meet-roulette/schemas';`
- Riga 8, test: `import { LIMITS } from '@meet-roulette/shared';`

### `apps/api/test/kanban-isolation.test.ts`

- Riga 2, test: `import { newId, schema } from '@meet-roulette/database';`

### `apps/api/test/labels.test.ts`

- Riga 2, test: `import { deletedResponse, labelResponse, labelsResponse } from '@meet-roulette/schemas';`
- Riga 3, test: `import { LIMITS } from '@meet-roulette/shared';`
- Riga 4, test: `import { newId, schema } from '@meet-roulette/database';`

### `apps/api/test/m2-isolation.test.ts`

- Riga 2, test: `import { newId, schema } from '@meet-roulette/database';`

### `apps/api/test/opportunities.test.ts`

- Riga 3, test: `import { opportunitiesResponse } from '@meet-roulette/schemas';`

### `apps/api/test/overview.test.ts`

- Riga 2, test: `import { overviewResponse } from '@meet-roulette/schemas';`

### `apps/api/test/tenant-integrity.test.ts`

- Riga 3, test: `import { newId, schema } from '@meet-roulette/database';`

### `apps/api/wrangler.jsonc`

- Riga 3, infrastruttura/configurazione (da verificare singolarmente): `"name": "meet-roulette",`
- Riga 26, infrastruttura/configurazione (da verificare singolarmente): `"database_name": "meet-roulette",`
- Riga 27, infrastruttura/configurazione (da verificare singolarmente): `// Segnaposto: sostituire con l'ID reale (ʼwrangler d1 create meet-rouletteʼ)`
- Riga 49, infrastruttura/configurazione (da verificare singolarmente): `"name": "meet-roulette-dev",`
- Riga 62, infrastruttura/configurazione (da verificare singolarmente): `"database_name": "meet-roulette-local",`
- Riga 70, infrastruttura/configurazione (da verificare singolarmente): `"DEV_USER_EMAIL": "dev@meet-roulette.local",`
- Riga 83, infrastruttura/configurazione (da verificare singolarmente): `"name": "meet-roulette-preview",`
- Riga 93, infrastruttura/configurazione (da verificare singolarmente): `"database_name": "meet-roulette-preview",`
- Riga 101, infrastruttura/configurazione (da verificare singolarmente): `"DEV_USER_EMAIL": "dev@meet-roulette.local",`

### `apps/api/wrangler.test.jsonc`

- Riga 3, infrastruttura/configurazione (da verificare singolarmente): `"name": "meet-roulette-test",`

### `apps/web/package.json`

- Riga 2, codice/configurazione/documentazione corrente: `"name": "@meet-roulette/web",`
- Riga 21, codice/configurazione/documentazione corrente: `"@meet-roulette/schemas": "workspace:*",`
- Riga 22, codice/configurazione/documentazione corrente: `"@meet-roulette/shared": "workspace:*",`

### `apps/web/playwright.config.ts`

- Riga 8, codice/configurazione/documentazione corrente: `const API = 'pnpm --filter @meet-roulette/api exec wrangler';`
- Riga 41, codice/configurazione/documentazione corrente: `command: ʼpnpm --filter @meet-roulette/web exec vite --port ${WEB_PORT} --strictPortʼ,`

### `apps/web/playwright.preview.config.ts`

- Riga 6, codice/configurazione/documentazione corrente: `* reali, fallback SPA, instradamento /api/*. Richiede ʼpnpm --filter @meet-roulette/web buildʼ.`
- Riga 9, codice/configurazione/documentazione corrente: `const API = 'pnpm --filter @meet-roulette/api exec wrangler';`

### `apps/web/public/theme-init.js`

- Riga 3, codice/configurazione/documentazione corrente: `var pref = localStorage.getItem('mr-theme');`

### `apps/web/src/app/app.test.tsx`

- Riga 157, test: `expect(window.localStorage.getItem('mr-sidebar-collapsed')).toBe('1');`
- Riga 304, test: `expect(window.localStorage.getItem('mr-theme')).toBe('dark');`

### `apps/web/src/components/ui/confirm-dialog.tsx`

- Riga 35, codice/configurazione/documentazione corrente: `<AlertDialog.Content className="fixed top-1/2 left-1/2 z-[70] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 animate-[mr-fade-in_0.12s_ease-out] rounded-lg border border-border bg-surface p-5 shadow-md">`

### `apps/web/src/components/ui/dialog.tsx`

- Riga 52, codice/configurazione/documentazione corrente: `'inset-0 h-dvh animate-[mr-fade-in_0.12s_ease-out] md:inset-auto md:top-1/2 md:left-1/2 md:h-auto md:max-h-[90dvh] md:min-h-[min(36rem,90dvh)] md:w-[min(1000px,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:border md:border-border'`
- Riga 54, codice/configurazione/documentazione corrente: `? 'inset-0 animate-[mr-fade-in_0.12s_ease-out] md:left-auto md:w-[30rem] md:max-w-[92vw] md:animate-[mr-slide-in-right_0.18s_ease-out] md:border-l md:border-border'`
- Riga 55, codice/configurazione/documentazione corrente: `: 'top-1/2 left-1/2 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 animate-[mr-fade-in_0.12s_ease-out] rounded-lg border border-border',`
- Riga 80, codice/configurazione/documentazione corrente: `<Button variant="ghost" size="icon" aria-label="Chiudi" className="-mt-1 -mr-2">`

### `apps/web/src/components/ui/dropdown-menu.tsx`

- Riga 19, codice/configurazione/documentazione corrente: `'z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-56 animate-[mr-fade-in_0.12s_ease-out] overflow-y-auto rounded-lg border border-border bg-surface p-1 text-sm shadow-md',`

### `apps/web/src/components/ui/sheet.tsx`

- Riga 34, codice/configurazione/documentazione corrente: `className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] animate-[mr-slide-in-left_0.18s_ease-out] flex-col border-r border-border bg-sidebar shadow-md md:hidden"`

### `apps/web/src/components/ui/skeleton.tsx`

- Riga 10, codice/configurazione/documentazione corrente: `'animate-[mr-pulse_1.6s_ease-in-out_infinite] rounded-md bg-surface-muted',`

### `apps/web/src/features/boards/api.ts`

- Riga 17, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`
- Riga 19, codice/configurazione/documentazione corrente: `import { applyPlacement } from '@meet-roulette/shared';`

### `apps/web/src/features/boards/board-card.tsx`

- Riga 75, codice/configurazione/documentazione corrente: `className="-mt-1.5 -mr-2"`

### `apps/web/src/features/boards/board-dialog.tsx`

- Riga 8, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`
- Riga 14, codice/configurazione/documentazione corrente: `} from '@meet-roulette/shared';`

### `apps/web/src/features/boards/color-picker.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import { COLOR_TOKENS, type ColorToken } from '@meet-roulette/schemas';`

### `apps/web/src/features/cards/card-detail.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import type { ActivityEvent, Card, Column } from '@meet-roulette/schemas';`
- Riga 13, codice/configurazione/documentazione corrente: `} from '@meet-roulette/shared';`
- Riga 675, codice/configurazione/documentazione corrente: `className="mr-auto"`

### `apps/web/src/features/cards/card-form.ts`

- Riga 6, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`
- Riga 7, codice/configurazione/documentazione corrente: `import type { Priority } from '@meet-roulette/shared';`

### `apps/web/src/features/cards/card-history.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import type { ActivityEvent } from '@meet-roulette/schemas';`
- Riga 9, codice/configurazione/documentazione corrente: `} from '@meet-roulette/shared';`

### `apps/web/src/features/cards/smart-summary.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import type { Card } from '@meet-roulette/schemas';`
- Riga 2, codice/configurazione/documentazione corrente: `import { STAGES, type Stage } from '@meet-roulette/shared';`

### `apps/web/src/features/custom-fields/api.ts`

- Riga 10, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`

### `apps/web/src/features/custom-fields/card-fields-section.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import type { CardCustomField } from '@meet-roulette/schemas';`

### `apps/web/src/features/custom-fields/field-form.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import type { CustomField } from '@meet-roulette/schemas';`
- Riga 2, codice/configurazione/documentazione corrente: `import { CUSTOM_FIELD_TYPES, LIMITS, type CustomFieldType } from '@meet-roulette/shared';`

### `apps/web/src/features/custom-fields/fields-dialog.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import type { CustomField } from '@meet-roulette/schemas';`
- Riga 2, codice/configurazione/documentazione corrente: `import { LIMITS } from '@meet-roulette/shared';`

### `apps/web/src/features/custom-fields/value-editor.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import type { CustomField } from '@meet-roulette/schemas';`
- Riga 2, codice/configurazione/documentazione corrente: `import { LIMITS } from '@meet-roulette/shared';`

### `apps/web/src/features/custom-fields/values.test.ts`

- Riga 1, test: `import type { CustomField } from '@meet-roulette/schemas';`

### `apps/web/src/features/custom-fields/values.ts`

- Riga 5, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`

### `apps/web/src/features/interviews/api.ts`

- Riga 7, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`

### `apps/web/src/features/interviews/interview-form.tsx`

- Riga 7, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`
- Riga 14, codice/configurazione/documentazione corrente: `} from '@meet-roulette/shared';`

### `apps/web/src/features/interviews/interviews-tab.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import type { Card, Interview } from '@meet-roulette/schemas';`
- Riga 2, codice/configurazione/documentazione corrente: `import { INTERVIEW_RESULTS, LIMITS, type InterviewResult } from '@meet-roulette/shared';`

### `apps/web/src/features/kanban/board-state.test.ts`

- Riga 2, test: `import type { BoardDetailResponse, Card, Column } from '@meet-roulette/schemas';`

### `apps/web/src/features/kanban/board-state.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import type { BoardDetailResponse, Card, Column } from '@meet-roulette/schemas';`
- Riga 2, codice/configurazione/documentazione corrente: `import { anchorBefore, applyPlacement, sortPositioned } from '@meet-roulette/shared';`
- Riga 6, codice/configurazione/documentazione corrente: `* con la stessa logica di posizionamento del server (ʼ@meet-roulette/sharedʼ), così la vista`

### `apps/web/src/features/kanban/card-view.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import type { Card } from '@meet-roulette/schemas';`

### `apps/web/src/features/kanban/column-dialog.tsx`

- Riga 2, codice/configurazione/documentazione corrente: `import { createColumnInput, type Column } from '@meet-roulette/schemas';`
- Riga 3, codice/configurazione/documentazione corrente: `import { LIMITS, STAGES } from '@meet-roulette/shared';`

### `apps/web/src/features/kanban/delete-column-dialog.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import type { Column } from '@meet-roulette/schemas';`

### `apps/web/src/features/kanban/global-create.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import { LIMITS } from '@meet-roulette/shared';`

### `apps/web/src/features/kanban/kanban-board.tsx`

- Riga 26, codice/configurazione/documentazione corrente: `import type { BoardDetailResponse, Card, Column } from '@meet-roulette/schemas';`
- Riga 27, codice/configurazione/documentazione corrente: `import { anchorBefore } from '@meet-roulette/shared';`

### `apps/web/src/features/kanban/kanban-card.tsx`

- Riga 3, codice/configurazione/documentazione corrente: `import type { Card, Column } from '@meet-roulette/schemas';`

### `apps/web/src/features/kanban/kanban-column.tsx`

- Riga 3, codice/configurazione/documentazione corrente: `import type { Card, Column } from '@meet-roulette/schemas';`

### `apps/web/src/features/kanban/mutations.ts`

- Riga 9, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`

### `apps/web/src/features/kanban/quick-create.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import { LIMITS } from '@meet-roulette/shared';`

### `apps/web/src/features/labels/api.ts`

- Riga 10, codice/configurazione/documentazione corrente: `} from '@meet-roulette/schemas';`

### `apps/web/src/features/labels/label-chip.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import type { ColorToken } from '@meet-roulette/schemas';`

### `apps/web/src/features/labels/label-picker.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import type { ColorToken } from '@meet-roulette/schemas';`
- Riga 2, codice/configurazione/documentazione corrente: `import { LIMITS } from '@meet-roulette/shared';`
- Riga 86, codice/configurazione/documentazione corrente: `className="-mr-1 grid size-5 place-items-center rounded-full hover:bg-surface-muted max-md:size-11"`

### `apps/web/src/features/labels/labels-manager.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import type { ColorToken, Label } from '@meet-roulette/schemas';`
- Riga 2, codice/configurazione/documentazione corrente: `import { LIMITS } from '@meet-roulette/shared';`

### `apps/web/src/features/opportunities/api.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { opportunitiesResponse } from '@meet-roulette/schemas';`

### `apps/web/src/features/opportunities/filters-panel.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import type { Column, Label } from '@meet-roulette/schemas';`
- Riga 9, codice/configurazione/documentazione corrente: `} from '@meet-roulette/shared';`

### `apps/web/src/features/opportunities/opportunities-view.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import { LIMITS } from '@meet-roulette/shared';`

### `apps/web/src/features/opportunities/results.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import type { Label, Opportunity } from '@meet-roulette/schemas';`

### `apps/web/src/features/opportunities/table-state.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { DEFAULT_SORT_DIR, OPPORTUNITY_SORTS, type OpportunitySort } from '@meet-roulette/schemas';`
- Riga 2, codice/configurazione/documentazione corrente: `import { LIMITS } from '@meet-roulette/shared';`

### `apps/web/src/features/overview/api.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { overviewResponse } from '@meet-roulette/schemas';`

### `apps/web/src/features/workspace/api.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { meResponse, workspaceResponse, type CreateWorkspaceInput } from '@meet-roulette/schemas';`

### `apps/web/src/features/workspace/context.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import type { User, Workspace } from '@meet-roulette/schemas';`

### `apps/web/src/features/workspace/onboarding.tsx`

- Riga 2, codice/configurazione/documentazione corrente: `import { createWorkspaceInput, timezoneSchema } from '@meet-roulette/schemas';`

### `apps/web/src/hooks/use-sidebar-collapsed.ts`

- Riga 4, codice/configurazione/documentazione corrente: `const KEY = 'mr-sidebar-collapsed';`

### `apps/web/src/layouts/app-shell.tsx`

- Riga 104, codice/configurazione/documentazione corrente: `'animate-[mr-fade-in_0.15s_ease-out]',`

### `apps/web/src/layouts/topbar.tsx`

- Riga 4, codice/configurazione/documentazione corrente: `import { THEME_PREFERENCES, type ThemePreference } from '@meet-roulette/shared';`

### `apps/web/src/lib/api.test.ts`

- Riga 1, test: `import { workspaceResponse } from '@meet-roulette/schemas';`

### `apps/web/src/lib/api.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import type { ApiErrorBody, ApiErrorCode } from '@meet-roulette/shared';`

### `apps/web/src/lib/brand.ts`

- Riga 6, codice/configurazione/documentazione corrente: `* pronta. Gli identificatori tecnici persistenti (pacchetti ʼ@meet-roulette/*ʼ, nomi Worker e D1,`

### `apps/web/src/lib/labels.ts`

- Riga 13, codice/configurazione/documentazione corrente: `} from '@meet-roulette/shared';`
- Riga 14, codice/configurazione/documentazione corrente: `import type { ColorToken } from '@meet-roulette/schemas';`

### `apps/web/src/lib/salary.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import type { Card } from '@meet-roulette/schemas';`

### `apps/web/src/lib/theme.test.ts`

- Riga 8, test: `window.localStorage.setItem('mr-theme', 'neon');`
- Riga 16, test: `expect(window.localStorage.getItem('mr-theme')).toBe('dark');`

### `apps/web/src/lib/theme.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { THEME_PREFERENCES, type ThemePreference } from '@meet-roulette/shared';`
- Riga 5, codice/configurazione/documentazione corrente: `const KEY = 'mr-theme';`

### `apps/web/src/lib/zod-config.ts`

- Riga 8, codice/configurazione/documentazione corrente: `* La configurazione che conta è in ʼ@meet-roulette/schemasʼ (ʼzod-setup.tsʼ), valutata prima di`

### `apps/web/src/routes/boards.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import { anchorBefore, BOARD_TEMPLATES } from '@meet-roulette/shared';`

### `apps/web/src/routes/settings.tsx`

- Riga 1, codice/configurazione/documentazione corrente: `import { type ThemePreference } from '@meet-roulette/shared';`

### `apps/web/src/styles/index.css`

- Riga 147, codice/configurazione/documentazione corrente: `@keyframes mr-fade-in {`
- Riga 157, codice/configurazione/documentazione corrente: `@keyframes mr-slide-in-right {`
- Riga 165, codice/configurazione/documentazione corrente: `@keyframes mr-slide-in-left {`
- Riga 173, codice/configurazione/documentazione corrente: `@keyframes mr-pulse {`

### `apps/web/src/test/fixtures.ts`

- Riga 1, test: `import type { BoardDetailResponse, BoardListItem, Card, Column } from '@meet-roulette/schemas';`

### `docs/architecture/authentication.md`

- Riga 70, codice/configurazione/documentazione corrente: `1. Creare il database: ʼwrangler d1 create meet-rouletteʼ e inserire l'ʼdatabase_idʼ in ʼwrangler.jsoncʼ.`

### `docs/architecture/decisions/0013-rebranding-jobward.md`

- Riga 7, storico: `Il prodotto, finora «Meet Roulette», si chiama **Jobward**. Il nome compare in tre famiglie di posti con rischi diversi:`
- Riga 10, storico: `2. **Identificatori di codice** (scope dei pacchetti ʼ@meet-roulette/*ʼ, 185 occorrenze in 5 pacchetti): nessun dato persistente, ma un rename tocca ogni ʼimportʼ e il lockfile.`
- Riga 11, storico: `3. **Identificatori persistenti o di infrastruttura** (nome del Worker, ʼdatabase_nameʼ D1, identità di sviluppo ʼdev@meet-roulette.localʼ): cambiarli **non rinomina** la risorsa esistente, ne indica **un'altra**.`
- Riga 21, storico: `| Scope dei pacchetti ʼ@meet-roulette/*ʼ, ʼnameʼ del ʼpackage.jsonʼ radice              | **Invariati; rename rinviato (D6)**                       | Decisione esplicita del proprietario del 2026-11-05: conservare gli identificatori tecnici esistenti. Un futuro rename richiede autorizzazione separata.                                  |`
- Riga 22, storico: `| ʼnameʼ del Worker (ʼmeet-rouletteʼ, ʼ-devʼ, ʼ-previewʼ, ʼ-testʼ)                      | **Invariati**                                             | Il nome identifica il Worker distribuito, il suo dominio ʼworkers.devʼ e i suoi segreti: un rename è un **nuovo** Worker. Va fatto al momento del deploy, con il nuovo dominio.           |`
- Riga 23, storico: `| ʼdatabase_nameʼ D1 (ʼmeet-rouletteʼ, ʼ-localʼ, ʼ-previewʼ)                            | **Invariati**                                             | Un nome diverso punta a un database **vuoto**: i dati degli utenti resterebbero nel vecchio. D1 non supporta il rename. Strategia sotto.                                                  |`
- Riga 24, storico: `| Identità locale ʼdev@meet-roulette.localʼ (ʼDEV_USER_EMAILʼ)                          | **Invariata**                                             | Cambiarla crea un utente diverso nel database di sviluppo e nasconde i dati esistenti dell'ambiente locale.                                                                               |`
- Riga 31, storico: `2. **D1:** **non rinominare**. Il ʼdatabase_nameʼ è un'etichetta interna (il binding ʼDBʼ e il ʼdatabase_idʼ non cambiano): si può mantenere ʼmeet-rouletteʼ indefinitamente senza effetti visibili. Se si desidera il nuovo nome: ʼwrangler d1 exportʼ → ʼd1 create jobwardʼ → ʼimportʼ → verifica dei conteggi → cambio di ʼdatabase_idʼ, con il vecchio database conservato fino alla verifica.`
- Riga 39, storico: `- Convivono due nomi nel codice (visibile: Jobward; tecnico: ʼmeet-rouletteʼ). È documentato qui e nel README.`

### `docs/architecture/overview.md`

- Riga 3, codice/configurazione/documentazione corrente: `Jobward (già «Meet Roulette»; gli identificatori tecnici mantengono il nome storico, vedi [ADR-0013](decisions/0013-rebranding-jobward.md)) è un **modular monolith** su Cloudflare: un solo Worker serve sia l'API (ʼ/api/*ʼ) sia il`

### `docs/m0h/cloudflare-readiness.md`

- Riga 36, storico: `| Database D1 reale                                 | ʼwrangler d1 create meet-rouletteʼ → sostituire il ʼdatabase_idʼ segnaposto (l'invariante ʼcheck:configʼ va aggiornata di conseguenza)                          |`

### `docs/m1/board-interactions.md`

- Riga 11, storico: `| Template    | Job Search Standard (6 colonne con fase) · Minimal (3) · Personalizzata (0). **Letti da ʼ@meet-roulette/sharedʼ**, non scritti nei componenti | Un test confronta le colonne create con quelle del template                   |`

### `docs/m1/delivery.md`

- Riga 12, storico: `Meet Roulette è ora **utilizzabile** per organizzare candidature reali: si apre l'app, si crea una bacheca da template, si personalizzano le colonne,`
- Riga 28, storico: `I **template sono letti dal modulo dati condiviso** (ʼ@meet-roulette/sharedʼ), anche dal server.`

### `docs/m2/api-contracts.md`

- Riga 5, storico: `risorse di altri workspace e inesistenti → **404 indistinguibili**. Gli schemi Zod di ʼ@meet-roulette/schemasʼ sono il contratto: server e client li condividono.`

### `docs/m2/issue-register.md`

- Riga 23, storico: `Il contenuto principale entra con ʼmr-fade-inʼ (0,15 s, opacità 0→1): axe calcola il contrasto sul colore composto con l'opacità _corrente_.`

### `docs/m25/api-contracts.md`

- Riga 3, storico: `Convenzioni invariate (M1/M2): prefisso ʼ/api/v1ʼ, ʼ?workspaceId=ʼ su ogni rotta (verificato solo da ʼworkspaceScopeʼ), nessun ʼworkspaceIdʼ nel body, body JSON ʼstrictʼ, ʼContent-Type: application/jsonʼ per ogni scrittura, errori ʼ{ error: { code, message, issues?, requestId } }ʼ, risorse di altri workspace e inesistenti → **404 indistinguibili**. Gli schemi di ʼ@meet-roulette/schemasʼ (ʼinterview.tsʼ) sono il contratto condiviso con il client.`

### `docs/m3/audit.md`

- Riga 49, storico: `Inventario: 206 occorrenze fuori da ʼdocs/ʼ; **185** sono lo scope ʼ@meet-roulette/*ʼ; le altre sono testo visibile (6), configurazione Worker/D1 (10), identità di sviluppo (3).`
- Riga 65, storico: `| M3-05 | Info    | Un processo ʼwrangler devʼ (PID 1258785, avviato 3 h fa dalla vecchia cartella ʼ/home/frank/meet-rouletteʼ, oggi inesistente) è rimasto in esecuzione. Non è stato toccato; può confliggere con le porte degli E2E.                                                   |`

### `docs/m3/plan.md`

- Riga 17, codice/configurazione/documentazione corrente: `| **D6** | Rename dei pacchetti ʼ@meet-roulette/*ʼ | **Non ora** ([ADR-0013](../architecture/decisions/0013-rebranding-jobward.md)). Commit meccanico isolato, a richiesta.                                                                                                                                                                                                     | Farlo in M3.0.                                                                                                               |`

### `docs/m3/report.md`

- Riga 56, storico: `La verifica host tramite ʼpsʼ e ʼssʼ ha confermato il processo preesistente **PID 1258785**, con comando ʼwrangler dev --env dev --port 8788ʼ dalla vecchia cartella ʼmeet-rouletteʼ. Il relativo ʼworkerdʼ mantiene l'inspector in ascolto su **9229**. Le porte **5199/8799** (E2E) e **8797** (anteprima) risultavano libere. Nessun processo preesistente è stato terminato; l'eventuale conflitto dell'inspector va gestito con una porta dedicata in una futura esecuzione.`

### `docs/product/vision.md`

- Riga 3, codice/configurazione/documentazione corrente: `Jobward (già «Meet Roulette») è un **workspace digitale per il candidato**: permette di organizzare e seguire il proprio percorso`

### `package.json`

- Riga 2, codice/configurazione/documentazione corrente: `"name": "meet-roulette",`
- Riga 12, codice/configurazione/documentazione corrente: `"dev": "pnpm --parallel --filter @meet-roulette/api --filter @meet-roulette/web dev",`
- Riga 13, codice/configurazione/documentazione corrente: `"dev:api": "pnpm --filter @meet-roulette/api dev",`
- Riga 14, codice/configurazione/documentazione corrente: `"dev:web": "pnpm --filter @meet-roulette/web dev",`
- Riga 15, codice/configurazione/documentazione corrente: `"build": "pnpm --filter @meet-roulette/web build && pnpm --filter @meet-roulette/api build",`
- Riga 21, codice/configurazione/documentazione corrente: `"test:e2e": "pnpm --filter @meet-roulette/web test:e2e",`
- Riga 22, codice/configurazione/documentazione corrente: `"db:generate": "pnpm --filter @meet-roulette/database generate",`
- Riga 23, codice/configurazione/documentazione corrente: `"db:migrate:local": "pnpm --filter @meet-roulette/api db:migrate:local",`
- Riga 26, codice/configurazione/documentazione corrente: `"test:preview": "pnpm --filter @meet-roulette/web test:preview",`

### `packages/database/package.json`

- Riga 2, codice/configurazione/documentazione corrente: `"name": "@meet-roulette/database",`
- Riga 16, codice/configurazione/documentazione corrente: `"@meet-roulette/shared": "workspace:*",`

### `packages/database/src/schema.ts`

- Riga 16, codice/configurazione/documentazione corrente: `} from '@meet-roulette/shared';`

### `packages/schemas/package.json`

- Riga 2, codice/configurazione/documentazione corrente: `"name": "@meet-roulette/schemas",`
- Riga 14, codice/configurazione/documentazione corrente: `"@meet-roulette/shared": "workspace:*",`

### `packages/schemas/src/board.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { BOARD_TEMPLATE_IDS, LIMITS, STAGES } from '@meet-roulette/shared';`

### `packages/schemas/src/card.ts`

- Riga 11, codice/configurazione/documentazione corrente: `} from '@meet-roulette/shared';`

### `packages/schemas/src/custom-field.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { LIMITS } from '@meet-roulette/shared';`

### `packages/schemas/src/interview.ts`

- Riga 7, codice/configurazione/documentazione corrente: `} from '@meet-roulette/shared';`

### `packages/schemas/src/label.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { LIMITS } from '@meet-roulette/shared';`

### `packages/schemas/src/opportunity.ts`

- Riga 9, codice/configurazione/documentazione corrente: `} from '@meet-roulette/shared';`

### `packages/schemas/src/primitives.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { LIMITS } from '@meet-roulette/shared';`

### `packages/schemas/src/task.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { LIMITS, PRIORITIES } from '@meet-roulette/shared';`

### `packages/schemas/src/workspace.ts`

- Riga 1, codice/configurazione/documentazione corrente: `import { LIMITS, MEMBER_ROLES } from '@meet-roulette/shared';`

### `packages/shared/package.json`

- Riga 2, codice/configurazione/documentazione corrente: `"name": "@meet-roulette/shared",`

### `pnpm-lock.yaml`

- Riga 220, codice/configurazione/documentazione corrente: `'@meet-roulette/database':`
- Riga 223, codice/configurazione/documentazione corrente: `'@meet-roulette/schemas':`
- Riga 226, codice/configurazione/documentazione corrente: `'@meet-roulette/shared':`
- Riga 275, codice/configurazione/documentazione corrente: `'@meet-roulette/schemas':`
- Riga 278, codice/configurazione/documentazione corrente: `'@meet-roulette/shared':`
- Riga 366, codice/configurazione/documentazione corrente: `'@meet-roulette/shared':`
- Riga 385, codice/configurazione/documentazione corrente: `'@meet-roulette/shared':`

### `scripts/check-migrations.mjs`

- Riga 11, codice/configurazione/documentazione corrente: `const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-migrations-'));`
- Riga 22, codice/configurazione/documentazione corrente: `spawnSync('pnpm', ['--filter', '@meet-roulette/database', 'exec', 'drizzle-kit', ...args], {`

### `scripts/test-migration-upgrade.mjs`

- Riga 12, codice/configurazione/documentazione corrente: `const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-upgrade-'));`
- Riga 29, codice/configurazione/documentazione corrente: `name: 'mr-upgrade-test',`
- Riga 34, codice/configurazione/documentazione corrente: `database_name: 'mr-upgrade',`
- Riga 47, codice/configurazione/documentazione corrente: `'@meet-roulette/api',`
