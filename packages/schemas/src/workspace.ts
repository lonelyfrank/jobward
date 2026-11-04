import { LIMITS, MEMBER_ROLES } from '@meet-roulette/shared';
import { z } from 'zod';
import { idSchema, requiredText, timezoneSchema } from './primitives';

export const createWorkspaceInput = z.object({
  name: requiredText(LIMITS.nameMax),
  timezone: timezoneSchema.default('UTC'),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInput>;

export const workspaceSchema = z.object({
  id: idSchema,
  name: z.string(),
  timezone: z.string(),
  role: z.enum(MEMBER_ROLES),
  createdAt: z.number().int(),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const userSchema = z.object({
  id: idSchema,
  email: z.string(),
});
export type User = z.infer<typeof userSchema>;

export const meResponse = z.object({
  user: userSchema,
  workspaces: z.array(workspaceSchema),
});
export type MeResponse = z.infer<typeof meResponse>;

export const workspaceResponse = z.object({ workspace: workspaceSchema });
