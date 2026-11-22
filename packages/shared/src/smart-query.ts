import { CONTRACT_TYPES, OUTCOMES, PRIORITIES, STAGES, WORK_MODES } from './constants';
import {
  DATE_OFFSET_MAX,
  isValidDateFilter,
  PERIODIC_PRESETS,
  resolveDateFilter,
  type DateFilter,
} from './date-period';
import { addDays, isCalendarDate, startOfLocalDay } from './tasks';
import { foldKey } from './text-fold';

/**
 * Motore di query v2 (M5-SW.3): UNA definizione tipizzata e serializzabile dei filtri, valutata
 * con la stessa semantica in memoria (Kanban, `compileQuery`) e sul server (Tabella, compilatore
 * SQL in `apps/api`). Funzioni pure: nessun I/O, nessuna lettura dell'orologio («oggi» e il fuso
 * del workspace sono sempre argomenti) e nessuna mutazione degli argomenti.
 *
 * ## Struttura
 * `{ v: 2, where?: nodo, sort?: [{ field, dir }] }`. Un nodo è una CONDIZIONE
 * `{ field, op, value? }` oppure un GRUPPO `{ op: 'and' | 'or', items: [nodo, …] }`.
 *
 * ## Semantica (contratto condiviso dai due valutatori)
 * - Campo mancante (`null`): ogni operatore POSITIVO (`in`, `equals_any`, `contains`, `has_*`,
 *   `in_period`) è falso. Ogni operatore NEGATIVO (`not_in`, `not_equals_any`, `not_contains`,
 *   `has_none`, `not_in_period`) è VERO: «non è nessuno di questi» vale anche per chi non ha nulla.
 *   `is_empty` / `is_not_empty` verificano la presenza esplicitamente.
 * - Testo «vuoto»: `null` oppure fatto solo di spazi (U+0020).
 * - Valore sconosciuto (fuori vocabolario, nei dati): è un valore come gli altri; non coincide con
 *   nessun valore ammesso dalla query, quindi non soddisfa `in` e soddisfa `not_in`. Un'etichetta
 *   inesistente non corrisponde a nessuna scheda (`has_any`/`has_all` falsi, `has_none` vero).
 * - Testi: confronto con `foldKey` (accenti latini, ASCII minuscolo, spazi) — vedi `text-fold.ts`.
 *   `equals_any` è uguaglianza della chiave intera; `contains` è sottostringa della chiave.
 * - Date di calendario (`applied`): giorni `YYYY-MM-DD` senza fuso; una data non valida nei dati
 *   si comporta come mancante. Istanti (`created`, `updated`): si confrontano con i confini dei
 *   giorni locali del workspace, convertiti in istanti (inizio incluso, fine ESCLUSA).
 * - Gruppi: `and` = tutti, `or` = almeno uno. I gruppi vuoti non esistono (la validazione li
 *   rifiuta; la normalizzazione li toglie).
 * - Ordinamento: valori mancanti o sconosciuti SEMPRE in fondo, qualunque sia la direzione; testi
 *   senza distinzione di maiuscole ASCII e in ordine di punto di codice; a parità decide `id`.
 */

export const SMART_QUERY_VERSION = 2 as const;

export const SMART_QUERY_LIMITS = {
  /** Gruppi annidati (la radice, se è un gruppo, vale 1). */
  maxDepth: 4,
  maxConditions: 30,
  maxTextValues: 30,
  maxTags: 20,
  textMax: 120,
  maxSorts: 3,
  /**
   * Parametri legati consentiti alla sola query. D1 ne ammette 100 per istruzione: il resto
   * (workspace, bacheca, colonna, parole, retribuzione, pagina) occupa al più 20.
   */
  maxBindParams: 64,
} as const;

// ---------------------------------------------------------------------------
// Campi e operatori (insiemi CHIUSI: nessun nome arriva dall'esterno senza essere in questa tabella)
// ---------------------------------------------------------------------------

type FieldSpec =
  | { kind: 'enum'; values: readonly string[]; nullable: boolean }
  | { kind: 'text' }
  | { kind: 'tags' }
  | { kind: 'instant' }
  | { kind: 'day' };

export const QUERY_FIELDS = {
  stage: { kind: 'enum', values: STAGES, nullable: true },
  outcome: { kind: 'enum', values: OUTCOMES, nullable: true },
  priority: { kind: 'enum', values: PRIORITIES, nullable: false },
  workMode: { kind: 'enum', values: WORK_MODES, nullable: true },
  contractType: { kind: 'enum', values: CONTRACT_TYPES, nullable: true },
  company: { kind: 'text' },
  location: { kind: 'text' },
  labelIds: { kind: 'tags' },
  created: { kind: 'instant' },
  updated: { kind: 'instant' },
  applied: { kind: 'day' },
} as const satisfies Record<string, FieldSpec>;
export type QueryField = keyof typeof QUERY_FIELDS;
export const QUERY_FIELD_NAMES = Object.keys(QUERY_FIELDS) as QueryField[];

export const QUERY_OPERATORS = [
  'in',
  'not_in',
  'equals_any',
  'not_equals_any',
  'contains',
  'not_contains',
  'has_any',
  'has_all',
  'has_none',
  'in_period',
  'not_in_period',
  'is_empty',
  'is_not_empty',
] as const;
export type QueryOperator = (typeof QUERY_OPERATORS)[number];

const OPERATORS_BY_KIND = {
  enum: ['in', 'not_in'],
  text: ['equals_any', 'not_equals_any', 'contains', 'not_contains', 'is_empty', 'is_not_empty'],
  tags: ['has_any', 'has_all', 'has_none', 'is_empty', 'is_not_empty'],
  instant: ['in_period', 'not_in_period'],
  day: ['in_period', 'not_in_period', 'is_empty', 'is_not_empty'],
} as const satisfies Record<FieldSpec['kind'], readonly QueryOperator[]>;

function spec(field: string): FieldSpec | undefined {
  return Object.hasOwn(QUERY_FIELDS, field) ? QUERY_FIELDS[field as QueryField] : undefined;
}

/** Operatori ammessi per un campo (gli enum nullable ammettono anche `is_empty`). */
export function allowedOperators(field: QueryField): readonly QueryOperator[] {
  const s: FieldSpec = QUERY_FIELDS[field];
  const base: readonly QueryOperator[] = OPERATORS_BY_KIND[s.kind];
  return s.kind === 'enum' && s.nullable ? [...base, 'is_empty', 'is_not_empty'] : base;
}

/** Chiavi di ordinamento ammesse (insieme chiuso, mappato su espressioni costanti dal server). */
export const QUERY_SORT_KEYS = [
  'title',
  'company',
  'board',
  'column',
  'priority',
  'location',
  'workMode',
  'contractType',
  'stage',
  'outcome',
  'appliedOn',
  'updatedAt',
  'createdAt',
] as const;
export type QuerySortKey = (typeof QUERY_SORT_KEYS)[number];

/** Ordine predefinito per chiave: le date e la priorità partono dal più recente/importante. */
export const QUERY_SORT_DEFAULT_DIR: Record<QuerySortKey, 'asc' | 'desc'> = {
  title: 'asc',
  company: 'asc',
  board: 'asc',
  column: 'asc',
  priority: 'desc',
  location: 'asc',
  workMode: 'asc',
  contractType: 'asc',
  stage: 'asc',
  outcome: 'asc',
  appliedOn: 'desc',
  updatedAt: 'desc',
  createdAt: 'desc',
};

/** Chiavi con vocabolario ordinato: il rango è la posizione nel vocabolario. */
export const QUERY_SORT_RANKS: Partial<Record<QuerySortKey, readonly string[]>> = {
  priority: PRIORITIES,
  workMode: WORK_MODES,
  contractType: CONTRACT_TYPES,
  stage: STAGES,
  outcome: OUTCOMES,
};

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

export interface QueryCondition {
  field: QueryField;
  op: QueryOperator;
  /** Assente per `is_empty` / `is_not_empty`; stringa per `contains`; periodo per `*_period`. */
  value?: string | string[] | DateFilter;
}
export interface QueryGroup {
  op: 'and' | 'or';
  items: QueryNode[];
}
export type QueryNode = QueryCondition | QueryGroup;
export interface QuerySort {
  field: QuerySortKey;
  dir: 'asc' | 'desc';
}
export interface SmartQuery {
  v: typeof SMART_QUERY_VERSION;
  where?: QueryNode;
  sort?: QuerySort[];
}

export const EMPTY_SMART_QUERY: SmartQuery = Object.freeze({ v: SMART_QUERY_VERSION });

export const isGroup = (node: QueryNode): node is QueryGroup => 'items' in node;

/**
 * «Uno di questi valori, oppure non indicato»: i vecchi formati usano il valore speciale
 * `emptyToken` (`none`) per il campo mancante; qui diventa l'operatore esplicito `is_empty`.
 */
export function inOrEmpty(
  field: QueryField,
  values: readonly string[],
  emptyToken: string,
): QueryNode {
  const real = values.filter((value) => value !== emptyToken);
  const parts: QueryNode[] = [];
  if (real.length > 0) parts.push({ field, op: 'in', value: [...real] });
  if (values.includes(emptyToken)) parts.push({ field, op: 'is_empty' });
  return parts.length === 1 ? parts[0]! : { op: 'or', items: parts };
}

/** Contesto di valutazione: data locale del workspace e suo fuso IANA. */
export interface QueryContext {
  today: string;
  timeZone: string;
}

/** Proiezione di una scheda su cui lavora il valutatore; i campi di ordinamento sono facoltativi. */
export interface QueryableItem {
  createdAt: number;
  updatedAt: number;
  appliedOn: string | null;
  stage: string | null;
  outcome?: string | null | undefined;
  company: string | null;
  priority: string;
  workMode: string | null;
  contractType: string | null;
  labelIds: readonly string[];
  location: string | null;
  id?: string | undefined;
  title?: string | null | undefined;
  boardName?: string | null | undefined;
  columnName?: string | null | undefined;
}

export interface QueryIssue {
  path: string;
  message: string;
}

export class SmartQueryError extends Error {
  constructor(readonly issues: readonly QueryIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
    this.name = 'SmartQueryError';
  }
}

// ---------------------------------------------------------------------------
// Controllo di una condizione (UNICA fonte delle regole, usata da validazione e normalizzazione)
// ---------------------------------------------------------------------------

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).every((key) => keys.includes(key));

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Filtro-data in forma canonica oppure il motivo per cui non è valido. */
function readDateFilter(
  value: unknown,
): { ok: true; filter: DateFilter } | { ok: false; why: string } {
  if (!isRecord(value)) return { ok: false, why: 'Periodo non valido' };
  if (value['preset'] === 'custom') {
    if (!hasOnlyKeys(value, ['preset', 'from', 'to']))
      return { ok: false, why: 'Campi non ammessi' };
    const bound = (raw: unknown) =>
      raw === undefined || raw === null
        ? null
        : typeof raw === 'string' && DAY.test(raw)
          ? raw
          : false;
    const from = bound(value['from']);
    const to = bound(value['to']);
    if (from === false || to === false) return { ok: false, why: 'Data non valida' };
    const filter: DateFilter = { preset: 'custom', from, to };
    return isValidDateFilter(filter)
      ? { ok: true, filter }
      : {
          ok: false,
          why: 'Indica almeno una data; la data iniziale non può seguire quella finale',
        };
  }
  const preset = (PERIODIC_PRESETS as readonly unknown[]).find((p) => p === value['preset']);
  if (!preset || !hasOnlyKeys(value, ['preset', 'offset']))
    return { ok: false, why: 'Periodo non valido' };
  const offset = value['offset'] === undefined ? 0 : value['offset'];
  if (
    typeof offset !== 'number' ||
    !Number.isInteger(offset) ||
    offset > 0 ||
    offset < -DATE_OFFSET_MAX
  )
    return { ok: false, why: 'Spostamento del periodo non valido' };
  return { ok: true, filter: { preset: preset as DateFilter['preset'], offset } as DateFilter };
}

type ConditionResult = { ok: true; condition: QueryCondition } | { ok: false; why: string };

/**
 * Condizione valida in forma canonica (valori rifilati, senza duplicati, in ordine stabile) oppure
 * il motivo del rifiuto. `strict` rifiuta i duplicati; altrimenti li elimina.
 */
function checkCondition(raw: unknown, strict: boolean): ConditionResult {
  if (!isRecord(raw)) return { ok: false, why: 'Condizione non valida' };
  if (!hasOnlyKeys(raw, ['field', 'op', 'value'])) return { ok: false, why: 'Campi non ammessi' };
  const { field, op, value } = raw;
  if (typeof field !== 'string') return { ok: false, why: 'Campo non ammesso' };
  const fieldSpec = spec(field);
  if (!fieldSpec) return { ok: false, why: 'Campo non ammesso' };
  if (
    typeof op !== 'string' ||
    !(allowedOperators(field as QueryField) as readonly string[]).includes(op)
  )
    return { ok: false, why: 'Operatore non ammesso per questo campo' };
  const name = field as QueryField;
  const operator = op as QueryOperator;
  const make = (v?: QueryCondition['value']): ConditionResult => ({
    ok: true,
    condition:
      v === undefined ? { field: name, op: operator } : { field: name, op: operator, value: v },
  });
  /** Elenco di stringhe: in modo stretto un eccesso è un errore, altrimenti si taglia al massimo. */
  const array = (max: number, keep: (item: string) => boolean = () => true): string[] | string => {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
      return 'Elenco non valido';
    let list = value as string[];
    if (!strict) list = list.filter(keep);
    if (list.length < 1) return 'Indica almeno un valore';
    if (list.length > max) {
      if (strict) return `Al massimo ${max} valori`;
      list = list.slice(0, max);
    }
    return list;
  };

  switch (operator) {
    case 'is_empty':
    case 'is_not_empty':
      return value === undefined ? make() : { ok: false, why: 'Questo operatore non ha un valore' };
    case 'in':
    case 'not_in': {
      const vocabulary = (fieldSpec as Extract<FieldSpec, { kind: 'enum' }>).values;
      const list = array(vocabulary.length, (item) => vocabulary.includes(item));
      if (typeof list === 'string') return { ok: false, why: list };
      if (list.some((item) => !vocabulary.includes(item)))
        return { ok: false, why: 'Valore fuori vocabolario' };
      if (new Set(list).size !== list.length && strict)
        return { ok: false, why: 'Valori duplicati' };
      return make(vocabulary.filter((item) => list.includes(item)));
    }
    case 'equals_any':
    case 'not_equals_any': {
      const list = array(SMART_QUERY_LIMITS.maxTextValues);
      if (typeof list === 'string') return { ok: false, why: list };
      const byKey = new Map<string, string>();
      for (const item of list) {
        const text = item.trim();
        if (text.length === 0 || text.length > SMART_QUERY_LIMITS.textMax)
          return {
            ok: false,
            why: `Ogni valore deve avere da 1 a ${SMART_QUERY_LIMITS.textMax} caratteri`,
          };
        const key = foldKey(text);
        if (key === '') return { ok: false, why: 'Valore vuoto' };
        if (byKey.has(key) && strict) return { ok: false, why: 'Valori duplicati' };
        const prior = byKey.get(key);
        if (prior === undefined || text < prior) byKey.set(key, text);
      }
      return make(
        [...byKey.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, t]) => t),
      );
    }
    case 'contains':
    case 'not_contains': {
      if (typeof value !== 'string') return { ok: false, why: 'Indica il testo da cercare' };
      const text = value.trim();
      if (text.length === 0 || text.length > SMART_QUERY_LIMITS.textMax)
        return {
          ok: false,
          why: `Il testo deve avere da 1 a ${SMART_QUERY_LIMITS.textMax} caratteri`,
        };
      return foldKey(text) === '' ? { ok: false, why: 'Testo vuoto' } : make(text);
    }
    case 'has_any':
    case 'has_all':
    case 'has_none': {
      const list = array(SMART_QUERY_LIMITS.maxTags, (item) => ID_RE.test(item));
      if (typeof list === 'string') return { ok: false, why: list };
      if (list.some((item) => !ID_RE.test(item)))
        return { ok: false, why: 'Identificativo non valido' };
      if (new Set(list).size !== list.length && strict)
        return { ok: false, why: 'Valori duplicati' };
      return make([...new Set(list)].sort());
    }
    case 'in_period':
    case 'not_in_period': {
      const read = readDateFilter(value);
      return read.ok ? make(read.filter) : { ok: false, why: read.why };
    }
  }
}

// ---------------------------------------------------------------------------
// Normalizzazione (forma canonica, deterministica e idempotente)
// ---------------------------------------------------------------------------

const keyOf = (node: QueryNode) => JSON.stringify(node);

function normalizeNode(node: unknown): QueryNode | null {
  if (!isRecord(node)) return null;
  if ('items' in node) {
    if (node['op'] !== 'and' && node['op'] !== 'or') return null;
    const op = node['op'];
    const items = Array.isArray(node['items']) ? (node['items'] as unknown[]) : [];
    const children = new Map<string, QueryNode>();
    for (const item of items) {
      const child = normalizeNode(item);
      if (!child) continue;
      for (const part of isGroup(child) && child.op === op ? child.items : [child])
        children.set(keyOf(part), part);
    }
    const sorted = [...children.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    if (sorted.length === 0) return null;
    if (sorted.length === 1) return sorted[0]![1];
    return { op, items: sorted.map(([, child]) => child) };
  }
  const result = checkCondition(node, false);
  return result.ok ? result.condition : null;
}

/**
 * Forma canonica: toglie condizioni e gruppi vuoti o non validi, duplicati e valori fuori
 * vocabolario; ordina valori e operandi; appiattisce gruppi dello stesso tipo e scarta i gruppi
 * con un solo elemento. Due query equivalenti per struttura hanno la stessa forma (e quindi la
 * stessa serializzazione). Non lancia mai; non verifica i limiti (vedi `queryLimitIssues`).
 */
export function normalizeSmartQuery(query: SmartQuery): SmartQuery {
  const out: SmartQuery = { v: SMART_QUERY_VERSION };
  const where = query.where === undefined ? null : normalizeNode(query.where);
  if (where) out.where = where;
  const sort = normalizeSort(query.sort);
  if (sort.length > 0) out.sort = sort;
  return out;
}

function normalizeSort(sort: readonly unknown[] | undefined): QuerySort[] {
  const seen = new Set<string>();
  const out: QuerySort[] = [];
  for (const entry of sort ?? []) {
    if (!isRecord(entry)) continue;
    const field = (QUERY_SORT_KEYS as readonly unknown[]).find((k) => k === entry['field']) as
      QuerySortKey | undefined;
    if (!field || seen.has(field)) continue;
    const dir = entry['dir'] === 'asc' || entry['dir'] === 'desc' ? entry['dir'] : null;
    if (!dir) continue;
    seen.add(field);
    out.push({ field, dir });
  }
  return out.slice(0, SMART_QUERY_LIMITS.maxSorts);
}

/**
 * Identità SEMANTICA della query: la forma canonica con i testi ridotti alla chiave di confronto.
 * Due query che filtrano allo stesso modo (es. «ACME» e «acme») hanno la stessa identità; serve a
 * chiavi di cache e a riconoscere viste duplicate.
 */
export function smartQueryKey(query: SmartQuery): string {
  const fold = (node: QueryNode): QueryNode => {
    if (isGroup(node)) return { op: node.op, items: node.items.map(fold) };
    if (node.op === 'contains' || node.op === 'not_contains')
      return { ...node, value: foldKey(node.value as string) };
    if (node.op === 'equals_any' || node.op === 'not_equals_any')
      return { ...node, value: (node.value as string[]).map(foldKey) };
    return node;
  };
  const normalized = normalizeSmartQuery(query);
  return JSON.stringify({
    v: normalized.v,
    ...(normalized.where ? { where: fold(normalized.where) } : {}),
    ...(normalized.sort ? { sort: normalized.sort } : {}),
  });
}

export const isSmartQueryActive = (query: SmartQuery) =>
  normalizeSmartQuery(query).where !== undefined;

/** Combina due query in AND (i filtri si restringono; l'ordinamento è quello del primo che ne ha uno). */
export function andQueries(...queries: SmartQuery[]): SmartQuery {
  const wheres = queries.flatMap((q) => (q.where ? [q.where] : []));
  const sort = queries.find((q) => q.sort && q.sort.length > 0)?.sort;
  return normalizeSmartQuery({
    v: SMART_QUERY_VERSION,
    ...(wheres.length > 0 ? { where: { op: 'and' as const, items: wheres } } : {}),
    ...(sort ? { sort } : {}),
  });
}

// ---------------------------------------------------------------------------
// Limiti di complessità
// ---------------------------------------------------------------------------

/** Parametri legati che il compilatore SQL usa per una condizione (stima per eccesso per i periodi). */
export function conditionBindCount(condition: QueryCondition): number {
  switch (condition.op) {
    case 'is_empty':
    case 'is_not_empty':
      return 0;
    case 'contains':
    case 'not_contains':
      return 1;
    case 'in_period':
    case 'not_in_period':
      return 2;
    case 'has_all':
      return (condition.value as string[]).length + 1;
    default:
      return (condition.value as string[]).length;
  }
}

export interface QueryStats {
  depth: number;
  conditions: number;
  bindParams: number;
}

export function queryStats(query: SmartQuery): QueryStats {
  const walk = (node: QueryNode): QueryStats => {
    if (!isGroup(node)) return { depth: 0, conditions: 1, bindParams: conditionBindCount(node) };
    const children = node.items.map(walk);
    return {
      depth: 1 + Math.max(0, ...children.map((child) => child.depth)),
      conditions: children.reduce((sum, child) => sum + child.conditions, 0),
      bindParams: children.reduce((sum, child) => sum + child.bindParams, 0),
    };
  };
  return query.where ? walk(query.where) : { depth: 0, conditions: 0, bindParams: 0 };
}

/** Violazioni dei limiti di profondità, numero di condizioni e parametri legati. */
export function queryLimitIssues(query: SmartQuery): QueryIssue[] {
  const stats = queryStats(query);
  const issues: QueryIssue[] = [];
  const L = SMART_QUERY_LIMITS;
  if (stats.depth > L.maxDepth)
    issues.push({ path: 'where', message: `Troppi gruppi annidati (massimo ${L.maxDepth})` });
  if (stats.conditions > L.maxConditions)
    issues.push({ path: 'where', message: `Troppe condizioni (massimo ${L.maxConditions})` });
  if (stats.bindParams > L.maxBindParams)
    issues.push({
      path: 'where',
      message: `Troppi valori complessivi (massimo ${L.maxBindParams})`,
    });
  return issues;
}

// ---------------------------------------------------------------------------
// Validazione STRETTA di un input non fidato (API, viste salvate)
// ---------------------------------------------------------------------------

export type SmartQueryValidation =
  { ok: true; query: SmartQuery } | { ok: false; issues: QueryIssue[] };

/**
 * Valida un input sconosciuto: chiavi non previste, operatori non ammessi per il campo, valori
 * fuori vocabolario, gruppi vuoti, duplicati e superamento dei limiti sono errori con il loro
 * percorso. L'esito è la query in forma canonica. Non lancia e il lavoro è limitato: i controlli
 * di profondità e dimensione avvengono PRIMA di scendere nell'albero.
 */
export function validateSmartQuery(input: unknown): SmartQueryValidation {
  const issues: QueryIssue[] = [];
  const fail = (path: string, message: string) => {
    if (issues.length < 20) issues.push({ path, message });
  };
  if (!isRecord(input))
    return { ok: false, issues: [{ path: '(query)', message: 'Query non valida' }] };
  for (const key of Object.keys(input))
    if (!['v', 'where', 'sort'].includes(key)) fail(key, 'Campo non ammesso');
  if (input['v'] !== SMART_QUERY_VERSION)
    fail('v', `La versione deve essere ${SMART_QUERY_VERSION}`);

  let nodes = 0;
  const L = SMART_QUERY_LIMITS;
  /** Tetto al lavoro su un input ostile: una query valida ha al più ~60 nodi. */
  const MAX_RAW_NODES = 120;
  const visit = (raw: unknown, path: string, depth: number): QueryNode | null => {
    if (++nodes > MAX_RAW_NODES) {
      if (nodes === MAX_RAW_NODES + 1) fail(path, 'Query troppo grande');
      return null;
    }
    if (isRecord(raw) && 'items' in raw) {
      if (depth > L.maxDepth) {
        fail(path, `Troppi gruppi annidati (massimo ${L.maxDepth})`);
        return null;
      }
      if (!hasOnlyKeys(raw, ['op', 'items'])) fail(path, 'Campi non ammessi');
      if (raw['op'] !== 'and' && raw['op'] !== 'or')
        fail(`${path}.op`, "L'operatore deve essere and oppure or");
      const items = raw['items'];
      if (!Array.isArray(items) || items.length === 0) {
        fail(`${path}.items`, 'Un gruppo deve contenere almeno un elemento');
        return null;
      }
      if (items.length > L.maxConditions) {
        fail(`${path}.items`, `Al massimo ${L.maxConditions} elementi per gruppo`);
        return null;
      }
      const children = items.map((item, index) => visit(item, `${path}.items.${index}`, depth + 1));
      if (children.some((child) => child === null) || (raw['op'] !== 'and' && raw['op'] !== 'or'))
        return null;
      return { op: raw['op'], items: children as QueryNode[] };
    }
    const result = checkCondition(raw, true);
    if (!result.ok) {
      fail(path, result.why);
      return null;
    }
    return result.condition;
  };

  let where: QueryNode | null = null;
  if (input['where'] !== undefined) where = visit(input['where'], 'where', 1);

  const sort: QuerySort[] = [];
  if (input['sort'] !== undefined) {
    const raw = input['sort'];
    if (!Array.isArray(raw)) fail('sort', 'Elenco di ordinamenti non valido');
    else if (raw.length > L.maxSorts) fail('sort', `Al massimo ${L.maxSorts} ordinamenti`);
    else {
      const seen = new Set<string>();
      raw.forEach((entry, index) => {
        const path = `sort.${index}`;
        if (!isRecord(entry) || !hasOnlyKeys(entry, ['field', 'dir']))
          return fail(path, 'Ordinamento non valido');
        const field = (QUERY_SORT_KEYS as readonly unknown[]).find((k) => k === entry['field']) as
          QuerySortKey | undefined;
        if (!field) return fail(`${path}.field`, 'Chiave di ordinamento non ammessa');
        if (entry['dir'] !== 'asc' && entry['dir'] !== 'desc')
          return fail(`${path}.dir`, 'Direzione non valida');
        if (seen.has(field)) return fail(`${path}.field`, 'Chiave di ordinamento duplicata');
        seen.add(field);
        sort.push({ field, dir: entry['dir'] });
      });
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  const query = normalizeSmartQuery({
    v: SMART_QUERY_VERSION,
    ...(where ? { where } : {}),
    ...(sort.length > 0 ? { sort } : {}),
  });
  // I limiti si controllano sull'input così come è stato scritto (più restrittivi, e O(dimensione)).
  const raw: SmartQuery = { v: SMART_QUERY_VERSION, ...(where ? { where } : {}) };
  const limitIssues = queryLimitIssues(raw);
  return limitIssues.length > 0 ? { ok: false, issues: limitIssues } : { ok: true, query };
}

// ---------------------------------------------------------------------------
// Periodi → istanti (confini dei giorni locali del workspace)
// ---------------------------------------------------------------------------

/** Intervallo di istanti (ms UTC): `from` incluso, `to` ESCLUSO; `null` = illimitato. */
export interface InstantRange {
  from: number | null;
  to: number | null;
}

/**
 * Giorni di calendario → istanti: inizio del primo giorno locale (incluso) e inizio di quello
 * successivo all'ultimo (escluso). È l'UNICA conversione usata dai due valutatori, quindi ora
 * legale e fusi non possono farli divergere; i test la confrontano con `localDate`.
 */
export function dateFilterToInstants(filter: DateFilter, context: QueryContext): InstantRange {
  const range = resolveDateFilter(filter, context.today);
  const edge = (day: string | null, shift: number): number | null => {
    if (day === null) return null;
    try {
      return startOfLocalDay(shift === 0 ? day : addDays(day, shift), context.timeZone);
    } catch {
      return null; // oltre il calendario rappresentabile: nessun limite pratico
    }
  };
  return { from: edge(range.from, 0), to: edge(range.to, 1) };
}

// ---------------------------------------------------------------------------
// Valutatore in memoria
// ---------------------------------------------------------------------------

export type QueryPredicate<T extends QueryableItem = QueryableItem> = (item: T) => boolean;

const BLANK = /^ *$/;

function compileCondition(condition: QueryCondition, context: QueryContext): QueryPredicate {
  const { field, op } = condition;
  const kind = QUERY_FIELDS[field].kind;

  if (kind === 'tags') {
    const ids = new Set(condition.value as string[] | undefined);
    const read = (item: QueryableItem) => item.labelIds;
    switch (op) {
      case 'has_any':
        return (item) => read(item).some((id) => ids.has(id));
      case 'has_all':
        return (item) => {
          const own = new Set(read(item));
          return [...ids].every((id) => own.has(id));
        };
      case 'has_none':
        return (item) => !read(item).some((id) => ids.has(id));
      case 'is_empty':
        return (item) => read(item).length === 0;
      default:
        return (item) => read(item).length > 0;
    }
  }

  if (kind === 'enum') {
    const read = (item: QueryableItem): string | null => item[field as 'stage'] ?? null;
    const set = new Set(condition.value as string[] | undefined);
    switch (op) {
      case 'in':
        return (item) => {
          const value = read(item);
          return value !== null && set.has(value);
        };
      case 'not_in':
        return (item) => {
          const value = read(item);
          return value === null || !set.has(value);
        };
      case 'is_empty':
        return (item) => read(item) === null;
      default:
        return (item) => read(item) !== null;
    }
  }

  if (kind === 'text') {
    const read = (item: QueryableItem): string | null => item[field as 'company'] ?? null;
    const keys = new Set((Array.isArray(condition.value) ? condition.value : []).map(foldKey));
    const needle = typeof condition.value === 'string' ? foldKey(condition.value) : '';
    switch (op) {
      case 'equals_any':
        return (item) => {
          const value = read(item);
          return value !== null && keys.has(foldKey(value));
        };
      case 'not_equals_any':
        return (item) => {
          const value = read(item);
          return value === null || !keys.has(foldKey(value));
        };
      case 'contains':
        return (item) => {
          const value = read(item);
          return value !== null && foldKey(value).includes(needle);
        };
      case 'not_contains':
        return (item) => {
          const value = read(item);
          return value === null || !foldKey(value).includes(needle);
        };
      case 'is_empty':
        return (item) => {
          const value = read(item);
          return value === null || BLANK.test(value);
        };
      default:
        return (item) => {
          const value = read(item);
          return value !== null && !BLANK.test(value);
        };
    }
  }

  if (kind === 'instant') {
    const range = dateFilterToInstants(condition.value as DateFilter, context);
    const read = (item: QueryableItem) => (field === 'created' ? item.createdAt : item.updatedAt);
    const inside = (ms: number) =>
      (range.from === null || ms >= range.from) && (range.to === null || ms < range.to);
    return op === 'in_period' ? (item) => inside(read(item)) : (item) => !inside(read(item));
  }

  // kind === 'day' (data di calendario)
  const read = (item: QueryableItem) => item.appliedOn;
  if (op === 'is_empty') return (item) => read(item) === null;
  if (op === 'is_not_empty') return (item) => read(item) !== null;
  const range = resolveDateFilter(condition.value as DateFilter, context.today);
  const inside = (day: string | null) =>
    day !== null &&
    isCalendarDate(day) &&
    (range.from === null || day >= range.from) &&
    (range.to === null || day <= range.to);
  return op === 'in_period' ? (item) => inside(read(item)) : (item) => !inside(read(item));
}

function compileNode(node: QueryNode, context: QueryContext): QueryPredicate {
  if (!isGroup(node)) return compileCondition(node, context);
  const tests = node.items.map((item) => compileNode(item, context));
  return node.op === 'and'
    ? (item) => tests.every((test) => test(item))
    : (item) => tests.some((test) => test(item));
}

/**
 * Compila la query in un predicato: periodi, insiemi e testi sono calcolati UNA volta. Lancia
 * `SmartQueryError` se la query supera i limiti di complessità; una query senza filtri è sempre vera.
 */
export function compileQuery(query: SmartQuery, context: QueryContext): QueryPredicate {
  const normalized = normalizeSmartQuery(query);
  const issues = queryLimitIssues(normalized);
  if (issues.length > 0) throw new SmartQueryError(issues);
  return normalized.where ? compileNode(normalized.where, context) : () => true;
}

/**
 * Elementi che soddisfano la query, nello stesso ordine di ingresso; senza filtri restituisce lo
 * STESSO array (identità stabile per i memo). Non modifica né copia gli elementi.
 */
export function applyQuery<T extends QueryableItem>(
  items: readonly T[],
  query: SmartQuery,
  context: QueryContext,
): readonly T[] {
  if (!isSmartQueryActive(query)) return items;
  const matches = compileQuery(query, context);
  return items.filter(matches);
}

// ---------------------------------------------------------------------------
// Ordinamento (stessa semantica di ORDER BY del server)
// ---------------------------------------------------------------------------

const lowerAscii = (value: string) => value.replace(/[A-Z]+/g, (run) => run.toLowerCase());

/** Ordine per punto di codice (coincide con l'ordine dei byte UTF-8 che usa SQLite). */
function compareCodePoints(a: string, b: string): number {
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const x = a.codePointAt(i)!;
    const y = b.codePointAt(j)!;
    if (x !== y) return x < y ? -1 : 1;
    i += x > 0xffff ? 2 : 1;
    j += y > 0xffff ? 2 : 1;
  }
  if (i < a.length) return 1;
  return j < b.length ? -1 : 0;
}

type SortValue = { kind: 'text'; value: string } | { kind: 'number'; value: number } | null;

function sortValue(item: QueryableItem, key: QuerySortKey): SortValue {
  const text = (value: string | null | undefined): SortValue =>
    value === null || value === undefined ? null : { kind: 'text', value: lowerAscii(value) };
  const ranked = (value: string | null | undefined): SortValue => {
    const rank =
      value === null || value === undefined ? -1 : (QUERY_SORT_RANKS[key] ?? []).indexOf(value);
    return rank < 0 ? null : { kind: 'number', value: rank };
  };
  switch (key) {
    case 'title':
      return text(item.title);
    case 'company':
      return text(item.company);
    case 'location':
      return text(item.location);
    case 'board':
      return text(item.boardName);
    case 'column':
      return text(item.columnName);
    case 'appliedOn':
      return item.appliedOn === null ? null : { kind: 'text', value: item.appliedOn };
    case 'updatedAt':
      return { kind: 'number', value: item.updatedAt };
    case 'createdAt':
      return { kind: 'number', value: item.createdAt };
    case 'priority':
      return ranked(item.priority);
    case 'workMode':
      return ranked(item.workMode);
    case 'contractType':
      return ranked(item.contractType);
    case 'stage':
      return ranked(item.stage);
    case 'outcome':
      return ranked(item.outcome);
  }
}

/**
 * Comparatore per `Array.prototype.sort`. Mancanti e sconosciuti in fondo qualunque sia la
 * direzione; a parità di tutte le chiavi decide `id` (crescente), se presente.
 */
export function compareByQuerySort(
  sort: readonly QuerySort[],
): (a: QueryableItem, b: QueryableItem) => number {
  return (a, b) => {
    for (const { field, dir } of sort) {
      const x = sortValue(a, field);
      const y = sortValue(b, field);
      if (x === null || y === null) {
        if (x === y) continue;
        return x === null ? 1 : -1;
      }
      const order =
        x.kind === 'number' && y.kind === 'number'
          ? x.value - y.value
          : compareCodePoints(String(x.value), String(y.value));
      if (order !== 0) return dir === 'desc' ? -order : order;
    }
    return a.id !== undefined && b.id !== undefined ? compareCodePoints(a.id, b.id) : 0;
  };
}

/** Copia ordinata (non modifica l'ingresso). */
export function sortByQuery<T extends QueryableItem>(
  items: readonly T[],
  sort: readonly QuerySort[],
): T[] {
  return [...items].sort(compareByQuerySort(sort));
}

/**
 * Vero se la valutazione dipende da «oggi» o dal fuso del workspace (istanti `created` / `updated`
 * e periodi relativi). Chi compila la query legge l'orologio solo in questo caso.
 */
export function queryNeedsClock(query: SmartQuery): boolean {
  const visit = (node: QueryNode): boolean =>
    isGroup(node)
      ? node.items.some(visit)
      : QUERY_FIELDS[node.field].kind === 'instant' ||
        ((node.op === 'in_period' || node.op === 'not_in_period') &&
          (node.value as DateFilter).preset !== 'custom');
  return query.where !== undefined && visit(query.where);
}
