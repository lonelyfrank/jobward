import { ACTIVITY_EVENT_TYPES, LIMITS } from '@jobward/shared';
import { z } from 'zod';
import { idSchema } from './primitives';

/** `GET /cards/:id/timeline?before=&limit=`: paginazione a cursore opaco, ordine totale e stabile. */
export const timelineQuery = z.object({
  before: z.string().min(1).max(200).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIMITS.timelinePageMax)
    .default(LIMITS.timelinePageDefault),
});
export type TimelineQuery = z.infer<typeof timelineQuery>;

const entity = z.object({ type: z.enum(['card', 'interview', 'note', 'document']), id: idSchema });
/** Solo valori strutturati ammessi dalla whitelist del dominio: mai testo libero di sistema. */
const safeData = z.record(z.string(), z.union([z.string(), z.number(), z.null()]));

export const timelineEntrySchema = z.discriminatedUnion('source', [
  z.object({
    id: idSchema,
    source: z.literal('system'),
    kind: z.enum(ACTIVITY_EVENT_TYPES),
    occurredAt: z.number().int(),
    entity: entity.nullable(),
    data: safeData,
  }),
  z.object({
    id: idSchema,
    source: z.literal('note'),
    kind: z.literal('note'),
    occurredAt: z.number().int(),
    entity,
    data: z.object({ body: z.string() }),
  }),
]);
export type TimelineEntryDto = z.infer<typeof timelineEntrySchema>;

export const timelineResponse = z.object({
  entries: z.array(timelineEntrySchema),
  /** `null` = fine della cronologia. */
  nextCursor: z.string().nullable(),
});
export type TimelineResponse = z.infer<typeof timelineResponse>;
