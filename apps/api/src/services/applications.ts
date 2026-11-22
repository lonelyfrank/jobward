import { newId, type Database } from '@jobward/database';
import type {
  Application,
  ApplicationMutationResponse,
  ApplicationSnapshot,
  CreateApplicationInput,
  UpdateApplicationInput,
} from '@jobward/schemas';
import type { Outcome, Stage } from '@jobward/shared';
import { sql } from 'drizzle-orm';
import { conflict, notFound } from '../lib/errors';
import { getCard } from './cards';
import { requestFingerprint } from './idempotency';
import { isConstraintError } from './ordering';

/**
 * Candidature (Opportunity 1:N Application). La candidatura con sequenza più alta è quella CORRENTE e
 * determina lo stato dell'opportunità; si cambia solo con la pipeline. Qui: lettura, nuova candidatura
 * (prima o ricandidatura dopo una chiusura) e correzione dei dati d'invio.
 */

/** Una candidatura è aperta finché non ha un esito conclusivo e non è in fase «chiusa». */
export const OPEN_APPLICATION_SQL = `(ca.outcome IS NULL OR ca.outcome = 'pending') AND ca.stage IS NOT 'closed'`;

/** Snapshot dei dati dell'opportunità, scritto solo se la candidatura `applicationId` esiste. */
export function snapshotStatement(
  d1: D1Database,
  args: { workspaceId: string; cardId: string; applicationId: string; now: number },
) {
  return d1
    .prepare(
      `INSERT INTO application_snapshots (id, workspace_id, application_id, version, title, company, position, location,
          work_mode, contract_type, salary_min, salary_max, currency, salary_period, salary_basis, listing_source,
          listing_url, published_on, created_at)
       SELECT ?1, k.workspace_id, ?2,
              COALESCE((SELECT max(version) FROM application_snapshots WHERE application_id = ?2), 0) + 1,
              k.title, d.company, d.position, d.location, d.work_mode, d.contract_type, d.salary_min, d.salary_max,
              d.currency, d.salary_period, d.salary_basis, d.source, d.source_url, d.published_on, ?3
       FROM cards k LEFT JOIN application_details d ON d.card_id = k.id
       WHERE k.id = ?4 AND k.workspace_id = ?5
         AND EXISTS (SELECT 1 FROM applications WHERE id = ?2 AND workspace_id = ?5)`,
    )
    .bind(newId(), args.applicationId, args.now, args.cardId, args.workspaceId);
}

/** Evento legato a una candidatura, registrato solo se la candidatura esiste (stessa batch). */
export function applicationEventStatement(
  d1: D1Database,
  args: {
    workspaceId: string;
    boardId: string | null;
    cardId: string;
    applicationId: string;
    actorUserId: string;
    type: string;
    metadata: Record<string, unknown>;
    now: number;
    dedupeKey?: string | null;
    operationId?: string | null;
    fingerprint?: string | null;
  },
) {
  return d1
    .prepare(
      `INSERT INTO activity_events (id, workspace_id, board_id, card_id, application_id, actor_user_id, type, metadata,
          occurred_at, dedupe_key, operation_id, request_fingerprint)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12
       WHERE EXISTS (SELECT 1 FROM applications WHERE id = ?5 AND workspace_id = ?2 AND opportunity_id = ?4)`,
    )
    .bind(
      newId(),
      args.workspaceId,
      args.boardId,
      args.cardId,
      args.applicationId,
      args.actorUserId,
      args.type,
      JSON.stringify(args.metadata),
      args.now,
      args.dedupeKey ?? null,
      args.operationId ?? null,
      args.fingerprint ?? null,
    );
}

interface ApplicationRow {
  id: string;
  opportunityId: string;
  sequence: number;
  stage: Stage | null;
  outcome: Outcome | null;
  appliedOn: string | null;
  channel: string | null;
  requestFingerprint: string | null;
  createdAt: number;
  updatedAt: number;
  maxSequence: number;
}

interface SnapshotRow {
  applicationId: string;
  version: number;
  title: string;
  company: string | null;
  jobTitle: string | null;
  location: string | null;
  workMode: ApplicationSnapshot['workMode'];
  contractType: ApplicationSnapshot['contractType'];
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  salaryPeriod: ApplicationSnapshot['salaryPeriod'];
  salaryBasis: ApplicationSnapshot['salaryBasis'];
  source: string | null;
  sourceUrl: string | null;
  publishedOn: string | null;
  createdAt: number;
}

async function readApplications(
  db: Database,
  workspaceId: string,
  where: { cardId?: string; applicationId?: string },
): Promise<Application[]> {
  const filter = where.applicationId
    ? sql`a.id = ${where.applicationId}`
    : sql`a.opportunity_id = ${where.cardId ?? ''}`;
  const rows = await db.all<ApplicationRow>(
    sql`SELECT a.id, a.opportunity_id AS opportunityId, a.sequence, a.stage, a.outcome, a.applied_on AS appliedOn,
               a.channel, a.request_fingerprint AS requestFingerprint, a.created_at AS createdAt,
               a.updated_at AS updatedAt,
               (SELECT max(b.sequence) FROM applications b WHERE b.opportunity_id = a.opportunity_id) AS maxSequence
        FROM applications a
        WHERE a.workspace_id = ${workspaceId} AND ${filter}
        ORDER BY a.sequence DESC`,
  );
  if (rows.length === 0) return [];
  const snapshots = await db.all<SnapshotRow>(
    sql`SELECT s.application_id AS applicationId, s.version, s.title, s.company, s.position AS jobTitle, s.location,
               s.work_mode AS workMode, s.contract_type AS contractType, s.salary_min AS salaryMin,
               s.salary_max AS salaryMax, s.currency, s.salary_period AS salaryPeriod, s.salary_basis AS salaryBasis,
               s.listing_source AS source, s.listing_url AS sourceUrl, s.published_on AS publishedOn,
               s.created_at AS createdAt
        FROM application_snapshots s
        JOIN applications a ON a.id = s.application_id
        WHERE s.workspace_id = ${workspaceId} AND ${filter}
        ORDER BY s.version DESC`,
  );
  const latest = new Map<string, ApplicationSnapshot>();
  for (const { applicationId, ...snapshot } of snapshots) {
    if (!latest.has(applicationId)) latest.set(applicationId, snapshot);
  }
  return rows.map(({ maxSequence, requestFingerprint: _fp, ...row }) => ({
    ...row,
    current: row.sequence === maxSequence,
    snapshot: latest.get(row.id) ?? null,
  }));
}

export async function listApplications(
  db: Database,
  workspaceId: string,
  cardId: string,
): Promise<Application[]> {
  await getCard(db, workspaceId, cardId); // 404 per una scheda altrui
  return readApplications(db, workspaceId, { cardId });
}

async function getApplication(db: Database, workspaceId: string, applicationId: string) {
  const [application] = await readApplications(db, workspaceId, { applicationId });
  if (!application) throw notFound('Candidatura');
  return application;
}

/**
 * Nuova candidatura. Ammessa se l'opportunità non ne ha o se la corrente è chiusa (ricandidatura).
 * Idempotente per `id` del client: stesso id e stessa richiesta → replay; stesso id, richiesta diversa → 409.
 */
export async function createApplication(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  userId: string,
  cardId: string,
  input: CreateApplicationInput,
  now: number,
): Promise<ApplicationMutationResponse> {
  const card = await getCard(db, workspaceId, cardId);
  const fingerprint = await requestFingerprint('application.create', {
    workspaceId,
    cardId,
    id: input.id,
    stage: input.stage,
    appliedOn: input.appliedOn ?? null,
    channel: input.channel ?? null,
  });

  const replay = async (): Promise<ApplicationMutationResponse | null> => {
    const existing = await db.all<{ opportunityId: string; requestFingerprint: string | null }>(
      sql`SELECT opportunity_id AS opportunityId, request_fingerprint AS requestFingerprint
          FROM applications WHERE id = ${input.id} AND workspace_id = ${workspaceId}`,
    );
    const row = existing[0];
    if (!row) return null;
    if (row.opportunityId !== cardId || row.requestFingerprint !== fingerprint) {
      throw conflict('Questo identificativo è già stato usato per un’altra candidatura');
    }
    return {
      application: await getApplication(db, workspaceId, input.id),
      card: await getCard(db, workspaceId, cardId),
      replayed: true,
    };
  };
  const already = await replay();
  if (already) return already;

  if (card.archivedAt !== null) {
    throw conflict('L’opportunità è archiviata: ripristinala prima di candidarti');
  }

  const appliedOn = input.stage === 'applied' ? (input.appliedOn ?? null) : null;
  const statements = [
    d1
      .prepare(
        `INSERT INTO applications (id, workspace_id, opportunity_id, sequence, stage, outcome, applied_on, channel,
            request_fingerprint, created_at, updated_at)
         SELECT ?1, k.workspace_id, k.id,
                COALESCE((SELECT max(sequence) FROM applications WHERE opportunity_id = k.id), 0) + 1,
                ?2, NULL, ?3, ?4, ?5, ?6, ?6
         FROM cards k
         WHERE k.id = ?7 AND k.workspace_id = ?8 AND k.archived_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM current_applications ca WHERE ca.opportunity_id = k.id AND ${OPEN_APPLICATION_SQL})`,
      )
      .bind(
        input.id,
        input.stage,
        appliedOn,
        input.channel ?? null,
        fingerprint,
        now,
        cardId,
        workspaceId,
      ),
    snapshotStatement(d1, { workspaceId, cardId, applicationId: input.id, now }),
    applicationEventStatement(d1, {
      workspaceId,
      boardId: card.boardId,
      cardId,
      applicationId: input.id,
      actorUserId: userId,
      type: 'application_created',
      metadata: { applicationId: input.id, stage: input.stage },
      now,
    }),
    ...(input.stage === 'applied'
      ? [
          applicationEventStatement(d1, {
            workspaceId,
            boardId: card.boardId,
            cardId,
            applicationId: input.id,
            actorUserId: userId,
            type: 'application_submitted',
            metadata: appliedOn ? { appliedOn } : {},
            now,
          }),
        ]
      : []),
    d1
      .prepare(`UPDATE cards SET updated_at = ?1 WHERE id = ?2 AND workspace_id = ?3`)
      .bind(now, cardId, workspaceId),
  ];

  let results: D1Result[];
  try {
    results = await d1.batch(statements);
  } catch (error) {
    if (!isConstraintError(error)) throw error;
    const raced = await replay();
    if (raced) return raced;
    throw conflict('Le candidature sono cambiate nel frattempo: aggiorna la pagina');
  }
  if (results[0]?.meta.changes !== 1) {
    throw conflict(
      'Esiste già una candidatura aperta per questa opportunità: chiudila prima di ricandidarti',
    );
  }
  return {
    application: await getApplication(db, workspaceId, input.id),
    card: await getCard(db, workspaceId, cardId),
    replayed: false,
  };
}

/** Correzione di data d'invio e canale: non cambia lo stato (che si cambia con la pipeline). */
export async function updateApplication(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  applicationId: string,
  input: UpdateApplicationInput,
  now: number,
): Promise<ApplicationMutationResponse> {
  const application = await getApplication(db, workspaceId, applicationId);
  const sets: string[] = [];
  const values: unknown[] = [];
  if (input.appliedOn !== undefined) {
    sets.push(`applied_on = ?${values.length + 1}`);
    values.push(input.appliedOn);
  }
  if (input.channel !== undefined) {
    sets.push(`channel = ?${values.length + 1}`);
    values.push(input.channel);
  }
  sets.push(`updated_at = ?${values.length + 1}`);
  values.push(now);
  await d1
    .prepare(
      `UPDATE applications SET ${sets.join(', ')} WHERE id = ?${values.length + 1} AND workspace_id = ?${values.length + 2}`,
    )
    .bind(...values, applicationId, workspaceId)
    .run();
  return {
    application: await getApplication(db, workspaceId, applicationId),
    card: await getCard(db, workspaceId, application.opportunityId),
    replayed: false,
  };
}
