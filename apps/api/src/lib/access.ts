import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/**
 * Verifica dei JWT emessi da Cloudflare Access.
 *
 * Il Worker NON si fida mai dell'header "email" o di cookie: valida firma,
 * emittente e audience del token `Cf-Access-Jwt-Assertion` con le chiavi
 * pubbliche del team.
 */

export type KeyResolver = (teamDomain: string) => JWTVerifyGetKey;

const TEAM_DOMAIN = /^[a-z0-9-]+\.cloudflareaccess\.com$/;
const remoteKeys = new Map<string, JWTVerifyGetKey>();

/** Risolutore di produzione: JWKS remoto, in cache per la vita dell'isolate. */
export const remoteKeyResolver: KeyResolver = (teamDomain) => {
  let keys = remoteKeys.get(teamDomain);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    remoteKeys.set(teamDomain, keys);
  }
  return keys;
};

export function isValidTeamDomain(value: string): boolean {
  return TEAM_DOMAIN.test(value);
}

export async function verifyAccessJwt(
  token: string,
  options: { teamDomain: string; audience: string },
  keys: JWTVerifyGetKey,
): Promise<{ email: string }> {
  const { payload } = await jwtVerify(token, keys, {
    issuer: `https://${options.teamDomain}`,
    audience: options.audience,
    algorithms: ['RS256'],
  });
  const email = payload['email'];
  if (typeof email !== 'string' || email.length === 0) {
    throw new Error('Il token non contiene un indirizzo email');
  }
  return { email: email.toLowerCase() };
}
