import { LIMITS } from '@jobward/shared';
import { z } from 'zod';
import { colorToken, idSchema, requiredText } from './primitives';

/** Il colore è sempre un token semantico del design system, mai un valore CSS dell'utente. */
export const createLabelInput = z
  .object({
    name: requiredText(LIMITS.labelNameMax),
    color: colorToken.default('slate'),
  })
  .strict();
export type CreateLabelInput = z.infer<typeof createLabelInput>;

export const updateLabelInput = z
  .object({ name: requiredText(LIMITS.labelNameMax), color: colorToken })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nessuna modifica indicata');
export type UpdateLabelInput = z.infer<typeof updateLabelInput>;

/** Eliminare un'etichetta in uso richiede `force`: rimuove l'assegnazione dalle schede, mai le schede. */
export const deleteLabelInput = z.object({ force: z.boolean().default(false) }).strict();
export type DeleteLabelInput = z.infer<typeof deleteLabelInput>;

export const assignLabelInput = z.object({ labelId: idSchema }).strict();
export type AssignLabelInput = z.infer<typeof assignLabelInput>;

export const labelSchema = z.object({
  id: idSchema,
  name: z.string(),
  color: colorToken,
  /** Schede (anche archiviate) a cui l'etichetta è assegnata. */
  cardCount: z.number().int().nonnegative(),
  createdAt: z.number().int(),
});
export type Label = z.infer<typeof labelSchema>;

export const labelsResponse = z.object({ labels: z.array(labelSchema) });
export const labelResponse = z.object({ label: labelSchema });
export const cardLabelsResponse = z.object({ labelIds: z.array(idSchema) });
