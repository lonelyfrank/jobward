import {
  duplicatesQuery,
  duplicatesResponse,
  opportunitiesMapResponse,
  opportunityCitiesResponse,
  opportunitiesQuery,
  opportunitiesResponse,
  pipelineBoardResponse,
  type OpportunitiesQuery,
} from '@jobward/schemas';
import { Hono, type Context } from 'hono';
import type { AppEnv } from '../../env';
import { ApiError } from '../../lib/errors';
import { workspaceScope } from '../../middleware/workspace';
import { listPipelineCards } from '../../services/cards';
import { findOpportunityDuplicates } from '../../services/companies';
import {
  listOpportunityCities,
  mapOpportunities,
  searchOpportunities,
} from '../../services/opportunities';

/**
 * Query dell'elenco: `workspaceId` è già stato verificato da workspaceScope; il resto è il contratto.
 * I parametri vuoti (`?q=`) equivalgono ad assenti; un parametro ripetuto è un errore.
 */
function parseListQuery(c: Context<AppEnv>): OpportunitiesQuery {
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
  return parsed.data;
}

export const opportunityRoutes = new Hono<AppEnv>()
  .use('*', workspaceScope)

  .get('/duplicates', async (c) => {
    const { workspaceId: _ws, ...raw } = c.req.query();
    const parsed = duplicatesQuery.safeParse(
      Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== '')),
    );
    if (!parsed.success) {
      throw new ApiError(
        400,
        'validation_error',
        'Parametri non validi',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }
    const result = await findOpportunityDuplicates(c.get('db'), c.get('workspaceId'), parsed.data);
    return c.json(duplicatesResponse.parse(result));
  })

  .get('/pipeline', async (c) => {
    const cards = await listPipelineCards(c.get('db'), c.get('workspaceId'));
    return c.json(pipelineBoardResponse.parse({ cards }));
  })

  // Città usate nelle opportunità (D-07): opzioni del filtro «Città».
  .get('/cities', async (c) => {
    const result = await listOpportunityCities(c.env.DB, c.get('workspaceId'));
    return c.json(opportunityCitiesResponse.parse(result));
  })

  // Vista Mappa (D-07): stessi parametri e stessi filtri dell'elenco.
  .get('/map', async (c) => {
    const result = await mapOpportunities(c.env.DB, c.get('workspaceId'), parseListQuery(c));
    return c.json(opportunitiesMapResponse.parse(result));
  })

  .get('/', async (c) => {
    const result = await searchOpportunities(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      parseListQuery(c),
    );
    return c.json(opportunitiesResponse.parse(result));
  });
