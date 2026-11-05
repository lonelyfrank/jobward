import {
  ACTIVITY_EVENT_TYPES,
  CONTRACT_TYPES,
  LIMITS,
  OUTCOMES,
  PRIORITIES,
  SALARY_BASES,
  SALARY_PERIODS,
  STAGES,
  WORK_MODES,
} from '@meet-roulette/shared';
import { z } from 'zod';
import { boardSchema, columnSchema } from './board';
import { calendarDate, httpUrl, idSchema, optionalText, requiredText } from './primitives';

/** Testo facoltativo dei dettagli: rifilato, e la stringa vuota equivale a "nessun valore" (`null`). */
const detailText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable();

const salaryAmount = z.number().int().nonnegative().max(LIMITS.salaryAmountMax);

/** Campi professionali dell'opportunità, tutti facoltativi (`application_details`). */
const detailsShape = {
  company: detailText(LIMITS.nameMax),
  /** Titolo della posizione (colonna `application_details.position`; `position` della scheda è l'ordine). */
  jobTitle: detailText(LIMITS.nameMax),
  location: detailText(LIMITS.nameMax),
  workMode: z.enum(WORK_MODES).nullable(),
  contractType: z.enum(CONTRACT_TYPES).nullable(),
  salaryMin: salaryAmount.nullable(),
  salaryMax: salaryAmount.nullable(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, 'Usa un codice valuta ISO 4217 di tre lettere maiuscole, ad esempio EUR')
    .nullable(),
  salaryPeriod: z.enum(SALARY_PERIODS).nullable(),
  /** `null` = non specificato: mai presentato come lordo o netto. */
  salaryBasis: z.enum(SALARY_BASES).nullable(),
  source: detailText(LIMITS.nameMax),
  sourceUrl: httpUrl.nullable(),
  publishedOn: calendarDate.nullable(),
  appliedOn: calendarDate.nullable(),
  stage: z.enum(STAGES).nullable(),
  outcome: z.enum(OUTCOMES).nullable(),
};

export const DETAIL_KEYS = Object.keys(detailsShape) as (keyof typeof detailsShape)[];

type SalaryState = {
  salaryMin?: number | null | undefined;
  salaryMax?: number | null | undefined;
  currency?: string | null | undefined;
};
type SalaryIssue = { path: 'salaryMax' | 'currency'; message: string };

const rangeIssue = ({ salaryMin, salaryMax }: SalaryState): SalaryIssue[] =>
  salaryMin != null && salaryMax != null && salaryMin > salaryMax
    ? [{ path: 'salaryMax', message: 'La retribuzione minima non può superare la massima' }]
    : [];

/**
 * Coerenza della retribuzione su uno stato COMPLETO: intervallo e valuta. Il payload di una
 * patch può contenere solo una parte dei campi, quindi il servizio la applica allo stato
 * risultante (valori salvati + patch); il modulo dell'interfaccia la applica a ciò che vede.
 */
export function salaryIssues(state: SalaryState): SalaryIssue[] {
  const issues = rangeIssue(state);
  if ((state.salaryMin != null || state.salaryMax != null) && state.currency == null) {
    issues.push({ path: 'currency', message: 'Indica la valuta dell’importo' });
  }
  return issues;
}

/** Nel solo payload si può verificare soltanto l'intervallo (la valuta può essere già salvata). */
const payloadRange = (d: SalaryState, ctx: z.RefinementCtx) => {
  for (const issue of rangeIssue(d)) {
    ctx.addIssue({ code: 'custom', message: issue.message, path: [issue.path] });
  }
};

/**
 * Informazioni professionali (parziali, strict). Assente = invariato; `null` = azzera.
 * La coerenza con lo stato già salvato (es. valuta) è verificata dal servizio sullo stato risultante.
 */
export const applicationDetailsInput = z
  .object(detailsShape)
  .partial()
  .strict()
  .superRefine(payloadRange);
export type ApplicationDetailsInput = z.infer<typeof applicationDetailsInput>;

/** Alias: in M1 l'insieme ammesso era solo `{ company, sourceUrl }`, sottoinsieme di questo schema. */
export const cardDetailsInput = applicationDetailsInput;
export type CardDetailsInput = ApplicationDetailsInput;

/** Creazione rapida: soltanto il titolo (e la colonna) è obbligatorio. */
export const createCardInput = z.object({
  title: requiredText(LIMITS.titleMax),
  columnId: idSchema,
  description: optionalText(LIMITS.descriptionMax).optional(),
  priority: z.enum(PRIORITIES).default('none'),
  // In creazione il payload È lo stato completo: valgono anche le regole che nella patch
  // dipendono dai valori già salvati (l'importo richiede la valuta).
  details: applicationDetailsInput
    .superRefine((d, ctx) => {
      for (const issue of salaryIssues(d)) {
        if (issue.path === 'currency') {
          ctx.addIssue({ code: 'custom', message: issue.message, path: [issue.path] });
        }
      }
    })
    .optional(),
});
export type CreateCardInput = z.infer<typeof createCardInput>;

/**
 * Modifica parziale di una scheda (almeno un campo). La posizione si cambia solo con `move`,
 * le etichette con le loro rotte, i campi personalizzati con le loro.
 */
export const updateCardInput = z
  .object({
    title: requiredText(LIMITS.titleMax),
    description: optionalText(LIMITS.descriptionMax),
    priority: z.enum(PRIORITIES),
    ...detailsShape,
  })
  .partial()
  .strict()
  .superRefine(payloadRange)
  .refine((value) => Object.keys(value).length > 0, 'Nessuna modifica indicata');
export type UpdateCardInput = z.infer<typeof updateCardInput>;

/** Spostamento: colonna di destinazione e scheda che deve precedere (`null` = in cima). */
export const moveCardInput = z
  .object({ columnId: idSchema, afterCardId: idSchema.nullable() })
  .strict();
export type MoveCardInput = z.infer<typeof moveCardInput>;

export const cardSchema = z.object({
  id: idSchema,
  boardId: idSchema,
  columnId: idSchema,
  title: z.string(),
  description: z.string().nullable(),
  priority: z.enum(PRIORITIES),
  position: z.number().int(),
  company: z.string().nullable(),
  jobTitle: z.string().nullable(),
  location: z.string().nullable(),
  workMode: z.enum(WORK_MODES).nullable(),
  contractType: z.enum(CONTRACT_TYPES).nullable(),
  salaryMin: z.number().int().nullable(),
  salaryMax: z.number().int().nullable(),
  currency: z.string().nullable(),
  salaryPeriod: z.enum(SALARY_PERIODS).nullable(),
  salaryBasis: z.enum(SALARY_BASES).nullable(),
  source: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  publishedOn: z.string().nullable(),
  appliedOn: z.string().nullable(),
  stage: z.enum(STAGES).nullable(),
  outcome: z.enum(OUTCOMES).nullable(),
  /** Identificativi delle etichette del workspace assegnate alla scheda. */
  labelIds: z.array(idSchema),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  archivedAt: z.number().int().nullable(),
});
export type Card = z.infer<typeof cardSchema>;

export const activityEventSchema = z.object({
  id: idSchema,
  type: z.enum(ACTIVITY_EVENT_TYPES),
  occurredAt: z.number().int(),
  /** Dati strutturati minimi dell'evento (es. colonna di origine e destinazione). */
  metadata: z.record(z.string(), z.unknown()),
});
export type ActivityEvent = z.infer<typeof activityEventSchema>;

export const boardDetailResponse = z.object({
  board: boardSchema,
  columns: z.array(columnSchema),
  /** Schede attive di tutta la bacheca, ordinate per colonna e posizione. */
  cards: z.array(cardSchema),
});
export type BoardDetailResponse = z.infer<typeof boardDetailResponse>;

export const archivedCardsResponse = z.object({ cards: z.array(cardSchema) });
export const cardResponse = z.object({ card: cardSchema });
export const cardDetailResponse = z.object({
  card: cardSchema,
  history: z.array(activityEventSchema),
});
export type CardDetailResponse = z.infer<typeof cardDetailResponse>;
