import { LIMITS } from '@jobward/shared';
import { z } from 'zod';
import { clientIdSchema, idSchema, requiredText } from './primitives';

/** Note manuali di una candidatura (M3-C2). Il testo vive solo qui, mai nella cronologia di sistema. */
export const createNoteInput = z
  .object({ id: clientIdSchema, body: requiredText(LIMITS.noteBodyMax) })
  .strict();
export type CreateNoteInput = z.infer<typeof createNoteInput>;

export const updateNoteInput = z.object({ body: requiredText(LIMITS.noteBodyMax) }).strict();
export type UpdateNoteInput = z.infer<typeof updateNoteInput>;

export const noteSchema = z.object({
  id: idSchema,
  cardId: idSchema,
  body: z.string(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type Note = z.infer<typeof noteSchema>;
export const noteResponse = z.object({ note: noteSchema });
export const notesResponse = z.object({ notes: z.array(noteSchema) });

/** Opt-in: le chiamate C2 senza parametri conservano la risposta completa. */
export const notesQuery = z.object({
  before: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
export const notesPageResponse = notesResponse.extend({ nextCursor: z.string().nullable() });
