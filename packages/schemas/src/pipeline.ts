import {
  CLOSED_PIPELINE_STATUSES,
  OPEN_PIPELINE_STATUSES,
  PIPELINE_STATUSES,
} from '@jobward/shared';
import { z } from 'zod';
import { cardSchema } from './card';
import { calendarDate, clientIdSchema, idSchema } from './primitives';

/** Stati ai quali una transizione può portare: l'archivio ha il proprio flusso (archivia/ripristina). */
const TARGET_STATUSES = [...OPEN_PIPELINE_STATUSES, ...CLOSED_PIPELINE_STATUSES] as const;
export const pipelineStatusSchema = z.enum(PIPELINE_STATUSES);
export const pipelineKindSchema = z.enum(['advance', 'close', 'reopen', 'correction']);

/**
 * `POST /cards/:id/pipeline`. `id` identifica la singola transizione e i suoi retry (D5): un nuovo ID
 * solo per una nuova operazione intenzionale. `expectedFrom` è il controllo ottimistico.
 * `futureInterviews` vale solo chiudendo: predefinito «keep» (mai annullamento silenzioso).
 */
export const pipelineTransitionInput = z
  .object({
    id: clientIdSchema,
    to: z.enum(TARGET_STATUSES),
    kind: pipelineKindSchema,
    expectedFrom: pipelineStatusSchema.optional(),
    /** Data di invio da registrare passando a «Inviata» se la candidatura non ne ha una. */
    appliedOn: calendarDate.optional(),
    futureInterviews: z.enum(['keep', 'cancel']).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.futureInterviews !== 'cancel' ||
      (CLOSED_PIPELINE_STATUSES as readonly string[]).includes(v.to),
    { path: ['futureInterviews'], message: 'Annullare i colloqui futuri vale solo chiudendo' },
  )
  .refine((v) => v.appliedOn === undefined || v.to === 'applied', {
    path: ['appliedOn'],
    message: 'La data di invio vale solo passando a «Inviata»',
  });
export type PipelineTransitionInput = z.infer<typeof pipelineTransitionInput>;

export const pipelineWarningSchema = z.object({
  code: z.string(),
  interviewId: idSchema.optional(),
  suggestedStatus: z.literal('interviewing').optional(),
});

export const pipelineTransitionResponse = z.object({
  card: cardSchema,
  transition: z.object({
    id: z.string(),
    kind: pipelineKindSchema,
    from: pipelineStatusSchema,
    to: pipelineStatusSchema,
  }),
  /** `true` = replay della stessa operazione: nessun cambiamento e nessun nuovo evento. */
  replayed: z.boolean(),
  /** Colloqui futuri annullati da questa operazione (0 se «keep» o non applicabile). */
  cancelledInterviews: z.number().int().nonnegative(),
  warnings: z.array(pipelineWarningSchema),
});
export type PipelineTransitionResponse = z.infer<typeof pipelineTransitionResponse>;
