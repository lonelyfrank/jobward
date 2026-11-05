import { newId, schema, type Database } from '@meet-roulette/database';
import type {
  ActivityEvent,
  Card,
  CardDetailResponse,
  CreateCardInput,
  MoveCardInput,
  UpdateCardInput,
} from '@meet-roulette/schemas';
import { LIMITS, POSITION_GAP } from '@meet-roulette/shared';
import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { ApiError, conflict, notFound } from '../lib/errors';
import { getBoard } from './boards';
import { decidePlacement, isConstraintError, readSiblings, rebalanceStatement } from './ordering';

const { cards, applicationDetails, activityEvents, boardColumns } = schema;

const cardSelect = {
  id: cards.id,
  boardId: cards.boardId,
  columnId: cards.columnId,
  title: cards.title,
  description: cards.description,
  priority: cards.priority,
  position: cards.position,
  company: applicationDetails.company,
  sourceUrl: applicationDetails.sourceUrl,
  createdAt: cards.createdAt,
  updatedAt: cards.updatedAt,
  archivedAt: cards.archivedAt,
};

const withDetails = (db: Database) =>
  db
    .select(cardSelect)
    .from(cards)
    .leftJoin(applicationDetails, eq(applicationDetails.cardId, cards.id));

/** Schede attive di una bacheca, in ordine di colonna e posizione. */
export async function listActiveCards(
  db: Database,
  workspaceId: string,
  boardId: string,
): Promise<Card[]> {
  return withDetails(db)
    .where(
      and(eq(cards.boardId, boardId), eq(cards.workspaceId, workspaceId), isNull(cards.archivedAt)),
    )
    .orderBy(asc(cards.columnId), asc(cards.position), asc(cards.id));
}

export async function listArchivedCards(
  db: Database,
  workspaceId: string,
  boardId: string,
): Promise<Card[]> {
  await getBoard(db, workspaceId, boardId);
  return withDetails(db)
    .where(
      and(
        eq(cards.boardId, boardId),
        eq(cards.workspaceId, workspaceId),
        isNotNull(cards.archivedAt),
      ),
    )
    .orderBy(desc(cards.archivedAt), asc(cards.id));
}

/** Scheda del workspace o 404 (stessa risposta per inesistente e di un altro workspace). */
export async function getCard(db: Database, workspaceId: string, cardId: string): Promise<Card> {
  const card = await withDetails(db)
    .where(and(eq(cards.id, cardId), eq(cards.workspaceId, workspaceId)))
    .get();
  if (!card) throw notFound('Scheda');
  return card;
}

const HISTORY_LIMIT = 50;

export async function getCardDetail(
  db: Database,
  workspaceId: string,
  cardId: string,
): Promise<CardDetailResponse> {
  const card = await getCard(db, workspaceId, cardId);
  const rows = await db
    .select({
      id: activityEvents.id,
      type: activityEvents.type,
      occurredAt: activityEvents.occurredAt,
      metadata: activityEvents.metadata,
    })
    .from(activityEvents)
    .where(and(eq(activityEvents.cardId, cardId), eq(activityEvents.workspaceId, workspaceId)))
    .orderBy(desc(activityEvents.occurredAt), desc(activityEvents.id))
    .limit(HISTORY_LIMIT);
  const history: ActivityEvent[] = rows.map((row) => ({
    ...row,
    metadata: parseMetadata(row.metadata),
  }));
  return { card, history };
}

function parseMetadata(raw: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Istruzione che registra un evento solo se `existsSql` (sulla scheda) è ancora vera. */
function eventStatement(
  d1: D1Database,
  args: {
    workspaceId: string;
    boardId: string;
    cardId: string;
    actorUserId: string;
    type: string;
    metadata: Record<string, unknown>;
    now: number;
    /** Condizione SQL su `cards` (alias `k`) che deve valere perché l'evento sia registrato. */
    guard: string;
    guardBinds: unknown[];
  },
) {
  const binds = [
    newId(),
    args.workspaceId,
    args.boardId,
    args.cardId,
    args.actorUserId,
    args.type,
    JSON.stringify(args.metadata),
    args.now,
    ...args.guardBinds,
  ];
  return d1
    .prepare(
      `INSERT INTO activity_events (id, workspace_id, board_id, card_id, actor_user_id, type, metadata, occurred_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
       WHERE EXISTS (SELECT 1 FROM cards k WHERE k.id = ?4 AND k.workspace_id = ?2 AND ${args.guard})`,
    )
    .bind(...binds);
}

const touchBoard = (d1: D1Database, workspaceId: string, boardId: string, now: number) =>
  d1
    .prepare(`UPDATE boards SET updated_at = ?1 WHERE id = ?2 AND workspace_id = ?3`)
    .bind(now, boardId, workspaceId);

// ---------------------------------------------------------------------------
// Creazione
// ---------------------------------------------------------------------------

/**
 * Creazione rapida. La scheda si inserisce con `INSERT … SELECT` dalla colonna: bacheca e
 * workspace derivano dalla colonna stessa (mai dall'input), la posizione è "in fondo" e il
 * tetto per bacheca è verificato nella stessa istruzione, quindi senza finestre di concorrenza.
 */
export async function createCard(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  userId: string,
  input: CreateCardInput,
  now: number,
): Promise<Card> {
  const column = await db
    .select({ id: boardColumns.id, boardId: boardColumns.boardId, name: boardColumns.name })
    .from(boardColumns)
    .where(and(eq(boardColumns.id, input.columnId), eq(boardColumns.workspaceId, workspaceId)))
    .get();
  if (!column) throw notFound('Colonna');

  const id = newId();
  const company = input.details?.company ?? null;
  const sourceUrl = input.details?.sourceUrl ?? null;

  const statements = [
    d1
      .prepare(
        `INSERT INTO cards (id, workspace_id, board_id, column_id, title, description, position, priority, created_at, updated_at)
         SELECT ?1, c.workspace_id, c.board_id, c.id, ?4, ?5,
                COALESCE((SELECT max(position) FROM cards WHERE column_id = c.id), 0) + ${POSITION_GAP},
                ?6, ?7, ?7
         FROM board_columns c
         WHERE c.id = ?2 AND c.workspace_id = ?3
           AND (SELECT count(*) FROM cards WHERE board_id = c.board_id) < ?8`,
      )
      .bind(
        id,
        column.id,
        workspaceId,
        input.title,
        input.description ?? null,
        input.priority,
        now,
        LIMITS.cardsPerBoardMax,
      ),
    ...(company !== null || sourceUrl !== null
      ? [
          d1
            .prepare(
              `INSERT INTO application_details (card_id, workspace_id, company, source_url, created_at, updated_at)
               SELECT ?1, ?2, ?3, ?4, ?5, ?5
               WHERE EXISTS (SELECT 1 FROM cards WHERE id = ?1 AND workspace_id = ?2)`,
            )
            .bind(id, workspaceId, company, sourceUrl, now),
        ]
      : []),
    eventStatement(d1, {
      workspaceId,
      boardId: column.boardId,
      cardId: id,
      actorUserId: userId,
      type: 'card_created',
      metadata: { columnId: column.id, columnName: column.name },
      now,
      guard: '1 = 1',
      guardBinds: [],
    }),
    touchBoard(d1, workspaceId, column.boardId, now),
  ];

  const [first] = await d1.batch(statements);
  if (!first || first.meta.changes !== 1) {
    throw conflict(
      `Una bacheca può contenere al massimo ${LIMITS.cardsPerBoardMax} schede (archiviate comprese)`,
    );
  }
  return getCard(db, workspaceId, id);
}

// ---------------------------------------------------------------------------
// Modifica
// ---------------------------------------------------------------------------

function assertEditable(card: Card) {
  if (card.archivedAt !== null) {
    throw conflict('La scheda è archiviata: ripristinala prima di modificarla');
  }
}

export async function updateCard(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  userId: string,
  cardId: string,
  input: UpdateCardInput,
  now: number,
): Promise<Card> {
  const current = await getCard(db, workspaceId, cardId);
  assertEditable(current);

  const sets: string[] = [];
  const values: unknown[] = [];
  const set = (column: string, value: unknown) => {
    sets.push(`${column} = ?${values.length + 1}`);
    values.push(value);
  };
  if (input.title !== undefined) set('title', input.title);
  if (input.description !== undefined) set('description', input.description);
  if (input.priority !== undefined) set('priority', input.priority);
  set('updated_at', now);

  const statements: D1PreparedStatement[] = [
    d1
      .prepare(
        `UPDATE cards SET ${sets.join(', ')}
         WHERE id = ?${values.length + 1} AND workspace_id = ?${values.length + 2} AND archived_at IS NULL`,
      )
      .bind(...values, cardId, workspaceId),
  ];

  // Dettagli di candidatura (M1: azienda e URL): upsert che tocca SOLO i campi indicati.
  const detailSets: string[] = [];
  if (input.company !== undefined) detailSets.push('company = excluded.company');
  if (input.sourceUrl !== undefined) detailSets.push('source_url = excluded.source_url');
  if (detailSets.length > 0) {
    statements.push(
      d1
        .prepare(
          `INSERT INTO application_details (card_id, workspace_id, company, source_url, created_at, updated_at)
           SELECT ?1, ?2, ?3, ?4, ?5, ?5
           WHERE EXISTS (SELECT 1 FROM cards WHERE id = ?1 AND workspace_id = ?2 AND archived_at IS NULL)
           ON CONFLICT (card_id) DO UPDATE SET ${detailSets.join(', ')}, updated_at = excluded.updated_at`,
        )
        .bind(cardId, workspaceId, input.company ?? null, input.sourceUrl ?? null, now),
    );
  }

  if (input.priority !== undefined && input.priority !== current.priority) {
    statements.push(
      eventStatement(d1, {
        workspaceId,
        boardId: current.boardId,
        cardId,
        actorUserId: userId,
        type: 'priority_changed',
        metadata: { from: current.priority, to: input.priority },
        now,
        guard: 'k.priority = ?9 AND k.archived_at IS NULL',
        guardBinds: [input.priority],
      }),
    );
  }
  statements.push(touchBoard(d1, workspaceId, current.boardId, now));

  const [update] = await d1.batch(statements);
  if (!update || update.meta.changes !== 1) {
    throw conflict('La scheda è stata modificata o archiviata nel frattempo: aggiorna la pagina');
  }
  return getCard(db, workspaceId, cardId);
}

// ---------------------------------------------------------------------------
// Spostamento
// ---------------------------------------------------------------------------

/**
 * Sposta una scheda tra colonne o nella stessa colonna (ADR-0004 / ADR-0008).
 *
 * Una sola `batch()` atomica contiene: l'eventuale ribilanciamento, l'aggiornamento della
 * scheda (condizionato alla colonna di origine letta), l'evento e il "touch" della bacheca.
 * La colonna di destinazione deve appartenere alla STESSA bacheca: oltre al controllo qui, lo
 * garantisce la FK composita `cards_column_fk` (ADR-0007) anche in caso di concorrenza.
 */
export async function moveCard(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  userId: string,
  cardId: string,
  input: MoveCardInput,
  now: number,
): Promise<Card> {
  const card = await getCard(db, workspaceId, cardId);
  assertEditable(card);
  if (input.afterCardId === cardId) {
    throw new ApiError(400, 'validation_error', 'Una scheda non può seguire se stessa');
  }

  const [from, to] = await Promise.all([
    db
      .select({ id: boardColumns.id, name: boardColumns.name })
      .from(boardColumns)
      .where(and(eq(boardColumns.id, card.columnId), eq(boardColumns.workspaceId, workspaceId)))
      .get(),
    db
      .select({ id: boardColumns.id, boardId: boardColumns.boardId, name: boardColumns.name })
      .from(boardColumns)
      .where(and(eq(boardColumns.id, input.columnId), eq(boardColumns.workspaceId, workspaceId)))
      .get(),
  ]);
  if (!to) throw notFound('Colonna'); // inesistente o di un altro workspace
  if (to.boardId !== card.boardId) {
    throw new ApiError(400, 'validation_error', 'La colonna appartiene a un’altra bacheca');
  }

  const crossColumn = to.id !== card.columnId;
  const siblings = await readSiblings(d1, 'cards', workspaceId, to.id, cardId);
  const placement = decidePlacement(siblings, input.afterCardId, 'La colonna');

  const statements: D1PreparedStatement[] = [];
  if (placement.rebalance) {
    statements.push(rebalanceStatement(d1, 'cards', workspaceId, to.id, cardId));
  }
  const updateIndex = statements.length;
  statements.push(
    d1
      .prepare(
        `UPDATE cards SET column_id = ?1, position = ?2,
                updated_at = CASE WHEN column_id <> ?1 THEN ?3 ELSE updated_at END
         WHERE id = ?4 AND workspace_id = ?5 AND column_id = ?6 AND archived_at IS NULL`,
      )
      .bind(to.id, placement.position, now, cardId, workspaceId, card.columnId),
  );
  if (crossColumn) {
    statements.push(
      eventStatement(d1, {
        workspaceId,
        boardId: card.boardId,
        cardId,
        actorUserId: userId,
        type: 'card_moved',
        metadata: {
          fromColumnId: card.columnId,
          fromColumnName: from?.name ?? null,
          toColumnId: to.id,
          toColumnName: to.name,
        },
        now,
        guard: 'k.column_id = ?9 AND k.updated_at = ?8',
        guardBinds: [to.id],
      }),
      touchBoard(d1, workspaceId, card.boardId, now),
    );
  }

  let results: D1Result[];
  try {
    results = await d1.batch(statements);
  } catch (error) {
    if (isConstraintError(error)) {
      throw conflict('La colonna è cambiata nel frattempo: aggiorna la pagina e riprova');
    }
    throw error;
  }
  if (results[updateIndex]?.meta.changes !== 1) {
    throw conflict('La scheda è stata spostata o archiviata nel frattempo: aggiorna la pagina');
  }
  return getCard(db, workspaceId, cardId);
}

// ---------------------------------------------------------------------------
// Archiviazione
// ---------------------------------------------------------------------------

export async function archiveCard(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  userId: string,
  cardId: string,
  now: number,
): Promise<Card> {
  const card = await getCard(db, workspaceId, cardId);
  if (card.archivedAt !== null) return card; // idempotente

  await d1.batch([
    d1
      .prepare(
        `UPDATE cards SET archived_at = ?1, updated_at = ?1
         WHERE id = ?2 AND workspace_id = ?3 AND archived_at IS NULL`,
      )
      .bind(now, cardId, workspaceId),
    eventStatement(d1, {
      workspaceId,
      boardId: card.boardId,
      cardId,
      actorUserId: userId,
      type: 'card_archived',
      metadata: { columnId: card.columnId },
      now,
      guard: 'k.archived_at = ?8',
      guardBinds: [],
    }),
    touchBoard(d1, workspaceId, card.boardId, now),
  ]);
  return getCard(db, workspaceId, cardId);
}

/** Ripristino: la scheda torna nella sua colonna, in fondo (posizione prevedibile). */
export async function restoreCard(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  userId: string,
  cardId: string,
  now: number,
): Promise<Card> {
  const card = await getCard(db, workspaceId, cardId);
  if (card.archivedAt === null) return card; // idempotente

  await d1.batch([
    d1
      .prepare(
        `UPDATE cards SET archived_at = NULL, updated_at = ?1,
                position = (SELECT COALESCE(max(position), 0) + ${POSITION_GAP} FROM cards k2 WHERE k2.column_id = cards.column_id)
         WHERE id = ?2 AND workspace_id = ?3 AND archived_at IS NOT NULL`,
      )
      .bind(now, cardId, workspaceId),
    eventStatement(d1, {
      workspaceId,
      boardId: card.boardId,
      cardId,
      actorUserId: userId,
      type: 'card_restored',
      metadata: { columnId: card.columnId },
      now,
      guard: 'k.archived_at IS NULL AND k.updated_at = ?8',
      guardBinds: [],
    }),
    touchBoard(d1, workspaceId, card.boardId, now),
  ]);
  return getCard(db, workspaceId, cardId);
}
