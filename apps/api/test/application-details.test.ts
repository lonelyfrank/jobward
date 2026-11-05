import { describe, expect, it } from 'vitest';
import { cardResponse } from '@meet-roulette/schemas';
import { addCard, createMinimalBoard, newUser } from './kanban-helpers';

/** Dettagli professionali di una scheda (M2.1): contratto, semantica della patch, eventi, isolamento. */

async function setup(email: string) {
  const user = await newUser(email);
  const board = await createMinimalBoard(user.api);
  const card = await addCard(user.api, board.columnIds[0]!, 'Infermiere');
  return { ...user, ...board, card };
}

const FULL = {
  company: 'Ospedale Civile',
  jobTitle: 'Infermiere di reparto',
  location: 'Brescia',
  workMode: 'onsite',
  contractType: 'fixed_term',
  salaryMin: 1800,
  salaryMax: 2200,
  currency: 'EUR',
  salaryPeriod: 'month',
  salaryBasis: 'net',
  source: 'Portale regionale',
  sourceUrl: 'https://example.com/annuncio/42',
  publishedOn: '2026-10-20',
  appliedOn: '2026-10-25',
  stage: 'applied',
  outcome: 'pending',
} as const;

describe('creazione: solo il titolo è obbligatorio', () => {
  it('una scheda con il solo titolo ha tutti i dettagli nulli e nessuna etichetta', async () => {
    const { card, api } = await setup('d-min@example.com');
    const res = await api.get(`/cards/${card.id}`);
    expect(cardResponse.parse({ card: res.body.card }).card).toMatchObject({
      company: null,
      jobTitle: null,
      location: null,
      workMode: null,
      contractType: null,
      salaryMin: null,
      salaryMax: null,
      currency: null,
      salaryPeriod: null,
      salaryBasis: null,
      source: null,
      sourceUrl: null,
      publishedOn: null,
      appliedOn: null,
      stage: null,
      outcome: null,
      labelIds: [],
    });
  });

  it('accetta tutti i dettagli nel payload di creazione e li restituisce', async () => {
    const { api, columnIds } = await setup('d-create@example.com');
    const res = await api.post('/cards', { columnId: columnIds[0], title: 'Cuoco', details: FULL });
    expect(res.status).toBe(201);
    expect(res.body.card).toMatchObject(FULL);
  });

  it('i payload di M1 ({company, sourceUrl}) restano validi', async () => {
    const { api, columnIds } = await setup('d-m1@example.com');
    const res = await api.post('/cards', {
      columnId: columnIds[0],
      title: 'x',
      details: { company: 'Acme', sourceUrl: 'https://example.com/x' },
    });
    expect(res.status).toBe(201);
    expect(res.body.card).toMatchObject({
      company: 'Acme',
      sourceUrl: 'https://example.com/x',
      stage: null,
    });
  });
});

describe('PATCH: assente = invariato, null = azzera', () => {
  it('modifica un solo campo senza toccare gli altri (nessuna perdita)', async () => {
    const { api, card } = await setup('d-patch@example.com');
    await api.patch(`/cards/${card.id}`, FULL);
    const res = await api.patch(`/cards/${card.id}`, { location: 'Milano' });
    expect(res.status).toBe(200);
    expect(res.body.card).toMatchObject({ ...FULL, location: 'Milano' });
  });

  it('null azzera, e il campo resta distinto da "assente"', async () => {
    const { api, card } = await setup('d-null@example.com');
    await api.patch(`/cards/${card.id}`, FULL);
    const res = await api.patch(`/cards/${card.id}`, {
      outcome: null,
      salaryBasis: null,
      workMode: null,
    });
    expect(res.body.card).toMatchObject({
      ...FULL,
      outcome: null,
      salaryBasis: null,
      workMode: null,
    });
  });

  it('la stringa vuota o di soli spazi equivale a nessun valore; il testo viene rifilato', async () => {
    const { api, card } = await setup('d-trim@example.com');
    await api.patch(`/cards/${card.id}`, { company: '  Acme  ', location: 'Roma' });
    const res = await api.patch(`/cards/${card.id}`, { company: '   ', location: '' });
    expect(res.body.card).toMatchObject({ company: null, location: null });
    const again = await api.patch(`/cards/${card.id}`, { company: '  Beta ' });
    expect(again.body.card.company).toBe('Beta');
  });

  it('il titolo non può essere azzerato; corpo vuoto, chiavi ignote e di sistema sono rifiutati', async () => {
    const { api, card } = await setup('d-strict@example.com');
    for (const body of [
      { title: null },
      { title: '  ' },
      {},
      { nonEsiste: 1 },
      { id: 'x' },
      { createdAt: 1 },
      { workspaceId: 'altro' },
      { labelIds: ['a'] },
      { position: 5 },
    ]) {
      expect((await api.patch(`/cards/${card.id}`, body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it('una modifica su una scheda senza riga di dettagli la crea (upsert) e aggiorna updatedAt', async () => {
    const { api, card } = await setup('d-upsert@example.com');
    const before = (await api.get(`/cards/${card.id}`)).body.card.updatedAt as number;
    await new Promise((r) => setTimeout(r, 5));
    const res = await api.patch(`/cards/${card.id}`, { stage: 'preparing' });
    expect(res.body.card.stage).toBe('preparing');
    expect(res.body.card.updatedAt).toBeGreaterThan(before);
  });
});

describe('validazione dei dettagli', () => {
  const bad: [string, object][] = [
    ['modalità fuori vocabolario', { workMode: 'office' }],
    ['contratto fuori vocabolario', { contractType: 'stage' }],
    ['fase fuori vocabolario', { stage: 'colloquio' }],
    ['esito fuori vocabolario', { outcome: 'won' }],
    ['periodo fuori vocabolario', { salaryPeriod: 'decade' }],
    ['lordo/netto fuori vocabolario', { salaryBasis: 'gross-ish' }],
    ['importo negativo', { salaryMin: -1, currency: 'EUR' }],
    ['importo non intero', { salaryMin: 10.5, currency: 'EUR' }],
    ['importo non numerico', { salaryMin: '1000', currency: 'EUR' }],
    ['importo oltre il massimo', { salaryMax: 3_000_000_000, currency: 'EUR' }],
    ['minimo oltre il massimo', { salaryMin: 3000, salaryMax: 2000, currency: 'EUR' }],
    ['valuta minuscola', { currency: 'eur' }],
    ['valuta non ISO', { currency: 'EURO' }],
    ['URL javascript:', { sourceUrl: 'javascript:alert(1)' }],
    ['URL data:', { sourceUrl: 'data:text/html,x' }],
    ['URL senza schema', { sourceUrl: 'example.com/a' }],
    ['data inesistente', { appliedOn: '2026-02-30' }],
    ['data con ora', { appliedOn: '2026-02-10T10:00:00Z' }],
    ['data in formato locale', { publishedOn: '10/02/2026' }],
    ['testo oltre il massimo', { company: 'x'.repeat(121) }],
  ];
  for (const [name, body] of bad) {
    it(`rifiuta: ${name}`, async () => {
      const { api, card } = await setup(`d-bad-${Math.random().toString(36).slice(2)}@example.com`);
      const res = await api.patch(`/cards/${card.id}`, body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('validation_error');
    });
  }

  it('un importo richiede la valuta, valutata sullo stato RISULTANTE (non sul solo payload)', async () => {
    const { api, card } = await setup('d-currency@example.com');
    const noCurrency = await api.patch(`/cards/${card.id}`, { salaryMin: 100 });
    expect(noCurrency.status).toBe(400);
    expect(noCurrency.body.error.issues[0].path).toBe('currency');

    // La valuta è già salvata: indicare solo l'importo è valido.
    expect((await api.patch(`/cards/${card.id}`, { salaryMin: 100, currency: 'CHF' })).status).toBe(
      200,
    );
    expect((await api.patch(`/cards/${card.id}`, { salaryMax: 200 })).status).toBe(200);
    // Non si può togliere la valuta lasciando gli importi.
    const drop = await api.patch(`/cards/${card.id}`, { currency: null });
    expect(drop.status).toBe(400);
    // Né rendere incoerente l'intervallo con un solo estremo.
    const range = await api.patch(`/cards/${card.id}`, { salaryMax: 50 });
    expect(range.status).toBe(400);
    expect(range.body.error.issues[0].path).toBe('salaryMax');
    // Svuotare tutto insieme è lecito.
    expect(
      (await api.patch(`/cards/${card.id}`, { salaryMin: null, salaryMax: null, currency: null }))
        .status,
    ).toBe(200);
  });

  it('un solo estremo è ammesso (annuncio con "da 1500" o "fino a 2000")', async () => {
    const { api, card } = await setup('d-onesided@example.com');
    const res = await api.patch(`/cards/${card.id}`, {
      salaryMin: 1500,
      currency: 'EUR',
      salaryPeriod: 'month',
    });
    expect(res.status).toBe(200);
    expect(res.body.card).toMatchObject({ salaryMin: 1500, salaryMax: null, salaryBasis: null });
  });

  it('i valori numerici restano numeri nella risposta', async () => {
    const { api, card } = await setup('d-types@example.com');
    const res = await api.patch(`/cards/${card.id}`, {
      salaryMin: 12,
      salaryMax: 15,
      currency: 'EUR',
      salaryPeriod: 'hour',
    });
    expect(typeof res.body.card.salaryMin).toBe('number');
    expect(typeof res.body.card.salaryMax).toBe('number');
  });
});

describe('colonna, fase ed esito sono indipendenti', () => {
  it('spostare una scheda NON cambia mai fase né esito, anche se la colonna ha una categoria', async () => {
    const { api, card, boardId, columnIds } = await setup('d-move@example.com');
    await api.patch(`/columns/${columnIds[1]}`, { category: 'interviewing' });
    await api.patch(`/cards/${card.id}`, { stage: 'applied', outcome: 'pending' });

    const move = await api.post(`/cards/${card.id}/move`, {
      columnId: columnIds[1],
      afterCardId: null,
    });
    expect(move.status).toBe(200);
    expect(move.body.card).toMatchObject({
      columnId: columnIds[1],
      stage: 'applied',
      outcome: 'pending',
    });

    const board = await api.get(`/boards/${boardId}`);
    const onBoard = board.body.cards.find((c: { id: string }) => c.id === card.id);
    expect(onBoard).toMatchObject({ stage: 'applied', outcome: 'pending' });
  });

  it('fase ed esito si cambiano indipendentemente e a mano', async () => {
    const { api, card } = await setup('d-indep@example.com');
    expect((await api.patch(`/cards/${card.id}`, { stage: 'closed' })).body.card).toMatchObject({
      stage: 'closed',
      outcome: null,
    });
    expect((await api.patch(`/cards/${card.id}`, { outcome: 'rejected' })).body.card).toMatchObject(
      { stage: 'closed', outcome: 'rejected' },
    );
    expect(
      (await api.patch(`/cards/${card.id}`, { stage: 'interviewing' })).body.card,
    ).toMatchObject({ stage: 'interviewing', outcome: 'rejected' });
  });
});

describe('cronologia', () => {
  const types = async (api: Awaited<ReturnType<typeof setup>>['api'], id: string) =>
    (
      (await api.get(`/cards/${id}`)).body.history as {
        type: string;
        metadata: Record<string, unknown>;
      }[]
    ).map((e) => e.type);

  it('registra stage_changed solo quando la fase cambia davvero', async () => {
    const { api, card } = await setup('d-ev-stage@example.com');
    await api.patch(`/cards/${card.id}`, { stage: 'applied' });
    await api.patch(`/cards/${card.id}`, { stage: 'applied' }); // invariata: nessun evento
    await api.patch(`/cards/${card.id}`, { stage: 'interviewing' });
    const detail = await api.get(`/cards/${card.id}`);
    const events = detail.body.history.filter((e: { type: string }) => e.type === 'stage_changed');
    expect(events).toHaveLength(2);
    expect(events.map((e: { metadata: unknown }) => e.metadata)).toEqual([
      { from: 'applied', to: 'interviewing' },
      { from: null, to: 'applied' },
    ]);
  });

  it('application_submitted alla PRIMA registrazione della data, non a ogni modifica', async () => {
    const { api, card } = await setup('d-ev-applied@example.com');
    await api.patch(`/cards/${card.id}`, { appliedOn: '2026-11-01' });
    await api.patch(`/cards/${card.id}`, { appliedOn: '2026-11-02' });
    const list = await types(api, card.id);
    expect(list.filter((t) => t === 'application_submitted')).toHaveLength(1);
  });

  it('application_closed per un esito definitivo, non per "in attesa"', async () => {
    const { api, card } = await setup('d-ev-closed@example.com');
    await api.patch(`/cards/${card.id}`, { outcome: 'pending' });
    expect(await types(api, card.id)).not.toContain('application_closed');
    await api.patch(`/cards/${card.id}`, { outcome: 'rejected' });
    expect(await types(api, card.id)).toContain('application_closed');
  });

  it('una modifica rifiutata non lascia eventi', async () => {
    const { api, card } = await setup('d-ev-reject@example.com');
    await api.patch(`/cards/${card.id}`, { stage: 'offer', salaryMin: 10 }); // manca la valuta → 400
    expect(await types(api, card.id)).toEqual(['card_created']);
  });
});

describe('stato della scheda e isolamento', () => {
  it('una scheda archiviata non è modificabile (409) e non si crea nessun dettaglio', async () => {
    const { api, card } = await setup('d-archived@example.com');
    await api.post(`/cards/${card.id}/archive`);
    expect((await api.patch(`/cards/${card.id}`, { company: 'x' })).status).toBe(409);
    await api.post(`/cards/${card.id}/restore`);
    expect((await api.get(`/cards/${card.id}`)).body.card.company).toBeNull();
  });

  it('un altro workspace non può leggere né modificare i dettagli (404 identico all’inesistente)', async () => {
    const owner = await setup('d-iso-a@example.com');
    const other = await newUser('d-iso-b@example.com');
    await owner.api.patch(`/cards/${owner.card.id}`, {
      company: 'Riservata Spa',
      salaryMin: 5,
      currency: 'EUR',
    });

    const read = await other.api.get(`/cards/${owner.card.id}`);
    const edit = await other.api.patch(`/cards/${owner.card.id}`, { company: 'hack' });
    const ghost = await other.api.patch('/cards/inesistente', { company: 'hack' });
    expect(read.status).toBe(404);
    expect(edit.status).toBe(404);
    expect(edit.body).toEqual({
      error: expect.objectContaining({ code: 'not_found', message: ghost.body.error.message }),
    });
    expect(JSON.stringify(edit.body)).not.toContain('Riservata');
    expect((await owner.api.get(`/cards/${owner.card.id}`)).body.card.company).toBe(
      'Riservata Spa',
    );
  });

  it('il workspaceId nel body non è mai attendibile', async () => {
    const owner = await setup('d-ws-a@example.com');
    const other = await newUser('d-ws-b@example.com');
    const res = await other.api.patch(`/cards/${owner.card.id}`, {
      company: 'x',
      workspaceId: owner.workspaceId,
    });
    expect(res.status).toBe(400);
  });
});
