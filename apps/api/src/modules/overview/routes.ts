import { idSchema } from '@meet-roulette/schemas';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../env';
import { parseQuery } from '../../lib/validate';
import { getOverview } from '../../services/overview';
import { requireMembership } from '../../services/workspaces';

const query = z.object({ workspaceId: idSchema });

export const overviewRoutes = new Hono<AppEnv>().get('/', async (c) => {
  const { workspaceId } = parseQuery(c, query);
  const db = c.get('db');
  await requireMembership(db, c.get('user').id, workspaceId);
  return c.json(await getOverview(db, workspaceId, Date.now()));
});
