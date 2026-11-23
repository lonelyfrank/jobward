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
      { ...draftFromCard(base()), sourceUrl: 'javascript:alert(1)', deadlineOn: '2026-02-30' },
      base(),
    ).errors;
    expect(e.sourceUrl).toMatch(/indirizzo web valido/);
    expect(e.deadlineOn).toBeTruthy();
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

  it('coordinate: incollate o da un link, inviate sempre in coppia; testo non valido → errore', () => {
    const c = base();
    const pasted = buildChanges({ ...draftFromCard(c), coordinates: '45,4642; 9,19' }, c);
    expect(pasted.errors).toEqual({});
    expect(pasted.input).toEqual({ latitude: 45.4642, longitude: 9.19 });

    const link = 'https://www.openstreetmap.org/?mlat=45.07&mlon=7.68#map=15/45.07/7.68';
    expect(buildChanges({ ...draftFromCard(c), coordinates: link }, c).input).toEqual({
      latitude: 45.07,
      longitude: 7.68,
    });

    const invalid = buildChanges({ ...draftFromCard(c), coordinates: 'Milano centro' }, c);
    expect(invalid.input).toBeNull();
    expect(invalid.errors.coordinates).toMatch(/coordinate valide/);

    // Cambia solo la longitudine: la patch contiene comunque entrambe.
    const saved = { ...c, latitude: 45.4642, longitude: 9.19 };
    expect(draftFromCard(saved).coordinates).toBe('45.4642, 9.19');
    expect(
      buildChanges({ ...draftFromCard(saved), coordinates: '45.4642, 9.2' }, saved).input,
    ).toEqual({ latitude: 45.4642, longitude: 9.2 });
    // Svuotare il campo azzera la coppia.
    expect(buildChanges({ ...draftFromCard(saved), coordinates: '' }, saved).input).toEqual({
      latitude: null,
      longitude: null,
    });
    expect(serverFieldErrors([{ path: 'longitude', message: 'x' }])).toEqual({ coordinates: 'x' });
  });

  it('città: testo libero rifilato, vuoto = nessuna città', () => {
    const c = base();
    expect(buildChanges({ ...draftFromCard(c), city: '  Milano ' }, c).input).toEqual({
      city: 'Milano',
    });
    const saved = { ...c, city: 'Milano' };
    expect(draftFromCard(saved).city).toBe('Milano');
    expect(buildChanges({ ...draftFromCard(saved), city: '' }, saved).input).toEqual({
      city: null,
    });
  });
});
