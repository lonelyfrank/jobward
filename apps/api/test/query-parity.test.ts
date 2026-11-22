import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { opportunitiesQuery, type Opportunity } from '@jobward/schemas';
import {
  applyQuery,
  CONTRACT_TYPES,
  foldKey,
  legacyFiltersToQuery,
  localDate,
  OUTCOMES,
  PRIORITIES,
  QUERY_SORT_KEYS,
  SMART_QUERY_LIMITS,
  sortByQuery,
  STAGES,
  WORK_MODES,
  type QueryContext,
  type QueryNode,
  type SmartQuery,
} from '@jobward/shared';
import { db } from './helpers';
import { createMinimalBoard, newUser, type Api } from './kanban-helpers';
import { searchOpportunities } from '../src/services/opportunities';

/**
 * Parità tra i due valutatori del motore di query v2 (M5-SW.3): lo STESSO insieme di schede e le
 * STESSE query, valutate (a) in memoria con `applyQuery` — il percorso del Kanban — e (b) dal
 * compilatore SQL sul D1 di workerd — il percorso della Tabella. Le due risposte devono essere
 * identiche, scheda per scheda, in più fusi orari, con campi mancanti, accenti e date di confine.
 */

const NOW = Date.parse('2026-11-09T11:00:00Z'); // orologio fisso: «oggi» deterministico

/** Generatore riproducibile (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T>(values: readonly T[]): T => values[Math.floor(next() * values.length)]!;
  const some = <T>(values: readonly T[], max = 3): T[] => [
    ...new Set(Array.from({ length: 1 + Math.floor(next() * max) }, () => pick(values))),
  ];
  return {
    next,
    pick,
    some,
    chance: (p: number) => next() < p,
    int: (n: number) => Math.floor(next() * n),
  };
}
type Rng = ReturnType<typeof rng>;

const TEXTS = [
  'Acme',
  'ACME',
  'acme',
  'Acme Group',
  'Café Rossi',
  'cafe rossi',
  'CAFÉ  ROSSI',
  'Café Rossi',
  'Città di Perù',
  'Èlite',
  'Zeta',
  'Milano, Lombardia',
  'Roma',
  'lombardìa',
  "O'Neil",
  '100% remoto',
  'a_b',
  'back\\slash',
  '  Spazio  doppio ',
  'Škoda',
  'ΑΛΦΑ',
  'Roma\tNord',
  'x' + ' '.repeat(33) + 'y',
  "'; DROP TABLE cards;--",
  'Ünïcödé',
  '日本語',
];
const NEEDLES = [
  'acme',
  'ROSSI',
  'cafe',
  'roma',
  'lombardia',
  'perù',
  '%',
  '_',
  '\\',
  "'",
  'skoda',
  'škoda',
  'αλφα',
  'spazio doppio',
  'nord',
  'x y',
  'e',
  'xyz',
];
const TITLES = ['Alfa', 'beta', 'Zebra', 'zulu', 'Éclair', 'Ångström', '😀 emoji', '日本', 'Alfa'];
const CITIES = ['Europe/Rome', 'America/New_York', 'Australia/Lord_Howe'] as const;

// Giorni attorno ai cambi d'ora di Roma (28/03 e 24-25/10), New York (1/11) e Lord Howe (4/10).
const CLUSTERS = [
  '2026-03-28T22:00:00Z',
  '2026-10-24T21:00:00Z',
  '2026-11-01T03:00:00Z',
  '2026-10-03T13:00:00Z',
  '2026-11-08T22:00:00Z',
  '2026-01-01T00:00:00Z',
].map(Date.parse);
const DAYS = [
  '2025-12-31',
  '2026-01-01',
  '2026-03-28',
  '2026-03-29',
  '2026-10-04',
  '2026-10-25',
  '2026-11-01',
  '2026-11-08',
  '2026-11-09',
  '2026-11-10',
  '2027-01-01',
];

interface World {
  api: Api;
  workspaceId: string;
  timeZone: string;
  context: QueryContext;
  labelIds: string[];
  items: Opportunity[];
}

const parse = (input: Record<string, string | undefined>) =>
  opportunitiesQuery.parse(
    Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
  );

/** Tutte le pagine di una ricerca, nell'ordine restituito dal server. */
async function fetchAll(
  world: Pick<World, 'workspaceId'>,
  params: Record<string, string | undefined> = {},
) {
  const out: Opportunity[] = [];
  let total = -1;
  for (let page = 1; ; page++) {
    const result = await searchOpportunities(
      env.DB,
      db(),
      world.workspaceId,
      parse({
        sort: 'createdAt',
        dir: 'asc',
        archived: 'include',
        ...params,
        page: String(page),
        pageSize: '50',
      }),
      { now: NOW },
    );
    total = result.total;
    out.push(...result.items);
    if (page >= result.pageCount) break;
  }
  return { items: out, total };
}

async function seedWorld(
  email: string,
  timeZone: string,
  seed: number,
  cards = 240,
): Promise<World> {
  const { api, workspaceId } = await newUser(email);
  await env.DB.prepare('UPDATE workspaces SET timezone = ?1 WHERE id = ?2')
    .bind(timeZone, workspaceId)
    .run();
  const board = await createMinimalBoard(api, 'Parità');
  const labelIds: string[] = [];
  for (const name of ['Alfa', 'Beta', 'Gamma', 'Delta']) {
    const res = await api.post('/labels', { name });
    labelIds.push(res.body.label.id as string);
  }
  const r = rng(seed);
  const statements: D1PreparedStatement[] = [];
  for (let i = 0; i < cards; i++) {
    const id = `${workspaceId.slice(0, 8)}-c${String(i).padStart(4, '0')}`;
    const cluster = r.pick(CLUSTERS);
    const created = r.chance(0.6)
      ? cluster + r.int(72 * 4) * 15 * 60_000
      : Date.parse('2026-01-01T00:00:00Z') + r.int(330 * 24) * 3_600_000;
    const updated = r.chance(0.6)
      ? cluster + r.int(72 * 4) * 15 * 60_000
      : created + r.int(60 * 24) * 3_600_000;
    statements.push(
      env.DB.prepare(
        `INSERT INTO cards (id, workspace_id, board_id, column_id, title, position, priority, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      ).bind(
        id,
        workspaceId,
        board.boardId,
        board.columnIds[r.int(3)],
        `${r.pick(TITLES)} ${r.chance(0.5) ? i : ''}`.trim(),
        (i + 1) * 1024,
        r.pick(PRIORITIES),
        created,
        updated,
      ),
      ...detailAndApplication(id, workspaceId, created, [
        r.chance(0.2) ? null : r.pick(TEXTS),
        r.chance(0.25) ? null : r.pick(TEXTS),
        r.chance(0.3) ? null : r.pick(WORK_MODES),
        r.chance(0.3) ? null : r.pick(CONTRACT_TYPES),
        r.chance(0.35) ? null : r.pick(DAYS),
        r.chance(0.2) ? null : r.pick(STAGES),
        r.chance(0.5) ? null : r.pick(OUTCOMES),
      ]),
      ...(r.chance(0.7)
        ? r
            .some(labelIds, 3)
            .map((label) =>
              env.DB.prepare(
                'INSERT INTO card_labels (card_id, label_id, workspace_id) VALUES (?1, ?2, ?3)',
              ).bind(id, label, workspaceId),
            )
        : []),
    );
  }
  for (let i = 0; i < statements.length; i += 60) await env.DB.batch(statements.slice(i, i + 60));
  const world: World = {
    api,
    workspaceId,
    timeZone,
    context: { today: localDate(NOW, timeZone), timeZone },
    labelIds,
    items: [],
  };
  world.items = (await fetchAll(world)).items;
  return world;
}

// --- generatore di query ----------------------------------------------------------------------

function genDate(r: Rng) {
  if (r.chance(0.5)) {
    return {
      preset: r.pick(['today', 'this_week', 'this_month', 'last_30_days', 'this_year'] as const),
      offset: -r.int(3),
    };
  }
  const [a, b] = [r.pick(DAYS), r.pick(DAYS)].sort();
  return r.chance(0.25)
    ? ({ preset: 'custom', from: a!, to: null } as const)
    : r.chance(0.25)
      ? ({ preset: 'custom', from: null, to: b! } as const)
      : ({ preset: 'custom', from: a!, to: b! } as const);
}

function genCondition(r: Rng, labelIds: string[]): QueryNode {
  const enumeration = (
    field: 'stage' | 'outcome' | 'priority' | 'workMode' | 'contractType',
    vocabulary: readonly string[],
    nullable: boolean,
  ): QueryNode =>
    nullable && r.chance(0.25)
      ? { field, op: r.chance(0.5) ? 'is_empty' : 'is_not_empty' }
      : { field, op: r.chance(0.7) ? 'in' : 'not_in', value: r.some(vocabulary) };
  const text = (field: 'company' | 'location'): QueryNode => {
    const roll = r.next();
    if (roll < 0.15) return { field, op: r.chance(0.5) ? 'is_empty' : 'is_not_empty' };
    if (roll < 0.5)
      return {
        field,
        op: r.chance(0.7) ? 'equals_any' : 'not_equals_any',
        value: [
          ...new Map(r.some(TEXTS, 2).map((t) => [foldKey(t.trim()), t.trim()] as const)).values(),
        ],
      };
    return { field, op: r.chance(0.7) ? 'contains' : 'not_contains', value: r.pick(NEEDLES) };
  };
  switch (r.int(11)) {
    case 0:
      return enumeration('stage', STAGES, true);
    case 1:
      return enumeration('outcome', OUTCOMES, true);
    case 2:
      return enumeration('priority', PRIORITIES, false);
    case 3:
      return enumeration('workMode', WORK_MODES, true);
    case 4:
      return enumeration('contractType', CONTRACT_TYPES, true);
    case 5:
      return text('company');
    case 6:
      return text('location');
    case 7:
      return r.chance(0.2)
        ? { field: 'labelIds', op: r.chance(0.5) ? 'is_empty' : 'is_not_empty' }
        : {
            field: 'labelIds',
            op: r.pick(['has_any', 'has_all', 'has_none'] as const),
            value: r.some([...labelIds, 'fantasma'], 3),
          };
    case 8:
      return {
        field: 'created',
        op: r.chance(0.7) ? 'in_period' : 'not_in_period',
        value: genDate(r),
      };
    case 9:
      return {
        field: 'updated',
        op: r.chance(0.7) ? 'in_period' : 'not_in_period',
        value: genDate(r),
      };
    default:
      return r.chance(0.3)
        ? { field: 'applied', op: r.chance(0.5) ? 'is_empty' : 'is_not_empty' }
        : {
            field: 'applied',
            op: r.chance(0.7) ? 'in_period' : 'not_in_period',
            value: genDate(r),
          };
  }
}

function genNode(r: Rng, labelIds: string[], depth: number): QueryNode {
  if (depth >= 3 || r.chance(0.45)) return genCondition(r, labelIds);
  return {
    op: r.pick(['and', 'or'] as const),
    items: Array.from({ length: 2 + r.int(2) }, () => genNode(r, labelIds, depth + 1)),
  };
}

const ids = (items: readonly { id: string }[]) => items.map((i) => i.id);
/** Serializza anche query volutamente malformate (i test del contratto): per questo `unknown`. */
const whereParam = (query: unknown) => JSON.stringify(query);

/** Dettagli dell'opportunità + (se c'è uno stato) la sua candidatura corrente: stessi valori casuali di prima. */
function detailAndApplication(
  id: string,
  workspaceId: string,
  created: number,
  [company, location, workMode, contractType, appliedOn, stage, outcome]: (string | null)[],
) {
  const statements = [
    env.DB.prepare(
      `INSERT INTO application_details (card_id, workspace_id, company, location, work_mode, contract_type, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)`,
    ).bind(id, workspaceId, company, location, workMode, contractType, created),
  ];
  if (appliedOn !== null || stage !== null || outcome !== null) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO applications (id, workspace_id, opportunity_id, sequence, stage, outcome, applied_on, created_at, updated_at)
         VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6, ?7, ?7)`,
      ).bind(`app-${id}`, workspaceId, id, stage, outcome, appliedOn, created),
    );
  }
  return statements;
}

describe('parità Kanban (memoria) ↔ Tabella (SQL) su D1', () => {
  it.each(CITIES.map((tz, i) => [tz, i] as const))(
    '%s: 150 query casuali, stesse schede',
    async (timeZone, i) => {
      const world = await seedWorld(`parity-${i}@example.com`, timeZone, 1000 + i);
      expect(world.items).toHaveLength(240);
      const r = rng(77 + i);
      let nonTrivial = 0;
      const hits = new Set<string>();
      for (let n = 0; n < 150; n++) {
        const query: SmartQuery = { v: 2, where: genNode(r, world.labelIds, 0) };
        const expected = ids(applyQuery(world.items, query, world.context)).sort();
        const actual = await fetchAll(world, { where: whereParam(query) });
        expect(ids(actual.items).sort(), `${timeZone}\n${JSON.stringify(query)}`).toEqual(expected);
        expect(actual.total).toBe(expected.length);
        if (expected.length > 0 && expected.length < world.items.length) nonTrivial++;
        hits.add(`${expected.length > 0}`);
      }
      // se quasi tutte le query fossero banali (0 o tutte le schede) la parità non proverebbe nulla
      expect(nonTrivial).toBeGreaterThan(60);
    },
    120_000,
  );

  it('ordinamento: ogni chiave e direzione dà lo stesso ordine del comparatore in memoria', async () => {
    const world = await seedWorld('parity-sort@example.com', 'Europe/Rome', 4242, 160);
    for (const field of QUERY_SORT_KEYS) {
      for (const dir of ['asc', 'desc'] as const) {
        const server = await fetchAll(world, { sort: field, dir });
        const client = sortByQuery(world.items, [{ field: field, dir }]);
        expect(ids(server.items), `${field} ${dir}`).toEqual(ids(client));
      }
    }
  }, 120_000);

  it('parametri storici della Tabella: stessi risultati del valutatore sulla loro traduzione v2', async () => {
    const world = await seedWorld('parity-legacy@example.com', 'Europe/Rome', 99, 200);
    const r = rng(5);
    for (let n = 0; n < 60; n++) {
      const some = <T extends string>(values: readonly T[]) =>
        r.chance(0.5) ? r.some([...values, 'none'], 3) : undefined;
      const filters = {
        priority: r.chance(0.4) ? r.some(PRIORITIES, 3) : undefined,
        stage: some(STAGES),
        outcome: some(OUTCOMES),
        workMode: some(WORK_MODES),
        contractType: some(CONTRACT_TYPES),
        labelId: r.chance(0.4) ? r.some(world.labelIds, 2) : undefined,
        appliedFrom: r.chance(0.4) ? r.pick(DAYS) : undefined,
        appliedTo: undefined as string | undefined,
      };
      if (filters.appliedFrom && r.chance(0.5))
        filters.appliedTo = DAYS.filter((d) => d >= filters.appliedFrom!).at(-1);
      const csv = (v: string[] | undefined) => v?.join(',');
      const actual = await fetchAll(world, {
        priority: csv(filters.priority),
        stage: csv(filters.stage),
        outcome: csv(filters.outcome),
        workMode: csv(filters.workMode),
        contractType: csv(filters.contractType),
        labelId: csv(filters.labelId),
        appliedFrom: filters.appliedFrom,
        appliedTo: filters.appliedTo,
      });
      const expected = applyQuery(world.items, legacyFiltersToQuery(filters), world.context);
      expect(ids(actual.items).sort(), JSON.stringify(filters)).toEqual(ids(expected).sort());
    }
  }, 120_000);

  it('`where` e parametri storici si combinano in AND', async () => {
    const world = await seedWorld('parity-and@example.com', 'Europe/Rome', 31, 200);
    const where: SmartQuery = {
      v: 2,
      where: {
        op: 'or',
        items: [
          { field: 'company', op: 'contains', value: 'acme' },
          { field: 'labelIds', op: 'has_any', value: [world.labelIds[0]!] },
        ],
      },
    };
    const combined = await fetchAll(world, {
      where: whereParam(where),
      priority: 'high,urgent',
      stage: 'applied,none',
    });
    const expected = applyQuery(
      world.items,
      {
        v: 2,
        where: {
          op: 'and',
          items: [
            where.where!,
            ...(
              legacyFiltersToQuery({ priority: ['high', 'urgent'], stage: ['applied', 'none'] })
                .where as { items: QueryNode[] }
            ).items,
          ],
        },
      },
      world.context,
    );
    expect(ids(combined.items).sort()).toEqual(ids(expected).sort());
    expect(combined.items.length).toBeGreaterThan(0);
  }, 60_000);
});

describe('casi limite di testo e SQL', () => {
  it('testi speciali sono letterali e la parità regge con accenti, NFD, tab e spazi lunghi', async () => {
    const world = await seedWorld('parity-text@example.com', 'UTC', 8, 200);
    const probes: QueryNode[] = [
      ...TEXTS.map((t): QueryNode => ({ field: 'company', op: 'equals_any', value: [t.trim()] })),
      ...TEXTS.map((t): QueryNode => ({
        field: 'location',
        op: 'contains',
        value: t.trim() || 'x',
      })),
      ...NEEDLES.map((n): QueryNode => ({ field: 'company', op: 'not_contains', value: n })),
    ];
    let matched = 0;
    for (const where of probes) {
      const query: SmartQuery = { v: 2, where };
      const expected = ids(applyQuery(world.items, query, world.context)).sort();
      const actual = await fetchAll(world, { where: whereParam(query) });
      expect(ids(actual.items).sort(), JSON.stringify(where)).toEqual(expected);
      matched += expected.length;
    }
    expect(matched).toBeGreaterThan(500);
    // la tabella è ancora lì dopo i tentativi di iniezione presenti in TEXTS
    expect((await fetchAll(world)).items).toHaveLength(200);
  }, 120_000);

  it('la query più complessa ammessa (30 condizioni, 4 livelli, 64 parametri) gira su D1 e coincide', async () => {
    const world = await seedWorld('parity-max@example.com', 'Europe/Rome', 12, 200);
    const [l1, l2, l3, l4] = world.labelIds as [string, string, string, string];
    const leaf = (n: number): QueryNode[] => [
      { field: 'stage', op: 'in', value: [...STAGES].slice(0, 2 + (n % 3)) },
      { field: 'company', op: 'not_contains', value: `acme${n}` },
      { field: 'workMode', op: 'is_not_empty' },
      {
        field: 'created',
        op: 'in_period',
        value: { preset: 'custom', from: '2026-01-01', to: null },
      },
      { field: 'labelIds', op: 'has_none', value: [l1, l2, l3, l4].slice(0, 1 + (n % 4)) },
      { field: 'priority', op: 'not_in', value: ['urgent'] },
      { field: 'location', op: 'not_equals_any', value: ['Atlantide', 'Narnia'] },
    ];
    const where: QueryNode = {
      op: 'and',
      items: [
        {
          op: 'or',
          items: [
            { op: 'and', items: [{ op: 'or', items: leaf(0).slice(0, 4) }, leaf(1)[5]!] },
            ...leaf(2).slice(0, 2),
          ],
        },
        { op: 'or', items: leaf(3) },
        { op: 'and', items: leaf(4) },
        { op: 'or', items: leaf(5).slice(0, 5) },
        { field: 'labelIds', op: 'has_all', value: [l1, l2] },
      ],
    };
    const query: SmartQuery = { v: 2, where };
    const actual = await fetchAll(world, { where: whereParam(query) });
    expect(ids(actual.items).sort()).toEqual(
      ids(applyQuery(world.items, query, world.context)).sort(),
    );
    const stats = (await import('@jobward/shared')).queryStats(query);
    expect(stats.depth).toBeLessThanOrEqual(SMART_QUERY_LIMITS.maxDepth);
    expect(stats.conditions).toBeLessThanOrEqual(SMART_QUERY_LIMITS.maxConditions);
    expect(stats.bindParams).toBeLessThanOrEqual(SMART_QUERY_LIMITS.maxBindParams);
  }, 60_000);
});

describe('profondità e lunghezza delle espressioni su D1', () => {
  it('30 condizioni di testo annidate su 4 livelli (caso peggiore) restano sotto i limiti di D1', async () => {
    const world = await seedWorld('parity-text-max@example.com', 'Europe/Rome', 14, 120);
    const text = (i: number): QueryNode => ({
      field: i % 2 ? 'company' : 'location',
      op: (['contains', 'not_equals_any', 'not_contains', 'equals_any'] as const)[i % 4]!,
      value: (i % 4) % 2 === 0 ? NEEDLES[i % NEEDLES.length]! : [`valore ${i}`],
    });
    const leaves = Array.from({ length: SMART_QUERY_LIMITS.maxConditions }, (_, i) => text(i));
    const where: QueryNode = {
      op: 'or',
      items: [
        {
          op: 'and',
          items: [
            { op: 'or', items: [{ op: 'and', items: leaves.slice(0, 7) }, ...leaves.slice(7, 11)] },
            ...leaves.slice(11, 14),
          ],
        },
        { op: 'and', items: leaves.slice(14, 22) },
        { op: 'or', items: leaves.slice(22) },
      ],
    };
    const query: SmartQuery = { v: 2, where };
    const actual = await fetchAll(world, { where: whereParam(query) });
    expect(ids(actual.items).sort()).toEqual(
      ids(applyQuery(world.items, query, world.context)).sort(),
    );
    // e un AND piatto di 30 testi: senza bilanciamento l'albero supererebbe 100 livelli
    const flat: SmartQuery = {
      v: 2,
      where: {
        op: 'and',
        items: leaves.map((l, i) => ({ ...l, ...(l.op === 'contains' ? { value: `a${i}` } : {}) })),
      },
    };
    const flatActual = await fetchAll(world, { where: whereParam(flat) });
    expect(ids(flatActual.items).sort()).toEqual(
      ids(applyQuery(world.items, flat, world.context)).sort(),
    );
  }, 60_000);
});

describe('isolamento tra workspace', () => {
  it('nessuna query v2 restituisce, conta o rivela schede o etichette di un altro workspace', async () => {
    const a = await seedWorld('iso-a@example.com', 'Europe/Rome', 1, 120);
    const b = await seedWorld('iso-b@example.com', 'Europe/Rome', 1, 120); // stessi dati, altro workspace
    const aIds = new Set(ids(a.items));
    const bIds = new Set(ids(b.items));
    expect(a.items).toHaveLength(120);
    expect(b.items).toHaveLength(120);
    const r = rng(3);
    for (let n = 0; n < 40; n++) {
      const where = genNode(r, a.labelIds, 0);
      const out = await fetchAll(a, { where: whereParam({ v: 2, where }) });
      for (const item of out.items) expect(bIds.has(item.id)).toBe(false);
      expect(ids(out.items).every((id) => aIds.has(id))).toBe(true);
    }
    // le etichette di B non esistono per A: has_any non trova nulla, has_none non esclude nulla
    expect(
      (
        await fetchAll(a, {
          where: whereParam({
            v: 2,
            where: { field: 'labelIds', op: 'has_any', value: b.labelIds },
          }),
        })
      ).total,
    ).toBe(0);
    expect(
      (
        await fetchAll(a, {
          where: whereParam({
            v: 2,
            where: { field: 'labelIds', op: 'has_none', value: b.labelIds },
          }),
        })
      ).total,
    ).toBe(120);
    expect(
      (
        await fetchAll(a, {
          where: whereParam({
            v: 2,
            where: { field: 'labelIds', op: 'has_all', value: b.labelIds },
          }),
        })
      ).total,
    ).toBe(0);
  }, 120_000);
});

describe('contratto HTTP di `where`', () => {
  const get = (api: Api, where: string) =>
    api.get(`/opportunities?where=${encodeURIComponent(where)}`);

  it('una query valida risponde 200 e filtra; le invalide rispondono 400 con il percorso', async () => {
    const world = await seedWorld('http-where@example.com', 'Europe/Rome', 21, 60);
    const ok = await get(
      world.api,
      whereParam({ v: 2, where: { field: 'priority', op: 'in', value: ['high'] } }),
    );
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.total).toBe(world.items.filter((i) => i.priority === 'high').length);

    const cases: [string, string][] = [
      ['non json', '{rotto'],
      ['campo ignoto', whereParam({ v: 2, where: { field: 'password', op: 'in', value: ['x'] } })],
      [
        'operatore non ammesso',
        whereParam({ v: 2, where: { field: 'company', op: 'in', value: ['x'] } }),
      ],
      [
        'fuori vocabolario',
        whereParam({ v: 2, where: { field: 'stage', op: 'in', value: ['bogus'] } }),
      ],
      ['versione 1', whereParam({ v: 1 })],
      ['gruppo vuoto', whereParam({ v: 2, where: { op: 'and', items: [] } })],
      ['troppo lunga', 'x'.repeat(4097)],
    ];
    for (const [name, where] of cases) {
      const res = await get(world.api, where);
      expect(res.status, name).toBe(400);
      expect(
        res.body.error.issues.some((d: { path: string }) => d.path.startsWith('where')),
        name,
      ).toBe(true);
    }
  });

  it('limiti di complessità: oltre il tetto è 400, mai un errore del database', async () => {
    const world = await seedWorld('http-limits@example.com', 'Europe/Rome', 22, 20);
    const many = Array.from({ length: SMART_QUERY_LIMITS.maxConditions + 1 }, (_, i) => ({
      field: 'labelIds',
      op: 'has_any',
      value: [`l${i}`],
    }));
    expect(
      (await get(world.api, whereParam({ v: 2, where: { op: 'and', items: many } }))).status,
    ).toBe(400);
    // combinata con i parametri storici supera i parametri legati ammessi → 400 chiaro
    const wide = {
      field: 'labelIds',
      op: 'has_any',
      value: Array.from({ length: 20 }, (_, i) => `a${i}`),
    };
    const legacyLabels = Array.from({ length: 20 }, (_, i) => `b${i}`).join(',');
    const heavy = {
      op: 'and',
      items: [
        wide,
        { ...wide, op: 'has_none', value: Array.from({ length: 20 }, (_, i) => `c${i}`) },
        { ...wide, op: 'has_all', value: Array.from({ length: 20 }, (_, i) => `d${i}`) },
      ],
    };
    const res = await world.api.get(
      `/opportunities?labelId=${legacyLabels}&where=${encodeURIComponent(whereParam({ v: 2, where: heavy }))}`,
    );
    expect(res.status, JSON.stringify(res.body)).toBe(400);
  });

  it('la ricerca globale non accetta `where`: nessun filtro avanzato fuori da /opportunities', async () => {
    const world = await seedWorld('http-global@example.com', 'UTC', 24, 10);
    const where = encodeURIComponent(
      whereParam({ v: 2, where: { field: 'priority', op: 'in', value: ['urgent'] } }),
    );
    expect((await world.api.get(`/search?q=alfa&where=${where}`)).status).toBe(400);
    expect((await world.api.get('/search?q=alfa')).status).toBe(200);
  });

  it('un parametro `where` ripetuto è un errore; senza `where` nulla cambia', async () => {
    const world = await seedWorld('http-repeat@example.com', 'UTC', 23, 20);
    const one = encodeURIComponent(whereParam({ v: 2 }));
    expect((await world.api.get(`/opportunities?where=${one}&where=${one}`)).status).toBe(400);
    expect((await world.api.get('/opportunities')).body.total).toBe(20);
    expect((await get(world.api, whereParam({ v: 2 }))).body.total).toBe(20);
  });
});
