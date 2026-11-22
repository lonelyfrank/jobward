import {
  CONTRACT_TYPES,
  OUTCOMES,
  SALARY_BASES,
  SALARY_PERIODS,
  STAGES,
  WORK_MODES,
} from '@jobward/shared';
import { z } from 'zod';
import { cardSchema } from './card';
import { calendarDate, idSchema } from './primitives';

/** Dati dell'opportunità fotografati all'invio della candidatura (immutabili). */
export const applicationSnapshotSchema = z.object({
  version: z.number().int().positive(),
  title: z.string(),
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
  createdAt: z.number().int(),
});
export type ApplicationSnapshot = z.infer<typeof applicationSnapshotSchema>;

export const applicationSchema = z.object({
  id: idSchema,
  opportunityId: idSchema,
  sequence: z.number().int().positive(),
  stage: z.enum(STAGES).nullable(),
  outcome: z.enum(OUTCOMES).nullable(),
  appliedOn: z.string().nullable(),
  channel: z.string().nullable(),
  /** `true` per la candidatura con sequenza più alta (quella che determina lo stato dell'opportunità). */
  current: z.boolean(),
  snapshot: applicationSnapshotSchema.nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type Application = z.infer<typeof applicationSchema>;

export const applicationsResponse = z.object({ applications: z.array(applicationSchema) });
export type ApplicationsResponse = z.infer<typeof applicationsResponse>;

const channelText = z
  .string()
  .trim()
  .max(120)
  .transform((value) => (value === '' ? null : value))
  .nullable();

/**
 * Nuova candidatura per un'opportunità (anche una ricandidatura dopo una chiusura). `id` è generato dal
 * client: un retry con lo stesso id e lo stesso contenuto restituisce la candidatura già creata.
 */
export const createApplicationInput = z
  .object({
    id: idSchema,
    stage: z.enum(['preparing', 'applied']).default('applied'),
    appliedOn: calendarDate.nullable().optional(),
    channel: channelText.optional(),
  })
  .strict();
export type CreateApplicationInput = z.infer<typeof createApplicationInput>;

/** Correzione dei dati d'invio della candidatura (lo stato si cambia solo con la pipeline). */
export const updateApplicationInput = z
  .object({ appliedOn: calendarDate.nullable(), channel: channelText })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nessuna modifica indicata');
export type UpdateApplicationInput = z.infer<typeof updateApplicationInput>;

export const applicationMutationResponse = z.object({
  application: applicationSchema,
  card: cardSchema,
  replayed: z.boolean(),
});
export type ApplicationMutationResponse = z.infer<typeof applicationMutationResponse>;
