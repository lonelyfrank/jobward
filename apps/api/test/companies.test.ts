import { companiesResponse, companyDetailResponse, duplicatesResponse } from '@jobward/schemas';
import { describe, expect, it } from 'vitest';
import { newUser } from './kanban-helpers';
import { transition } from './m3-helpers';

/** Aziende e duplicati (B-05). */
describe('aziende', () => {
  it('il nome scritto sull’opportunità collega la stessa azienda anche se scritto diversamente', async () => {
    const { api } = await newUser('co-link@example.com');
    const a = await api.post('/cards', {
      title: 'Tecnico',
      details: { company: 'Vela Servizi S.r.l.' },
    });
    const b = await api.post('/cards', { title: 'Sistemista' });
    await api.patch(`/cards/${b.body.card.id}`, { company: 'VELA servizi' });
    await transition(api, a.body.card.id, { to: 'applied', kind: 'advance' });

    expect(a.body.card.companyId).toBeTruthy();
    const list = companiesResponse.parse((await api.get('/companies')).body).companies;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      name: 'Vela Servizi S.r.l.',
      opportunities: 2,
      applications: 1,
      activeApplications: 1,
    });

    const detail = companyDetailResponse.parse((await api.get(`/companies/${list[0]!.id}`)).body);
    expect(detail.opportunities.map((o) => o.title).sort()).toEqual(['Sistemista', 'Tecnico']);
    // Il nome scritto dall'utente resta com'è su ogni opportunità.
    expect(detail.opportunities.map((o) => o.company).sort()).toEqual([
      'VELA servizi',
      'Vela Servizi S.r.l.',
    ]);
  });

  it('togliere il nome scollega; modificare l’azienda ne aggiorna nome, sito e note', async () => {
    const { api } = await newUser('co-edit@example.com');
    const card = (await api.post('/cards', { title: 'X', details: { company: 'Acme' } })).body.card;
    const id = card.companyId as string;
    const res = await api.patch(`/companies/${id}`, {
      name: 'Acme Italia',
      website: 'https://acme.example',
      notes: 'Referente: ufficio HR',
    });
    expect(res.status).toBe(200);
    expect(res.body.company).toMatchObject({
      name: 'Acme Italia',
      website: 'https://acme.example',
    });
    const cleared = await api.patch(`/cards/${card.id}`, { company: null });
    expect(cleared.body.card.companyId).toBeNull();
  });

  it('un’azienda di un altro workspace è 404', async () => {
    const mine = await newUser('co-own@example.com');
    const id = (await mine.api.post('/cards', { title: 'X', details: { company: 'Beta' } })).body
      .card.companyId as string;
    const other = await newUser('co-other@example.com');
    expect((await other.api.get(`/companies/${id}`)).status).toBe(404);
    expect((await other.api.patch(`/companies/${id}`, { notes: 'x' })).status).toBe(404);
  });
});

describe('duplicati', () => {
  it('segnala stesso link, stessa azienda con titolo simile; esclude l’opportunità indicata', async () => {
    const { api } = await newUser('co-dup@example.com');
    const a = await api.post('/cards', {
      title: 'Tecnico IT Junior Help Desk',
      details: { company: 'Vela Servizi', sourceUrl: 'https://jobs.example/42?utm_source=x' },
    });
    const q = (params: Record<string, string>) =>
      api.get(`/opportunities/duplicates?${new URLSearchParams(params).toString()}`);

    const byUrl = duplicatesResponse.parse(
      (await q({ title: 'Altro', sourceUrl: 'https://www.jobs.example/42/' })).body,
    );
    expect(byUrl.duplicates).toMatchObject([{ id: a.body.card.id, reason: 'same_url' }]);
    const byCompany = duplicatesResponse.parse(
      (await q({ title: 'tecnico it junior help desk', company: 'VELA SERVIZI srl' })).body,
    );
    expect(byCompany.duplicates[0]?.reason).toBe('same_company_similar_title');
    const excluded = duplicatesResponse.parse(
      (
        await q({
          title: 'Tecnico IT Junior Help Desk',
          company: 'Vela Servizi',
          excludeId: a.body.card.id,
        })
      ).body,
    );
    expect(excluded.duplicates).toEqual([]);
    expect((await q({ title: '' })).status).toBe(400);
  });
});
