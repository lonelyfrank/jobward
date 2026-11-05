import {
  CONTRACT_TYPES,
  LIMITS,
  OUTCOMES,
  PRIORITIES,
  SALARY_PERIODS,
  STAGES,
  WORK_MODES,
} from '@jobward/shared';
import { z } from 'zod';
import { cardSchema } from './card';
import { calendarDate, idSchema } from './primitives';

/**
 * Ricerca e filtri sulle opportunità (M2.3). Il contratto è `strict`: un parametro sconosciuto,
 * un valore fuori vocabolario o una combinazione incoerente sono un 400, mai ignorati in silenzio.
 *
 * Semantica (docs/m2/search-and-filtering.md): AND tra gruppi di filtri, OR tra i valori dello
 * stesso gruppo. Nei gruppi con vocabolario `none` significa "valore non indicato".
 */

/** Chiavi di ordinamento ammesse: insieme CHIUSO, mappato su espressioni SQL costanti dal server. */
export const OPPORTUNITY_SORTS = [
  'title',
  'company',
  'board',
  'column',
  'priority',
  'location',
  'workMode',
  'contractType',
  'stage',
  'outcome',
  'appliedOn',
  'updatedAt',
  'createdAt',
] as const;
export type OpportunitySort = (typeof OPPORTUNITY_SORTS)[number];

/** Ordine predefinito per chiave: le date e la priorità partono dal più recente/importante. */
export const DEFAULT_SORT_DIR: Record<OpportunitySort, 'asc' | 'desc'> = {
  title: 'asc',
  company: 'asc',
  board: 'asc',
  column: 'asc',
  priority: 'desc',
  location: 'asc',
  workMode: 'asc',
  contractType: 'asc',
  stage: 'asc',
  outcome: 'asc',
  appliedOn: 'desc',
  updatedAt: 'desc',
  createdAt: 'desc',
};

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
  boardName: z.string(),
  columnName: z.string(),
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
