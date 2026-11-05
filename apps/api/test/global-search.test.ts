import { describe, expect, it } from 'vitest';
import { globalSearchResponse } from '@jobward/schemas';
import { env } from 'cloudflare:workers';
import { createDb } from '@jobward/database';
import { searchWorkspace } from '../src/services/global-search';
import { addCard, createMinimalBoard, newUser } from './kanban-helpers';

describe('ricerca globale autorizzata', () => {
  it('cerca tra bacheche, schede archiviate e colloqui con accenti, AND e link originali', async () => {
    const { api, workspaceId } = await newUser('search@example.com');
    const a = await createMinimalBoard(api, 'CITTÀ Milano');
    const b = await createMinimalBoard(api, 'Remoto');
    const card = await addCard(api, a.columnIds[0]!, 'Tecnico CÀFFÈ');
    await api.patch(`/cards/${card.id}`, {
      company: 'Orbita',
      location: 'Monza',
      source: 'Portale',
      jobTitle: 'IT Junior',
      description: 'Reti locali',
      stage: 'applied',
    });
    const other = await addCard(api, b.columnIds[0]!, 'Supporto');
    await api.patch(`/cards/${other.id}`, { company: 'Caffe\u0301' });
    const created = await api.post(`/cards/${card.id}/interviews`, {
      title: 'Tecnico reti',
      type: 'technical',
      scheduledAt: Date.UTC(2026, 10, 20, 10),
      timezone: 'Europe/Rome',
    });
    expect(created.status).toBe(201);
    await api.post(`/cards/${card.id}/archive`);
    const search = async (q: string) => {
      const response = await api.get(`/search?q=${encodeURIComponent(q)}`);
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      return globalSearchResponse.parse(response.body);
    };
    expect((await search('CAFFE')).opportunities.map((item) => item.id).sort()).toEqual(
      [card.id, other.id].sort(),
    );
    expect((await search('città orbita')).opportunities).toMatchObject([
      { id: card.id, boardId: a.boardId, archived: true },
    ]);
    expect((await search('citta')).boards).toMatchObject([{ id: a.boardId }]);
    expect((await search('inviata')).opportunities).toHaveLength(1);
    for (const query of ['reti', 'Monza', 'Portale', 'Junior'])
      expect((await search(query)).opportunities).toHaveLength(1);
    expect((await search('orbita tecnico')).interviews).toMatchObject([
      { cardId: card.id, boardId: a.boardId },
    ]);
    expect((await search('2026-11-20')).interviews).toHaveLength(1);
    expect((await search('20/11/2026')).interviews).toHaveLength(1);
    expect((await search('orbita tecnico reti 2026 11 20')).interviews).toHaveLength(1);
    expect((await search('nessun-risultato')).opportunities).toEqual([]);
    expect(
      (
        await searchWorkspace(
          env.DB,
          createDb(env.DB),
          workspaceId,
          'reti locali orbita monza portale junior',
        )
      ).opportunities,
    ).toHaveLength(1);
    expect((await search('reti locali orbita monza portale junior')).opportunities).toHaveLength(1);
    expect((await search('\u0301')).opportunities).toEqual([]);
  });

  it('trova descrizioni di bacheca e colloqui panel senza data', async () => {
    const { api } = await newUser('search-panel@example.com');
    const board = await createMinimalBoard(api, 'Ricerca');
    await api.patch(`/boards/${board.boardId}`, { description: 'Opportunità all’estero' });
    const card = await addCard(api, board.columnIds[0]!, 'Designer');
    await api.post(`/cards/${card.id}/interviews`, { title: 'Portfolio', type: 'panel' });
    const found = await api.get('/search?q=Commissione');
    expect(globalSearchResponse.parse(found.body).interviews).toHaveLength(1);
    expect(
      globalSearchResponse.parse((await api.get('/search?q=opportunita')).body).boards,
    ).toHaveLength(1);
  });

  it('non rivela risorse di un altro workspace e mantiene i limiti per categoria', async () => {
    const owner = await newUser('search-owner@example.com');
    const stranger = await newUser('search-stranger@example.com');
    const board = await createMinimalBoard(owner.api, 'Segreto');
    for (let index = 0; index < 12; index++)
      await addCard(owner.api, board.columnIds[0]!, `Segreto ${index}`);
    const found = await owner.api.get('/search?q=Segreto');
    expect(globalSearchResponse.parse(found.body).opportunities).toHaveLength(10);
    const hidden = await stranger.api.get('/search?q=Segreto');
    expect(hidden.body).toEqual({ opportunities: [], boards: [], interviews: [] });
    const forbidden = await stranger.api.get(`/search?q=Segreto&workspaceId=${owner.workspaceId}`);
    expect([400, 404]).toContain(forbidden.status);
  });

  it('escapa i jolly e rifiuta query non valide senza introdurre nuove semantiche nei filtri locali', async () => {
    const { api } = await newUser('search-literal@example.com');
    const board = await createMinimalBoard(api);
    await addCard(api, board.columnIds[0]!, '100%_ok');
    await addCard(api, board.columnIds[0]!, '100 altre');
    expect(
      globalSearchResponse.parse((await api.get('/search?q=%25_')).body).opportunities,
    ).toHaveLength(1);
    for (const query of [
      '',
      '?q=',
      '?q=a&q=b',
      '?q=a&unknown=b',
      `?q=${'a'.repeat(101)}`,
      '?q=a+b+c+d+e+f+g',
    ]) {
      expect((await api.get(`/search${query}`)).status).toBe(400);
    }
    const before = await api.get('/opportunities?q=100&pageSize=1');
    expect(before.status).toBe(200);
    expect(before.body.total).toBe(2);
  });
});
