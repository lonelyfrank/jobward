import type {
  OpportunitiesQuery,
  OpportunitiesResponse,
  OpportunitySort,
} from '@jobward/schemas';
import { DEFAULT_SORT_DIR } from '@jobward/schemas';
import { CONTRACT_TYPES, OUTCOMES, PRIORITIES, STAGES, WORK_MODES } from '@jobward/shared';
import type { Database } from '@jobward/database';
import { toCard } from './card-rows';
import { summariesForCards, withSummaries } from './interview-summaries';

/**
 * Ricerca server-side sulle opportunità del workspace (M2.3).
 *
 * Sicurezza:
 *  - OGNI valore proveniente dall'utente è un parametro legato (`?N`), mai testo SQL;
 *  - l'unico SQL costruito dinamicamente è fatto di frammenti COSTANTI scelti da insiemi chiusi
 *    (chiavi di ordinamento, direzione, elenchi di ranghi dai vocabolari del codice);
 *  - il workspace è il primo predicato e viene dal middleware, mai dalla query.
 *
 * D1 ammette al massimo 100 parametri legati per istruzione: il contratto limita liste e parole
 * (sotto i 75 nel caso peggiore).
 */

const rank = (column: string, values: readonly string[]) =>
  `CASE ${column} ${values.map((v, i) => `WHEN '${v}' THEN ${i}`).join(' ')} END`;

/** Espressioni di ordinamento per chiave. Valori costanti: nessun frammento viene dall'input. */
const SORT_EXPRESSIONS: Record<OpportunitySort, string> = {
  title: 'k.title COLLATE NOCASE',
  company: 'd.company COLLATE NOCASE',
  board: 'b.name COLLATE NOCASE',
  column: 'c.name COLLATE NOCASE',
  priority: rank('k.priority', PRIORITIES),
  location: 'd.location COLLATE NOCASE',
  workMode: rank('d.work_mode', WORK_MODES),
  contractType: rank('d.contract_type', CONTRACT_TYPES),
  stage: rank('d.stage', STAGES),
  outcome: rank('d.outcome', OUTCOMES),
  appliedOn: 'd.applied_on',
  updatedAt: 'k.updated_at',
  createdAt: 'k.created_at',
};

/** Neutralizza i caratteri jolly di LIKE: la ricerca è per sottostringa letterale. */
const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

const SEARCH_COLUMNS = [
  'k.title',
  'd.company',
  'd.position',
  'k.description',
  'd.location',
  'd.source',
] as const;

interface Row {
  [key: string]: unknown;
}

export async function searchOpportunities(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  query: OpportunitiesQuery,
): Promise<OpportunitiesResponse> {
  const binds: unknown[] = [];
  /** Aggiunge un parametro e restituisce il suo segnaposto numerato. */
  const bind = (value: unknown) => {
    binds.push(value);
    return `?${binds.length}`;
  };
  const where: string[] = [`k.workspace_id = ${bind(workspaceId)}`];

  if (query.archived === 'exclude') where.push('k.archived_at IS NULL');
  if (query.archived === 'only') where.push('k.archived_at IS NOT NULL');
  if (query.boardId) where.push(`k.board_id = ${bind(query.boardId)}`);
  if (query.columnId) where.push(`k.column_id = ${bind(query.columnId)}`);

  // Testo: ogni parola deve comparire (AND) in almeno uno dei campi (OR). Un solo parametro per parola.
  for (const term of (query.q ?? '').split(/\s+/).filter(Boolean)) {
    const p = bind(likePattern(term));
    where.push(
      `(${SEARCH_COLUMNS.map((column) => `${column} LIKE ${p} ESCAPE '\\'`).join(' OR ')})`,
    );
  }

  if (query.priority) {
    where.push(`k.priority IN (${query.priority.map(bind).join(', ')})`);
  }
  // Vocabolari con "none" = valore non indicato (NULL).
  const vocab = (column: string, values: string[] | undefined) => {
    if (!values) return;
    const real = values.filter((v) => v !== 'none');
    const parts: string[] = [];
    if (real.length > 0) parts.push(`${column} IN (${real.map(bind).join(', ')})`);
    if (values.includes('none')) parts.push(`${column} IS NULL`);
    where.push(`(${parts.join(' OR ')})`);
  };
  vocab('d.stage', query.stage);
  vocab('d.outcome', query.outcome);
  vocab('d.work_mode', query.workMode);
  vocab('d.contract_type', query.contractType);

  if (query.labelId) {
    where.push(
      `EXISTS (SELECT 1 FROM card_labels cl WHERE cl.card_id = k.id AND cl.workspace_id = k.workspace_id AND cl.label_id IN (${query.labelId.map(bind).join(', ')}))`,
    );
  }
  if (query.appliedFrom) where.push(`d.applied_on >= ${bind(query.appliedFrom)}`);
  if (query.appliedTo) where.push(`d.applied_on <= ${bind(query.appliedTo)}`);

  // Retribuzione: confronto solo tra importi omogenei (stessa valuta e periodicità) e per
  // SOVRAPPOSIZIONE di intervalli; un estremo mancante nella scheda è aperto da quel lato.
  if (query.salaryMin !== undefined || query.salaryMax !== undefined) {
    where.push(
      `d.currency = ${bind(query.currency)}`,
      `d.salary_period = ${bind(query.salaryPeriod)}`,
      '(d.salary_min IS NOT NULL OR d.salary_max IS NOT NULL)',
    );
    if (query.salaryMin !== undefined) {
      where.push(`(d.salary_max IS NULL OR d.salary_max >= ${bind(query.salaryMin)})`);
    }
    if (query.salaryMax !== undefined) {
      where.push(`(d.salary_min IS NULL OR d.salary_min <= ${bind(query.salaryMax)})`);
    }
  }

  const from = `FROM cards k
    JOIN boards b ON b.id = k.board_id AND b.workspace_id = k.workspace_id
    JOIN board_columns c ON c.id = k.column_id AND c.workspace_id = k.workspace_id
    LEFT JOIN application_details d ON d.card_id = k.id AND d.workspace_id = k.workspace_id
    WHERE ${where.join(' AND ')}`;

  const direction = (query.dir ?? DEFAULT_SORT_DIR[query.sort]) === 'desc' ? 'DESC' : 'ASC';
  const expression = SORT_EXPRESSIONS[query.sort];
  const filterBinds = [...binds];
  const offset = (query.page - 1) * query.pageSize;
  const limitPlaceholder = bind(query.pageSize);
  const offsetPlaceholder = bind(offset);

  const select = `SELECT k.id AS id, k.board_id AS boardId, k.column_id AS columnId, k.title AS title,
      k.description AS description, k.priority AS priority, k.position AS position,
      d.company AS company, d.position AS jobTitle, d.location AS location,
      d.work_mode AS workMode, d.contract_type AS contractType,
      d.salary_min AS salaryMin, d.salary_max AS salaryMax, d.currency AS currency,
      d.salary_period AS salaryPeriod, d.salary_basis AS salaryBasis,
      d.source AS source, d.source_url AS sourceUrl, d.published_on AS publishedOn,
      d.applied_on AS appliedOn, d.stage AS stage, d.outcome AS outcome,
      (SELECT coalesce(json_group_array(cl.label_id), '[]') FROM card_labels cl
         WHERE cl.card_id = k.id AND cl.workspace_id = k.workspace_id) AS labelIds,
      k.created_at AS createdAt, k.updated_at AS updatedAt, k.archived_at AS archivedAt,
      b.name AS boardName, c.name AS columnName
    ${from}
    ORDER BY (${expression} IS NULL), ${expression} ${direction}, k.id ASC
    LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;

  // Pagina e totale nello stesso batch: la stessa fotografia dei dati.
  const [items, count] = await d1.batch([
    d1.prepare(select).bind(...binds),
    d1.prepare(`SELECT count(*) AS total ${from}`).bind(...filterBinds),
  ]);

  const total = Number((count?.results[0] as Row | undefined)?.['total'] ?? 0);
  const cards = ((items?.results ?? []) as unknown as { id: string; labelIds: string }[]).map(
    (row) => toCard(row),
  );
  const summaries = await summariesForCards(
    db,
    workspaceId,
    cards.map((card) => card.id),
  );
  return {
    items: withSummaries(cards, summaries) as unknown as OpportunitiesResponse['items'],
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.ceil(total / query.pageSize),
  };
}
