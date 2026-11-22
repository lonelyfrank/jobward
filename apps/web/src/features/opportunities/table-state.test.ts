import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  clearFilters,
  parseHiddenColumns,
  readTableState,
  TABLE_COLUMNS,
  toApiQuery,
  writeTableState,
} from './table-state';

const read = (qs: string) => readTableState(new URLSearchParams(qs));

describe('stato della tabella nell’indirizzo', () => {
  it('senza parametri: tutti i predefiniti, indirizzo vuoto', () => {
    const state = read('');
    expect(state).toMatchObject({
      q: '',
      sort: 'updatedAt',
      dir: 'desc',
      page: 1,
      archived: 'exclude',
    });
    expect(writeTableState(state).toString()).toBe('');
  });

  it('round-trip senza perdite: ricerca, filtri multipli, date, retribuzione, ordine, pagina', () => {
    const qs =
      'q=acme+srl&board=b1&column=c1&priority=high%2Curgent&stage=applied&outcome=none&mode=remote%2Chybrid&contract=permanent&label=l1%2Cl2&from=2026-10-01&to=2026-10-31&smin=1500&smax=3000&cur=EUR&per=month&arch=include&sort=title&page=3';
    const params = writeTableState(read(qs));
    expect(Object.fromEntries(params)).toEqual(Object.fromEntries(new URLSearchParams(qs)));
  });

  it('la direzione predefinita dipende dalla colonna e non entra nell’indirizzo', () => {
    expect(read('sort=title').dir).toBe('asc');
    expect(read('sort=appliedOn').dir).toBe('desc');
    expect(read('sort=priority').dir).toBe('desc');
    expect(writeTableState(read('sort=title')).toString()).toBe('sort=title');
    expect(writeTableState(read('sort=title&dir=desc')).get('dir')).toBe('desc');
  });

  it('valori non validi tornano al predefinito, senza errori', () => {
    const state = read('sort=password&dir=su&page=-4&arch=boh&priority=,,high,high');
    expect(state).toMatchObject({ sort: 'updatedAt', dir: 'desc', page: 1, archived: 'exclude' });
    expect(state.lists.priority).toEqual(['high']); // duplicati e vuoti scartati
    expect(read('page=2.5').page).toBe(1);
    expect(read(`q=${'x'.repeat(300)}`).q).toHaveLength(100);
  });

  it('toApiQuery: nomi del contratto, vuoti omessi, valuta maiuscola, paginazione sempre esplicita', () => {
    const query = toApiQuery(
      read('q=  acme &priority=high&mode=remote&label=l1&cur=eur&smin=1000&per=year&page=2'),
    );
    expect(query).toEqual({
      q: 'acme',
      priority: 'high',
      workMode: 'remote',
      labelId: 'l1',
      salaryMin: '1000',
      currency: 'EUR',
      salaryPeriod: 'year',
      archived: 'exclude',
      sort: 'updatedAt',
      dir: 'desc',
      page: '2',
      pageSize: '25',
    });
    expect(Object.keys(toApiQuery(read('')))).not.toContain('q');
  });

  it('activeFilterCount: ricerca e filtri sì; ordine, pagina e ambito fisso no', () => {
    expect(activeFilterCount(read('sort=title&page=4'), false)).toBe(0);
    expect(
      activeFilterCount(
        read('q=a&priority=high&stage=applied&from=2026-01-01&to=2026-02-01'),
        false,
      ),
    ).toBe(4);
    expect(activeFilterCount(read('board=b1'), false)).toBe(1);
    expect(activeFilterCount(read('board=b1'), true)).toBe(0);
    expect(activeFilterCount(read('smin=1&arch=only'), false)).toBe(2);
  });

  it('clearFilters azzera filtri, ricerca e pagina ma conserva ordine e bacheca fissa', () => {
    const cleared = clearFilters(
      read('q=a&priority=high&board=b1&sort=title&dir=desc&page=3'),
      true,
    );
    expect(writeTableState(cleared).toString()).toBe('board=b1&sort=title&dir=desc');
    expect(clearFilters(read('board=b1&q=x'), false).board).toBe('');
  });
});

describe('colonne visibili', () => {
  it('predefinite: quelle contrassegnate; la preferenza locale sostituisce, ignora chiavi ignote e non nasconde la principale', () => {
    const defaults = parseHiddenColumns(null);
    expect([...defaults].sort()).toEqual(
      TABLE_COLUMNS.filter((c) => !c.defaultVisible)
        .map((c) => c.key)
        .sort(),
    );
    expect([...parseHiddenColumns('["company","salary","inventata","title"]')].sort()).toEqual([
      'company',
      'salary',
    ]);
    expect(parseHiddenColumns('[]').size).toBe(0);
  });

  it('contenuto corrotto → predefiniti', () => {
    for (const raw of ['{', '"x"', '{"a":1}', 'null', '']) {
      expect(parseHiddenColumns(raw)).toEqual(parseHiddenColumns(null));
    }
  });
});
