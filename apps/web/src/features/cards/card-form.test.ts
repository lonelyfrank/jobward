import { describe, expect, it } from 'vitest';
import { card } from '@/test/fixtures';
import { buildChanges, draftFromCard, serverFieldErrors } from './card-form';

const base = () => card('k1', 'Infermiere', 'c1', 1024);

describe('bozza ↔ patch del pannello di dettaglio', () => {
  it('senza modifiche non c’è nessuna patch', () => {
    const c = base();
    const { changes, input } = buildChanges(draftFromCard(c), c);
    expect(changes).toEqual({});
    expect(input).toBeNull();
  });

  it('invia SOLO i campi cambiati (nessuna sovrascrittura del resto)', () => {
    const c = { ...base(), company: 'Acme', location: 'Roma', stage: 'applied' as const };
    const draft = { ...draftFromCard(c), location: 'Milano' };
    expect(buildChanges(draft, c).input).toEqual({ location: 'Milano' });
  });

  it('svuotare un campo invia null, non una stringa vuota', () => {
    const c = { ...base(), company: 'Acme', workMode: 'remote' as const };
    const draft = { ...draftFromCard(c), company: '   ', workMode: '' };
    expect(buildChanges(draft, c).input).toEqual({ company: null, workMode: null });
  });

  it('gli spazi attorno al testo non contano come modifica', () => {
    const c = { ...base(), company: 'Acme' };
    expect(buildChanges({ ...draftFromCard(c), company: ' Acme ' }, c).changes).toEqual({});
  });

  it('gli importi diventano numeri interi (accetta il separatore italiano delle migliaia)', () => {
    const draft = {
      ...draftFromCard(base()),
      salaryMin: '1.800',
      salaryMax: '2200',
      currency: 'eur',
    };
    const { input, errors } = buildChanges(draft, base());
    expect(errors).toEqual({});
    expect(input).toEqual({ salaryMin: 1800, salaryMax: 2200, currency: 'EUR' });
    expect(typeof input?.salaryMin).toBe('number');
  });

  it.each(['12,5', '1e3', '-5', 'dieci', '1.80', '12.5'])('rifiuta l’importo "%s"', (value) => {
    const draft = { ...draftFromCard(base()), salaryMin: value, currency: 'EUR' };
    const { input, errors } = buildChanges(draft, base());
    expect(input).toBeNull();
    expect(errors.salaryMin).toMatch(/importo intero/);
  });

  it('un importo senza valuta è un errore sul campo valuta, anche se la patch non la tocca', () => {
    const draft = { ...draftFromCard(base()), salaryMin: '1000' };
    expect(buildChanges(draft, base()).errors.currency).toMatch(/valuta/);
    // Con la valuta già salvata, indicare solo l'importo è valido.
    const saved = { ...base(), currency: 'CHF' };
    const ok = buildChanges({ ...draftFromCard(saved), salaryMin: '1000' }, saved);
    expect(ok.errors).toEqual({});
    expect(ok.input).toEqual({ salaryMin: 1000 });
  });

  it('minimo superiore al massimo: errore su "salaryMax"', () => {
    const draft = {
      ...draftFromCard(base()),
      salaryMin: '3000',
      salaryMax: '2000',
      currency: 'EUR',
    };
    expect(buildChanges(draft, base()).errors.salaryMax).toMatch(/non può superare/);
  });

  it('URL non http(s) e date inesistenti sono rifiutati con il messaggio del contratto', () => {
    const e = buildChanges(
      { ...draftFromCard(base()), sourceUrl: 'javascript:alert(1)', appliedOn: '2026-02-30' },
      base(),
    ).errors;
    expect(e.sourceUrl).toMatch(/indirizzo web valido/);
    expect(e.appliedOn).toBeTruthy();
  });

  it('titolo vuoto: errore sul titolo', () => {
    expect(
      buildChanges({ ...draftFromCard(base()), title: '  ' }, base()).errors.title,
    ).toBeTruthy();
  });

  it('serverFieldErrors mappa i path del server sui campi e ignora quelli sconosciuti', () => {
    expect(
      serverFieldErrors([
        { path: 'salaryMax', message: 'm' },
        { path: 'altro', message: 'x' },
      ]),
    ).toEqual({ salaryMax: 'm' });
  });
});
