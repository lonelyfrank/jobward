import { insightsResponse } from '@jobward/schemas';
import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { workspaceScope } from '../../middleware/workspace';
import { getInsights } from '../../services/insights';

export const insightsRoutes = new Hono<AppEnv>().use('*', workspaceScope).get('/', async (c) => {
  const insights = await getInsights(c.get('db'), c.get('workspaceId'), Date.now());
  return c.json(insightsResponse.parse(insights));
});
