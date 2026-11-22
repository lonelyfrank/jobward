import { describe, expect, it } from 'vitest';
import {
  applySmartFilter,
  companyOptions,
  compileSmartFilter,
  normalizeSmartFilter,
  normalizeText,
  NONE,
  resolveDateFilter,
  type CardPredicate,
  type DateFilter,
  type FilterableCard,
  type SmartFilterConfig,
  type SmartFilterContext,
} from './smart-filter';
import { CONTRACT_TYPES, PRIORITIES, STAGES, WORK_MODES } from './constants';
import { localDate } from './tasks';
import { foldKey } from './text-fold';

/**
 * Compatibilità con SW.1: il valutatore `v:1` ora delega al motore v2. Qui si confronta, su
 * migliaia di casi pseudo-casuali ma riproducibili, con la COPIA FEDELE dell'implementazione
 * originale (commit 8d127dd), usata come oracolo.
 */

function referenceCompile(config: SmartFilterConfig, context: SmartFilterContext): CardPredicate {
  const c = normalizeSmartFilter(config);
  const tests: CardPredicate[] = [];
  const inRange = (day: string, range: { from: string | null; to: string | null }) =>
    (range.from === null || day >= range.from) && (range.to === null || day <= range.to);
  const dateTest = (
    key: 'created' | 'applied' | 'updated',
    read: (card: FilterableCard) => string | null,
  ) => {
    const filter = c[key];
    if (!filter) return;
    const range = resolveDateFilter(filter, context.today);
    tests.push((card) => {
      const day = read(card);
      return day !== null && inRange(day, range);
    });
  };
  const day = (ms: number) => localDate(ms, context.timeZone);
  dateTest('created', (card) => day(card.createdAt));
  dateTest('updated', (card) => day(card.updatedAt));
  dateTest('applied', (card) => card.appliedOn);
  const oneOf = (
    selected: readonly string[] | undefined,
    read: (card: FilterableCard) => string | null,
  ) => {
    if (!selected) return;
    const set = new Set(selected);
    tests.push((card) => set.has(read(card) ?? NONE));
  };
  oneOf(c.stage, (card) => card.stage);
  oneOf(c.priority, (card) => card.priority);
  oneOf(c.workMode, (card) => card.workMode);
  oneOf(c.contractType, (card) => card.contractType);
  if (c.company) {
    const keys = new Set(c.company.map(normalizeText));
    tests.push((card) => card.company !== null && keys.has(normalizeText(card.company)));
  }
  if (c.labelIds) {
    const ids = new Set(c.labelIds);
    tests.push((card) => card.labelIds.some((id) => ids.has(id)));
  }
  if (c.location) {
    const needle = normalizeText(c.location);
    tests.push((card) => card.location !== null && normalizeText(card.location).includes(needle));
  }
  return (card) => tests.every((test) => test(card));
}

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
  const some = <T>(values: readonly T[], max = 3): T[] => {
    const n = 1 + Math.floor(next() * max);
    return Array.from({ length: n }, () => pick(values));
  };
  return { next, pick, some, chance: (p: number) => next() < p };
}

const TEXTS = [
  'Acme',
  'ACME',
  'acme',
  'Acme Group',
  'Café Rossi',
  'cafe rossi',
  'CAFÉ  ROSSI',
  'Città di Perù',
  'Èlite',
  'Zeta',
  'Milano, Lombardia',
  'Roma',
  'lombardìa',
  "O'Neil",
  '100% remoto',
  'a_b',
  '  Spazio  doppio ',
];
const LABELS = ['l1', 'l2', 'l3', 'l4', 'ghost'];
const ZONES = [
  'UTC',
  'Europe/Rome',
  'America/New_York',
  'Pacific/Kiritimati',
  'Australia/Lord_Howe',
  'Asia/Kolkata',
];
const DAYS = [
  '2025-12-31',
  '2026-01-01',
  '2026-03-29',
  '2026-03-30',
  '2026-10-25',
  '2026-11-08',
  '2026-11-09',
  '2026-11-10',
  '2026-12-31',
  '2027-01-01',
];
const HOUR = 3_600_000;

function randomCard(r: ReturnType<typeof rng>): FilterableCard {
  const base = Date.parse('2026-01-01T00:00:00Z');
  return {
    createdAt:
      base + Math.floor(r.next() * 365 * 24) * HOUR + Math.floor(r.next() * 4) * 15 * 60_000,
    updatedAt: base + Math.floor(r.next() * 365 * 24) * HOUR,
    appliedOn: r.chance(0.35) ? null : r.pick(DAYS),
    stage: r.chance(0.2) ? null : r.pick(STAGES),
    company: r.chance(0.2) ? null : r.pick(TEXTS),
    priority: r.pick(PRIORITIES),
    workMode: r.chance(0.3) ? null : r.pick(WORK_MODES),
    contractType: r.chance(0.3) ? null : r.pick(CONTRACT_TYPES),
    labelIds: r.chance(0.3) ? [] : [...new Set(r.some(LABELS, 3))],
    location: r.chance(0.25) ? null : r.pick(TEXTS),
  };
}

function randomDateFilter(r: ReturnType<typeof rng>): DateFilter {
  if (r.chance(0.5)) {
    return {
      preset: r.pick(['today', 'this_week', 'this_month', 'last_30_days', 'this_year'] as const),
      offset: -Math.floor(r.next() * 3),
    };
  }
  const a = r.pick(DAYS);
  const b = r.pick(DAYS);
  const [from, to] = a <= b ? [a, b] : [b, a];
  return r.chance(0.3)
    ? { preset: 'custom', from, to: null }
    : r.chance(0.3)
      ? { preset: 'custom', from: null, to }
      : { preset: 'custom', from, to };
}

function randomConfig(r: ReturnType<typeof rng>): SmartFilterConfig {
  const config: SmartFilterConfig = { v: 1 };
  if (r.chance(0.3)) config.created = randomDateFilter(r);
  if (r.chance(0.3)) config.updated = randomDateFilter(r);
  if (r.chance(0.3)) config.applied = randomDateFilter(r);
  if (r.chance(0.4)) config.stage = r.some([...STAGES, NONE]);
  if (r.chance(0.3)) config.company = r.some(TEXTS, 2);
  if (r.chance(0.3)) config.priority = r.some(PRIORITIES);
  if (r.chance(0.3)) config.workMode = r.some([...WORK_MODES, NONE]);
  if (r.chance(0.3)) config.contractType = r.some([...CONTRACT_TYPES, NONE]);
  if (r.chance(0.3)) config.labelIds = r.some(LABELS);
  if (r.chance(0.3))
    config.location = r.pick([
      'milano',
      'ROMA',
      'lombardia',
      'perù',
      'rossi',
      '%',
      'a_b',
      'xyz',
      ' spazio ',
    ]);
  return config;
}

describe('SW.1 ↔ motore v2: stessi risultati dell’implementazione originale', () => {
  it('1.000 configurazioni × 100 schede, in 6 fusi orari', () => {
    const r = rng(20261110);
    let compared = 0;
    let nonTrivial = 0;
    for (let i = 0; i < 1000; i++) {
      const config = randomConfig(r);
      const timeZone = r.pick(ZONES);
      const context: SmartFilterContext = { today: r.pick(DAYS), timeZone };
      const cards = Array.from({ length: 100 }, () => randomCard(r));
      const expected = cards.filter(referenceCompile(config, context));
      const actual = applySmartFilter(cards, config, context);
      expect(actual, JSON.stringify({ config, context })).toEqual(expected);
      compared += cards.length;
      if (expected.length > 0 && expected.length < cards.length) nonTrivial++;
    }
    expect(compared).toBe(100_000);
    // il test serve solo se i casi non sono tutti «niente» o «tutto»
    expect(nonTrivial).toBeGreaterThan(200);
  });

  it('compileSmartFilter e applySmartFilter coincidono', () => {
    const r = rng(7);
    const config: SmartFilterConfig = { v: 1, stage: ['applied', NONE], location: 'roma' };
    const context = { today: '2026-11-09', timeZone: 'Europe/Rome' };
    const cards = Array.from({ length: 200 }, () => randomCard(r));
    expect(cards.filter(compileSmartFilter(config, context))).toEqual(
      applySmartFilter(cards, config, context),
    );
  });
});

describe('differenze volute rispetto a SW.1 (documentate)', () => {
  const card = (over: Partial<FilterableCard>): FilterableCard => ({
    createdAt: 0,
    updatedAt: 0,
    appliedOn: null,
    stage: null,
    company: null,
    priority: 'none',
    workMode: null,
    contractType: null,
    labelIds: [],
    location: null,
    ...over,
  });
  const ctx = { today: '2026-11-09', timeZone: 'UTC' };

  it('lettere accentate fuori dalla tabella condivisa non si equivalgono più (serve la parità con SQL)', () => {
    const skoda = card({ company: 'Škoda' });
    expect(referenceCompile({ v: 1, company: ['skoda'] }, ctx)(skoda)).toBe(true); // SW.1: NFD completo
    expect(compileSmartFilter({ v: 1, company: ['skoda'] }, ctx)(skoda)).toBe(false); // v2: tabella fissa
    expect(compileSmartFilter({ v: 1, company: ['škoda'] }, ctx)(card({ company: 'Škoda' }))).toBe(
      false,
    );
  });

  it('solo lo spazio U+0020 si riduce; tabulazioni e spazi non separabili restano', () => {
    const tab = card({ location: 'Roma\tNord' });
    expect(referenceCompile({ v: 1, location: 'roma nord' }, ctx)(tab)).toBe(true);
    expect(compileSmartFilter({ v: 1, location: 'roma nord' }, ctx)(tab)).toBe(false);
  });
});

/**
 * Caratterizzazione della normalizzazione dei testi (SW.1 `normalizeText` ↔ SW.3 `foldKey`).
 * Le classi sono quelle di docs/architecture/smart-query-engine.md §3: se cambiano, cambia il
 * documento. NON è equivalenza Unicode completa: è un compromesso tecnico locale e temporaneo.
 */
describe('normalizzazione dei testi: classi di caratteri (SW.1 ↔ SW.3)', () => {
  const same = (c: string) => normalizeText(c) === foldKey(c);

  it('allineate: accenti e maiuscole delle lingue d’uso principale (it, fr, es, pt, de)', () => {
    for (const c of 'àèéìòùÀÈÉÌÒÙáíóúâêîôûäëïöüçñÇÑÁÍÓÚÂÊÎÔÛÄËÏÖÜßãõÃÕåÅ')
      expect(same(c), c).toBe(true);
    expect(same('Cafe\u0301')).toBe(true); // accento combinante (U+0301) nella tabella
  });

  it.each([
    [
      '1 latine accentate fuori tabella',
      'Šš Žž Čč Ćć Ńń Śś Źź Żż Ąą Ęę Ěě Řř Ůů Őő Űű Ğğ Şş Ăă Șș Țț Ýý Ÿÿ',
    ],
    ['2 latine senza scomposizione: divergono le sole MAIUSCOLE', 'Æ Ø Þ Đ Ł Œ Ð'],
    ['3a greco/cirillico accentati', 'άΆ йЙ ёЁ'],
    ['3b maiuscole di greco/cirillico/armeno/georgiano', 'ΑΛΦΑ ДОМ ԱԲԳ'],
    ['5 segni combinanti fuori tabella', '\u0304\u0306\u0307\u030b\u030c\u0328'],
    ['5b equivalenza canonica NFD (Hangul)', '한'],
    ['6 spazi diversi da U+0020', '\t\u00a0\u2003'],
  ])('divergenti da SW.1 — %s', (_name, sample) => {
    const chars = [...sample].filter((c) => c !== ' ');
    const differing = chars.filter((c) => !same(c));
    expect(differing.length, `${_name}: ${chars.join('')}`).toBe(chars.length);
  });

  it('classe 2: le minuscole corrispondenti sono identiche (cambia solo l’insensibilità alle maiuscole)', () => {
    for (const c of 'æøþđłœð') expect(same(c), c).toBe(true);
    expect(foldKey('Łódź')).not.toBe(foldKey('łódź'));
  });

  it('il confronto resta coerente: stesse stringhe → stessa chiave, qualunque sia la classe', () => {
    for (const text of ['Škoda', 'ΑΛΦΑ', '한', 'Roma\tNord', 'Łódź'])
      expect(foldKey(text)).toBe(foldKey(text));
  });
});

describe('companyOptions e filtro per azienda sono coerenti', () => {
  const ctx = { today: '2026-11-09', timeZone: 'UTC' };
  const card = (company: string): FilterableCard => ({
    createdAt: 0,
    updatedAt: 0,
    appliedOn: null,
    stage: null,
    company,
    priority: 'none',
    workMode: null,
    contractType: null,
    labelIds: [],
    location: null,
  });

  it('ogni voce proposta seleziona esattamente le schede che rappresenta', () => {
    const cards = [
      'Škoda',
      'SKODA',
      'skoda',
      'Acme',
      'ACME',
      'Café Rossi',
      'cafe rossi',
      'Łódź',
      'łódź',
    ].map(card);
    const options = companyOptions(cards);
    // «Škoda» (fuori tabella) non si unisce a «skoda»: sono voci diverse, ciascuna selezionabile
    expect(options.length).toBe(6);
    for (const option of options) {
      const selected = applySmartFilter(cards, { v: 1, company: [option] }, ctx);
      const sameKey = cards.filter((c) => foldKey(c.company!) === foldKey(option));
      expect(selected).toEqual(sameKey);
      expect(selected.length).toBeGreaterThan(0);
    }
  });
});
