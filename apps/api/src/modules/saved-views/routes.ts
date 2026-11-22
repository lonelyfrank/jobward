import {
  createSavedViewInput,
  savedViewResponse,
  savedViewsResponse,
  updateSavedViewInput,
} from '@jobward/schemas';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../env';
import { parseJsonBody } from '../../lib/validate';
import { idParam, workspaceScope } from '../../middleware/workspace';
import {
  createSavedView,
  deleteSavedView,
  listSavedViews,
  updateSavedView,
} from '../../services/saved-views';

export const savedViewRoutes = new Hono<AppEnv>()
  .use('*', workspaceScope)
  .get('/', async (c) => {
    const views = await listSavedViews(c.get('db'), c.get('workspaceId'));
    return c.json(savedViewsResponse.parse({ views }));
  })
  .post('/', async (c) => {
    const input = await parseJsonBody(c, createSavedViewInput);
    const view = await createSavedView(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      input,
      Date.now(),
    );
    return c.json(savedViewResponse.parse({ view }), 201);
  })
  .patch('/:id', async (c) => {
    const input = await parseJsonBody(c, updateSavedViewInput);
    const view = await updateSavedView(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      idParam(c),
      input,
      Date.now(),
    );
    return c.json(savedViewResponse.parse({ view }));
  })
  .delete('/:id', async (c) => {
    await parseJsonBody(c, z.object({}).strict());
    await deleteSavedView(c.env.DB, c.get('db'), c.get('workspaceId'), idParam(c));
    return c.body(null, 204);
  });
