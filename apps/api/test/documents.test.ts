import { env } from 'cloudflare:workers';
import { documentResponse, documentsResponse } from '@jobward/schemas';
import { LIMITS } from '@jobward/shared';
import { describe, expect, it } from 'vitest';
import { clientFor, newUser } from './kanban-helpers';
import { setupCard, uid } from './m3-helpers';

type Ctx = Awaited<ReturnType<typeof setupCard>>;
const create = (c: Ctx, body: Record<string, unknown>, card = c.card.id) =>
  c.api.post(`/cards/${card}/documents`, body);
const list = async (c: Ctx) =>
  documentsResponse.parse((await c.api.get(`/cards/${c.card.id}/documents`)).body).documents;
const row = (id: string) =>
  env.DB.prepare('SELECT * FROM card_documents WHERE id = ?1')
    .bind(id)
    .first<Record<string, unknown>>();

describe('documenti — riferimenti, non file', () => {
  it('201: titolo, tipo, URL http(s) e nota; tipo predefinito «altro»', async () => {
    const c = await setupCard('doc-create@example.com');
    const id = uid();
    const res = await create(c, {
      id,
      title: ' CV 2026 ',
      kind: 'cv',
      url: 'https://drive.example.com/cv',
      note: 'versione breve',
    });
    expect(res.status).toBe(201);
    expect(documentResponse.parse(res.body).document).toMatchObject({
      id,
      cardId: c.card.id,
      title: 'CV 2026',
      kind: 'cv',
      url: 'https://drive.example.com/cv',
      note: 'versione breve',
    });
    const minimal = await create(c, { id: uid(), title: 'Solo titolo' });
    expect(minimal.body.document).toMatchObject({ kind: 'other', url: null, note: null });
    expect(await list(c)).toHaveLength(2);
  });

  it('validazione: schemi pericolosi, titolo vuoto/lungo, tipo sconosciuto, campi extra (es. un file)', async () => {
    const c = await setupCard('doc-validate@example.com');
    for (const body of [
      { id: uid(), title: 'x', url: 'javascript:alert(1)' },
      { id: uid(), title: 'x', url: 'data:text/html,<b>x</b>' },
      { id: uid(), title: 'x', url: 'ftp://example.com/a' },
      { id: uid(), title: 'x', url: 'non un url' },
      { id: uid(), title: ' ' },
      { id: uid(), title: 'x'.repeat(LIMITS.titleMax + 1) },
      { id: uid(), title: 'x', kind: 'exe' },
      { id: uid(), title: 'x', note: 'n'.repeat(LIMITS.documentNoteMax + 1) },
      { id: uid(), title: 'x', content: 'base64...' },
      { title: 'senza id' },
    ]) {
      expect((await create(c, body)).status, JSON.stringify(body).slice(0, 70)).toBe(400);
    }
    expect(await list(c)).toHaveLength(0);
  });

  it('il server non apre mai l’URL: nessuna richiesta in uscita durante creazione e modifica', async () => {
    const c = await setupCard('doc-nofetch@example.com');
    const calls: unknown[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (...args: unknown[]) => {
      calls.push(args);
      throw new Error('fetch non consentito');
    };
    try {
      const id = uid();
      expect(
        (await create(c, { id, title: 'Annuncio', url: 'http://localhost:9/interno' })).status,
      ).toBe(201);
      expect(
        (await c.api.patch(`/documents/${id}`, { url: 'http://169.254.169.254/latest' })).status,
      ).toBe(200);
    } finally {
      globalThis.fetch = original;
    }
    expect(calls).toHaveLength(0);
  });
});

describe('documenti — idempotenza (D5)', () => {
  it('retry 200 con la stessa identità, anche dopo una modifica; richiesta diversa con lo stesso ID: 409', async () => {
    const c = await setupCard('doc-replay@example.com');
    const body = {
      id: uid(),
      title: 'Lettera',
      kind: 'cover_letter',
      url: 'https://example.com/l',
    };
    const first = await create(c, body);
    const retry = await create(c, body);
    expect([first.status, retry.status]).toEqual([201, 200]);
    expect(await list(c)).toHaveLength(1);

    await c.api.patch(`/documents/${body.id}`, { title: 'Lettera v2', url: null });
    const late = await create(c, body);
    expect(late.status).toBe(200);
    expect(late.body.document).toMatchObject({ title: 'Lettera v2', url: null });

    for (const other of [
      { ...body, title: 'Altro' },
      { ...body, kind: 'cv' },
      { ...body, url: 'https://example.com/altro' },
      { ...body, note: 'nota' },
    ]) {
      expect((await create(c, other)).status).toBe(409);
    }
    expect(await list(c)).toHaveLength(1);
  });

  it('concorrenza: richieste identiche convergono; ID uguale e payload diverso → una vince', async () => {
    const c = await setupCard('doc-race@example.com');
    const same = { id: uid(), title: 'Portfolio', kind: 'portfolio' };
    const res = await Promise.all(Array.from({ length: 5 }, () => create(c, same)));
    expect(res.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 201]);
    const id = uid();
    const diff = await Promise.all(['a', 'b', 'c'].map((title) => create(c, { id, title })));
    expect(diff.filter((r) => r.status === 201)).toHaveLength(1);
    expect(diff.filter((r) => r.status === 409)).toHaveLength(2);
    expect(await list(c)).toHaveLength(2);
  });

  it('eliminazione: lapide senza dati, 204 ripetibile, il retry tardivo della creazione non ricrea il documento', async () => {
    const c = await setupCard('doc-delete@example.com');
    const body = {
      id: uid(),
      title: 'CV segreto-abc',
      url: 'https://example.com/x',
      note: 'riservata',
    };
    await create(c, body);
    expect((await c.api.delete(`/documents/${body.id}`)).status).toBe(204);
    expect((await c.api.delete(`/documents/${body.id}`)).status).toBe(204);
    expect(await list(c)).toHaveLength(0);
    expect(await row(body.id)).toMatchObject({
      title: '',
      url: null,
      note: null,
      request_fingerprint: null,
    });
    expect((await create(c, body)).status).toBe(409);
    expect(await list(c)).toHaveLength(0);
    expect((await c.api.patch(`/documents/${body.id}`, { title: 'x' })).status).toBe(404);
    expect((await c.api.delete(`/documents/${uid()}`)).status).toBe(404);
  });
});

describe('documenti — modifica, tetto, archivio, isolamento', () => {
  it('modifica parziale: assente = invariato, null azzera url e nota; corpo vuoto → 400', async () => {
    const c = await setupCard('doc-edit@example.com');
    const id = uid();
    await create(c, {
      id,
      title: 'Annuncio',
      kind: 'job_posting',
      url: 'https://example.com/a',
      note: 'n',
    });
    const res = await c.api.patch(`/documents/${id}`, { note: null });
    expect(res.body.document).toMatchObject({
      title: 'Annuncio',
      url: 'https://example.com/a',
      note: null,
    });
    expect((await c.api.patch(`/documents/${id}`, { url: 'javascript:x' })).status).toBe(400);
    expect((await c.api.patch(`/documents/${id}`, {})).status).toBe(400);
    expect((await c.api.patch(`/documents/${id}`, { kind: 'cv' })).body.document.kind).toBe('cv');
  });

  it('tetto per scheda atomico (50): la richiesta oltre il limite è 409, anche in concorrenza', async () => {
    const c = await setupCard('doc-cap@example.com');
    for (let i = 0; i < LIMITS.documentsPerCardMax - 1; i++) {
      expect((await create(c, { id: uid(), title: `d${i}` })).status).toBe(201);
    }
    const race = await Promise.all([
      create(c, { id: uid(), title: 'a' }),
      create(c, { id: uid(), title: 'b' }),
    ]);
    expect(race.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await list(c)).toHaveLength(LIMITS.documentsPerCardMax);
  });

  it('candidatura archiviata: sola lettura (409 in scrittura)', async () => {
    const c = await setupCard('doc-archived@example.com');
    const body = { id: uid(), title: 'CV' };
    await create(c, body);
    await c.api.post(`/cards/${c.card.id}/archive`, {});
    expect(await list(c)).toHaveLength(1);
    // il messaggio deve dire PERCHÉ (non un generico tetto o «cambiato nel frattempo»)
    for (const res of [
      await create(c, { id: uid(), title: 'nuovo' }),
      await c.api.patch(`/documents/${body.id}`, { title: 'x' }),
      await c.api.delete(`/documents/${body.id}`),
    ]) {
      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/archiviata/);
    }
    expect((await create(c, body)).status).toBe(200);
  });

  it('isolamento tra workspace: 404 ovunque, nessuna perdita di informazioni', async () => {
    const a = await setupCard('doc-iso-a@example.com');
    const b = await newUser('doc-iso-b@example.com');
    const id = uid();
    await create(a, { id, title: 'Riservato' });
    expect((await b.api.get(`/cards/${a.card.id}/documents`)).status).toBe(404);
    expect(
      (await b.api.post(`/cards/${a.card.id}/documents`, { id: uid(), title: 'x' })).status,
    ).toBe(404);
    expect((await b.api.patch(`/documents/${id}`, { title: 'x' })).status).toBe(404);
    expect((await b.api.delete(`/documents/${id}`)).status).toBe(404);
    const foreign = clientFor('doc-iso-b@example.com', a.workspaceId);
    expect((await foreign.get(`/cards/${a.card.id}/documents`)).status).toBe(404);
    expect((await list(a))[0]!.title).toBe('Riservato');
    const b2 = await setupCard('doc-iso-c@example.com');
    const clash = await create(b2, { id, title: 'Clash' }); // stesso ID di un altro workspace
    expect(clash.status).toBe(409);
    expect(JSON.stringify(clash.body)).not.toContain('Riservato');
  });

  it('il database rifiuta riferimenti fra workspace e valori fuori vocabolario (difesa in profondità)', async () => {
    const a = await setupCard('doc-db-a@example.com');
    const b = await setupCard('doc-db-b@example.com');
    const fp = 'a'.repeat(64);
    const insert = (ws: string, card: string, kind = 'cv', url: string | null = null) =>
      env.DB.prepare(
        `INSERT INTO card_documents (id, workspace_id, card_id, title, kind, url, request_fingerprint, created_at, updated_at)
         VALUES (?1, ?2, ?3, 't', ?4, ?5, ?6, 1, 1)`,
      )
        .bind(uid(), ws, card, kind, url, fp)
        .run();
    await expect(insert(a.workspaceId, a.card.id)).resolves.toBeTruthy();
    await expect(insert(a.workspaceId, b.card.id)).rejects.toThrow();
    await expect(insert(a.workspaceId, a.card.id, 'virus')).rejects.toThrow();
    await expect(insert(a.workspaceId, a.card.id, 'cv', 'javascript:alert(1)')).rejects.toThrow();
    // un documento vivo senza fingerprint non è ammesso (un CHECK che valuta NULL passerebbe!)
    await expect(
      env.DB.prepare(
        `INSERT INTO card_documents (id, workspace_id, card_id, title, created_at, updated_at) VALUES (?1, ?2, ?3, 't', 1, 1)`,
      )
        .bind(uid(), a.workspaceId, a.card.id)
        .run(),
    ).rejects.toThrow();
  });
});
