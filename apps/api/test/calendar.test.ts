import { calendarResponse } from '@jobward/schemas';
import { addDays, localDate } from '@jobward/shared';
import { describe, expect, it } from 'vitest';
import { newUser } from './kanban-helpers';
import { uid } from './m3-helpers';

/** Calendario (D-06): colloqui, scadenze delle attività e degli annunci nello stesso intervallo. */
describe('GET /calendar', () => {
  it('riunisce colloqui, attività con scadenza e scadenze degli annunci, nel fuso del workspace', async () => {
    const { api } = await newUser('cal@example.com');
    const card = (await api.post('/cards', { title: 'Tecnico IT' })).body.card.id as string;
    const today = localDate(Date.now(), 'UTC');
    const inThree = addDays(today, 3);
    await api.patch(`/cards/${card}`, { deadlineOn: inThree });
    await api.post(`/cards/${card}/interviews`, {
      id: uid(),
      title: 'Colloquio tecnico',
      scheduledAt: Date.parse(`${addDays(today, 2)}T10:00:00Z`),
    });
    await api.post('/tasks', {
      id: uid(),
      title: 'Ricontattare',
      cardId: card,
      dueOn: addDays(today, 1),
    });
    await api.post('/tasks', { id: uid(), title: 'Fuori intervallo', dueOn: addDays(today, 40) });

    const res = await api.get(`/calendar?from=${today}&to=${addDays(today, 7)}`);
    expect(res.status).toBe(200);
    const { items } = calendarResponse.parse(res.body);
    expect(items.map((i) => [i.kind, i.title, i.date])).toEqual([
      ['task', 'Ricontattare', addDays(today, 1)],
      ['interview', 'Colloquio tecnico', addDays(today, 2)],
      ['deadline', 'Scadenza dell’annuncio', inThree],
    ]);
    expect(items.every((i) => i.cardId === card)).toBe(true);
  });

  it('intervalli non validi o troppo ampi → 400', async () => {
    const { api } = await newUser('cal-bad@example.com');
    expect((await api.get('/calendar?from=2026-11-10&to=2026-11-01')).status).toBe(400);
    expect((await api.get('/calendar?from=2026-01-01&to=2026-06-01')).status).toBe(400);
    expect((await api.get('/calendar')).status).toBe(400);
  });
});
