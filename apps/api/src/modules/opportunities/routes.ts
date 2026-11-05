import { opportunitiesQuery, opportunitiesResponse } from '@meet-roulette/schemas';
import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { ApiError } from '../../lib/errors';
import { workspaceScope } from '../../middleware/workspace';
import { searchOpportunities } from '../../services/opportunities';

export const opportunityRoutes = new Hono<AppEnv>()
  .use('*', workspaceScope)

  .get('/', async (c) => {
    // `workspaceId` è già stato verificato da workspaceScope; il resto della query è il contratto.
    // I parametri vuoti (`?q=`) equivalgono ad assenti; un parametro ripetuto è un errore.
    const raw: Record<string, string> = {};
    for (const [key, values] of Object.entries(c.req.queries())) {
      if (key === 'workspaceId') continue;
      if (values.length > 1) {
        throw new ApiError(400, 'validation_error', 'Parametri non validi', [
          { path: key, message: 'Parametro ripetuto' },
        ]);
      }
      if (values[0] !== undefined && values[0] !== '') raw[key] = values[0];
    }
    const parsed = opportunitiesQuery.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError(
        400,
        'validation_error',
        'Parametri non validi',
        parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.') || '(query)',
          message: issue.message,
        })),
      );
    }
    const result = await searchOpportunities(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      parsed.data,
    );
    return c.json(opportunitiesResponse.parse(result));
  });
