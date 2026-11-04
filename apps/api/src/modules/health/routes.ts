import { Hono } from 'hono';
import type { AppEnv } from '../../env';

/** Liveness pubblica: non tocca il database e non rivela configurazione. */
export const healthRoutes = new Hono<AppEnv>().get('/', (c) => c.json({ status: 'ok' }));
