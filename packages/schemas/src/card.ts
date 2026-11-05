import {
  ACTIVITY_EVENT_TYPES,
  CONTRACT_TYPES,
  LIMITS,
  OUTCOMES,
  PRIORITIES,
  SALARY_PERIODS,
  STAGES,
  WORK_MODES,
} from '@meet-roulette/shared';
import { z } from 'zod';
import { boardSchema, columnSchema } from './board';
import { calendarDate, httpUrl, idSchema, optionalText, requiredText } from './primitives';

/**
 * Informazioni strutturate dell'opportunità (insieme completo, M2). Ogni campo è facoltativo:
 * la scheda deve restare creabile con il solo titolo.
 */
export const applicationDetailsInput = z
  .object({
    company: optionalText(LIMITS.nameMax),
    position: optionalText(LIMITS.nameMax),
    location: optionalText(LIMITS.nameMax),
    workMode: z.enum(WORK_MODES).nullable(),
    contractType: z.enum(CONTRACT_TYPES).nullable(),
    salaryMin: z.number().int().nonnegative().nullable(),
    salaryMax: z.number().int().nonnegative().nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, 'Usa un codice valuta ISO 4217, ad esempio EUR')
      .nullable(),
    salaryPeriod: z.enum(SALARY_PERIODS).nullable(),
    source: optionalText(LIMITS.nameMax),
    sourceUrl: httpUrl.nullable(),
    publishedOn: calendarDate.nullable(),
    appliedOn: calendarDate.nullable(),
    stage: z.enum(STAGES).nullable(),
    outcome: z.enum(OUTCOMES).nullable(),
  })
  .partial()
  .refine((d) => d.salaryMin == null || d.salaryMax == null || d.salaryMin <= d.salaryMax, {
    message: 'La retribuzione minima non può superare la massima',
    path: ['salaryMax'],
  });
export type ApplicationDetailsInput = z.infer<typeof applicationDetailsInput>;

/**
 * Sottoinsieme di `application_details` esposto da M1: azienda e URL dell'annuncio.
 * `strict`: un campo di M2 (es. `salaryMin`) viene rifiutato con un 400 esplicito invece di
 * essere ignorato in silenzio. M2 allargherà questo schema a `applicationDetailsInput`.
 */
export const cardDetailsInput = z
  .object({
    company: optionalText(LIMITS.nameMax),
    sourceUrl: httpUrl.nullable(),
  })
  .partial()
  .strict();
export type CardDetailsInput = z.infer<typeof cardDetailsInput>;

/** Creazione rapida: soltanto il titolo (e la colonna) è obbligatorio. */
export const createCardInput = z.object({
  title: requiredText(LIMITS.titleMax),
  columnId: idSchema,
  description: optionalText(LIMITS.descriptionMax).optional(),
  priority: z.enum(PRIORITIES).default('none'),
  details: cardDetailsInput.optional(),
});
export type CreateCardInput = z.infer<typeof createCardInput>;

/** Modifica parziale di una scheda (almeno un campo). La posizione si cambia solo con `move`. */
export const updateCardInput = z
  .object({
    title: requiredText(LIMITS.titleMax),
    description: optionalText(LIMITS.descriptionMax),
    priority: z.enum(PRIORITIES),
    company: optionalText(LIMITS.nameMax),
    sourceUrl: httpUrl.nullable(),
  })
  .partial()
  .strict()
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
  sourceUrl: z.string().nullable(),
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
