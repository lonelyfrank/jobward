import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { accessEnv, call, createAccessSigner, devEnv, OWNER } from './helpers';

let signer: Awaited<ReturnType<typeof createAccessSigner>>;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  signer = await createAccessSigner();
  app = createApp({ accessKeys: () => signer.keys });
});

const withToken = (token: string) => ({ headers: { 'cf-access-jwt-assertion': token } });

describe('modalità access (produzione)', () => {
  it('accetta un token valido del proprietario e crea l’utente al primo accesso', async () => {
    const res = await call<any>(app, accessEnv(), '/api/v1/me', withToken(await signer.sign()));
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(OWNER);
    expect(res.body.workspaces).toEqual([]);
  });

  it('rifiuta una richiesta senza token (401)', async () => {
    const res = await call<any>(app, accessEnv(), '/api/v1/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('non si fida di un header email o di un cookie senza JWT', async () => {
    const res = await call(app, accessEnv(), '/api/v1/me', {
      headers: { 'cf-access-authenticated-user-email': OWNER, cookie: 'CF_Authorization=abc' },
    });
    expect(res.status).toBe(401);
  });

  it('rifiuta un token firmato con una chiave sconosciuta', async () => {
    const other = await signer.generateOtherKey();
    const token = await signer.sign({}, other.privateKey);
    expect((await call(app, accessEnv(), '/api/v1/me', withToken(token))).status).toBe(401);
  });

  it('rifiuta audience, emittente o scadenza errati', async () => {
    const bad = [
      await signer.sign({ aud: 'altra-app' }),
      await signer.sign({ iss: 'https://altro.cloudflareaccess.com' }),
      await signer.sign({ exp: Math.floor(Date.now() / 1000) - 60 }),
    ];
    for (const token of bad) {
      expect((await call(app, accessEnv(), '/api/v1/me', withToken(token))).status).toBe(401);
    }
  });

  it('rifiuta un token senza email', async () => {
    const token = await signer.sign({ email: undefined });
    expect((await call(app, accessEnv(), '/api/v1/me', withToken(token))).status).toBe(401);
  });

  it('rifiuta con 403 un utente autenticato ma diverso dal proprietario', async () => {
    const token = await signer.sign({ email: 'intruso@example.com' });
    const res = await call<any>(app, accessEnv(), '/api/v1/me', withToken(token));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });

  it('confronta l’email senza distinguere maiuscole', async () => {
    const token = await signer.sign({ email: OWNER.toUpperCase() });
    expect((await call(app, accessEnv(), '/api/v1/me', withToken(token))).status).toBe(200);
  });

  it('non rivela il motivo del rifiuto del token', async () => {
    const res = await call<any>(app, accessEnv(), '/api/v1/me', withToken('non.un.jwt'));
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toMatch(/signature|jwt|expired|claim/i);
  });
});

describe('fail closed: configurazione incoerente', () => {
  it.each([
    ['OWNER_EMAIL mancante', { OWNER_EMAIL: '' }],
    ['ACCESS_AUD mancante', { ACCESS_AUD: '' }],
    ['ACCESS_TEAM_DOMAIN mancante', { ACCESS_TEAM_DOMAIN: '' }],
    ['ACCESS_TEAM_DOMAIN non valido', { ACCESS_TEAM_DOMAIN: 'evil.example.com' }],
  ])('%s → 500 auth_misconfigured, anche con token valido', async (_name, override) => {
    const res = await call<any>(
      app,
      accessEnv(override),
      '/api/v1/me',
      withToken(await signer.sign()),
    );
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('auth_misconfigured');
  });

  it('la modalità dev è rifiutata se ENVIRONMENT non è development', async () => {
    const res = await call<any>(
      app,
      devEnv('x@example.com', { ENVIRONMENT: 'production' }),
      '/api/v1/me',
    );
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('auth_misconfigured');
  });

  it('la modalità dev è rifiutata su un hostname pubblico, anche con ENVIRONMENT=development', async () => {
    // Scenario: `wrangler deploy --env dev` per errore. Non deve aprire l'accesso.
    const res = await app.request(
      'https://meet-roulette-dev.example.workers.dev/api/v1/me',
      {},
      devEnv('x@example.com'),
    );
    expect(res.status).toBe(500);
    const body = await res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('auth_misconfigured');
  });

  it('una modalità sconosciuta è rifiutata', async () => {
    const res = await call(
      app,
      devEnv('x@example.com', { AUTH_MODE: 'off' as never }),
      '/api/v1/me',
    );
    expect(res.status).toBe(500);
  });
});

describe('modalità dev (solo sviluppo locale)', () => {
  it('usa l’identità locale configurata', async () => {
    const res = await call<any>(app, devEnv('Dev.Locale@Example.com'), '/api/v1/me');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('dev.locale@example.com');
  });
});
