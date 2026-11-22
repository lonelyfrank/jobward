import { setApplicationState } from './helpers';
import { env } from 'cloudflare:workers';
import { newId } from '@jobward/database';
import { globalSearchResponse, opportunitiesResponse, overviewResponse } from '@jobward/schemas';
import { compareByQuerySort } from '@jobward/shared';
import { describe, expect, it } from 'vitest';
import { seedBoardWithColumn, seedWorkspace } from './helpers';
import { addCard, createMinimalBoard, newUser, type Api } from './kanban-helpers';
import { transition } from './m3-helpers';

/**
 * Posizionamento facoltativo (M5-SW.10-a, migrazione 0008, ADR-0016): un'opportunità può non appartenere
 * a nessuna bacheca. Qui si prova, con il codice e lo schema reali:
 *  - Tabella, ricerca globale, Overview e dettaglio mostrano anche le opportunità senza bacheca;
 *  - la semantica NULL del Query Engine v2 (ordinamenti per bacheca/colonna, filtri);
 *  - l'eliminazione di una bacheca NON elimina le opportunità e NON modifica le fasi;
 *  - isolamento tra workspace, compatibilità dei contratti legacy, vincoli del database.
 */

interface Item {
  id: string;
  title: string;
  boardId: string | null;
  boardName: string | null;
  columnName: string | null;
}

/** Ricerca nella Tabella: `pageSize` e `archived` hanno un predefinito che la query può sostituire (API strict). */
const q = async (api: Api, query: string) => {
  const params = new URLSearchParams(query.replace(/^&/, ''));
  if (!params.has('pageSize')) params.set('pageSize', '50');
  if (!params.has('archived')) params.set('archived', 'include');
  const res = await api.get(`/opportunities?${params.toString()}`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return opportunitiesResponse.parse(res.body);
};
const ids = (items: readonly { id: string }[]) => items.map((i) => i.id);

/** Due bacheche: «Resta» (schede posizionate) ed «Elimina» (le sue schede restano senza bacheca). */
async function world(email: string) {
  const u = await newUser(email);
  const keep = await createMinimalBoard(u.api, 'Resta');
  const gone = await createMinimalBoard(u.api, 'Elimina');
  const A = await addCard(u.api, keep.columnIds[0]!, 'Alfa', {
    priority: 'high',
    details: { company: 'Acme', location: 'Roma' },
  });
  await setApplicationState(A.id, { stage: 'applied' });
  const B = await addCard(u.api, keep.columnIds[1]!, 'Beta', {
    details: { company: 'Beta' },
  });
  await setApplicationState(B.id, { stage: 'saved' });
  const C = await addCard(u.api, gone.columnIds[0]!, 'Gamma', {
    priority: 'high',
    details: { company: 'Acme' },
  });
  await setApplicationState(C.id, { stage: 'interviewing', appliedOn: '2026-10-01' });
  const D = await addCard(u.api, gone.columnIds[0]!, 'Delta');
  await setApplicationState(D.id, { stage: 'applied' });
  const E = await addCard(u.api, gone.columnIds[1]!, 'Eps', { priority: 'low' });
  const F = await addCard(u.api, gone.columnIds[1]!, 'Zeta');
  expect((await u.api.post(`/cards/${F.id}/archive`)).status).toBe(200);
  // Dati collegati a una scheda che resterà senza bacheca.
  const interviewId = crypto.randomUUID();
  expect(
    (
      await u.api.post(`/cards/${C.id}/interviews`, {
        id: interviewId,
        title: 'Screening Gamma',
        type: 'screening',
      })
    ).status,
  ).toBe(201);
  expect(
    (await u.api.post(`/cards/${C.id}/notes`, { id: crypto.randomUUID(), body: 'nota' })).status,
  ).toBe(201);
  expect(
    (
      await u.api.post(`/cards/${C.id}/documents`, {
        id: crypto.randomUUID(),
        title: 'CV',
        kind: 'cv',
      })
    ).status,
  ).toBe(201);
  expect(
    (await u.api.post('/tasks', { id: crypto.randomUUID(), title: 'Ricontattare', cardId: C.id }))
      .status,
  ).toBe(201);
  const before = await Promise.all(
    [A, B, C, D, E, F].map(async (c) => (await u.api.get(`/cards/${c.id}`)).body.card),
  );
  expect((await u.api.delete(`/boards/${gone.boardId}`)).status).toBe(200);
  return {
    ...u,
    keep,
    gone,
    ids: { A: A.id, B: B.id, C: C.id, D: D.id, E: E.id, F: F.id },
    before,
    interviewId,
  };
}

describe('opportunità senza bacheca — Tabella e Query Engine v2', () => {
  it('la Tabella elenca TUTTE le opportunità, con nomi di bacheca e colonna nulli per quelle senza bacheca', async () => {
    const w = await world('pl-table@example.com');
    const r = await q(w.api, '');
    expect(r.total).toBe(6);
    expect(ids(r.items).sort()).toEqual(Object.values(w.ids).sort());
    const byId = new Map(r.items.map((i) => [i.id, i]));
    expect(byId.get(w.ids.A)).toMatchObject({ boardId: w.keep.boardId, boardName: 'Resta' });
    for (const k of ['C', 'D', 'E', 'F'] as const) {
      expect(byId.get(w.ids[k])).toMatchObject({
        boardId: null,
        columnId: null,
        boardName: null,
        columnName: null,
      });
    }
  });

  it('i filtri funzionano su schede con e senza bacheca; boardId/columnId escludono quelle senza bacheca', async () => {
    const w = await world('pl-filter@example.com');
    const only = async (query: string) => ids((await q(w.api, query)).items).sort();
    expect(await only('&stage=applied')).toEqual([w.ids.A, w.ids.D].sort());
    expect(await only('&priority=high')).toEqual([w.ids.A, w.ids.C].sort());
    expect(await only(`&q=gamma`)).toEqual([w.ids.C]);
    const where = (clause: object) =>
      `&where=${encodeURIComponent(JSON.stringify({ v: 2, where: clause }))}`;
    expect(await only(where({ field: 'company', op: 'equals_any', value: ['acme'] }))).toEqual(
      [w.ids.A, w.ids.C].sort(),
    );
    expect(await only(where({ field: 'company', op: 'is_empty' }))).toEqual(
      [w.ids.D, w.ids.E, w.ids.F].sort(),
    );
    expect(await only(where({ field: 'stage', op: 'not_in', value: ['applied'] }))).toEqual(
      [w.ids.B, w.ids.C, w.ids.E, w.ids.F].sort(),
    );
    // Il filtro per bacheca è per identificatore: un'opportunità senza bacheca non ne fa parte.
    expect(await only(`&boardId=${w.keep.boardId}`)).toEqual([w.ids.A, w.ids.B].sort());
    expect(await only(`&columnId=${w.keep.columnIds[0]}`)).toEqual([w.ids.A]);
  });

  it('ordinamento per bacheca e per colonna: le senza bacheca vanno SEMPRE in fondo e coincide col valutatore in memoria', async () => {
    const w = await world('pl-sort@example.com');
    for (const sort of ['board', 'column'] as const) {
      for (const dir of ['asc', 'desc'] as const) {
        const r = await q(w.api, `&sort=${sort}&dir=${dir}`);
        expect(
          r.items.slice(-4).every((i) => i.boardName === null),
          `${sort} ${dir}`,
        ).toBe(true);
        expect(r.items.slice(0, 2).every((i) => i.boardName !== null)).toBe(true);
        // Parità: lo STESSO ordine che darebbe il valutatore TypeScript sugli stessi elementi.
        const memory = [...r.items].sort(compareByQuerySort([{ field: sort, dir }]));
        expect(ids(r.items), `${sort} ${dir}: SQL = memoria`).toEqual(ids(memory));
      }
    }
  });

  it('paginazione: pagine disgiunte che coprono tutte le opportunità, con ordinamento per bacheca', async () => {
    const w = await world('pl-page@example.com');
    const page = async (n: number) =>
      (await q(w.api, `&sort=board&pageSize=4&page=${n}`)).items as unknown as Item[];
    const [p1, p2] = [await page(1), await page(2)];
    expect(p1.length + p2.length).toBe(6);
    expect(new Set([...ids(p1), ...ids(p2)]).size).toBe(6);
  });
});

describe('opportunità senza bacheca — Overview, ricerca globale e dettaglio', () => {
  it('Overview e Tabella concordano; le recenti includono quelle senza bacheca', async () => {
    const w = await world('pl-overview@example.com');
    const o = overviewResponse.parse((await w.api.get('/overview')).body);
    const table = await q(w.api, '&archived=exclude');
    expect(o.counts.opportunities).toBe(table.total);
    expect(o.counts.opportunities).toBe(5); // 6 meno l'archiviata
    expect(o.recentCards).toHaveLength(5);
    const loose = o.recentCards.filter((c) => c.boardId === null);
    expect(loose.length).toBe(3);
    expect(loose.every((c) => c.boardName === null && c.columnName === null)).toBe(true);
  });

  it('la ricerca globale trova opportunità e colloqui di una scheda senza bacheca', async () => {
    const w = await world('pl-search@example.com');
    const r = globalSearchResponse.parse((await w.api.get('/search?q=Gamma')).body);
    expect(r.opportunities.map((o) => o.id)).toEqual([w.ids.C]);
    expect(r.opportunities[0]).toMatchObject({ boardId: null, archived: false });
    const iv = globalSearchResponse.parse((await w.api.get('/search?q=Screening')).body);
    expect(iv.interviews).toHaveLength(1);
    expect(iv.interviews[0]).toMatchObject({ id: w.interviewId, boardId: null, cardId: w.ids.C });
  });

  it('il dettaglio, la timeline, le note, i documenti e i colloqui di una scheda senza bacheca restano consultabili', async () => {
    const w = await world('pl-detail@example.com');
    const d = await w.api.get(`/cards/${w.ids.C}`);
    expect(d.body.card).toMatchObject({
      id: w.ids.C,
      boardId: null,
      columnId: null,
      company: 'Acme',
      stage: 'interviewing',
    });
    expect(d.body.history.map((e: { type: string }) => e.type)).toContain('card_created');
    expect((await w.api.get(`/cards/${w.ids.C}/timeline`)).status).toBe(200);
    expect((await w.api.get(`/cards/${w.ids.C}/notes`)).body.notes).toHaveLength(1);
    expect((await w.api.get(`/cards/${w.ids.C}/documents`)).body.documents).toHaveLength(1);
    expect((await w.api.get(`/cards/${w.ids.C}/interviews`)).body.interviews).toHaveLength(1);
    const task = await w.api.get('/tasks?view=open');
    expect(JSON.stringify(task.body)).toContain('Ricontattare');
  });

  it('si può continuare a lavorare su una scheda senza bacheca: modifica, note, colloqui, attività, pipeline, archivio', async () => {
    const w = await world('pl-work@example.com');
    const id = w.ids.D;
    expect(
      (await w.api.patch(`/cards/${id}`, { title: 'Delta 2', priority: 'urgent' })).body.card,
    ).toMatchObject({ title: 'Delta 2', boardId: null });
    expect(
      (await w.api.post(`/cards/${id}/notes`, { id: crypto.randomUUID(), body: 'x' })).status,
    ).toBe(201);
    expect(
      (await w.api.post(`/cards/${id}/interviews`, { id: crypto.randomUUID(), type: 'technical' }))
        .status,
    ).toBe(201);
    const t = await transition(w.api, id, {
      to: 'screening',
      kind: 'advance',
      expectedFrom: 'applied',
    });
    expect(t.status, JSON.stringify(t.body)).toBe(200);
    expect(t.body.transition).toMatchObject({ from: 'applied', to: 'screening' });
    expect(t.body.card.boardId).toBeNull();
    expect((await w.api.post(`/cards/${id}/archive`)).status).toBe(200);
    const restored = await w.api.post(`/cards/${id}/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body.card).toMatchObject({ boardId: null, columnId: null, archivedAt: null });
    // Gli eventi restano legati alla scheda, senza bacheca.
    const events = await env.DB.prepare(
      'SELECT board_id, card_id FROM activity_events WHERE card_id = ?1',
    )
      .bind(id)
      .all<{ board_id: string | null }>();
    expect(events.results.length).toBeGreaterThan(3);
    expect(events.results.every((e) => e.board_id === null)).toBe(true);
  });

  it('una scheda senza bacheca non si sposta tra colonne (409) e non riceve valori di campi di altre bacheche (404)', async () => {
    const w = await world('pl-nomove@example.com');
    const move = await w.api.post(`/cards/${w.ids.C}/move`, {
      columnId: w.keep.columnIds[0],
      afterCardId: null,
    });
    expect(move.status).toBe(409);
    expect(move.body.error.message).toContain('non appartiene a nessuna bacheca');
    const field = (
      await w.api.post(`/boards/${w.keep.boardId}/custom-fields`, { name: 'X', type: 'text' })
    ).body.field;
    expect(
      (await w.api.put(`/cards/${w.ids.C}/custom-fields/${field.id}`, { value: 'v' })).status,
    ).toBe(404);
    expect((await w.api.get(`/cards/${w.ids.C}/custom-fields`)).body.fields).toEqual([]);
  });
});

describe('eliminazione di una bacheca — nessuna perdita e nessuna modifica delle fasi', () => {
  it('fasi, esiti, date di invio, priorità, posizioni e aggiornamenti delle opportunità NON cambiano', async () => {
    const w = await world('pl-stages@example.com');
    const after = await Promise.all(
      Object.values(w.ids).map(async (id) => (await w.api.get(`/cards/${id}`)).body.card),
    );
    for (const [i, card] of after.entries()) {
      const prev = w.before[i];
      const { boardId, columnId, ...rest } = card;
      const { boardId: pb, columnId: pc, ...prevRest } = prev;
      expect(rest, `scheda ${card.title}`).toEqual(prevRest);
      expect(pb).not.toBeNull();
      expect(pc).not.toBeNull();
      if (['Gamma', 'Delta', 'Eps', 'Zeta'].includes(card.title))
        expect([boardId, columnId]).toEqual([null, null]);
    }
  });

  it('colloqui, note, documenti, attività, etichette ed eventi si conservano; sparisce solo ciò che era della bacheca', async () => {
    const w = await world('pl-keep@example.com');
    const n = async (sql: string) =>
      (await env.DB.prepare(sql).bind(w.workspaceId).first<{ n: number }>())?.n;
    expect(await n('SELECT count(*) n FROM cards WHERE workspace_id=?1')).toBe(6);
    expect(await n('SELECT count(*) n FROM interviews WHERE workspace_id=?1')).toBe(1);
    expect(await n('SELECT count(*) n FROM card_notes WHERE workspace_id=?1')).toBe(1);
    expect(await n('SELECT count(*) n FROM card_documents WHERE workspace_id=?1')).toBe(1);
    expect(
      await n('SELECT count(*) n FROM tasks WHERE workspace_id=?1 AND card_id IS NOT NULL'),
    ).toBe(1);
    // Una sola bacheca resta: colonne della bacheca eliminata e relativi campi sono spariti.
    expect(await n('SELECT count(*) n FROM boards WHERE workspace_id=?1')).toBe(1);
    expect(await n('SELECT count(*) n FROM board_columns WHERE workspace_id=?1')).toBe(3);
    // La cronologia è tutta consultabile per scheda: nessun evento orfano di scheda.
    expect(
      await n('SELECT count(*) n FROM activity_events WHERE workspace_id=?1 AND card_id IS NULL'),
    ).toBe(0);
  });

  it('eliminare una bacheca inesistente o altrui → 404 e non cambia nulla', async () => {
    const a = await world('pl-del-a@example.com');
    const b = await newUser('pl-del-b@example.com');
    expect((await a.api.delete('/boards/non-esiste')).status).toBe(404);
    expect((await b.api.delete(`/boards/${a.keep.boardId}`)).status).toBe(404);
    expect((await a.api.get(`/boards/${a.keep.boardId}`)).status).toBe(200);
    expect((await q(a.api, '')).total).toBe(6);
  });

  it('i valori dei campi personalizzati della bacheca eliminata spariscono; quelli di altre bacheche restano', async () => {
    const u = await newUser('pl-cf@example.com');
    const a = await createMinimalBoard(u.api, 'A');
    const b = await createMinimalBoard(u.api, 'B');
    const ca = await addCard(u.api, a.columnIds[0]!, 'Su A');
    const cb = await addCard(u.api, b.columnIds[0]!, 'Su B');
    const fa = (
      await u.api.post(`/boards/${a.boardId}/custom-fields`, { name: 'Reparto', type: 'text' })
    ).body.field;
    const fb = (
      await u.api.post(`/boards/${b.boardId}/custom-fields`, { name: 'Reparto', type: 'text' })
    ).body.field;
    expect((await u.api.put(`/cards/${ca.id}/custom-fields/${fa.id}`, { value: 'x' })).status).toBe(
      200,
    );
    expect((await u.api.put(`/cards/${cb.id}/custom-fields/${fb.id}`, { value: 'y' })).status).toBe(
      200,
    );
    expect((await u.api.delete(`/boards/${a.boardId}`)).status).toBe(200);
    const left = await env.DB.prepare(
      'SELECT card_id, field_id FROM custom_field_values WHERE workspace_id=?1',
    )
      .bind(u.workspaceId)
      .all<{ card_id: string; field_id: string }>();
    expect(left.results).toEqual([{ card_id: cb.id, field_id: fb.id }]);
  });
});

describe('isolamento tra workspace con opportunità senza bacheca', () => {
  it('un altro utente non vede, non elenca e non conta le opportunità senza bacheca', async () => {
    const a = await world('pl-iso-a@example.com');
    const b = await newUser('pl-iso-b@example.com');
    for (const id of [a.ids.C, a.ids.D, a.ids.E]) {
      expect((await b.api.get(`/cards/${id}`)).status).toBe(404);
      expect((await b.api.patch(`/cards/${id}`, { title: 'x' })).status).toBe(404);
      expect((await b.api.post(`/cards/${id}/archive`)).status).toBe(404);
      expect((await b.api.get(`/cards/${id}/timeline`)).status).toBe(404);
    }
    expect((await q(b.api, '')).total).toBe(0);
    expect(overviewResponse.parse((await b.api.get('/overview')).body).counts.opportunities).toBe(
      0,
    );
    expect(
      globalSearchResponse.parse((await b.api.get('/search?q=Gamma')).body).opportunities,
    ).toEqual([]);
  });

  it('eliminare un workspace con opportunità senza bacheca rimuove le sue e nient’altro', async () => {
    const a = await world('pl-ws-a@example.com');
    const b = await world('pl-ws-b@example.com');
    await env.DB.prepare('DELETE FROM workspaces WHERE id = ?1').bind(a.workspaceId).run();
    const count = async (ws: string) =>
      (
        await env.DB.prepare('SELECT count(*) n FROM cards WHERE workspace_id=?1')
          .bind(ws)
          .first<{ n: number }>()
      )?.n;
    expect(await count(a.workspaceId)).toBe(0);
    expect(await count(b.workspaceId)).toBe(6);
    expect((await q(b.api, '')).total).toBe(6);
  });
});

describe('compatibilità dei contratti legacy', () => {
  const CARD_KEYS = [
    'id',
    'boardId',
    'columnId',
    'title',
    'description',
    'priority',
    'position',
    'company',
    'jobTitle',
    'location',
    'workMode',
    'contractType',
    'salaryMin',
    'salaryMax',
    'currency',
    'salaryPeriod',
    'salaryBasis',
    'source',
    'sourceUrl',
    'publishedOn',
    'seniority',
    'deadlineOn',
    'requirements',
    'benefits',
    'interest',
    'companyId',
    'applicationId',
    'applicationCount',
    'appliedOn',
    'stage',
    'outcome',
    'labelIds',
    'interviewSummary',
    'createdAt',
    'updatedAt',
    'archivedAt',
  ].sort();

  it('le schede di una bacheca hanno la stessa forma di prima, con bacheca e colonna sempre valorizzate', async () => {
    const u = await newUser('pl-legacy@example.com');
    const b = await createMinimalBoard(u.api);
    const created = await u.api.post('/cards', {
      columnId: b.columnIds[0],
      title: 'Legacy',
      details: { company: 'X' },
    });
    expect(created.status).toBe(201);
    expect(Object.keys(created.body.card).sort()).toEqual(CARD_KEYS);
    expect(created.body.card.boardId).toBe(b.boardId);
    expect(created.body.card.columnId).toBe(b.columnIds[0]);
    const detail = await u.api.get(`/boards/${b.boardId}`);
    expect(detail.body.cards).toHaveLength(1);
    expect(Object.keys(detail.body.cards[0]).sort()).toEqual(CARD_KEYS);
    expect(typeof detail.body.cards[0].boardId).toBe('string');
    // Il Kanban non vede mai schede senza bacheca, né attive né archiviate.
    expect((await u.api.get(`/boards/${b.boardId}/archived`)).body.cards).toEqual([]);
  });

  it('lo spostamento tra colonne e l’archivio di una scheda in bacheca si comportano come prima', async () => {
    const u = await newUser('pl-legacy2@example.com');
    const b = await createMinimalBoard(u.api);
    const c = await addCard(u.api, b.columnIds[0]!, 'Muovi');
    const moved = await u.api.post(`/cards/${c.id}/move`, {
      columnId: b.columnIds[1],
      afterCardId: null,
    });
    expect(moved.status).toBe(200);
    expect(moved.body.card).toMatchObject({ boardId: b.boardId, columnId: b.columnIds[1] });
    // Spostare tra colonne NON cambia la fase (requisito 14).
    expect(moved.body.card.stage).toBeNull();
    expect((await u.api.post(`/cards/${c.id}/archive`)).body.card.boardId).toBe(b.boardId);
    expect((await u.api.post(`/cards/${c.id}/restore`)).body.card).toMatchObject({
      boardId: b.boardId,
      archivedAt: null,
    });
  });
});

describe('database — posizionamento facoltativo, FK composite con NULL e trigger', () => {
  const insert = (id: string, ws: string, board: string | null, column: string | null) =>
    env.DB.prepare(
      `INSERT INTO cards (id, workspace_id, board_id, column_id, title, position, priority, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 'x', 1, 'none', 1, 1)`,
    )
      .bind(id, ws, board, column)
      .run();

  async function seed() {
    const a = await seedWorkspace(`pl-db-${newId()}@example.com`);
    const b = await seedWorkspace(`pl-db-${newId()}@example.com`);
    const one = await seedBoardWithColumn(a.workspaceId);
    const two = await seedBoardWithColumn(a.workspaceId);
    const other = await seedBoardWithColumn(b.workspaceId);
    return { a, b, one, two, other };
  }

  it('board_id e column_id insieme NULL: accettato', async () => {
    const s = await seed();
    await expect(insert(newId(), s.a.workspaceId, null, null)).resolves.toBeDefined();
  });

  it('uno solo dei due NULL: rifiutato dal CHECK cards_placement_pair (altrimenti le FK composite non si applicherebbero)', async () => {
    const s = await seed();
    await expect(insert(newId(), s.a.workspaceId, s.one.boardId, null)).rejects.toThrow(
      /cards_placement_pair/,
    );
    await expect(insert(newId(), s.a.workspaceId, null, s.one.columnId)).rejects.toThrow(
      /cards_placement_pair/,
    );
  });

  it('colonna di un’altra bacheca o bacheca di un altro workspace: rifiutato dalle FK composite', async () => {
    const s = await seed();
    await expect(insert(newId(), s.a.workspaceId, s.one.boardId, s.two.columnId)).rejects.toThrow(
      /FOREIGN KEY/,
    );
    await expect(
      insert(newId(), s.a.workspaceId, s.other.boardId, s.other.columnId),
    ).rejects.toThrow(/FOREIGN KEY/);
  });

  it('un figlio non può puntare a una scheda di un altro workspace, anche se la scheda non ha bacheca', async () => {
    const s = await seed();
    const card = newId();
    await insert(card, s.a.workspaceId, null, null);
    await expect(
      env.DB.prepare(
        `INSERT INTO card_notes (id, workspace_id, card_id, body, request_fingerprint, created_at, updated_at) VALUES (?1, ?2, ?3, 'n', ?4, 1, 1)`,
      )
        .bind(newId(), s.b.workspaceId, card, 'a'.repeat(64))
        .run(),
    ).rejects.toThrow(/FOREIGN KEY/);
  });

  it('eliminare una bacheca con schede o una colonna con schede è RIFIUTATO e non cancella nulla (fail-closed)', async () => {
    const s = await seed();
    const card = newId();
    await insert(card, s.a.workspaceId, s.one.boardId, s.one.columnId);
    await expect(
      env.DB.prepare('DELETE FROM boards WHERE id = ?1').bind(s.one.boardId).run(),
    ).rejects.toThrow(/FOREIGN KEY/);
    await expect(
      env.DB.prepare('DELETE FROM board_columns WHERE id = ?1').bind(s.one.columnId).run(),
    ).rejects.toThrow(/FOREIGN KEY/);
    expect(
      (
        await env.DB.prepare('SELECT count(*) n FROM cards WHERE id = ?1')
          .bind(card)
          .first<{ n: number }>()
      )?.n,
    ).toBe(1);
  });

  it('trigger dei campi personalizzati NULL-safe: scollegare una scheda con valori è vietato; senza valori riesce', async () => {
    const s = await seed();
    const card = newId();
    await insert(card, s.a.workspaceId, s.one.boardId, s.one.columnId);
    const field = newId();
    await env.DB.prepare(
      `INSERT INTO custom_field_definitions (id, workspace_id, board_id, name, type, config, position, is_active, created_at, updated_at) VALUES (?1, ?2, ?3, 'F', 'text', '{}', 1, 1, 1, 1)`,
    )
      .bind(field, s.a.workspaceId, s.one.boardId)
      .run();
    await env.DB.prepare(
      `INSERT INTO custom_field_values (card_id, field_id, workspace_id, value, updated_at) VALUES (?1, ?2, ?3, '"v"', 1)`,
    )
      .bind(card, field, s.a.workspaceId)
      .run();
    const detach = () =>
      env.DB.prepare('UPDATE cards SET board_id = NULL, column_id = NULL WHERE id = ?1')
        .bind(card)
        .run();
    await expect(detach()).rejects.toThrow(/rimuovere i valori dei campi personalizzati/);
    // Una scheda senza bacheca non può avere valori di campi di una bacheca.
    await env.DB.prepare('DELETE FROM custom_field_values WHERE card_id = ?1').bind(card).run();
    await expect(detach()).resolves.toBeDefined();
    await expect(
      env.DB.prepare(
        `INSERT INTO custom_field_values (card_id, field_id, workspace_id, value, updated_at) VALUES (?1, ?2, ?3, '"v"', 1)`,
      )
        .bind(card, field, s.a.workspaceId)
        .run(),
    ).rejects.toThrow(/campo appartiene/);
  });

  it('una scheda esce da una bacheca e vi rientra solo con una colonna della stessa bacheca', async () => {
    const s = await seed();
    const card = newId();
    await insert(card, s.a.workspaceId, null, null);
    const place = (board: string, column: string) =>
      env.DB.prepare('UPDATE cards SET board_id = ?1, column_id = ?2 WHERE id = ?3')
        .bind(board, column, card)
        .run();
    await expect(place(s.one.boardId, s.two.columnId)).rejects.toThrow(/FOREIGN KEY/);
    await expect(place(s.one.boardId, s.one.columnId)).resolves.toBeDefined();
  });
});
