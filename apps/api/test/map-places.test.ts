import { env } from 'cloudflare:workers';
import {
  opportunitiesMapResponse,
  opportunityCitiesResponse,
  placesResponse,
} from '@jobward/schemas';
import { LIMITS } from '@jobward/shared';
import { describe, expect, it } from 'vitest';
import { addCard, createMinimalBoard, newUser } from './kanban-helpers';

/** Mappa delle opportunità (D-07): posizioni personali, coordinate delle opportunità, `GET /opportunities/map`. */

const MILANO = { latitude: 45.4642, longitude: 9.19 };
const TORINO = { latitude: 45.0703, longitude: 7.6869 };

describe('posizioni personali', () => {
  it('crea, elenca (casa per prima), modifica ed elimina', async () => {
    const { api } = await newUser('pl-crud@example.com');
    const other = await api.post('/me/places', { name: 'Torino', kind: 'other', ...TORINO });
    expect(other.status).toBe(201);
    const home = await api.post('/me/places', { name: 'Casa', kind: 'home', ...MILANO });
    expect(home.status).toBe(201);
    expect(home.body.place).toMatchObject({ name: 'Casa', kind: 'home', ...MILANO });

    let places = placesResponse.parse((await api.get('/me/places')).body).places;
    expect(places.map((p) => p.name)).toEqual(['Casa', 'Torino']);

    const moved = await api.patch(`/me/places/${other.body.place.id}`, {
      name: 'Torino centro',
      latitude: 45.07,
      longitude: 7.68,
    });
    expect(moved.status).toBe(200);
    expect(moved.body.place).toMatchObject({ name: 'Torino centro', latitude: 45.07 });

    expect((await api.delete(`/me/places/${home.body.place.id}`)).status).toBe(204);
    places = placesResponse.parse((await api.get('/me/places')).body).places;
    expect(places.map((p) => p.name)).toEqual(['Torino centro']);
  });

  it('una sola casa: sceglierne un’altra rende «altra» la precedente', async () => {
    const { api } = await newUser('pl-home@example.com');
    const first = await api.post('/me/places', { name: 'Casa', kind: 'home', ...MILANO });
    const second = await api.post('/me/places', { name: 'Nuova casa', kind: 'home', ...TORINO });
    expect(second.status).toBe(201);
    let places = placesResponse.parse((await api.get('/me/places')).body).places;
    expect(places.map((p) => [p.name, p.kind])).toEqual([
      ['Nuova casa', 'home'],
      ['Casa', 'other'],
    ]);

    // Anche con la modifica.
    await api.patch(`/me/places/${first.body.place.id}`, { kind: 'home' });
    places = placesResponse.parse((await api.get('/me/places')).body).places;
    expect(places.filter((p) => p.kind === 'home').map((p) => p.name)).toEqual(['Casa']);
  });

  it('rifiuta nomi duplicati, coordinate non valide e coordinate spaiate', async () => {
    const { api } = await newUser('pl-invalid@example.com');
    const created = await api.post('/me/places', { name: 'Casa', kind: 'home', ...MILANO });
    expect((await api.post('/me/places', { name: 'casa', kind: 'other', ...TORINO })).status).toBe(
      409,
    );
    expect(
      (await api.post('/me/places', { name: 'X', kind: 'other', latitude: 91, longitude: 0 }))
        .status,
    ).toBe(400);
    expect((await api.post('/me/places', { name: 'X', kind: 'office', ...MILANO })).status).toBe(
      400,
    );
    expect((await api.post('/me/places', { name: '', kind: 'other', ...MILANO })).status).toBe(400);
    expect((await api.patch(`/me/places/${created.body.place.id}`, { latitude: 45 })).status).toBe(
      400,
    );
  });

  it(`al massimo ${LIMITS.placesPerUserMax} posizioni`, async () => {
    const { api } = await newUser('pl-limit@example.com');
    for (let i = 0; i < LIMITS.placesPerUserMax; i++) {
      const res = await api.post('/me/places', { name: `P${i}`, kind: 'other', ...MILANO });
      expect(res.status).toBe(201);
    }
    const over = await api.post('/me/places', { name: 'Oltre', kind: 'home', ...MILANO });
    expect(over.status).toBe(409);
    // Oltre il limite non cambia nulla, nemmeno la casa.
    const places = placesResponse.parse((await api.get('/me/places')).body).places;
    expect(places).toHaveLength(LIMITS.placesPerUserMax);
  });

  it('appartengono all’identità: un altro utente non le vede né le modifica', async () => {
    const mine = await newUser('pl-own@example.com');
    const id = (await mine.api.post('/me/places', { name: 'Casa', kind: 'home', ...MILANO })).body
      .place.id as string;
    const other = await newUser('pl-other@example.com');
    expect(placesResponse.parse((await other.api.get('/me/places')).body).places).toEqual([]);
    expect((await other.api.patch(`/me/places/${id}`, { name: 'x' })).status).toBe(404);
    expect((await other.api.delete(`/me/places/${id}`)).status).toBe(404);
    expect(placesResponse.parse((await mine.api.get('/me/places')).body).places).toHaveLength(1);
  });
});

describe('coordinate delle opportunità', () => {
  it('si salvano, si leggono e si azzerano sempre in coppia', async () => {
    const { api } = await newUser('co-pair@example.com');
    const { columnIds } = await createMinimalBoard(api);
    const card = await addCard(api, columnIds[0]!, 'Sviluppatore');

    const saved = await api.patch(`/cards/${card.id}`, { location: 'Milano', ...MILANO });
    expect(saved.status).toBe(200);
    expect(saved.body.card).toMatchObject({ location: 'Milano', ...MILANO });

    expect((await api.patch(`/cards/${card.id}`, { latitude: 45 })).status).toBe(400);
    expect((await api.patch(`/cards/${card.id}`, { latitude: null, longitude: 9 })).status).toBe(
      400,
    );
    expect((await api.patch(`/cards/${card.id}`, { latitude: 45, longitude: 181 })).status).toBe(
      400,
    );

    const cleared = await api.patch(`/cards/${card.id}`, { latitude: null, longitude: null });
    expect(cleared.body.card).toMatchObject({
      location: 'Milano',
      latitude: null,
      longitude: null,
    });
  });

  it('il database rifiuta coordinate spaiate o fuori intervallo anche senza l’API', async () => {
    const { api, workspaceId } = await newUser('co-db@example.com');
    const { columnIds } = await createMinimalBoard(api);
    const card = await addCard(api, columnIds[0]!, 'Scheda');
    await api.patch(`/cards/${card.id}`, { ...MILANO });
    const write = (sql: string) => env.DB.prepare(sql).bind(card.id, workspaceId).run();
    await expect(
      write(
        'UPDATE application_details SET latitude = NULL WHERE card_id = ?1 AND workspace_id = ?2',
      ),
    ).rejects.toThrow(/coordinate non valide/);
    await expect(
      write(
        'UPDATE application_details SET latitude = 95 WHERE card_id = ?1 AND workspace_id = ?2',
      ),
    ).rejects.toThrow(/coordinate non valide/);
    await expect(
      write(
        'UPDATE application_details SET latitude = NULL, longitude = NULL WHERE card_id = ?1 AND workspace_id = ?2',
      ),
    ).resolves.toBeDefined();
  });
});

describe('GET /opportunities/map', () => {
  async function world(email: string) {
    const user = await newUser(email);
    const { columnIds } = await createMinimalBoard(user.api);
    const make = async (title: string, patch: object) => {
      const card = await addCard(user.api, columnIds[0]!, title);
      const res = await user.api.patch(`/cards/${card.id}`, patch);
      if (res.status !== 200) throw new Error(JSON.stringify(res.body));
      return card.id;
    };
    const ids = {
      milano: await make('Milano', { priority: 'high', company: 'Alfa', ...MILANO }),
      torino: await make('Torino', { priority: 'low', company: 'Beta', ...TORINO }),
      remoto: await make('Senza sede', { priority: 'high', location: 'Da remoto' }),
      archiviata: await make('Archiviata', { priority: 'high', ...MILANO }),
    };
    await user.api.post(`/cards/${ids.archiviata}/archive`);
    return { ...user, ids };
  }

  it('restituisce le opportunità filtrate, prima quelle con coordinate, e conta le non localizzabili', async () => {
    const { api } = await world('map-all@example.com');
    const res = await api.get('/opportunities/map');
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const body = opportunitiesMapResponse.parse(res.body);
    expect(body).toMatchObject({ total: 3, located: 2, truncated: false });
    expect(body.items.map((i) => i.title).slice(2)).toEqual(['Senza sede']);
    expect(body.items.find((i) => i.title === 'Milano')).toMatchObject({
      company: 'Alfa',
      ...MILANO,
    });
  });

  it('applica gli stessi filtri dell’elenco (priorità, testo, archivio)', async () => {
    const { api } = await world('map-filters@example.com');
    const map = async (qs: string) =>
      opportunitiesMapResponse.parse((await api.get(`/opportunities/map?${qs}`)).body);
    const list = async (qs: string) => (await api.get(`/opportunities?${qs}`)).body.total as number;

    for (const qs of ['priority=high', 'q=torino', 'archived=only', 'archived=include']) {
      const result = await map(qs);
      expect(result.total, qs).toBe(await list(qs));
    }
    expect((await map('priority=high')).items.map((i) => i.title).sort()).toEqual([
      'Milano',
      'Senza sede',
    ]);
    expect((await map('archived=only')).items.map((i) => i.title)).toEqual(['Archiviata']);
    expect((await api.get('/opportunities/map?priority=urgentissima')).status).toBe(400);
  });

  it('vede solo il proprio workspace', async () => {
    await world('map-iso-a@example.com');
    const other = await newUser('map-iso-b@example.com');
    const body = opportunitiesMapResponse.parse((await other.api.get('/opportunities/map')).body);
    expect(body).toMatchObject({ items: [], total: 0, located: 0 });
  });
});

describe('città delle opportunità (D-07)', () => {
  async function world(email: string) {
    const user = await newUser(email);
    const { columnIds } = await createMinimalBoard(user.api);
    const make = async (title: string, patch: object) => {
      const card = await addCard(user.api, columnIds[0]!, title);
      const res = await user.api.patch(`/cards/${card.id}`, patch);
      if (res.status !== 200) throw new Error(JSON.stringify(res.body));
      return card.id;
    };
    await make('Brera', { city: 'Milano', ...MILANO });
    await make('Isola', { city: ' milano ' });
    await make('Centro', { city: 'Torino', ...TORINO });
    await addCard(user.api, columnIds[0]!, 'Remoto'); // nessuna città
    const archived = await make('Archiviata', { city: 'Roma' });
    await user.api.post(`/cards/${archived}/archive`);
    return user;
  }

  it('si salva nei dettagli e la ricerca testuale la trova', async () => {
    const { api } = await world('city-save@example.com');
    const list = (await api.get('/opportunities?q=torino')).body;
    expect(list.items.map((i: { title: string; city: string }) => [i.title, i.city])).toEqual([
      ['Centro', 'Torino'],
    ]);
  });

  it('filtra elenco e mappa allo stesso modo: senza maiuscole, più città, «none» = non indicata', async () => {
    const { api } = await world('city-filter@example.com');
    const titles = async (qs: string) =>
      ((await api.get(`/opportunities?${qs}`)).body.items as { title: string }[])
        .map((i) => i.title)
        .sort();
    const mapTitles = async (qs: string) =>
      opportunitiesMapResponse
        .parse((await api.get(`/opportunities/map?${qs}`)).body)
        .items.map((i) => i.title)
        .sort();
    for (const [qs, expected] of [
      ['city=MILANO', ['Brera', 'Isola']],
      ['city=milano,Torino', ['Brera', 'Centro', 'Isola']],
      ['city=none', ['Remoto']],
      ['city=Torino,none', ['Centro', 'Remoto']],
      ['city=Roma', []],
      ['city=Roma&archived=only', ['Archiviata']],
    ] as const) {
      expect(await titles(qs), qs).toEqual(expected);
      expect(await mapTitles(qs), qs).toEqual(expected);
    }
    const tooMany = Array.from({ length: LIMITS.citiesPerFilterMax + 1 }, (_, i) => `C${i}`);
    expect((await api.get(`/opportunities?city=${tooMany.join(',')}`)).status).toBe(400);
  });

  it('elenca le città usate con la grafia prevalente e conta quelle senza città', async () => {
    const { api } = await world('city-list@example.com');
    const body = opportunityCitiesResponse.parse((await api.get('/opportunities/cities')).body);
    expect(body).toEqual({
      cities: [
        { city: 'Milano', count: 2 },
        { city: 'Torino', count: 1 },
      ],
      withoutCity: 1,
    });
    const other = await newUser('city-list-other@example.com');
    expect(
      opportunityCitiesResponse.parse((await other.api.get('/opportunities/cities')).body),
    ).toEqual({ cities: [], withoutCity: 0 });
  });
});
