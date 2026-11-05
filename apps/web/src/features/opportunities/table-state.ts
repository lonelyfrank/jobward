import { DEFAULT_SORT_DIR, OPPORTUNITY_SORTS, type OpportunitySort } from '@meet-roulette/schemas';
import { LIMITS } from '@meet-roulette/shared';

/**
 * Stato della tabella nell'indirizzo (ricerca, filtri, ordinamento, pagina): condivisibile,
 * sopravvive al refresh e al "indietro". Funzioni pure: la conversione URL ↔ query dell'API è
 * l'unico punto in cui i nomi brevi dell'indirizzo diventano i parametri del contratto.
 */

/** Filtri a elenco: chiave nell'indirizzo → parametro dell'API. */
const LIST_KEYS = {
  priority: 'priority',
  stage: 'stage',
  outcome: 'outcome',
  mode: 'workMode',
  contract: 'contractType',
  label: 'labelId',
} as const;
type ListKey = keyof typeof LIST_KEYS;

export interface TableState {
  q: string;
  board: string;
  column: string;
  lists: Record<ListKey, string[]>;
  from: string;
  to: string;
  salaryMin: string;
  salaryMax: string;
  currency: string;
  period: string;
  archived: 'exclude' | 'include' | 'only';
  sort: OpportunitySort;
  dir: 'asc' | 'desc';
  /** `true` se la direzione è stata scelta esplicitamente (altrimenti vale quella predefinita). */
  dirExplicit: boolean;
  page: number;
}

const ARCHIVED = ['exclude', 'include', 'only'] as const;
const csv = (value: string | null) => (value ? [...new Set(value.split(',').filter(Boolean))] : []);

/** Legge lo stato dall'indirizzo; i valori non riconosciuti tornano al predefinito (mai un errore). */
export function readTableState(params: URLSearchParams): TableState {
  const sort = params.get('sort') as OpportunitySort | null;
  const dir = params.get('dir');
  const archived = params.get('arch');
  const page = Number(params.get('page'));
  const validSort =
    sort && (OPPORTUNITY_SORTS as readonly string[]).includes(sort) ? sort : 'updatedAt';
  return {
    q: (params.get('q') ?? '').slice(0, LIMITS.searchTextMax),
    board: params.get('board') ?? '',
    column: params.get('column') ?? '',
    lists: Object.fromEntries(
      (Object.keys(LIST_KEYS) as ListKey[]).map((key) => [key, csv(params.get(key))]),
    ) as Record<ListKey, string[]>,
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    salaryMin: params.get('smin') ?? '',
    salaryMax: params.get('smax') ?? '',
    currency: params.get('cur') ?? '',
    period: params.get('per') ?? '',
    archived: (ARCHIVED as readonly string[]).includes(archived ?? '')
      ? (archived as TableState['archived'])
      : 'exclude',
    sort: validSort,
    dir: dir === 'asc' || dir === 'desc' ? dir : DEFAULT_SORT_DIR[validSort],
    dirExplicit: dir === 'asc' || dir === 'desc',
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** Scrive lo stato nell'indirizzo omettendo tutto ciò che è predefinito (indirizzi corti e puliti). */
export function writeTableState(state: TableState): URLSearchParams {
  const params = new URLSearchParams();
  const set = (key: string, value: string) => value && params.set(key, value);
  set('q', state.q.trim());
  set('board', state.board);
  set('column', state.column);
  for (const key of Object.keys(LIST_KEYS) as ListKey[]) set(key, state.lists[key].join(','));
  set('from', state.from);
  set('to', state.to);
  set('smin', state.salaryMin);
  set('smax', state.salaryMax);
  set('cur', state.currency);
  set('per', state.period);
  if (state.archived !== 'exclude') params.set('arch', state.archived);
  if (state.sort !== 'updatedAt') params.set('sort', state.sort);
  if (state.dir !== DEFAULT_SORT_DIR[state.sort]) params.set('dir', state.dir);
  if (state.page > 1) params.set('page', String(state.page));
  return params;
}

/** Stato → parametri del contratto. I vuoti sono omessi: l'API tratta assenza e vuoto allo stesso modo. */
export function toApiQuery(
  state: TableState,
  pageSize: number = LIMITS.pageSizeDefault,
): Record<string, string> {
  const query: Record<string, string> = {};
  const set = (key: string, value: string) => value && (query[key] = value);
  set('q', state.q.trim());
  set('boardId', state.board);
  set('columnId', state.column);
  for (const [urlKey, apiKey] of Object.entries(LIST_KEYS) as [ListKey, string][]) {
    set(apiKey, state.lists[urlKey].join(','));
  }
  set('appliedFrom', state.from);
  set('appliedTo', state.to);
  set('salaryMin', state.salaryMin);
  set('salaryMax', state.salaryMax);
  set('currency', state.currency.toUpperCase());
  set('salaryPeriod', state.period);
  query['archived'] = state.archived;
  query['sort'] = state.sort;
  query['dir'] = state.dir;
  query['page'] = String(state.page);
  query['pageSize'] = String(pageSize);
  return query;
}

/** Filtri attivi, per i contrassegni rimovibili e per il contatore (ricerca, ordine e pagina non sono filtri). */
export function activeFilterCount(state: TableState, fixedBoard: boolean): number {
  let count = 0;
  if (state.q.trim()) count++;
  if (!fixedBoard && state.board) count++;
  if (state.column) count++;
  count += Object.values(state.lists).filter((values) => values.length > 0).length;
  if (state.from || state.to) count++;
  if (state.salaryMin || state.salaryMax) count++;
  if (state.archived !== 'exclude') count++;
  return count;
}

/** Stato senza filtri né ricerca; mantiene ordinamento e ambito fisso. */
export function clearFilters(state: TableState, fixedBoard: boolean): TableState {
  return {
    ...readTableState(new URLSearchParams()),
    board: fixedBoard ? state.board : '',
    sort: state.sort,
    dir: state.dir,
    dirExplicit: state.dirExplicit,
  };
}

/** Colonne della tabella. Registro unico: i campi personalizzati potranno aggiungersi qui. */
export interface ColumnDef {
  key: string;
  label: string;
  /** Chiave di ordinamento dell'API, se la colonna è ordinabile. */
  sort?: OpportunitySort;
  /** Visibile in partenza. */
  defaultVisible: boolean;
  /** Non nascondibile (la colonna principale, da cui si apre il dettaglio). */
  locked?: boolean;
}

export const TABLE_COLUMNS: readonly ColumnDef[] = [
  { key: 'title', label: 'Opportunità', sort: 'title', defaultVisible: true, locked: true },
  { key: 'company', label: 'Azienda', sort: 'company', defaultVisible: true },
  { key: 'board', label: 'Bacheca', sort: 'board', defaultVisible: true },
  { key: 'column', label: 'Colonna', sort: 'column', defaultVisible: true },
  { key: 'priority', label: 'Priorità', sort: 'priority', defaultVisible: true },
  { key: 'location', label: 'Località', sort: 'location', defaultVisible: false },
  { key: 'workMode', label: 'Modalità', sort: 'workMode', defaultVisible: false },
  { key: 'contractType', label: 'Contratto', sort: 'contractType', defaultVisible: false },
  { key: 'salary', label: 'Retribuzione', defaultVisible: false },
  { key: 'stage', label: 'Fase', sort: 'stage', defaultVisible: true },
  { key: 'outcome', label: 'Esito', sort: 'outcome', defaultVisible: true },
  { key: 'labels', label: 'Etichette', defaultVisible: false },
  { key: 'appliedOn', label: 'Candidatura', sort: 'appliedOn', defaultVisible: true },
  { key: 'updatedAt', label: 'Ultima modifica', sort: 'updatedAt', defaultVisible: true },
];

export const COLUMNS_STORAGE_KEY = 'mr.table.columns.v1';

/** Colonne nascoste lette dalla preferenza locale; un contenuto non valido torna ai predefiniti. */
export function parseHiddenColumns(raw: string | null): Set<string> {
  const defaults = new Set(TABLE_COLUMNS.filter((c) => !c.defaultVisible).map((c) => c.key));
  if (raw === null) return defaults;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return defaults;
    const known = new Set(TABLE_COLUMNS.filter((c) => !c.locked).map((c) => c.key));
    return new Set(value.filter((key): key is string => typeof key === 'string' && known.has(key)));
  } catch {
    return defaults;
  }
}
