import { env } from 'cloudflare:workers';
import { interviewsResponse } from '@jobward/schemas';
import { LIMITS } from '@jobward/shared';
import { describe, expect, it } from 'vitest';
import { newUser } from './kanban-helpers';
import { canonicalJson, requestFingerprint } from '../src/services/idempotency';
import { countOf, dbEvents, exec, setupCard, uid, type Ctx } from './m3-helpers';

const create = (c: Ctx, body: Record<string, unknown>, card = c.card.id) =>
  c.api.post(`/cards/${card}/interviews`, body);
const list = async (c: Ctx) =>
  interviewsResponse.parse((await c.api.get(`/cards/${c.card.id}/interviews`)).body).interviews;

describe('colloqui M2.5 — creazione idempotente (D5)', () => {
  it('senza ID del client il comportamento M2.5 resta invariato (201, nuovo round a ogni richiesta)', async () => {
    const c = await setupCard('ivi-legacy@example.com');
    expect((await create(c, {})).status).toBe(201);
    expect((await create(c, {})).status).toBe(201);
    expect((await list(c)).map((i) => i.sequence)).toEqual([1, 2]);
    expect(await countOf('interview_created', c.card.id)).toBe(2);
  });

  it('con ID: 201 poi 200 con lo stesso round; un solo round e un solo evento; l’evento ha chiave e fingerprint', async () => {
    const c = await setupCard('ivi-replay@example.com');
    const body = { id: uid(), title: 'Tecnico', type: 'technical' };
    const first = await create(c, body);
    const second = await create(c, body);
    expect([first.status, second.status]).toEqual([201, 200]);
    expect(second.body.interview.id).toBe(body.id);
    expect(second.body.interview.sequence).toBe(1);
    expect(await list(c)).toHaveLength(1);
    const events = (await dbEvents(c.card.id)).filter((e) => e.type === 'interview_created');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ operation_id: body.id });
    expect(JSON.parse(events[0]!.dedupe_key!)).toEqual([
      'interview_created',
      'interview',
      body.id,
      body.id,
    ]);
    expect(events[0]!.request_fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('il replay dopo modifica, riprogrammazione e completamento restituisce il round corrente senza rifarlo', async () => {
    const c = await setupCard('ivi-after@example.com');
    const body = { id: uid(), title: 'Round A', scheduledAt: Date.now() + 2e8 };
    await create(c, body);
    await c.api.patch(`/interviews/${body.id}`, {
      title: 'Rinominato',
      scheduledAt: Date.now() + 3e8,
    });
    await c.api.post(`/interviews/${body.id}/complete`, { result: 'positive' });
    const events = (await dbEvents(c.card.id)).length;
    const late = await create(c, body);
    expect(late.status).toBe(200);
    expect(late.body.interview).toMatchObject({
      title: 'Rinominato',
      status: 'completed',
      result: 'positive',
    });
    expect(await list(c)).toHaveLength(1);
    expect((await dbEvents(c.card.id)).length).toBe(events);
  });

  it('stesso ID con payload diverso (anche solo un campo) o su un’altra scheda: 409 senza modifiche', async () => {
    const c = await setupCard('ivi-mismatch@example.com');
    const other = (await c.api.post('/cards', { columnId: c.columnIds[0], title: 'Altra' })).body
      .card.id;
    const body = { id: uid(), title: 'Uno', interviewers: ['Anna'] };
    await create(c, body);
    const before = (await dbEvents(c.card.id)).length;
    for (const variant of [
      { ...body, title: 'Due' },
      { ...body, interviewers: [] },
      { ...body, type: 'final' },
    ]) {
      expect((await create(c, variant)).status).toBe(409);
    }
    expect((await create(c, body, other)).status).toBe(409);
    expect(await list(c)).toHaveLength(1);
    expect((await dbEvents(c.card.id)).length).toBe(before);
  });

  it('round successivo: il retry non crea un terzo round né un secondo evento', async () => {
    const c = await setupCard('ivi-next@example.com');
    const first = uid();
    await create(c, { id: first, title: 'Screening' });
    const next = { id: uid(), followUpOf: first };
    expect((await create(c, next)).status).toBe(201);
    expect((await create(c, next)).status).toBe(200);
    expect((await list(c)).map((i) => i.sequence)).toEqual([1, 2]);
    expect(await countOf('interview_next_round_created', c.card.id)).toBe(1);
  });

  it('concorrenza: identiche → un round; stesso ID e payload diverso → uno vince; ID diversi → sequenze distinte', async () => {
    const c = await setupCard('ivi-race@example.com');
    const same = { id: uid(), title: 'Identico' };
    const a = await Promise.all(Array.from({ length: 5 }, () => create(c, same)));
    expect(a.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 201]);
    expect(await list(c)).toHaveLength(1);

    const id = uid();
    const b = await Promise.all(['x', 'y', 'z'].map((title) => create(c, { id, title })));
    expect(b.filter((r) => r.status === 201)).toHaveLength(1);
    expect(b.filter((r) => r.status === 409)).toHaveLength(2);

    const many = await Promise.all(
      Array.from({ length: 10 }, (_, i) => create(c, { id: uid(), title: `R${i}` })),
    );
    expect(many.every((r) => r.status === 201)).toBe(true);
    const sequences = (await list(c)).map((i) => i.sequence);
    expect(sequences).toEqual(Array.from({ length: sequences.length }, (_, i) => i + 1));
    expect(await countOf('interview_created', c.card.id)).toBe(sequences.length);
  });

  it('tetto per scheda atomico anche con ID del client', async () => {
    const c = await setupCard('ivi-cap@example.com');
    for (let i = 0; i < LIMITS.interviewsPerCardMax; i++) await create(c, { id: uid() });
    const over = await create(c, { id: uid() });
    expect(over.status).toBe(409);
    expect(await list(c)).toHaveLength(LIMITS.interviewsPerCardMax);
  });

  it('isolamento: lo stesso ID in un altro workspace è un’altra operazione che non rivela nulla', async () => {
    const a = await setupCard('ivi-iso-a@example.com');
    const b = await setupCard('ivi-iso-b@example.com');
    const id = uid();
    await create(a, { id, title: 'Riservato-A' });
    const res = await create(b, { id, title: 'Riservato-A' });
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).not.toContain(a.workspaceId);
    expect(await list(b)).toHaveLength(0);
    const stranger = await newUser('ivi-iso-c@example.com');
    expect((await stranger.api.post(`/cards/${a.card.id}/interviews`, { id: uid() })).status).toBe(
      404,
    );
  });

  it('un guasto nell’evento annulla la creazione (nessun round orfano); poi lo stesso ID riesce', async () => {
    const c = await setupCard('ivi-rollback@example.com');
    const body = { id: uid(), title: 'Fragile' };
    await exec(`CREATE TRIGGER fail_iv BEFORE INSERT ON activity_events WHEN NEW.type = 'interview_created'
      BEGIN SELECT RAISE(ABORT, 'guasto simulato'); END`);
    let failed;
    try {
      failed = await create(c, body);
    } finally {
      await exec('DROP TRIGGER fail_iv');
    }
    expect(failed.status).toBeGreaterThanOrEqual(400);
    expect(await list(c)).toHaveLength(0);
    expect(await countOf('interview_created', c.card.id)).toBe(0);
    const ok = await create(c, body);
    expect(ok.status).toBe(201);
    expect(await list(c)).toHaveLength(1);
  });

  it('candidatura archiviata: nuova creazione 409, ma il retry di una già avvenuta resta 200', async () => {
    const c = await setupCard('ivi-archived@example.com');
    const body = { id: uid() };
    await create(c, body);
    await c.api.post(`/cards/${c.card.id}/archive`, {});
    expect((await create(c, { id: uid() })).status).toBe(409);
    expect((await create(c, body)).status).toBe(200);
  });

  it('ID malformato → 400', async () => {
    const c = await setupCard('ivi-badid@example.com');
    expect((await create(c, { id: 'x' })).status).toBe(400);
    expect((await create(c, { id: 'a'.repeat(65) })).status).toBe(400);
    expect((await create(c, { id: "a'; DROP TABLE cards;--aaaaaaaa" })).status).toBe(400);
  });
});

describe('fingerprint', () => {
  it('canonico: ordine delle chiavi irrilevante, undefined omesso, annidamento stabile', async () => {
    expect(canonicalJson({ b: 1, a: [{ d: undefined, c: 2 }] })).toBe(
      canonicalJson({ a: [{ c: 2 }], b: 1 }),
    );
    expect(await requestFingerprint('s', { a: 1, b: 2 })).toBe(
      await requestFingerprint('s', { b: 2, a: 1 }),
    );
  });
  it('sensibile a ogni campo e all’ambito; 64 caratteri esadecimali', async () => {
    const base = await requestFingerprint('note.create', {
      workspaceId: 'w',
      cardId: 'c',
      body: 'x',
    });
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(
      await requestFingerprint('document.create', { workspaceId: 'w', cardId: 'c', body: 'x' }),
    ).not.toBe(base);
    for (const changed of [{ workspaceId: 'w2' }, { cardId: 'c2' }, { body: 'y' }]) {
      expect(
        await requestFingerprint('note.create', {
          workspaceId: 'w',
          cardId: 'c',
          body: 'x',
          ...changed,
        }),
      ).not.toBe(base);
    }
    void env;
  });
});
