import { createWorkspaceInput } from '@jobward/schemas';
import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { parseJsonBody } from '../../lib/validate';
import { createWorkspace, listWorkspaces } from '../../services/workspaces';

export const workspaceRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const workspaces = await listWorkspaces(c.get('db'), c.get('user').id);
    return c.json({ workspaces });
  })
  .post('/', async (c) => {
    const input = await parseJsonBody(c, createWorkspaceInput);
    const workspace = await createWorkspace(c.env.DB, c.get('user'), input, Date.now());
    return c.json({ workspace }, 201);
  });
