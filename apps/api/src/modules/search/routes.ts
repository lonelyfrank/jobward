import { globalSearchQuery, globalSearchResponse } from '@jobward/schemas';
import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { ApiError } from '../../lib/errors';
import { workspaceScope } from '../../middleware/workspace';
import { searchWorkspace } from '../../services/global-search';

/** Aggregazione limitata: riusa Opportunità e Bacheche; nessun caricamento per singola scheda. */
export const searchRoutes = new Hono<AppEnv>().use('*', workspaceScope).get('/', async (c) => {
  const raw: Record<string, string> = {};
  for (const [key, values] of Object.entries(c.req.queries())) {
    if (key === 'workspaceId') continue;
    if (values.length !== 1) throw new ApiError(400, 'validation_error', 'Parametro ripetuto');
    raw[key] = values[0]!;
  }
  const parsed = globalSearchQuery.safeParse(raw);
  if (!parsed.success)
    throw new ApiError(400, 'validation_error', 'Usa da 1 a 100 caratteri e al massimo 6 parole.');
  const q = parsed.data.q;
  return c.json(
    globalSearchResponse.parse(
      await searchWorkspace(c.env.DB, c.get('db'), c.get('workspaceId'), q),
    ),
  );
});
