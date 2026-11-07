import { newId, schema, type Database } from '@jobward/database';
import type {
  Board,
  BoardListItem,
  Column,
  CreateBoardInput,
  UpdateBoardInput,
} from '@jobward/schemas';
import { getBoardTemplate, LIMITS, POSITION_GAP } from '@jobward/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import { conflict, notFound } from '../lib/errors';
import { decidePlacement, readSiblings, rebalanceStatement } from './ordering';

const { boards } = schema;

const boardColumnsList = {
  id: boards.id,
  name: boards.name,
  description: boards.description,
  icon: boards.icon,
  color: boards.color,
  backgroundImage: boards.backgroundImage,
  position: boards.position,
  isFavorite: boards.isFavorite,
  createdAt: boards.createdAt,
  updatedAt: boards.updatedAt,
};

/** Bacheca del workspace o 404: stessa risposta per "inesistente" e "di un altro workspace". */
export async function getBoard(db: Database, workspaceId: string, boardId: string): Promise<Board> {
  const board = await db
    .select(boardColumnsList)
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.workspaceId, workspaceId)))
    .get();
  if (!board) throw notFound('Bacheca');
  return board;
}

export async function listBoards(db: Database, workspaceId: string): Promise<BoardListItem[]> {
  return db
    .select({
      ...boardColumnsList,
      // Sottoquery correlate scritte con nomi qualificati: drizzle, in una select su una sola
      // tabella, omette il prefisso delle colonne e la correlazione si romperebbe in silenzio.
      columnCount: sql<number>`(select count(*) from board_columns bc where bc.board_id = boards.id and bc.workspace_id = boards.workspace_id)`,
      cardCount: sql<number>`(select count(*) from cards k where k.board_id = boards.id and k.workspace_id = boards.workspace_id and k.archived_at is null)`,
    })
    .from(boards)
    .where(eq(boards.workspaceId, workspaceId))
    .orderBy(asc(boards.position), asc(boards.id));
}

/**
 * Crea bacheca e colonne del template in un unico `batch()` (transazione atomica).
 * Il tetto per workspace è verificato nella stessa istruzione dell'INSERT; le colonne si
 * inseriscono solo se la bacheca esiste, quindi o c'è tutto o non c'è nulla.
 */
export async function createBoard(
  d1: D1Database,
  workspaceId: string,
  input: CreateBoardInput,
  now: number,
): Promise<{ board: Board; columns: Column[] }> {
  const template = getBoardTemplate(input.templateId);
  if (!template) throw new Error(`Template sconosciuto: ${input.templateId}`);

  const boardId = newId();
  const columns: Column[] = template.columns.map((c, i) => ({
    id: newId(),
    boardId,
    name: c.name,
    color: c.color,
    category: c.category,
    position: (i + 1) * POSITION_GAP,
    cardCount: 0,
    archivedCount: 0,
    createdAt: now,
    updatedAt: now,
  }));

  const statements = [
    d1
      .prepare(
        `INSERT INTO boards (id, workspace_id, name, description, icon, color, background_image, position, is_favorite, created_at, updated_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7,
                COALESCE((SELECT max(position) FROM boards WHERE workspace_id = ?2), 0) + ${POSITION_GAP},
                0, ?8, ?8
         WHERE (SELECT count(*) FROM boards WHERE workspace_id = ?2) < ?9`,
      )
      .bind(
        boardId,
        workspaceId,
        input.name,
        input.description,
        input.icon,
        input.color,
        input.backgroundImage,
        now,
        LIMITS.boardsPerWorkspaceMax,
      ),
    ...columns.map((c) =>
      d1
        .prepare(
          `INSERT INTO board_columns (id, workspace_id, board_id, name, color, position, category, created_at, updated_at)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8
           WHERE EXISTS (SELECT 1 FROM boards WHERE id = ?3 AND workspace_id = ?2)`,
        )
        .bind(c.id, workspaceId, boardId, c.name, c.color, c.position, c.category, now),
    ),
  ];

  const [first] = await d1.batch(statements);
  if (!first || first.meta.changes !== 1) {
    throw conflict(`Hai raggiunto il limite di ${LIMITS.boardsPerWorkspaceMax} bacheche`);
  }

  const created = await d1
    .prepare(
      `SELECT id, name, description, icon, color, background_image AS backgroundImage, position, is_favorite AS isFavorite,
              created_at AS createdAt, updated_at AS updatedAt
       FROM boards WHERE id = ?1 AND workspace_id = ?2`,
    )
    .bind(boardId, workspaceId)
    .first<Omit<Board, 'isFavorite'> & { isFavorite: number }>();
  if (!created) throw new Error('Bacheca non trovata dopo la creazione');
  return { board: { ...created, isFavorite: created.isFavorite === 1 }, columns };
}

/** Colonne SQL modificabili: mappa chiusa, nessun nome di colonna deriva dall'input. */
const BOARD_FIELDS = {
  name: 'name',
  description: 'description',
  color: 'color',
  backgroundImage: 'background_image',
  isFavorite: 'is_favorite',
} as const;

export async function updateBoard(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  boardId: string,
  input: UpdateBoardInput,
  now: number,
): Promise<Board> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(BOARD_FIELDS)) {
    const value = input[key as keyof typeof BOARD_FIELDS];
    if (value === undefined) continue;
    sets.push(`${column} = ?${values.length + 1}`);
    values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
  }
  sets.push(`updated_at = ?${values.length + 1}`);
  values.push(now);

  const result = await d1
    .prepare(
      `UPDATE boards SET ${sets.join(', ')}
       WHERE id = ?${values.length + 1} AND workspace_id = ?${values.length + 2}`,
    )
    .bind(...values, boardId, workspaceId)
    .run();
  if (result.meta.changes !== 1) throw notFound('Bacheca');
  return getBoard(db, workspaceId, boardId);
}

/**
 * Elimina la bacheca: colonne, schede e dettagli seguono per CASCADE (la FK composita
 * `cards_column_fk` è NO ACTION proprio per non dipendere dall'ordine delle cascade, ADR-0007).
 * La cronologia degli eventi resta con i riferimenti azzerati (SET NULL).
 */
export async function deleteBoard(d1: D1Database, workspaceId: string, boardId: string) {
  const result = await d1
    .prepare(`DELETE FROM boards WHERE id = ?1 AND workspace_id = ?2`)
    .bind(boardId, workspaceId)
    .run();
  // `meta.changes` di D1 conta anche le righe eliminate in CASCADE: qui basta sapere se > 0.
  if (result.meta.changes === 0) throw notFound('Bacheca');
}

export async function moveBoard(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  boardId: string,
  afterId: string | null,
  now: number,
): Promise<Board> {
  await getBoard(db, workspaceId, boardId); // 404 se non è nel workspace
  if (afterId === boardId) throw conflict('Una bacheca non può seguire se stessa');

  const siblings = await readSiblings(d1, 'boards', workspaceId, workspaceId, boardId);
  const placement = decidePlacement(siblings, afterId, 'L’elenco delle bacheche');

  const statements = [
    ...(placement.rebalance
      ? [rebalanceStatement(d1, 'boards', workspaceId, workspaceId, boardId)]
      : []),
    d1
      .prepare(
        `UPDATE boards SET position = ?1, updated_at = ?2 WHERE id = ?3 AND workspace_id = ?4`,
      )
      .bind(placement.position, now, boardId, workspaceId),
  ];
  await d1.batch(statements);
  return getBoard(db, workspaceId, boardId);
}
