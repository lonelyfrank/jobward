import { env } from 'cloudflare:workers';
import { schema } from '@jobward/database';
import { addDays, compareTasks, localDate, summarizeTasks, type TaskCounts } from '@jobward/shared';
import { describe, expect, it } from 'vitest';
import { addCard, clientFor, createMinimalBoard, newUser, type Api } from './kanban-helpers';
import { db, seedTask, seedWorkspace } from './helpers';
import { cardState, transition, uid } from './m3-helpers';

const today = () => localDate(Date.now(), 'UTC'); // i workspace di prova sono in UTC

let counter = 0;
const body = (over: Record<string, unknown> = {}) => ({
  id: uid(),
  title: `Attività ${(counter += 1)}`,
  ...over,
});
const create = (api: Api, over: Record<string, unknown> = {}) => api.post('/tasks', body(over));
const make = async (api: Api, over: Record<string, unknown> = {}) => {
  const res = await create(api, over);
  if (res.status !== 201) throw new Error(`creazione fallita: ${JSON.stringify(res.body)}`);
  return res.body.task;
};
const rowOf = async (id: string) =>
  env.DB.prepare('SELECT * FROM tasks WHERE id = ?1').bind(id).first<any>();
const countRows = async (workspaceId: string) =>
  (
    await env.DB.prepare('SELECT count(*) AS n FROM tasks WHERE workspace_id = ?1')
      .bind(workspaceId)
      .first<{ n: number }>()
  )?.n;
async function allTasks(api: Api, view: string, limit = 100) {
  const out: any[] = [];
  let cursor: string | null = null;
  do {
    const res: any = await api.get(
      `/tasks?view=${view}&limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`,
    );
    expect(res.status).toBe(200);
    out.push(...res.body.tasks);
    cursor = res.body.nextCursor;
  } while (cursor);
  return out;
}

describe('creazione', () => {
  it('attività indipendente: 201, aperta, con data e fuso del server; persiste', async () => {
    const { api } = await newUser('t-create@example.com');
    const res = await create(api, {
      title: '  Aggiornare il CV  ',
      dueOn: today(),
      priority: 'high',
    });
    expect(res.status).toBe(201);
    expect(res.body.task).toMatchObject({
      title: 'Aggiornare il CV',
      status: 'open',
      kind: 'general',
      priority: 'high',
      dueOn: today(),
      cardId: null,
      card: null,
      completedAt: null,
      cancelledAt: null,
      description: null,
    });
    expect(res.body.asOf).toEqual({ today: today(), timeZone: 'UTC' });
    const row = await rowOf(res.body.task.id);
    expect(row.request_fingerprint).toHaveLength(64);
    expect(row.due_at).toBeNull(); // la colonna legacy non si scrive
    expect((await api.get(`/tasks/${res.body.task.id}`)).body.task.title).toBe('Aggiornare il CV');
  });

  it('collegata a una candidatura: il riepilogo della card serve ai link', async () => {
    const { api } = await newUser('t-linked@example.com');
    const board = await createMinimalBoard(api);
    const card = await addCard(api, board.columnIds[0]!, 'Infermiere');
    const task = await make(api, { cardId: card.id, kind: 'follow_up' });
    expect(task.kind).toBe('follow_up');
    expect(task.card).toEqual({
      id: card.id,
      boardId: board.boardId,
      title: 'Infermiere',
      company: null,
      archived: false,
    });
  });

  it('validazione 400: titolo, data, chiavi sconosciute, stato non scrivibile, id', async () => {
    const { api } = await newUser('t-400@example.com');
    for (const over of [
      { title: '   ' },
      { title: 'x'.repeat(201) },
      { description: 'x'.repeat(2001) },
      { dueOn: '2026-02-30' },
      { dueOn: '2026-11-10T09:00:00Z' },
      { dueAt: '2026-11-10T09:00:00Z' },
      { workspaceId: 'altro' },
      { status: 'done' },
      { kind: 'other' },
      { id: 'corto' },
    ]) {
      const res = await create(api, over);
      expect(res.status, JSON.stringify(over)).toBe(400);
      expect(res.body.error.code).toBe('validation_error');
    }
  });

  it('scheda inesistente o di un altro workspace → 404 (identico)', async () => {
    const a = await newUser('t-cross-a@example.com');
    const b = await newUser('t-cross-b@example.com');
    const board = await createMinimalBoard(b.api);
    const foreign = await addCard(b.api, board.columnIds[0]!, 'Altrui');
    const r1 = await create(a.api, { cardId: foreign.id });
    const r2 = await create(a.api, { cardId: 'non-esiste-xxxxxxxx' });
    expect(r1.status).toBe(404);
    expect(r2.status).toBe(404);
    expect(r1.body.error.message).toBe(r2.body.error.message);
    expect(await countRows(a.workspaceId)).toBe(0);
  });
});

describe('idempotenza', () => {
  it('replay: stesso ID e stessa richiesta → 200, una sola riga, nessuna seconda creazione', async () => {
    const { api, workspaceId } = await newUser('t-replay@example.com');
    const payload = body({ dueOn: today() });
    const first = await api.post('/tasks', payload);
    const again = await api.post('/tasks', payload);
    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(again.body.task.id).toBe(first.body.task.id);
    expect(await countRows(workspaceId)).toBe(1);
  });

  it('stesso ID con payload diverso → 409 e nessuna modifica', async () => {
    const { api, workspaceId } = await newUser('t-diff@example.com');
    const payload = body({ title: 'Originale' });
    await api.post('/tasks', payload);
    const other = await api.post('/tasks', { ...payload, title: 'Diverso' });
    expect(other.status).toBe(409);
    expect((await rowOf(payload.id)).title).toBe('Originale');
    expect(await countRows(workspaceId)).toBe(1);
  });

  it('il replay dopo una modifica restituisce lo stato CORRENTE (il fingerprint è quello della creazione)', async () => {
    const { api } = await newUser('t-replay-edit@example.com');
    const payload = body({ title: 'Prima' });
    const created = (await api.post('/tasks', payload)).body.task;
    await api.patch(`/tasks/${created.id}`, {
      expectedUpdatedAt: created.updatedAt,
      title: 'Dopo',
    });
    const replay = await api.post('/tasks', payload);
    expect(replay.status).toBe(200);
    expect(replay.body.task.title).toBe('Dopo');
  });

  it('richieste simultanee identiche convergono su una sola attività', async () => {
    const { api, workspaceId } = await newUser('t-conc-same@example.com');
    const payload = body();
    const results = await Promise.all(Array.from({ length: 6 }, () => api.post('/tasks', payload)));
    expect(results.every((r) => r.status === 201 || r.status === 200)).toBe(true);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await countRows(workspaceId)).toBe(1);
  });

  it('richieste simultanee diverse con lo stesso ID: una sola creazione, le altre 409', async () => {
    const { api, workspaceId } = await newUser('t-conc-diff@example.com');
    const id = uid();
    const results = await Promise.all(
      ['A', 'B', 'C'].map((title) => api.post('/tasks', { id, title })),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    expect(await countRows(workspaceId)).toBe(1);
  });

  it('lo stesso ID in due workspace diversi non si confonde con un replay', async () => {
    const a = await newUser('t-id-a@example.com');
    const b = await newUser('t-id-b@example.com');
    const payload = body();
    expect((await a.api.post('/tasks', payload)).status).toBe(201);
    const res = await b.api.post('/tasks', payload);
    // la chiave primaria è globale: il secondo workspace NON vede la riga altrui e non ne eredita il contenuto
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).not.toContain(a.workspaceId);
    expect(await countRows(b.workspaceId)).toBe(0);
  });
});

describe('stati e comandi', () => {
  it('complete / reopen / cancel: transizioni, timestamp e replay idempotenti', async () => {
    const { api } = await newUser('t-states@example.com');
    const t = await make(api);

    const done = await api.post(`/tasks/${t.id}/complete`);
    expect(done.status).toBe(200);
    expect(done.body.task).toMatchObject({ status: 'done', cancelledAt: null });
    const completedAt = done.body.task.completedAt;
    expect(completedAt).toBeGreaterThan(0);

    const replay = await api.post(`/tasks/${t.id}/complete`);
    expect(replay.status).toBe(200);
    expect(replay.body.task.completedAt).toBe(completedAt); // timestamp NON ritoccato
    expect(replay.body.task.updatedAt).toBe(done.body.task.updatedAt);

    expect((await api.post(`/tasks/${t.id}/cancel`)).status).toBe(409); // completata: riaprire prima
    const reopened = await api.post(`/tasks/${t.id}/reopen`);
    expect(reopened.body.task).toMatchObject({
      status: 'open',
      completedAt: null,
      cancelledAt: null,
    });
    expect((await api.post(`/tasks/${t.id}/reopen`)).status).toBe(200); // già aperta: no-op

    const cancelled = await api.post(`/tasks/${t.id}/cancel`);
    expect(cancelled.body.task).toMatchObject({ status: 'cancelled', completedAt: null });
    expect((await api.post(`/tasks/${t.id}/cancel`)).status).toBe(200);
    expect((await api.post(`/tasks/${t.id}/complete`)).status).toBe(409); // annullata: riaprire prima
    expect((await api.post(`/tasks/${t.id}/reopen`)).body.task.status).toBe('open');
  });

  it('updatedAt cresce SEMPRE (monotono) anche con più scritture nello stesso millisecondo', async () => {
    const { api } = await newUser('t-mono@example.com');
    const t = await make(api);
    const stamps = [t.updatedAt];
    for (const action of ['complete', 'reopen', 'cancel', 'reopen']) {
      stamps.push((await api.post(`/tasks/${t.id}/${action}`)).body.task.updatedAt);
    }
    for (let i = 1; i < stamps.length; i += 1) expect(stamps[i]).toBeGreaterThan(stamps[i - 1]);
  });

  it('i comandi non accettano un corpo e rispettano workspace e 404', async () => {
    const a = await newUser('t-cmd-a@example.com');
    const b = await newUser('t-cmd-b@example.com');
    const t = await make(a.api);
    expect((await a.api.post(`/tasks/${t.id}/complete`, { status: 'x' })).status).toBe(400);
    for (const action of ['complete', 'reopen', 'cancel']) {
      expect((await b.api.post(`/tasks/${t.id}/${action}`)).status).toBe(404);
      expect((await a.api.post(`/tasks/nonesiste00000000/${action}`)).status).toBe(404);
    }
    expect((await rowOf(t.id)).completed_at).toBeNull();
  });

  it('complete e cancel simultanei: uno vince, l’altro 409; mai entrambi i timestamp', async () => {
    const { api } = await newUser('t-race@example.com');
    const t = await make(api);
    const [x, y] = await Promise.all([
      api.post(`/tasks/${t.id}/complete`),
      api.post(`/tasks/${t.id}/cancel`),
    ]);
    expect([x.status, y.status].sort()).toEqual([200, 409]);
    const row = await rowOf(t.id);
    expect((row.completed_at === null) !== (row.cancelled_at === null)).toBe(true);
  });

  it('completare non modifica la pipeline della candidatura, e viceversa', async () => {
    const { api } = await newUser('t-pipeline@example.com');
    const board = await createMinimalBoard(api);
    const card = await addCard(api, board.columnIds[0]!, 'Infermiere');
    const task = await make(api, { cardId: card.id, kind: 'follow_up' });
    const before = await cardState(api, card.id);
    await api.post(`/tasks/${task.id}/complete`);
    expect(await cardState(api, card.id)).toEqual(before);

    await api.post(`/tasks/${task.id}/reopen`);
    expect(
      (await transition(api, card.id, { to: 'applied', kind: 'advance', expectedFrom: 'saved' }))
        .status,
    ).toBe(200);
    expect((await api.get(`/tasks/${task.id}`)).body.task.status).toBe('open'); // la pipeline non tocca le task
    expect(
      (
        await transition(api, card.id, {
          to: 'rejected',
          kind: 'close',
          expectedFrom: 'applied',
          futureInterviews: 'keep',
        })
      ).status,
    ).toBe(200);
    const after = await api.get(`/tasks/${task.id}`);
    expect(after.body.task.status).toBe('open'); // la chiusura NON completa né annulla
    expect((await api.post(`/tasks/${task.id}/complete`)).status).toBe(200); // e resta modificabile
  });
});

describe('modifica (compare-and-swap)', () => {
  it('aggiorna i campi, azzera con null e fa avanzare il token', async () => {
    const { api } = await newUser('t-patch@example.com');
    const board = await createMinimalBoard(api);
    const card = await addCard(api, board.columnIds[0]!, 'Uno');
    const t = await make(api, { description: 'd', dueOn: today(), cardId: card.id });
    const res = await api.patch(`/tasks/${t.id}`, {
      expectedUpdatedAt: t.updatedAt,
      title: 'Nuovo',
      priority: 'urgent',
      kind: 'preparation',
      description: null,
      dueOn: null,
      cardId: null,
    });
    expect(res.status).toBe(200);
    expect(res.body.task).toMatchObject({
      title: 'Nuovo',
      priority: 'urgent',
      kind: 'preparation',
      description: null,
      dueOn: null,
      cardId: null,
      card: null,
    });
    expect(res.body.task.updatedAt).toBeGreaterThan(t.updatedAt);
  });

  it('token scaduto → 409 senza scrivere; due PATCH con lo stesso token: uno 200, l’altro 409', async () => {
    const { api } = await newUser('t-cas@example.com');
    const t = await make(api, { title: 'Base' });
    const stale = await api.patch(`/tasks/${t.id}`, {
      expectedUpdatedAt: t.updatedAt - 1,
      title: 'X',
    });
    expect(stale.status).toBe(409);
    expect((await rowOf(t.id)).title).toBe('Base');
    const [a, b] = await Promise.all([
      api.patch(`/tasks/${t.id}`, { expectedUpdatedAt: t.updatedAt, title: 'A' }),
      api.patch(`/tasks/${t.id}`, { expectedUpdatedAt: t.updatedAt, title: 'B' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });

  it('400: nessun campo, token mancante, chiavi sconosciute, stato non scrivibile', async () => {
    const { api } = await newUser('t-patch400@example.com');
    const t = await make(api);
    for (const json of [
      { expectedUpdatedAt: t.updatedAt },
      { title: 'x' },
      { expectedUpdatedAt: t.updatedAt, status: 'done' },
      { expectedUpdatedAt: t.updatedAt, dueOn: '2026-02-30' },
      { expectedUpdatedAt: t.updatedAt, title: '' },
    ])
      expect((await api.patch(`/tasks/${t.id}`, json)).status, JSON.stringify(json)).toBe(400);
  });

  it('le completate e le annullate non si modificano: 409 finché non si riaprono', async () => {
    const { api } = await newUser('t-patch-closed@example.com');
    const t = await make(api);
    const done = (await api.post(`/tasks/${t.id}/complete`)).body.task;
    expect(
      (await api.patch(`/tasks/${t.id}`, { expectedUpdatedAt: done.updatedAt, title: 'x' })).status,
    ).toBe(409);
    const open = (await api.post(`/tasks/${t.id}/reopen`)).body.task;
    expect(
      (await api.patch(`/tasks/${t.id}`, { expectedUpdatedAt: open.updatedAt, title: 'x' })).status,
    ).toBe(200);
  });

  it('ricollegamento: stesso workspace sì; altro workspace 404; archiviata 409', async () => {
    const a = await newUser('t-relink-a@example.com');
    const b = await newUser('t-relink-b@example.com');
    const board = await createMinimalBoard(a.api);
    const c1 = await addCard(a.api, board.columnIds[0]!, 'Uno');
    const c2 = await addCard(a.api, board.columnIds[0]!, 'Due');
    const other = await addCard(b.api, (await createMinimalBoard(b.api)).columnIds[0]!, 'Altrui');
    const t = await make(a.api, { cardId: c1.id });
    const moved = await a.api.patch(`/tasks/${t.id}`, {
      expectedUpdatedAt: t.updatedAt,
      cardId: c2.id,
    });
    expect(moved.body.task.cardId).toBe(c2.id);
    const foreign = await a.api.patch(`/tasks/${t.id}`, {
      expectedUpdatedAt: moved.body.task.updatedAt,
      cardId: other.id,
    });
    expect(foreign.status).toBe(404);
    await a.api.post(`/cards/${c1.id}/archive`);
    const toArchived = await a.api.patch(`/tasks/${t.id}`, {
      expectedUpdatedAt: moved.body.task.updatedAt,
      cardId: c1.id,
    });
    expect(toArchived.status).toBe(409);
    expect((await rowOf(t.id)).card_id).toBe(c2.id);
  });
});

describe('autorizzazione e isolamento', () => {
  it('workspace altrui: 404 identico all’inesistente, nessun dato altrui negli elenchi', async () => {
    const a = await newUser('t-iso-a@example.com');
    const b = await newUser('t-iso-b@example.com');
    const t = await make(a.api, { title: 'Riservata di A' });
    const mineInB = clientFor('t-iso-b@example.com', b.workspaceId);
    expect((await mineInB.get(`/tasks/${t.id}`)).status).toBe(404);
    expect(
      (await mineInB.patch(`/tasks/${t.id}`, { expectedUpdatedAt: t.updatedAt, title: 'x' }))
        .status,
    ).toBe(404);
    const intruder = clientFor('t-iso-b@example.com', a.workspaceId); // B chiede il workspace di A
    for (const res of [
      await intruder.get('/tasks'),
      await intruder.get('/tasks/summary'),
      await intruder.get(`/tasks/${t.id}`),
      await intruder.post('/tasks', body()),
    ])
      expect(res.status).toBe(404);
    await make(b.api, { title: 'Di B' });
    const listA = JSON.stringify((await a.api.get('/tasks')).body);
    const listB = JSON.stringify((await b.api.get('/tasks')).body);
    expect(listA).toContain('Riservata di A');
    expect(listA).not.toContain('Di B');
    expect(listB).not.toContain('Riservata di A');
    expect((await b.api.get('/tasks/summary')).body.counts.open).toBe(1);
  });

  it('un membro viewer legge ma non scrive (403)', async () => {
    const owner = await newUser('t-view-owner@example.com');
    const t = await make(owner.api);
    const viewer = await seedWorkspace('t-view-viewer@example.com');
    await db().insert(schema.workspaceMembers).values({
      workspaceId: owner.workspaceId,
      userId: viewer.userId,
      role: 'viewer',
      createdAt: Date.now(),
    });
    const v = clientFor('t-view-viewer@example.com', owner.workspaceId);
    expect((await v.get('/tasks')).status).toBe(200);
    expect((await v.get(`/tasks/${t.id}`)).status).toBe(200);
    expect((await v.post('/tasks', body())).status).toBe(403);
    expect(
      (await v.patch(`/tasks/${t.id}`, { expectedUpdatedAt: t.updatedAt, title: 'x' })).status,
    ).toBe(403);
    expect((await v.post(`/tasks/${t.id}/complete`)).status).toBe(403);
    expect((await rowOf(t.id)).completed_at).toBeNull();
  });

  it('non esiste alcun DELETE: le attività si annullano', async () => {
    const { api } = await newUser('t-nodelete@example.com');
    const t = await make(api);
    expect([404, 405]).toContain((await api.delete(`/tasks/${t.id}`)).status);
    expect(await rowOf(t.id)).not.toBeNull();
  });
});

describe('elenco, filtri, ordinamento e paginazione a cursore', () => {
  it('viste: open, done, overdue, no_due, cancelled, all', async () => {
    const { api, workspaceId } = await newUser('t-views@example.com');
    const t = today();
    const ids = {
      overdue: await seedTask(workspaceId, { title: 'scaduta', dueOn: addDays(t, -2) }),
      today: await seedTask(workspaceId, { title: 'oggi', dueOn: t }),
      later: await seedTask(workspaceId, { title: 'dopo', dueOn: addDays(t, 9) }),
      none: await seedTask(workspaceId, { title: 'senza' }),
      done: await seedTask(workspaceId, { title: 'fatta', dueOn: t, completedAt: Date.now() }),
      cancelled: await seedTask(workspaceId, { title: 'annullata', cancelledAt: Date.now() }),
    };
    const titles = async (view: string) => (await allTasks(api, view)).map((x) => x.title);
    expect(await titles('open')).toEqual(['scaduta', 'oggi', 'dopo', 'senza']);
    expect(await titles('overdue')).toEqual(['scaduta']);
    expect(await titles('no_due')).toEqual(['senza']);
    expect(await titles('done')).toEqual(['fatta']);
    expect(await titles('cancelled')).toEqual(['annullata']);
    expect(await titles('all')).toEqual(['scaduta', 'oggi', 'dopo', 'senza', 'fatta']); // aperte, poi completate
    expect(Object.keys(ids)).toHaveLength(6);
    expect((await api.get('/tasks?view=late')).status).toBe(400);
  });

  it('ordine = funzione pura compareTasks (data, priorità, creazione, id), indipendente dall’ordine d’inserimento', async () => {
    const { api, workspaceId } = await newUser('t-order@example.com');
    const t = today();
    const specs: [string | null, 'none' | 'low' | 'medium' | 'high' | 'urgent'][] = [
      [null, 'none'],
      [t, 'low'],
      [t, 'urgent'],
      [addDays(t, 1), 'high'],
      [t, 'low'],
      [null, 'urgent'],
      [addDays(t, -3), 'none'],
      [t, 'urgent'],
      [addDays(t, 1), 'none'],
    ];
    for (const [i, [dueOn, priority]] of specs.entries())
      await seedTask(workspaceId, { title: `n${i}`, dueOn, priority });
    const rows = await allTasks(api, 'open', 100);
    const sorted = [...rows].sort((a, b) => compareTasks(a, b));
    expect(rows.map((r) => r.id)).toEqual(sorted.map((r) => r.id));
  });

  it('paginazione: nessun duplicato né salto, anche con modifiche fra una pagina e l’altra', async () => {
    const { api, workspaceId } = await newUser('t-page@example.com');
    const t = today();
    const seeded: string[] = [];
    for (let i = 0; i < 11; i += 1)
      seeded.push(
        await seedTask(workspaceId, {
          title: `p${i}`,
          dueOn: i % 3 === 0 ? null : addDays(t, i % 2),
          priority: i % 2 ? 'high' : 'none',
        }),
      );
    const full = (await allTasks(api, 'open', 100)).map((r) => r.id);
    expect(full).toHaveLength(11);

    const page1 = (await api.get('/tasks?view=open&limit=4')).body;
    expect(page1.tasks).toHaveLength(4);
    expect(page1.nextCursor).toBeTruthy();
    // fra una pagina e l'altra: si completa una task già vista e se ne crea una nuova che va in testa
    await api.post(`/tasks/${page1.tasks[0].id}/complete`);
    const newest = await make(api, { title: 'in testa', dueOn: addDays(t, -10) });
    const rest: any[] = [];
    let cursor: string | null = page1.nextCursor;
    while (cursor) {
      const res: any = await api.get(`/tasks?view=open&limit=4&cursor=${cursor}`);
      rest.push(...res.body.tasks);
      cursor = res.body.nextCursor;
    }
    const seen = [...page1.tasks.map((x: any) => x.id), ...rest.map((x) => x.id)];
    expect(new Set(seen).size).toBe(seen.length); // nessun duplicato
    const expectedRest = full.slice(4); // le rimanenti dopo la pagina 1 (la nuova in testa NON riappare)
    expect(rest.map((x) => x.id)).toEqual(expectedRest);
    expect(seen).not.toContain(newest.id);
    expect(seeded.length).toBe(11);
  });

  it('cursore manomesso o di un’altra vista, limiti non validi → 400', async () => {
    const { api, workspaceId } = await newUser('t-cursor@example.com');
    for (let i = 0; i < 3; i += 1) await seedTask(workspaceId, { title: `c${i}` });
    await seedTask(workspaceId, { title: 'd', completedAt: Date.now() });
    const open = (await api.get('/tasks?view=open&limit=1')).body.nextCursor;
    expect(open).toBeTruthy();
    for (const path of [
      '/tasks?cursor=@@@',
      `/tasks?view=open&cursor=${open}x`,
      `/tasks?view=done&cursor=${open}`,
      '/tasks?limit=0',
      '/tasks?limit=101',
      '/tasks?limit=abc',
    ])
      expect((await api.get(path)).status, path).toBe(400);
    expect((await api.get('/tasks?limit=100')).status).toBe(200);
  });

  it('«Tutte» attraversa il confine aperte → completate nei cursori', async () => {
    const { api, workspaceId } = await newUser('t-all@example.com');
    for (let i = 0; i < 3; i += 1) await seedTask(workspaceId, { title: `a${i}` });
    for (let i = 0; i < 3; i += 1)
      await seedTask(workspaceId, { title: `d${i}`, completedAt: 1000 + i });
    const collected: string[] = [];
    let cursor: string | null = null;
    do {
      const res: any = await api.get(`/tasks?view=all&limit=2${cursor ? `&cursor=${cursor}` : ''}`);
      collected.push(...res.body.tasks.map((x: any) => `${x.status}:${x.title}`));
      cursor = res.body.nextCursor;
    } while (cursor);
    expect(collected.map((c) => c.split(':')[0])).toEqual([
      'open',
      'open',
      'open',
      'done',
      'done',
      'done',
    ]);
    expect(collected.slice(3)).toEqual(['done:d2', 'done:d1', 'done:d0']); // completate: più recenti prima
  });
});

describe('riepilogo e coerenza con Overview', () => {
  it('conteggi = oracolo puro; /summary e /overview concordano; annullate e card archiviate escluse', async () => {
    const { api, workspaceId } = await newUser('t-summary@example.com');
    const board = await createMinimalBoard(api);
    const card = await addCard(api, board.columnIds[0]!, 'Archiviabile');
    const t = today();
    await seedTask(workspaceId, { title: 'a', dueOn: addDays(t, -1) });
    await seedTask(workspaceId, { title: 'b', dueOn: t });
    await seedTask(workspaceId, { title: 'c', dueOn: t });
    await seedTask(workspaceId, { title: 'd', dueOn: addDays(t, 5) });
    await seedTask(workspaceId, { title: 'e' });
    await seedTask(workspaceId, { title: 'f', completedAt: 5 });
    await seedTask(workspaceId, { title: 'g', cancelledAt: 5, dueOn: t });
    await seedTask(workspaceId, { title: 'su archiviata', dueOn: addDays(t, -1), cardId: card.id });
    await api.post(`/cards/${card.id}/archive`);

    const summary = (await api.get('/tasks/summary')).body;
    const oracle: TaskCounts = summarizeTasks(
      [
        { dueOn: addDays(t, -1), status: 'open' },
        { dueOn: t, status: 'open' },
        { dueOn: t, status: 'open' },
        { dueOn: addDays(t, 5), status: 'open' },
        { dueOn: null, status: 'open' },
        { dueOn: null, status: 'done' },
      ],
      t,
    );
    expect(summary.counts).toEqual(oracle);
    expect(summary.asOf.today).toBe(t);
    const overview = (await api.get('/overview')).body;
    expect(overview.counts).toMatchObject({
      openTasks: oracle.open,
      overdueTasks: oracle.overdue,
      dueTodayTasks: oracle.today,
      noDueTasks: oracle.noDue,
    });
  });
});

describe('candidatura archiviata e ripristinata', () => {
  it('task invariate ma escluse e in sola lettura; il ripristino le riporta tali e quali', async () => {
    const { api } = await newUser('t-archive@example.com');
    const board = await createMinimalBoard(api);
    const card = await addCard(api, board.columnIds[0]!, 'Da archiviare');
    const task = await make(api, { cardId: card.id, dueOn: today() });
    const free = await make(api, { title: 'libera' });
    const before = await rowOf(task.id);

    await api.post(`/cards/${card.id}/archive`);
    expect((await allTasks(api, 'open')).map((x) => x.id)).toEqual([free.id]); // esclusa dall'elenco operativo
    expect((await api.get('/tasks/summary')).body.counts.open).toBe(1); // e dai contatori
    const viaCard = await api.get(`/tasks?cardId=${card.id}`); // ma leggibile dalla candidatura
    expect(viaCard.body.tasks.map((x: any) => x.id)).toEqual([task.id]);
    const detail = await api.get(`/tasks/${task.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.task.card.archived).toBe(true);

    expect(
      (await api.patch(`/tasks/${task.id}`, { expectedUpdatedAt: task.updatedAt, title: 'x' }))
        .status,
    ).toBe(409);
    for (const action of ['complete', 'cancel'])
      expect((await api.post(`/tasks/${task.id}/${action}`)).status).toBe(409);
    expect((await create(api, { cardId: card.id })).status).toBe(409);
    expect(await rowOf(task.id)).toEqual(before); // dati invariati

    await api.post(`/cards/${card.id}/restore`);
    expect((await allTasks(api, 'open')).map((x) => x.id).sort()).toEqual(
      [task.id, free.id].sort(),
    );
    expect((await api.post(`/tasks/${task.id}/complete`)).status).toBe(200);
  });

  it('i comandi già raggiunti restano 200 anche su una card archiviata (replay)', async () => {
    const { api } = await newUser('t-archive-replay@example.com');
    const board = await createMinimalBoard(api);
    const card = await addCard(api, board.columnIds[0]!, 'X');
    const task = await make(api, { cardId: card.id });
    await api.post(`/tasks/${task.id}/complete`);
    await api.post(`/cards/${card.id}/archive`);
    expect((await api.post(`/tasks/${task.id}/complete`)).status).toBe(200);
    expect((await api.post(`/tasks/${task.id}/reopen`)).status).toBe(409);
  });
});

describe('limiti per workspace (atomici)', () => {
  const bulk = (workspaceId: string, n: number, completed: boolean) =>
    env.DB.exec(
      `INSERT INTO tasks (id, workspace_id, title, completed_at, created_at, updated_at) WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${n}) SELECT '${completed ? 'dn' : 'op'}-' || i || '-${workspaceId.slice(0, 8)}-xxxxxxxx', '${workspaceId}', 't', ${completed ? 1 : 'NULL'}, 1, 1 FROM n`,
    );

  it('501ª attività aperta rifiutata; completarne una libera un posto; la riapertura rispetta il tetto', async () => {
    const { api, workspaceId } = await newUser('t-cap-open@example.com');
    await bulk(workspaceId, 500, false);
    const refused = await create(api);
    expect(refused.status).toBe(409);
    expect(await countRows(workspaceId)).toBe(500);

    const first = (await api.get('/tasks?view=open&limit=1')).body.tasks[0];
    expect((await api.post(`/tasks/${first.id}/complete`)).status).toBe(200);
    const accepted = await make(api);
    expect(accepted.status).toBe('open');
    expect((await api.post(`/tasks/${first.id}/reopen`)).status).toBe(409); // di nuovo 500 aperte
    expect((await rowOf(first.id)).completed_at).not.toBeNull();
  });

  it('tetto totale: 5.000 attività in ogni stato', async () => {
    const { api, workspaceId } = await newUser('t-cap-total@example.com');
    await bulk(workspaceId, 5000, true);
    expect(await countRows(workspaceId)).toBe(5000);
    expect((await create(api)).status).toBe(409);
    expect(await countRows(workspaceId)).toBe(5000);
  });

  it('creazioni concorrenti vicino al tetto: mai oltre 500 aperte', async () => {
    const { api, workspaceId } = await newUser('t-cap-race@example.com');
    await bulk(workspaceId, 497, false);
    const results = await Promise.all(Array.from({ length: 8 }, () => create(api)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 409)).toHaveLength(5);
    const open = await env.DB.prepare(
      'SELECT count(*) AS n FROM tasks WHERE workspace_id = ?1 AND completed_at IS NULL AND cancelled_at IS NULL',
    )
      .bind(workspaceId)
      .first<{ n: number }>();
    expect(open?.n).toBe(500);
  });

  it('i tetti sono per workspace: un altro workspace non ne risente', async () => {
    const full = await newUser('t-cap-full@example.com');
    const other = await newUser('t-cap-other@example.com');
    await bulk(full.workspaceId, 500, false);
    expect((await create(full.api)).status).toBe(409);
    expect((await create(other.api)).status).toBe(201);
  });
});

describe('Timeline della candidatura: voci derivate dalle task (D-06)', () => {
  it('creata, completata, annullata; la riapertura fa sparire la voce; nessun testo libero', async () => {
    const { api } = await newUser('t-timeline@example.com');
    const board = await createMinimalBoard(api);
    const card = await addCard(api, board.columnIds[0]!, 'Con attività');
    const t1 = await make(api, { cardId: card.id, title: 'Titolo riservato', kind: 'follow_up' });
    const t2 = await make(api, { cardId: card.id, title: 'Altra riservata' });
    await make(api, { title: 'Senza card' });
    await api.post(`/tasks/${t1.id}/complete`);
    await api.post(`/tasks/${t2.id}/cancel`);

    const entries = (await api.get(`/cards/${card.id}/timeline?limit=50`)).body.entries.filter(
      (e: any) => e.source === 'task',
    );
    expect(entries.map((e: any) => e.kind).sort()).toEqual(
      ['task_cancelled', 'task_completed', 'task_created', 'task_created'].sort(),
    );
    expect(entries.every((e: any) => e.entity.type === 'task' && e.id.includes(':'))).toBe(true);
    const raw = JSON.stringify(entries);
    expect(raw).not.toContain('Titolo riservato');
    expect(raw).not.toContain('Altra riservata');
    expect(raw).not.toContain('Senza card');
    expect(entries.find((e: any) => e.kind === 'task_completed').data).toEqual({
      taskId: t1.id,
      taskKind: 'follow_up',
    });

    await api.post(`/tasks/${t1.id}/reopen`); // limite dichiarato: la voce «completata» sparisce
    const after = (await api.get(`/cards/${card.id}/timeline?limit=50`)).body.entries.filter(
      (e: any) => e.source === 'task',
    );
    expect(after.map((e: any) => e.kind)).not.toContain('task_completed');
  });

  it('paginazione stabile con tre fonti: nessun duplicato né salto', async () => {
    const { api } = await newUser('t-timeline-page@example.com');
    const board = await createMinimalBoard(api);
    const card = await addCard(api, board.columnIds[0]!, 'Tre fonti');
    for (let i = 0; i < 3; i += 1) {
      const task = await make(api, { cardId: card.id });
      await api.post(`/tasks/${task.id}/complete`);
      await api.post(`/cards/${card.id}/notes`, { id: uid(), body: `nota ${i}` });
    }
    const full = (await api.get(`/cards/${card.id}/timeline?limit=50`)).body.entries.map(
      (e: any) => `${e.source}|${e.id}`,
    );
    const paged: string[] = [];
    let cursor: string | null = null;
    do {
      const res: any = await api.get(
        `/cards/${card.id}/timeline?limit=3${cursor ? `&before=${cursor}` : ''}`,
      );
      paged.push(...res.body.entries.map((e: any) => `${e.source}|${e.id}`));
      cursor = res.body.nextCursor;
    } while (cursor);
    expect(paged).toEqual(full);
    expect(new Set(paged).size).toBe(paged.length);
    expect(full.filter((x: string) => x.startsWith('task|'))).toHaveLength(6); // 3 create + 3 completate
  });
});

describe('fusi orari', () => {
  it('«oggi» e le scadenze seguono il fuso del workspace, non UTC', async () => {
    const { workspaceId, userId } = await seedWorkspace('t-tz@example.com');
    void userId;
    await env.DB.prepare("UPDATE workspaces SET timezone = 'Pacific/Kiritimati' WHERE id = ?1")
      .bind(workspaceId)
      .run();
    const api = clientFor('t-tz@example.com', workspaceId);
    const kiritimati = localDate(Date.now(), 'Pacific/Kiritimati');
    const res = await create(api, { dueOn: kiritimati });
    expect(res.body.asOf).toEqual({ today: kiritimati, timeZone: 'Pacific/Kiritimati' });
    const summary = (await api.get('/tasks/summary')).body;
    expect(summary.counts).toMatchObject({ open: 1, today: 1, overdue: 0 });
    await create(api, { dueOn: addDays(kiritimati, -1) });
    expect((await api.get('/tasks/summary')).body.counts).toMatchObject({
      open: 2,
      today: 1,
      overdue: 1,
    });
  });
});
