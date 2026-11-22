import { env } from 'cloudflare:workers';
import {
  applicationMutationResponse,
  applicationsResponse,
  cardResponse,
  insightsResponse,
  workspaceExport,
} from '@jobward/schemas';
import { describe, expect, it } from 'vitest';
import { newUser } from './kanban-helpers';
import { countOf, setupCard, transition, uid } from './m3-helpers';

/** Opportunity 1:N Application: Inbox, prima candidatura, ricandidatura, insights, esportazione. */

describe('opportunità senza bacheca (Inbox)', () => {
  it('si crea con il solo titolo, senza colonna, e non ha candidature', async () => {
    const { api } = await newUser('app-inbox@example.com');
    const res = await api.post('/cards', { title: 'Sviluppatore backend' });
    expect(res.status).toBe(201);
    const card = cardResponse.parse(res.body).card;
    expect(card).toMatchObject({
      boardId: null,
      columnId: null,
      applicationId: null,
      applicationCount: 0,
      stage: null,
    });
    await api
      .post('/cards', { title: 'Già candidata' })
      .then(({ body }) => transition(api, body.card.id, { to: 'applied', kind: 'advance' }));
    const inbox = await api.get('/opportunities?scope=inbox');
    expect(inbox.status).toBe(200);
    expect(inbox.body.items.map((i: { title: string }) => i.title)).toEqual([
      'Sviluppatore backend',
    ]);
    const applied = await api.get('/opportunities?scope=applications');
    expect(applied.body.items.map((i: { title: string }) => i.title)).toEqual(['Già candidata']);
  });
});

describe('prima candidatura dalla pipeline', () => {
  it('«Candidati» crea la candidatura n.1 con snapshot ed evento application_created', async () => {
    const c = await setupCard('app-first@example.com', 'Tecnico IT');
    await c.api.patch(`/cards/${c.card.id}`, { company: 'Alfa Nord', location: 'Milano' });
    const res = await transition(c.api, c.card.id, {
      to: 'applied',
      kind: 'advance',
      appliedOn: '2026-11-03',
    });
    expect(res.status).toBe(200);
    expect(res.body.card).toMatchObject({
      stage: 'applied',
      appliedOn: '2026-11-03',
      applicationCount: 1,
    });

    const apps = applicationsResponse.parse(
      (await c.api.get(`/cards/${c.card.id}/applications`)).body,
    ).applications;
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({ sequence: 1, current: true, stage: 'applied' });
    expect(apps[0]!.snapshot).toMatchObject({
      version: 1,
      title: 'Tecnico IT',
      company: 'Alfa Nord',
    });
    expect(await countOf('application_created', c.card.id)).toBe(1);

    // Gli eventi della transizione sono legati alla candidatura.
    const { results } = await env.DB.prepare(
      `SELECT count(*) AS n FROM activity_events WHERE card_id = ?1 AND application_id = ?2`,
    )
      .bind(c.card.id, apps[0]!.id)
      .all<{ n: number }>();
    expect(results[0]!.n).toBeGreaterThanOrEqual(2);
  });

  it('le transizioni successive aggiornano la stessa candidatura (nessuna nuova riga)', async () => {
    const c = await setupCard('app-same@example.com');
    await transition(c.api, c.card.id, { to: 'applied', kind: 'advance' });
    await transition(c.api, c.card.id, { to: 'interviewing', kind: 'advance' });
    const apps = (await c.api.get(`/cards/${c.card.id}/applications`)).body.applications;
    expect(apps).toHaveLength(1);
    expect(apps[0].stage).toBe('interviewing');
  });
});

describe('ricandidatura', () => {
  it('con una candidatura aperta è 409; dopo la chiusura crea la n.2 e la rende corrente', async () => {
    const c = await setupCard('app-reapply@example.com');
    await transition(c.api, c.card.id, { to: 'applied', kind: 'advance' });

    const blocked = await c.api.post(`/cards/${c.card.id}/applications`, { id: uid() });
    expect(blocked.status).toBe(409);

    const closed = await transition(c.api, c.card.id, {
      to: 'rejected',
      kind: 'close',
      expectedFrom: 'applied',
    });
    expect(closed.status).toBe(200);

    const id = uid();
    const created = await c.api.post(`/cards/${c.card.id}/applications`, {
      id,
      appliedOn: '2027-03-01',
      channel: 'Sito aziendale',
    });
    expect(created.status).toBe(201);
    const body = applicationMutationResponse.parse(created.body);
    expect(body.application).toMatchObject({
      id,
      sequence: 2,
      current: true,
      stage: 'applied',
      outcome: null,
      channel: 'Sito aziendale',
    });
    expect(body.card).toMatchObject({ applicationId: id, applicationCount: 2, stage: 'applied' });

    const apps = (await c.api.get(`/cards/${c.card.id}/applications`)).body.applications;
    expect(
      apps.map((a: { sequence: number; current: boolean }) => [a.sequence, a.current]),
    ).toEqual([
      [2, true],
      [1, false],
    ]);
    expect(apps[1].outcome).toBe('rejected'); // lo storico della prima resta intatto
  });

  it('idempotente: stesso id e stessa richiesta → 200 replay; stesso id, richiesta diversa → 409', async () => {
    const c = await setupCard('app-idem@example.com');
    const id = uid();
    const first = await c.api.post(`/cards/${c.card.id}/applications`, { id, stage: 'preparing' });
    expect(first.status).toBe(201);
    const again = await c.api.post(`/cards/${c.card.id}/applications`, { id, stage: 'preparing' });
    expect(again.status).toBe(200);
    expect(again.body.replayed).toBe(true);
    const different = await c.api.post(`/cards/${c.card.id}/applications`, {
      id,
      stage: 'applied',
    });
    expect(different.status).toBe(409);
  });

  it('correzione di data d’invio e canale senza cambiare lo stato', async () => {
    const c = await setupCard('app-patch@example.com');
    const id = uid();
    await c.api.post(`/cards/${c.card.id}/applications`, { id });
    const res = await c.api.patch(`/applications/${id}`, {
      appliedOn: '2026-11-03',
      channel: 'LinkedIn',
    });
    expect(res.status).toBe(200);
    expect(res.body.application).toMatchObject({
      appliedOn: '2026-11-03',
      channel: 'LinkedIn',
      stage: 'applied',
    });
    expect((await c.api.patch(`/applications/${id}`, { stage: 'offer' })).status).toBe(400);
  });

  it('una candidatura di un altro workspace è 404', async () => {
    const c = await setupCard('app-own@example.com');
    const id = uid();
    await c.api.post(`/cards/${c.card.id}/applications`, { id });
    const other = await newUser('app-other@example.com');
    expect((await other.api.patch(`/applications/${id}`, { channel: 'x' })).status).toBe(404);
    expect((await other.api.get(`/cards/${c.card.id}/applications`)).status).toBe(404);
  });
});

describe('insights ed esportazione', () => {
  it('GET /insights distingue Inbox, candidature attive e funnel', async () => {
    const { api } = await newUser('app-insights@example.com');
    await api.post('/cards', { title: 'Solo salvata' });
    const applied = (await api.post('/cards', { title: 'Inviata' })).body.card.id as string;
    await transition(api, applied, { to: 'applied', kind: 'advance', appliedOn: '2026-11-03' });

    const res = await api.get('/insights');
    expect(res.status).toBe(200);
    const insights = insightsResponse.parse(res.body);
    expect(insights.totals).toMatchObject({
      opportunities: 2,
      inbox: 1,
      applications: 1,
      activeApplications: 1,
    });
    expect(insights.funnel[0]).toMatchObject({ step: 'applied', count: 1 });
    expect(insights.responseTime).toMatchObject({ sampleSize: 0, awaitingResponse: 1 });
  });

  it('GET /export restituisce tutte le collezioni del workspace e nient’altro', async () => {
    const mine = await newUser('app-export@example.com');
    const theirs = await newUser('app-export-other@example.com');
    const card = (await mine.api.post('/cards', { title: 'Mia' })).body.card.id as string;
    await transition(mine.api, card, { to: 'applied', kind: 'advance' });
    await theirs.api.post('/cards', { title: 'Altrui' });

    const res = await mine.api.get('/export');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(/jobward-export-/);
    const data = workspaceExport.parse(res.body);
    expect(data.collections['opportunities']!.map((o) => o['title'])).toEqual(['Mia']);
    expect(data.collections['applications']).toHaveLength(1);
    expect(data.collections['applicationSnapshots']).toHaveLength(1);
  });
});

describe('bacheca canonica', () => {
  it('GET /opportunities/pipeline restituisce tutte le opportunità attive con lo stato corrente', async () => {
    const { api } = await newUser('app-pipeline@example.com');
    const inbox = (await api.post('/cards', { title: 'In Inbox' })).body.card.id as string;
    const sent = (await api.post('/cards', { title: 'Inviata' })).body.card.id as string;
    await transition(api, sent, { to: 'applied', kind: 'advance' });
    const archived = (await api.post('/cards', { title: 'Archiviata' })).body.card.id as string;
    await api.post(`/cards/${archived}/archive`);

    const res = await api.get('/opportunities/pipeline');
    expect(res.status).toBe(200);
    const byId = new Map(
      (res.body.cards as { id: string; stage: string | null }[]).map((c) => [c.id, c.stage]),
    );
    expect([...byId.keys()].sort()).toEqual([inbox, sent].sort());
    expect(byId.get(sent)).toBe('applied');
    expect(byId.get(inbox)).toBeNull();
  });
});
