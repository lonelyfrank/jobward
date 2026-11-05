import { LIMITS } from '@meet-roulette/shared';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { addCard, columnTitles, createMinimalBoard, newUser } from './kanban-helpers';

const names = async (api: any, boardId: string) =>
  (await api.get(`/boards/${boardId}`)).body.columns.map((c: any) => c.name);

describe('colonne', () => {
  it('crea una colonna in fondo, con colore e categoria opzionali', async () => {
    const { api } = await newUser('c-create@example.com');
    const { boardId } = await createMinimalBoard(api);

    const res = await api.post(`/boards/${boardId}/columns`, {
      name: 'Offerta',
      color: 'green',
      category: 'offer',
    });
    expect(res.status).toBe(201);
    expect(res.body.column).toMatchObject({
      name: 'Offerta',
      color: 'green',
      category: 'offer',
      cardCount: 0,
    });
    expect(await names(api, boardId)).toEqual(['Da fare', 'In corso', 'Completate', 'Offerta']);

    const bare = await api.post(`/boards/${boardId}/columns`, { name: 'Senza nulla' });
    expect(bare.body.column).toMatchObject({ color: null, category: null });
  });

  it('valida nome, colore e categoria', async () => {
    const { api } = await newUser('c-validate@example.com');
    const { boardId } = await createMinimalBoard(api);
    for (const bad of [
      { name: '' },
      { name: 'x', color: 'fucsia' },
      { name: 'x', category: 'boh' },
    ]) {
      expect((await api.post(`/boards/${boardId}/columns`, bad)).status).toBe(400);
    }
  });

  it('rispetta il tetto di colonne per bacheca (409)', async () => {
    const { api } = await newUser('c-cap@example.com');
    const { boardId } = await api
      .post('/boards', { name: 'Piena' })
      .then((r) => ({ boardId: r.body.board.id }));
    for (let i = 0; i < LIMITS.columnsPerBoardMax; i++) {
      expect((await api.post(`/boards/${boardId}/columns`, { name: `C${i}` })).status).toBe(201);
    }
    expect((await api.post(`/boards/${boardId}/columns`, { name: 'Troppe' })).status).toBe(409);
  });

  it('rinomina, cambia colore e categoria; null azzera', async () => {
    const { api } = await newUser('c-update@example.com');
    const { boardId, columnIds } = await createMinimalBoard(api);

    const res = await api.patch(`/columns/${columnIds[0]}`, {
      name: 'Candidature',
      color: 'rose',
      category: 'applied',
    });
    expect(res.body.column).toMatchObject({
      name: 'Candidature',
      color: 'rose',
      category: 'applied',
    });
    const cleared = await api.patch(`/columns/${columnIds[0]}`, { color: null, category: null });
    expect(cleared.body.column).toMatchObject({ name: 'Candidature', color: null, category: null });
    expect(await names(api, boardId)).toContain('Candidature');

    expect((await api.patch(`/columns/${columnIds[0]}`, {})).status).toBe(400);
    expect((await api.patch(`/columns/${columnIds[0]}`, { boardId: 'altra' })).status).toBe(400);
    expect((await api.patch(`/columns/${columnIds[0]}`, { name: ' ' })).status).toBe(400);
  });

  it('riordina le colonne e conserva l’ordine dopo il ricaricamento', async () => {
    const { api } = await newUser('c-move@example.com');
    const { boardId, columnIds } = await createMinimalBoard(api);
    const [a, b, c] = columnIds;

    await api.post(`/columns/${c}/move`, { afterId: null });
    expect(await names(api, boardId)).toEqual(['Completate', 'Da fare', 'In corso']);
    await api.post(`/columns/${a}/move`, { afterId: b });
    expect(await names(api, boardId)).toEqual(['Completate', 'In corso', 'Da fare']);

    expect((await api.post(`/columns/${a}/move`, { afterId: 'fantasma' })).status).toBe(409);
  });

  it('conteggio schede: attive e archiviate separatamente', async () => {
    const { api } = await newUser('c-counts@example.com');
    const { boardId, columnIds } = await createMinimalBoard(api);
    const one = await addCard(api, columnIds[0]!, 'Uno');
    await addCard(api, columnIds[0]!, 'Due');
    await api.post(`/cards/${one.id}/archive`);

    const col = (await api.get(`/boards/${boardId}`)).body.columns[0];
    expect(col).toMatchObject({ cardCount: 1, archivedCount: 1 });
  });

  describe('eliminazione', () => {
    it('colonna vuota: eliminata', async () => {
      const { api } = await newUser('c-del-empty@example.com');
      const { boardId, columnIds } = await createMinimalBoard(api);
      expect((await api.delete(`/columns/${columnIds[2]}`)).status).toBe(200);
      expect(await names(api, boardId)).toEqual(['Da fare', 'In corso']);
    });

    it('colonna con schede: 409 con messaggio chiaro, nulla viene eliminato', async () => {
      const { api } = await newUser('c-del-full@example.com');
      const { boardId, columnIds } = await createMinimalBoard(api);
      await addCard(api, columnIds[0]!, 'Resta');
      const arch = await addCard(api, columnIds[0]!, 'Archiviata');
      await api.post(`/cards/${arch.id}/archive`);

      const res = await api.delete(`/columns/${columnIds[0]}`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('conflict');
      expect(res.body.error.message).toContain('2 schede');
      expect(res.body.error.message).toContain('1 archiviate');
      expect(await columnTitles(api, boardId, columnIds[0]!)).toEqual(['Resta']);
    });

    it('con destinazione: le schede (anche archiviate) passano in coda, nello stesso ordine', async () => {
      const { api } = await newUser('c-del-move@example.com');
      const { boardId, columnIds } = await createMinimalBoard(api);
      const [src, dst] = columnIds;
      await addCard(api, dst!, 'Già lì');
      await addCard(api, src!, 'S1');
      const s2 = await addCard(api, src!, 'S2');
      await addCard(api, src!, 'S3');
      await api.post(`/cards/${s2.id}/archive`);

      const res = await api.delete(`/columns/${src}`, { moveCardsToColumnId: dst });
      expect(res.status).toBe(200);
      expect(await columnTitles(api, boardId, dst!)).toEqual(['Già lì', 'S1', 'S3']);

      const restored = await api.post(`/cards/${s2.id}/restore`);
      expect(restored.body.card.columnId).toBe(dst); // anche l'archiviata è stata spostata, non persa
      expect(await columnTitles(api, boardId, dst!)).toEqual(['Già lì', 'S1', 'S3', 'S2']);
    });

    it("destinazione non valida: se stessa, di un'altra bacheca o di un altro workspace", async () => {
      const { api } = await newUser('c-del-bad@example.com');
      const { columnIds } = await createMinimalBoard(api, 'A');
      const other = await createMinimalBoard(api, 'B');
      await addCard(api, columnIds[0]!, 'x');

      expect(
        (await api.delete(`/columns/${columnIds[0]}`, { moveCardsToColumnId: columnIds[0] }))
          .status,
      ).toBe(400);
      expect(
        (await api.delete(`/columns/${columnIds[0]}`, { moveCardsToColumnId: other.columnIds[0] }))
          .status,
      ).toBe(400);

      const stranger = await newUser('c-del-stranger@example.com');
      const foreign = await createMinimalBoard(stranger.api);
      expect(
        (
          await api.delete(`/columns/${columnIds[0]}`, {
            moveCardsToColumnId: foreign.columnIds[0],
          })
        ).status,
      ).toBe(404);

      // Nulla è stato spostato né eliminato.
      const rows = await env.DB.prepare(`SELECT count(*) AS n FROM cards WHERE column_id = ?1`)
        .bind(columnIds[0])
        .first<{ n: number }>();
      expect(rows?.n).toBe(1);
    });

    it('rifiuta un corpo con campi sconosciuti', async () => {
      const { api } = await newUser('c-del-strict@example.com');
      const { columnIds } = await createMinimalBoard(api);
      expect((await api.delete(`/columns/${columnIds[2]}`, { force: true })).status).toBe(400);
    });
  });
});
