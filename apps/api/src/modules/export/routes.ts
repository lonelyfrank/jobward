import { workspaceExport } from '@jobward/schemas';
import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { workspaceScope } from '../../middleware/workspace';
import { exportWorkspace } from '../../services/export';

export const exportRoutes = new Hono<AppEnv>().use('*', workspaceScope).get('/', async (c) => {
  const data = await exportWorkspace(c.env.DB, c.get('db'), c.get('workspaceId'), Date.now());
  const day = new Date(data.exportedAt).toISOString().slice(0, 10);
  c.header('Content-Disposition', `attachment; filename="jobward-export-${day}.json"`);
  return c.json(workspaceExport.parse(data));
});
