import { notesPageResponse, notesResponse } from '@jobward/schemas';
import { describe, expect, it } from 'vitest';
import { setupCard, uid } from './m3-helpers';
import { newUser } from './kanban-helpers';
import { env } from 'cloudflare:workers';

describe('note — paginazione opt-in C3', () => {
  it('compatibilità C2, limite reale, tie-break, nuovi inserimenti ed eliminazioni fra pagine', async () => {
    const c = await setupCard('note-pages@example.com');
    const ids = [uid(), uid(), uid(), uid(), uid()].sort().reverse();
    for (const id of ids)
      await c.api.post(`/cards/${c.card.id}/notes`, { id, body: 'x'.repeat(10000) });
    await env.DB.prepare('UPDATE card_notes SET created_at = 1000 WHERE card_id = ?1')
      .bind(c.card.id)
      .run();
    const full = await c.api.get(`/cards/${c.card.id}/notes`);
    expect(notesResponse.parse(full.body).notes).toHaveLength(5);
    expect(full.body).not.toHaveProperty('nextCursor');
    const page = notesPageResponse.parse(
      (await c.api.get(`/cards/${c.card.id}/notes?limit=2`)).body,
    );
    expect(page.notes.map((n) => n.id)).toEqual(ids.slice(0, 2));
    expect(JSON.stringify(page).length).toBeLessThan(21000);
    await c.api.post(`/cards/${c.card.id}/notes`, { id: uid(), body: 'nuova' });
    await c.api.delete(`/notes/${ids[2]}`, {});
    const second = notesPageResponse.parse(
      (await c.api.get(`/cards/${c.card.id}/notes?limit=2&before=${page.nextCursor!}`)).body,
    );
    expect(second.notes.map((n) => n.id)).toEqual(ids.slice(3));
    expect(second.nextCursor).toBeNull();
    expect(new Set([...page.notes, ...second.notes].map((n) => n.id)).size).toBe(4);
  });
  it('rifiuta cursori/limiti invalidi e non rivela note di altri workspace', async () => {
    const c = await setupCard('note-pages-validation@example.com');
    for (const query of ['limit=0', 'limit=51', 'limit=abc', 'limit=2&before=invalid', 'before=']) {
      expect((await c.api.get(`/cards/${c.card.id}/notes?${query}`)).status).toBe(400);
    }
    const { api: other } = await newUser('note-pages-other@example.com');
    expect((await other.get(`/cards/${c.card.id}/notes?limit=2`)).status).toBe(404);
    expect((await c.api.get('/cards/missing/notes?limit=2')).status).toBe(404);
  });
  it('una pagina vuota e la lettura su scheda archiviata restano valide', async () => {
    const c = await setupCard('note-pages-empty@example.com');
    await c.api.post(`/cards/${c.card.id}/archive`, {});
    const response = await c.api.get(`/cards/${c.card.id}/notes?limit=25`);
    expect(response.status).toBe(200);
    expect(notesPageResponse.parse(response.body)).toEqual({ notes: [], nextCursor: null });
  });
});
