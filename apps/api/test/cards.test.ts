import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { addCard, columnTitles, createMinimalBoard, newUser } from './kanban-helpers';

describe('creazione rapida', () => {
  it('basta il titolo: priorità "none", in fondo alla colonna, evento card_created', async () => {
    const { api } = await newUser('k-create@example.com');
    const { boardId, columnIds } = await createMinimalBoard(api);

    const res = await api.post('/cards', {
      columnId: columnIds[0],
      title: '  Barista part-time  ',
    });
    expect(res.status).toBe(201);
    expect(res.body.card).toMatchObject({
      title: 'Barista part-time',
      priority: 'none',
      description: null,
      company: null,
      sourceUrl: null,
      archivedAt: null,
      columnId: columnIds[0],
      boardId,
    });
    expect(res.body.card.createdAt).toBe(res.body.card.updatedAt);

    const detail = await api.get(`/cards/${res.body.card.id}`);
    expect(detail.body.history).toHaveLength(1);
    expect(detail.body.history[0]).toMatchObject({ type: 'card_created' });
    expect(detail.body.history[0].metadata).toMatchObject({
      columnId: columnIds[0],
      columnName: 'Da fare',
    });
  });

  it('le schede si accodano nell’ordine di creazione', async () => {
    const { api } = await newUser('k-append@example.com');
    const { boardId, columnIds } = await createMinimalBoard(api);
    for (const t of ['A', 'B', 'C']) await addCard(api, columnIds[0]!, t);
    expect(await columnTitles(api, boardId, columnIds[0]!)).toEqual(['A', 'B', 'C']);
  });

  it('accetta azienda e URL dell’annuncio, e li restituisce', async () => {
    const { api } = await newUser('k-details@example.com');
    const { columnIds } = await createMinimalBoard(api);
    const res = await api.post('/cards', {
      columnId: columnIds[0],
      title: 'Cuoco',
      priority: 'high',
      description: 'Turni serali',
      details: { company: 'Trattoria Rossi', sourceUrl: 'https://example.com/annuncio/1' },
    });
    expect(res.status).toBe(201);
    expect(res.body.card).toMatchObject({
      priority: 'high',
      description: 'Turni serali',
      company: 'Trattoria Rossi',
      sourceUrl: 'https://example.com/annuncio/1',
    });
  });

  it('valida: titolo vuoto, priorità, URL non http, importo senza valuta, chiavi sconosciute', async () => {
    const { api } = await newUser('k-validate@example.com');
    const { columnIds } = await createMinimalBoard(api);
    const columnId = columnIds[0];
    const bad: object[] = [
      { columnId, title: '   ' },
      { columnId },
      { columnId, title: 'x', priority: 'critical' },
      { columnId, title: 'x', details: { sourceUrl: 'javascript:alert(1)' } },
      { columnId, title: 'x', details: { sourceUrl: 'data:text/html,<b>x' } },
      { columnId, title: 'x', details: { salaryMin: 10 } }, // importo senza valuta
      { columnId, title: 'x', details: { sconosciuto: 1 } }, // chiave ignota: rifiutata, non ignorata
      { columnId, title: 'x'.repeat(201) },
    ];
    for (const body of bad) {
      expect((await api.post('/cards', body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it('colonna inesistente → 404', async () => {
    const { api } = await newUser('k-nocol@example.com');
    expect((await api.post('/cards', { columnId: 'fantasma', title: 'x' })).status).toBe(404);
  });

  it('il workspace nel body è ignorato: la scheda nasce nel workspace autenticato', async () => {
    const { api, workspaceId } = await newUser('k-wsbody@example.com');
    const { columnIds } = await createMinimalBoard(api);
    const res = await api.post('/cards', {
      columnId: columnIds[0],
      title: 'x',
      workspaceId: 'altro',
    });
    expect(res.status).toBe(201);
    const row = await env.DB.prepare(`SELECT workspace_id FROM cards WHERE id = ?1`)
      .bind(res.body.card.id)
      .first<{ workspace_id: string }>();
    expect(row?.workspace_id).toBe(workspaceId);
  });
});

describe('modifica', () => {
  it('modifica titolo, descrizione, priorità; aggiorna updatedAt, non createdAt', async () => {
    const { api } = await newUser('k-update@example.com');
    const { columnIds } = await createMinimalBoard(api);
    const card = await addCard(api, columnIds[0]!, 'Titolo');
    await new Promise((r) => setTimeout(r, 5));

    const res = await api.patch(`/cards/${card.id}`, {
      title: 'Nuovo titolo',
      description: 'Note',
      priority: 'urgent',
    });
    expect(res.status).toBe(200);
    expect(res.body.card).toMatchObject({
      title: 'Nuovo titolo',
      description: 'Note',
      priority: 'urgent',
    });
    expect(res.body.card.updatedAt).toBeGreaterThan(res.body.card.createdAt);

    const cleared = await api.patch(`/cards/${card.id}`, { description: null });
    expect(cleared.body.card).toMatchObject({ description: null, title: 'Nuovo titolo' });
  });

  it('azienda e URL: upsert parziale, ciascuno indipendente, azzerabile', async () => {
    const { api } = await newUser('k-details-upd@example.com');
    const { columnIds } = await createMinimalBoard(api);
    const card = await addCard(api, columnIds[0]!, 'Offerta');

    let res = await api.patch(`/cards/${card.id}`, { company: 'ACME' });
    expect(res.body.card).toMatchObject({ company: 'ACME', sourceUrl: null });
    res = await api.patch(`/cards/${card.id}`, { sourceUrl: 'https://example.com/x' });
    expect(res.body.card).toMatchObject({ company: 'ACME', sourceUrl: 'https://example.com/x' });
    res = await api.patch(`/cards/${card.id}`, { company: null });
    expect(res.body.card).toMatchObject({ company: null, sourceUrl: 'https://example.com/x' });
    expect((await api.patch(`/cards/${card.id}`, { sourceUrl: 'ftp://x' })).status).toBe(400);
  });

  it('il cambio di priorità è nella cronologia; salvare lo stesso valore non crea eventi', async () => {
    const { api } = await newUser('k-prio-event@example.com');
    const { columnIds } = await createMinimalBoard(api);
    const card = await addCard(api, columnIds[0]!, 'x');
    await api.patch(`/cards/${card.id}`, { priority: 'high' });
    await api.patch(`/cards/${card.id}`, { priority: 'high' });
    const { history } = (await api.get(`/cards/${card.id}`)).body;
    const changes = history.filter((e: any) => e.type === 'priority_changed');
    expect(changes).toHaveLength(1);
    expect(changes[0].metadata).toEqual({ from: 'none', to: 'high' });
  });

  it('rifiuta corpo vuoto, campi sconosciuti e campi non modificabili da qui', async () => {
    const { api } = await newUser('k-upd-bad@example.com');
    const { columnIds } = await createMinimalBoard(api);
    const card = await addCard(api, columnIds[0]!, 'x');
    for (const body of [
      {},
      { title: '' },
      { columnId: columnIds[1] },
      { position: 1 },
      { archivedAt: 1 },
      { workspaceId: 'a' },
    ]) {
      expect((await api.patch(`/cards/${card.id}`, body)).status, JSON.stringify(body)).toBe(400);
    }
  });
});

describe('archiviazione e ripristino', () => {
  it('una scheda archiviata sparisce dalla bacheca e compare tra le archiviate; il ripristino la riporta in fondo', async () => {
    const { api } = await newUser('k-archive@example.com');
    const { boardId, columnIds } = await createMinimalBoard(api);
    const a = await addCard(api, columnIds[0]!, 'A');
    await addCard(api, columnIds[0]!, 'B');

    const archived = await api.post(`/cards/${a.id}/archive`);
    expect(archived.status).toBe(200);
    expect(archived.body.card.archivedAt).toEqual(expect.any(Number));
    expect(await columnTitles(api, boardId, columnIds[0]!)).toEqual(['B']);
    const list = await api.get(`/boards/${boardId}/archived`);
    expect(list.body.cards.map((c: any) => c.title)).toEqual(['A']);

    const restored = await api.post(`/cards/${a.id}/restore`);
    expect(restored.body.card.archivedAt).toBeNull();
    expect(restored.body.card.columnId).toBe(columnIds[0]);
    expect(await columnTitles(api, boardId, columnIds[0]!)).toEqual(['B', 'A']);
    expect((await api.get(`/boards/${boardId}/archived`)).body.cards).toEqual([]);

    const types = (await api.get(`/cards/${a.id}`)).body.history.map((e: any) => e.type);
    expect(types).toEqual(['card_restored', 'card_archived', 'card_created']);
  });

  it('archiviare/ripristinare è idempotente e non duplica eventi', async () => {
    const { api } = await newUser('k-idem@example.com');
    const { columnIds } = await createMinimalBoard(api);
    const a = await addCard(api, columnIds[0]!, 'A');
    await api.post(`/cards/${a.id}/archive`);
    await api.post(`/cards/${a.id}/archive`);
    await api.post(`/cards/${a.id}/restore`);
    await api.post(`/cards/${a.id}/restore`);
    const types = (await api.get(`/cards/${a.id}`)).body.history.map((e: any) => e.type);
    expect(types).toEqual(['card_restored', 'card_archived', 'card_created']);
  });

  it('una scheda archiviata non si modifica né si sposta finché non è ripristinata (409)', async () => {
    const { api } = await newUser('k-arch-ro@example.com');
    const { columnIds } = await createMinimalBoard(api);
    const a = await addCard(api, columnIds[0]!, 'A');
    await api.post(`/cards/${a.id}/archive`);
    expect((await api.patch(`/cards/${a.id}`, { title: 'x' })).status).toBe(409);
    expect(
      (await api.post(`/cards/${a.id}/move`, { columnId: columnIds[1], afterCardId: null })).status,
    ).toBe(409);
  });

  it('l’archiviazione non cancella dati: dettagli ed eventi restano', async () => {
    const { api } = await newUser('k-arch-data@example.com');
    const { columnIds } = await createMinimalBoard(api);
    const a = await addCard(api, columnIds[0]!, 'A', { details: { company: 'ACME' } });
    await api.post(`/cards/${a.id}/archive`);
    const restored = await api.post(`/cards/${a.id}/restore`);
    expect(restored.body.card.company).toBe('ACME');
  });
});

describe('cronologia', () => {
  it('registra la creazione, gli spostamenti tra colonne (con i nomi) e nient’altro di rumoroso', async () => {
    const { api } = await newUser('k-history@example.com');
    const { columnIds } = await createMinimalBoard(api);
    const a = await addCard(api, columnIds[0]!, 'A');
    await addCard(api, columnIds[1]!, 'B');
    await api.post(`/cards/${a.id}/move`, { columnId: columnIds[1], afterCardId: null });
    // Riordino nella stessa colonna: nessun evento.
    await api.post(`/cards/${a.id}/move`, { columnId: columnIds[1], afterCardId: null });

    const { history } = (await api.get(`/cards/${a.id}`)).body;
    expect(history.map((e: any) => e.type)).toEqual(['card_moved', 'card_created']);
    expect(history[0].metadata).toMatchObject({
      fromColumnId: columnIds[0],
      toColumnId: columnIds[1],
      fromColumnName: 'Da fare',
      toColumnName: 'In corso',
    });
  });

  it('il metadato è sempre un oggetto, anche se il JSON salvato è corrotto', async () => {
    const { api, workspaceId } = await newUser('k-meta@example.com');
    const { columnIds } = await createMinimalBoard(api);
    const a = await addCard(api, columnIds[0]!, 'A');
    await env.DB.prepare(
      `UPDATE activity_events SET metadata = 'non json' WHERE card_id = ?1 AND workspace_id = ?2`,
    )
      .bind(a.id, workspaceId)
      .run();
    const { history } = (await api.get(`/cards/${a.id}`)).body;
    expect(history[0].metadata).toEqual({});
  });
});

describe('tetto di schede per bacheca', () => {
  it('rifiuta la scheda oltre il tetto (409) senza lasciare dati a metà', async () => {
    const { api, workspaceId } = await newUser('k-cap@example.com');
    const { LIMITS } = await import('@jobward/shared');
    const { boardId, columnIds } = await createMinimalBoard(api);
    await env.DB.batch(
      Array.from({ length: LIMITS.cardsPerBoardMax }, (_, i) =>
        env.DB.prepare(
          `INSERT INTO cards (id, workspace_id, board_id, column_id, title, position, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, 't', ?5, 1, 1)`,
        ).bind(`cap-${workspaceId}-${i}`, workspaceId, boardId, columnIds[0], i),
      ),
    );
    const res = await api.post('/cards', {
      columnId: columnIds[0],
      title: 'Una di troppo',
      details: { company: 'X' },
    });
    expect(res.status).toBe(409);
    const stray = await env.DB.prepare(
      `SELECT count(*) AS n FROM application_details WHERE workspace_id = ?1`,
    )
      .bind(workspaceId)
      .first<{ n: number }>();
    expect(stray?.n).toBe(0);
  });
});
