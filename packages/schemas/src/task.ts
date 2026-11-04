import { LIMITS, PRIORITIES } from '@meet-roulette/shared';
import { z } from 'zod';
import { idSchema, instant, optionalText, requiredText } from './primitives';

/** Attività collegata a una scheda oppure, se `cardId` è assente, al workspace. */
export const createTaskInput = z.object({
  title: requiredText(LIMITS.titleMax),
  description: optionalText(LIMITS.descriptionMax).optional(),
  /** Scadenza come istante assoluto: viene mostrata nel fuso orario del workspace. */
  dueAt: instant.nullable().optional(),
  priority: z.enum(PRIORITIES).default('none'),
  cardId: idSchema.nullable().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskInput>;
