import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { call, devEnv } from './helpers';

const app = createApp();

describe('workspace', () => {
  it('crea un workspace (201) e lo restituisce in /me e nella lista', async () => {
    const env = devEnv('ws-create@example.com');
    const created = await call<any>(app, env, '/api/v1/workspaces', {
      method: 'POST',
      json: { name: '  La mia ricerca  ', timezone: 'Europe/Rome' },
    });
    expect(created.status).toBe(201);
    expect(created.body.workspace).toMatchObject({
      name: 'La mia ricerca',
      timezone: 'Europe/Rome',
      role: 'owner',
    });

    const me = await call<any>(app, env, '/api/v1/me');
    expect(me.body.workspaces).toHaveLength(1);
    expect(me.body.workspaces[0].id).toBe(created.body.workspace.id);

    const list = await call<any>(app, env, '/api/v1/workspaces');
    expect(list.body.workspaces).toHaveLength(1);
  });

  it('applica il limite MVP di un workspace per utente (409), anche con richieste simultanee', async () => {
    const env = devEnv('ws-limit@example.com');
    const results = await Promise.all(
      [1, 2, 3].map((n) =>
        call<any>(app, env, '/api/v1/workspaces', { method: 'POST', json: { name: `W${n}` } }),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);

    const list = await call<any>(app, env, '/api/v1/workspaces');
    expect(list.body.workspaces).toHaveLength(1);
  });

  it('valida il payload: nome vuoto e fuso orario non valido → 400 con dettagli per campo', async () => {
    const env = devEnv('ws-validate@example.com');
    const res = await call<any>(app, env, '/api/v1/workspaces', {
      method: 'POST',
      json: { name: '   ', timezone: 'Mars/Olympus' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(res.body.error.issues.map((i: { path: string }) => i.path).sort()).toEqual([
      'name',
      'timezone',
    ]);
  });

  it('rifiuta JSON malformato (400)', async () => {
    const env = devEnv('ws-badjson@example.com');
    const res = await call<any>(app, env, '/api/v1/workspaces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('i workspace di un utente non compaiono nella lista di un altro', async () => {
    await call(app, devEnv('iso-a@example.com'), '/api/v1/workspaces', {
      method: 'POST',
      json: { name: 'A' },
    });
    const b = await call<any>(app, devEnv('iso-b@example.com'), '/api/v1/workspaces');
    expect(b.body.workspaces).toEqual([]);
  });
});

describe('protezioni delle richieste che modificano dati', () => {
  const env = devEnv('guards@example.com');
  const post = (
    extra: Record<string, string> = {},
    body = '{"name":"X"}',
    ct = 'application/json',
  ) =>
    call<any>(app, env, '/api/v1/workspaces', {
      method: 'POST',
      headers: { 'content-type': ct, ...extra },
      body,
    });

  it('rifiuta Content-Type diversi da JSON (415): blocca i form cross-site', async () => {
    for (const ct of ['application/x-www-form-urlencoded', 'text/plain', 'multipart/form-data']) {
      const res = await post({}, 'name=X', ct);
      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('unsupported_media_type');
    }
  });

  it('rifiuta un Origin diverso (403 csrf_rejected)', async () => {
    const res = await post({ origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('csrf_rejected');
  });

  it('rifiuta Sec-Fetch-Site cross-site e same-site', async () => {
    expect((await post({ 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect((await post({ 'sec-fetch-site': 'same-site' })).status).toBe(403);
  });

  it('accetta l’origine dell’API e quella configurata in APP_ORIGIN', async () => {
    const same = await call(app, devEnv('guards-ok1@example.com'), '/api/v1/workspaces', {
      method: 'POST',
      headers: { origin: 'http://localhost', 'sec-fetch-site': 'same-origin' },
      json: { name: 'X' },
    });
    expect(same.status).toBe(201);

    const configured = await call(
      app,
      devEnv('guards-ok2@example.com', { APP_ORIGIN: 'http://localhost:5173' }),
      '/api/v1/workspaces',
      { method: 'POST', headers: { origin: 'http://localhost:5173' }, json: { name: 'X' } },
    );
    expect(configured.status).toBe(201);
  });

  it('rifiuta payload oltre il limite (413)', async () => {
    const big = JSON.stringify({ name: 'x'.repeat(70 * 1024) });
    const res = await post({ 'content-length': String(big.length) }, big);
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('payload_too_large');
  });

  it('non lascia che un errore interno esponga dettagli', async () => {
    const broken = { ...env, DB: undefined as never };
    const res = await call<any>(app, broken, '/api/v1/me');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('internal_error');
    expect(res.body.error.message).toBe('Si è verificato un errore imprevisto');
  });
});
