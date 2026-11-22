import { z } from 'zod';
import { idSchema } from './primitives';

export const savedViewSchema = z.object({
  id: idSchema,
  name: z.string(),
  scope: z.literal('opportunities'),
  /** Stato dell'Opportunity Center come query string (senza «?»). */
  params: z.string(),
  position: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type SavedView = z.infer<typeof savedViewSchema>;

/** Query string ammessa: niente «?» iniziale, solo caratteri di una query, al massimo 2000. */
const params = z
  .string()
  .trim()
  .max(2000)
  .regex(/^[^?#\s]*$/, 'Parametri della vista non validi');

export const createSavedViewInput = z
  .object({ name: z.string().trim().min(1).max(60), params })
  .strict();
export type CreateSavedViewInput = z.infer<typeof createSavedViewInput>;

export const updateSavedViewInput = z
  .object({ name: z.string().trim().min(1).max(60), params })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nessuna modifica indicata');
export type UpdateSavedViewInput = z.infer<typeof updateSavedViewInput>;

export const savedViewsResponse = z.object({ views: z.array(savedViewSchema) });
export const savedViewResponse = z.object({ view: savedViewSchema });
