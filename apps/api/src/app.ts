import { createDb } from '@meet-roulette/database';
import { Hono } from 'hono';
import type { AppEnv } from './env';
import { authenticate, defaultAuthDeps, type AuthDeps } from './middleware/auth';
import { onError, onNotFound } from './middleware/errors';
import { csrfGuard, payloadLimit } from './middleware/guards';
import { apiSecurityHeaders, requestId, requestLogger } from './middleware/request';
import { boardRoutes } from './modules/boards/routes';
import { cardRoutes } from './modules/cards/routes';
import { columnRoutes } from './modules/columns/routes';
import { customFieldRoutes } from './modules/custom-fields/routes';
import { healthRoutes } from './modules/health/routes';
import { interviewRoutes } from './modules/interviews/routes';
import { labelRoutes } from './modules/labels/routes';
import { meRoutes } from './modules/me/routes';
import { opportunityRoutes } from './modules/opportunities/routes';
import { overviewRoutes } from './modules/overview/routes';
import { workspaceRoutes } from './modules/workspaces/routes';

/**
 * Composizione dell'applicazione. Le dipendenze esterne (es. chiavi di verifica di
 * Cloudflare Access) sono iniettabili per poter testare l'intero stack senza rete.
 */
export function createApp(deps: AuthDeps = defaultAuthDeps) {
  const app = new Hono<AppEnv>();

  app.use('*', requestId, requestLogger, apiSecurityHeaders);
  app.onError(onError);
  app.notFound(onNotFound);

  app.route('/api/health', healthRoutes);

  // Tutto ciò che sta sotto /api/v1 richiede autenticazione.
  const v1 = new Hono<AppEnv>();
  v1.use('*', csrfGuard, payloadLimit, async (c, next) => {
    c.set('db', createDb(c.env.DB));
    await next();
  });
  v1.use('*', authenticate(deps));
  v1.route('/me', meRoutes);
  v1.route('/workspaces', workspaceRoutes);
  v1.route('/overview', overviewRoutes);
  v1.route('/opportunities', opportunityRoutes);
  v1.route('/boards', boardRoutes);
  v1.route('/columns', columnRoutes);
  v1.route('/cards', cardRoutes);
  v1.route('/labels', labelRoutes);
  v1.route('/interviews', interviewRoutes);
  v1.route('/custom-fields', customFieldRoutes);
  app.route('/api/v1', v1);

  return app;
}
