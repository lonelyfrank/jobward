import {
  CONTRACT_TYPES,
  LIMITS,
  OUTCOMES,
  PRIORITIES,
  SALARY_PERIODS,
  STAGES,
  WORK_MODES,
} from '@meet-roulette/shared';
import { z } from 'zod';
import { calendarDate, httpUrl, idSchema, optionalText, requiredText } from './primitives';

/**
 * Informazioni strutturate dell'opportunità. Ogni campo è facoltativo: la scheda
 * deve restare creabile con il solo titolo.
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

/** Creazione rapida: soltanto il titolo è obbligatorio. */
export const createCardInput = z.object({
  title: requiredText(LIMITS.titleMax),
  columnId: idSchema,
  description: optionalText(LIMITS.descriptionMax).optional(),
  priority: z.enum(PRIORITIES).default('none'),
  details: applicationDetailsInput.optional(),
});
export type CreateCardInput = z.infer<typeof createCardInput>;
