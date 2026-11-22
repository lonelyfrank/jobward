import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { workspaceScope } from '../../middleware/workspace';
import { getOverview } from '../../services/overview';

export const overviewRoutes = new Hono<AppEnv>()
  .use('*', workspaceScope)
  .get('/', async (c) => c.json(await getOverview(c.get('db'), c.get('workspaceId'), Date.now())));
