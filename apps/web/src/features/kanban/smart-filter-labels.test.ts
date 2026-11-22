import { describe, expect, it } from 'vitest';
import { countText, dateFilterText, filterChips, formatRange } from './smart-filter-labels';

describe('testi dei filtri', () => {
  it('formatta gli intervalli di date', () => {
    expect(formatRange({ from: '2026-11-09', to: '2026-11-15' })).toMatch(
      /9 nov 2026 – 15 nov 2026/,
    );
    expect(formatRange({ from: '2026-11-09', to: '2026-11-09' })).toBe('9 nov 2026');
    expect(formatRange({ from: '2026-11-09', to: null })).toBe('dal 9 nov 2026');
    expect(formatRange({ from: null, to: '2026-11-09' })).toBe('fino al 9 nov 2026');
  });

  it('il periodo corrente ha un nome, gli altri mostrano i giorni', () => {
    expect(dateFilterText({ preset: 'this_week', offset: 0 }, '2026-11-11')).toBe(
      'Questa settimana',
    );
    expect(dateFilterText({ preset: 'this_week', offset: -1 }, '2026-11-11')).toMatch(
      /2 nov 2026 – 8 nov 2026/,
    );
    expect(dateFilterText({ preset: 'custom', from: '2026-01-01', to: '2026-01-31' }, 'x')).toMatch(
      /1 gen 2026 – 31 gen 2026/,
    );
  });

  it('un contrassegno per campo attivo, con il testo dei valori', () => {
    const chips = filterChips(
      {
        v: 1,
        created: { preset: 'today', offset: 0 },
        stage: ['applied', 'none'],
        company: ['Acme', 'Beta'],
        priority: ['none', 'high'],
        labelIds: ['l1', 'zz'],
        location: 'Roma',
      },
      { today: '2026-11-09', labelName: (id) => (id === 'l1' ? 'Frontend' : '…') },
    );
    expect(chips.map((c) => c.key)).toEqual([
      'created',
      'stage',
      'company',
      'priority',
      'labelIds',
      'location',
    ]);
    expect(chips[0]?.date?.key).toBe('created');
    expect(chips[1]?.text).toBe('Fase: Inviata, non indicata');
    expect(chips[2]?.text).toBe('Azienda: Acme, Beta');
    expect(chips[3]?.text).toBe('Priorità: nessuna, Alta');
    expect(chips[4]?.text).toBe('Etichette: Frontend, …');
    expect(chips[5]?.text).toBe('Località: “Roma”');
  });

  it('contatore con singolare/plurale', () => {
    expect(countText(3, 12, true)).toBe('3 di 12 schede');
    expect(countText(1, 1, true)).toBe('1 di 1 scheda');
    expect(countText(5, 5, false)).toBe('5 schede');
  });
});
