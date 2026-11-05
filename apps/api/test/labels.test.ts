import { describe, expect, it } from 'vitest';
import { deletedResponse, labelResponse, labelsResponse } from '@jobward/schemas';
import { LIMITS } from '@jobward/shared';
import { newId, schema } from '@jobward/database';
import { db } from './helpers';
import { addCard, createMinimalBoard, newUser } from './kanban-helpers';

async function setup(email: string) {
  const user = await newUser(email);
  const board = await createMinimalBoard(user.api);
  const card = await addCard(user.api, board.columnIds[0]!, 'Scheda');
  return { ...user, ...board, card };
}
const create = (api: Awaited<ReturnType<typeof setup>>['api'], name: string, color?: string) =>
  api.post('/labels', color ? { name, color } : { name });

describe('etichette: creazione, rinomina, colore', () => {
  it('crea con colore predefinito, restituisce 0 schede e valida la risposta', async () => {
    const { api } = await setup('l-create@example.com');
    const res = await create(api, '  Interessante ');
    expect(res.status).toBe(201);
    expect(labelResponse.parse(res.body).label).toMatchObject({
      name: 'Interessante',
      color: 'slate',
      cardCount: 0,
    });
  });

  it('elenca in ordine alfabetico senza distinzione di maiuscole', async () => {
    const { api } = await setup('l-list@example.com');
    for (const n of ['zeta', 'Alfa', 'beta']) await create(api, n);
    const res = await api.get('/labels');
    expect(labelsResponse.parse(res.body).labels.map((l) => l.name)).toEqual([
      'Alfa',
      'beta',
      'zeta',
    ]);
  });

  it('rifiuta nomi vuoti, troppo lunghi, e colori che non sono token (nessun CSS arbitrario)', async () => {
    const { api } = await setup('l-bad@example.com');
    const bad: object[] = [
      { name: '  ' },
      {},
      { name: 'x'.repeat(LIMITS.labelNameMax + 1) },
      { name: 'ok', color: '#ff0000' },
      { name: 'ok', color: 'red; background:url(x)' },
      { name: 'ok', color: 'chartreuse' },
      { name: 'ok', workspaceId: 'altro' },
    ];
    for (const body of bad)
      expect((await api.post('/labels', body)).status, JSON.stringify(body)).toBe(400);
  });

  it('il nome è univoco nel workspace senza distinzione di maiuscole (409); altri workspace non collidono', async () => {
    const a = await setup('l-uniq-a@example.com');
    const b = await setup('l-uniq-b@example.com');
    expect((await create(a.api, 'Estero')).status).toBe(201);
    const dup = await create(a.api, 'ESTERO');
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toMatch(/esiste già/i);
    expect((await create(b.api, 'Estero')).status).toBe(201);
  });

  it('rinomina e cambia colore; il nome duplicato dà 409; corpo vuoto 400', async () => {
    const { api } = await setup('l-patch@example.com');
    const one = (await create(api, 'Uno')).body.label;
    await create(api, 'Due');
    const res = await api.patch(`/labels/${one.id}`, { name: 'Primo', color: 'green' });
    expect(res.body.label).toMatchObject({ name: 'Primo', color: 'green' });
    expect((await api.patch(`/labels/${one.id}`, { name: 'due' })).status).toBe(409);
    expect((await api.patch(`/labels/${one.id}`, {})).status).toBe(400);
    // Rinominare con lo stesso nome (cambio di sole maiuscole) è lecito.
    expect((await api.patch(`/labels/${one.id}`, { name: 'PRIMO' })).status).toBe(200);
  });

  it('tetto per workspace applicato (409)', async () => {
    const { api, workspaceId } = await setup('l-cap@example.com');
    const now = Date.now();
    // D1 limita le variabili legate per istruzione (100): inserimento a blocchi.
    const rows = Array.from({ length: LIMITS.labelsPerWorkspaceMax }, (_, i) => ({
      id: newId(),
      workspaceId,
      name: `L${i}`,
      color: 'slate',
      createdAt: now,
    }));
    for (let i = 0; i < rows.length; i += 20) {
      await db()
        .insert(schema.labels)
        .values(rows.slice(i, i + 20));
    }
    const res = await create(api, 'Una di troppo');
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/al massimo/);
  });
});

describe('etichette: assegnazione alle schede', () => {
  it('assegna, è idempotente, compare in labelIds della scheda e della bacheca, e conta le schede', async () => {
    const { api, card, boardId } = await setup('l-assign@example.com');
    const label = (await create(api, 'Part-time', 'teal')).body.label;
    const first = await api.post(`/cards/${card.id}/labels`, { labelId: label.id });
    const again = await api.post(`/cards/${card.id}/labels`, { labelId: label.id });
    expect(first.body.labelIds).toEqual([label.id]);
    expect(again.body.labelIds).toEqual([label.id]);
    expect((await api.get(`/cards/${card.id}`)).body.card.labelIds).toEqual([label.id]);
    const onBoard = (await api.get(`/boards/${boardId}`)).body.cards.find(
      (c: { id: string }) => c.id === card.id,
    );
    expect(onBoard.labelIds).toEqual([label.id]);
    expect((await api.get('/labels')).body.labels[0].cardCount).toBe(1);
  });

  it('rimuove (idempotente) e aggiorna la data di modifica della scheda', async () => {
    const { api, card } = await setup('l-unassign@example.com');
    const label = (await create(api, 'X')).body.label;
    await api.post(`/cards/${card.id}/labels`, { labelId: label.id });
    const before = (await api.get(`/cards/${card.id}`)).body.card.updatedAt as number;
    await new Promise((r) => setTimeout(r, 5));
    const res = await api.delete(`/cards/${card.id}/labels/${label.id}`);
    expect(res.status).toBe(200);
    expect(res.body.labelIds).toEqual([]);
    expect((await api.delete(`/cards/${card.id}/labels/${label.id}`)).status).toBe(200);
    expect((await api.get(`/cards/${card.id}`)).body.card.updatedAt).toBeGreaterThan(before);
  });

  it('una scheda archiviata non cambia etichette (409)', async () => {
    const { api, card } = await setup('l-archived@example.com');
    const label = (await create(api, 'X')).body.label;
    await api.post(`/cards/${card.id}/archive`);
    expect((await api.post(`/cards/${card.id}/labels`, { labelId: label.id })).status).toBe(409);
  });

  it('tetto di etichette per scheda (409)', async () => {
    const { api, card } = await setup('l-percard@example.com');
    const ids: string[] = [];
    for (let i = 0; i < LIMITS.labelsPerCardMax + 1; i++)
      ids.push((await create(api, `E${i}`)).body.label.id);
    for (const id of ids.slice(0, LIMITS.labelsPerCardMax)) {
      expect((await api.post(`/cards/${card.id}/labels`, { labelId: id })).status).toBe(200);
    }
    const over = await api.post(`/cards/${card.id}/labels`, { labelId: ids.at(-1) });
    expect(over.status).toBe(409);
  });
});

describe('etichette: eliminazione controllata', () => {
  it('non in uso: si elimina; in uso: 409 con il numero di schede, poi con force rimuove SOLO l’etichetta', async () => {
    const { api, card, columnIds } = await setup('l-delete@example.com');
    const second = await addCard(api, columnIds[0]!, 'Seconda');
    const unused = (await create(api, 'Inutilizzata')).body.label;
    const removed = await api.delete(`/labels/${unused.id}`, {});
    expect(removed.status).toBe(200);
    expect(deletedResponse.parse(removed.body)).toEqual({ id: unused.id }); // contratto condiviso con il client

    const used = (await create(api, 'Usata')).body.label;
    await api.post(`/cards/${card.id}/labels`, { labelId: used.id });
    await api.post(`/cards/${second.id}/labels`, { labelId: used.id });
    const refuse = await api.delete(`/labels/${used.id}`, {});
    expect(refuse.status).toBe(409);
    expect(refuse.body.error.message).toContain('2 schede');
    expect((await api.get('/labels')).body.labels).toHaveLength(1);

    expect((await api.delete(`/labels/${used.id}`, { force: true })).status).toBe(200);
    expect((await api.get('/labels')).body.labels).toHaveLength(0);
    // Le schede esistono ancora, senza etichetta.
    expect((await api.get(`/cards/${card.id}`)).body.card).toMatchObject({
      title: 'Scheda',
      labelIds: [],
    });
    expect((await api.get(`/cards/${second.id}`)).status).toBe(200);
  });

  it('eliminare due volte → 404', async () => {
    const { api } = await setup('l-delete2@example.com');
    const l = (await create(api, 'A')).body.label;
    await api.delete(`/labels/${l.id}`, {});
    expect((await api.delete(`/labels/${l.id}`, {})).status).toBe(404);
  });
});

describe('etichette: isolamento tra workspace', () => {
  it('un altro workspace non vede, non modifica, non elimina, non assegna (404 indistinguibile)', async () => {
    const owner = await setup('l-iso-a@example.com');
    const other = await setup('l-iso-b@example.com');
    const label = (await create(owner.api, 'Segreta', 'rose')).body.label;
    await owner.api.post(`/cards/${owner.card.id}/labels`, { labelId: label.id });

    expect((await other.api.get('/labels')).body.labels).toEqual([]);
    const ghost = await other.api.patch('/labels/inesistente', { name: 'x' });
    for (const res of [
      await other.api.patch(`/labels/${label.id}`, { name: 'hack' }),
      await other.api.delete(`/labels/${label.id}`, { force: true }),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe(ghost.body.error.message);
    }
    // Etichetta altrui su una scheda propria, scheda altrui con etichetta propria.
    const mine = (await create(other.api, 'Mia')).body.label;
    expect(
      (await other.api.post(`/cards/${other.card.id}/labels`, { labelId: label.id })).status,
    ).toBe(404);
    expect(
      (await other.api.post(`/cards/${owner.card.id}/labels`, { labelId: mine.id })).status,
    ).toBe(404);
    expect((await other.api.delete(`/cards/${owner.card.id}/labels/${label.id}`)).status).toBe(404);

    // Nulla è cambiato per il proprietario.
    expect((await owner.api.get('/labels')).body.labels[0]).toMatchObject({
      name: 'Segreta',
      cardCount: 1,
    });
    expect((await owner.api.get(`/cards/${owner.card.id}`)).body.card.labelIds).toEqual([label.id]);
  });

  it('il database rifiuta un’assegnazione tra workspace anche aggirando il servizio', async () => {
    const owner = await setup('l-db-a@example.com');
    const other = await setup('l-db-b@example.com');
    const label = (await create(owner.api, 'Solo mia')).body.label;
    await expect(
      db().insert(schema.cardLabels).values({
        cardId: other.card.id,
        labelId: label.id,
        workspaceId: other.workspaceId,
      }),
    ).rejects.toThrow();
  });
});
