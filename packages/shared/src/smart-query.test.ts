import { describe, expect, it } from 'vitest';
import { localDate } from './tasks';
import {
  allowedOperators,
  andQueries,
  applyQuery,
  compareByQuerySort,
  compileQuery,
  conditionBindCount,
  dateFilterToInstants,
  EMPTY_SMART_QUERY,
  normalizeSmartQuery,
  queryLimitIssues,
  queryNeedsClock,
  queryStats,
  QUERY_FIELD_NAMES,
  SMART_QUERY_LIMITS,
  smartQueryKey,
  SmartQueryError,
  sortByQuery,
  validateSmartQuery,
  type QueryableItem,
  type QueryCondition,
  type QueryContext,
  type QueryGroup,
  type QueryNode,
  type SmartQuery,
} from './smart-query';
import { legacyFiltersToQuery } from './smart-query-legacy';
import { smartFilterToQuery } from './smart-filter';
import { foldKey } from './text-fold';

const ROME: QueryContext = { today: '2026-11-09', timeZone: 'Europe/Rome' };
const at = (iso: string) => Date.parse(iso);

const make = (over: Partial<QueryableItem> = {}): QueryableItem => ({
  createdAt: at('2026-11-02T10:00:00Z'),
  updatedAt: at('2026-11-05T10:00:00Z'),
  appliedOn: null,
  stage: null,
  outcome: null,
  company: null,
  priority: 'none',
  workMode: null,
  contractType: null,
  labelIds: [],
  location: null,
  ...over,
});

const c = (
  field: QueryCondition['field'],
  op: QueryCondition['op'],
  value?: QueryCondition['value'],
): QueryCondition => (value === undefined ? { field, op } : { field, op, value });
const and = (...items: QueryNode[]): QueryGroup => ({ op: 'and', items });
const or = (...items: QueryNode[]): QueryGroup => ({ op: 'or', items });
const query = (where?: QueryNode): SmartQuery => ({ v: 2, ...(where ? { where } : {}) });
const run = (where: QueryNode | undefined, items: QueryableItem[], context = ROME) =>
  applyQuery(items, query(where), context);

describe('operatori per tipo di campo', () => {
  it('ogni campo ammette solo gli operatori del proprio tipo', () => {
    expect(allowedOperators('priority')).toEqual(['in', 'not_in']); // non nullable: niente is_empty
    expect(allowedOperators('stage')).toContain('is_empty');
    expect(allowedOperators('company')).toContain('contains');
    expect(allowedOperators('company')).not.toContain('in');
    expect(allowedOperators('labelIds')).toContain('has_all');
    expect(allowedOperators('created')).toEqual(['in_period', 'not_in_period']);
    expect(allowedOperators('applied')).toContain('is_empty');
    for (const field of QUERY_FIELD_NAMES)
      expect(allowedOperators(field).length).toBeGreaterThan(0);
  });

  it('enum: in / not_in / is_empty / is_not_empty', () => {
    const applied = make({ stage: 'applied' });
    const saved = make({ stage: 'saved' });
    const none = make({ stage: null });
    const all = [applied, saved, none];
    expect(run(c('stage', 'in', ['applied']), all)).toEqual([applied]);
    expect(run(c('stage', 'in', ['applied', 'saved']), all)).toEqual([applied, saved]);
    expect(run(c('stage', 'not_in', ['applied']), all)).toEqual([saved, none]);
    expect(run(c('stage', 'is_empty'), all)).toEqual([none]);
    expect(run(c('stage', 'is_not_empty'), all)).toEqual([applied, saved]);
  });

  it('testo: uguaglianza di chiave intera, sottostringa, negazioni e vuoto', () => {
    const cafe = make({ company: 'Café Rossi' });
    const group = make({ company: 'cafe rossi group' });
    const blank = make({ company: '   ' });
    const none = make({ company: null });
    const all = [cafe, group, blank, none];
    expect(run(c('company', 'equals_any', ['CAFE ROSSI']), all)).toEqual([cafe]);
    expect(run(c('company', 'contains', 'rossi'), all)).toEqual([cafe, group]);
    expect(run(c('company', 'not_equals_any', ['cafe rossi']), all)).toEqual([group, blank, none]);
    expect(run(c('company', 'not_contains', 'rossi'), all)).toEqual([blank, none]);
    expect(run(c('company', 'is_empty'), all)).toEqual([blank, none]);
    expect(run(c('company', 'is_not_empty'), all)).toEqual([cafe, group]);
  });

  it('etichette: any / all / none / vuote', () => {
    const both = make({ labelIds: ['a', 'b'] });
    const onlyA = make({ labelIds: ['a'] });
    const empty = make({ labelIds: [] });
    const all = [both, onlyA, empty];
    expect(run(c('labelIds', 'has_any', ['b', 'x']), all)).toEqual([both]);
    expect(run(c('labelIds', 'has_all', ['a', 'b']), all)).toEqual([both]);
    expect(run(c('labelIds', 'has_none', ['b']), all)).toEqual([onlyA, empty]);
    expect(run(c('labelIds', 'is_empty'), all)).toEqual([empty]);
    expect(run(c('labelIds', 'is_not_empty'), all)).toEqual([both, onlyA]);
  });

  it('un’etichetta sconosciuta non corrisponde a nessuna scheda ma has_none è vero', () => {
    const a = make({ labelIds: ['a'] });
    expect(run(c('labelIds', 'has_any', ['ghost']), [a])).toEqual([]);
    expect(run(c('labelIds', 'has_all', ['a', 'ghost']), [a])).toEqual([]);
    expect(run(c('labelIds', 'has_none', ['ghost']), [a])).toEqual([a]);
  });
});

describe('campi mancanti e valori sconosciuti (regole esplicite)', () => {
  const missing = make(); // tutto nullo
  it.each([
    ['stage', 'in', ['applied'], false],
    ['stage', 'not_in', ['applied'], true],
    ['stage', 'is_empty', undefined, true],
    ['stage', 'is_not_empty', undefined, false],
    ['company', 'equals_any', ['acme'], false],
    ['company', 'not_equals_any', ['acme'], true],
    ['company', 'contains', 'acme', false],
    ['company', 'not_contains', 'acme', true],
    ['company', 'is_empty', undefined, true],
    ['location', 'contains', 'roma', false],
    ['applied', 'in_period', { preset: 'custom', from: '2026-01-01', to: null }, false],
    ['applied', 'not_in_period', { preset: 'custom', from: '2026-01-01', to: null }, true],
    ['applied', 'is_empty', undefined, true],
    ['labelIds', 'has_any', ['a'], false],
    ['labelIds', 'has_none', ['a'], true],
  ] as const)('scheda senza dati: %s %s → %s', (field, op, value, expected) => {
    expect(run(c(field, op, value as QueryCondition['value']), [missing]).length === 1).toBe(
      expected,
    );
  });

  it('la negazione vale anche dentro AND/OR, senza dipendere dalla logica a tre valori', () => {
    expect(
      run(and(c('stage', 'not_in', ['applied']), c('company', 'not_contains', 'x')), [missing]),
    ).toEqual([missing]);
    expect(
      run(or(c('stage', 'in', ['applied']), c('company', 'not_contains', 'x')), [missing]),
    ).toEqual([missing]);
    expect(
      run(or(c('stage', 'in', ['applied']), c('company', 'contains', 'x')), [missing]),
    ).toEqual([]);
  });

  it('un valore sconosciuto nei dati è un valore come gli altri', () => {
    const legacy = make({ stage: 'archived_v9', appliedOn: 'domani' });
    expect(run(c('stage', 'in', ['applied']), [legacy])).toEqual([]);
    expect(run(c('stage', 'not_in', ['applied']), [legacy])).toEqual([legacy]);
    expect(run(c('stage', 'is_not_empty'), [legacy])).toEqual([legacy]);
    // una data di calendario non valida vale come mancante per i filtri di periodo
    const any = { preset: 'custom', from: '2000-01-01', to: null } as const;
    expect(run(c('applied', 'in_period', any), [legacy])).toEqual([]);
    expect(run(c('applied', 'not_in_period', any), [legacy])).toEqual([legacy]);
    expect(run(c('applied', 'is_not_empty'), [legacy])).toEqual([legacy]);
  });
});

describe('AND / OR e condizioni annidate', () => {
  const a = c('priority', 'in', ['high']);
  const b = c('workMode', 'in', ['remote']);
  const d = c('stage', 'in', ['applied']);
  // tutte le combinazioni di tre proprietà booleane
  const items = Array.from({ length: 8 }, (_, i) =>
    make({
      priority: i & 1 ? 'high' : 'low',
      workMode: i & 2 ? 'remote' : 'onsite',
      stage: i & 4 ? 'applied' : 'saved',
    }),
  );
  const truth = (i: number) => ({ a: !!(i & 1), b: !!(i & 2), d: !!(i & 4) });
  const idx = (result: readonly QueryableItem[]) => result.map((r) => items.indexOf(r));

  it('and, or e la loro combinazione seguono la tavola di verità', () => {
    const cases: [QueryNode, (t: ReturnType<typeof truth>) => boolean][] = [
      [and(a, b, d), (t) => t.a && t.b && t.d],
      [or(a, b, d), (t) => t.a || t.b || t.d],
      [and(a, or(b, d)), (t) => t.a && (t.b || t.d)],
      [or(a, and(b, d)), (t) => t.a || (t.b && t.d)],
      [and(or(a, b), or(b, d)), (t) => (t.a || t.b) && (t.b || t.d)],
      [or(and(a, b), and(b, d), and(a, d)), (t) => (t.a && t.b) || (t.b && t.d) || (t.a && t.d)],
    ];
    for (const [node, expected] of cases) {
      expect(idx(run(node, items))).toEqual(
        items.map((_, i) => i).filter((i) => expected(truth(i))),
      );
    }
  });

  it('quattro livelli di annidamento (il massimo) valutano correttamente', () => {
    const node = and(
      or(and(or(a, b), d), c('priority', 'in', ['low'])),
      c('stage', 'is_not_empty'),
    );
    expect(queryStats(query(node)).depth).toBe(4);
    const expected = items
      .map((_, i) => i)
      .filter((i) => {
        const t = truth(i);
        return ((t.a || t.b) && t.d) || !t.a;
      });
    expect(idx(run(node, items))).toEqual(expected);
  });

  it('senza filtri restituisce lo stesso array', () => {
    expect(applyQuery(items, EMPTY_SMART_QUERY, ROME)).toBe(items);
    expect(applyQuery(items, query(and(or())), ROME)).toBe(items); // gruppi vuoti: nessun vincolo
  });
});

describe('date e fusi orari', () => {
  const inDay = (day: string) => ({ preset: 'custom', from: day, to: day }) as const;

  it('created: giorno locale del workspace, non UTC', () => {
    // 2026-11-08T23:30Z = 2026-11-09 00:30 a Roma (UTC+1)
    const lateUtc = make({ createdAt: at('2026-11-08T23:30:00Z') });
    expect(run(c('created', 'in_period', inDay('2026-11-09')), [lateUtc])).toEqual([lateUtc]);
    expect(
      run(c('created', 'in_period', inDay('2026-11-09')), [lateUtc], { ...ROME, timeZone: 'UTC' }),
    ).toEqual([]);
    expect(run(c('created', 'in_period', inDay('2026-11-08')), [lateUtc])).toEqual([]);
    expect(run(c('created', 'not_in_period', inDay('2026-11-08')), [lateUtc])).toEqual([lateUtc]);
  });

  it('i confini sono inizio incluso e fine esclusa (nessuna scheda persa o doppia a mezzanotte)', () => {
    const start = dateFilterToInstants(inDay('2026-11-09'), ROME);
    expect(start).toEqual({ from: at('2026-11-08T23:00:00Z'), to: at('2026-11-09T23:00:00Z') });
    const justBefore = make({ createdAt: start.from! - 1 });
    const first = make({ createdAt: start.from! });
    const last = make({ createdAt: start.to! - 1 });
    const after = make({ createdAt: start.to! });
    const items = [justBefore, first, last, after];
    expect(run(c('created', 'in_period', inDay('2026-11-09')), items)).toEqual([first, last]);
    expect(run(c('created', 'not_in_period', inDay('2026-11-09')), items)).toEqual([
      justBefore,
      after,
    ]);
  });

  it('periodi relativi seguono «oggi» passato dal chiamante', () => {
    const monday = make({ updatedAt: at('2026-11-09T09:00:00Z') });
    const lastWeek = make({ updatedAt: at('2026-11-03T09:00:00Z') });
    const week = { preset: 'this_week', offset: 0 } as const;
    expect(run(c('updated', 'in_period', week), [monday, lastWeek])).toEqual([monday]);
    expect(run(c('updated', 'in_period', { ...week, offset: -1 }), [monday, lastWeek])).toEqual([
      lastWeek,
    ]);
    expect(
      run(c('updated', 'in_period', week), [monday, lastWeek], {
        today: '2026-11-04',
        timeZone: 'Europe/Rome',
      }),
    ).toEqual([lastWeek]);
  });

  it('applied è un giorno di calendario, indipendente dal fuso', () => {
    const item = make({ appliedOn: '2026-11-09' });
    for (const timeZone of ['UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
      expect(
        run(c('applied', 'in_period', inDay('2026-11-09')), [item], {
          today: ROME.today,
          timeZone,
        }),
      ).toEqual([item]);
    }
  });

  // I confini in istanti devono coincidere con `localDate` istante per istante, anche con ora legale.
  const ZONES = [
    'UTC',
    'Europe/Rome',
    'America/New_York',
    'America/Sao_Paulo',
    'Asia/Kolkata',
    'Australia/Lord_Howe',
    'Pacific/Kiritimati',
    'Pacific/Pago_Pago',
    'Pacific/Apia',
    'Africa/Casablanca',
  ];
  it.each(ZONES)('%s: istanti e giorni locali coincidono attorno ai cambi d’ora', (timeZone) => {
    const days = [
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-11-01',
      '2026-11-02',
    ];
    for (const day of days) {
      const range = dateFilterToInstants(inDay(day), { today: '2026-11-09', timeZone });
      const from = range.from!;
      const to = range.to!;
      // campione ogni 15 minuti, da 30 ore prima a 30 ore dopo il giorno
      for (let t = from - 30 * 3_600_000; t <= to + 30 * 3_600_000; t += 15 * 60_000) {
        const inside = t >= from && t < to;
        expect(inside, `${timeZone} ${day} ${new Date(t).toISOString()}`).toBe(
          localDate(t, timeZone) === day,
        );
      }
    }
  });

  it('il giorno locale dura 23, 24 o 25 ore secondo l’ora legale', () => {
    const hours = (day: string) => {
      const r = dateFilterToInstants(inDay(day), ROME);
      return (r.to! - r.from!) / 3_600_000;
    };
    expect(hours('2026-03-29')).toBe(23);
    expect(hours('2026-10-25')).toBe(25);
    expect(hours('2026-11-09')).toBe(24);
  });

  it('intervalli aperti da un lato e confini del calendario non lanciano', () => {
    const open = dateFilterToInstants({ preset: 'custom', from: '2026-01-01', to: null }, ROME);
    expect(open.to).toBeNull();
    expect(
      dateFilterToInstants({ preset: 'custom', from: null, to: '9999-12-31' }, ROME).to,
    ).toBeNull();
  });

  it('queryNeedsClock: solo istanti e periodi relativi leggono l’orologio', () => {
    expect(
      queryNeedsClock(
        query(c('applied', 'in_period', { preset: 'custom', from: '2026-01-01', to: null })),
      ),
    ).toBe(false);
    expect(queryNeedsClock(query(c('applied', 'in_period', { preset: 'today', offset: 0 })))).toBe(
      true,
    );
    expect(
      queryNeedsClock(
        query(c('created', 'in_period', { preset: 'custom', from: '2026-01-01', to: null })),
      ),
    ).toBe(true);
    expect(queryNeedsClock(query(c('stage', 'in', ['applied'])))).toBe(false);
    expect(queryNeedsClock(EMPTY_SMART_QUERY)).toBe(false);
  });
});

describe('testi', () => {
  it('foldKey: accenti latini, minuscole ASCII, spazi', () => {
    expect(foldKey('  Città   di  Perù ')).toBe('citta di peru');
    expect(foldKey('CAFÉ')).toBe('cafe');
    expect(foldKey('Café')).toBe('cafe'); // accento combinante
    expect(foldKey(' '.repeat(40) + 'a' + ' '.repeat(40))).toBe('a');
    expect(foldKey('a' + ' '.repeat(32) + 'b')).toBe('a b'); // 5 passate coprono fino a 32 spazi…
    expect(foldKey('a' + ' '.repeat(33) + 'b')).toBe('a  b'); // …oltre restano due (identico lato SQL)
  });

  it('limiti dichiarati: lettere fuori tabella e maiuscole non ASCII non si equivalgono', () => {
    // Differenza voluta rispetto a SW.1 (Unicode completo): il compilatore SQL non può farlo.
    expect(foldKey('Škoda')).not.toBe('skoda');
    expect(foldKey('ΑΛΦΑ')).toBe('ΑΛΦΑ');
  });

  it('i caratteri speciali sono letterali (nessun jolly)', () => {
    const percent = make({ location: '100% remoto' });
    const other = make({ location: 'Roma' });
    expect(run(c('location', 'contains', '%'), [percent, other])).toEqual([percent]);
    expect(run(c('location', 'contains', '_'), [percent, other])).toEqual([]);
    expect(run(c('location', 'contains', "'; DROP TABLE cards;--"), [percent, other])).toEqual([]);
  });
});

describe('normalizzazione', () => {
  const messy: SmartQuery = {
    v: 2,
    where: and(
      or(c('stage', 'in', ['saved', 'applied', 'applied']), c('stage', 'in', ['applied', 'saved'])),
      and(c('company', 'equals_any', ['ACME', 'acme', ' Acme ']), c('priority', 'in', ['high'])),
      c('labelIds', 'has_any', ['b', 'a', 'b']),
      or(or(c('workMode', 'in', ['remote']))),
      and(),
    ),
  };

  it('è deterministica: ordine, duplicati e gruppi superflui non contano', () => {
    const n = normalizeSmartQuery(messy);
    expect(n).toEqual({
      v: 2,
      where: {
        op: 'and',
        items: expect.arrayContaining([
          c(
            'stage',
            'in',
            ['preparing', 'saved', 'applied'].filter((s) => ['saved', 'applied'].includes(s)),
          ),
          c('labelIds', 'has_any', ['a', 'b']),
          c('workMode', 'in', ['remote']),
          c('company', 'equals_any', ['ACME']),
          c('priority', 'in', ['high']),
        ]),
      },
    });
    expect((n.where as QueryGroup).items).toHaveLength(5);
  });

  it('è idempotente e due query equivalenti hanno la stessa serializzazione', () => {
    const once = normalizeSmartQuery(messy);
    expect(normalizeSmartQuery(once)).toEqual(once);
    expect(JSON.stringify(normalizeSmartQuery(once))).toBe(JSON.stringify(once));
    const shuffled: SmartQuery = {
      v: 2,
      where: and(...(messy.where as QueryGroup).items.slice().reverse()),
    };
    expect(JSON.stringify(normalizeSmartQuery(shuffled))).toBe(JSON.stringify(once));
  });

  it('appiattisce i gruppi dello stesso tipo e scarta quelli con un solo elemento', () => {
    expect(
      normalizeSmartQuery(
        query(
          and(and(c('stage', 'is_empty'), c('priority', 'in', ['low'])), c('workMode', 'is_empty')),
        ),
      ),
    ).toEqual(
      normalizeSmartQuery(
        query(and(c('workMode', 'is_empty'), c('stage', 'is_empty'), c('priority', 'in', ['low']))),
      ),
    );
    expect(normalizeSmartQuery(query(or(and(or(c('stage', 'is_empty'))))))).toEqual(
      query(c('stage', 'is_empty')),
    );
    // OR dentro AND non si appiattisce (cambierebbe significato)
    const mixed = normalizeSmartQuery(
      query(
        and(or(c('stage', 'is_empty'), c('workMode', 'is_empty')), c('priority', 'in', ['low'])),
      ),
    );
    expect((mixed.where as QueryGroup).items.some((i) => 'items' in i)).toBe(true);
  });

  it('toglie ciò che non è valido, senza lanciare', () => {
    const dirty = {
      v: 2,
      where: and(
        { field: 'nonEsiste', op: 'in', value: ['x'] } as never,
        c('priority', 'is_empty'), // non nullable
        c('stage', 'in', ['bogus']),
        c('stage', 'in', ['applied', 'bogus']),
        c('created', 'in_period', { preset: 'custom', from: '2026-02-30', to: null }),
        c('company', 'contains', '   '),
        'testo' as never,
        null as never,
      ),
    } as SmartQuery;
    expect(normalizeSmartQuery(dirty)).toEqual(query(c('stage', 'in', ['applied'])));
  });

  it('smartQueryKey: stessa identità per testi equivalenti, diversa per significati diversi', () => {
    const k = (v: QueryNode) => smartQueryKey(query(v));
    expect(k(c('company', 'equals_any', ['Café']))).toBe(k(c('company', 'equals_any', ['CAFE'])));
    expect(k(c('location', 'contains', 'Roma'))).toBe(k(c('location', 'contains', ' roma ')));
    expect(k(c('stage', 'in', ['applied']))).not.toBe(k(c('stage', 'not_in', ['applied'])));
    expect(k(or(c('stage', 'is_empty'), c('workMode', 'is_empty')))).not.toBe(
      k(and(c('stage', 'is_empty'), c('workMode', 'is_empty'))),
    );
  });

  it('andQueries combina in AND e mantiene il primo ordinamento', () => {
    const a: SmartQuery = {
      v: 2,
      where: c('priority', 'in', ['high']),
      sort: [{ field: 'title', dir: 'asc' }],
    };
    const b: SmartQuery = {
      v: 2,
      where: c('stage', 'in', ['applied']),
      sort: [{ field: 'company', dir: 'desc' }],
    };
    const merged = andQueries(a, b);
    expect(merged.sort).toEqual([{ field: 'title', dir: 'asc' }]);
    expect((merged.where as QueryGroup).items).toHaveLength(2);
    expect(andQueries(EMPTY_SMART_QUERY, EMPTY_SMART_QUERY)).toEqual(EMPTY_SMART_QUERY);
  });

  it('l’ordinamento: duplicati e chiavi sconosciute sono tolti, al massimo 3', () => {
    const n = normalizeSmartQuery({
      v: 2,
      sort: [
        { field: 'title', dir: 'asc' },
        { field: 'title', dir: 'desc' },
        { field: 'nope' as never, dir: 'asc' },
        { field: 'company', dir: 'sideways' as never },
        { field: 'stage', dir: 'asc' },
        { field: 'priority', dir: 'desc' },
        { field: 'location', dir: 'asc' },
      ],
    });
    expect(n.sort).toEqual([
      { field: 'title', dir: 'asc' },
      { field: 'stage', dir: 'asc' },
      { field: 'priority', dir: 'desc' },
    ]);
  });
});

describe('validazione stretta di input non fidato', () => {
  const bad = (input: unknown) => {
    const r = validateSmartQuery(input);
    expect(r.ok, JSON.stringify(input)).toBe(false);
    return r.ok ? [] : r.issues;
  };

  it('accetta una query valida e restituisce la forma canonica', () => {
    const r = validateSmartQuery({
      v: 2,
      where: {
        op: 'and',
        items: [
          { field: 'stage', op: 'in', value: ['saved', 'applied'] },
          { field: 'company', op: 'contains', value: ' acme ' },
        ],
      },
      sort: [{ field: 'updatedAt', dir: 'desc' }],
    });
    expect(r.ok).toBe(true);
    expect(r.ok && r.query).toEqual({
      v: 2,
      where: { op: 'and', items: expect.any(Array) },
      sort: [{ field: 'updatedAt', dir: 'desc' }],
    });
    expect(validateSmartQuery({ v: 2 })).toEqual({ ok: true, query: { v: 2 } });
  });

  it.each([
    ['null', null],
    ['array', []],
    ['stringa', 'x'],
    ['numero', 3],
    ['versione errata', { v: 1 }],
    ['versione assente', {}],
    ['chiave extra', { v: 2, evil: true }],
    ['where non oggetto', { v: 2, where: 'x' }],
    ['where nullo', { v: 2, where: null }],
    ['campo sconosciuto', { v: 2, where: c('nope' as never, 'in', ['a']) }],
    ['campo prototipo', { v: 2, where: { field: '__proto__', op: 'in', value: ['a'] } }],
    ['campo constructor', { v: 2, where: { field: 'constructor', op: 'in', value: ['a'] } }],
    ['campo toString', { v: 2, where: { field: 'toString', op: 'is_empty' } }],
    ['operatore sconosciuto', { v: 2, where: c('stage', 'like' as never, ['a']) }],
    ['operatore di un altro tipo', { v: 2, where: c('company', 'in', ['a']) }],
    ['is_empty su campo non nullable', { v: 2, where: c('priority', 'is_empty') }],
    ['is_empty con valore', { v: 2, where: c('stage', 'is_empty', ['x']) }],
    ['valore mancante', { v: 2, where: { field: 'stage', op: 'in' } }],
    ['valore di tipo sbagliato', { v: 2, where: { field: 'stage', op: 'in', value: 'applied' } }],
    ['elenco con numeri', { v: 2, where: { field: 'stage', op: 'in', value: [1] } }],
    ['elenco vuoto', { v: 2, where: c('stage', 'in', []) }],
    ['fuori vocabolario', { v: 2, where: c('stage', 'in', ['bogus']) }],
    ['duplicati', { v: 2, where: c('stage', 'in', ['applied', 'applied']) }],
    ['testi duplicati per chiave', { v: 2, where: c('company', 'equals_any', ['ACME', 'acme']) }],
    ['testo vuoto', { v: 2, where: c('company', 'contains', '  ') }],
    ['testo troppo lungo', { v: 2, where: c('company', 'contains', 'x'.repeat(121)) }],
    ['testo che si riduce a vuoto', { v: 2, where: c('company', 'contains', '́') }],
    ['etichetta malformata', { v: 2, where: c('labelIds', 'has_any', ['a b']) }],
    [
      'troppe etichette',
      {
        v: 2,
        where: c(
          'labelIds',
          'has_any',
          Array.from({ length: 21 }, (_, i) => `l${i}`),
        ),
      },
    ],
    ['gruppo vuoto', { v: 2, where: { op: 'and', items: [] } }],
    ['gruppo senza items', { v: 2, where: { op: 'and', items: 'x' } }],
    ['operatore di gruppo errato', { v: 2, where: { op: 'xor', items: [c('stage', 'is_empty')] } }],
    [
      'chiave extra nel gruppo',
      { v: 2, where: { op: 'and', items: [c('stage', 'is_empty')], not: true } },
    ],
    [
      'chiave extra nella condizione',
      { v: 2, where: { field: 'stage', op: 'is_empty', sql: '1=1' } },
    ],
    [
      'periodo non valido',
      { v: 2, where: c('created', 'in_period', { preset: 'decade' } as never) },
    ],
    ['periodo futuro', { v: 2, where: c('created', 'in_period', { preset: 'today', offset: 1 }) }],
    [
      'offset oltre il limite',
      { v: 2, where: c('created', 'in_period', { preset: 'today', offset: -1201 }) },
    ],
    [
      'intervallo invertito',
      {
        v: 2,
        where: c('applied', 'in_period', {
          preset: 'custom',
          from: '2026-02-01',
          to: '2026-01-01',
        }),
      },
    ],
    [
      'data inesistente',
      {
        v: 2,
        where: c('applied', 'in_period', { preset: 'custom', from: '2026-02-30', to: null }),
      },
    ],
    [
      'intervallo senza estremi',
      { v: 2, where: c('applied', 'in_period', { preset: 'custom', from: null, to: null }) },
    ],
    [
      'periodo con chiavi extra',
      { v: 2, where: c('created', 'in_period', { preset: 'today', offset: 0, x: 1 } as never) },
    ],
    ['sort non array', { v: 2, sort: 'title' }],
    ['sort chiave sconosciuta', { v: 2, sort: [{ field: 'password', dir: 'asc' }] }],
    ['sort direzione errata', { v: 2, sort: [{ field: 'title', dir: 'up' }] }],
    [
      'sort duplicato',
      {
        v: 2,
        sort: [
          { field: 'title', dir: 'asc' },
          { field: 'title', dir: 'desc' },
        ],
      },
    ],
    [
      'troppi sort',
      {
        v: 2,
        sort: ['title', 'company', 'stage', 'priority'].map((field) => ({ field, dir: 'asc' })),
      },
    ],
    ['sort con chiavi extra', { v: 2, sort: [{ field: 'title', dir: 'asc', nulls: 'first' }] }],
  ])('rifiuta: %s', (_name, input) => {
    expect(bad(input).length).toBeGreaterThan(0);
  });

  it('i percorsi degli errori indicano il punto esatto', () => {
    const issues = bad({
      v: 2,
      where: and(c('stage', 'is_empty'), or(c('workMode', 'in', ['bogus']))),
    });
    expect(issues.map((i) => i.path)).toContain('where.items.1.items.0');
  });

  it('i limiti di profondità, di condizioni e di parametri sono errori espliciti', () => {
    let deep: QueryNode = c('stage', 'is_empty');
    for (let i = 0; i < SMART_QUERY_LIMITS.maxDepth; i++)
      deep = i % 2 ? and(deep, c('workMode', 'is_empty')) : or(deep, c('workMode', 'is_empty'));
    expect(validateSmartQuery({ v: 2, where: deep }).ok).toBe(true); // 4 livelli: ammesso
    expect(
      bad({ v: 2, where: and(deep, c('priority', 'in', ['low'])) }).some((i) =>
        /annidati/.test(i.message),
      ),
    ).toBe(true);

    const many = (n: number) =>
      and(...Array.from({ length: n }, (_, i) => c('labelIds', 'has_any', [`l${i}`])));
    expect(validateSmartQuery({ v: 2, where: many(SMART_QUERY_LIMITS.maxConditions) }).ok).toBe(
      true,
    );
    expect(bad({ v: 2, where: many(SMART_QUERY_LIMITS.maxConditions + 1) }).length).toBeGreaterThan(
      0,
    );

    const params = and(
      c(
        'labelIds',
        'has_any',
        Array.from({ length: 20 }, (_, i) => `a${i}`),
      ),
      c(
        'labelIds',
        'has_none',
        Array.from({ length: 20 }, (_, i) => `b${i}`),
      ),
      c(
        'labelIds',
        'has_all',
        Array.from({ length: 20 }, (_, i) => `c${i}`),
      ),
      c(
        'labelIds',
        'has_any',
        Array.from({ length: 20 }, (_, i) => `d${i}`),
      ),
    );
    expect(bad({ v: 2, where: params }).some((i) => /valori complessivi/.test(i.message))).toBe(
      true,
    );
  });

  it('un input enorme o ostile non fa lavoro sproporzionato né lancia', () => {
    const wide = {
      op: 'or',
      items: Array.from({ length: 30 }, () => ({
        op: 'and',
        items: Array.from({ length: 30 }, () => c('stage', 'is_empty')),
      })),
    };
    const started = Date.now();
    expect(validateSmartQuery({ v: 2, where: wide }).ok).toBe(false);
    // profondità patologica (10.000 livelli): il controllo si ferma al quinto
    let hostile: unknown = c('stage', 'is_empty');
    for (let i = 0; i < 10_000; i++) hostile = { op: 'and', items: [hostile] };
    expect(validateSmartQuery({ v: 2, where: hostile }).ok).toBe(false);
    expect(Date.now() - started).toBeLessThan(500);
    const cyclic: Record<string, unknown> = { op: 'and' };
    cyclic['items'] = [cyclic];
    expect(validateSmartQuery({ v: 2, where: cyclic }).ok).toBe(false);
  });
});

describe('limiti nel compilatore in memoria', () => {
  it('una query tipizzata oltre i limiti lancia SmartQueryError con i motivi', () => {
    const tooMany: SmartQuery = {
      v: 2,
      where: and(...Array.from({ length: 31 }, (_, i) => c('labelIds', 'has_any', [`l${i}`]))),
    };
    expect(queryLimitIssues(tooMany).length).toBeGreaterThan(0);
    expect(() => compileQuery(tooMany, ROME)).toThrow(SmartQueryError);
  });

  it('conditionBindCount e queryStats contano i parametri che il compilatore SQL userà', () => {
    expect(conditionBindCount(c('labelIds', 'has_all', ['a', 'b']))).toBe(3);
    expect(conditionBindCount(c('stage', 'is_empty'))).toBe(0);
    expect(
      queryStats(
        query(
          and(
            c('stage', 'in', ['saved', 'applied']),
            or(
              c('company', 'contains', 'x'),
              c('created', 'in_period', { preset: 'today', offset: 0 }),
            ),
          ),
        ),
      ),
    ).toEqual({
      depth: 2,
      conditions: 3,
      bindParams: 2 + 1 + 2,
    });
  });
});

describe('conversioni dai formati precedenti', () => {
  it('v:1 → v2: `none` diventa is_empty, la priorità «none» resta un valore', () => {
    const q = smartFilterToQuery({
      v: 1,
      stage: ['applied', 'none'],
      priority: ['none'],
      workMode: ['none'],
      company: ['ACME'],
      labelIds: ['a'],
      location: 'roma',
      created: { preset: 'this_week', offset: 0 },
    });
    const items = (q.where as QueryGroup).items;
    expect(items).toContainEqual(c('priority', 'in', ['none']));
    expect(items).toContainEqual(c('workMode', 'is_empty'));
    expect(items).toContainEqual(or(c('stage', 'in', ['applied']), c('stage', 'is_empty')));
    expect(smartFilterToQuery({ v: 1 })).toEqual(EMPTY_SMART_QUERY);
  });

  it('parametri storici della Tabella → v2 (stesso significato del contratto M2.3)', () => {
    const q = legacyFiltersToQuery({
      priority: ['high'],
      stage: ['none', 'applied'],
      outcome: ['none'],
      labelId: ['l1', 'l2'],
      appliedFrom: '2026-01-01',
    });
    const items = (q.where as QueryGroup).items;
    expect(items).toContainEqual(c('priority', 'in', ['high']));
    expect(items).toContainEqual(c('outcome', 'is_empty'));
    expect(items).toContainEqual(
      c('applied', 'in_period', { preset: 'custom', from: '2026-01-01', to: null }),
    );
    expect(legacyFiltersToQuery({})).toEqual(EMPTY_SMART_QUERY);
    expect(queryLimitIssues(worstCaseLegacy())).toEqual([]);
  });

  function worstCaseLegacy(): SmartQuery {
    return legacyFiltersToQuery({
      priority: ['none', 'low', 'medium', 'high', 'urgent'],
      stage: [
        'saved',
        'preparing',
        'applied',
        'in_contact',
        'interviewing',
        'offer',
        'closed',
        'none',
      ],
      outcome: [
        'pending',
        'accepted',
        'rejected',
        'withdrawn',
        'no_response',
        'offer_declined',
        'none',
      ],
      workMode: ['onsite', 'hybrid', 'remote', 'none'],
      contractType: [
        'permanent',
        'fixed_term',
        'part_time',
        'freelance',
        'internship',
        'apprenticeship',
        'temporary',
        'other',
        'none',
      ],
      labelId: Array.from({ length: 20 }, (_, i) => `l${i}`),
      appliedFrom: '2026-01-01',
      appliedTo: '2026-12-31',
    });
  }
});

describe('ordinamento (stessa semantica di ORDER BY)', () => {
  const row = (id: string, over: Partial<QueryableItem>) => make({ id, ...over });

  it('mancanti sempre in fondo, in entrambe le direzioni', () => {
    const items = [
      row('a', { company: null }),
      row('b', { company: 'Zeta' }),
      row('c', { company: 'acme' }),
    ];
    expect(sortByQuery(items, [{ field: 'company', dir: 'asc' }]).map((i) => i.id)).toEqual([
      'c',
      'b',
      'a',
    ]);
    expect(sortByQuery(items, [{ field: 'company', dir: 'desc' }]).map((i) => i.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
  });

  it('testo senza distinzione ASCII, per punto di codice; il resto di Unicode non si ripiega', () => {
    const items = [
      row('1', { title: 'Éclair' }),
      row('2', { title: 'zebra' }),
      row('3', { title: 'Alfa' }),
      row('4', { title: 'beta' }),
    ];
    expect(sortByQuery(items, [{ field: 'title', dir: 'asc' }]).map((i) => i.title)).toEqual([
      'Alfa',
      'beta',
      'zebra',
      'Éclair',
    ]);
    // fuori dal piano base: i surrogati precedono U+FF21 nell'ordine UTF-8 (come in SQLite)
    const astral = [row('1', { title: 'Ａ' }), row('2', { title: '\u{1F600}' })];
    expect(sortByQuery(astral, [{ field: 'title', dir: 'asc' }]).map((i) => i.id)).toEqual([
      '1',
      '2',
    ]);
  });

  it('i vocabolari ordinano per rango, non per testo; i valori sconosciuti vanno in fondo', () => {
    const items = [
      row('a', { priority: 'urgent' }),
      row('b', { priority: 'low' }),
      row('c', { priority: 'boh' }),
      row('d', { priority: 'none' }),
    ];
    expect(sortByQuery(items, [{ field: 'priority', dir: 'asc' }]).map((i) => i.id)).toEqual([
      'd',
      'b',
      'a',
      'c',
    ]);
    expect(sortByQuery(items, [{ field: 'priority', dir: 'desc' }]).map((i) => i.id)).toEqual([
      'a',
      'b',
      'd',
      'c',
    ]);
  });

  it('più chiavi e spareggio per id', () => {
    const items = [
      row('b', { stage: 'applied', createdAt: 5 }),
      row('a', { stage: 'applied', createdAt: 5 }),
      row('c', { stage: 'saved', createdAt: 9 }),
      row('d', { stage: 'applied', createdAt: 7 }),
    ];
    expect(
      sortByQuery(items, [
        { field: 'stage', dir: 'asc' },
        { field: 'createdAt', dir: 'desc' },
      ]).map((i) => i.id),
    ).toEqual(['c', 'd', 'a', 'b']); // saved prima di applied (rango); poi createdAt decrescente; poi id
    expect(compareByQuerySort([])(items[0]!, items[1]!)).toBeGreaterThan(0); // solo id
  });

  it('non modifica l’ingresso', () => {
    const items = [row('b', {}), row('a', {})];
    const copy = [...items];
    sortByQuery(items, [{ field: 'title', dir: 'asc' }]);
    expect(items).toEqual(copy);
  });
});

describe('purezza e prestazioni', () => {
  it('non modifica query né schede', () => {
    const items = [make({ stage: 'applied', labelIds: ['a'] }), make()];
    const q = query(and(c('stage', 'in', ['applied']), c('labelIds', 'has_any', ['a'])));
    const before = JSON.stringify([items, q]);
    applyQuery(items, q, ROME);
    expect(JSON.stringify([items, q])).toBe(before);
  });

  it('20.000 schede con una query complessa in tempi brevi', () => {
    const many = Array.from({ length: 20_000 }, (_, i) =>
      make({
        createdAt: at('2026-01-01T00:00:00Z') + i * 3_600_000,
        priority: i % 2 ? 'high' : 'low',
        company: `Azienda ${i % 40}`,
        location: i % 5 ? `Città ${i % 7}` : null,
        stage: i % 3 ? 'applied' : null,
        labelIds: i % 3 ? ['l1', `l${i % 9}`] : [],
      }),
    );
    const q = query(
      and(
        c('created', 'in_period', { preset: 'this_year', offset: 0 }),
        or(
          and(
            c('priority', 'in', ['high']),
            c('company', 'equals_any', ['Azienda 1', 'Azienda 3']),
          ),
          and(c('location', 'contains', 'citta 3'), c('labelIds', 'has_any', ['l1'])),
          c('stage', 'is_empty'),
        ),
        c('labelIds', 'has_none', ['l8']),
      ),
    );
    const started = Date.now();
    const result = applyQuery(many, q, ROME);
    const ms = Date.now() - started;
    expect(result.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(1000);
  });
});
