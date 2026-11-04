import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';
import {
  isValidTeamDomain,
  remoteKeyResolver,
  verifyAccessJwt,
  type KeyResolver,
} from '../lib/access';
import { ApiError } from '../lib/errors';
import { ensureUser } from '../services/users';

export interface AuthDeps {
  /** Sostituibile nei test per usare chiavi locali al posto del JWKS remoto. */
  accessKeys: KeyResolver;
}

export const defaultAuthDeps: AuthDeps = { accessKeys: remoteKeyResolver };

/** Hostname che identificano una macchina locale (mai raggiungibili da Internet). */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const misconfigured = () =>
  new ApiError(500, 'auth_misconfigured', 'Configurazione di autenticazione non valida');

/**
 * Autenticazione. Politica "fail closed": qualunque configurazione mancante o
 * incoerente produce un errore, mai un accesso.
 *
 * - `access`: JWT di Cloudflare Access verificato; solo OWNER_EMAIL è ammesso.
 * - `dev`: identità locale fittizia, ammessa ESCLUSIVAMENTE con ENVIRONMENT=development
 *   E su un hostname di loopback. La seconda condizione è una difesa in profondità: se
 *   per errore la configurazione "dev" venisse pubblicata (`wrangler deploy --env dev`),
 *   l'hostname pubblico la renderebbe comunque inutilizzabile invece di aprire l'accesso.
 */
export function authenticate(deps: AuthDeps): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const env = c.env;
    let email: string;

    if (env.AUTH_MODE === 'dev') {
      const host = new URL(c.req.url).hostname;
      if (env.ENVIRONMENT !== 'development' || !LOOPBACK_HOSTS.has(host)) throw misconfigured();
      email = (env.DEV_USER_EMAIL ?? 'dev@meet-roulette.local').toLowerCase();
    } else if (env.AUTH_MODE === 'access') {
      const { ACCESS_TEAM_DOMAIN: teamDomain, ACCESS_AUD: audience } = env;
      // Le variabili possono essere assenti (undefined) oppure vuote/spazi: stessa risposta.
      const owner = env.OWNER_EMAIL?.trim().toLowerCase();
      if (!teamDomain || !audience || !owner || !isValidTeamDomain(teamDomain)) {
        throw misconfigured();
      }

      const token = c.req.header('cf-access-jwt-assertion');
      if (!token) throw new ApiError(401, 'unauthenticated', 'Autenticazione richiesta');

      try {
        ({ email } = await verifyAccessJwt(
          token,
          { teamDomain, audience },
          deps.accessKeys(teamDomain),
        ));
      } catch {
        // Nessun dettaglio sul motivo: non aiutare chi prova token falsi.
        throw new ApiError(401, 'unauthenticated', 'Autenticazione richiesta');
      }

      if (email !== owner) {
        throw new ApiError(403, 'forbidden', 'Questo account non è autorizzato');
      }
    } else {
      throw misconfigured();
    }

    const user = await ensureUser(c.get('db'), email, Date.now());
    c.set('user', user);
    await next();
  };
}
