import { calendarQuery, calendarResponse } from '@jobward/schemas';
import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { ApiError } from '../../lib/errors';
import { workspaceScope } from '../../middleware/workspace';
import { getCalendar } from '../../services/calendar';

export const calendarRoutes = new Hono<AppEnv>().use('*', workspaceScope).get('/', async (c) => {
  // `workspaceId` è già verificato da workspaceScope: il resto della query è il contratto.
  const { workspaceId: _ws, ...raw } = c.req.query();
  const parsed = calendarQuery.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(
      400,
      'validation_error',
      'Parametri non validi',
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  const query = parsed.data;
  return c.json(
    calendarResponse.parse(await getCalendar(c.get('db'), c.get('workspaceId'), query)),
  );
});
