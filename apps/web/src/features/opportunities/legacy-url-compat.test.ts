import { opportunitiesQuery } from '@jobward/schemas';
import { legacyFiltersToQuery, queryLimitIssues } from '@jobward/shared';
import { describe, expect, it } from 'vitest';
import { readTableState, toApiQuery, writeTableState } from './table-state';

/**
 * Compatibilità SW.3: gli indirizzi storici della Tabella non cambiano, e i parametri che ne
 * derivano sono sempre accettati dal contratto dell'API e traducibili nella query v2.
 */

const URLS = [
  '',
  '?q=barista',
  '?priority=high,urgent&stage=applied,none',
  '?outcome=none&mode=remote,none&contract=permanent',
  '?label=l1,l2&from=2026-01-01&to=2026-06-30',
  '?smin=30000&smax=40000&cur=eur&per=year',
  '?board=b1&column=c1&arch=only&sort=company&dir=desc&page=3',
  '?sort=appliedOn',
  '?sort=nope&page=-4&dir=sideways', // valori non validi: tornano ai predefiniti
];

describe('indirizzi della Tabella: invariati e compatibili con l’API', () => {
  it.each(URLS)('%s', (search) => {
    const params = new URLSearchParams(search);
    const state = readTableState(params);
    // l'indirizzo riscritto è canonico e stabile
    const canonical = writeTableState(state);
    expect(writeTableState(readTableState(canonical)).toString()).toBe(canonical.toString());
    // i parametri dell'API sono accettati dal contratto (stato vuoto compreso)
    const api = toApiQuery(state);
    const parsed = opportunitiesQuery.safeParse(api);
    expect(parsed.success, JSON.stringify(parsed.success ? '' : parsed.error.issues)).toBe(true);
    if (parsed.success) {
      const q = parsed.data;
      const query = legacyFiltersToQuery({
        priority: q.priority,
        stage: q.stage,
        outcome: q.outcome,
        workMode: q.workMode,
        contractType: q.contractType,
        labelId: q.labelId,
        appliedFrom: q.appliedFrom,
        appliedTo: q.appliedTo,
      });
      expect(queryLimitIssues(query)).toEqual([]);
    }
  });

  it('un valore fuori vocabolario in una lista resta un errore dell’API (contratto M2.3 invariato)', () => {
    const api = toApiQuery(readTableState(new URLSearchParams('?stage=bogus')));
    expect(opportunitiesQuery.safeParse(api).success).toBe(false);
  });

  it('golden: i nomi brevi dell’indirizzo diventano i parametri storici del contratto', () => {
    const state = readTableState(
      new URLSearchParams(
        '?priority=high&stage=applied,none&mode=remote&contract=permanent&label=l1&from=2026-01-01&to=2026-02-01&sort=company&dir=asc&page=2',
      ),
    );
    expect(toApiQuery(state, 25)).toEqual({
      priority: 'high',
      stage: 'applied,none',
      workMode: 'remote',
      contractType: 'permanent',
      labelId: 'l1',
      appliedFrom: '2026-01-01',
      appliedTo: '2026-02-01',
      archived: 'exclude',
      sort: 'company',
      dir: 'asc',
      page: '2',
      pageSize: '25',
    });
  });

  it('la tabella non invia `where`: nessun filtro nascosto (la UI non lo espone ancora)', () => {
    for (const search of URLS)
      expect(toApiQuery(readTableState(new URLSearchParams(search)))).not.toHaveProperty('where');
  });
});
