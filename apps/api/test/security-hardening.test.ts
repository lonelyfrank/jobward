import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { accessEnv, AUD, call, createAccessSigner, devEnv, OWNER } from './helpers';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const b64 = (o: object) =>
  btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

describe('tutte le rotte private sono protette (enumerazione automatica)', () => {
  const app = createApp();

  it('ogni rotta registrata sotto /api/v1 risponde 401 senza credenziali, con ogni metodo', async () => {
    const routes = app.routes.filter((r) => r.path.startsWith('/api/v1') && r.method !== 'ALL');
    expect(routes.length).toBeGreaterThanOrEqual(4); // me, workspaces (GET/POST), overview
    const env = accessEnv();
    for (const route of routes) {
      const path = route.path.replace(/:[A-Za-z]+/g, 'x');
      const res = await call(app, env, path, {
        method: route.method,
        json: route.method === 'GET' ? undefined : {},
      });
      expect(res.status, `${route.method} ${route.path}`).toBe(401);
    }
  });

  it('il middleware di autenticazione copre anche percorsi non registrati sotto /api/v1', async () => {
    const res = await call(app, accessEnv(), '/api/v1/qualunque/cosa');
    expect(res.status).toBe(401); // non 404: non si rivela quali rotte esistono
  });

  it('le uniche rotte pubbliche sono quelle dichiarate', () => {
    const publicRoutes = app.routes
      .filter((r) => !r.path.startsWith('/api/v1') && r.method !== 'ALL')
      .map((r) => `${r.method} ${r.path}`);
    expect(publicRoutes).toEqual(['GET /api/health']);
  });
});

describe('Cloudflare Access: algoritmo, hostname e configurazione', () => {
  let signer: Awaited<ReturnType<typeof createAccessSigner>>;
  let app: ReturnType<typeof createApp>;
  beforeAll(async () => {
    signer = await createAccessSigner();
    app = createApp({ accessKeys: () => signer.keys });
  });

  it('rifiuta token HS256 e "alg: none" (algorithm confusion)', async () => {
    const hs = await new SignJWT({ email: OWNER })
      .setProtectedHeader({ alg: 'HS256', kid: 'k1' })
      .setIssuer('https://testteam.cloudflareaccess.com')
      .setAudience(AUD)
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('0123456789abcdef0123456789abcdef'));
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ email: OWNER, iss: 'https://testteam.cloudflareaccess.com', aud: AUD, exp: 9_999_999_999 })}.`;
    for (const token of [hs, none]) {
      const res = await call(app, accessEnv(), '/api/v1/me', {
        headers: { 'cf-access-jwt-assertion': token },
      });
      expect(res.status).toBe(401);
    }
  });

  it('accetta OWNER_EMAIL con maiuscole e spazi attorno', async () => {
    const token = await signer.sign();
    const res = await call(
      app,
      accessEnv({ OWNER_EMAIL: `  ${OWNER.toUpperCase()}  ` }),
      '/api/v1/me',
      {
        headers: { 'cf-access-jwt-assertion': token },
      },
    );
    expect(res.status).toBe(200);
  });

  it.each([
    ['OWNER_EMAIL non definita', { OWNER_EMAIL: undefined }],
    ['ACCESS_AUD non definita', { ACCESS_AUD: undefined }],
    ['ACCESS_TEAM_DOMAIN non definita', { ACCESS_TEAM_DOMAIN: undefined }],
  ])('%s → auth_misconfigured (non un errore interno)', async (_name, override) => {
    const res = await call<any>(app, accessEnv(override), '/api/v1/me', {
      headers: { 'cf-access-jwt-assertion': await signer.sign() },
    });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('auth_misconfigured');
  });

  it('OWNER_EMAIL composto solo da spazi è una configurazione non valida', async () => {
    const res = await call(app, accessEnv({ OWNER_EMAIL: '   ' }), '/api/v1/me', {
      headers: { 'cf-access-jwt-assertion': await signer.sign() },
    });
    expect(res.status).toBe(500);
  });

  it.each([
    'http://127.0.0.1/api/v1/me',
    'http://[::1]:8787/api/v1/me',
    'http://LOCALHOST/api/v1/me',
  ])('la modalità dev è ammessa su loopback: %s', async (url) => {
    const res = await app.request(url, {}, devEnv('host-ok@example.com'));
    expect(res.status).toBe(200);
  });

  it.each([
    'http://localhost.evil.com/api/v1/me',
    'http://evil.localhost/api/v1/me',
    'http://0.0.0.0/api/v1/me',
    'https://app.example.com/api/v1/me',
  ])('la modalità dev è rifiutata su un hostname non di loopback: %s', async (url) => {
    // Gli header Host / X-Forwarded-Host non possono "trasformare" l'hostname.
    const res = await app.request(
      url,
      { headers: { host: 'localhost', 'x-forwarded-host': 'localhost' } },
      devEnv('host-bad@example.com'),
    );
    expect(res.status).toBe(500);
  });
});

describe('JWKS remoto: cache, rotazione delle chiavi, indisponibilità', () => {
  const makeKey = async (kid: string) => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk: JWK = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
    return { jwk, privateKey };
  };
  const tokenFor = (team: string, kid: string, key: CryptoKey) =>
    new SignJWT({ email: OWNER })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuer(`https://${team}`)
      .setAudience(AUD)
      .setExpirationTime('10m')
      .sign(key);

  it('scarica il JWKS dall’URL ufficiale del team, lo mette in cache e accetta la nuova chiave dopo il cooldown', async () => {
    const team = 'rotation.cloudflareaccess.com';
    const k1 = await makeKey('k1');
    const k2 = await makeKey('k2');
    let published: JWK[] = [k1.jwk];
    const fetchMock = vi.fn((_url: string | URL | Request) =>
      Promise.resolve(
        new Response(JSON.stringify({ keys: published }), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers({ toFake: ['Date'] });

    const app = createApp(); // risolutore di produzione (JWKS remoto)
    const env = accessEnv({ ACCESS_TEAM_DOMAIN: team });
    const get = async (token: string) =>
      (await call(app, env, '/api/v1/me', { headers: { 'cf-access-jwt-assertion': token } }))
        .status;

    // 1. Prima richiesta: scarica il JWKS dall'endpoint ufficiale.
    expect(await get(await tokenFor(team, 'k1', k1.privateKey))).toBe(200);
    const first = fetchMock.mock.calls[0]?.[0];
    const firstUrl =
      typeof first === 'string' ? first : first instanceof URL ? first.href : first?.url;
    expect(firstUrl).toBe(`https://${team}/cdn-cgi/access/certs`);
    // 2. Seconda richiesta: usa la cache (nessun nuovo download).
    expect(await get(await tokenFor(team, 'k1', k1.privateKey))).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 3. Rotazione: Cloudflare pubblica k2. Subito dopo il precedente download, jose è in
    //    "cooldown" (30 s): il token con la nuova chiave viene rifiutato (fail closed), senza martellare l'endpoint.
    published = [k1.jwk, k2.jwk];
    expect(await get(await tokenFor(team, 'k2', k2.privateKey))).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 4. Passato il cooldown il JWKS viene riscaricato e la nuova chiave è accettata.
    vi.setSystemTime(Date.now() + 31_000);
    expect(await get(await tokenFor(team, 'k2', k2.privateKey))).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['rete assente', () => Promise.reject(new TypeError('network'))],
    ['risposta 500', () => Promise.resolve(new Response('boom', { status: 500 }))],
    [
      'JWKS non valido',
      () =>
        Promise.resolve(
          new Response('{"keys":"no"}', { headers: { 'content-type': 'application/json' } }),
        ),
    ],
  ])(
    'se il JWKS non è disponibile (%s) l’accesso è negato, senza dettagli',
    async (_name, impl) => {
      const team = `outage${Math.random().toString(36).slice(2, 8)}.cloudflareaccess.com`;
      const key = await makeKey('k1');
      vi.stubGlobal('fetch', vi.fn(impl));
      const res = await call<any>(
        createApp(),
        accessEnv({ ACCESS_TEAM_DOMAIN: team }),
        '/api/v1/me',
        {
          headers: { 'cf-access-jwt-assertion': await tokenFor(team, 'k1', key.privateKey) },
        },
      );
      expect(res.status).toBe(401);
      expect(JSON.stringify(res.body)).not.toMatch(/jwks|network|boom|fetch/i);
    },
  );
});

describe('HTTP: CSRF, CORS, payload, header', () => {
  const app = createApp();
  const post = (
    headers: Record<string, string>,
    body = '{"name":"x"}',
    email = `hh${Math.random()}@example.com`,
  ) => app.request('/api/v1/workspaces', { method: 'POST', headers, body }, devEnv(email));

  it.each(['application/jsonx', 'application/json-patch+json', 'text/plain; application/json', ''])(
    'rifiuta Content-Type non JSON esatto: "%s"',
    async (ct) => {
      expect((await post(ct ? { 'content-type': ct } : {})).status).toBe(415);
    },
  );

  it.each([
    'application/json',
    'APPLICATION/JSON',
    'application/json; charset=utf-8',
    'application/json ;charset=utf-8',
  ])('accetta Content-Type JSON: "%s"', async (ct) => {
    expect((await post({ 'content-type': ct })).status).toBe(201);
  });

  it('rifiuta Origin "null" (iframe sandbox / contesti opachi)', async () => {
    expect((await post({ 'content-type': 'application/json', origin: 'null' })).status).toBe(403);
  });

  it('rifiuta payload oltre il limite anche senza Content-Length (chunked)', async () => {
    const chunk = new Uint8Array(70 * 1024).fill(97);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"name":"'));
        controller.enqueue(chunk);
        controller.enqueue(new TextEncoder().encode('"}'));
        controller.close();
      },
    });
    const res = await app.request(
      '/api/v1/workspaces',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: stream,
        duplex: 'half',
      } as RequestInit,
      devEnv('chunked@example.com'),
    );
    expect(res.status).toBe(413);
    const body = await res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('payload_too_large');
  });

  it('non concede mai CORS: nessun Access-Control-Allow-*, nemmeno al preflight', async () => {
    const env = devEnv('cors@example.com');
    const preflight = await app.request(
      '/api/v1/workspaces',
      {
        method: 'OPTIONS',
        headers: {
          origin: 'https://evil.example',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type',
        },
      },
      env,
    );
    const simple = await app.request(
      '/api/v1/me',
      { headers: { origin: 'https://evil.example' } },
      env,
    );
    for (const res of [preflight, simple]) {
      expect([...res.headers.keys()].filter((h) => h.startsWith('access-control-'))).toEqual([]);
    }
    expect(preflight.status).not.toBe(200);
  });

  it('le risposte API includono gli header di sicurezza attesi e non rivelano il server', async () => {
    const res = await app.request('/api/health', {}, devEnv('hdr@example.com'));
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('strict-transport-security')).toMatch(/max-age=\d+/);
    expect(res.headers.get('server')).toBeNull();
    expect(res.headers.get('x-powered-by')).toBeNull();
  });
});

describe('ID manipolati: mai 500, mai fuga di informazioni', () => {
  const app = createApp();
  const env = devEnv('tamper@example.com');

  it.each([
    ['percorso relativo', '../../etc/passwd'],
    ['SQL injection', "x' OR '1'='1"],
    ['SQL injection 2', '1; DROP TABLE workspaces;--'],
    ['unicode', '工作区'],
    ['spazi', '   '],
    ['troppo lungo', 'a'.repeat(65)],
    ['NUL', 'a%00b'],
  ])('overview con workspaceId (%s) → 400 o 404, non 500', async (_n, id) => {
    const res = await call<any>(app, env, `/api/v1/overview?workspaceId=${encodeURIComponent(id)}`);
    expect([400, 404]).toContain(res.status);
    expect(res.body.error.code).toMatch(/validation_error|not_found/);
  });

  it('parametro duplicato: vale il primo e comunque il controllo di appartenenza', async () => {
    const res = await call(app, env, '/api/v1/overview?workspaceId=a&workspaceId=b');
    expect(res.status).toBe(404);
  });

  it('SQL injection nel nome del workspace è trattata come testo, non eseguita', async () => {
    const evil = "Robert'); DROP TABLE users;--";
    const res = await call<any>(app, devEnv('inject@example.com'), '/api/v1/workspaces', {
      method: 'POST',
      json: { name: evil },
    });
    expect(res.status).toBe(201);
    expect(res.body.workspace.name).toBe(evil);
    expect((await call(app, devEnv('inject@example.com'), '/api/v1/me')).status).toBe(200); // users esiste ancora
  });
});
