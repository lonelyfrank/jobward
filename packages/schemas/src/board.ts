import { LIMITS, STAGES } from '@meet-roulette/shared';
import { z } from 'zod';
import { colorToken, idSchema, optionalText, requiredText } from './primitives';

export const createBoardInput = z.object({
  name: requiredText(LIMITS.nameMax),
  description: optionalText(LIMITS.shortTextMax).default(null),
  icon: z.string().trim().max(40).nullable().default(null),
  color: colorToken.nullable().default(null),
});
export type CreateBoardInput = z.infer<typeof createBoardInput>;

export const createColumnInput = z.object({
  name: requiredText(LIMITS.nameMax),
  color: colorToken.nullable().default(null),
  category: z.enum(STAGES).nullable().default(null),
});
export type CreateColumnInput = z.infer<typeof createColumnInput>;

export const boardSummarySchema = z.object({
  id: idSchema,
  name: z.string(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  updatedAt: z.number().int(),
});
export type BoardSummary = z.infer<typeof boardSummarySchema>;
