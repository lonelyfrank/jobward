import type { Company } from '@jobward/schemas';
import { describe, expect, it } from 'vitest';
import { filterAndSortCompanies, paginate, parseCompanySort } from './list';

const company = (id: string, name: string, createdAt: number): Company => ({
  id,
  name,
  website: null,
  notes: null,
  opportunities: 1,
  applications: 0,
  activeApplications: 0,
  lastActivityAt: null,
  createdAt,
  updatedAt: createdAt,
});

const all = [
  company('a', 'Zeta Software', 3),
  company('b', 'Àlfa Consulting', 1),
  company('c', 'beta labs', 2),
  company('d', 'Alfa Retail', 4),
];
const names = (list: Company[]) => list.map((c) => c.name);

describe('elenco delle aziende', () => {
  it('ordina per nome (A→Z, Z→A) e per data di inserimento', () => {
    expect(names(filterAndSortCompanies(all, '', 'az'))).toEqual([
      'Àlfa Consulting',
      'Alfa Retail',
      'beta labs',
      'Zeta Software',
    ]);
    expect(names(filterAndSortCompanies(all, '', 'za'))[0]).toBe('Zeta Software');
    expect(names(filterAndSortCompanies(all, '', 'recent'))).toEqual([
      'Alfa Retail',
      'Zeta Software',
      'beta labs',
      'Àlfa Consulting',
    ]);
    expect(names(filterAndSortCompanies(all, '', 'oldest'))[0]).toBe('Àlfa Consulting');
  });

  it('filtra per nome senza maiuscole né accenti; ogni parola deve comparire', () => {
    expect(names(filterAndSortCompanies(all, 'ALFA', 'az'))).toEqual([
      'Àlfa Consulting',
      'Alfa Retail',
    ]);
    expect(names(filterAndSortCompanies(all, 'alfa ret', 'az'))).toEqual(['Alfa Retail']);
    expect(filterAndSortCompanies(all, 'nessuna', 'az')).toEqual([]);
  });

  it('ordinamento sconosciuto → A→Z; pagine sempre nell’intervallo valido', () => {
    expect(parseCompanySort('boh')).toBe('az');
    expect(parseCompanySort('recent')).toBe('recent');
    const items = Array.from({ length: 25 }, (_, i) => i);
    expect(paginate(items, 1, 12)).toMatchObject({ page: 1, pageCount: 3 });
    expect(paginate(items, 3, 12).items).toEqual([24]);
    expect(paginate(items, 9, 12).page).toBe(3);
    expect(paginate(items, 0, 12).page).toBe(1);
    expect(paginate([], 2, 12)).toEqual({ items: [], page: 1, pageCount: 1 });
  });
});
