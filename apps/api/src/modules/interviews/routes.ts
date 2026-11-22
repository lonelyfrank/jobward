import {
  cancelInterviewInput,
  completeInterviewInput,
  interviewResponse,
  updateInterviewInput,
} from '@jobward/schemas';
import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { parseJsonBody } from '../../lib/validate';
import { idParam, workspaceScope } from '../../middleware/workspace';
import { cancelInterview, completeInterview, updateInterview } from '../../services/interviews';

/** Rotte per ID di un colloquio. Elenco e creazione stanno sotto `/cards/:id/interviews`. */
export const interviewRoutes = new Hono<AppEnv>()
  .use('*', workspaceScope)

  .patch('/:id', async (c) => {
    const input = await parseJsonBody(c, updateInterviewInput);
    const interview = await updateInterview(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      c.get('user').id,
      idParam(c),
      input,
      Date.now(),
    );
    return c.json(interviewResponse.parse({ interview }));
  })

  .post('/:id/complete', async (c) => {
    const input = await parseJsonBody(c, completeInterviewInput);
    const interview = await completeInterview(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      c.get('user').id,
      idParam(c),
      input,
      Date.now(),
    );
    return c.json(interviewResponse.parse({ interview }));
  })

  .post('/:id/cancel', async (c) => {
    await parseJsonBody(c, cancelInterviewInput);
    const interview = await cancelInterview(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      c.get('user').id,
      idParam(c),
      Date.now(),
    );
    return c.json(interviewResponse.parse({ interview }));
  });
