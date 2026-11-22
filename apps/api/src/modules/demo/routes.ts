import { workspaceResponse } from '@jobward/schemas';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../env';
import { notFound } from '../../lib/errors';
import { parseJsonBody } from '../../lib/validate';
import { resetDemoWorkspace } from '../../services/demo';

/**
 * Profilo dimostrativo (solo sviluppo locale). `POST /demo/reset` cancella e rigenera i dati
 * dell'identità demo. Con il profilo reale, o fuori da `AUTH_MODE=dev`, la rotta non esiste (404):
 * nessuna richiesta può toccare i dati reali da qui.
 */
export const demoRoutes = new Hono<AppEnv>().post('/reset', async (c) => {
  if (c.env.AUTH_MODE !== 'dev' || c.get('profile') !== 'demo') throw notFound();
  await parseJsonBody(c, z.object({}).strict());
  const workspace = await resetDemoWorkspace(c.env.DB, c.get('db'), c.get('user'), Date.now());
  return c.json(workspaceResponse.parse({ workspace }), 201);
});
