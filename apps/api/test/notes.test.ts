import { env } from 'cloudflare:workers';
import { noteResponse, notesResponse } from '@jobward/schemas';
import { LIMITS } from '@jobward/shared';
import { describe, expect, it } from 'vitest';
import { clientFor, newUser } from './kanban-helpers';
import { exec, setupCard, uid } from './m3-helpers';

const create = (
  c: Awaited<ReturnType<typeof setupCard>>,
  body: Record<string, unknown>,
  card = c.card.id,
) => c.api.post(`/cards/${card}/notes`, body);
const list = async (c: Awaited<ReturnType<typeof setupCard>>) =>
  notesResponse.parse((await c.api.get(`/cards/${c.card.id}/notes`)).body).notes;
const row = (id: string) =>
  env.DB.prepare('SELECT * FROM card_notes WHERE id = ?1')
    .bind(id)
    .first<Record<string, unknown>>();

describe('note — creazione e lettura', () => {
  it('201 alla prima creazione; il testo è rifilato e persistito; la scheda risulta aggiornata', async () => {
    const c = await setupCard('note-create@example.com');
    const before = (await c.api.get(`/cards/${c.card.id}`)).body.card.updatedAt;
    const id = uid();
    const res = await create(c, { id, body: '  Ricontattare il lunedì  ' });
    expect(res.status).toBe(201);
    expect(noteResponse.parse(res.body).note).toMatchObject({
      id,
      cardId: c.card.id,
      body: 'Ricontattare il lunedì',
    });
    expect((await list(c)).map((n) => n.id)).toEqual([id]);
    expect((await c.api.get(`/cards/${c.card.id}`)).body.card.updatedAt).toBeGreaterThanOrEqual(
      before,
    );
    const stored = await row(id);
    expect(stored!['request_fingerprint']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('le note non generano eventi di sistema (il testo vive solo nella nota)', async () => {
    const c = await setupCard('note-noevent@example.com');
    const events = async () =>
      (await env.DB.prepare('SELECT count(*) n FROM activity_events WHERE card_id = ?1')
        .bind(c.card.id)
        .first<{ n: number }>())!.n;
    const before = await events();
    await create(c, { id: uid(), body: 'segreto-xyz' });
    expect(await events()).toBe(before);
    const dump = await env.DB.prepare(
      'SELECT group_concat(metadata) m FROM activity_events WHERE card_id = ?1',
    )
      .bind(c.card.id)
      .first<{ m: string }>();
    expect(dump!.m ?? '').not.toContain('segreto-xyz');
  });

  it('validazione: corpo vuoto/solo spazi, troppo lungo, ID mancante o malformato, campi extra', async () => {
    const c = await setupCard('note-validate@example.com');
    for (const body of [
      { id: uid(), body: '   ' },
      { id: uid(), body: 'x'.repeat(LIMITS.noteBodyMax + 1) },
      { body: 'senza id' },
      { id: 'corto', body: 'x' },
      { id: uid(), body: 'x', extra: true },
    ]) {
      expect((await create(c, body)).status, JSON.stringify(body).slice(0, 60)).toBe(400);
    }
    expect((await create(c, { id: uid(), body: 'x'.repeat(LIMITS.noteBodyMax) })).status).toBe(201);
    expect(await list(c)).toHaveLength(1);
  });

  it('elenco: dal più recente; solo le note della scheda', async () => {
    const c = await setupCard('note-order@example.com');
    const other = (await c.api.post('/cards', { columnId: c.columnIds[0], title: 'Altra' })).body
      .card.id;
    const a = uid();
    const b = uid();
    await create(c, { id: a, body: 'prima' });
    await new Promise((r) => setTimeout(r, 3));
    await create(c, { id: b, body: 'seconda' });
    await create(c, { id: uid(), body: 'di un’altra' }, other);
    expect((await list(c)).map((n) => n.id)).toEqual([b, a]);
  });
});

describe('note — idempotenza (D5)', () => {
  it('retry: 200 con la stessa identità, nessuna seconda nota; vale anche dopo una modifica', async () => {
    const c = await setupCard('note-replay@example.com');
    const body = { id: uid(), body: 'originale' };
    const first = await create(c, body);
    const second = await create(c, body);
    expect([first.status, second.status]).toEqual([201, 200]);
    expect(second.body.note.id).toBe(first.body.note.id);
    expect(await list(c)).toHaveLength(1);

    const patch = await c.api.patch(`/notes/${body.id}`, { body: 'modificata' });
    expect(patch.status).toBe(200);
    const late = await create(c, body); // replay della richiesta ORIGINALE dopo la modifica
    expect(late.status).toBe(200);
    expect(late.body.note.body).toBe('modificata'); // risorsa corrente, non ricreata né riscritta
    expect(await list(c)).toHaveLength(1);
  });

  it('stesso ID con testo diverso o su un’altra scheda: 409 senza modificare nulla', async () => {
    const c = await setupCard('note-mismatch@example.com');
    const other = (await c.api.post('/cards', { columnId: c.columnIds[0], title: 'Altra' })).body
      .card.id;
    const id = uid();
    await create(c, { id, body: 'uno' });
    expect((await create(c, { id, body: 'due' })).status).toBe(409);
    expect((await create(c, { id, body: 'uno' }, other)).status).toBe(409);
    expect((await list(c)).map((n) => n.body)).toEqual(['uno']);
  });

  it('richieste concorrenti identiche: una nota; diverse con lo stesso ID: una vince, le altre 409', async () => {
    const c = await setupCard('note-race@example.com');
    const same = { id: uid(), body: 'identica' };
    const res = await Promise.all(Array.from({ length: 5 }, () => create(c, same)));
    expect(res.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 201]);
    expect(await list(c)).toHaveLength(1);

    const id = uid();
    const diff = await Promise.all(['a', 'b', 'c'].map((body) => create(c, { id, body })));
    expect(diff.filter((r) => r.status === 201)).toHaveLength(1);
    expect(diff.filter((r) => r.status === 409)).toHaveLength(2);
    expect(await list(c)).toHaveLength(2);
  });

  it('più creazioni concorrenti con ID diversi: tutte riuscite', async () => {
    const c = await setupCard('note-race-many@example.com');
    const res = await Promise.all(
      Array.from({ length: 8 }, (_, i) => create(c, { id: uid(), body: `n${i}` })),
    );
    expect(res.every((r) => r.status === 201)).toBe(true);
    expect(await list(c)).toHaveLength(8);
  });

  it('un ID già usato in un altro workspace non rivela nulla: 409 generico, nessuna scrittura', async () => {
    const a = await setupCard('note-iso-a@example.com');
    const b = await setupCard('note-iso-b@example.com');
    const id = uid();
    await create(a, { id, body: 'di A' });
    const res = await create(b, { id, body: 'di B' });
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).not.toContain('di A');
    expect(await list(b)).toHaveLength(0);
    expect(await list(a)).toHaveLength(1);
  });
});

describe('note — modifica, eliminazione, lapide', () => {
  it('modifica: aggiorna testo e updatedAt, non il fingerprint né createdAt', async () => {
    const c = await setupCard('note-edit@example.com');
    const id = uid();
    const created = (await create(c, { id, body: 'v1' })).body.note;
    const fp = (await row(id))!['request_fingerprint'];
    await new Promise((r) => setTimeout(r, 3));
    const res = await c.api.patch(`/notes/${id}`, { body: 'v2' });
    expect(res.body.note).toMatchObject({ body: 'v2', createdAt: created.createdAt });
    expect(res.body.note.updatedAt).toBeGreaterThan(created.updatedAt);
    expect((await row(id))!['request_fingerprint']).toBe(fp);
    expect((await c.api.patch(`/notes/${id}`, { body: ' ' })).status).toBe(400);
    expect((await c.api.patch(`/notes/${id}`, {})).status).toBe(400);
  });

  it('eliminazione: 204, sparisce dall’elenco, il testo è azzerato nel database; ripetibile (204)', async () => {
    const c = await setupCard('note-delete@example.com');
    const id = uid();
    await create(c, { id, body: 'da cancellare-qwerty' });
    expect((await c.api.delete(`/notes/${id}`)).status).toBe(204);
    expect(await list(c)).toHaveLength(0);
    const stored = await row(id);
    expect(stored).toMatchObject({ body: '', request_fingerprint: null });
    expect(stored!['deleted_at']).toBeTypeOf('number');
    expect((await c.api.delete(`/notes/${id}`)).status).toBe(204); // retry dopo risposta persa
    expect((await c.api.patch(`/notes/${id}`, { body: 'x' })).status).toBe(404);
    expect((await c.api.delete(`/notes/${uid()}`)).status).toBe(404);
  });

  it('un retry tardivo della creazione NON ricrea la nota eliminata (409)', async () => {
    const c = await setupCard('note-late@example.com');
    const body = { id: uid(), body: 'effimera' };
    await create(c, body);
    await c.api.delete(`/notes/${body.id}`);
    const late = await create(c, body);
    expect(late.status).toBe(409);
    expect(await list(c)).toHaveLength(0);
    // lo stesso ID con testo diverso: ugualmente rifiutato
    expect((await create(c, { id: body.id, body: 'altro' })).status).toBe(409);
  });

  it('le lapidi non contano per il tetto e quelle vecchie vengono ripulite', async () => {
    const c = await setupCard('note-purge@example.com');
    const old = uid();
    await create(c, { id: old, body: 'x' });
    await c.api.delete(`/notes/${old}`);
    await exec(`UPDATE card_notes SET deleted_at = 1000 WHERE id = '${old}'`);
    const fresh = uid();
    await create(c, { id: fresh, body: 'y' });
    await c.api.delete(`/notes/${fresh}`); // la cancellazione ripulisce le lapidi oltre la conservazione
    expect(await row(old)).toBeNull();
    expect(await row(fresh)).not.toBeNull();
  });
});

describe('note — tetto, archivio, isolamento', () => {
  it('tetto per scheda atomico: la nota oltre il limite è 409; con lapidi non si supera comunque', async () => {
    const c = await setupCard('note-cap@example.com');
    const now = Date.now();
    const rows = Array.from({ length: LIMITS.notesPerCardMax - 1 }, (_, i) =>
      env.DB.prepare(
        `INSERT INTO card_notes (id, workspace_id, card_id, body, request_fingerprint, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'n', ?4, ?5, ?5)`,
      ).bind(
        `seed-note-${String(i).padStart(4, '0')}-xxxx`,
        c.workspaceId,
        c.card.id,
        'a'.repeat(64),
        now + i,
      ),
    );
    await env.DB.batch(rows);
    // due richieste concorrenti per l'ultimo posto: una sola entra
    const race = await Promise.all([
      create(c, { id: uid(), body: 'a' }),
      create(c, { id: uid(), body: 'b' }),
    ]);
    expect(race.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await list(c)).toHaveLength(LIMITS.notesPerCardMax);
    expect((await create(c, { id: uid(), body: 'c' })).status).toBe(409);
  });

  it('candidatura archiviata: lettura sì, scritture 409 (creazione, modifica, eliminazione); il replay resta leggibile', async () => {
    const c = await setupCard('note-archived@example.com');
    const body = { id: uid(), body: 'prima' };
    await create(c, body);
    await c.api.post(`/cards/${c.card.id}/archive`, {});
    expect(await list(c)).toHaveLength(1);
    for (const res of [
      await create(c, { id: uid(), body: 'nuova' }),
      await c.api.patch(`/notes/${body.id}`, { body: 'x' }),
      await c.api.delete(`/notes/${body.id}`),
    ]) {
      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/archiviata/);
    }
    expect((await create(c, body)).status).toBe(200); // retry di una creazione già avvenuta
    await c.api.post(`/cards/${c.card.id}/restore`, {});
    expect((await create(c, { id: uid(), body: 'dopo' })).status).toBe(201);
  });

  it('isolamento: note di un altro workspace → 404 su elenco, creazione, modifica, eliminazione', async () => {
    const a = await setupCard('note-own-a@example.com');
    const b = await newUser('note-own-b@example.com');
    const id = uid();
    await create(a, { id, body: 'riservata' });
    expect((await b.api.get(`/cards/${a.card.id}/notes`)).status).toBe(404);
    expect((await b.api.post(`/cards/${a.card.id}/notes`, { id: uid(), body: 'x' })).status).toBe(
      404,
    );
    expect((await b.api.patch(`/notes/${id}`, { body: 'x' })).status).toBe(404);
    expect((await b.api.delete(`/notes/${id}`)).status).toBe(404);
    const foreign = clientFor('note-own-b@example.com', a.workspaceId);
    expect((await foreign.get(`/cards/${a.card.id}/notes`)).status).toBe(404);
    expect((await foreign.patch(`/notes/${id}`, { body: 'x' })).status).toBe(404);
    expect((await list(a))[0]!.body).toBe('riservata');
  });

  it('eliminare la scheda elimina le sue note (cascata)', async () => {
    const c = await setupCard('note-cascade@example.com');
    const id = uid();
    await create(c, { id, body: 'x' });
    await env.DB.prepare('DELETE FROM cards WHERE id = ?1').bind(c.card.id).run();
    expect(await row(id)).toBeNull();
  });
});
