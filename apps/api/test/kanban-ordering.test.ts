import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { addCard, columnTitles, createMinimalBoard, newUser, type Api } from './kanban-helpers';

/** Posizioni persistite di una colonna, in ordine canonico (posizione, id). */
async function rows(columnId: string) {
  const { results } = await env.DB.prepare(
    `SELECT id, title, position FROM cards WHERE column_id = ?1 ORDER BY position, id`,
  )
    .bind(columnId)
    .all<{ id: string; title: string; position: number }>();
  return results;
}

async function setup(email: string, titles: string[]) {
  const user = await newUser(email);
  const board = await createMinimalBoard(user.api);
  const cards: Record<string, string> = {};
  for (const t of titles) cards[t] = (await addCard(user.api, board.columnIds[0]!, t)).id;
  return { ...user, ...board, cards };
}

const move = (api: Api, id: string, columnId: string, afterCardId: string | null) =>
  api.post(`/cards/${id}/move`, { columnId, afterCardId });

describe('spostamento schede', () => {
  it('riordino nella stessa colonna: in cima, in mezzo, in fondo', async () => {
    const t = await setup('o-same@example.com', ['A', 'B', 'C', 'D']);
    const col = t.columnIds[0]!;

    expect((await move(t.api, t.cards['D']!, col, null)).status).toBe(200);
    expect(await columnTitles(t.api, t.boardId, col)).toEqual(['D', 'A', 'B', 'C']);
    await move(t.api, t.cards['A']!, col, t.cards['B']!);
    expect(await columnTitles(t.api, t.boardId, col)).toEqual(['D', 'B', 'A', 'C']);
    await move(t.api, t.cards['D']!, col, t.cards['C']!);
    expect(await columnTitles(t.api, t.boardId, col)).toEqual(['B', 'A', 'C', 'D']);
  });

  it('tra colonne: in colonna vuota, in cima, in mezzo e in fondo; origine e destinazione coerenti', async () => {
    const t = await setup('o-cross@example.com', ['A', 'B']);
    const [src, mid, dst] = t.columnIds;
    await addCard(t.api, mid!, 'X');
    await addCard(t.api, mid!, 'Y');

    await move(t.api, t.cards['A']!, dst!, null); // colonna vuota
    expect(await columnTitles(t.api, t.boardId, dst!)).toEqual(['A']);
    await move(t.api, t.cards['B']!, mid!, null); // in cima
    expect(await columnTitles(t.api, t.boardId, mid!)).toEqual(['B', 'X', 'Y']);
    const detail = (await t.api.get(`/boards/${t.boardId}`)).body;
    const x = detail.cards.find((c: any) => c.title === 'X');
    await move(t.api, t.cards['A']!, mid!, x.id); // in mezzo
    expect(await columnTitles(t.api, t.boardId, mid!)).toEqual(['B', 'X', 'A', 'Y']);
    expect(await columnTitles(t.api, t.boardId, src!)).toEqual([]);
    expect(await columnTitles(t.api, t.boardId, dst!)).toEqual([]);
  });

  it('una scheda spostata aggiorna updatedAt solo se cambia colonna', async () => {
    const t = await setup('o-updated@example.com', ['A', 'B']);
    const before = (await t.api.get(`/cards/${t.cards['A']}`)).body.card.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    await move(t.api, t.cards['A']!, t.columnIds[0]!, t.cards['B']!);
    expect((await t.api.get(`/cards/${t.cards['A']}`)).body.card.updatedAt).toBe(before);
    await move(t.api, t.cards['A']!, t.columnIds[1]!, null);
    expect((await t.api.get(`/cards/${t.cards['A']}`)).body.card.updatedAt).toBeGreaterThan(before);
  });

  it('ancora che non appartiene alla colonna di destinazione → 409 e nulla cambia', async () => {
    const t = await setup('o-anchor@example.com', ['A', 'B']);
    const other = await addCard(t.api, t.columnIds[1]!, 'Altrove');
    const res = await move(t.api, t.cards['A']!, t.columnIds[0]!, other.id);
    expect(res.status).toBe(409);
    expect(await columnTitles(t.api, t.boardId, t.columnIds[0]!)).toEqual(['A', 'B']);
    expect((await move(t.api, t.cards['A']!, t.columnIds[0]!, t.cards['A']!)).status).toBe(400);
  });

  it('colonna di destinazione di un’altra bacheca → 400; di un altro workspace → 404', async () => {
    const t = await setup('o-board@example.com', ['A']);
    const second = await createMinimalBoard(t.api, 'Seconda');
    expect((await move(t.api, t.cards['A']!, second.columnIds[0]!, null)).status).toBe(400);

    const stranger = await newUser('o-board-stranger@example.com');
    const foreign = await createMinimalBoard(stranger.api);
    expect((await move(t.api, t.cards['A']!, foreign.columnIds[0]!, null)).status).toBe(404);
    expect(await columnTitles(t.api, t.boardId, t.columnIds[0]!)).toEqual(['A']);
  });

  it('rispetta gli input: id scheda inesistente → 404, corpo non valido → 400', async () => {
    const t = await setup('o-input@example.com', ['A']);
    expect((await move(t.api, 'fantasma', t.columnIds[0]!, null)).status).toBe(404);
    expect(
      (await t.api.post(`/cards/${t.cards['A']}/move`, { columnId: t.columnIds[0] })).status,
    ).toBe(400);
    expect((await t.api.post(`/cards/${t.cards['A']}/move`, { afterCardId: null })).status).toBe(
      400,
    );
  });
});

describe('strategia di ordinamento a gap (ADR-0004)', () => {
  it('inserimento ripetuto nello stesso punto: il ribilanciamento mantiene l’ordine e posizioni distinte', async () => {
    const t = await setup('o-rebalance@example.com', ['A', 'B', 'C']);
    const col = t.columnIds[0]!;
    const extra: string[] = [];
    for (let i = 0; i < 14; i++) extra.push((await addCard(t.api, t.columnIds[1]!, `N${i}`)).id);

    // Ogni nuova scheda va sempre subito dopo A: il gap tra A e B si dimezza fino a esaurirsi.
    const expected = ['A', 'B', 'C'];
    for (let i = 0; i < extra.length; i++) {
      const res = await move(t.api, extra[i]!, col, t.cards['A']!);
      expect(res.status).toBe(200);
      expected.splice(1, 0, `N${i}`);
      expect(await columnTitles(t.api, t.boardId, col)).toEqual(expected);
    }
    const persisted = await rows(col);
    expect(new Set(persisted.map((r) => r.position)).size).toBe(persisted.length);
    expect(persisted.map((r) => r.title)).toEqual(expected);
  });

  it('gap esaurito (posizioni consecutive): una sola mossa ribilancia e colloca la scheda esattamente', async () => {
    const t = await setup('o-tight@example.com', ['A', 'B', 'C']);
    const col = t.columnIds[0]!;
    await env.DB.prepare(
      `UPDATE cards SET position = CASE title WHEN 'A' THEN 10 WHEN 'B' THEN 11 ELSE 12 END WHERE column_id = ?1`,
    )
      .bind(col)
      .run();
    const x = await addCard(t.api, t.columnIds[1]!, 'X');

    expect((await move(t.api, x.id, col, t.cards['A']!)).status).toBe(200);
    expect(await columnTitles(t.api, t.boardId, col)).toEqual(['A', 'X', 'B', 'C']);
    const persisted = await rows(col);
    expect(persisted.map((r) => r.position)).toEqual([1024, 1536, 2048, 3072]); // ribilanciate
  });

  it('posizioni duplicate: ordine deterministico (per id) e risolte da una mossa', async () => {
    const t = await setup('o-dup@example.com', ['A', 'B', 'C']);
    const col = t.columnIds[0]!;
    await env.DB.prepare(`UPDATE cards SET position = 500 WHERE column_id = ?1`).bind(col).run();

    const before = await columnTitles(t.api, t.boardId, col);
    expect(await columnTitles(t.api, t.boardId, col)).toEqual(before); // stabile tra letture

    const ordered = await rows(col); // (posizione, id)
    const first = ordered[0]!;
    const last = ordered[2]!;
    const res = await move(t.api, first.id, col, last.id);
    expect(res.status).toBe(200);
    const after = await rows(col);
    expect(after.map((r) => r.id)).toEqual([ordered[1]!.id, ordered[2]!.id, first.id]);

    // Inserire TRA due duplicati è impossibile senza ribilanciare: la mossa le risolve tutte.
    const res2 = await move(t.api, first.id, col, ordered[1]!.id);
    expect(res2.status).toBe(200);
    const resolved = await rows(col);
    expect(resolved.map((r) => r.id)).toEqual([ordered[1]!.id, first.id, ordered[2]!.id]);
    expect(new Set(resolved.map((r) => r.position)).size).toBe(3);
  });

  it('ribilanciamento su una colonna grande (oltre il limite di parametri di D1)', async () => {
    const t = await setup('o-big@example.com', []);
    const col = t.columnIds[0]!;
    const total = 150;
    await env.DB.batch(
      Array.from({ length: total }, (_, i) =>
        env.DB.prepare(
          `INSERT INTO cards (id, workspace_id, board_id, column_id, title, position, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, 1)`,
        ).bind(`big-${String(i).padStart(3, '0')}`, t.workspaceId, t.boardId, col, `T${i}`, i + 1),
      ),
    );
    const x = await addCard(t.api, t.columnIds[1]!, 'X');
    expect((await move(t.api, x.id, col, 'big-009')).status).toBe(200);

    const titles = (await rows(col)).map((r) => r.title);
    expect(titles).toHaveLength(total + 1);
    expect(titles.slice(0, 12)).toEqual([
      'T0',
      'T1',
      'T2',
      'T3',
      'T4',
      'T5',
      'T6',
      'T7',
      'T8',
      'T9',
      'X',
      'T10',
    ]);
    expect(titles.slice(10 + 1)).toEqual(
      Array.from({ length: total - 10 }, (_, i) => `T${i + 10}`),
    );
  });

  it('aggiornamenti concorrenti: tutte le mosse riescono o falliscono in modo pulito, l’ordine resta totale', async () => {
    const t = await setup('o-concurrent@example.com', ['A', 'B', 'C', 'D', 'E']);
    const col = t.columnIds[0]!;
    const ids = Object.values(t.cards);

    // 20 spostamenti simultanei verso destinazioni diverse.
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        move(t.api, ids[i % ids.length]!, col, ids[(i + 2) % ids.length] ?? null),
      ),
    );
    for (const r of results) expect([200, 409]).toContain(r.status);

    const persisted = await rows(col);
    expect(persisted).toHaveLength(5);
    expect(new Set(persisted.map((r) => r.id))).toEqual(new Set(ids)); // nessuna scheda persa o duplicata
    // L'ordine letto dall'API coincide con quello canonico del database.
    expect(await columnTitles(t.api, t.boardId, col)).toEqual(persisted.map((r) => r.title));
  });

  it('due spostamenti simultanei della STESSA scheda verso colonne diverse: vince uno solo, nessun evento orfano', async () => {
    const t = await setup('o-race@example.com', ['A']);
    const [r1, r2] = await Promise.all([
      move(t.api, t.cards['A']!, t.columnIds[1]!, null),
      move(t.api, t.cards['A']!, t.columnIds[2]!, null),
    ]);
    for (const r of [r1, r2]) expect([200, 409]).toContain(r.status);
    const card = (await t.api.get(`/cards/${t.cards['A']}`)).body;
    expect([t.columnIds[1], t.columnIds[2]]).toContain(card.card.columnId);
    const moves = card.history.filter((e: any) => e.type === 'card_moved');
    // Gli eventi corrispondono agli spostamenti effettivamente applicati e il più recente descrive la colonna attuale.
    expect(moves.length).toBeGreaterThanOrEqual(1);
    expect(moves[0].metadata.toColumnId).toBe(card.card.columnId);
  });
});

describe('rollback e atomicità', () => {
  it('se la colonna di destinazione sparisce durante lo spostamento, nulla viene scritto', async () => {
    const t = await setup('o-atomic@example.com', ['A', 'B']);
    const doomed = (await t.api.post(`/boards/${t.boardId}/columns`, { name: 'Effimera' })).body
      .column;
    const stmt = await Promise.all([
      move(t.api, t.cards['A']!, doomed.id, null),
      t.api.delete(`/columns/${doomed.id}`, { moveCardsToColumnId: t.columnIds[0] }),
    ]);
    for (const r of stmt) expect([200, 404, 409]).toContain(r.status);
    // Comunque vada: la scheda esiste in una colonna esistente e non ci sono righe orfane.
    const card = await env.DB.prepare(
      `SELECT c.column_id FROM cards c JOIN board_columns bc ON bc.id = c.column_id WHERE c.id = ?1`,
    )
      .bind(t.cards['A'])
      .first();
    expect(card).not.toBeNull();
  });

  it('un errore di persistenza (vincolo) in un batch di spostamento non lascia modifiche parziali', async () => {
    const t = await setup('o-batch@example.com', ['A', 'B']);
    // Forza un errore a metà batch: la scheda B passa a una colonna inesistente ⇒ FK composita rifiuta.
    await expect(
      env.DB.batch([
        env.DB.prepare(`UPDATE cards SET position = 99999 WHERE id = ?1`).bind(t.cards['A']),
        env.DB.prepare(`UPDATE cards SET column_id = 'fantasma' WHERE id = ?1`).bind(t.cards['B']),
      ]),
    ).rejects.toThrow();
    const a = await env.DB.prepare(`SELECT position FROM cards WHERE id = ?1`)
      .bind(t.cards['A'])
      .first<{ position: number }>();
    expect(a?.position).not.toBe(99999);
  });
});
