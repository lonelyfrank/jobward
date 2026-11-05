import { BOARD_TEMPLATES } from '@jobward/shared';
import { describe, expect, it } from 'vitest';
import { db } from './helpers';
import { addCard, createMinimalBoard, newUser } from './kanban-helpers';

describe('bacheche', () => {
  it('elenco vuoto per un workspace nuovo (nessun dato fittizio)', async () => {
    const { api } = await newUser('b-empty@example.com');
    const res = await api.get('/boards');
    expect(res.status).toBe(200);
    expect(res.body.boards).toEqual([]);
  });

  it('crea una bacheca con il solo nome: template "custom" → nessuna colonna', async () => {
    const { api } = await newUser('b-custom@example.com');
    const res = await api.post('/boards', { name: '  Ricerca estate  ' });
    expect(res.status).toBe(201);
    expect(res.body.board).toMatchObject({
      name: 'Ricerca estate',
      isFavorite: false,
      description: null,
    });
    expect(res.body.columns).toEqual([]);
  });

  it.each(BOARD_TEMPLATES.map((t) => [t.id, t] as const))(
    'template %s: bacheca e colonne create insieme, ordinate come da template',
    async (_id, template) => {
      const { api } = await newUser(`b-tpl-${template.id}@example.com`);
      const res = await api.post('/boards', { name: 'Da template', templateId: template.id });
      expect(res.status).toBe(201);
      expect(res.body.columns.map((c: any) => c.name)).toEqual(template.columns.map((c) => c.name));
      expect(res.body.columns.map((c: any) => c.category)).toEqual(
        template.columns.map((c) => c.category),
      );
      const positions = res.body.columns.map((c: any) => c.position);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);

      // Le colonne sono davvero persistite e lette in ordine.
      const detail = await api.get(`/boards/${res.body.board.id}`);
      expect(detail.body.columns.map((c: any) => c.name)).toEqual(
        template.columns.map((c) => c.name),
      );
    },
  );

  it('rifiuta template sconosciuti, nome vuoto e colori arbitrari', async () => {
    const { api } = await newUser('b-invalid@example.com');
    expect((await api.post('/boards', { name: 'x', templateId: 'nope' })).status).toBe(400);
    expect((await api.post('/boards', { name: '   ' })).status).toBe(400);
    expect((await api.post('/boards', { name: 'x', color: 'url(javascript:1)' })).status).toBe(400);
  });

  it('la creazione è atomica: al tetto di bacheche non resta nulla a metà', async () => {
    const { api, workspaceId } = await newUser('b-cap@example.com');
    // Riempie il workspace fino al tetto direttamente nel database (100 righe in un colpo).
    const { LIMITS } = await import('@jobward/shared');
    const d1 = (await import('cloudflare:workers')).env.DB;
    await d1.batch(
      Array.from({ length: LIMITS.boardsPerWorkspaceMax }, (_, i) =>
        d1
          .prepare(
            `INSERT INTO boards (id, workspace_id, name, position, created_at, updated_at) VALUES (?1, ?2, 'b', ?3, 1, 1)`,
          )
          .bind(`cap-${workspaceId}-${i}`, workspaceId, i),
      ),
    );
    const res = await api.post('/boards', {
      name: 'Una di troppo',
      templateId: 'job-search-standard',
    });
    expect(res.status).toBe(409);
    const cols = await d1
      .prepare(`SELECT count(*) AS n FROM board_columns WHERE workspace_id = ?1`)
      .bind(workspaceId)
      .first<{ n: number }>();
    expect(cols?.n).toBe(0); // nessuna colonna orfana del template
  });

  it('le nuove bacheche si accodano in ordine', async () => {
    const { api } = await newUser('b-order@example.com');
    for (const name of ['A', 'B', 'C']) await api.post('/boards', { name });
    const res = await api.get('/boards');
    expect(res.body.boards.map((b: any) => b.name)).toEqual(['A', 'B', 'C']);
  });

  it('rinomina, descrizione, colore e preferita; ogni campo è facoltativo ma serve almeno uno', async () => {
    const { api } = await newUser('b-update@example.com');
    const { board } = (await api.post('/boards', { name: 'Vecchio' })).body;

    const renamed = await api.patch(`/boards/${board.id}`, { name: 'Nuovo', description: 'Nota' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.board).toMatchObject({
      name: 'Nuovo',
      description: 'Nota',
      isFavorite: false,
    });

    const fav = await api.patch(`/boards/${board.id}`, { isFavorite: true });
    expect(fav.body.board).toMatchObject({ name: 'Nuovo', isFavorite: true });

    const cleared = await api.patch(`/boards/${board.id}`, { description: null, color: 'blue' });
    expect(cleared.body.board).toMatchObject({ description: null, color: 'blue' });

    expect((await api.patch(`/boards/${board.id}`, {})).status).toBe(400);
    expect((await api.patch(`/boards/${board.id}`, { name: '' })).status).toBe(400);
    expect((await api.patch(`/boards/${board.id}`, { position: 5 })).status).toBe(400); // campo non ammesso
    expect((await api.patch(`/boards/${board.id}`, { workspaceId: 'altro' })).status).toBe(400);
  });

  it('riordina le bacheche con "dopo"; ancora inesistente → 409', async () => {
    const { api } = await newUser('b-move@example.com');
    const ids: string[] = [];
    for (const name of ['A', 'B', 'C'])
      ids.push((await api.post('/boards', { name })).body.board.id);
    const names = async () => (await api.get('/boards')).body.boards.map((b: any) => b.name);

    expect((await api.post(`/boards/${ids[2]}/move`, { afterId: null })).status).toBe(200);
    expect(await names()).toEqual(['C', 'A', 'B']);
    await api.post(`/boards/${ids[2]}/move`, { afterId: ids[1] });
    expect(await names()).toEqual(['A', 'B', 'C']);

    expect((await api.post(`/boards/${ids[0]}/move`, { afterId: 'non-esiste' })).status).toBe(409);
    expect((await api.post(`/boards/${ids[0]}/move`, { afterId: ids[0] })).status).toBe(409);
  });

  it('elenco con conteggi reali di colonne e schede attive (archiviate escluse)', async () => {
    const { api } = await newUser('b-counts@example.com');
    const { boardId, columnIds } = await createMinimalBoard(api);
    const a = await addCard(api, columnIds[0]!, 'A');
    await addCard(api, columnIds[1]!, 'B');
    await api.post(`/cards/${a.id}/archive`);

    const list = await api.get('/boards');
    expect(list.body.boards).toHaveLength(1);
    expect(list.body.boards[0]).toMatchObject({ id: boardId, columnCount: 3, cardCount: 1 });
  });

  it('elimina la bacheca con colonne, schede, dettagli (CASCADE) e mantiene la cronologia scollegata', async () => {
    const { api, workspaceId } = await newUser('b-delete@example.com');
    const { boardId, columnIds } = await createMinimalBoard(api);
    const card = await addCard(api, columnIds[0]!, 'Da perdere', { details: { company: 'ACME' } });

    const res = await api.delete(`/boards/${boardId}`);
    expect(res.status).toBe(200);
    expect((await api.get(`/boards/${boardId}`)).status).toBe(404);

    const d1 = (await import('cloudflare:workers')).env.DB;
    const count = async (table: string) =>
      (
        await d1
          .prepare(`SELECT count(*) AS n FROM ${table} WHERE workspace_id = ?1`)
          .bind(workspaceId)
          .first<{ n: number }>()
      )?.n;
    expect(await count('cards')).toBe(0);
    expect(await count('board_columns')).toBe(0);
    expect(await count('application_details')).toBe(0);
    const event = await d1
      .prepare(`SELECT board_id, card_id FROM activity_events WHERE workspace_id = ?1`)
      .bind(workspaceId)
      .first<{ board_id: string | null; card_id: string | null }>();
    expect(event).toEqual({ board_id: null, card_id: null });
    expect(card.id).toBeTruthy();
    void db;
  });

  it('GET/PATCH/DELETE su un id inesistente → 404', async () => {
    const { api } = await newUser('b-404@example.com');
    expect((await api.get('/boards/non-esiste')).status).toBe(404);
    expect((await api.patch('/boards/non-esiste', { name: 'x' })).status).toBe(404);
    expect((await api.delete('/boards/non-esiste')).status).toBe(404);
  });
});
