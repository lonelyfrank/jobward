import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { call, devEnv, seedBoardWithColumn, seedCard, seedWorkspace } from './helpers';

const app = createApp();

describe('isolamento dei dati tra utenti', () => {
  it('un utente non può leggere l’overview di un workspace altrui: stessa risposta di "inesistente"', async () => {
    const victim = await seedWorkspace('victim@example.com', 'Privato');
    const { boardId, columnId } = await seedBoardWithColumn(victim.workspaceId);
    await seedCard(victim.workspaceId, boardId, columnId, { title: 'Segreta' });

    const attacker = devEnv('attacker@example.com');
    const foreign = await call<any>(
      app,
      attacker,
      `/api/v1/overview?workspaceId=${victim.workspaceId}`,
    );
    const missing = await call<any>(app, attacker, '/api/v1/overview?workspaceId=non-esiste');

    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreign.body.error.code).toBe(missing.body.error.code);
    expect(foreign.body.error.message).toBe(missing.body.error.message);
    expect(JSON.stringify(foreign.body)).not.toContain('Segreta');
  });

  it('il proprietario legge il proprio workspace', async () => {
    const own = await seedWorkspace('owner-reads@example.com');
    const res = await call<any>(
      app,
      devEnv('owner-reads@example.com'),
      `/api/v1/overview?workspaceId=${own.workspaceId}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.workspaceId).toBe(own.workspaceId);
  });

  it('richiede workspaceId (400)', async () => {
    const res = await call<any>(app, devEnv('no-ws@example.com'), '/api/v1/overview');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('tutte le rotte /api/v1 richiedono autenticazione', async () => {
    const anonymous = devEnv('x@example.com', {
      AUTH_MODE: 'access',
      ENVIRONMENT: 'production',
      OWNER_EMAIL: 'o@example.com',
      ACCESS_AUD: 'a',
      ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com',
    });
    for (const path of ['/api/v1/me', '/api/v1/workspaces', '/api/v1/overview?workspaceId=x']) {
      expect((await call(app, anonymous, path)).status, path).toBe(401);
    }
    const post = await call(app, anonymous, '/api/v1/workspaces', {
      method: 'POST',
      json: { name: 'x' },
    });
    expect(post.status).toBe(401);
  });
});
