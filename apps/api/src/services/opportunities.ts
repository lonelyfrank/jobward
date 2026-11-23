import type {
  OpportunityCitiesResponse,
  OpportunitiesMapResponse,
  OpportunitiesQuery,
  OpportunitiesResponse,
} from '@jobward/schemas';
import { DEFAULT_SORT_DIR } from '@jobward/schemas';
import {
  andQueries,
  legacyFiltersToQuery,
  LIMITS,
  localDate,
  queryLimitIssues,
  queryNeedsClock,
  SmartQueryError,
  type QueryContext,
} from '@jobward/shared';
import type { Database } from '@jobward/database';
import { ApiError } from '../lib/errors';
import { toCard } from './card-rows';
import { summariesForCards, withSummaries } from './interview-summaries';
import { compileOrderBy, compileWhere } from './query-sql';
import { containsSql, foldSql, searchTerms } from './search-text';

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

const SEARCH_COLUMNS = [
  'k.title',
  'd.company',
  'd.position',
  'k.description',
  'd.location',
  'd.city',
  'd.source',
] as const;

interface Row {
  [key: string]: unknown;
}

/** Data locale e fuso del workspace, per i periodi relativi e i confini dei giorni. */
async function workspaceClock(
  d1: D1Database,
  workspaceId: string,
  now: number,
): Promise<QueryContext> {
  const row = await d1
    .prepare('SELECT timezone FROM workspaces WHERE id = ?1')
    .bind(workspaceId)
    .first<{ timezone: string }>();
  const timeZone = row?.timezone ?? 'UTC';
  return { today: localDate(now, timeZone), timeZone };
}

interface CompiledFilter {
  /** Parametri legati finora (il primo è il workspace); `bind` ne aggiunge altri in coda. */
  binds: unknown[];
  bind: (value: unknown) => string;
  /** CTE della ricerca globale (vuota altrimenti) e clausola FROM … WHERE condivisa. */
  documents: string;
  from: string;
}

/**
 * Filtri dell'elenco compilati UNA volta: l'elenco paginato e la vista Mappa usano la stessa
 * clausola, quindi un filtro ha lo stesso significato in ogni vista (PP-07).
 */
async function compileOpportunityFilter(
  d1: D1Database,
  workspaceId: string,
  query: OpportunitiesQuery,
  options: { globalSearch?: boolean; now?: number },
): Promise<CompiledFilter> {
  const global = options.globalSearch ?? false;
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

  // La modalità globale estende soltanto il documento testuale; filtri e paginazione restano condivisi.
  const globalDocument = global
    ? foldSql(
        [
          ...SEARCH_COLUMNS,
          'b.name',
          'ca.stage',
          `CASE ca.stage WHEN 'saved' THEN 'Salvata' WHEN 'preparing' THEN 'In preparazione'
      WHEN 'applied' THEN 'Inviata' WHEN 'in_contact' THEN 'In contatto'
      WHEN 'interviewing' THEN 'Colloquio' WHEN 'offer' THEN 'Offerta' WHEN 'closed' THEN 'Conclusa' END`,
        ]
          .map((column) => `coalesce(${column}, '')`)
          .join(' || char(10) || '),
      )
    : '';
  const terms = global ? searchTerms(query.q ?? '') : (query.q ?? '').split(/\s+/).filter(Boolean);
  // Ogni parola deve comparire (AND) in almeno un campo (OR). Un parametro per parola.
  for (const term of terms) {
    const p = bind(term);
    where.push(
      global
        ? containsSql('search_documents.text', p)
        : `(${SEARCH_COLUMNS.map((column) => containsSql(column, p)).join(' OR ')})`,
    );
  }

  // Filtri a parametri semplici + `where`: UNA query v2, compilata da UN compilatore (query-sql.ts).
  // Un fallimento di complessità è un errore del chiamante (400), mai un 500.
  const combined = andQueries(
    legacyFiltersToQuery({
      priority: query.priority,
      stage: query.stage,
      outcome: query.outcome,
      workMode: query.workMode,
      contractType: query.contractType,
      labelId: query.labelId,
      appliedFrom: query.appliedFrom,
      appliedTo: query.appliedTo,
    }),
    query.where ?? { v: 2 },
  );
  const limitIssues = queryLimitIssues(combined);
  if (limitIssues.length > 0) {
    throw new ApiError(400, 'validation_error', 'Parametri non validi', limitIssues);
  }
  // L'orologio e il fuso si leggono SOLO se la query dipende da «oggi» o dai giorni locali.
  const clock: QueryContext = queryNeedsClock(combined)
    ? await workspaceClock(d1, workspaceId, options.now ?? Date.now())
    : { today: '1970-01-01', timeZone: 'UTC' };
  try {
    const compiled = compileWhere(combined, clock, bind);
    if (compiled) where.push(compiled);
  } catch (error) {
    if (error instanceof SmartQueryError) {
      throw new ApiError(400, 'validation_error', 'Parametri non validi', [...error.issues]);
    }
    throw error;
  }

  // Città (D-07): confronto senza maiuscole né spazi ai lati; «none» = città non indicata.
  if (query.city) {
    const named = query.city.filter((c) => c !== 'none');
    const parts: string[] = [];
    if (named.length > 0) {
      parts.push(
        `lower(trim(d.city)) IN (${named.map((c) => `lower(${bind(c.trim())})`).join(', ')})`,
      );
    }
    if (query.city.includes('none')) parts.push("(d.city IS NULL OR trim(d.city) = '')");
    where.push(`(${parts.join(' OR ')})`);
  }

  if (query.scope === 'inbox') where.push('ca.id IS NULL');
  if (query.scope === 'applications') where.push('ca.id IS NOT NULL');

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

  // Materializzare una volta evita di espandere la normalizzazione per ogni parola:
  // D1 limita a 100 la profondità delle espressioni SQL.
  const documents = global
    ? `WITH search_documents AS MATERIALIZED (
        SELECT k.id, ${globalDocument} AS text FROM cards k
        LEFT JOIN boards b ON b.id = k.board_id AND b.workspace_id = k.workspace_id
        LEFT JOIN application_details d ON d.card_id = k.id AND d.workspace_id = k.workspace_id
    LEFT JOIN current_applications ca ON ca.opportunity_id = k.id
        WHERE k.workspace_id = ?1
      )`
    : '';
  const from = `FROM cards k
    LEFT JOIN boards b ON b.id = k.board_id AND b.workspace_id = k.workspace_id
    LEFT JOIN board_columns c ON c.id = k.column_id AND c.workspace_id = k.workspace_id
    LEFT JOIN application_details d ON d.card_id = k.id AND d.workspace_id = k.workspace_id
    LEFT JOIN current_applications ca ON ca.opportunity_id = k.id
    ${global ? 'JOIN search_documents ON search_documents.id = k.id' : ''}
    WHERE ${where.join(' AND ')}`;
  return { binds, bind, documents, from };
}

export async function searchOpportunities(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  query: OpportunitiesQuery,
  options: { globalSearch?: boolean; now?: number } = {},
): Promise<OpportunitiesResponse> {
  const { binds, bind, documents, from } = await compileOpportunityFilter(
    d1,
    workspaceId,
    query,
    options,
  );
  const orderBy = compileOrderBy([
    { field: query.sort, dir: query.dir ?? DEFAULT_SORT_DIR[query.sort] },
  ]);
  const filterBinds = [...binds];
  const offset = (query.page - 1) * query.pageSize;
  const limitPlaceholder = bind(query.pageSize);
  const offsetPlaceholder = bind(offset);

  const select = `${documents} SELECT k.id AS id, k.board_id AS boardId, k.column_id AS columnId, k.title AS title,
      k.description AS description, k.priority AS priority, k.position AS position,
      d.company AS company, d.position AS jobTitle, d.location AS location, d.city AS city,
      d.work_mode AS workMode, d.contract_type AS contractType,
      d.salary_min AS salaryMin, d.salary_max AS salaryMax, d.currency AS currency,
      d.salary_period AS salaryPeriod, d.salary_basis AS salaryBasis,
      d.source AS source, d.source_url AS sourceUrl, d.published_on AS publishedOn,
      d.seniority AS seniority, d.deadline_on AS deadlineOn, d.requirements AS requirements,
      d.benefits AS benefits, d.interest AS interest, d.latitude AS latitude, d.longitude AS longitude,
      d.company_id AS companyId, ca.id AS applicationId, coalesce(ca.sequence, 0) AS applicationCount,
      ca.applied_on AS appliedOn, ca.stage AS stage, ca.outcome AS outcome,
      (SELECT coalesce(json_group_array(cl.label_id), '[]') FROM card_labels cl
         WHERE cl.card_id = k.id AND cl.workspace_id = k.workspace_id) AS labelIds,
      k.created_at AS createdAt, k.updated_at AS updatedAt, k.archived_at AS archivedAt,
      b.name AS boardName, c.name AS columnName
    ${from}
    ORDER BY ${orderBy}
    LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;

  // Pagina e totale nello stesso batch: la stessa fotografia dei dati.
  const [items, count] = await d1.batch([
    d1.prepare(select).bind(...binds),
    d1.prepare(`${documents} SELECT count(*) AS total ${from}`).bind(...filterBinds),
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

/**
 * Vista Mappa (D-07): tutte le opportunità che rispettano i filtri, in forma leggera, fino a
 * `LIMITS.mapPointsMax` (prima quelle con coordinate). Ricerca testuale, filtri, ambito e archivio
 * valgono come nell'elenco; ordinamento e paginazione dell'elenco qui non hanno effetto.
 */
export async function mapOpportunities(
  d1: D1Database,
  workspaceId: string,
  query: OpportunitiesQuery,
  options: { now?: number } = {},
): Promise<OpportunitiesMapResponse> {
  const { binds, bind, from } = await compileOpportunityFilter(d1, workspaceId, query, options);
  const filterBinds = [...binds];
  const limit = bind(LIMITS.mapPointsMax);
  const select = `SELECT k.id AS id, k.title AS title, d.company AS company, d.position AS jobTitle,
      d.location AS location, d.city AS city, d.latitude AS latitude, d.longitude AS longitude,
      b.name AS boardName,
      ca.stage AS stage, ca.outcome AS outcome, k.archived_at AS archivedAt
    ${from}
    ORDER BY (d.latitude IS NULL), k.updated_at DESC, k.id
    LIMIT ${limit}`;
  const [items, counts] = await d1.batch([
    d1.prepare(select).bind(...binds),
    d1
      .prepare(`SELECT count(*) AS total, count(d.latitude) AS located ${from}`)
      .bind(...filterBinds),
  ]);
  const row = (counts?.results[0] ?? {}) as Row;
  const total = Number(row['total'] ?? 0);
  const list = (items?.results ?? []) as unknown as OpportunitiesMapResponse['items'];
  return {
    items: list,
    total,
    located: Number(row['located'] ?? 0),
    truncated: list.length < total,
  };
}

/**
 * Città usate nelle opportunità non archiviate (D-07), per le opzioni del filtro «Città».
 * Raggruppate senza maiuscole né spazi ai lati; si mostra la grafia più frequente (a parità, la
 * prima in ordine alfabetico).
 */
export async function listOpportunityCities(
  d1: D1Database,
  workspaceId: string,
): Promise<OpportunityCitiesResponse> {
  const [cities, missing] = await d1.batch([
    d1
      .prepare(
        `WITH spelled AS (
           SELECT lower(trim(d.city)) AS key, trim(d.city) AS city, count(*) AS n
           FROM cards k
           JOIN application_details d ON d.card_id = k.id AND d.workspace_id = k.workspace_id
           WHERE k.workspace_id = ?1 AND k.archived_at IS NULL AND trim(coalesce(d.city, '')) <> ''
           GROUP BY lower(trim(d.city)), trim(d.city)
         ),
         ranked AS (
           SELECT key, city, n, sum(n) OVER (PARTITION BY key) AS total,
                  row_number() OVER (PARTITION BY key ORDER BY n DESC, city) AS rank
           FROM spelled
         )
         SELECT city, total AS count FROM ranked WHERE rank = 1 ORDER BY city COLLATE NOCASE`,
      )
      .bind(workspaceId),
    d1
      .prepare(
        `SELECT count(*) AS n FROM cards k
         LEFT JOIN application_details d ON d.card_id = k.id AND d.workspace_id = k.workspace_id
         WHERE k.workspace_id = ?1 AND k.archived_at IS NULL AND trim(coalesce(d.city, '')) = ''`,
      )
      .bind(workspaceId),
  ]);
  return {
    cities: ((cities?.results ?? []) as { city: string; count: number }[]).map((r) => ({
      city: r.city,
      count: Number(r.count),
    })),
    withoutCity: Number((missing?.results[0] as Row | undefined)?.['n'] ?? 0),
  };
}
