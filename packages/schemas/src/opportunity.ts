import {
  CONTRACT_TYPES,
  LIMITS,
  OUTCOMES,
  PRIORITIES,
  QUERY_SORT_DEFAULT_DIR,
  QUERY_SORT_KEYS,
  SALARY_PERIODS,
  STAGES,
  WORK_MODES,
  type QuerySortKey,
} from '@jobward/shared';
import { z } from 'zod';
import { cardSchema } from './card';
import { calendarDate, idSchema } from './primitives';
import { smartQueryJson } from './smart-query';

/**
 * Ricerca e filtri sulle opportunità (M2.3). Il contratto è `strict`: un parametro sconosciuto,
 * un valore fuori vocabolario o una combinazione incoerente sono un 400, mai ignorati in silenzio.
 *
 * Semantica (docs/features/OPPORTUNITIES.md): AND tra gruppi di filtri, OR tra i valori dello
 * stesso gruppo. Nei gruppi con vocabolario `none` significa "valore non indicato". Dal M5-SW.3 i
 * filtri a parametri semplici sono tradotti in una query v2 (`legacyFiltersToQuery`) e compilati
 * insieme al parametro facoltativo `where`.
 */

/**
 * Chiavi di ordinamento ammesse: insieme CHIUSO, mappato su espressioni SQL costanti dal server.
 * Sono quelle del motore di query v2 (un'unica definizione).
 */
export const OPPORTUNITY_SORTS = QUERY_SORT_KEYS;
export type OpportunitySort = QuerySortKey;

/** Ordine predefinito per chiave: le date e la priorità partono dal più recente/importante. */
export const DEFAULT_SORT_DIR: Record<OpportunitySort, 'asc' | 'desc'> = QUERY_SORT_DEFAULT_DIR;

/** Elenco separato da virgole → array validato (senza voci vuote né duplicati). */
const list = <T extends z.ZodType<string, string>>(item: T, max: number) =>
  z
    .string()
    .transform((value) => [...new Set(value.split(',').filter((part) => part !== ''))])
    .pipe(z.array(item).min(1).max(max));

const withNone = <T extends readonly [string, ...string[]]>(values: T) =>
  list(z.enum([...values, 'none']), values.length + 1);

const integer = (max: number) =>
  z
    .string()
    .regex(/^\d{1,10}$/, 'Numero intero non valido')
    .transform(Number)
    .pipe(z.number().int().min(0).max(max));

export const opportunitiesQuery = z
  .object({
    q: z.string().trim().max(LIMITS.searchTextMax).optional(),
    boardId: idSchema.optional(),
    columnId: idSchema.optional(),
    priority: list(z.enum(PRIORITIES), PRIORITIES.length).optional(),
    stage: withNone(STAGES).optional(),
    outcome: withNone(OUTCOMES).optional(),
    workMode: withNone(WORK_MODES).optional(),
    contractType: withNone(CONTRACT_TYPES).optional(),
    labelId: list(idSchema, LIMITS.labelsPerCardMax).optional(),
    appliedFrom: calendarDate.optional(),
    appliedTo: calendarDate.optional(),
    salaryMin: integer(LIMITS.salaryAmountMax).optional(),
    salaryMax: integer(LIMITS.salaryAmountMax).optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, 'Usa un codice valuta ISO 4217, ad esempio EUR')
      .optional(),
    salaryPeriod: z.enum(SALARY_PERIODS).optional(),
    /**
     * Query v2 (JSON) in AND con i filtri precedenti: stessa definizione usata dal Kanban, ma
     * valutata dal server. Vedi `smartQuerySchema` per le regole.
     */
    where: smartQueryJson.optional(),
    /** Opportunity Center: `inbox` = senza candidature, `applications` = con almeno una candidatura. */
    scope: z.enum(['all', 'inbox', 'applications']).default('all'),
    archived: z.enum(['exclude', 'include', 'only']).default('exclude'),
    sort: z.enum(OPPORTUNITY_SORTS).default('updatedAt'),
    dir: z.enum(['asc', 'desc']).optional(),
    page: integer(100_000).pipe(z.number().min(1)).default(1),
    pageSize: integer(LIMITS.pageSizeMax).pipe(z.number().min(1)).default(LIMITS.pageSizeDefault),
  })
  .strict()
  .superRefine((query, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (query.q && query.q.split(/\s+/).filter(Boolean).length > LIMITS.searchTermsMax) {
      issue('q', `Usa al massimo ${LIMITS.searchTermsMax} parole`);
    }
    if (query.appliedFrom && query.appliedTo && query.appliedFrom > query.appliedTo) {
      issue('appliedTo', 'La data finale precede quella iniziale');
    }
    // Un intervallo retributivo ha senso solo tra importi omogenei: valuta e periodo sono obbligatori.
    if (query.salaryMin !== undefined || query.salaryMax !== undefined) {
      if (!query.currency) issue('currency', 'Indica la valuta per filtrare per retribuzione');
      if (!query.salaryPeriod)
        issue('salaryPeriod', 'Indica la periodicità per filtrare per retribuzione');
    }
    if (
      query.salaryMin !== undefined &&
      query.salaryMax !== undefined &&
      query.salaryMin > query.salaryMax
    ) {
      issue('salaryMax', 'La retribuzione minima non può superare la massima');
    }
  });
export type OpportunitiesQuery = z.infer<typeof opportunitiesQuery>;

/** Una riga della ricerca: la scheda completa più i nomi di bacheca e colonna. */
export const opportunitySchema = cardSchema.extend({
  /** `null` per un'opportunità senza bacheca. */
  boardName: z.string().nullable(),
  columnName: z.string().nullable(),
});
export type Opportunity = z.infer<typeof opportunitySchema>;

export const opportunitiesResponse = z.object({
  items: z.array(opportunitySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  pageCount: z.number().int().nonnegative(),
});
export type OpportunitiesResponse = z.infer<typeof opportunitiesResponse>;

/** Bacheca canonica: tutte le opportunità attive, raggruppate dal client per stato della candidatura. */
export const pipelineBoardResponse = z.object({
  cards: z.array(cardSchema.extend({ boardName: z.string().nullable() })),
});
export type PipelineBoardResponse = z.infer<typeof pipelineBoardResponse>;
