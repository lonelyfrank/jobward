import type { Database } from '@jobward/database';
import { EXPORT_FORMAT, EXPORT_VERSION, type WorkspaceExport } from '@jobward/schemas';
import { sql } from 'drizzle-orm';
import { notFound } from '../lib/errors';

/**
 * Esportazione completa del workspace (H-05): ogni tabella di dominio filtrata per workspace, con i nomi
 * di colonna del database. Esclusi i tombstone di note e documenti (contenuto eliminato dall'utente).
 */
const COLLECTIONS: Record<string, string> = {
  boards: 'SELECT * FROM boards WHERE workspace_id = ?1 ORDER BY position, id',
  boardColumns:
    'SELECT * FROM board_columns WHERE workspace_id = ?1 ORDER BY board_id, position, id',
  opportunities: 'SELECT * FROM cards WHERE workspace_id = ?1 ORDER BY created_at, id',
  opportunityDetails: 'SELECT * FROM application_details WHERE workspace_id = ?1 ORDER BY card_id',
  applications:
    'SELECT * FROM applications WHERE workspace_id = ?1 ORDER BY opportunity_id, sequence',
  applicationSnapshots:
    'SELECT * FROM application_snapshots WHERE workspace_id = ?1 ORDER BY application_id, version',
  interviews: 'SELECT * FROM interviews WHERE workspace_id = ?1 ORDER BY card_id, sequence',
  notes:
    'SELECT * FROM card_notes WHERE workspace_id = ?1 AND deleted_at IS NULL ORDER BY created_at, id',
  documents:
    'SELECT * FROM card_documents WHERE workspace_id = ?1 AND deleted_at IS NULL ORDER BY created_at, id',
  tasks: 'SELECT * FROM tasks WHERE workspace_id = ?1 ORDER BY created_at, id',
  labels: 'SELECT * FROM labels WHERE workspace_id = ?1 ORDER BY name, id',
  cardLabels: 'SELECT * FROM card_labels WHERE workspace_id = ?1 ORDER BY card_id, label_id',
  customFields:
    'SELECT * FROM custom_field_definitions WHERE workspace_id = ?1 ORDER BY board_id, position',
  customFieldValues:
    'SELECT * FROM custom_field_values WHERE workspace_id = ?1 ORDER BY card_id, field_id',
  activity: 'SELECT * FROM activity_events WHERE workspace_id = ?1 ORDER BY occurred_at, id',
};

export async function exportWorkspace(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  now: number,
): Promise<WorkspaceExport> {
  const [workspace] = await db.all<Record<string, unknown>>(
    sql`SELECT id, name, timezone, created_at, updated_at FROM workspaces WHERE id = ${workspaceId}`,
  );
  if (!workspace) throw notFound('Workspace');
  const collections: Record<string, Record<string, unknown>[]> = {};
  for (const [name, query] of Object.entries(COLLECTIONS)) {
    const { results } = await d1.prepare(query).bind(workspaceId).all<Record<string, unknown>>();
    collections[name] = results;
  }
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now,
    workspace,
    collections,
  };
}
