import { describe, expect, it } from 'vitest';
import { formatCalendarDate } from './format';
import { formatSalary } from './salary';

const none = {
  salaryMin: null,
  salaryMax: null,
  currency: null,
  salaryPeriod: null,
  salaryBasis: null,
};

describe('formatSalary', () => {
  it('senza importi non mostra nulla', () => {
    expect(formatSalary(none)).toBeNull();
    expect(
      formatSalary({ ...none, currency: 'EUR', salaryPeriod: 'year', salaryBasis: 'net' }),
    ).toBeNull();
  });

  it('intervallo con periodo e natura registrati', () => {
    const text = formatSalary({
      salaryMin: 1800,
      salaryMax: 2200,
      currency: 'EUR',
      salaryPeriod: 'month',
      salaryBasis: 'net',
    });
    expect(text).toMatch(/1\.?800\s?€ – 2\.?200\s?€ al mese, netto/);
  });

  it('NON dichiara lordo o netto se non è stato registrato, né il periodo', () => {
    const text = formatSalary({ ...none, salaryMin: 30000, salaryMax: 40000, currency: 'EUR' })!;
    expect(text).not.toMatch(/lordo|netto|all’anno|al mese/);
  });

  it('estremo singolo: "da" / "fino a"; stesso minimo e massimo: un solo importo', () => {
    expect(formatSalary({ ...none, salaryMin: 15, currency: 'EUR', salaryPeriod: 'hour' })).toMatch(
      /^da 15\s?€ all’ora$/,
    );
    expect(formatSalary({ ...none, salaryMax: 2000, currency: 'EUR' })).toMatch(
      /^fino a 2\.?000\s?€$/,
    );
    expect(formatSalary({ ...none, salaryMin: 100, salaryMax: 100, currency: 'EUR' })).toMatch(
      /^100\s?€$/,
    );
  });

  it('una valuta sconosciuta non manda in errore l’interfaccia', () => {
    expect(formatSalary({ ...none, salaryMin: 5, currency: 'ZZZ' })).toContain('5');
  });
});

describe('formatCalendarDate', () => {
  it('mostra il giorno scritto, senza spostamenti di fuso', () => {
    expect(formatCalendarDate('2026-10-25')).toBe('25 ott 2026');
    expect(formatCalendarDate('2026-01-01')).toBe('1 gen 2026');
    expect(formatCalendarDate(null)).toBeNull();
  });
});
