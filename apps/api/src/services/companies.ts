import { newId, type Database } from '@jobward/database';
import type {
  Company,
  CompanyDetailResponse,
  DuplicatesQuery,
  DuplicatesResponse,
  UpdateCompanyInput,
} from '@jobward/schemas';
import { companyKey, findDuplicates, type Outcome, type Stage } from '@jobward/shared';
import { sql } from 'drizzle-orm';
import { conflict, notFound } from '../lib/errors';
import { listPipelineCards } from './cards';

/**
 * Aziende (B-05). Il nome scritto dall'utente sull'opportunità resta com'è (`application_details.company`);
 * il collegamento all'azienda usa la chiave deterministica `companyKey`. Nessuna fusione tra chiavi diverse.
 */

/** Istruzioni per collegare (o scollegare) l'azienda di un'opportunità, nella stessa batch della scrittura. */
export function companyLinkStatements(
  d1: D1Database,
  args: { workspaceId: string; cardId: string; name: string | null | undefined; now: number },
): D1PreparedStatement[] {
  const key = args.name ? companyKey(args.name).slice(0, 120) : '';
  if (!key) {
    return [
      d1
        .prepare(
          `UPDATE application_details SET company_id = NULL WHERE card_id = ?1 AND workspace_id = ?2`,
        )
        .bind(args.cardId, args.workspaceId),
    ];
  }
  return [
    d1
      .prepare(
        `INSERT INTO companies (id, workspace_id, name, normalized_name, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)
         ON CONFLICT (workspace_id, normalized_name) DO NOTHING`,
      )
      .bind(newId(), args.workspaceId, args.name!.trim().slice(0, 120), key, args.now),
    d1
      .prepare(
        `UPDATE application_details
         SET company_id = (SELECT id FROM companies WHERE workspace_id = ?1 AND normalized_name = ?2)
         WHERE card_id = ?3 AND workspace_id = ?1`,
      )
      .bind(args.workspaceId, key, args.cardId),
  ];
}

/** Collega le opportunità con un nome d'azienda ma senza collegamento (dati creati prima o importati). */
async function syncCompanies(d1: D1Database, db: Database, workspaceId: string) {
  const rows = await db.all<{ cardId: string; company: string }>(
    sql`SELECT card_id AS cardId, company FROM application_details
        WHERE workspace_id = ${workspaceId} AND company IS NOT NULL AND company_id IS NULL`,
  );
  if (rows.length === 0) return;
  const now = Date.now();
  await d1.batch(
    rows.flatMap((r) =>
      companyLinkStatements(d1, { workspaceId, cardId: r.cardId, name: r.company, now }),
    ),
  );
}

interface CompanyRow {
  id: string;
  name: string;
  website: string | null;
  notes: string | null;
  opportunities: number;
  applications: number;
  activeApplications: number;
  lastActivityAt: number | null;
  createdAt: number;
  updatedAt: number;
}

const COMPANY_SELECT = sql`
  SELECT c.id, c.name, c.website, c.notes, c.created_at AS createdAt, c.updated_at AS updatedAt,
         (SELECT count(*) FROM application_details d JOIN cards k ON k.id = d.card_id
            WHERE d.company_id = c.id AND k.archived_at IS NULL) AS opportunities,
         (SELECT count(*) FROM applications a JOIN application_details d ON d.card_id = a.opportunity_id
            WHERE d.company_id = c.id) AS applications,
         (SELECT count(*) FROM current_applications ca JOIN application_details d ON d.card_id = ca.opportunity_id
            JOIN cards k ON k.id = d.card_id
            WHERE d.company_id = c.id AND k.archived_at IS NULL
              AND (ca.outcome IS NULL OR ca.outcome = 'pending') AND ca.stage IS NOT 'closed') AS activeApplications,
         (SELECT max(k.updated_at) FROM application_details d JOIN cards k ON k.id = d.card_id
            WHERE d.company_id = c.id) AS lastActivityAt
  FROM companies c`;

export async function listCompanies(
  d1: D1Database,
  db: Database,
  workspaceId: string,
): Promise<Company[]> {
  await syncCompanies(d1, db, workspaceId);
  const rows = await db.all<CompanyRow>(
    sql`${COMPANY_SELECT} WHERE c.workspace_id = ${workspaceId}
        ORDER BY lastActivityAt IS NULL, lastActivityAt DESC, c.name`,
  );
  // Le aziende senza opportunità attive restano nell'elenco solo se hanno storia (candidature) o note.
  return rows.filter((r) => r.opportunities > 0 || r.applications > 0 || r.notes || r.website);
}

async function getCompanyRow(db: Database, workspaceId: string, companyId: string) {
  const [row] = await db.all<CompanyRow>(
    sql`${COMPANY_SELECT} WHERE c.workspace_id = ${workspaceId} AND c.id = ${companyId}`,
  );
  if (!row) throw notFound('Azienda');
  return row;
}

export async function getCompany(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  companyId: string,
): Promise<CompanyDetailResponse> {
  await syncCompanies(d1, db, workspaceId);
  const company = await getCompanyRow(db, workspaceId, companyId);
  const opportunities = (await listPipelineCards(db, workspaceId, { companyId })).map((c) => ({
    ...c,
  }));
  return { company, opportunities };
}

export async function updateCompany(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  companyId: string,
  input: UpdateCompanyInput,
  now: number,
): Promise<Company> {
  await getCompanyRow(db, workspaceId, companyId);
  const sets: string[] = [];
  const values: unknown[] = [];
  const set = (column: string, value: unknown) => {
    sets.push(`${column} = ?${values.length + 1}`);
    values.push(value);
  };
  if (input.name !== undefined) {
    const key = companyKey(input.name);
    if (!key) throw conflict('Il nome dell’azienda non può essere vuoto');
    set('name', input.name);
    set('normalized_name', key.slice(0, 120));
  }
  if (input.website !== undefined) set('website', input.website);
  if (input.notes !== undefined) set('notes', input.notes);
  set('updated_at', now);
  try {
    await d1
      .prepare(
        `UPDATE companies SET ${sets.join(', ')} WHERE id = ?${values.length + 1} AND workspace_id = ?${values.length + 2}`,
      )
      .bind(...values, companyId, workspaceId)
      .run();
  } catch {
    throw conflict('Esiste già un’azienda con questo nome');
  }
  return getCompanyRow(db, workspaceId, companyId);
}

/** Possibili duplicati di una nuova opportunità (regole in `findDuplicates`), mai bloccanti. */
export async function findOpportunityDuplicates(
  db: Database,
  workspaceId: string,
  query: DuplicatesQuery,
): Promise<DuplicatesResponse> {
  const candidates = await db.all<{
    id: string;
    title: string;
    company: string | null;
    sourceUrl: string | null;
    boardId: string | null;
    stage: Stage | null;
    outcome: Outcome | null;
    archivedAt: number | null;
  }>(
    sql`SELECT k.id, k.title, d.company, d.source_url AS sourceUrl, k.board_id AS boardId,
               ca.stage, ca.outcome, k.archived_at AS archivedAt
        FROM cards k
        LEFT JOIN application_details d ON d.card_id = k.id
        LEFT JOIN current_applications ca ON ca.opportunity_id = k.id
        WHERE k.workspace_id = ${workspaceId}
        ORDER BY k.updated_at DESC LIMIT 2000`,
  );
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const matches = findDuplicates(
    { title: query.title, company: query.company ?? null, sourceUrl: query.sourceUrl ?? null },
    candidates.filter((c) => c.id !== query.excludeId),
  );
  return {
    duplicates: matches.slice(0, 5).map(({ id, reason }) => {
      const c = byId.get(id)!;
      return {
        id,
        reason,
        title: c.title,
        company: c.company,
        boardId: c.boardId,
        stage: c.stage,
        outcome: c.outcome,
        archived: c.archivedAt !== null,
      };
    }),
  };
}
