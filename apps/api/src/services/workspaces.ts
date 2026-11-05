import { newId, schema, type Database } from '@jobward/database';
import type { CreateWorkspaceInput, Workspace } from '@jobward/schemas';
import { and, eq } from 'drizzle-orm';
import { conflict, notFound } from '../lib/errors';

/** Nell'MVP ogni utente può possedere un solo workspace. */
export const MAX_OWNED_WORKSPACES = 1;

export async function listWorkspaces(db: Database, userId: string): Promise<Workspace[]> {
  return db
    .select({
      id: schema.workspaces.id,
      name: schema.workspaces.name,
      timezone: schema.workspaces.timezone,
      role: schema.workspaceMembers.role,
      createdAt: schema.workspaces.createdAt,
    })
    .from(schema.workspaceMembers)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.workspaceMembers.workspaceId))
    .where(eq(schema.workspaceMembers.userId, userId))
    .orderBy(schema.workspaces.createdAt);
}

/**
 * Verifica che l'utente sia membro del workspace.
 *
 * È il punto UNICO di controllo dell'ownership: ogni servizio che riceve un
 * `workspaceId` da input esterno deve passare da qui. Un workspace altrui e uno
 * inesistente producono la stessa risposta (404), per non rivelarne l'esistenza.
 */
export async function requireMembership(db: Database, userId: string, workspaceId: string) {
  const membership = await db
    .select({ role: schema.workspaceMembers.role })
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, workspaceId),
        eq(schema.workspaceMembers.userId, userId),
      ),
    )
    .get();
  if (!membership) throw notFound('Workspace');
  return membership;
}

/**
 * Crea un workspace e la membership `owner`, rispettando il limite MVP in modo atomico.
 *
 * Il limite è controllato dentro la stessa istruzione SQL dell'inserimento
 * (INSERT ... SELECT ... WHERE NOT EXISTS) e le due istruzioni sono eseguite in un
 * batch transazionale: due richieste simultanee non possono creare due workspace.
 */
export async function createWorkspace(
  d1: D1Database,
  user: { id: string },
  input: CreateWorkspaceInput,
  now: number,
): Promise<Workspace> {
  const workspaceId = newId();

  const [insertWorkspace] = await d1.batch([
    d1
      .prepare(
        `INSERT INTO workspaces (id, name, timezone, created_at, updated_at)
         SELECT ?1, ?2, ?3, ?4, ?4
         WHERE (SELECT count(*) FROM workspace_members WHERE user_id = ?5 AND role = 'owner') < ?6`,
      )
      .bind(workspaceId, input.name, input.timezone, now, user.id, MAX_OWNED_WORKSPACES),
    d1
      .prepare(
        `INSERT INTO workspace_members (workspace_id, user_id, role, created_at)
         SELECT ?1, ?2, 'owner', ?3 WHERE EXISTS (SELECT 1 FROM workspaces WHERE id = ?1)`,
      )
      .bind(workspaceId, user.id, now),
  ]);

  if (!insertWorkspace || insertWorkspace.meta.changes !== 1) {
    throw conflict('Hai già un workspace: in questa versione ne è consentito uno solo');
  }

  return {
    id: workspaceId,
    name: input.name,
    timezone: input.timezone,
    role: 'owner',
    createdAt: now,
  };
}
