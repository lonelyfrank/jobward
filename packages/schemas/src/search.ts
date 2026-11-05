import { z } from 'zod';
import { LIMITS } from '@jobward/shared';
import { idSchema } from './primitives';

/** Proiezioni di ricerca, senza nuovi modelli di dominio. */
export const globalSearchQuery = z
  .object({
    q: z
      .string()
      .trim()
      .min(1)
      .max(LIMITS.searchTextMax)
      .refine(
        (text) => text.split(/\s+/).length <= LIMITS.searchTermsMax,
        `Usa al massimo ${LIMITS.searchTermsMax} parole`,
      ),
  })
  .strict();

const result = z.object({ id: idSchema, title: z.string(), subtitle: z.string() });
export const globalSearchResponse = z.object({
  opportunities: z.array(result.extend({ boardId: idSchema, archived: z.boolean() })).max(10),
  boards: z.array(result).max(10),
  interviews: z.array(result.extend({ boardId: idSchema, cardId: idSchema })).max(10),
});
export type GlobalSearchResponse = z.infer<typeof globalSearchResponse>;
