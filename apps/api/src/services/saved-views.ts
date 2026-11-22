import { newId, type Database } from '@jobward/database';
import type { CreateSavedViewInput, SavedView, UpdateSavedViewInput } from '@jobward/schemas';
import { sql } from 'drizzle-orm';
import { conflict, notFound } from '../lib/errors';
import { isConstraintError } from './ordering';

/** Viste salvate (D-04): definizioni riutilizzabili dell'Opportunity Center. Al massimo 50 per workspace. */
const MAX_VIEWS = 50;
const SELECT = sql`SELECT id, name, scope, params, position, created_at AS createdAt, updated_at AS updatedAt
  FROM saved_views`;

export async function listSavedViews(db: Database, workspaceId: string): Promise<SavedView[]> {
  return db.all<SavedView>(
    sql`${SELECT} WHERE workspace_id = ${workspaceId} ORDER BY position, created_at, id`,
  );
}

async function getSavedView(db: Database, workspaceId: string, id: string) {
  const [view] = await db.all<SavedView>(
    sql`${SELECT} WHERE workspace_id = ${workspaceId} AND id = ${id}`,
  );
  if (!view) throw notFound('Vista');
  return view;
}

const duplicate = () => conflict('Esiste già una vista con questo nome');

export async function createSavedView(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  input: CreateSavedViewInput,
  now: number,
): Promise<SavedView> {
  const id = newId();
  try {
    const result = await d1
      .prepare(
        `INSERT INTO saved_views (id, workspace_id, name, scope, params, position, created_at, updated_at)
         SELECT ?1, ?2, ?3, 'opportunities', ?4,
                COALESCE((SELECT max(position) FROM saved_views WHERE workspace_id = ?2), 0) + 1, ?5, ?5
         WHERE (SELECT count(*) FROM saved_views WHERE workspace_id = ?2) < ?6`,
      )
      .bind(id, workspaceId, input.name, input.params, now, MAX_VIEWS)
      .run();
    if (result.meta.changes !== 1) throw conflict(`Puoi salvare al massimo ${MAX_VIEWS} viste`);
  } catch (error) {
    if (isConstraintError(error)) throw duplicate();
    throw error;
  }
  return getSavedView(db, workspaceId, id);
}

export async function updateSavedView(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  id: string,
  input: UpdateSavedViewInput,
  now: number,
): Promise<SavedView> {
  await getSavedView(db, workspaceId, id);
  const sets: string[] = [];
  const values: unknown[] = [];
  if (input.name !== undefined) {
    sets.push(`name = ?${values.length + 1}`);
    values.push(input.name);
  }
  if (input.params !== undefined) {
    sets.push(`params = ?${values.length + 1}`);
    values.push(input.params);
  }
  sets.push(`updated_at = ?${values.length + 1}`);
  values.push(now);
  try {
    await d1
      .prepare(
        `UPDATE saved_views SET ${sets.join(', ')} WHERE id = ?${values.length + 1} AND workspace_id = ?${values.length + 2}`,
      )
      .bind(...values, id, workspaceId)
      .run();
  } catch (error) {
    if (isConstraintError(error)) throw duplicate();
    throw error;
  }
  return getSavedView(db, workspaceId, id);
}

export async function deleteSavedView(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  id: string,
) {
  await getSavedView(db, workspaceId, id);
  await d1
    .prepare('DELETE FROM saved_views WHERE id = ?1 AND workspace_id = ?2')
    .bind(id, workspaceId)
    .run();
}
