import { env } from 'cloudflare:workers';
import { newId, schema } from '@jobward/database';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { call, db, devEnv, seedWorkspace } from './helpers';
import { addCard, clientFor, createMinimalBoard, newUser } from './kanban-helpers';

const app = createApp();

/** Fotografia dei dati del workspace: serve a dimostrare che un attacco non ha cambiato nulla. */
async function snapshot(workspaceId: string) {
  const q = async (sql: string) => (await env.DB.prepare(sql).bind(workspaceId).all()).results;
  return {
    boards: await q('SELECT * FROM boards WHERE workspace_id = ?1 ORDER BY id'),
    columns: await q('SELECT * FROM board_columns WHERE workspace_id = ?1 ORDER BY id'),
    cards: await q('SELECT * FROM cards WHERE workspace_id = ?1 ORDER BY id'),
    details: await q('SELECT * FROM application_details WHERE workspace_id = ?1 ORDER BY card_id'),
    events: await q('SELECT * FROM activity_events WHERE workspace_id = ?1 ORDER BY id'),
  };
}

async function twoUsers(tag: string) {
  const victim = await newUser(`${tag}-victim@example.com`);
  const board = await createMinimalBoard(victim.api, 'Riservata');
  const card = await addCard(victim.api, board.columnIds[0]!, 'Segreta', {
    details: { company: 'Azienda riservata' },
  });
  const attacker = await newUser(`${tag}-attacker@example.com`);
  const own = await createMinimalBoard(attacker.api, 'Mia');
  const ownCard = await addCard(attacker.api, own.columnIds[0]!, 'Mia scheda');
  return { victim, board, card, attacker, own, ownCard };
}

describe('un utente non raggiunge i dati di un altro workspace', () => {
  it('con il proprio workspaceId, ogni operazione su id altrui è 404 e non cambia nulla', async () => {
    const t = await twoUsers('iso-ids');
    const before = await snapshot(t.victim.workspaceId);
    const a = t.attacker.api;
    const [col0, col1] = t.board.columnIds;

    const attempts: [string, Promise<{ status: number; body: any }>][] = [
      ['GET board', a.get(`/boards/${t.board.boardId}`)],
      ['GET archived', a.get(`/boards/${t.board.boardId}/archived`)],
      ['PATCH board', a.patch(`/boards/${t.board.boardId}`, { name: 'Hackerata' })],
      ['MOVE board', a.post(`/boards/${t.board.boardId}/move`, { afterId: null })],
      ['DELETE board', a.delete(`/boards/${t.board.boardId}`)],
      ['POST column', a.post(`/boards/${t.board.boardId}/columns`, { name: 'Intrusa' })],
      ['PATCH column', a.patch(`/columns/${col0}`, { name: 'Hackerata' })],
      ['MOVE column', a.post(`/columns/${col0}/move`, { afterId: null })],
      ['DELETE column', a.delete(`/columns/${col1}`)],
      ['POST card (colonna altrui)', a.post('/cards', { columnId: col0, title: 'Intrusa' })],
      ['GET card', a.get(`/cards/${t.card.id}`)],
      ['PATCH card', a.patch(`/cards/${t.card.id}`, { title: 'Hackerata', company: 'X' })],
      ['MOVE card', a.post(`/cards/${t.card.id}/move`, { columnId: col1, afterCardId: null })],
      ['ARCHIVE card', a.post(`/cards/${t.card.id}/archive`)],
      ['RESTORE card', a.post(`/cards/${t.card.id}/restore`)],
    ];
    for (const [label, request] of attempts) {
      const res = await request;
      expect(res.status, label).toBe(404);
      expect(JSON.stringify(res.body), label).not.toMatch(/Segreta|Riservata|Azienda riservata/);
    }
    expect(await snapshot(t.victim.workspaceId)).toEqual(before);
  });

  it('la risposta per una risorsa altrui è indistinguibile da quella per una inesistente', async () => {
    const t = await twoUsers('iso-same');
    const pairs = [
      [`/boards/${t.board.boardId}`, '/boards/non-esiste'],
      [`/columns/${t.board.columnIds[0]}`, '/columns/non-esiste'],
      [`/cards/${t.card.id}`, '/cards/non-esiste'],
    ] as const;
    for (const [foreign, missing] of pairs) {
      const f = await t.attacker.api.get(
        foreign.startsWith('/columns') ? `/boards/non-esiste` : foreign,
      );
      const m = await t.attacker.api.get(
        missing.startsWith('/columns') ? `/boards/non-esiste` : missing,
      );
      expect(f.status).toBe(m.status);
      expect(f.body.error.code).toBe(m.body.error.code);
    }
    const f = await t.attacker.api.patch(`/columns/${t.board.columnIds[0]}`, { name: 'x' });
    const m = await t.attacker.api.patch('/columns/non-esiste', { name: 'x' });
    expect([f.status, f.body.error.message]).toEqual([m.status, m.body.error.message]);
  });

  it('indicando il workspace della vittima (di cui non è membro) → 404 su tutto, anche sull’elenco', async () => {
    const t = await twoUsers('iso-ws');
    const before = await snapshot(t.victim.workspaceId);
    const stolen = clientFor(t.attacker.email, t.victim.workspaceId);

    const attempts = [
      stolen.get('/boards'),
      stolen.get(`/boards/${t.board.boardId}`),
      stolen.post('/boards', { name: 'Infiltrata' }),
      stolen.patch(`/boards/${t.board.boardId}`, { name: 'x' }),
      stolen.delete(`/boards/${t.board.boardId}`),
      stolen.post('/cards', { columnId: t.board.columnIds[0], title: 'Intrusa' }),
      stolen.patch(`/cards/${t.card.id}`, { title: 'x' }),
      stolen.post(`/cards/${t.card.id}/archive`),
      stolen.patch(`/columns/${t.board.columnIds[0]}`, { name: 'x' }),
    ];
    for (const res of await Promise.all(attempts)) expect(res.status).toBe(404);
    expect(await snapshot(t.victim.workspaceId)).toEqual(before);
  });

  it('non si può spostare la propria scheda in una colonna altrui, né il contrario', async () => {
    const t = await twoUsers('iso-move');
    const before = await snapshot(t.victim.workspaceId);
    const mine = await snapshot(t.attacker.workspaceId);

    const intoVictim = await t.attacker.api.post(`/cards/${t.ownCard.id}/move`, {
      columnId: t.board.columnIds[0],
      afterCardId: t.card.id, // anche l'ancora è altrui
    });
    expect(intoVictim.status).toBe(404);
    const anchorOnly = await t.attacker.api.post(`/cards/${t.ownCard.id}/move`, {
      columnId: t.own.columnIds[1],
      afterCardId: t.card.id,
    });
    expect(anchorOnly.status).toBe(409); // ancora non presente nella colonna di destinazione
    expect(await snapshot(t.victim.workspaceId)).toEqual(before);
    expect(await snapshot(t.attacker.workspaceId)).toEqual(mine);
  });

  it('eliminare una colonna propria spostando le schede in una colonna altrui è rifiutato e non sposta nulla', async () => {
    const t = await twoUsers('iso-del');
    const before = await snapshot(t.victim.workspaceId);
    const mine = await snapshot(t.attacker.workspaceId);
    const res = await t.attacker.api.delete(`/columns/${t.own.columnIds[0]}`, {
      moveCardsToColumnId: t.board.columnIds[0],
    });
    expect(res.status).toBe(404);
    expect(await snapshot(t.victim.workspaceId)).toEqual(before);
    expect(await snapshot(t.attacker.workspaceId)).toEqual(mine);
  });

  it('eliminare la propria bacheca non tocca quella di altri', async () => {
    const t = await twoUsers('iso-cascade');
    const before = await snapshot(t.victim.workspaceId);
    expect((await t.attacker.api.delete(`/boards/${t.own.boardId}`)).status).toBe(200);
    expect(await snapshot(t.victim.workspaceId)).toEqual(before);
  });

  it('gli elenchi contengono solo dati del proprio workspace', async () => {
    const t = await twoUsers('iso-list');
    const list = await t.attacker.api.get('/boards');
    expect(list.body.boards.map((b: any) => b.name)).toEqual(['Mia']);
    const detail = await t.attacker.api.get(`/boards/${t.own.boardId}`);
    expect(detail.body.cards.map((c: any) => c.title)).toEqual(['Mia scheda']);
  });
});

describe('integrità garantita dal database anche se il servizio sbagliasse (ADR-0007)', () => {
  it('una scheda non può puntare a una colonna di un’altra bacheca né di un altro workspace', async () => {
    const t = await twoUsers('iso-db');
    const now = Date.now();
    const insert = (workspaceId: string, boardId: string, columnId: string) =>
      db().insert(schema.cards).values({
        id: newId(),
        workspaceId,
        boardId,
        columnId,
        title: 'x',
        position: 1,
        createdAt: now,
        updatedAt: now,
      });

    await expect(
      insert(t.attacker.workspaceId, t.own.boardId, t.board.columnIds[0]!),
    ).rejects.toThrow();
    await expect(
      insert(t.victim.workspaceId, t.board.boardId, t.own.columnIds[0]!),
    ).rejects.toThrow();
    const second = await createMinimalBoard(t.victim.api, 'Seconda');
    await expect(
      insert(t.victim.workspaceId, t.board.boardId, second.columnIds[0]!),
    ).rejects.toThrow();
    await expect(
      insert(t.victim.workspaceId, t.board.boardId, t.board.columnIds[0]!),
    ).resolves.toBeDefined();
  });

  it('spostare una scheda in una colonna di un’altra bacheca/workspace via SQL è rifiutato', async () => {
    const t = await twoUsers('iso-db-move');
    const run = (columnId: string) =>
      env.DB.prepare(`UPDATE cards SET column_id = ?1 WHERE id = ?2`)
        .bind(columnId, t.ownCard.id)
        .run();
    await expect(run(t.board.columnIds[0]!)).rejects.toThrow();
    await expect(run(t.own.columnIds[1]!)).resolves.toBeDefined();
  });

  it('eventi di cronologia non possono riferire schede di altri workspace (anche dopo la correzione 0002)', async () => {
    const t = await twoUsers('iso-db-ev');
    const insertEvent = (cardId: string) =>
      env.DB.prepare(
        `INSERT INTO activity_events (id, workspace_id, card_id, type, metadata, occurred_at) VALUES (?1, ?2, ?3, 'card_created', '{}', 1)`,
      )
        .bind(newId(), t.attacker.workspaceId, cardId)
        .run();
    await expect(insertEvent(t.card.id)).rejects.toThrow();
    await expect(insertEvent(t.ownCard.id)).resolves.toBeDefined();

    // Re-puntare un evento esistente a una scheda altrui è ancora vietato...
    const own = await env.DB.prepare(
      `SELECT id FROM activity_events WHERE workspace_id = ?1 LIMIT 1`,
    )
      .bind(t.attacker.workspaceId)
      .first<{ id: string }>();
    await expect(
      env.DB.prepare(`UPDATE activity_events SET card_id = ?1 WHERE id = ?2`)
        .bind(t.card.id, own!.id)
        .run(),
    ).rejects.toThrow();
    // ...mentre l'eliminazione della bacheca (che azzera i riferimenti) funziona.
    expect((await t.attacker.api.delete(`/boards/${t.own.boardId}`)).status).toBe(200);
  });
});

describe('permessi e protezioni di richiesta', () => {
  it('un membro "viewer" legge ma non può scrivere (403)', async () => {
    const owner = await newUser('perm-owner@example.com');
    const board = await createMinimalBoard(owner.api);
    const viewer = await seedWorkspace('perm-viewer@example.com');
    await db().insert(schema.workspaceMembers).values({
      workspaceId: owner.workspaceId,
      userId: viewer.userId,
      role: 'viewer',
      createdAt: Date.now(),
    });
    const v = clientFor('perm-viewer@example.com', owner.workspaceId);

    expect((await v.get('/boards')).status).toBe(200);
    expect((await v.get(`/boards/${board.boardId}`)).status).toBe(200);
    expect((await v.post('/boards', { name: 'x' })).status).toBe(403);
    expect((await v.post('/cards', { columnId: board.columnIds[0], title: 'x' })).status).toBe(403);
    expect((await v.patch(`/columns/${board.columnIds[0]}`, { name: 'x' })).status).toBe(403);
    expect((await v.delete(`/boards/${board.boardId}`)).status).toBe(403);
    expect((await owner.api.get('/boards')).body.boards).toHaveLength(1);
  });

  it('workspaceId mancante o malformato → 400', async () => {
    const env0 = devEnv('perm-missing@example.com');
    await seedWorkspace('perm-missing@example.com');
    for (const path of ['/api/v1/boards', '/api/v1/boards?workspaceId=', `/api/v1/cards/x`]) {
      const res = await call<any>(app, env0, path);
      expect(res.status, path).toBe(400);
      expect(res.body.error.code).toBe('validation_error');
    }
  });

  it('le richieste che modificano dati richiedono JSON e rifiutano origini estranee (CSRF)', async () => {
    const { workspaceId } = await newUser('perm-csrf@example.com');
    const e = devEnv('perm-csrf@example.com');
    const path = `/api/v1/boards?workspaceId=${workspaceId}`;

    const noJson = await call<any>(app, e, path, {
      method: 'POST',
      body: 'name=x',
      headers: { 'content-type': 'text/plain' },
    });
    expect(noJson.status).toBe(415);
    const del = await call<any>(app, e, `/api/v1/boards/x?workspaceId=${workspaceId}`, {
      method: 'DELETE',
    });
    expect(del.status).toBe(415);
    const foreign = await call<any>(app, e, path, {
      method: 'POST',
      json: { name: 'x' },
      headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
    });
    expect(foreign.status).toBe(403);
    expect((await call<any>(app, e, path)).body.boards).toEqual([]);
  });

  it('gli errori inattesi non espongono dettagli interni', async () => {
    const t = await twoUsers('perm-leak');
    const res = await t.attacker.api.get(`/cards/${'x'.repeat(65)}`); // id oltre il limite
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/SQL|stack|D1_ERROR/i);
  });
});
