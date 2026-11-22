import {
  dateFilterToInstants,
  foldKey,
  FOLD_PAIRS,
  FOLD_SPACE_PASSES,
  isGroup,
  normalizeSmartQuery,
  QUERY_SORT_RANKS,
  queryLimitIssues,
  resolveDateFilter,
  SmartQueryError,
  type DateFilter,
  type QueryCondition,
  type QueryContext,
  type QueryField,
  type QueryNode,
  type QuerySort,
  type QuerySortKey,
  type SmartQuery,
} from '@jobward/shared';

/**
 * Compilatore SQL del motore di query v2 (M5-SW.3): stessa semantica del valutatore in memoria
 * (`compileQuery` in `@jobward/shared`), su D1/SQLite.
 *
 * Sicurezza:
 *  - OGNI valore (testi, identificativi, vocabolari, istanti, date) è un parametro legato `?N`;
 *  - il testo SQL è fatto solo di frammenti COSTANTI: nomi di colonna presi dalle tabelle
 *    `COLUMNS` / `SORT_EXPRESSIONS` (chiavi di un insieme chiuso), operatori scelti da `switch`,
 *    elenchi di segnaposto. Nessun nome di campo o di operatore proviene dall'input;
 *  - il numero di parametri è limitato (`SMART_QUERY_LIMITS.maxBindParams`, D1 ne ammette 100);
 *  - ogni foglia è a due valori (vero/falso, mai NULL), così AND/OR/NOT non dipendono dalla
 *    logica a tre valori di SQL.
 *
 * Le righe derivano da `cards k … LEFT JOIN application_details d`: gli alias sono quelli di
 * `services/opportunities.ts`.
 */

const COLUMNS = {
  stage: 'ca.stage',
  outcome: 'ca.outcome',
  priority: 'k.priority',
  workMode: 'd.work_mode',
  contractType: 'd.contract_type',
  company: 'd.company',
  location: 'd.location',
  created: 'k.created_at',
  updated: 'k.updated_at',
  applied: 'ca.applied_on',
} as const satisfies Record<Exclude<QueryField, 'labelIds'>, string>;

const rank = (column: string, values: readonly string[]) =>
  `CASE ${column} ${values.map((v, i) => `WHEN '${v}' THEN ${i}`).join(' ')} END`;

/** Espressioni di ordinamento per chiave. Valori costanti: nessun frammento viene dall'input. */
const SORT_EXPRESSIONS: Record<QuerySortKey, string> = {
  title: 'k.title COLLATE NOCASE',
  company: 'd.company COLLATE NOCASE',
  board: 'b.name COLLATE NOCASE',
  column: 'c.name COLLATE NOCASE',
  priority: rank('k.priority', QUERY_SORT_RANKS.priority!),
  location: 'd.location COLLATE NOCASE',
  workMode: rank('d.work_mode', QUERY_SORT_RANKS.workMode!),
  contractType: rank('d.contract_type', QUERY_SORT_RANKS.contractType!),
  stage: rank('ca.stage', QUERY_SORT_RANKS.stage!),
  outcome: rank('ca.outcome', QUERY_SORT_RANKS.outcome!),
  appliedOn: 'ca.applied_on',
  updatedAt: 'k.updated_at',
  createdAt: 'k.created_at',
};

/**
 * `ORDER BY`: per ogni chiave i mancanti vanno in fondo qualunque sia la direzione, poi
 * l'identificativo della scheda rende l'ordine totale (pagine disgiunte e ripetibili).
 */
export function compileOrderBy(sort: readonly QuerySort[]): string {
  const terms = sort.map(({ field, dir }) => {
    const expression = SORT_EXPRESSIONS[field];
    return `(${expression} IS NULL), ${expression} ${dir === 'desc' ? 'DESC' : 'ASC'}`;
  });
  return [...terms, 'k.id ASC'].join(', ');
}

/**
 * Chiave di confronto del testo (la stessa funzione di `foldKey`, passo per passo): sostituzioni
 * della tabella condivisa, minuscole ASCII, riduzione degli spazi, rifilatura.
 *
 * D1 ammette alberi di espressione profondi al più 100: la catena di `replace` è PIATTA (un solo
 * livello per coppia, ~57) e i gruppi AND/OR sono bilanciati (`balanced`), così la profondità di
 * una foglia di testo resta ~70 anche dentro query complesse. I test provano il caso peggiore.
 */
function foldKeySql(column: string): string {
  let value = `coalesce(${column}, '')`;
  for (const [accent, base] of FOLD_PAIRS) value = `replace(${value}, '${accent}', '${base}')`;
  value = `lower(${value})`;
  for (let pass = 0; pass < FOLD_SPACE_PASSES; pass++) value = `replace(${value}, '  ', ' ')`;
  return `trim(${value})`;
}

/** Unisce i termini con AND/OR ad albero bilanciato: l'altezza cresce come log2(n), non come n. */
function balanced(parts: readonly string[], joiner: ' AND ' | ' OR '): string {
  if (parts.length === 1) return parts[0]!;
  const middle = Math.ceil(parts.length / 2);
  return `(${balanced(parts.slice(0, middle), joiner)}${joiner}${balanced(parts.slice(middle), joiner)})`;
}

const LABELS = `FROM card_labels cl WHERE cl.card_id = k.id AND cl.workspace_id = k.workspace_id`;

export type Bind = (value: unknown) => string;

function compileCondition(condition: QueryCondition, context: QueryContext, bind: Bind): string {
  const { field, op } = condition;
  const strings = () => (condition.value as string[]).map(bind).join(', ');

  if (field === 'labelIds') {
    switch (op) {
      case 'has_any':
        return `EXISTS (SELECT 1 ${LABELS} AND cl.label_id IN (${strings()}))`;
      case 'has_all': {
        const values = condition.value as string[];
        return `(SELECT count(DISTINCT cl.label_id) ${LABELS} AND cl.label_id IN (${strings()})) = ${bind(values.length)}`;
      }
      case 'has_none':
        return `NOT EXISTS (SELECT 1 ${LABELS} AND cl.label_id IN (${strings()}))`;
      case 'is_empty':
        return `NOT EXISTS (SELECT 1 ${LABELS})`;
      default:
        return `EXISTS (SELECT 1 ${LABELS})`;
    }
  }

  const column = COLUMNS[field];
  if (op === 'is_empty' || op === 'is_not_empty') {
    const text = field === 'company' || field === 'location';
    if (op === 'is_empty')
      return text ? `(${column} IS NULL OR trim(${column}) = '')` : `${column} IS NULL`;
    return text ? `(${column} IS NOT NULL AND trim(${column}) <> '')` : `${column} IS NOT NULL`;
  }

  switch (op) {
    case 'in':
      return `(${column} IS NOT NULL AND ${column} IN (${strings()}))`;
    case 'not_in':
      return `(${column} IS NULL OR ${column} NOT IN (${strings()}))`;
    case 'equals_any':
    case 'not_equals_any': {
      const keys = (condition.value as string[]).map((value) => bind(foldKey(value))).join(', ');
      return op === 'equals_any'
        ? `(${column} IS NOT NULL AND ${foldKeySql(column)} IN (${keys}))`
        : `(${column} IS NULL OR ${foldKeySql(column)} NOT IN (${keys}))`;
    }
    case 'contains':
      return `(${column} IS NOT NULL AND instr(${foldKeySql(column)}, ${bind(foldKey(condition.value as string))}) > 0)`;
    case 'not_contains':
      return `(${column} IS NULL OR instr(${foldKeySql(column)}, ${bind(foldKey(condition.value as string))}) = 0)`;
    case 'in_period':
    case 'not_in_period': {
      const filter = condition.value as DateFilter;
      let inside: string;
      if (field === 'applied') {
        // Giorno di calendario: stringhe `YYYY-MM-DD` confrontabili; una data non valida vale come mancante.
        const range = resolveDateFilter(filter, context.today);
        const parts = [`coalesce(date(${column}) = ${column}, 0)`];
        if (range.from !== null) parts.push(`${column} >= ${bind(range.from)}`);
        if (range.to !== null) parts.push(`${column} <= ${bind(range.to)}`);
        inside = `(${column} IS NOT NULL AND ${parts.join(' AND ')})`;
      } else {
        // Istanti: confini dei giorni locali già convertiti (inizio incluso, fine esclusa).
        const range = dateFilterToInstants(filter, context);
        const parts: string[] = [];
        if (range.from !== null) parts.push(`${column} >= ${bind(range.from)}`);
        if (range.to !== null) parts.push(`${column} < ${bind(range.to)}`);
        inside = parts.length > 0 ? `(${parts.join(' AND ')})` : '1';
      }
      return op === 'in_period' ? inside : `NOT ${inside}`;
    }
    default:
      throw new SmartQueryError([{ path: 'where', message: 'Operatore non supportato' }]);
  }
}

function compileNode(node: QueryNode, context: QueryContext, bind: Bind): string {
  if (!isGroup(node)) return compileCondition(node, context, bind);
  const parts = node.items.map((item) => compileNode(item, context, bind));
  return balanced(parts, node.op === 'and' ? ' AND ' : ' OR ');
}

/**
 * Predicato `WHERE` della query (senza `WHERE`), o `null` se non filtra nulla. `bind` aggiunge un
 * parametro e restituisce il segnaposto; i parametri usati dalla query sono limitati.
 * Lancia `SmartQueryError` se la query supera i limiti di complessità.
 */
export function compileWhere(query: SmartQuery, context: QueryContext, bind: Bind): string | null {
  const normalized = normalizeSmartQuery(query);
  const issues = queryLimitIssues(normalized);
  if (issues.length > 0) throw new SmartQueryError(issues);
  if (!normalized.where) return null;
  return compileNode(normalized.where, context, bind);
}
