import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { LIMITS } from '@meet-roulette/shared';
import type { AppEnv } from '../env';
import { ApiError } from '../lib/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Protezione CSRF per le richieste che modificano dati.
 *
 * Con Cloudflare Access il browser invia automaticamente un cookie di sessione,
 * quindi i form di altri siti potrebbero produrre richieste "autenticate". Difese:
 *  1. Content-Type JSON obbligatorio: un form HTML non può inviarlo e una richiesta
 *     cross-origin con quel tipo richiede un preflight CORS, che non concediamo mai.
 *  2. Se presente, `Origin` deve coincidere con l'origine dell'API o con APP_ORIGIN.
 *  3. Se presente, `Sec-Fetch-Site` non può indicare un altro sito.
 */
export const csrfGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next();

  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'unsupported_media_type', 'Content-Type deve essere application/json');
  }

  const origin = c.req.header('origin');
  if (origin) {
    const allowed = new Set([new URL(c.req.url).origin]);
    if (c.env.APP_ORIGIN) allowed.add(c.env.APP_ORIGIN);
    if (!allowed.has(origin)) {
      throw new ApiError(403, 'csrf_rejected', 'Origine della richiesta non consentita');
    }
  }

  const fetchSite = c.req.header('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    // Lo schema "same-site" non basta: un altro sotto-dominio non è fidato.
    throw new ApiError(403, 'csrf_rejected', 'Richiesta cross-site non consentita');
  }

  return next();
};

/** Limite sulla dimensione dei payload. */
export const payloadLimit = bodyLimit({
  maxSize: LIMITS.requestBodyMaxBytes,
  onError: () => {
    throw new ApiError(413, 'payload_too_large', 'Il corpo della richiesta è troppo grande');
  },
});
