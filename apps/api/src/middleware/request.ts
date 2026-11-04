import type { MiddlewareHandler } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv } from '../env';

/** Assegna un id di correlazione e lo restituisce nell'header `x-request-id`. */
export const requestId: MiddlewareHandler<AppEnv> = async (c, next) => {
  const id = crypto.randomUUID();
  c.set('requestId', id);
  c.header('x-request-id', id);
  await next();
};

/**
 * Log strutturato di ogni richiesta. Contiene SOLO metodo, percorso (senza query
 * string), status e durata: mai header, cookie, token o body.
 */
export const requestLogger: MiddlewareHandler<AppEnv> = async (c, next) => {
  const start = Date.now();
  await next();
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'request',
      requestId: c.get('requestId'),
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      ms: Date.now() - start,
    }),
  );
};

/** Header di sicurezza e nessuna cache per risposte contenenti dati privati. */
export const apiSecurityHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await secureHeaders({
    contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    crossOriginResourcePolicy: 'same-origin',
    referrerPolicy: 'no-referrer',
  })(c, async () => {
    await next();
  });
  c.header('Cache-Control', 'no-store');
};
