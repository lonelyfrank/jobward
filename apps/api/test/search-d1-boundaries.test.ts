import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { globalSearchResponse, opportunitiesResponse } from '@jobward/schemas';
import { addCard, createMinimalBoard, newUser } from './kanban-helpers';

describe('ricerca letterale su D1/workerd: limiti e semantica', () => {
  it.each([
    ['minima', 'z'],
    ['48 ASCII', 'a'.repeat(48)],
    ['49 ASCII', 'a'.repeat(49)],
    ['50 ASCII', 'a'.repeat(50)],
    ['100 ASCII', 'a'.repeat(100)],
    ['multibyte', '界'.repeat(30)],
    ['percento', '%'.repeat(30)],
    ['underscore', '_'.repeat(30)],
    ['backslash', '\\'.repeat(30)],
    ['apostrofo', "L'azienda%_\\speciale"],
  ])('%s: opportunità e colloqui senza troncamento o jolly', async (_name, term) => {
    const { api } = await newUser(
      `boundary-${_name.replace(/[^a-z0-9]/gi, '').toLowerCase()}@example.com`,
    );
    const board = await createMinimalBoard(api);
    const card = await addCard(api, board.columnIds[0]!, `prima ${term} dopo`);
    const interview = await api.post(`/cards/${card.id}/interviews`, {
      title: `prima ${term} dopo`,
      type: 'technical',
    });
    expect(interview.status).toBe(201);
    await addCard(api, board.columnIds[0]!, 'non corrisponde');
    // A truncated query would incorrectly return this shared-prefix card/interview too.
    if (term.length > 1) {
      const nearTitle = `prima ${term.slice(0, -1)}! dopo`;
      const near = await addCard(api, board.columnIds[0]!, nearTitle);
      expect(
        (await api.post(`/cards/${near.id}/interviews`, { title: nearTitle, type: 'technical' }))
          .status,
      ).toBe(201);
    }
    const q = encodeURIComponent(term.toUpperCase());
    const opportunities = await api.get(`/opportunities?q=${q}`);
    expect(opportunities.status, JSON.stringify(opportunities.body)).toBe(200);
    expect(opportunitiesResponse.parse(opportunities.body)).toMatchObject({
      total: 1,
      items: [{ id: card.id }],
    });
    const global = await api.get(`/search?q=${q}`);
    expect(global.status, JSON.stringify(global.body)).toBe(200);
    expect(globalSearchResponse.parse(global.body)).toMatchObject({
      opportunities: [{ id: card.id }],
      interviews: [{ cardId: card.id }],
    });
  });

  it('query vuota, senza risultati, limite 100 e differenze Unicode già previste', async () => {
    const { api } = await newUser('search-empty@example.com');
    const board = await createMinimalBoard(api);
    await addCard(api, board.columnIds[0]!, 'CÀFFÈ Ångström ΑΛΦΑ');
    for (const q of ['', '   ']) {
      expect((await api.get(`/opportunities?q=${encodeURIComponent(q)}`)).body.total).toBe(1);
      expect((await api.get(`/search?q=${encodeURIComponent(q)}`)).status).toBe(400);
    }
    expect((await api.get('/opportunities?q=inesistente')).body.total).toBe(0);
    expect((await api.get('/search?q=inesistente')).body).toEqual({
      opportunities: [],
      boards: [],
      interviews: [],
    });
    expect((await api.get(`/opportunities?q=${'x'.repeat(101)}`)).status).toBe(400);
    expect((await api.get(`/search?q=${'x'.repeat(101)}`)).status).toBe(400);
    // LIKE di SQLite è case-insensitive solo per ASCII; il filtro locale non normalizza accenti.
    expect((await api.get('/opportunities?q=CAFFE')).body.total).toBe(0);
    expect((await api.get(`/opportunities?q=${encodeURIComponent('càffè')}`)).body.total).toBe(0);
    expect((await api.get(`/opportunities?q=${encodeURIComponent('CÀFFÈ')}`)).body.total).toBe(1);
    expect(
      globalSearchResponse.parse((await api.get('/search?q=caffe')).body).opportunities,
    ).toHaveLength(1);
    expect((await api.get(`/opportunities?q=${encodeURIComponent('αλφα')}`)).body.total).toBe(0);
  });

  it('mantiene filtri, paginazione, totale e isolamento con termini lunghi', async () => {
    const owner = await newUser('long-owner@example.com');
    const stranger = await newUser('long-stranger@example.com');
    const board = await createMinimalBoard(owner.api);
    const otherBoard = await createMinimalBoard(owner.api);
    const term = 'Q'.repeat(100);
    const ids = [];
    for (let i = 0; i < 3; i++) {
      ids.push(
        (await addCard(owner.api, board.columnIds[0]!, `${term} ${i}`, { priority: 'high' })).id,
      );
    }
    await addCard(owner.api, otherBoard.columnIds[0]!, term, { priority: 'high' });
    await addCard(owner.api, board.columnIds[0]!, term, { priority: 'low' });
    const hiddenBoard = await createMinimalBoard(stranger.api);
    const hidden = await addCard(stranger.api, hiddenBoard.columnIds[0]!, term);
    await stranger.api.post(`/cards/${hidden.id}/interviews`, { title: term, type: 'technical' });
    const query = `/opportunities?q=${term}&boardId=${board.boardId}&priority=high&pageSize=2&sort=title&dir=asc`;
    const first = await owner.api.get(`${query}&page=1`);
    const second = await owner.api.get(`${query}&page=2`);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const a = opportunitiesResponse.parse(first.body);
    const b = opportunitiesResponse.parse(second.body);
    expect([a.total, b.total]).toEqual([3, 3]);
    expect([...a.items, ...b.items].map((item) => item.id)).toEqual(ids);
    const global = await owner.api.get(`/search?q=${term}`);
    expect(global.status).toBe(200);
    const results = globalSearchResponse.parse(global.body);
    expect(results.opportunities).toHaveLength(5);
    expect(results.interviews).toEqual([]);
    expect((await stranger.api.get(`/opportunities?q=${term}`)).body.total).toBe(1);
  });

  it('caratterizza D1: LIKE oltre 50 byte fallisce, lower conserva il case-fold ASCII', async () => {
    const pattern = `%${'a'.repeat(49)}%`;
    await expect(
      env.DB.prepare('SELECT ?1 LIKE ?2 AS found').bind('x', pattern).first(),
    ).rejects.toThrow(/LIKE or GLOB pattern too complex/);
    for (const [text, term] of [
      ['A_%\\B', 'a_%\\b'],
      ["L'azienda", "l'AZIENDA"],
      ['Ångström', 'ångström'],
      ['界世界', '世界'],
      ['Caffe\u0301', 'Caffe\u0301'],
      ['nessuno', 'assente'],
    ]) {
      const escaped = `%${term!.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      const row = await env.DB.prepare(
        "SELECT (?1 LIKE ?2 ESCAPE '\\') AS old, (instr(lower(?1),lower(?3)) > 0) AS replacement",
      )
        .bind(text, escaped, term)
        .first<{ old: number; replacement: number }>();
      expect(row?.replacement).toBe(row?.old);
    }
  });
});
