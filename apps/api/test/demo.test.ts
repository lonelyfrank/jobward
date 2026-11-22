import { insightsResponse, meResponse, overviewResponse } from '@jobward/schemas';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { accessEnv, call, createAccessSigner, devEnv } from './helpers';

const app = createApp();
const signer = await createAccessSigner();
const accessApp = createApp({ accessKeys: () => signer.keys });
const DEMO = { 'x-jobward-profile': 'demo' };

const envFor = (name: string) =>
  devEnv(`${name}-real@example.com`, { DEMO_USER_EMAIL: `${name}-demo@example.com` });

const reset = (env: ReturnType<typeof envFor>, headers: Record<string, string> = DEMO) =>
  call<any>(app, env, '/api/v1/demo/reset', { method: 'POST', json: {}, headers });

describe('profilo dati demo', () => {
  it('in sviluppo /me dichiara il profilo e l’header seleziona un’identità distinta', async () => {
    const env = envFor('demo-me');
    const real = meResponse.parse((await call(app, env, '/api/v1/me')).body);
    const demo = meResponse.parse((await call(app, env, '/api/v1/me', { headers: DEMO })).body);
    expect(real.profile).toEqual({ available: true, active: 'real' });
    expect(demo.profile).toEqual({ available: true, active: 'demo' });
    expect(real.user.email).toBe('demo-me-real@example.com');
    expect(demo.user.email).toBe('demo-me-demo@example.com');
    expect(demo.user.id).not.toBe(real.user.id);
  });

  it('rigenera i dati demo senza toccare quelli reali', async () => {
    const env = envFor('demo-iso');
    const own = await call<any>(app, env, '/api/v1/workspaces', {
      method: 'POST',
      json: { name: 'Reale', timezone: 'Europe/Rome' },
    });
    expect(own.status).toBe(201);
    const realWs = own.body.workspace.id as string;

    const first = await reset(env);
    expect(first.status).toBe(201);
    const demoWs = first.body.workspace.id as string;
    expect(demoWs).not.toBe(realWs);

    // Seconda rigenerazione: il vecchio workspace demo sparisce, quello reale resta.
    const second = await reset(env);
    expect(second.status).toBe(201);
    const demoMe = meResponse.parse((await call(app, env, '/api/v1/me', { headers: DEMO })).body);
    expect(demoMe.workspaces.map((w) => w.id)).toEqual([second.body.workspace.id]);
    const realMe = meResponse.parse((await call(app, env, '/api/v1/me')).body);
    expect(realMe.workspaces.map((w) => w.id)).toEqual([realWs]);

    // L'identità reale non vede il workspace demo (stesso 404 di un workspace altrui).
    const peek = await call(app, env, `/api/v1/overview?workspaceId=${second.body.workspace.id}`);
    expect(peek.status).toBe(404);
    const realOverview = overviewResponse.parse(
      (await call(app, env, `/api/v1/overview?workspaceId=${realWs}`)).body,
    );
    expect(realOverview.counts.opportunities).toBe(0);
  });

  it('il dataset popola Overview e Insights con date relative a oggi', async () => {
    const env = envFor('demo-data');
    const ws = (await reset(env)).body.workspace.id as string;
    const overview = overviewResponse.parse(
      (await call(app, env, `/api/v1/overview?workspaceId=${ws}`, { headers: DEMO })).body,
    );
    expect(overview.counts.opportunities).toBeGreaterThanOrEqual(15);
    expect(overview.counts.boards).toBe(2);
    expect(overview.counts.applicationsSubmitted).toBeGreaterThanOrEqual(10);
    expect(overview.counts.interviews).toBe(2); // schede in fase colloquio (una è già a offerta)
    expect(overview.counts.openTasks).toBeGreaterThan(0);

    const insights = insightsResponse.parse(
      (await call(app, env, `/api/v1/insights?workspaceId=${ws}`, { headers: DEMO })).body,
    );
    expect(insights).toBeTruthy();

    const calendar = await call<any>(
      app,
      env,
      `/api/v1/calendar?workspaceId=${ws}&from=${new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10)}&to=${new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10)}`,
      { headers: DEMO },
    );
    expect(calendar.status).toBe(200);
  });

  it('con il profilo reale la rotta non esiste e non cancella nulla', async () => {
    const env = envFor('demo-guard');
    await call(app, env, '/api/v1/workspaces', {
      method: 'POST',
      json: { name: 'Reale', timezone: 'Europe/Rome' },
    });
    expect((await reset(env, {})).status).toBe(404);
    expect((await reset(env, { 'x-jobward-profile': 'real' })).status).toBe(404);
    const me = meResponse.parse((await call(app, env, '/api/v1/me')).body);
    expect(me.workspaces).toHaveLength(1);
  });

  it('rifiuta un profilo demo configurato con la stessa identità di quello reale', async () => {
    const env = devEnv('demo-same@example.com', { DEMO_USER_EMAIL: 'DEMO-SAME@example.com' });
    expect((await call(app, env, '/api/v1/me', { headers: DEMO })).status).toBe(500);
  });

  it('con Cloudflare Access l’header è ignorato e il profilo demo non è disponibile', async () => {
    const env = accessEnv();
    const headers = { ...DEMO, 'cf-access-jwt-assertion': await signer.sign() };
    const me = meResponse.parse((await call(accessApp, env, '/api/v1/me', { headers })).body);
    expect(me.profile).toEqual({ available: false, active: 'real' });
    const attempt = await call(accessApp, env, '/api/v1/demo/reset', {
      method: 'POST',
      json: {},
      headers,
    });
    expect(attempt.status).toBe(404);
  });
});
