import { describe, expect, it } from 'vitest';
import { companyKey, findDuplicates, listingUrlKey, titleSimilarity } from './companies';

describe('companyKey', () => {
  it('riconosce la stessa azienda scritta in modi diversi', () => {
    expect(companyKey('Vela Servizi S.r.l.')).toBe('vela servizi');
    expect(companyKey('  VELA   servizi srl ')).toBe('vela servizi');
    expect(companyKey('Caffè Società S.p.A.')).toBe('caffe societa');
    expect(companyKey('ALFA NORD')).toBe('alfa nord');
  });
  it('non toglie la forma giuridica se è l’unica parola', () => {
    expect(companyKey('SpA')).toBe('spa');
    expect(companyKey('...')).toBe('');
  });
});

describe('listingUrlKey', () => {
  it('ignora schema, www, tracciamento, frammento e barra finale', () => {
    expect(listingUrlKey('https://www.Example.com/jobs/42/?utm_source=x#top')).toBe(
      'example.com/jobs/42',
    );
    expect(listingUrlKey('http://example.com/jobs/42?id=7&ref=mail')).toBe(
      'example.com/jobs/42?id=7',
    );
  });
});

describe('duplicati', () => {
  const candidates = [
    { id: 'a', title: 'Tecnico IT Junior - Help Desk', company: 'Vela Servizi', sourceUrl: null },
    { id: 'b', title: 'Sviluppatore backend', company: 'Acme', sourceUrl: 'https://acme.io/j/1' },
    { id: 'c', title: 'Magazziniere', company: null, sourceUrl: null },
  ];
  it('stesso link, stessa azienda con titolo simile, stesso titolo senza azienda', () => {
    expect(
      findDuplicates({ title: 'Altro', sourceUrl: 'https://www.acme.io/j/1/' }, candidates),
    ).toEqual([{ id: 'b', reason: 'same_url' }]);
    expect(
      findDuplicates(
        { title: 'Tecnico IT junior help desk', company: 'VELA SERVIZI srl' },
        candidates,
      ),
    ).toEqual([{ id: 'a', reason: 'same_company_similar_title' }]);
    expect(findDuplicates({ title: 'magazziniere', company: 'Beta' }, candidates)).toEqual([
      { id: 'c', reason: 'same_title' },
    ]);
  });
  it('nessun falso allarme per titoli diversi nella stessa azienda', () => {
    expect(findDuplicates({ title: 'Commerciale estero', company: 'Acme' }, candidates)).toEqual(
      [],
    );
    expect(titleSimilarity('Sviluppatore backend', 'Sviluppatore frontend')).toBeLessThan(0.6);
  });
});
