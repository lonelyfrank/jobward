import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { listWorkspaces } from '../../services/workspaces';

export const meRoutes = new Hono<AppEnv>().get('/', async (c) => {
  const user = c.get('user');
  const workspaces = await listWorkspaces(c.get('db'), user.id);
  return c.json({ user: { id: user.id, email: user.email }, workspaces });
});
