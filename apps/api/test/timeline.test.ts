import { env } from 'cloudflare:workers';
import { timelineResponse } from '@jobward/schemas';
import { describe, expect, it } from 'vitest';
import { clientFor, newUser } from './kanban-helpers';
import { dbEvents, setupCard, transition, uid, type Ctx } from './m3-helpers';

const page = async (c: Ctx, query = '') =>
  timelineResponse.parse((await c.api.get(`/cards/${c.card.id}/timeline${query}`)).body);

/** Scrive eventi di sistema con istanti scelti (anche uguali) per provare l'ordine totale. */
async function insertEvents(c: Ctx, rows: { id: string; at: number; type?: string }[]) {
  await env.DB.batch(
    rows.map((r) =>
      env.DB.prepare(
        `INSERT INTO activity_events (id, workspace_id, board_id, card_id, type, metadata, occurred_at)
         VALUES (?1, ?2, ?3, ?4, ?5, '{}', ?6)`,
      ).bind(r.id, c.workspaceId, c.boardId, c.card.id, r.type ?? 'priority_changed', r.at),
    ),
  );
}
const insertNote = (c: Ctx, id: string, at: number, body = 'nota') =>
  env.DB.prepare(
    `INSERT INTO card_notes (id, workspace_id, card_id, body, request_fingerprint, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`,
  )
    .bind(id, c.workspaceId, c.card.id, body, 'b'.repeat(64), at)
    .run();

async function everything(c: Ctx, limit: number) {
  const seen: { id: string; source: string; occurredAt: number }[] = [];
  let before: string | null = null;
  for (let guard = 0; guard < 100; guard++) {
    const p = await page(c, `?limit=${limit}${before ? `&before=${before}` : ''}`);
    seen.push(...p.entries);
    if (!p.nextCursor) return seen;
    before = p.nextCursor;
  }
  throw new Error('paginazione infinita');
}

describe('GET /cards/:id/timeline — aggregazione e ordine', () => {
  it('unisce eventi di sistema e note, dal più recente; note distinte e con collegamento', async () => {
    const c = await setupCard('tl-merge@example.com');
    const noteId = uid();
    await insertNote(c, noteId, 9_000_000_000_000);
    await transition(c.api, c.card.id, { to: 'applied', kind: 'advance' });
    const t = await page(c);
    expect(t.entries[0]).toMatchObject({
      id: noteId,
      source: 'note',
      kind: 'note',
      entity: { type: 'note', id: noteId },
      data: { body: 'nota' },
    });
    const kinds = t.entries.filter((e) => e.source === 'system').map((e) => e.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(['card_created', 'stage_changed', 'application_submitted']),
    );
    for (const e of t.entries) {
      if (e.source === 'system') expect(e.entity).toMatchObject({ type: 'card', id: c.card.id });
    }
    expect(t.nextCursor).toBeNull();
  });

  it('i colloqui puntano alla loro entità; la riapertura compare come evento dedicato', async () => {
    const c = await setupCard('tl-entities@example.com');
    const iv = (await c.api.post(`/cards/${c.card.id}/interviews`, { title: 'Tecnico' })).body
      .interview;
    await transition(c.api, c.card.id, { to: 'rejected', kind: 'close' });
    await transition(c.api, c.card.id, { to: 'applied', kind: 'reopen' });
    const t = await page(c);
    expect(t.entries.find((e) => e.kind === 'interview_created')?.entity).toEqual({
      type: 'interview',
      id: iv.id,
    });
    expect(t.entries.map((e) => e.kind)).toContain('application_reopened');
  });

  it('ordine totale e stabile a parità di istante: (istante, id, source) decrescente', async () => {
    const c = await setupCard('tl-order@example.com');
    const T = 8_000_000_000_000;
    await insertEvents(c, [
      { id: 'evt-b', at: T },
      { id: 'evt-a', at: T },
      { id: 'evt-c', at: T },
      { id: 'evt-old', at: T - 1 },
    ]);
    await insertNote(c, 'evt-b', T); // stesso id e stesso istante di un evento di sistema
    await insertNote(c, 'note-z', T);
    const ids = (await page(c)).entries
      .filter((e) => e.occurredAt >= T - 1)
      .map((e) => `${e.id}:${e.source}`);
    expect(ids).toEqual([
      'note-z:note',
      'evt-c:system',
      'evt-b:system',
      'evt-b:note',
      'evt-a:system',
      'evt-old:system',
    ]);
    // stesso risultato a ogni lettura
    expect((await page(c)).entries.map((e) => `${e.id}:${e.source}`)).toEqual(
      (await page(c)).entries.map((e) => `${e.id}:${e.source}`),
    );
  });
});

describe('paginazione a cursore', () => {
  it('nessun salto né duplicato, con qualunque dimensione di pagina, anche con istanti ripetuti e id uguali fra fonti', async () => {
    const c = await setupCard('tl-paging@example.com');
    const T = 7_000_000_000_000;
    const rows = Array.from({ length: 23 }, (_, i) => ({
      id: `e-${String(i).padStart(3, '0')}`,
      at: T + (i % 4),
    }));
    await insertEvents(c, rows);
    for (let i = 0; i < 9; i++)
      await insertNote(c, i % 3 === 0 ? `e-${String(i).padStart(3, '0')}` : `n-${i}`, T + (i % 4));
    const all = await everything(c, 50);
    const expected = all.map((e) => `${e.source}:${e.id}`);
    expect(new Set(expected).size).toBe(expected.length);
    expect(expected.length).toBeGreaterThanOrEqual(23 + 9);
    for (const size of [1, 2, 3, 5, 7, 10, 31]) {
      const paged = (await everything(c, size)).map((e) => `${e.source}:${e.id}`);
      expect(paged, `limit=${size}`).toEqual(expected);
    }
  });

  it('un evento nuovo fra due pagine non sposta né duplica le voci già lette', async () => {
    const c = await setupCard('tl-stable@example.com');
    await insertEvents(
      c,
      Array.from({ length: 6 }, (_, i) => ({ id: `s-${i}`, at: 6_000_000_000_000 + i })),
    );
    const first = await page(c, '?limit=3');
    await insertEvents(c, [{ id: 'nuovo', at: 6_500_000_000_000 }]);
    const second = await page(c, `?limit=3&before=${first.nextCursor}`);
    const ids = [...first.entries, ...second.entries].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain('nuovo');
  });

  it('limiti e cursore: default 25, massimo 50, valori fuori intervallo e cursori manipolati → 400', async () => {
    const c = await setupCard('tl-limits@example.com');
    await insertEvents(
      c,
      Array.from({ length: 30 }, (_, i) => ({ id: `l-${i}`, at: 5_000_000_000_000 + i })),
    );
    expect((await page(c)).entries).toHaveLength(25);
    expect((await page(c, '?limit=50')).entries.length).toBeGreaterThan(25);
    for (const q of [
      '?limit=0',
      '?limit=51',
      '?limit=abc',
      '?before=%%%',
      '?before=AAAA',
      `?before=${btoa('[1,"x","boh"]')}`,
    ]) {
      const res = await c.api.get(`/cards/${c.card.id}/timeline${q}`);
      expect(res.status, q).toBe(400);
    }
  });
});

describe('riservatezza e isolamento', () => {
  it('non espone autore, chiavi di deduplica, fingerprint, ID di operazione né testo libero di sistema', async () => {
    const c = await setupCard('tl-secrets@example.com');
    await c.api.patch(`/cards/${c.card.id}`, { priority: 'high' });
    await c.api.post(`/cards/${c.card.id}/interviews`, {
      id: uid(),
      title: 'Titolo-riservato',
      preparationNotes: 'prep-segreta',
      scheduledAt: Date.now() + 1e8,
    });
    await transition(c.api, c.card.id, { to: 'applied', kind: 'advance', appliedOn: '2026-11-03' });
    await c.api.post(`/cards/${c.card.id}/notes`, { id: uid(), body: 'nota-visibile' });
    // metadati "sporchi" scritti da una versione futura/ostile: la whitelist li scarta
    await env.DB.prepare(
      `INSERT INTO activity_events (id, workspace_id, board_id, card_id, type, metadata, occurred_at)
       VALUES ('dirty', ?1, ?2, ?3, 'card_moved', ?4, 1)`,
    )
      .bind(
        c.workspaceId,
        c.boardId,
        c.card.id,
        JSON.stringify({
          toColumnId: 'col-1',
          toColumnName: 'Colonna-riservata',
          note: 'testo-libero',
          nested: { a: 1 },
        }),
      )
      .run();
    const raw = JSON.stringify((await c.api.get(`/cards/${c.card.id}/timeline?limit=50`)).body);
    for (const forbidden of [
      c.userId,
      'dedupe',
      'fingerprint',
      'operation',
      'Titolo-riservato',
      'prep-segreta',
      'Colonna-riservata',
      'testo-libero',
      'actor',
    ]) {
      expect(raw, forbidden).not.toContain(forbidden);
    }
    expect(raw).toContain('nota-visibile'); // la nota compare come nota, la sua fonte
    // per i colloqui l'ID di operazione è l'ID (pubblico) del colloquio: si controllano le transizioni
    const pipelineOps = (await dbEvents(c.card.id)).filter(
      (x) => x.operation_id && !x.type.startsWith('interview_'),
    );
    expect(pipelineOps.length).toBeGreaterThan(0);
    for (const e of pipelineOps) {
      expect(raw).not.toContain(e.operation_id!);
    }
    expect(raw).toContain('col-1'); // gli ID strutturati ammessi restano
  });

  it('le note eliminate (lapidi) non compaiono', async () => {
    const c = await setupCard('tl-tombstone@example.com');
    const id = uid();
    await c.api.post(`/cards/${c.card.id}/notes`, { id, body: 'effimera' });
    await c.api.delete(`/notes/${id}`);
    const t = await page(c);
    expect(t.entries.some((e) => e.source === 'note')).toBe(false);
  });

  it('candidatura archiviata: la timeline resta leggibile', async () => {
    const c = await setupCard('tl-archived@example.com');
    await c.api.post(`/cards/${c.card.id}/archive`, {});
    const t = await page(c);
    expect(t.entries.map((e) => e.kind)).toContain('card_archived');
  });

  it('una scheda di un altro workspace o inesistente è 404; nessun evento altrui nelle pagine', async () => {
    const a = await setupCard('tl-iso-a@example.com');
    const b = await setupCard('tl-iso-b@example.com');
    await a.api.post(`/cards/${a.card.id}/notes`, { id: uid(), body: 'solo-di-A' });
    expect((await b.api.get(`/cards/${a.card.id}/timeline`)).status).toBe(404);
    expect(
      (await clientFor('tl-iso-b@example.com', a.workspaceId).get(`/cards/${a.card.id}/timeline`))
        .status,
    ).toBe(404);
    expect((await b.api.get(`/cards/${uid()}/timeline`)).status).toBe(404);
    expect(JSON.stringify((await page(b)).entries)).not.toContain('solo-di-A');
    void newUser;
  });
});
