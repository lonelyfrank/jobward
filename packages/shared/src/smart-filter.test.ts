import { describe, expect, it } from 'vitest';
import {
  applySmartFilter,
  companyOptions,
  compileSmartFilter,
  countActiveFilters,
  EMPTY_SMART_FILTER,
  isSmartFilterActive,
  isValidDateFilter,
  normalizeSmartFilter,
  normalizeText,
  resolveDateFilter,
  shiftDateFilter,
  weekdayIndex,
  type DateFilter,
  type FilterableCard,
  type SmartFilterConfig,
  type SmartFilterContext,
} from './smart-filter';

const ROME: SmartFilterContext = { today: '2026-11-09', timeZone: 'Europe/Rome' };
const at = (iso: string) => Date.parse(iso);

const make = (over: Partial<FilterableCard> = {}): FilterableCard => ({
  createdAt: at('2026-11-02T10:00:00Z'),
  updatedAt: at('2026-11-05T10:00:00Z'),
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

const cfg = (over: Omit<SmartFilterConfig, 'v'>): SmartFilterConfig => ({ v: 1, ...over });
const preset = (p: Exclude<DateFilter['preset'], 'custom'>, offset = 0): DateFilter => ({
  preset: p,
  offset,
});
const custom = (from: string | null, to: string | null): DateFilter => ({
  preset: 'custom',
  from,
  to,
});

describe('weekdayIndex (lunedì = 0)', () => {
  it('calcola il giorno della settimana', () => {
    expect(weekdayIndex('2026-11-09')).toBe(0); // lunedì
    expect(weekdayIndex('2026-11-15')).toBe(6); // domenica
    expect(weekdayIndex('1970-01-01')).toBe(3); // giovedì
    expect(weekdayIndex('2028-02-29')).toBe(1); // martedì, anno bisestile
  });
});

describe('resolveDateFilter', () => {
  it('oggi', () => {
    expect(resolveDateFilter(preset('today'), '2026-11-09')).toEqual({
      from: '2026-11-09',
      to: '2026-11-09',
    });
    expect(resolveDateFilter(preset('today', -1), '2026-11-01')).toEqual({
      from: '2026-10-31',
      to: '2026-10-31',
    });
  });

  it('questa settimana comincia di lunedì, anche a cavallo di mese e di anno', () => {
    expect(resolveDateFilter(preset('this_week'), '2026-11-11')).toEqual({
      from: '2026-11-09',
      to: '2026-11-15',
    });
    // domenica: appartiene alla settimana che è cominciata il lunedì prima
    expect(resolveDateFilter(preset('this_week'), '2026-11-15')).toEqual({
      from: '2026-11-09',
      to: '2026-11-15',
    });
    expect(resolveDateFilter(preset('this_week'), '2026-11-09')).toEqual({
      from: '2026-11-09',
      to: '2026-11-15',
    });
    expect(resolveDateFilter(preset('this_week'), '2027-01-01')).toEqual({
      from: '2026-12-28',
      to: '2027-01-03',
    });
    expect(resolveDateFilter(preset('this_week', -1), '2026-11-11')).toEqual({
      from: '2026-11-02',
      to: '2026-11-08',
    });
  });

  it('questo mese, con mesi corti, anni bisestili e cambio d’anno', () => {
    expect(resolveDateFilter(preset('this_month'), '2026-11-09')).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(resolveDateFilter(preset('this_month'), '2028-02-10')).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    });
    expect(resolveDateFilter(preset('this_month'), '2027-02-10')).toEqual({
      from: '2027-02-01',
      to: '2027-02-28',
    });
    expect(resolveDateFilter(preset('this_month', -1), '2027-01-15')).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    });
    expect(resolveDateFilter(preset('this_month', -12), '2026-11-09')).toEqual({
      from: '2025-11-01',
      to: '2025-11-30',
    });
  });

  it('ultimi 30 giorni include oggi e scorre a blocchi di 30', () => {
    expect(resolveDateFilter(preset('last_30_days'), '2026-11-09')).toEqual({
      from: '2026-10-11',
      to: '2026-11-09',
    });
    expect(resolveDateFilter(preset('last_30_days', -1), '2026-11-09')).toEqual({
      from: '2026-09-11',
      to: '2026-10-10',
    });
  });

  it('anno corrente', () => {
    expect(resolveDateFilter(preset('this_year'), '2026-11-09')).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
    });
    expect(resolveDateFilter(preset('this_year', -1), '2026-11-09')).toEqual({
      from: '2025-01-01',
      to: '2025-12-31',
    });
  });

  it('intervallo personalizzato: estremi inclusi, anche aperti da un lato', () => {
    expect(resolveDateFilter(custom('2026-01-05', '2026-01-10'), ROME.today)).toEqual({
      from: '2026-01-05',
      to: '2026-01-10',
    });
    expect(resolveDateFilter(custom('2026-01-05', null), ROME.today)).toEqual({
      from: '2026-01-05',
      to: null,
    });
  });
});

describe('isValidDateFilter', () => {
  it('rifiuta intervalli vuoti, invertiti, con date inesistenti e offset impossibili', () => {
    expect(isValidDateFilter(custom(null, null))).toBe(false);
    expect(isValidDateFilter(custom('2026-03-02', '2026-03-01'))).toBe(false);
    expect(isValidDateFilter(custom('2026-02-30', null))).toBe(false);
    expect(isValidDateFilter(custom('2026-03-01', '2026-03-01'))).toBe(true);
    expect(isValidDateFilter(preset('today', 1))).toBe(false); // nessun periodo futuro
    expect(isValidDateFilter(preset('today', -0.5))).toBe(false);
    expect(isValidDateFilter(preset('this_year', -5000))).toBe(false);
    expect(isValidDateFilter(preset('this_week', -3))).toBe(true);
  });
});

describe('shiftDateFilter (navigazione temporale)', () => {
  it('indietro e avanti, mai oltre il periodo corrente', () => {
    expect(shiftDateFilter(preset('this_week'), -1)).toEqual(preset('this_week', -1));
    expect(shiftDateFilter(preset('this_week', -1), 1)).toEqual(preset('this_week', 0));
    expect(shiftDateFilter(preset('this_week'), 1)).toBeNull();
    expect(shiftDateFilter(preset('this_year', -1200), -1)).toBeNull();
  });

  it('un intervallo personalizzato si sposta della propria ampiezza', () => {
    expect(shiftDateFilter(custom('2026-11-01', '2026-11-07'), -1)).toEqual(
      custom('2026-10-25', '2026-10-31'),
    );
    expect(shiftDateFilter(custom('2026-11-01', '2026-11-07'), 1)).toEqual(
      custom('2026-11-08', '2026-11-14'),
    );
    expect(shiftDateFilter(custom('2026-11-01', null), -1)).toBeNull();
    expect(shiftDateFilter(custom(null, '2026-11-01'), 1)).toBeNull();
  });
});

describe('normalizeSmartFilter', () => {
  it('toglie vuoti, duplicati, valori sconosciuti e filtri data non validi', () => {
    const dirty = {
      v: 1,
      stage: ['applied', 'applied', 'inventata', 'none'],
      company: [' Acme ', 'Acme', '', '   '],
      priority: [],
      workMode: ['remote', 'ufficio'],
      contractType: ['alieno'],
      labelIds: ['l1', 'l1'],
      location: '   ',
      created: custom('2026-03-02', '2026-03-01'),
      applied: preset('today'),
    } as unknown as SmartFilterConfig;
    expect(normalizeSmartFilter(dirty)).toEqual({
      v: 1,
      stage: ['applied', 'none'],
      company: ['Acme'],
      workMode: ['remote'],
      labelIds: ['l1'],
      applied: preset('today'),
    });
  });

  it('è idempotente e distingue configurazioni vuote da attive', () => {
    const config = cfg({ priority: ['high'], location: ' Milano ' });
    const once = normalizeSmartFilter(config);
    expect(normalizeSmartFilter(once)).toEqual(once);
    expect(once.location).toBe('Milano');
    expect(isSmartFilterActive(EMPTY_SMART_FILTER)).toBe(false);
    expect(isSmartFilterActive(cfg({ priority: [] }))).toBe(false);
    expect(countActiveFilters(cfg({ priority: ['high', 'low'], stage: ['applied'] }))).toBe(2);
  });
});

describe('normalizeText e companyOptions', () => {
  it('ignora maiuscole, accenti e spazi multipli', () => {
    expect(normalizeText('  Città   di  Perù ')).toBe('citta di peru');
    expect(normalizeText('CAFÉ')).toBe('cafe');
  });

  it('unisce la stessa azienda scritta in modi diversi e ordina in italiano', () => {
    expect(
      companyOptions([
        { company: 'Zeta' },
        { company: 'acme' },
        { company: 'ACME' },
        { company: 'Èlite' },
        { company: null },
        { company: '  ' },
      ]),
    ).toEqual(['acme', 'Èlite', 'Zeta']);
  });
});

describe('filtri per campo', () => {
  const run = (config: SmartFilterConfig, cards: FilterableCard[], context = ROME) =>
    applySmartFilter(cards, config, context);

  it('data di creazione: giorno locale del workspace, estremi inclusi', () => {
    const inside = make({ createdAt: at('2026-11-09T08:00:00Z') });
    const before = make({ createdAt: at('2026-11-08T08:00:00Z') });
    const config = cfg({ created: preset('today') });
    expect(run(config, [inside, before])).toEqual([inside]);
    expect(run(cfg({ created: preset('this_week') }), [inside, before])).toEqual([inside]);
  });

  it('ultimo aggiornamento', () => {
    const recent = make({ updatedAt: at('2026-11-07T10:00:00Z') });
    const old = make({ updatedAt: at('2026-08-01T10:00:00Z') });
    expect(run(cfg({ updated: preset('last_30_days') }), [recent, old])).toEqual([recent]);
    expect(run(cfg({ updated: preset('this_year') }), [recent, old])).toEqual([recent, old]);
  });

  it('data di invio: giorno di calendario, senza fuso; senza data non soddisfa il filtro', () => {
    const sent = make({ appliedOn: '2026-11-03' });
    const other = make({ appliedOn: '2026-10-01' });
    const never = make({ appliedOn: null });
    const config = cfg({ applied: preset('this_month') });
    expect(run(config, [sent, other, never])).toEqual([sent]);
    expect(run(cfg({ applied: custom('2026-10-01', null) }), [sent, other, never])).toEqual([
      sent,
      other,
    ]);
    expect(run(cfg({ applied: custom(null, '2026-10-01') }), [sent, other, never])).toEqual([
      other,
    ]);
  });

  it('stato: OR tra i valori, `none` = non indicato', () => {
    const applied = make({ stage: 'applied' });
    const offer = make({ stage: 'offer' });
    const empty = make({ stage: null });
    expect(run(cfg({ stage: ['applied', 'offer'] }), [applied, offer, empty])).toEqual([
      applied,
      offer,
    ]);
    expect(run(cfg({ stage: ['none'] }), [applied, offer, empty])).toEqual([empty]);
    expect(run(cfg({ stage: ['none', 'offer'] }), [applied, offer, empty])).toEqual([offer, empty]);
  });

  it('azienda: uguaglianza tollerante a maiuscole e accenti, non sottostringa', () => {
    const a = make({ company: 'Café Rossi' });
    const b = make({ company: 'cafe rossi' });
    const c = make({ company: 'Café Rossi Group' });
    const none = make({ company: null });
    expect(run(cfg({ company: ['CAFÉ ROSSI'] }), [a, b, c, none])).toEqual([a, b]);
  });

  it('priorità (compresa "nessuna"), modalità e contratto', () => {
    const urgent = make({ priority: 'urgent', workMode: 'remote', contractType: 'permanent' });
    const plain = make({ priority: 'none', workMode: null, contractType: null });
    expect(run(cfg({ priority: ['urgent'] }), [urgent, plain])).toEqual([urgent]);
    expect(run(cfg({ priority: ['none'] }), [urgent, plain])).toEqual([plain]);
    expect(run(cfg({ workMode: ['remote'] }), [urgent, plain])).toEqual([urgent]);
    expect(run(cfg({ workMode: ['none'] }), [urgent, plain])).toEqual([plain]);
    expect(run(cfg({ contractType: ['permanent', 'none'] }), [urgent, plain])).toEqual([
      urgent,
      plain,
    ]);
  });

  it('etichette: basta una delle selezionate', () => {
    const both = make({ labelIds: ['l1', 'l2'] });
    const one = make({ labelIds: ['l2'] });
    const noneLabel = make({ labelIds: [] });
    expect(run(cfg({ labelIds: ['l1'] }), [both, one, noneLabel])).toEqual([both]);
    expect(run(cfg({ labelIds: ['l1', 'l2'] }), [both, one, noneLabel])).toEqual([both, one]);
  });

  it('località: sottostringa senza distinzione di maiuscole/accenti; senza località non corrisponde', () => {
    const milan = make({ location: 'Milano, Lombardia' });
    const rome = make({ location: 'Roma' });
    const nowhere = make({ location: null });
    expect(run(cfg({ location: 'MILANO' }), [milan, rome, nowhere])).toEqual([milan]);
    expect(run(cfg({ location: 'lombardìa' }), [milan, rome, nowhere])).toEqual([milan]);
  });
});

describe('combinazioni AND tra campi / OR nello stesso campo', () => {
  const cards = [
    make({ stage: 'applied', priority: 'high', workMode: 'remote', company: 'Acme' }),
    make({ stage: 'applied', priority: 'low', workMode: 'remote', company: 'Acme' }),
    make({ stage: 'offer', priority: 'high', workMode: 'onsite', company: 'Beta' }),
    make({ stage: 'saved', priority: 'high', workMode: 'hybrid', company: 'Beta' }),
  ];

  it('campi diversi si restringono (AND)', () => {
    const r = applySmartFilter(cards, cfg({ stage: ['applied'], priority: ['high'] }), ROME);
    expect(r).toEqual([cards[0]]);
  });

  it('valori dello stesso campo si sommano (OR), poi si intersecano con gli altri campi', () => {
    const r = applySmartFilter(
      cards,
      cfg({ stage: ['applied', 'offer'], priority: ['high'], company: ['Acme', 'Beta'] }),
      ROME,
    );
    expect(r).toEqual([cards[0], cards[2]]);
    const none = applySmartFilter(cards, cfg({ stage: ['saved'], workMode: ['remote'] }), ROME);
    expect(none).toEqual([]);
  });

  it('data AND attributi', () => {
    const dated = [
      make({ createdAt: at('2026-11-09T09:00:00Z'), priority: 'high' }),
      make({ createdAt: at('2026-11-09T09:00:00Z'), priority: 'low' }),
      make({ createdAt: at('2026-10-01T09:00:00Z'), priority: 'high' }),
    ];
    expect(
      applySmartFilter(dated, cfg({ created: preset('today'), priority: ['high'] }), ROME),
    ).toEqual([dated[0]]);
  });
});

describe('fusi orari e cambi d’ora', () => {
  const createdOn = (iso: string) => make({ createdAt: at(iso) });
  const onDay = (day: string, timeZone: string, today = day) =>
    compileSmartFilter(cfg({ created: custom(day, day) }), { today, timeZone });

  it('ora solare → legale al contrario (25/10/2026): il giorno locale dura 25 ore', () => {
    const matches = onDay('2026-10-25', 'Europe/Rome');
    expect(matches(createdOn('2026-10-24T21:59:59Z'))).toBe(false); // 23:59:59 del 24 (CEST)
    expect(matches(createdOn('2026-10-24T22:00:00Z'))).toBe(true); // 00:00 del 25
    expect(matches(createdOn('2026-10-25T00:30:00Z'))).toBe(true); // 02:30 CEST
    expect(matches(createdOn('2026-10-25T01:30:00Z'))).toBe(true); // 02:30 CET (ora ripetuta)
    expect(matches(createdOn('2026-10-25T22:59:59Z'))).toBe(true); // 23:59:59 CET
    expect(matches(createdOn('2026-10-25T23:00:00Z'))).toBe(false); // 00:00 del 26
  });

  it('passaggio all’ora legale (28/03/2027): il giorno locale dura 23 ore', () => {
    const matches = onDay('2027-03-28', 'Europe/Rome');
    expect(matches(createdOn('2027-03-27T22:59:59Z'))).toBe(false);
    expect(matches(createdOn('2027-03-27T23:00:00Z'))).toBe(true); // 00:00 CET
    expect(matches(createdOn('2027-03-28T22:00:00Z'))).toBe(false); // 00:00 CEST del 29
    expect(matches(createdOn('2027-03-28T21:59:59Z'))).toBe(true);
  });

  it('lo stesso istante cade in giorni diversi in fusi diversi', () => {
    const instant = createdOn('2026-11-08T23:30:00Z');
    expect(onDay('2026-11-09', 'Europe/Rome')(instant)).toBe(true); // 00:30 del 9
    expect(onDay('2026-11-08', 'America/New_York')(instant)).toBe(true); // 18:30 dell'8
    expect(onDay('2026-11-09', 'Pacific/Auckland')(instant)).toBe(true); // 12:30 del 9 (+13)
    expect(onDay('2026-11-08', 'Europe/Rome')(instant)).toBe(false);
  });

  it('"oggi" segue la data locale passata dal chiamante, non il fuso del dispositivo', () => {
    const justAfterMidnight = createdOn('2026-11-09T23:30:00Z'); // 00:30 del 10 a Roma
    const filter = cfg({ created: preset('today') });
    expect(
      compileSmartFilter(filter, { today: '2026-11-10', timeZone: 'Europe/Rome' })(
        justAfterMidnight,
      ),
    ).toBe(true);
    expect(
      compileSmartFilter(filter, { today: '2026-11-09', timeZone: 'Europe/Rome' })(
        justAfterMidnight,
      ),
    ).toBe(false);
  });

  it('settimana a cavallo del cambio d’ora: i confini restano giorni di calendario', () => {
    // 25/10/2026 è domenica: la settimana va da lunedì 19 a domenica 25 e contiene i 25 ore.
    const week = compileSmartFilter(cfg({ created: preset('this_week') }), {
      today: '2026-10-25',
      timeZone: 'Europe/Rome',
    });
    expect(week(createdOn('2026-10-18T22:00:00Z'))).toBe(true); // 00:00 di lunedì 19
    expect(week(createdOn('2026-10-18T21:59:59Z'))).toBe(false);
    expect(week(createdOn('2026-10-25T22:59:59Z'))).toBe(true);
    expect(week(createdOn('2026-10-25T23:00:00Z'))).toBe(false);
  });
});

describe('valori mancanti', () => {
  it('una scheda senza dati non soddisfa un filtro positivo, ma soddisfa `none`', () => {
    const empty = make();
    for (const config of [
      cfg({ applied: preset('this_year') }),
      cfg({ company: ['Acme'] }),
      cfg({ location: 'Roma' }),
      cfg({ labelIds: ['l1'] }),
      cfg({ stage: ['applied'] }),
      cfg({ workMode: ['remote'] }),
      cfg({ contractType: ['permanent'] }),
    ]) {
      expect(applySmartFilter([empty], config, ROME), JSON.stringify(config)).toEqual([]);
    }
    for (const config of [
      cfg({ stage: ['none'] }),
      cfg({ workMode: ['none'] }),
      cfg({ contractType: ['none'] }),
      cfg({ priority: ['none'] }),
    ]) {
      expect(applySmartFilter([empty], config, ROME), JSON.stringify(config)).toEqual([empty]);
    }
  });
});

describe('purezza', () => {
  it('senza filtri attivi restituisce lo stesso array', () => {
    const cards = [make(), make()];
    expect(applySmartFilter(cards, EMPTY_SMART_FILTER, ROME)).toBe(cards);
    expect(applySmartFilter(cards, cfg({ priority: [] }), ROME)).toBe(cards);
  });

  it('non modifica schede, array né configurazione e mantiene l’ordine', () => {
    const cards = [
      make({ priority: 'high', company: 'A' }),
      make({ priority: 'low', company: 'B' }),
      make({ priority: 'high', company: 'C' }),
    ];
    cards.forEach((c) => Object.freeze(c));
    Object.freeze(cards);
    const config = Object.freeze(cfg({ priority: Object.freeze(['high']) as unknown as ['high'] }));
    const before = JSON.stringify(cards);
    const result = applySmartFilter(cards, config, ROME);
    expect(result.map((c) => c.company)).toEqual(['A', 'C']);
    expect(result[0]).toBe(cards[0]); // stesse istanze, nessuna copia
    expect(JSON.stringify(cards)).toBe(before);
  });

  it('gestisce migliaia di schede in tempi brevi', () => {
    const many = Array.from({ length: 5000 }, (_, i) =>
      make({
        createdAt: at('2026-01-01T00:00:00Z') + i * 3_600_000,
        priority: i % 2 ? 'high' : 'low',
        company: `Azienda ${i % 40}`,
        labelIds: i % 3 ? ['l1'] : [],
      }),
    );
    const started = Date.now();
    const r = applySmartFilter(
      many,
      cfg({
        created: preset('this_year'),
        priority: ['high'],
        company: ['Azienda 1', 'Azienda 3'],
      }),
      ROME,
    );
    expect(Date.now() - started).toBeLessThan(1000);
    expect(r.length).toBeGreaterThan(0);
  });
});
