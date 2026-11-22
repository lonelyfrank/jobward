import {
  CONTRACT_TYPES,
  PRIORITIES,
  STAGES,
  WORK_MODES,
  type ContractType,
  type Priority,
  type Stage,
  type WorkMode,
} from './constants';
import { DATE_OFFSET_MAX, isValidDateFilter, type DateFilter } from './date-period';
import {
  compileQuery,
  inOrEmpty,
  normalizeSmartQuery,
  SMART_QUERY_VERSION,
  type QueryNode,
  type SmartQuery,
} from './smart-query';
import { foldKey } from './text-fold';

export * from './date-period';

/**
 * Smart Filter (M5-SW.1): filtri della VISTA su un insieme di candidature già in memoria.
 * Funzioni pure: nessun I/O, nessuna lettura dell'orologio («oggi» è sempre un argomento, data
 * locale del workspace) e nessuna mutazione dei dati in ingresso. I filtri non toccano mai le schede.
 *
 * Semantica: AND tra campi diversi, OR tra i valori dello stesso campo. Un valore mancante nella
 * scheda NON soddisfa un filtro positivo sul campo, salvo che si scelga esplicitamente `none`
 * («non indicato») dove il vocabolario lo prevede (fase, modalità, contratto).
 *
 * Dal M5-SW.3 questo è il formato `v:1`, mantenuto per indirizzi e viste già salvate: la sua
 * VALUTAZIONE è delegata al motore di query v2 (`smartFilterToQuery` + `compileQuery`), così
 * Kanban e Tabella condividono un'unica semantica.
 */

export const SMART_FILTER_VERSION = 1 as const;

/** `none` = valore non indicato nella scheda. */
export const NONE = 'none' as const;
export type WithNone<T extends string> = T | typeof NONE;

export const SMART_FILTER_LIMITS = {
  /** Quanti periodi indietro si può navigare (≈ 100 anni di mesi). */
  maxOffset: DATE_OFFSET_MAX,
  maxCompanies: 30,
  maxLabels: 20,
  textMax: 120,
} as const;

export interface SmartFilterConfig {
  v: typeof SMART_FILTER_VERSION;
  /** Data di creazione della scheda (giorno locale del workspace). */
  created?: DateFilter;
  /** Data di invio della candidatura (`appliedOn`, giorno di calendario). */
  applied?: DateFilter;
  /** Ultimo aggiornamento della scheda (giorno locale del workspace). */
  updated?: DateFilter;
  stage?: WithNone<Stage>[];
  company?: string[];
  priority?: Priority[];
  workMode?: WithNone<WorkMode>[];
  contractType?: WithNone<ContractType>[];
  labelIds?: string[];
  /** Sottostringa della località, senza distinzione di maiuscole e accenti. */
  location?: string;
}

export const EMPTY_SMART_FILTER: SmartFilterConfig = Object.freeze({ v: SMART_FILTER_VERSION });

/** Proiezione minima di una scheda su cui lavorano i filtri (la `Card` dello schema la soddisfa). */
export interface FilterableCard {
  createdAt: number;
  updatedAt: number;
  appliedOn: string | null;
  stage: Stage | null;
  company: string | null;
  priority: Priority;
  workMode: WorkMode | null;
  contractType: ContractType | null;
  labelIds: readonly string[];
  location: string | null;
}

export interface SmartFilterContext {
  /** Data locale del workspace (`YYYY-MM-DD`). */
  today: string;
  /** Fuso IANA del workspace: serve a trasformare gli istanti UTC in giorni locali. */
  timeZone: string;
}

// ---------------------------------------------------------------------------
// Testo
// ---------------------------------------------------------------------------

/** Minuscolo, senza diacritici e con spazi normalizzati: confronto tollerante, mai fuzzy. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Aziende distinte: due scritture sono la stessa voce se e solo se il filtro le considera uguali
 * (`foldKey`, la stessa chiave del confronto). Così scegliere una voce seleziona sempre tutte le
 * schede che essa rappresenta, anche per le lettere che la normalizzazione limitata non unisce.
 */
export function companyOptions(cards: readonly Pick<FilterableCard, 'company'>[]): string[] {
  const seen = new Map<string, string>();
  for (const { company } of cards) {
    const name = company?.trim();
    if (!name) continue;
    const key = foldKey(name);
    if (!seen.has(key)) seen.set(key, name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
}

// ---------------------------------------------------------------------------
// Configurazione
// ---------------------------------------------------------------------------

const DATE_KEYS = ['created', 'applied', 'updated'] as const;

const unique = <T>(values: readonly T[] | undefined): T[] => [...new Set(values ?? [])];
const inVocabulary = <T extends string>(values: readonly T[], vocabulary: readonly string[]): T[] =>
  unique(values).filter((value) => vocabulary.includes(value));

/**
 * Forma canonica: toglie campi vuoti, duplicati, valori fuori vocabolario e filtri data non
 * validi. È ciò che si confronta, si scrive nell'indirizzo e si salva: due configurazioni
 * equivalenti hanno la stessa forma.
 */
export function normalizeSmartFilter(config: SmartFilterConfig): SmartFilterConfig {
  const out: SmartFilterConfig = { v: SMART_FILTER_VERSION };
  for (const key of DATE_KEYS) {
    const filter = config[key];
    if (filter && isValidDateFilter(filter)) out[key] = filter;
  }
  const stage = inVocabulary(config.stage ?? [], [...STAGES, NONE]);
  if (stage.length) out.stage = stage;
  const company = unique((config.company ?? []).map((c) => c.trim()).filter(Boolean)).slice(
    0,
    SMART_FILTER_LIMITS.maxCompanies,
  );
  if (company.length) out.company = company;
  const priority = inVocabulary(config.priority ?? [], PRIORITIES);
  if (priority.length) out.priority = priority;
  const workMode = inVocabulary(config.workMode ?? [], [...WORK_MODES, NONE]);
  if (workMode.length) out.workMode = workMode;
  const contractType = inVocabulary(config.contractType ?? [], [...CONTRACT_TYPES, NONE]);
  if (contractType.length) out.contractType = contractType;
  const labelIds = unique(config.labelIds).slice(0, SMART_FILTER_LIMITS.maxLabels);
  if (labelIds.length) out.labelIds = labelIds;
  const location = config.location?.trim().slice(0, SMART_FILTER_LIMITS.textMax);
  if (location) out.location = location;
  return out;
}

/** Quanti campi filtrano (ogni campo conta uno, qualunque sia il numero dei suoi valori). */
export function countActiveFilters(config: SmartFilterConfig): number {
  return Object.keys(normalizeSmartFilter(config)).length - 1; // senza `v`
}

export const isSmartFilterActive = (config: SmartFilterConfig) => countActiveFilters(config) > 0;

// ---------------------------------------------------------------------------
// Valutazione
// ---------------------------------------------------------------------------

export type CardPredicate = (card: FilterableCard) => boolean;

/**
 * Converte la configurazione `v:1` nella query v2 equivalente (forma canonica): AND tra i campi,
 * `in` / `equals_any` / `has_any` per i valori dello stesso campo (OR), e `none` («non indicato»)
 * diventa l'operatore esplicito `is_empty` in OR con i valori reali.
 */
export function smartFilterToQuery(config: SmartFilterConfig): SmartQuery {
  const c = normalizeSmartFilter(config);
  const items: QueryNode[] = [];
  const period = (field: 'created' | 'applied' | 'updated', filter: DateFilter | undefined) => {
    if (filter) items.push({ field, op: 'in_period', value: filter });
  };
  period('created', c.created);
  period('applied', c.applied);
  period('updated', c.updated);
  const choice = (
    field: 'stage' | 'workMode' | 'contractType',
    values: readonly string[] | undefined,
  ) => {
    if (values) items.push(inOrEmpty(field, values, NONE));
  };
  choice('stage', c.stage);
  // `none` è una priorità vera («nessuna»), non il campo mancante.
  if (c.priority) items.push({ field: 'priority', op: 'in', value: [...c.priority] });
  choice('workMode', c.workMode);
  choice('contractType', c.contractType);
  if (c.company) items.push({ field: 'company', op: 'equals_any', value: [...c.company] });
  if (c.labelIds) items.push({ field: 'labelIds', op: 'has_any', value: [...c.labelIds] });
  if (c.location) items.push({ field: 'location', op: 'contains', value: c.location });
  return normalizeSmartQuery({
    v: SMART_QUERY_VERSION,
    ...(items.length > 0 ? { where: { op: 'and' as const, items } } : {}),
  });
}

/**
 * Compila la configurazione in un predicato: delega al motore v2 (`smartFilterToQuery` →
 * `compileQuery`), così la semantica è la stessa della Tabella. Periodi, insiemi e testo sono
 * calcolati UNA volta (adatto a migliaia di schede).
 */
export function compileSmartFilter(
  config: SmartFilterConfig,
  context: SmartFilterContext,
): CardPredicate {
  const predicate = compileQuery(smartFilterToQuery(config), context);
  return (card) => predicate(card);
}

/**
 * Schede che soddisfano i filtri, nello stesso ordine di ingresso. Non modifica né copia le
 * schede; senza filtri attivi restituisce lo STESSO array (identità stabile per i memo).
 */
export function applySmartFilter<T extends FilterableCard>(
  cards: readonly T[],
  config: SmartFilterConfig,
  context: SmartFilterContext,
): readonly T[] {
  if (!isSmartFilterActive(config)) return cards;
  const matches = compileSmartFilter(config, context);
  return cards.filter(matches);
}
