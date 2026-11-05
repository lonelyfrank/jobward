import { env } from 'cloudflare:workers';
import { newId, schema } from '@jobward/database';
import { describe, expect, it } from 'vitest';
import { db } from './helpers';
import { addCard, createMinimalBoard, newUser } from './kanban-helpers';

/**
 * Matrice di isolamento di M2: per OGNI nuova risorsa (dettagli, etichette, campi personalizzati
 * e valori) un utente con un proprio workspace prova ad agire su ID altrui. Le prove servono
 * solo se FALLISCONO quando il controllo manca: vedi docs/m2/testing-report.md (§mutation check).
 */

async function snapshot(workspaceId: string) {
  const q = async (sql: string) => (await env.DB.prepare(sql).bind(workspaceId).all()).results;
  return {
    cards: await q('SELECT * FROM cards WHERE workspace_id = ?1 ORDER BY id'),
    details: await q('SELECT * FROM application_details WHERE workspace_id = ?1 ORDER BY card_id'),
    labels: await q('SELECT * FROM labels WHERE workspace_id = ?1 ORDER BY id'),
    cardLabels: await q(
      'SELECT * FROM card_labels WHERE workspace_id = ?1 ORDER BY card_id, label_id',
    ),
    fields: await q('SELECT * FROM custom_field_definitions WHERE workspace_id = ?1 ORDER BY id'),
    values: await q(
      'SELECT * FROM custom_field_values WHERE workspace_id = ?1 ORDER BY card_id, field_id',
    ),
    events: await q('SELECT * FROM activity_events WHERE workspace_id = ?1 ORDER BY id'),
  };
}

async function world(tag: string) {
  const victim = await newUser(`${tag}-victim@example.com`);
  const vBoard = await createMinimalBoard(victim.api, 'Riservata');
  const vCard = await addCard(victim.api, vBoard.columnIds[0]!, 'Segreta', {
    details: { company: 'Azienda riservata', sourceUrl: 'https://example.com/segreto' },
  });
  const vLabel = (await victim.api.post('/labels', { name: 'Riservata', color: 'rose' })).body
    .label;
  await victim.api.post(`/cards/${vCard.id}/labels`, { labelId: vLabel.id });
  const vField = (
    await victim.api.post(`/boards/${vBoard.boardId}/custom-fields`, {
      name: 'Stipendio atteso segreto',
      type: 'text',
    })
  ).body.field;
  await victim.api.put(`/cards/${vCard.id}/custom-fields/${vField.id}`, {
    value: 'dato riservato',
  });

  const attacker = await newUser(`${tag}-attacker@example.com`);
  const aBoard = await createMinimalBoard(attacker.api, 'Mia');
  const aCard = await addCard(attacker.api, aBoard.columnIds[0]!, 'Mia scheda');
  const aLabel = (await attacker.api.post('/labels', { name: 'Mia' })).body.label;
  const aField = (
    await attacker.api.post(`/boards/${aBoard.boardId}/custom-fields`, {
      name: 'Mio',
      type: 'text',
    })
  ).body.field;
  return { victim, vBoard, vCard, vLabel, vField, attacker, aBoard, aCard, aLabel, aField };
}

describe('M2 — workspace diversi', () => {
  it('ogni operazione su una risorsa altrui è 404, indistinguibile dall’inesistente, e non cambia nulla', async () => {
    const w = await world('m2-ws');
    const before = await snapshot(w.victim.workspaceId);
    const a = w.attacker.api;
    const ghost = 'id-che-non-esiste';

    const attempts: [
      string,
      () => Promise<{ status: number; body: any }>,
      () => Promise<{ status: number; body: any }>,
    ][] = [
      // dettagli
      [
        'PATCH dettagli',
        () => a.patch(`/cards/${w.vCard.id}`, { company: 'hack', stage: 'offer' }),
        () => a.patch(`/cards/${ghost}`, { company: 'hack', stage: 'offer' }),
      ],
      // etichette
      [
        'PATCH etichetta',
        () => a.patch(`/labels/${w.vLabel.id}`, { name: 'hack' }),
        () => a.patch(`/labels/${ghost}`, { name: 'hack' }),
      ],
      [
        'DELETE etichetta',
        () => a.delete(`/labels/${w.vLabel.id}`, { force: true }),
        () => a.delete(`/labels/${ghost}`, { force: true }),
      ],
      [
        'assegna etichetta altrui a scheda mia',
        () => a.post(`/cards/${w.aCard.id}/labels`, { labelId: w.vLabel.id }),
        () => a.post(`/cards/${w.aCard.id}/labels`, { labelId: ghost }),
      ],
      [
        'assegna etichetta mia a scheda altrui',
        () => a.post(`/cards/${w.vCard.id}/labels`, { labelId: w.aLabel.id }),
        () => a.post(`/cards/${ghost}/labels`, { labelId: w.aLabel.id }),
      ],
      [
        'rimuove etichetta da scheda altrui',
        () => a.delete(`/cards/${w.vCard.id}/labels/${w.vLabel.id}`),
        () => a.delete(`/cards/${ghost}/labels/${w.vLabel.id}`),
      ],
      // campi personalizzati
      [
        'GET campi di bacheca altrui',
        () => a.get(`/boards/${w.vBoard.boardId}/custom-fields`),
        () => a.get(`/boards/${ghost}/custom-fields`),
      ],
      [
        'POST campo su bacheca altrui',
        () =>
          a.post(`/boards/${w.vBoard.boardId}/custom-fields`, { name: 'Intruso', type: 'text' }),
        () => a.post(`/boards/${ghost}/custom-fields`, { name: 'Intruso', type: 'text' }),
      ],
      [
        'PATCH campo altrui',
        () => a.patch(`/custom-fields/${w.vField.id}`, { name: 'hack', isActive: false }),
        () => a.patch(`/custom-fields/${ghost}`, { name: 'hack', isActive: false }),
      ],
      [
        'MOVE campo altrui',
        () => a.post(`/custom-fields/${w.vField.id}/move`, { afterId: null }),
        () => a.post(`/custom-fields/${ghost}/move`, { afterId: null }),
      ],
      [
        'DELETE campo altrui',
        () => a.delete(`/custom-fields/${w.vField.id}`, { deleteValues: true }),
        () => a.delete(`/custom-fields/${ghost}`, { deleteValues: true }),
      ],
      [
        'GET campi di scheda altrui',
        () => a.get(`/cards/${w.vCard.id}/custom-fields`),
        () => a.get(`/cards/${ghost}/custom-fields`),
      ],
      [
        'PUT valore su scheda altrui (campo altrui)',
        () => a.put(`/cards/${w.vCard.id}/custom-fields/${w.vField.id}`, { value: 'hack' }),
        () => a.put(`/cards/${ghost}/custom-fields/${ghost}`, { value: 'hack' }),
      ],
      [
        'PUT valore su scheda altrui (campo mio)',
        () => a.put(`/cards/${w.vCard.id}/custom-fields/${w.aField.id}`, { value: 'hack' }),
        () => a.put(`/cards/${ghost}/custom-fields/${w.aField.id}`, { value: 'hack' }),
      ],
      [
        'PUT valore su scheda mia con campo altrui',
        () => a.put(`/cards/${w.aCard.id}/custom-fields/${w.vField.id}`, { value: 'hack' }),
        () => a.put(`/cards/${w.aCard.id}/custom-fields/${ghost}`, { value: 'hack' }),
      ],
    ];
    for (const [label, attack, control] of attempts) {
      const res = await attack();
      const nothing = await control();
      expect(res.status, label).toBe(404);
      expect(nothing.status, `${label} (controllo)`).toBe(404);
      // Stessa risposta per "inesistente" e "di un altro workspace" (a parte la risorsa nominata).
      expect(res.body.error.code, label).toBe(nothing.body.error.code);
      expect(JSON.stringify(res.body), label).not.toMatch(/riservat|segreto|Segreta/i);
    }
    expect(await snapshot(w.victim.workspaceId)).toEqual(before);
  });

  it('le letture dell’attaccante non contengono mai dati della vittima (elenchi, conteggi, ricerche)', async () => {
    const w = await world('m2-leak');
    const a = w.attacker.api;
    const labels = JSON.stringify((await a.get('/labels')).body);
    const board = JSON.stringify((await a.get(`/boards/${w.aBoard.boardId}`)).body);
    const fields = JSON.stringify((await a.get(`/boards/${w.aBoard.boardId}/custom-fields`)).body);
    const overview = JSON.stringify((await a.get('/overview')).body);
    for (const body of [labels, board, fields, overview]) {
      expect(body).not.toMatch(/Riservata|riservat|Segreta|segreto|Stipendio atteso/);
    }
    // I conteggi non rivelano nulla: l'etichetta propria resta a 0 schede.
    expect((await a.get('/labels')).body.labels).toEqual([
      expect.objectContaining({ name: 'Mia', cardCount: 0 }),
    ]);
    // Anche con lo stesso nome, due workspace non si vedono (nome etichetta e nome campo).
    expect((await a.post('/labels', { name: 'Riservata' })).status).toBe(201);
    expect(
      (
        await a.post(`/boards/${w.aBoard.boardId}/custom-fields`, {
          name: 'Stipendio atteso segreto',
          type: 'text',
        })
      ).status,
    ).toBe(201);
  });

  it('un workspaceId nel body non sposta l’operazione su un altro workspace', async () => {
    const w = await world('m2-body');
    const before = await snapshot(w.victim.workspaceId);
    const a = w.attacker.api;
    const forged = { workspaceId: w.victim.workspaceId };
    expect((await a.post('/labels', { name: 'X', ...forged })).status).toBe(400);
    expect((await a.patch(`/cards/${w.aCard.id}`, { company: 'x', ...forged })).status).toBe(400);
    expect(
      (
        await a.post(`/boards/${w.aBoard.boardId}/custom-fields`, {
          name: 'x',
          type: 'text',
          ...forged,
        })
      ).status,
    ).toBe(400);
    expect(
      (await a.put(`/cards/${w.aCard.id}/custom-fields/${w.aField.id}`, { value: 'x', ...forged }))
        .status,
    ).toBe(400);
    expect(await snapshot(w.victim.workspaceId)).toEqual(before);
  });

  it('con il workspaceId della vittima nella query l’attaccante non è membro: 404', async () => {
    const w = await world('m2-query');
    const stranger = (await import('./kanban-helpers')).clientFor(
      'm2-query-attacker@example.com',
      w.victim.workspaceId,
    );
    for (const res of [
      await stranger.get('/labels'),
      await stranger.get(`/boards/${w.vBoard.boardId}/custom-fields`),
      await stranger.get(`/cards/${w.vCard.id}/custom-fields`),
      await stranger.post('/labels', { name: 'x' }),
    ]) {
      expect(res.status).toBe(404);
    }
  });
});

describe('M2 — bacheche diverse nello stesso workspace', () => {
  async function sameWorkspace(email: string) {
    const user = await newUser(email);
    const one = await createMinimalBoard(user.api, 'Uno');
    const two = await createMinimalBoard(user.api, 'Due');
    const cardOne = await addCard(user.api, one.columnIds[0]!, 'Scheda uno');
    const cardTwo = await addCard(user.api, two.columnIds[0]!, 'Scheda due');
    const fieldOne = (
      await user.api.post(`/boards/${one.boardId}/custom-fields`, { name: 'Reparto', type: 'text' })
    ).body.field;
    return { ...user, one, two, cardOne, cardTwo, fieldOne };
  }

  it('un campo di una bacheca non riceve valori da schede di un’altra bacheca (API: 404)', async () => {
    const w = await sameWorkspace('m2-board@example.com');
    const res = await w.api.put(`/cards/${w.cardTwo.id}/custom-fields/${w.fieldOne.id}`, {
      value: 'x',
    });
    expect(res.status).toBe(404);
    expect((await snapshot(w.workspaceId)).values).toEqual([]);
    // Nemmeno in lettura: i campi di una scheda sono quelli della SUA bacheca.
    expect((await w.api.get(`/cards/${w.cardTwo.id}/custom-fields`)).body.fields).toEqual([]);
  });

  it('il database stesso lo rifiuta (trigger di M0.H) anche aggirando il servizio', async () => {
    const w = await sameWorkspace('m2-board-db@example.com');
    const error = await db()
      .insert(schema.customFieldValues)
      .values({
        cardId: w.cardTwo.id,
        fieldId: w.fieldOne.id,
        workspaceId: w.workspaceId,
        value: '"x"',
        updatedAt: Date.now(),
      })
      .then(
        () => null,
        (e: unknown) => e as { message: string; cause?: { message: string } },
      );
    expect(error, 'il database deve rifiutare la riga').not.toBeNull();
    // drizzle incapsula l'errore di D1: il motivo (il trigger) è nella causa.
    expect(`${error?.message} ${error?.cause?.message ?? ''}`).toMatch(/altra bacheca/);
  });

  it('il database rifiuta anche campo/valore con workspace incoerente', async () => {
    const victim = await newUser('m2-db-victim@example.com');
    const board = await createMinimalBoard(victim.api);
    const other = await newUser('m2-db-other@example.com');
    await expect(
      db().insert(schema.customFieldDefinitions).values({
        id: newId(),
        workspaceId: other.workspaceId,
        boardId: board.boardId, // bacheca di un altro workspace
        name: 'Intruso',
        type: 'text',
        config: '{}',
        position: 1,
        isActive: true,
        createdAt: 1,
        updatedAt: 1,
      }),
    ).rejects.toThrow();
  });

  it('i campi inattivi di una bacheca non compaiono sulle sue schede e non accettano scritture', async () => {
    const w = await sameWorkspace('m2-inactive@example.com');
    await w.api.patch(`/custom-fields/${w.fieldOne.id}`, { isActive: false });
    expect((await w.api.get(`/cards/${w.cardOne.id}/custom-fields`)).body.fields).toEqual([]);
    expect(
      (await w.api.put(`/cards/${w.cardOne.id}/custom-fields/${w.fieldOne.id}`, { value: 'x' }))
        .status,
    ).toBe(409);
  });
});
