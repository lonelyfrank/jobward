import { opportunitiesQuery } from '@jobward/schemas';
import {
  applyQuery,
  applySmartFilter,
  smartFilterToQuery,
  type FilterableCard,
  type SmartFilterContext,
} from '@jobward/shared';
import { describe, expect, it } from 'vitest';
import { readSmartFilter, writeSmartFilter } from './smart-filter-url';

/**
 * Compatibilità SW.3: gli indirizzi del Kanban (formato `v:1`) restano validi e producono la
 * stessa selezione di schede passando dal motore di query v2.
 */

const ctx: SmartFilterContext = { today: '2026-11-09', timeZone: 'Europe/Rome' };
const day = (iso: string) => Date.parse(`${iso}T10:00:00Z`);

const card = (over: Partial<FilterableCard> = {}): FilterableCard => ({
  createdAt: day('2026-11-02'),
  updatedAt: day('2026-11-05'),
  appliedOn: null,
  stage: null,
  company: null,
  priority: 'none',
  workMode: null,
  contractType: null,
  labelIds: [],
  location: null,
  ...over,
});

const CARDS: FilterableCard[] = [
  card({
    stage: 'applied',
    company: 'Caffè Roma',
    priority: 'high',
    workMode: 'remote',
    location: 'Roma',
    createdAt: day('2026-11-09'),
  }),
  card({
    company: 'Osteria Verdi',
    priority: 'high',
    labelIds: ['l1'],
    createdAt: day('2026-11-09'),
  }),
  card({
    stage: 'interviewing',
    company: 'caffe roma',
    priority: 'low',
    contractType: 'permanent',
    appliedOn: '2026-10-20',
  }),
  card({
    location: 'Milano, Lombardia',
    createdAt: day('2026-10-01'),
    updatedAt: day('2026-10-01'),
  }),
  card({ stage: 'saved', workMode: 'hybrid', labelIds: ['l1', 'l2'], appliedOn: '2026-11-09' }),
];

const LEGACY_URLS = [
  '',
  '?fase=applied',
  '?fase=applied,none',
  '?fase=none&modalita=none',
  '?priorita=high,urgent&creata=week',
  '?creata=week-1&aggiornata=month',
  '?inviata=2026-10-01..2026-10-31',
  '?inviata=2026-11-01..',
  '?azienda=CAFFE+ROMA&azienda=Osteria+Verdi',
  '?localita=lombardia',
  '?etichetta=l1',
  '?etichetta=l1,l2&fase=saved,applied',
  '?contratto=permanent,none&priorita=low',
  '?fase=bogus&priorita=high', // valore non valido: scartato, il resto resta
  '?board=b1&fase=applied&sort=x', // parametri estranei preservati
];

describe('indirizzi del Kanban ↔ motore v2', () => {
  it.each(LEGACY_URLS)('%s: stessa selezione del valutatore v1', (search) => {
    const config = readSmartFilter(new URLSearchParams(search));
    const viaV1 = applySmartFilter(CARDS, config, ctx);
    const viaV2 = applyQuery(CARDS, smartFilterToQuery(config), ctx);
    expect(viaV2).toEqual(viaV1);
  });

  it('la query v2 è serializzabile e stabile (round-trip JSON)', () => {
    for (const search of LEGACY_URLS) {
      const query = smartFilterToQuery(readSmartFilter(new URLSearchParams(search)));
      expect(JSON.parse(JSON.stringify(query))).toEqual(query);
      expect(
        smartFilterToQuery(
          readSmartFilter(
            writeSmartFilter(new URLSearchParams(), readSmartFilter(new URLSearchParams(search))),
          ),
        ),
      ).toEqual(query);
    }
  });

  it('almeno un indirizzo filtra davvero (i test non sono banali)', () => {
    const sizes = new Set(
      LEGACY_URLS.map(
        (search) =>
          applyQuery(CARDS, smartFilterToQuery(readSmartFilter(new URLSearchParams(search))), ctx)
            .length,
      ),
    );
    expect(sizes.size).toBeGreaterThan(3);
  });

  it('la query prodotta è accettata dal contratto dell’API (`where`)', () => {
    for (const search of LEGACY_URLS) {
      const query = smartFilterToQuery(readSmartFilter(new URLSearchParams(search)));
      const parsed = opportunitiesQuery.safeParse({ where: JSON.stringify(query) });
      expect(parsed.success, search).toBe(true);
    }
  });
});
