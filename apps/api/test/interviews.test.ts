import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import {
  interviewResponse,
  interviewsResponse,
  opportunitiesResponse,
} from '@meet-roulette/schemas';
import { LIMITS } from '@meet-roulette/shared';
import { addCard, createMinimalBoard, newUser, type Api } from './kanban-helpers';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function setup(email: string) {
  const user = await newUser(email);
  const board = await createMinimalBoard(user.api);
  const card = await addCard(user.api, board.columnIds[0]!, 'Infermiere');
  return { ...user, ...board, card };
}
type Ctx = Awaited<ReturnType<typeof setup>>;

const create = (c: Ctx, body: object = {}, card = c.card.id) =>
  c.api.post(`/cards/${card}/interviews`, body);
const list = async (api: Api, cardId: string) =>
  interviewsResponse.parse((await api.get(`/cards/${cardId}/interviews`)).body).interviews;
const eventsOf = async (api: Api, cardId: string) =>
  (await api.get(`/cards/${cardId}`)).body.history as {
    type: string;
    metadata: Record<string, unknown>;
  }[];

describe('creazione di un round', () => {
  it("basta nulla: «da programmare», numero d'ordine 1, titolo «Round 1»; la scheda non cambia", async () => {
    const c = await setup('iv-create@example.com');
    const before = (await c.api.get(`/cards/${c.card.id}`)).body.card;
    const res = await create(c);
    expect(res.status).toBe(201);
    expect(interviewResponse.parse(res.body).interview).toMatchObject({
      sequence: 1,
      title: 'Round 1',
      type: 'other',
      status: 'to_schedule',
      scheduledAt: null,
      result: null,
      completedAt: null,
      interviewers: [],
    });
    const after = (await c.api.get(`/cards/${c.card.id}`)).body.card;
    // Nessun automatismo: colonna, fase, esito generale restano quelli di prima.
    expect(after).toMatchObject({
      columnId: before.columnId,
      stage: before.stage,
      outcome: before.outcome,
    });
    expect(after.interviewSummary).toMatchObject({
      total: 1,
      next: null,
      action: { kind: 'schedule', sequence: 1 },
    });
  });

  it('con una data diventa «programmato»; il fuso predefinito è quello del workspace', async () => {
    const c = await setup('iv-sched@example.com');
    const at = Date.now() + 3 * DAY;
    const res = await create(c, {
      title: 'Colloquio tecnico',
      type: 'technical',
      scheduledAt: at,
      durationMinutes: 60,
      modality: 'video',
      meetingUrl: 'https://meet.example.com/abc',
      interviewers: ['Mario Rossi', 'Anna Bianchi'],
      preparationNotes: 'Ripassare le basi',
    });
    expect(res.body.interview).toMatchObject({
      status: 'scheduled',
      scheduledAt: at,
      timezone: 'UTC',
      durationMinutes: 60,
      modality: 'video',
      interviewers: ['Mario Rossi', 'Anna Bianchi'],
    });
  });

  it('più round nella stessa candidatura: numeri stabili e consecutivi; il precedente non si tocca', async () => {
    const c = await setup('iv-multi@example.com');
    const first = (await create(c, { title: 'Primo' })).body.interview;
    const second = (await create(c, { title: 'Secondo' })).body.interview;
    const third = (await create(c, {})).body.interview;
    expect([first.sequence, second.sequence, third.sequence]).toEqual([1, 2, 3]);
    expect(third.title).toBe('Round 3');
    const all = await list(c.api, c.card.id);
    expect(all.map((i) => i.title)).toEqual(['Primo', 'Secondo', 'Round 3']);
    expect(all[0]!.id).toBe(first.id);
  });

  it('«fase successiva»: round collegato al precedente, evento dedicato, il precedente resta', async () => {
    const c = await setup('iv-next@example.com');
    const first = (await create(c, { title: 'Screening' })).body.interview;
    await c.api.post(`/interviews/${first.id}/complete`, { result: 'positive' });
    const next = await create(c, { title: 'Tecnico', followUpOf: first.id });
    expect(next.status).toBe(201);
    expect(next.body.interview.sequence).toBe(2);
    const events = await eventsOf(c.api, c.card.id);
    expect(events.map((e) => e.type)).toContain('interview_next_round_created');
    const ev = events.find((e) => e.type === 'interview_next_round_created')!;
    expect(ev.metadata).toMatchObject({ sequence: 2, previousSequence: 1 });
    expect((await list(c.api, c.card.id))[0]).toMatchObject({
      status: 'completed',
      result: 'positive',
    });
  });

  it("followUpOf di un'altra candidatura → 404", async () => {
    const c = await setup('iv-followother@example.com');
    const other = await addCard(c.api, c.columnIds[0]!, 'Altra');
    const foreign = (await create(c, {}, other.id)).body.interview;
    expect((await create(c, { followUpOf: foreign.id })).status).toBe(404);
  });

  it('tetto per candidatura applicato (409) e nessun round in più', async () => {
    const c = await setup('iv-cap@example.com');
    const now = Date.now();
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?1)
       INSERT INTO interviews (id, workspace_id, card_id, sequence, title, status, interviewers, created_at, updated_at)
       SELECT 'cap-' || i, ?2, ?3, i, 'R' || i, 'to_schedule', '[]', ?4, ?4 FROM n`,
    )
      .bind(LIMITS.interviewsPerCardMax, c.workspaceId, c.card.id, now)
      .run();
    const res = await create(c);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/al massimo/);
    expect(await list(c.api, c.card.id)).toHaveLength(LIMITS.interviewsPerCardMax);
  });

  it('validazione: campi fuori contratto, URL pericolosi, date assurde → 400', async () => {
    const c = await setup('iv-validate@example.com');
    const bad: object[] = [
      { type: 'colloquio' },
      { title: 'x'.repeat(121) },
      { scheduledAt: 1.5 },
      { scheduledAt: 10 },
      { scheduledAt: '2026-11-10' },
      { timezone: 'Marte/Olympus' },
      { durationMinutes: 0 },
      { durationMinutes: 2000 },
      { modality: 'telepatia' },
      { meetingUrl: 'javascript:alert(1)' },
      { interviewers: Array.from({ length: LIMITS.interviewersMax + 1 }, (_, i) => `P${i}`) },
      { interviewers: ['  '] },
      { interviewers: 'Mario' },
      { result: 'positive' }, // l'esito non esiste alla creazione
      { status: 'completed' },
      { sequence: 9 },
      { workspaceId: 'altro' },
    ];
    for (const body of bad) expect((await create(c, body)).status, JSON.stringify(body)).toBe(400);
    expect(await list(c.api, c.card.id)).toEqual([]);
  });
});

describe('programmare, riprogrammare, completare, annullare', () => {
  it("riprogrammare cambia la data, non lo stato; l'evento ha da/a e nessuna nota", async () => {
    const c = await setup('iv-resched@example.com');
    const a = Date.now() + DAY;
    const b = Date.now() + 5 * DAY;
    const iv = (await create(c, { scheduledAt: a, preparationNotes: 'NOTA-RISERVATA-1' })).body
      .interview;
    const res = await c.api.patch(`/interviews/${iv.id}`, { scheduledAt: b });
    expect(res.body.interview).toMatchObject({ status: 'scheduled', scheduledAt: b });
    const ev = (await eventsOf(c.api, c.card.id)).find((e) => e.type === 'interview_rescheduled')!;
    expect(ev.metadata).toMatchObject({ sequence: 1, from: a, to: b });
    expect(JSON.stringify(ev.metadata)).not.toContain('NOTA-RISERVATA');
  });

  it('data → «programmato»; data nulla → di nuovo «da programmare»', async () => {
    const c = await setup('iv-schedcycle@example.com');
    const iv = (await create(c)).body.interview;
    const at = Date.now() + DAY;
    expect(
      (await c.api.patch(`/interviews/${iv.id}`, { scheduledAt: at })).body.interview,
    ).toMatchObject({
      status: 'scheduled',
      timezone: 'UTC',
    });
    expect(
      (await c.api.patch(`/interviews/${iv.id}`, { scheduledAt: null })).body.interview,
    ).toMatchObject({
      status: 'to_schedule',
      scheduledAt: null,
    });
  });

  it('completare: stato e data di completamento; esito del round e feedback; NIENTE sulla candidatura', async () => {
    const c = await setup('iv-complete@example.com');
    const before = (await c.api.get(`/cards/${c.card.id}`)).body.card;
    const iv = (await create(c, { scheduledAt: Date.now() + HOUR })).body.interview;
    const res = await c.api.post(`/interviews/${iv.id}/complete`, {
      result: 'negative',
      feedbackNotes: 'FEEDBACK-RISERVATO-2',
    });
    expect(res.status).toBe(200);
    expect(res.body.interview).toMatchObject({
      status: 'completed',
      result: 'negative',
      feedbackNotes: 'FEEDBACK-RISERVATO-2',
    });
    expect(res.body.interview.completedAt).toBeGreaterThan(0);
    const card = (await c.api.get(`/cards/${c.card.id}`)).body.card;
    // Esito del round ≠ esito della candidatura; fase e colonna non si muovono.
    expect(card).toMatchObject({
      outcome: before.outcome,
      stage: before.stage,
      columnId: before.columnId,
      archivedAt: null,
    });
    const events = await eventsOf(c.api, c.card.id);
    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['interview_completed', 'interview_feedback_recorded']),
    );
    expect(JSON.stringify(events)).not.toContain('FEEDBACK-RISERVATO');
  });

  it('completare due volte → 409; la data di un completato non si cambia; il feedback si aggiunge dopo', async () => {
    const c = await setup('iv-twice@example.com');
    const iv = (await create(c, { scheduledAt: Date.now() + HOUR })).body.interview;
    await c.api.post(`/interviews/${iv.id}/complete`, {});
    expect((await c.api.post(`/interviews/${iv.id}/complete`, {})).status).toBe(409);
    expect(
      (await c.api.patch(`/interviews/${iv.id}`, { scheduledAt: Date.now() + DAY })).status,
    ).toBe(409);
    const fb = await c.api.patch(`/interviews/${iv.id}`, {
      feedbackNotes: 'Ottimo',
      result: 'positive',
    });
    expect(fb.body.interview).toMatchObject({
      feedbackNotes: 'Ottimo',
      result: 'positive',
      status: 'completed',
    });
    expect((await eventsOf(c.api, c.card.id)).map((e) => e.type)).toContain(
      'interview_feedback_recorded',
    );
  });

  it("feedback ed esito prima del completamento sono rifiutati (409): l'esito è un'altra cosa dallo stato", async () => {
    const c = await setup('iv-fb-early@example.com');
    const iv = (await create(c, { scheduledAt: Date.now() + DAY })).body.interview;
    expect((await c.api.patch(`/interviews/${iv.id}`, { result: 'positive' })).status).toBe(409);
    expect((await c.api.patch(`/interviews/${iv.id}`, { feedbackNotes: 'x' })).status).toBe(409);
    expect((await list(c.api, c.card.id))[0]).toMatchObject({ result: null, status: 'scheduled' });
  });

  it('annullare: stato «annullato», non è più il prossimo, resta nello storico; non si riattiva né si modifica', async () => {
    const c = await setup('iv-cancel@example.com');
    const iv = (await create(c, { scheduledAt: Date.now() + DAY })).body.interview;
    expect((await c.api.get(`/cards/${c.card.id}`)).body.card.interviewSummary.next?.id).toBe(
      iv.id,
    );
    const res = await c.api.post(`/interviews/${iv.id}/cancel`);
    expect(res.body.interview.status).toBe('cancelled');
    const summary = (await c.api.get(`/cards/${c.card.id}`)).body.card.interviewSummary;
    expect(summary).toMatchObject({ total: 0, next: null, action: null });
    expect((await list(c.api, c.card.id))[0]!.status).toBe('cancelled'); // lo storico c'è
    expect((await c.api.post(`/interviews/${iv.id}/cancel`)).status).toBe(409);
    expect((await c.api.patch(`/interviews/${iv.id}`, { title: 'x' })).status).toBe(409);
    expect((await c.api.post(`/interviews/${iv.id}/complete`, {})).status).toBe(409);
    expect((await eventsOf(c.api, c.card.id)).map((e) => e.type)).toContain('interview_cancelled');
  });

  it('un colloquio completato non si annulla', async () => {
    const c = await setup('iv-cancel-done@example.com');
    const iv = (await create(c)).body.interview;
    await c.api.post(`/interviews/${iv.id}/complete`, {});
    expect((await c.api.post(`/interviews/${iv.id}/cancel`)).status).toBe(409);
  });

  it("completare non conclude la candidatura: l'esito generale resta quello impostato dall'utente", async () => {
    const c = await setup('iv-outcome@example.com');
    await c.api.patch(`/cards/${c.card.id}`, { stage: 'interviewing', outcome: 'pending' });
    const iv = (await create(c, { scheduledAt: Date.now() + HOUR })).body.interview;
    await c.api.post(`/interviews/${iv.id}/complete`, { result: 'negative' });
    expect((await c.api.get(`/cards/${c.card.id}`)).body.card).toMatchObject({
      stage: 'interviewing',
      outcome: 'pending',
    });
    const overview = (await c.api.get('/overview')).body.counts;
    expect(overview.interviews).toBe(1); // le statistiche non cambiano da sole
  });
});

describe('riepilogo per Kanban, tabella e pannello', () => {
  it('il prossimo colloquio è il primo programmato non trascorso (annullati e passati esclusi)', async () => {
    const c = await setup('iv-next-pick@example.com');
    const far = (await create(c, { title: 'Lontano', scheduledAt: Date.now() + 9 * DAY })).body
      .interview;
    const near = (await create(c, { title: 'Vicino', scheduledAt: Date.now() + 2 * DAY })).body
      .interview;
    const cancelled = (await create(c, { title: 'Annullato', scheduledAt: Date.now() + DAY })).body
      .interview;
    await c.api.post(`/interviews/${cancelled.id}/cancel`);
    const summary = (await c.api.get(`/cards/${c.card.id}`)).body.card.interviewSummary;
    expect(summary.next).toMatchObject({ id: near.id, title: 'Vicino' });
    expect(summary.total).toBe(2);
    void far;
  });

  it('la «prossima azione» discende dai dati: aggiorna > feedback > programma; mai inventata', async () => {
    const c = await setup('iv-action@example.com');
    const now = Date.now();
    const sql = (
      id: string,
      seq: number,
      status: string,
      scheduled: number | null,
      completed: number | null,
    ) =>
      env.DB.prepare(
        `INSERT INTO interviews (id, workspace_id, card_id, sequence, title, status, scheduled_at, completed_at, interviewers, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, '[]', ?9, ?9)`,
      )
        .bind(id, c.workspaceId, c.card.id, seq, `R${seq}`, status, scheduled, completed, now)
        .run();
    const action = async () =>
      (await c.api.get(`/cards/${c.card.id}`)).body.card.interviewSummary.action;
    expect(await action()).toBeNull(); // nessun colloquio: nessuna azione
    await sql('a3', 3, 'to_schedule', null, null);
    expect(await action()).toMatchObject({ kind: 'schedule', sequence: 3 });
    await sql('a2', 2, 'completed', now - DAY, now - DAY); // completato senza feedback
    expect(await action()).toMatchObject({ kind: 'record_feedback', sequence: 2 });
    await sql('a1', 1, 'scheduled', now - 2 * HOUR, null); // data trascorsa
    expect(await action()).toMatchObject({ kind: 'overdue', sequence: 1 });
  });

  it("la bacheca, l'elenco archiviate e la ricerca includono il riepilogo (senza note)", async () => {
    const c = await setup('iv-board@example.com');
    const other = await addCard(c.api, c.columnIds[0]!, 'Senza colloqui');
    await create(c, { title: 'R1', scheduledAt: Date.now() + DAY, preparationNotes: 'SEGRETO-3' });
    const board = (await c.api.get(`/boards/${c.boardId}`)).body;
    const mine = board.cards.find((k: { id: string }) => k.id === c.card.id);
    const none = board.cards.find((k: { id: string }) => k.id === other.id);
    expect(mine.interviewSummary).toMatchObject({ total: 1, next: { title: 'R1' } });
    expect(none.interviewSummary).toEqual({ total: 0, completed: 0, next: null, action: null });
    expect(JSON.stringify(board)).not.toContain('SEGRETO-3');
    const found = opportunitiesResponse.parse(
      (await c.api.get('/opportunities?q=Infermiere')).body,
    );
    expect(found.items[0]!.interviewSummary.next?.title).toBe('R1');
    await c.api.post(`/cards/${c.card.id}/archive`);
    const archived = (await c.api.get(`/boards/${c.boardId}/archived`)).body.cards[0];
    expect(archived.interviewSummary.total).toBe(1);
  });

  it('nessun N+1: una bacheca con molte schede e colloqui si carica con prestazioni costanti', async () => {
    const c = await setup('iv-perf@example.com');
    const now = Date.now();
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 1500)
       INSERT INTO cards (id, workspace_id, board_id, column_id, title, position, priority, created_at, updated_at)
       SELECT 'pc-' || i, ?1, ?2, ?3, 'Scheda ' || i, i * 1024, 'none', ?4, ?4 FROM n`,
    )
      .bind(c.workspaceId, c.boardId, c.columnIds[0], now)
      .run();
    await env.DB.prepare(
      `INSERT INTO interviews (id, workspace_id, card_id, sequence, title, status, scheduled_at, interviewers, created_at, updated_at)
       SELECT 'pi-' || id, workspace_id, id, 1, 'R1', 'scheduled', ?2 + position, '[]', ?2, ?2 FROM cards WHERE workspace_id = ?1 AND id LIKE 'pc-%'`,
    )
      .bind(c.workspaceId, now + DAY)
      .run();
    const start = performance.now();
    const res = await c.api.get(`/boards/${c.boardId}`);
    const ms = performance.now() - start;
    expect(res.status).toBe(200);
    const withNext = res.body.cards.filter(
      (k: { interviewSummary: { next: unknown } }) => k.interviewSummary.next,
    );
    expect(withNext).toHaveLength(1500);
    expect(ms).toBeLessThan(2500);
  }, 60_000);
});

describe('candidature archiviate', () => {
  it('lo storico si conserva e si legge; le modifiche richiedono il ripristino', async () => {
    const c = await setup('iv-archived@example.com');
    const iv = (await create(c, { scheduledAt: Date.now() + DAY })).body.interview;
    await c.api.post(`/interviews/${iv.id}/complete`, { feedbackNotes: 'Bene' });
    await c.api.post(`/cards/${c.card.id}/archive`);
    expect(await list(c.api, c.card.id)).toHaveLength(1);
    expect((await list(c.api, c.card.id))[0]).toMatchObject({
      status: 'completed',
      feedbackNotes: 'Bene',
    });
    expect((await create(c)).status).toBe(409);
    expect((await c.api.patch(`/interviews/${iv.id}`, { feedbackNotes: 'x' })).status).toBe(409);
    await c.api.post(`/cards/${c.card.id}/restore`);
    expect(await list(c.api, c.card.id)).toHaveLength(1);
    expect((await create(c)).status).toBe(201);
  });
});

describe('isolamento tra workspace', () => {
  it("ogni operazione su colloqui altrui è 404 indistinguibile dall'inesistente e non cambia nulla", async () => {
    const victim = await setup('iv-iso-a@example.com');
    const attacker = await setup('iv-iso-b@example.com');
    const iv = (
      await create(victim, { scheduledAt: Date.now() + DAY, preparationNotes: 'RISERVATA-4' })
    ).body.interview;
    const a = attacker.api;
    const ghost = 'inesistente';
    const attempts: [
      string,
      () => Promise<{ status: number; body: any }>,
      () => Promise<{ status: number; body: any }>,
    ][] = [
      [
        'GET',
        () => a.get(`/cards/${victim.card.id}/interviews`),
        () => a.get(`/cards/${ghost}/interviews`),
      ],
      [
        'POST',
        () => create(attacker, { title: 'Intruso' }, victim.card.id),
        () => create(attacker, { title: 'Intruso' }, ghost),
      ],
      [
        'PATCH',
        () => a.patch(`/interviews/${iv.id}`, { title: 'hack' }),
        () => a.patch(`/interviews/${ghost}`, { title: 'hack' }),
      ],
      [
        'complete',
        () => a.post(`/interviews/${iv.id}/complete`, {}),
        () => a.post(`/interviews/${ghost}/complete`, {}),
      ],
      [
        'cancel',
        () => a.post(`/interviews/${iv.id}/cancel`),
        () => a.post(`/interviews/${ghost}/cancel`),
      ],
    ];
    for (const [label, attack, control] of attempts) {
      const res = await attack();
      const nothing = await control();
      expect(res.status, label).toBe(404);
      expect(res.body.error.code, label).toBe(nothing.body.error.code);
      expect(JSON.stringify(res.body), label).not.toContain('RISERVATA');
    }
    expect((await list(victim.api, victim.card.id))[0]).toMatchObject({
      title: 'Round 1',
      status: 'scheduled',
    });
    // La scheda dell'attaccante non mostra colloqui altrui; il suo followUpOf non può puntare a quello altrui.
    expect((await create(attacker, { followUpOf: iv.id })).status).toBe(404);
    expect(await list(attacker.api, attacker.card.id)).toEqual([]);
  });

  it('il database rifiuta un colloquio su una scheda di un altro workspace anche saltando il servizio', async () => {
    const a = await setup('iv-db-a@example.com');
    const b = await setup('iv-db-b@example.com');
    const result = await env.DB.prepare(
      `INSERT INTO interviews (id, workspace_id, card_id, sequence, title, status, interviewers, created_at, updated_at)
       VALUES ('x1', ?1, ?2, 1, 'Intruso', 'to_schedule', '[]', 1, 1)`,
    )
      .bind(b.workspaceId, a.card.id)
      .run()
      .then(
        () => 'inserito',
        (e: Error) => e.message,
      );
    expect(result).not.toBe('inserito');
  });
});
