import { idSchema } from '@jobward/schemas';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';
import { ApiError } from '../lib/errors';
import { requireMembership } from '../services/workspaces';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Perimetro di workspace per i moduli di dominio.
 *
 * Ogni richiesta indica `?workspaceId=`; questo è l'UNICO punto che lo verifica (tramite
 * `requireMembership`) e lo rende disponibile ai servizi. Un workspace altrui e uno inesistente
 * danno la stessa risposta (404). I servizi non ricevono mai un workspace dal body.
 *
 * Il ruolo `viewer` (predisposto, non ancora assegnabile) può solo leggere.
 */
export const workspaceScope: MiddlewareHandler<AppEnv> = async (c, next) => {
  const parsed = idSchema.safeParse(c.req.query('workspaceId'));
  if (!parsed.success) {
    throw new ApiError(400, 'validation_error', 'Parametri non validi', [
      { path: 'workspaceId', message: 'Campo obbligatorio' },
    ]);
  }
  const { role } = await requireMembership(c.get('db'), c.get('user').id, parsed.data);
  if (role === 'viewer' && !READ_METHODS.has(c.req.method)) {
    throw new ApiError(403, 'forbidden', 'Non hai i permessi per modificare questo workspace');
  }
  c.set('workspaceId', parsed.data);
  await next();
};

/** Identificativo di risorsa dal percorso, validato come ogni altro input. */
export function idParam(c: { req: { param: (name: string) => string } }, name = 'id'): string {
  const parsed = idSchema.safeParse(c.req.param(name));
  if (!parsed.success) throw new ApiError(404, 'not_found', 'Risorsa non trovata');
  return parsed.data;
}
