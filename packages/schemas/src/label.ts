import { z } from 'zod';
import { colorToken, requiredText } from './primitives';

export const createLabelInput = z.object({
  name: requiredText(40),
  color: colorToken.default('slate'),
});
export type CreateLabelInput = z.infer<typeof createLabelInput>;
