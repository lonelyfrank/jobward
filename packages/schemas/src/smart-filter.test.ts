import { describe, expect, it } from 'vitest';
import { parseSmartFilter, smartFilterConfig } from './smart-filter';

describe('smartFilterConfig (v1)', () => {
  it('accetta una configurazione completa e applica i valori predefiniti', () => {
    const parsed = smartFilterConfig.parse({
      v: 1,
      created: { preset: 'this_week' },
      applied: { preset: 'custom', from: '2026-01-01' },
      updated: { preset: 'last_30_days', offset: -2 },
      stage: ['applied', 'none'],
      company: ['Acme', 'Beta'],
      priority: ['high'],
      workMode: ['remote', 'none'],
      contractType: ['permanent'],
      labelIds: ['l1', 'l2'],
      location: 'Milano',
    });
    expect(parsed.created).toEqual({ preset: 'this_week', offset: 0 });
    expect(parsed.applied).toEqual({ preset: 'custom', from: '2026-01-01', to: null });
    expect(parsed.updated).toEqual({ preset: 'last_30_days', offset: -2 });
  });

  it('accetta la configurazione vuota di versione 1', () => {
    expect(parseSmartFilter({ v: 1 })).toEqual({ v: 1 });
  });

  it('richiede la versione e rifiuta versioni sconosciute o campi in più', () => {
    expect(parseSmartFilter({})).toBeNull();
    expect(parseSmartFilter({ v: 2 })).toBeNull();
    expect(parseSmartFilter({ v: 1, salary: 10 })).toBeNull();
    expect(parseSmartFilter({ v: 1, created: { preset: 'today', extra: true } })).toBeNull();
  });

  it('rifiuta valori fuori vocabolario, duplicati e liste vuote', () => {
    expect(parseSmartFilter({ v: 1, stage: ['inventata'] })).toBeNull();
    expect(parseSmartFilter({ v: 1, priority: ['high', 'high'] })).toBeNull();
    expect(parseSmartFilter({ v: 1, company: [] })).toBeNull();
    expect(parseSmartFilter({ v: 1, company: ['  '] })).toBeNull();
    expect(parseSmartFilter({ v: 1, workMode: ['ufficio'] })).toBeNull();
    expect(parseSmartFilter({ v: 1, location: '' })).toBeNull();
  });

  it('rifiuta periodi incoerenti', () => {
    expect(parseSmartFilter({ v: 1, created: { preset: 'today', offset: 1 } })).toBeNull();
    expect(parseSmartFilter({ v: 1, created: { preset: 'today', offset: -1.5 } })).toBeNull();
    expect(parseSmartFilter({ v: 1, created: { preset: 'ieri' } })).toBeNull();
    expect(parseSmartFilter({ v: 1, created: { preset: 'custom' } })).toBeNull();
    expect(
      parseSmartFilter({
        v: 1,
        created: { preset: 'custom', from: '2026-03-02', to: '2026-03-01' },
      }),
    ).toBeNull();
    expect(
      parseSmartFilter({ v: 1, created: { preset: 'custom', from: '2026-02-30' } }),
    ).toBeNull();
  });

  it('parseSmartFilter non lancia mai, qualunque sia l’input', () => {
    for (const input of [null, undefined, 3, 'x', [], { v: '1' }]) {
      expect(parseSmartFilter(input)).toBeNull();
    }
  });
});
