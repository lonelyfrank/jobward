import type { Database } from '@jobward/database';
import type { InsightsResponse } from '@jobward/schemas';
import {
  computeInsights,
  type InsightApplicationRow,
  type InsightInterviewRow,
  type InsightOpportunityRow,
  type InsightResponseRow,
  type Stage,
} from '@jobward/shared';
import { sql } from 'drizzle-orm';

/**
 * Insights del workspace (E-01/E-02). Quattro letture aggregate, poi un calcolo puro (`computeInsights`):
 * nessuna query per scheda, nessuna formula nascosta nel SQL.
 */
export async function getInsights(
  db: Database,
  workspaceId: string,
  now: number,
): Promise<InsightsResponse> {
  const [workspace] = await db.all<{ timezone: string }>(
    sql`SELECT timezone FROM workspaces WHERE id = ${workspaceId}`,
  );
  const timeZone = workspace?.timezone ?? 'UTC';

  const opportunities = await db.all<InsightOpportunityRow>(
    sql`SELECT k.id, k.archived_at AS archivedAt, d.source, d.work_mode AS workMode, d.benefits,
               coalesce(ca.sequence, 0) AS applicationCount
        FROM cards k
        LEFT JOIN application_details d ON d.card_id = k.id
        LEFT JOIN current_applications ca ON ca.opportunity_id = k.id
        WHERE k.workspace_id = ${workspaceId}`,
  );
  const applications = (
    await db.all<Omit<InsightApplicationRow, 'current'> & { current: number }>(
      sql`SELECT a.id, a.opportunity_id AS opportunityId, a.sequence, a.stage, a.outcome,
                 a.applied_on AS appliedOn, k.archived_at AS archivedAt,
                 (a.sequence = (SELECT max(b.sequence) FROM applications b WHERE b.opportunity_id = a.opportunity_id)) AS current
          FROM applications a JOIN cards k ON k.id = a.opportunity_id
          WHERE a.workspace_id = ${workspaceId}`,
    )
  ).map((row) => ({ ...row, current: row.current === 1 }));
  // Primo segnale dell'azienda: contatto/colloquio/offerta registrati, un colloquio creato o un esito
  // dell'azienda. Il silenzio non produce eventi e quindi non è mai contato come risposta.
  const responses = await db.all<InsightResponseRow>(
    sql`SELECT card_id AS opportunityId, occurred_at AS occurredAt
        FROM activity_events
        WHERE workspace_id = ${workspaceId} AND card_id IS NOT NULL
          AND ((type = 'stage_changed' AND json_extract(metadata, '$.to') IN ('in_contact', 'interviewing', 'offer'))
            OR type = 'interview_created'
            OR (type = 'application_closed' AND json_extract(metadata, '$.outcome') IN ('rejected', 'accepted')))`,
  );
  const reachedStages = await db.all<{ opportunityId: string; stage: Stage }>(
    sql`SELECT DISTINCT card_id AS opportunityId, json_extract(metadata, '$.to') AS stage
        FROM activity_events
        WHERE workspace_id = ${workspaceId} AND card_id IS NOT NULL AND type = 'stage_changed'
          AND json_extract(metadata, '$.to') IN ('applied', 'in_contact', 'interviewing', 'offer')`,
  );
  const interviews = await db.all<InsightInterviewRow>(
    sql`SELECT card_id AS opportunityId, status, scheduled_at AS scheduledAt
        FROM interviews WHERE workspace_id = ${workspaceId}`,
  );

  return {
    generatedAt: now,
    timeZone,
    ...computeInsights({
      now,
      timeZone,
      opportunities,
      applications,
      responses,
      reachedStages,
      interviews,
    }),
  };
}
