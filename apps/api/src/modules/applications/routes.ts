import { applicationMutationResponse, updateApplicationInput } from '@jobward/schemas';
import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { parseJsonBody } from '../../lib/validate';
import { idParam, workspaceScope } from '../../middleware/workspace';
import { updateApplication } from '../../services/applications';

export const applicationRoutes = new Hono<AppEnv>()
  .use('*', workspaceScope)

  .patch('/:id', async (c) => {
    const input = await parseJsonBody(c, updateApplicationInput);
    const result = await updateApplication(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      idParam(c),
      input,
      Date.now(),
    );
    return c.json(applicationMutationResponse.parse(result));
  });
