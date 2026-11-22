import { savedViewsResponse } from '@jobward/schemas';
import { describe, expect, it } from 'vitest';
import { newUser } from './kanban-helpers';

/** Viste salvate (D-04). */
describe('viste salvate', () => {
  it('crea, elenca in ordine, rinomina, aggiorna i parametri ed elimina', async () => {
    const { api } = await newUser('sv@example.com');
    const a = await api.post('/views', { name: 'Remoto', params: 'mode=remote&sort=title' });
    expect(a.status).toBe(201);
    const b = await api.post('/views', { name: 'Inbox interessanti', params: 'vista=inbox' });
    expect(b.status).toBe(201);

    const list = savedViewsResponse.parse((await api.get('/views')).body).views;
    expect(list.map((v) => v.name)).toEqual(['Remoto', 'Inbox interessanti']);

    const renamed = await api.patch(`/views/${a.body.view.id}`, {
      name: 'Da remoto',
      params: 'mode=remote',
    });
    expect(renamed.body.view).toMatchObject({ name: 'Da remoto', params: 'mode=remote' });

    expect((await api.delete(`/views/${b.body.view.id}`)).status).toBe(204);
    expect(savedViewsResponse.parse((await api.get('/views')).body).views).toHaveLength(1);
  });

  it('nome univoco senza distinzione di maiuscole; parametri non validi rifiutati', async () => {
    const { api } = await newUser('sv-dup@example.com');
    await api.post('/views', { name: 'Remoto', params: '' });
    expect((await api.post('/views', { name: 'remoto', params: '' })).status).toBe(409);
    expect((await api.post('/views', { name: 'X', params: '?q=1' })).status).toBe(400);
    expect((await api.post('/views', { name: '', params: '' })).status).toBe(400);
  });

  it('le viste di un altro workspace non sono visibili né modificabili', async () => {
    const mine = await newUser('sv-own@example.com');
    const id = (await mine.api.post('/views', { name: 'Mia', params: '' })).body.view.id as string;
    const other = await newUser('sv-other@example.com');
    expect(savedViewsResponse.parse((await other.api.get('/views')).body).views).toEqual([]);
    expect((await other.api.patch(`/views/${id}`, { name: 'x' })).status).toBe(404);
    expect((await other.api.delete(`/views/${id}`)).status).toBe(404);
  });
});
