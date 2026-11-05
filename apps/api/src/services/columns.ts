import { newId, schema, type Database } from '@jobward/database';
import type { Column, CreateColumnInput, UpdateColumnInput } from '@jobward/schemas';
import { LIMITS, POSITION_GAP } from '@jobward/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import { ApiError, conflict, notFound } from '../lib/errors';
import { getBoard } from './boards';
import { decidePlacement, isConstraintError, readSiblings, rebalanceStatement } from './ordering';

const { boardColumns } = schema;

const columnSelect = {
  id: boardColumns.id,
  boardId: boardColumns.boardId,
  name: boardColumns.name,
  color: boardColumns.color,
  category: boardColumns.category,
  position: boardColumns.position,
  // Nomi qualificati a mano: vedi nota in services/boards.ts (correlazione delle sottoquery).
  cardCount: sql<number>`(select count(*) from cards k where k.column_id = board_columns.id and k.workspace_id = board_columns.workspace_id and k.archived_at is null)`,
  archivedCount: sql<number>`(select count(*) from cards k where k.column_id = board_columns.id and k.workspace_id = board_columns.workspace_id and k.archived_at is not null)`,
  createdAt: boardColumns.createdAt,
  updatedAt: boardColumns.updatedAt,
};

export async function listColumns(
  db: Database,
  workspaceId: string,
  boardId: string,
): Promise<Column[]> {
  return db
    .select(columnSelect)
    .from(boardColumns)
    .where(and(eq(boardColumns.boardId, boardId), eq(boardColumns.workspaceId, workspaceId)))
    .orderBy(asc(boardColumns.position), asc(boardColumns.id));
}

/** Colonna del workspace (con conteggi) o 404. */
export async function getColumn(
  db: Database,
  workspaceId: string,
  columnId: string,
): Promise<Column> {
  const column = await db
    .select(columnSelect)
    .from(boardColumns)
    .where(and(eq(boardColumns.id, columnId), eq(boardColumns.workspaceId, workspaceId)))
    .get();
  if (!column) throw notFound('Colonna');
  return column;
}

export async function createColumn(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  boardId: string,
  input: CreateColumnInput,
  now: number,
): Promise<Column> {
  await getBoard(db, workspaceId, boardId);

  const id = newId();
  const result = await d1
    .prepare(
      `INSERT INTO board_columns (id, workspace_id, board_id, name, color, position, category, created_at, updated_at)
       SELECT ?1, b.workspace_id, b.id, ?4, ?5,
              COALESCE((SELECT max(position) FROM board_columns WHERE board_id = b.id), 0) + ${POSITION_GAP},
              ?6, ?7, ?7
       FROM boards b
       WHERE b.id = ?2 AND b.workspace_id = ?3
         AND (SELECT count(*) FROM board_columns WHERE board_id = b.id) < ?8`,
    )
    .bind(
      id,
      boardId,
      workspaceId,
      input.name,
      input.color,
      input.category,
      now,
      LIMITS.columnsPerBoardMax,
    )
    .run();
  if (result.meta.changes !== 1) {
    throw conflict(`Una bacheca può avere al massimo ${LIMITS.columnsPerBoardMax} colonne`);
  }
  return getColumn(db, workspaceId, id);
}

const COLUMN_FIELDS = { name: 'name', color: 'color', category: 'category' } as const;

export async function updateColumn(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  columnId: string,
  input: UpdateColumnInput,
  now: number,
): Promise<Column> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(COLUMN_FIELDS)) {
    const value = input[key as keyof typeof COLUMN_FIELDS];
    if (value === undefined) continue;
    sets.push(`${column} = ?${values.length + 1}`);
    values.push(value);
  }
  sets.push(`updated_at = ?${values.length + 1}`);
  values.push(now);

  const result = await d1
    .prepare(
      `UPDATE board_columns SET ${sets.join(', ')}
       WHERE id = ?${values.length + 1} AND workspace_id = ?${values.length + 2}`,
    )
    .bind(...values, columnId, workspaceId)
    .run();
  if (result.meta.changes !== 1) throw notFound('Colonna');
  return getColumn(db, workspaceId, columnId);
}

export async function moveColumn(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  columnId: string,
  afterId: string | null,
  now: number,
): Promise<Column> {
  const column = await getColumn(db, workspaceId, columnId);
  if (afterId === columnId) throw conflict('Una colonna non può seguire se stessa');

  const siblings = await readSiblings(d1, 'columns', workspaceId, column.boardId, columnId);
  const placement = decidePlacement(siblings, afterId, 'L’elenco delle colonne');

  await d1.batch([
    ...(placement.rebalance
      ? [rebalanceStatement(d1, 'columns', workspaceId, column.boardId, columnId)]
      : []),
    d1
      .prepare(
        `UPDATE board_columns SET position = ?1, updated_at = ?2
         WHERE id = ?3 AND workspace_id = ?4 AND board_id = ?5`,
      )
      .bind(placement.position, now, columnId, workspaceId, column.boardId),
  ]);
  return getColumn(db, workspaceId, columnId);
}

/**
 * Elimina una colonna. Le schede non vengono MAI eliminate in silenzio:
 *  - colonna vuota → eliminata;
 *  - colonna con schede (anche archiviate) e nessuna destinazione → 409 con messaggio chiaro;
 *  - con una colonna di destinazione della stessa bacheca → le schede vi vengono accodate,
 *    nello stesso ordine, e la colonna è eliminata, tutto in un unico `batch()`.
 * Se nel frattempo arriva una nuova scheda, la FK `cards_column_fk` (NO ACTION) fa fallire
 * l'intero batch: nulla viene spostato a metà.
 */
export async function deleteColumn(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  columnId: string,
  moveCardsToColumnId: string | null,
  now: number,
): Promise<void> {
  const column = await getColumn(db, workspaceId, columnId);
  const total = column.cardCount + column.archivedCount;

  if (total > 0 && moveCardsToColumnId === null) {
    const archived = column.archivedCount > 0 ? ` (${column.archivedCount} archiviate)` : '';
    throw conflict(
      `La colonna contiene ${total} ${total === 1 ? 'scheda' : 'schede'}${archived}: spostale in un’altra colonna prima di eliminarla`,
    );
  }

  const statements: D1PreparedStatement[] = [];
  if (total > 0 && moveCardsToColumnId !== null) {
    if (moveCardsToColumnId === columnId) {
      throw new ApiError(400, 'validation_error', 'La colonna di destinazione deve essere diversa');
    }
    const target = await getColumn(db, workspaceId, moveCardsToColumnId); // 404 se di un altro workspace
    if (target.boardId !== column.boardId) {
      throw new ApiError(
        400,
        'validation_error',
        'La colonna di destinazione è di un’altra bacheca',
      );
    }
    const max = await d1
      .prepare(
        `SELECT COALESCE(max(position), 0) AS max FROM cards WHERE column_id = ?1 AND workspace_id = ?2`,
      )
      .bind(target.id, workspaceId)
      .first<{ max: number }>();
    const base = max?.max ?? 0;

    statements.push(
      d1
        .prepare(
          // UPDATE … FROM: i ranghi sono calcolati prima di scrivere (vedi rebalanceStatement).
          `UPDATE cards SET column_id = ?1, updated_at = ?2, position = ?3 + r.rn * ${POSITION_GAP}
           FROM (
             SELECT id, row_number() OVER (ORDER BY position, id) AS rn
             FROM cards WHERE column_id = ?4 AND workspace_id = ?5
           ) AS r
           WHERE cards.id = r.id`,
        )
        .bind(target.id, now, base, columnId, workspaceId),
    );
  }
  statements.push(
    d1
      .prepare(`DELETE FROM board_columns WHERE id = ?1 AND workspace_id = ?2`)
      .bind(columnId, workspaceId),
  );

  try {
    await d1.batch(statements);
  } catch (error) {
    if (isConstraintError(error)) {
      throw conflict('Nel frattempo la colonna è cambiata: aggiorna la pagina e riprova');
    }
    throw error;
  }
}
