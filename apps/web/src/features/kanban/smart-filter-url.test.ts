import { EMPTY_SMART_FILTER, type SmartFilterConfig } from '@jobward/shared';
import { describe, expect, it } from 'vitest';
import {
  hasNonCanonicalFilterParams,
  parseDateFilter,
  readSmartFilter,
  serializeDateFilter,
  writeSmartFilter,
} from './smart-filter-url';

const read = (qs: string) => readSmartFilter(new URLSearchParams(qs));
const write = (config: SmartFilterConfig, base = '') =>
  writeSmartFilter(new URLSearchParams(base), config).toString();

describe('filtri data nell’indirizzo', () => {
  it('serializza e rilegge ogni preset, con e senza spostamento', () => {
    for (const filter of [
      { preset: 'today', offset: 0 },
      { preset: 'this_week', offset: 0 },
      { preset: 'this_week', offset: -3 },
      { preset: 'this_month', offset: -1 },
      { preset: 'last_30_days', offset: 0 },
      { preset: 'this_year', offset: -2 },
      { preset: 'custom', from: '2026-01-01', to: '2026-02-01' },
      { preset: 'custom', from: '2026-01-01', to: null },
      { preset: 'custom', from: null, to: '2026-02-01' },
    ] as const) {
      expect(parseDateFilter(serializeDateFilter(filter)), serializeDateFilter(filter)).toEqual(
        filter,
      );
    }
    expect(serializeDateFilter({ preset: 'this_week', offset: -2 })).toBe('week-2');
    expect(serializeDateFilter({ preset: 'custom', from: '2026-01-01', to: null })).toBe(
      '2026-01-01..',
    );
  });

  it('scarta valori non validi', () => {
    for (const bad of [
      '',
      'ieri',
      'week-',
      'week-x',
      'week--1',
      'week-99999',
      'WEEK',
      '2026-01-01',
      '..',
      '2026-02-30..',
      '2026-03-02..2026-03-01',
      '2026-01-01..2026-01-02..2026-01-03',
      '<script>',
    ]) {
      expect(parseDateFilter(bad), bad).toBeNull();
    }
  });

  it('week-0 equivale a week', () => {
    expect(parseDateFilter('week-0')).toEqual({ preset: 'this_week', offset: 0 });
  });
});

describe('lettura dei filtri dall’indirizzo', () => {
  it('senza parametri: nessun filtro', () => {
    expect(read('')).toEqual(EMPTY_SMART_FILTER);
    expect(read('foo=bar')).toEqual(EMPTY_SMART_FILTER);
  });

  it('legge tutti i campi', () => {
    expect(
      read(
        'creata=today&inviata=2026-01-01..2026-01-31&aggiornata=30d-1&fase=applied,none&azienda=Acme&azienda=Beta%2C%20Inc&priorita=high,urgent&modalita=remote&contratto=permanent,none&etichetta=l1,l2&localita=Milano',
      ),
    ).toEqual({
      v: 1,
      created: { preset: 'today', offset: 0 },
      applied: { preset: 'custom', from: '2026-01-01', to: '2026-01-31' },
      updated: { preset: 'last_30_days', offset: -1 },
      stage: ['applied', 'none'],
      company: ['Acme', 'Beta, Inc'],
      priority: ['high', 'urgent'],
      workMode: ['remote'],
      contractType: ['permanent', 'none'],
      labelIds: ['l1', 'l2'],
      location: 'Milano',
    });
  });

  it('ripristino sicuro: scarta solo ciò che non è valido e tiene il resto', () => {
    expect(
      read(
        'creata=ieri&fase=applied,inventata&priorita=high,high&modalita=ufficio&contratto=x&etichetta=ok,bad%20id,<b>&azienda=%20%20&localita=%20%20',
      ),
    ).toEqual({ v: 1, stage: ['applied'], priority: ['high'], labelIds: ['ok'] });
  });

  it('non lancia con input ostili e rispetta i limiti di lunghezza', () => {
    const long = 'x'.repeat(5000);
    const result = read(`localita=${long}&azienda=${long}&fase=${'a,'.repeat(5000)}`);
    expect(result.location?.length).toBe(120);
    expect(result.company?.[0]?.length).toBe(120);
    expect(result.stage).toBeUndefined();
    expect(() => read('creata=%E0%A4%A&localita=%')).not.toThrow();
    expect(read('__proto__=1&constructor=2')).toEqual(EMPTY_SMART_FILTER);
  });

  it('limita il numero di aziende e di etichette', () => {
    const many = Array.from({ length: 80 }, (_, i) => `azienda=C${i}`).join('&');
    expect(read(many).company).toHaveLength(30);
    const labels = Array.from({ length: 60 }, (_, i) => `l${i}`).join(',');
    expect(read(`etichetta=${labels}`).labelIds).toHaveLength(20);
  });
});

describe('scrittura dei filtri', () => {
  it('è l’inverso della lettura (round-trip)', () => {
    const config: SmartFilterConfig = {
      v: 1,
      created: { preset: 'this_month', offset: -1 },
      applied: { preset: 'custom', from: null, to: '2026-05-01' },
      stage: ['offer', 'none'],
      company: ['Acme, Inc', 'Beta'],
      priority: ['high'],
      workMode: ['hybrid'],
      contractType: ['freelance'],
      labelIds: ['l1'],
      location: 'Roma Nord',
    };
    expect(read(write(config))).toEqual(config);
  });

  it('omette i filtri vuoti e preserva i parametri estranei', () => {
    expect(write(EMPTY_SMART_FILTER)).toBe('');
    expect(write({ v: 1, priority: [] }, 'tab=x')).toBe('tab=x');
    expect(write({ v: 1, priority: ['high'] }, 'tab=x&fase=applied')).toBe('tab=x&priorita=high');
  });

  it('riconosce indirizzi da riscrivere', () => {
    expect(hasNonCanonicalFilterParams(new URLSearchParams(''))).toBe(false);
    expect(hasNonCanonicalFilterParams(new URLSearchParams('fase=applied&other=1'))).toBe(false);
    expect(hasNonCanonicalFilterParams(new URLSearchParams('fase=inventata'))).toBe(true);
    expect(hasNonCanonicalFilterParams(new URLSearchParams('creata=ieri'))).toBe(true);
    expect(hasNonCanonicalFilterParams(new URLSearchParams('priorita=high,high'))).toBe(true);
    expect(hasNonCanonicalFilterParams(new URLSearchParams('creata=week-0'))).toBe(true);
  });
});
