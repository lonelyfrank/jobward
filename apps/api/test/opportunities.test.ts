import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { opportunitiesResponse } from '@jobward/schemas';
import { addCard, createMinimalBoard, newUser, type Api } from './kanban-helpers';

/** Ricerca e filtri (M2.3): `GET /opportunities`. */

interface Seed {
  title: string;
  patch?: Record<string, unknown>;
  labels?: string[];
  archived?: boolean;
}

async function world(email: string, seeds: Seed[], opts: { boards?: number } = {}) {
  const user = await newUser(email);
  const boards = [];
  for (let i = 0; i < (opts.boards ?? 1); i++)
    boards.push(await createMinimalBoard(user.api, `Bacheca ${i + 1}`));
  const labelByName: Record<string, string> = {};
  const cards: Record<string, string> = {};
  for (const seed of seeds) {
    const board = boards[(seed.patch?.['_board'] as number | undefined) ?? 0]!;
    const column = (seed.patch?.['_column'] as number | undefined) ?? 0;
    const card = await addCard(user.api, board.columnIds[column]!, seed.title);
    cards[seed.title] = card.id;
    const { _board, _column, ...patch } = seed.patch ?? {};
    void _board;
    void _column;
    if (Object.keys(patch).length > 0) {
      const res = await user.api.patch(`/cards/${card.id}`, patch);
      if (res.status !== 200) throw new Error(`patch fallita: ${JSON.stringify(res.body)}`);
    }
    for (const name of seed.labels ?? []) {
      if (!labelByName[name]) {
        labelByName[name] = (await user.api.post('/labels', { name })).body.label.id;
      }
      await user.api.post(`/cards/${card.id}/labels`, { labelId: labelByName[name] });
    }
    if (seed.archived) await user.api.post(`/cards/${card.id}/archive`);
  }
  return { ...user, boards, labelByName, cards };
}

const search = async (api: Api, query: object = {}) => {
  const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString();
  return api.get(`/opportunities${qs ? `?${qs}` : ''}`);
};
const titles = async (api: Api, query?: object) => {
  const res = await search(api, query);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return opportunitiesResponse.parse(res.body).items.map((i) => i.title);
};

const SEEDS: Seed[] = [
  {
    title: 'Infermiere di reparto',
    patch: {
      company: 'Ospedale Civile',
      jobTitle: 'Infermiere',
      location: 'Brescia',
      workMode: 'onsite',
      contractType: 'fixed_term',
      priority: 'high',
      stage: 'applied',
      outcome: 'pending',
      appliedOn: '2026-10-10',
      salaryMin: 1800,
      salaryMax: 2200,
      currency: 'EUR',
      salaryPeriod: 'month',
      source: 'Portale regionale',
    },
    labels: ['Interessante'],
  },
  {
    title: 'Sviluppatore backend',
    patch: {
      company: 'Acme Srl',
      jobTitle: 'Backend developer',
      location: 'Remoto',
      workMode: 'remote',
      contractType: 'permanent',
      priority: 'urgent',
      stage: 'interviewing',
      appliedOn: '2026-10-20',
      salaryMin: 35000,
      salaryMax: 45000,
      currency: 'EUR',
      salaryPeriod: 'year',
      description: 'Stack TypeScript e Postgres',
    },
    labels: ['Interessante', 'Estero'],
  },
  {
    title: 'Cuoco di linea',
    patch: {
      company: 'Trattoria Rossi',
      location: 'Milano',
      workMode: 'onsite',
      contractType: 'part_time',
      priority: 'low',
      stage: 'saved',
      _column: 1,
    },
    labels: ['Part-time'],
  },
  {
    title: 'Magazziniere',
    patch: {
      company: 'Logistica Nord',
      location: 'Torino',
      workMode: 'hybrid',
      contractType: 'temporary',
      stage: 'closed',
      outcome: 'rejected',
      appliedOn: '2026-09-01',
      salaryMin: 12,
      salaryMax: 14,
      currency: 'EUR',
      salaryPeriod: 'hour',
    },
  },
  {
    title: 'Insegnante di sostegno',
    patch: { company: 'Istituto Comprensivo', location: 'Roma' },
    archived: true,
  },
  {
    title: 'Barista',
    patch: { _board: 1, company: 'Caffè Roma', location: 'Roma', priority: 'medium' },
  },
];

describe('ricerca testuale', () => {
  it('trova per titolo, azienda, posizione, descrizione, sede e fonte; ignora le maiuscole (ASCII)', async () => {
    const w = await world('o-text@example.com', SEEDS, { boards: 2 });
    expect(await titles(w.api, { q: 'cuoco' })).toEqual(['Cuoco di linea']); // titolo
    expect(await titles(w.api, { q: 'ACME' })).toEqual(['Sviluppatore backend']); // azienda
    expect(await titles(w.api, { q: 'backend developer' })).toEqual(['Sviluppatore backend']); // posizione
    expect(await titles(w.api, { q: 'postgres' })).toEqual(['Sviluppatore backend']); // descrizione
    expect(await titles(w.api, { q: 'brescia' })).toEqual(['Infermiere di reparto']); // sede
    expect(await titles(w.api, { q: 'portale' })).toEqual(['Infermiere di reparto']); // fonte
  });

  it('ogni parola deve comparire (AND), anche in campi diversi', async () => {
    const w = await world('o-and@example.com', SEEDS, { boards: 2 });
    expect(await titles(w.api, { q: 'roma barista' })).toEqual(['Barista']); // sede + titolo
    expect(await titles(w.api, { q: 'roma cuoco' })).toEqual([]);
    expect(await titles(w.api, { q: '  acme   srl ' })).toEqual(['Sviluppatore backend']);
  });

  it('nessun risultato è una risposta valida (200 con elenco vuoto e totale 0)', async () => {
    const w = await world('o-none@example.com', SEEDS, { boards: 2 });
    const res = await search(w.api, { q: 'inesistente' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: [], total: 0, pageCount: 0 });
  });

  it('i caratteri speciali sono letterali: % _ \\ \' " e tentativi di iniezione non rompono né allargano la ricerca', async () => {
    const w = await world('o-special@example.com', [
      { title: 'Sconto 100% garantito' },
      { title: 'Codice A_B' },
      { title: 'Percorso C:\\temp' },
      { title: "Dell'Orto Spa" },
      { title: 'Normale' },
    ]);
    expect(await titles(w.api, { q: '100%' })).toEqual(['Sconto 100% garantito']);
    expect(await titles(w.api, { q: '%' })).toEqual(['Sconto 100% garantito']); // non è un jolly
    expect(await titles(w.api, { q: 'A_B' })).toEqual(['Codice A_B']);
    expect(await titles(w.api, { q: '_' })).toEqual(['Codice A_B']);
    expect(await titles(w.api, { q: '\\' })).toEqual(['Percorso C:\\temp']);
    expect(await titles(w.api, { q: "dell'orto" })).toEqual(["Dell'Orto Spa"]);
    for (const attack of [
      "'; DROP TABLE cards; --",
      '" OR 1=1 --',
      "') OR ('1'='1",
      "%' OR k.id LIKE '%",
    ]) {
      const res = await search(w.api, { q: attack });
      expect(res.status, attack).toBe(200);
      expect(res.body.total, attack).toBe(0);
    }
    expect((await search(w.api)).body.total).toBe(5); // la tabella è intatta
  });

  it('testo troppo lungo o con troppe parole → 400', async () => {
    const w = await world('o-qlimit@example.com', SEEDS, { boards: 2 });
    expect((await search(w.api, { q: 'x'.repeat(101) })).status).toBe(400);
    expect((await search(w.api, { q: 'a b c d e f g' })).status).toBe(400);
    expect((await search(w.api, { q: 'a b c d e f' })).status).toBe(200);
  });
});

describe('filtri', () => {
  it('priorità: OR tra i valori dello stesso gruppo', async () => {
    const w = await world('o-prio@example.com', SEEDS, { boards: 2 });
    expect(await titles(w.api, { priority: 'high,urgent', sort: 'title' })).toEqual([
      'Infermiere di reparto',
      'Sviluppatore backend',
    ]);
    expect(await titles(w.api, { priority: 'low' })).toEqual(['Cuoco di linea']);
  });

  it('fase, esito, modalità e contratto, con "none" per il valore non indicato', async () => {
    const w = await world('o-vocab@example.com', SEEDS, { boards: 2 });
    expect(await titles(w.api, { stage: 'applied,interviewing', sort: 'title' })).toEqual([
      'Infermiere di reparto',
      'Sviluppatore backend',
    ]);
    expect(await titles(w.api, { outcome: 'rejected' })).toEqual(['Magazziniere']);
    expect(await titles(w.api, { outcome: 'none', sort: 'title' })).toEqual([
      'Barista',
      'Cuoco di linea',
      'Sviluppatore backend',
    ]);
    expect(await titles(w.api, { stage: 'none' })).toEqual(['Barista']);
    expect(await titles(w.api, { workMode: 'remote,hybrid', sort: 'title' })).toEqual([
      'Magazziniere',
      'Sviluppatore backend',
    ]);
    expect(await titles(w.api, { contractType: 'part_time' })).toEqual(['Cuoco di linea']);
    expect(await titles(w.api, { workMode: 'hybrid,none', sort: 'title' })).toEqual([
      'Barista',
      'Magazziniere',
    ]);
  });

  it('semantica spec: priorità alta AND (remoto OR ibrido) AND etichetta "Interessante"', async () => {
    const w = await world('o-combo@example.com', SEEDS, { boards: 2 });
    const query = {
      priority: 'high,urgent',
      workMode: 'remote,hybrid',
      labelId: w.labelByName['Interessante']!,
    };
    expect(await titles(w.api, query)).toEqual(['Sviluppatore backend']);
    // Un gruppo che esclude tutto azzera il risultato (filtri incompatibili).
    expect(await titles(w.api, { ...query, stage: 'saved' })).toEqual([]);
  });

  it('etichette: una qualsiasi delle selezionate; un’etichetta altrui non produce risultati', async () => {
    const w = await world('o-label@example.com', SEEDS, { boards: 2 });
    const { Interessante, Estero, 'Part-time': partTime } = w.labelByName;
    expect(await titles(w.api, { labelId: Estero!, sort: 'title' })).toEqual([
      'Sviluppatore backend',
    ]);
    expect(await titles(w.api, { labelId: `${Estero},${partTime}`, sort: 'title' })).toEqual([
      'Cuoco di linea',
      'Sviluppatore backend',
    ]);
    expect((await titles(w.api, { labelId: Interessante! })).length).toBe(2);
    expect(await titles(w.api, { labelId: 'id-inesistente' })).toEqual([]);
  });

  it('bacheca e colonna', async () => {
    const w = await world('o-board@example.com', SEEDS, { boards: 2 });
    expect(await titles(w.api, { boardId: w.boards[1]!.boardId })).toEqual(['Barista']);
    const col1 = w.boards[0]!.columnIds[1]!;
    expect(await titles(w.api, { columnId: col1 })).toEqual(['Cuoco di linea']);
    expect((await titles(w.api, { boardId: w.boards[0]!.boardId })).length).toBe(4);
  });

  it('intervallo di date di candidatura: estremi inclusi, schede senza data escluse', async () => {
    const w = await world('o-dates@example.com', SEEDS, { boards: 2 });
    expect(
      await titles(w.api, {
        appliedFrom: '2026-10-10',
        appliedTo: '2026-10-20',
        sort: 'appliedOn',
        dir: 'asc',
      }),
    ).toEqual(['Infermiere di reparto', 'Sviluppatore backend']);
    expect(await titles(w.api, { appliedFrom: '2026-10-11' })).toEqual(['Sviluppatore backend']);
    expect(await titles(w.api, { appliedTo: '2026-09-30' })).toEqual(['Magazziniere']);
    expect(
      (await search(w.api, { appliedFrom: '2026-12-01', appliedTo: '2026-01-01' })).status,
    ).toBe(400);
    expect((await search(w.api, { appliedFrom: '2026-02-30' })).status).toBe(400);
  });

  it('retribuzione: sovrapposizione di intervalli, solo tra importi omogenei; richiede valuta e periodo', async () => {
    const w = await world('o-salary@example.com', SEEDS, { boards: 2 });
    const base = { currency: 'EUR', salaryPeriod: 'month' };
    expect(await titles(w.api, { ...base, salaryMin: 2000, salaryMax: 3000 })).toEqual([
      'Infermiere di reparto',
    ]); // 1800–2200 si sovrappone
    expect(await titles(w.api, { ...base, salaryMin: 2300 })).toEqual([]);
    // Gli importi annuali e orari non si confondono con quelli mensili.
    expect(
      await titles(w.api, { currency: 'EUR', salaryPeriod: 'year', salaryMin: 40000 }),
    ).toEqual(['Sviluppatore backend']);
    expect(await titles(w.api, { currency: 'EUR', salaryPeriod: 'hour', salaryMax: 13 })).toEqual([
      'Magazziniere',
    ]);
    expect(await titles(w.api, { currency: 'CHF', salaryPeriod: 'month', salaryMin: 1 })).toEqual(
      [],
    );
    for (const bad of [
      { salaryMin: 100 },
      { salaryMin: 100, currency: 'EUR' },
      { salaryMax: 100, salaryPeriod: 'month' },
      { salaryMin: 200, salaryMax: 100, ...base },
    ]) {
      expect((await search(w.api, bad)).status, JSON.stringify(bad)).toBe(400);
    }
  });

  it('archiviate: escluse di default; "include" e "only" le mostrano', async () => {
    const w = await world('o-arch@example.com', SEEDS, { boards: 2 });
    expect((await titles(w.api)).includes('Insegnante di sostegno')).toBe(false);
    expect((await titles(w.api, { archived: 'include' })).includes('Insegnante di sostegno')).toBe(
      true,
    );
    expect(await titles(w.api, { archived: 'only' })).toEqual(['Insegnante di sostegno']);
    expect(await titles(w.api, { q: 'sostegno' })).toEqual([]);
  });
});

describe('ordinamento e paginazione', () => {
  it('ordina per ogni chiave consentita, con i valori mancanti sempre in fondo', async () => {
    const w = await world('o-sort@example.com', SEEDS, { boards: 2 });
    expect(await titles(w.api, { sort: 'title' })).toEqual([
      'Barista',
      'Cuoco di linea',
      'Infermiere di reparto',
      'Magazziniere',
      'Sviluppatore backend',
    ]);
    expect(await titles(w.api, { sort: 'title', dir: 'desc' })).toEqual([
      'Sviluppatore backend',
      'Magazziniere',
      'Infermiere di reparto',
      'Cuoco di linea',
      'Barista',
    ]);
    // Priorità per rango semantico (non alfabetico): urgent > high > medium > low > none.
    expect(await titles(w.api, { sort: 'priority' })).toEqual([
      'Sviluppatore backend',
      'Infermiere di reparto',
      'Barista',
      'Cuoco di linea',
      'Magazziniere',
    ]);
    expect((await titles(w.api, { sort: 'priority', dir: 'asc' })).at(0)).toBe('Magazziniere');
    // Fase per rango del percorso: saved < applied < interviewing < closed; la scheda senza fase in fondo.
    expect(await titles(w.api, { sort: 'stage' })).toEqual([
      'Cuoco di linea',
      'Infermiere di reparto',
      'Sviluppatore backend',
      'Magazziniere',
      'Barista',
    ]);
    expect((await titles(w.api, { sort: 'stage', dir: 'desc' })).at(-1)).toBe('Barista'); // NULL sempre in fondo
    // Date: più recente prima; senza data in fondo.
    const byDate = await titles(w.api, { sort: 'appliedOn' });
    expect(byDate.slice(0, 3)).toEqual([
      'Sviluppatore backend',
      'Infermiere di reparto',
      'Magazziniere',
    ]);
    expect(new Set(byDate.slice(3))).toEqual(new Set(['Barista', 'Cuoco di linea'])); // senza data: in fondo
    const ascending = await titles(w.api, { sort: 'appliedOn', dir: 'asc' });
    expect(ascending.slice(0, 3)).toEqual([
      'Magazziniere',
      'Infermiere di reparto',
      'Sviluppatore backend',
    ]);
    expect(new Set(ascending.slice(3))).toEqual(new Set(['Barista', 'Cuoco di linea'])); // anche in ordine crescente
    for (const sort of [
      'company',
      'board',
      'column',
      'location',
      'workMode',
      'contractType',
      'outcome',
      'updatedAt',
      'createdAt',
    ]) {
      expect((await search(w.api, { sort })).status, sort).toBe(200);
    }
  });

  it('chiavi di ordinamento sconosciute o con SQL → 400 (insieme chiuso)', async () => {
    const w = await world('o-sortbad@example.com', SEEDS, { boards: 2 });
    for (const sort of ['id', 'k.title', 'title; DROP TABLE cards', 'title,id', 'password', '1']) {
      expect((await search(w.api, { sort })).status, sort).toBe(400);
    }
    for (const dir of ['up', 'ASC', 'desc; --', '']) {
      const res = await search(w.api, { dir });
      if (dir === '') expect(res.status).toBe(200);
      else expect(res.status, dir).toBe(400);
    }
  });

  it('paginazione: pagine disgiunte, unione completa, totale e numero di pagine corretti', async () => {
    const seeds = Array.from({ length: 23 }, (_, i) => ({
      title: `Scheda ${String(i + 1).padStart(2, '0')}`,
      patch: { company: i % 2 ? 'Pari' : 'Dispari' },
    }));
    const w = await world('o-page@example.com', seeds);
    const seen: string[] = [];
    for (const page of [1, 2, 3]) {
      const res = await search(w.api, { page, pageSize: 10, sort: 'company' }); // molti valori uguali: serve lo spareggio
      const body = opportunitiesResponse.parse(res.body);
      expect(body).toMatchObject({ total: 23, page, pageSize: 10, pageCount: 3 });
      expect(body.items.length).toBe(page === 3 ? 3 : 10);
      seen.push(...body.items.map((i) => i.id));
    }
    expect(new Set(seen).size).toBe(23); // nessun duplicato né salto
    // Ripetibile: lo stesso ordinamento restituisce le stesse pagine.
    const again = opportunitiesResponse.parse(
      (await search(w.api, { page: 2, pageSize: 10, sort: 'company' })).body,
    );
    expect(again.items.map((i) => i.id)).toEqual(seen.slice(10, 20));
  });

  it('pagina oltre la fine: elenco vuoto con totale corretto; parametri di pagina fuori limite → 400', async () => {
    const w = await world('o-pagebad@example.com', SEEDS, { boards: 2 });
    const beyond = opportunitiesResponse.parse(
      (await search(w.api, { page: 9, pageSize: 25 })).body,
    );
    expect(beyond).toMatchObject({ items: [], total: 5, pageCount: 1 });
    for (const bad of [
      { page: 0 },
      { page: -1 },
      { page: 'x' },
      { pageSize: 0 },
      { pageSize: 51 },
      { pageSize: 1000000 },
    ]) {
      expect((await search(w.api, bad)).status, JSON.stringify(bad)).toBe(400);
    }
  });
});

describe('validazione del contratto', () => {
  it('parametri sconosciuti, ripetuti o fuori vocabolario → 400, mai ignorati', async () => {
    const w = await world('o-contract@example.com', SEEDS, { boards: 2 });
    for (const bad of [
      { sconosciuto: 1 },
      { workspace: 'x' },
      { priority: 'altissima' },
      { stage: 'colloquio' },
      { workMode: 'office' },
      { outcome: 'won,pending' },
      { archived: 'tutte' },
      { currency: 'euro', salaryMin: 1, salaryPeriod: 'month' },
      { labelId: ',,' },
    ]) {
      const res = await search(w.api, bad);
      expect(res.status, JSON.stringify(bad)).toBe(400);
      expect(res.body.error.code).toBe('validation_error');
    }
    const repeated = await w.api.get('/opportunities?q=a&q=b');
    expect(repeated.status).toBe(400);
    // I parametri vuoti equivalgono ad assenti.
    expect((await w.api.get('/opportunities?q=&priority=&sort=')).status).toBe(200);
  });

  it('una risposta è sempre valida rispetto allo schema condiviso e include etichette e nomi', async () => {
    const w = await world('o-shape@example.com', SEEDS, { boards: 2 });
    const body = opportunitiesResponse.parse((await search(w.api, { q: 'acme' })).body);
    expect(body.items[0]).toMatchObject({
      title: 'Sviluppatore backend',
      boardName: 'Bacheca 1',
      columnName: 'Da fare',
      company: 'Acme Srl',
      jobTitle: 'Backend developer',
      salaryMin: 35000,
      stage: 'interviewing',
    });
    expect(body.items[0]!.labelIds).toHaveLength(2);
  });
});

describe('isolamento tra workspace', () => {
  it('la ricerca non restituisce, conta o rivela nulla di altri workspace', async () => {
    const mine = await world('o-iso-a@example.com', [
      { title: 'Mia scheda', patch: { company: 'MiaSpa' } },
    ]);
    const theirs = await world('o-iso-b@example.com', [
      {
        title: 'Scheda riservata',
        patch: { company: 'SegretaSpa', location: 'Atlantide' },
        labels: ['Riservata'],
      },
      { title: 'Altra riservata', patch: { company: 'SegretaSpa' } },
    ]);
    // Ricerca per ciò che esiste solo nell'altro workspace: zero risultati e zero nel totale.
    for (const q of ['SegretaSpa', 'riservata', 'Atlantide']) {
      expect(await search(mine.api, { q })).toMatchObject({
        status: 200,
        body: { items: [], total: 0 },
      });
    }
    expect((await search(mine.api)).body.total).toBe(1);
    // Id di bacheca/colonna/etichetta altrui: nessun errore diverso, nessun risultato.
    const probes = [
      { boardId: theirs.boards[0]!.boardId },
      { columnId: theirs.boards[0]!.columnIds[0]! },
      { labelId: theirs.labelByName['Riservata']! },
    ];
    for (const probe of probes) {
      const res = await search(mine.api, probe);
      expect(res, JSON.stringify(probe)).toMatchObject({
        status: 200,
        body: { items: [], total: 0 },
      });
    }
    // Con il workspaceId altrui nella query l'utente non è membro: 404.
    const { clientFor } = await import('./kanban-helpers');
    expect(
      (await clientFor('o-iso-a@example.com', theirs.workspaceId).get('/opportunities')).status,
    ).toBe(404);
  });
});

describe('prestazioni su un workspace grande', () => {
  it('2.000 schede in una bacheca: ricerca, filtri e ordinamento restano veloci e corretti', async () => {
    const w = await world('o-perf@example.com', []);
    const board = w.boards[0];
    void board;
    const b = await createMinimalBoard(w.api, 'Grande');
    const now = Date.now();
    // Inserimento di massa con una sola istruzione (CTE ricorsiva): 2.000 schede, 3 su 4 con dettagli.
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 2000)
       INSERT INTO cards (id, workspace_id, board_id, column_id, title, description, position, priority, created_at, updated_at)
       SELECT 'perf-' || i, ?1, ?2, ?3, 'Opportunità ' || i, CASE WHEN i % 50 = 0 THEN 'turni notturni' END, i * 1024,
              CASE i % 5 WHEN 0 THEN 'high' ELSE 'none' END, ?4, ?4 + i FROM n`,
    )
      .bind(w.workspaceId, b.boardId, b.columnIds[0], now)
      .run();
    await env.DB.prepare(
      `INSERT INTO application_details (card_id, workspace_id, company, location, stage, applied_on, created_at, updated_at)
       SELECT id, workspace_id, 'Azienda ' || (CAST(substr(id, 6) AS INTEGER) % 40), 'Città ' || (CAST(substr(id, 6) AS INTEGER) % 10),
              CASE CAST(substr(id, 6) AS INTEGER) % 4 WHEN 0 THEN 'applied' WHEN 1 THEN 'interviewing' WHEN 2 THEN 'saved' END,
              CASE WHEN CAST(substr(id, 6) AS INTEGER) % 3 = 0 THEN '2026-10-' || printf('%02d', 1 + CAST(substr(id, 6) AS INTEGER) % 28) END,
              created_at, updated_at
       FROM cards WHERE workspace_id = ?1 AND id LIKE 'perf-%' AND CAST(substr(id, 6) AS INTEGER) % 4 <> 3`,
    )
      .bind(w.workspaceId)
      .run();

    const timed = async (query: Record<string, string | number>) => {
      const start = performance.now();
      const res = await search(w.api, query);
      const ms = performance.now() - start;
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      return { body: opportunitiesResponse.parse(res.body), ms };
    };

    const all = await timed({ pageSize: 50 });
    expect(all.body.total).toBe(2000);
    expect(all.body.items).toHaveLength(50);
    expect(all.body.pageCount).toBe(40);

    const text = await timed({ q: 'notturni' });
    expect(text.body.total).toBe(40);
    const company = await timed({ q: 'azienda 7', sort: 'title' });
    expect(company.body.total).toBeGreaterThan(0);
    const filtered = await timed({
      stage: 'applied,interviewing',
      priority: 'high',
      sort: 'appliedOn',
      page: 2,
      pageSize: 25,
    });
    expect(filtered.body.items.length).toBeGreaterThan(0);
    const deep = await timed({ page: 40, pageSize: 50, sort: 'company' });
    expect(deep.body.items).toHaveLength(50);

    // Soglia larga (CI condivisa): serve a intercettare scansioni patologiche, non a fare benchmark.
    for (const { ms } of [all, text, company, filtered, deep]) expect(ms).toBeLessThan(1500);
    console.info(
      `[perf] 2000 schede — tutte ${all.ms.toFixed(0)} ms · testo ${text.ms.toFixed(0)} ms · azienda ${company.ms.toFixed(0)} ms · filtri+ordine ${filtered.ms.toFixed(0)} ms · pagina 40 ${deep.ms.toFixed(0)} ms`,
    );
  }, 60_000);
});
