import type { MiddlewareHandler } from 'hono';
import type { AppEnv, DataProfile } from '../env';
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

/** Header con cui l'interfaccia sceglie il profilo dati in sviluppo locale. Ignorato con Access. */
export const PROFILE_HEADER = 'x-jobward-profile';
export const DEFAULT_DEMO_EMAIL = 'frank@demo.jobward.local';

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
 *   Con `x-jobward-profile: demo` l'identità diventa DEMO_USER_EMAIL: un utente distinto, quindi
 *   i dati dimostrativi non si mescolano mai a quelli reali (stesso isolamento tra utenti).
 */
export function authenticate(deps: AuthDeps): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const env = c.env;
    let email: string;
    let profile: DataProfile = 'real';

    if (env.AUTH_MODE === 'dev') {
      const host = new URL(c.req.url).hostname;
      if (env.ENVIRONMENT !== 'development' || !LOOPBACK_HOSTS.has(host)) throw misconfigured();
      profile = c.req.header(PROFILE_HEADER) === 'demo' ? 'demo' : 'real';
      email = (
        profile === 'demo'
          ? (env.DEMO_USER_EMAIL ?? DEFAULT_DEMO_EMAIL)
          : (env.DEV_USER_EMAIL ?? 'dev@jobward.local')
      ).toLowerCase();
      // Le due identità devono restare distinte: altrimenti il profilo demo mostrerebbe i dati reali.
      if (
        profile === 'demo' &&
        email === (env.DEV_USER_EMAIL ?? 'dev@jobward.local').toLowerCase()
      ) {
        throw misconfigured();
      }
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
    c.set('profile', profile);
    await next();
  };
}
