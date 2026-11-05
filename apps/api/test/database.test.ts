import { env } from 'cloudflare:workers';
import { newId, schema } from '@jobward/database';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, seedBoardWithColumn, seedCard, seedWorkspace } from './helpers';

/** Verifica le garanzie di integrità del database, indipendenti dal codice applicativo. */
describe('schema D1 (migrazioni reali)', () => {
  it('le migrazioni creano tutte le tabelle del modello di dominio', async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name).sort()).toEqual([
      'activity_events',
      'application_details',
      'board_columns',
      'boards',
      'card_labels',
      'cards',
      'custom_field_definitions',
      'custom_field_values',
      'interviews',
      'labels',
      'tasks',
      'users',
      'workspace_members',
      'workspaces',
    ]);
  });

  it('rifiuta valori fuori vocabolario con vincoli CHECK', async () => {
    const { workspaceId } = await seedWorkspace('db-check@example.com');
    const { boardId, columnId } = await seedBoardWithColumn(workspaceId);
    const now = Date.now();
    await expect(
      db()
        .insert(schema.cards)
        .values({
          id: newId(),
          workspaceId,
          boardId,
          columnId,
          title: 't',
          position: 0,
          priority: 'critical' as never,
          createdAt: now,
          updatedAt: now,
        }),
    ).rejects.toThrow();
  });

  it('rifiuta email non in minuscolo e duplicati', async () => {
    const now = Date.now();
    await expect(
      db()
        .insert(schema.users)
        .values({ id: newId(), email: 'Mixed@Example.com', createdAt: now, updatedAt: now }),
    ).rejects.toThrow();
    await seedWorkspace('dup@example.com');
    await expect(
      db()
        .insert(schema.users)
        .values({ id: newId(), email: 'dup@example.com', createdAt: now, updatedAt: now }),
    ).rejects.toThrow();
  });

  it('una colonna che contiene schede non può essere eliminata (RESTRICT)', async () => {
    const { workspaceId } = await seedWorkspace('db-restrict@example.com');
    const { boardId, columnId } = await seedBoardWithColumn(workspaceId);
    await seedCard(workspaceId, boardId, columnId);
    await expect(
      db().delete(schema.boardColumns).where(eq(schema.boardColumns.id, columnId)),
    ).rejects.toThrow();
  });

  it('eliminare una scheda elimina i suoi dettagli (CASCADE)', async () => {
    const { workspaceId } = await seedWorkspace('db-cascade@example.com');
    const { boardId, columnId } = await seedBoardWithColumn(workspaceId);
    const cardId = await seedCard(workspaceId, boardId, columnId, { stage: 'saved' });
    await db().delete(schema.cards).where(eq(schema.cards.id, cardId));
    const rows = await db()
      .select()
      .from(schema.applicationDetails)
      .where(eq(schema.applicationDetails.cardId, cardId));
    expect(rows).toHaveLength(0);
  });

  it('impone retribuzione minima <= massima e unicità delle etichette senza distinguere maiuscole', async () => {
    const { workspaceId } = await seedWorkspace('db-misc@example.com');
    const { boardId, columnId } = await seedBoardWithColumn(workspaceId);
    const cardId = await seedCard(workspaceId, boardId, columnId);
    const now = Date.now();
    await expect(
      db().insert(schema.applicationDetails).values({
        cardId,
        workspaceId,
        salaryMin: 50,
        salaryMax: 10,
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow();

    await db()
      .insert(schema.labels)
      .values({ id: newId(), workspaceId, name: 'Remoto', createdAt: now });
    await expect(
      db()
        .insert(schema.labels)
        .values({ id: newId(), workspaceId, name: 'remoto', createdAt: now }),
    ).rejects.toThrow();
  });

  it('una stessa etichetta può esistere in workspace diversi', async () => {
    const a = await seedWorkspace('db-lab-a@example.com');
    const b = await seedWorkspace('db-lab-b@example.com');
    const now = Date.now();
    await db()
      .insert(schema.labels)
      .values({ id: newId(), workspaceId: a.workspaceId, name: 'Urgente', createdAt: now });
    await db()
      .insert(schema.labels)
      .values({ id: newId(), workspaceId: b.workspaceId, name: 'Urgente', createdAt: now });
  });
});
