import { newId, schema, type Database } from '@jobward/database';
import type {
  ActivityEvent,
  Card,
  CardDetailResponse,
  CreateCardInput,
  MoveCardInput,
  PlacedCard,
  UpdateCardInput,
} from '@jobward/schemas';
import { salaryIssues } from '@jobward/schemas';
import { DORMANT_ACTIVITY_EVENT_TYPES, LIMITS, POSITION_GAP } from '@jobward/shared';
import { and, asc, desc, eq, isNotNull, isNull, notInArray } from 'drizzle-orm';
import { ApiError, conflict, notFound } from '../lib/errors';
import { getBoard } from './boards';
import { companyLinkStatements } from './companies';
import { eventStatement, touchBoard } from './events';
import {
  summariesForBoard,
  summariesForCards,
  summariesForWorkspace,
  withSummaries,
} from './interview-summaries';
import { DETAIL_COLUMNS, DETAIL_KEYS_LIST, selectCards, toCard } from './card-rows';
import { decidePlacement, isConstraintError, readSiblings, rebalanceStatement } from './ordering';

const { cards, activityEvents, boardColumns } = schema;

const withDetails = selectCards;

/** Le schede di una bacheca hanno sempre un posizionamento: lo garantisce il filtro SQL, qui lo si afferma. */
const isPlaced = (card: Card): card is PlacedCard =>
  card.boardId !== null && card.columnId !== null;

/** Schede attive di una bacheca, in ordine di colonna e posizione. */
export async function listActiveCards(
  db: Database,
  workspaceId: string,
  boardId: string,
): Promise<PlacedCard[]> {
  const rows = await withDetails(db)
    .where(
      and(eq(cards.boardId, boardId), eq(cards.workspaceId, workspaceId), isNull(cards.archivedAt)),
    )
    .orderBy(asc(cards.columnId), asc(cards.position), asc(cards.id));
  return withSummaries(rows.map(toCard), await summariesForBoard(db, workspaceId, boardId)).filter(
    isPlaced,
  );
}

export async function listArchivedCards(
  db: Database,
  workspaceId: string,
  boardId: string,
): Promise<PlacedCard[]> {
  await getBoard(db, workspaceId, boardId);
  const rows = await withDetails(db)
    .where(
      and(
        eq(cards.boardId, boardId),
        eq(cards.workspaceId, workspaceId),
        isNotNull(cards.archivedAt),
      ),
    )
    .orderBy(desc(cards.archivedAt), asc(cards.id));
  return withSummaries(rows.map(toCard), await summariesForBoard(db, workspaceId, boardId)).filter(
    isPlaced,
  );
}

/** Scheda del workspace o 404 (stessa risposta per inesistente e di un altro workspace). */
export async function getCard(db: Database, workspaceId: string, cardId: string): Promise<Card> {
  const card = await withDetails(db)
    .where(and(eq(cards.id, cardId), eq(cards.workspaceId, workspaceId)))
    .get();
  if (!card) throw notFound('Scheda');
  const [withSummary] = withSummaries(
    [toCard(card)],
    await summariesForCards(db, workspaceId, [card.id]),
  );
  return withSummary as Card;
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
    .where(
      and(
        eq(activityEvents.cardId, cardId),
        eq(activityEvents.workspaceId, workspaceId),
        // 0010: i tipi predisposti ma non ancora attivi non compaiono (né consumano il limite della pagina).
        notInArray(activityEvents.type, [...DORMANT_ACTIVITY_EVENT_TYPES]),
      ),
    )
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
  const column = input.columnId
    ? await db
        .select({ id: boardColumns.id, boardId: boardColumns.boardId, name: boardColumns.name })
        .from(boardColumns)
        .where(and(eq(boardColumns.id, input.columnId), eq(boardColumns.workspaceId, workspaceId)))
        .get()
    : null;
  if (input.columnId && !column) throw notFound('Colonna');

  const id = newId();
  const details = input.details ?? {};
  assertSalaryState(details);
  // Colonne e valori dei soli dettagli indicati (non nulli): se non c'è nulla, nessuna riga 1:1.
  const present = DETAIL_KEYS_LIST.filter((key) => details[key] != null);

  const insertCard = column
    ? d1
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
        )
    : // Opportunità senza bacheca (Inbox): nessuna colonna, posizione neutra.
      d1
        .prepare(
          `INSERT INTO cards (id, workspace_id, board_id, column_id, title, description, position, priority, created_at, updated_at)
           VALUES (?1, ?2, NULL, NULL, ?3, ?4, 0, ?5, ?6, ?6)`,
        )
        .bind(id, workspaceId, input.title, input.description ?? null, input.priority, now);

  const statements = [
    insertCard,
    ...(present.length > 0
      ? [
          d1
            .prepare(
              `INSERT INTO application_details (card_id, workspace_id, ${present.map((k) => DETAIL_COLUMNS[k]).join(', ')}, created_at, updated_at)
               SELECT ?1, ?2, ${present.map((_, i) => `?${i + 4}`).join(', ')}, ?3, ?3
               WHERE EXISTS (SELECT 1 FROM cards WHERE id = ?1 AND workspace_id = ?2)`,
            )
            .bind(id, workspaceId, now, ...present.map((k) => details[k])),
        ]
      : []),
    ...(details.company
      ? companyLinkStatements(d1, { workspaceId, cardId: id, name: details.company, now })
      : []),
    eventStatement(d1, {
      workspaceId,
      boardId: column?.boardId ?? null,
      cardId: id,
      actorUserId: userId,
      type: 'card_created',
      metadata: { columnId: column?.id ?? null, columnName: column?.name ?? null },
      now,
      guard: '1 = 1',
      guardBinds: [],
    }),
    touchBoard(d1, workspaceId, column?.boardId ?? null, now),
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

/** Coerenza della retribuzione sullo stato RISULTANTE (vedi `salaryIssues`): 400 con i campi in errore. */
function assertSalaryState(state: Parameters<typeof salaryIssues>[0]) {
  const issues = salaryIssues(state);
  if (issues.length > 0) {
    throw new ApiError(400, 'validation_error', 'Dati non validi', issues);
  }
}

const SALARY_KEYS = ['salaryMin', 'salaryMax', 'currency'] as const;

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

  // Le regole che coinvolgono più campi si valutano sullo stato risultante, non sul solo payload.
  if (SALARY_KEYS.some((key) => input[key] !== undefined)) {
    assertSalaryState({
      salaryMin: input.salaryMin !== undefined ? input.salaryMin : current.salaryMin,
      salaryMax: input.salaryMax !== undefined ? input.salaryMax : current.salaryMax,
      currency: input.currency !== undefined ? input.currency : current.currency,
    });
  }

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

  // Dettagli professionali: upsert che tocca SOLO i campi indicati (assente = invariato).
  const touched = DETAIL_KEYS_LIST.filter((key) => input[key] !== undefined);
  if (touched.length > 0) {
    const columns = touched.map((key) => DETAIL_COLUMNS[key]);
    statements.push(
      d1
        .prepare(
          `INSERT INTO application_details (card_id, workspace_id, ${columns.join(', ')}, created_at, updated_at)
           SELECT ?1, ?2, ${touched.map((_, i) => `?${i + 4}`).join(', ')}, ?3, ?3
           WHERE EXISTS (SELECT 1 FROM cards WHERE id = ?1 AND workspace_id = ?2 AND archived_at IS NULL)
           ON CONFLICT (card_id) DO UPDATE SET ${columns.map((c) => `${c} = excluded.${c}`).join(', ')}, updated_at = excluded.updated_at`,
        )
        .bind(cardId, workspaceId, now, ...touched.map((key) => input[key] ?? null)),
    );
  }

  if (input.company !== undefined) {
    statements.push(
      ...companyLinkStatements(d1, { workspaceId, cardId, name: input.company, now }),
    );
  }
  const base = { workspaceId, boardId: current.boardId, cardId, actorUserId: userId, now };
  if (input.priority !== undefined && input.priority !== current.priority) {
    statements.push(
      eventStatement(d1, {
        ...base,
        type: 'priority_changed',
        metadata: { from: current.priority, to: input.priority },
        guard: 'k.priority = ?9 AND k.archived_at IS NULL',
        guardBinds: [input.priority],
      }),
    );
  }
  statements.push(touchBoard(d1, workspaceId, current.boardId, now));

  let results: D1Result[];
  try {
    results = await d1.batch(statements);
  } catch (error) {
    // Ultima difesa: un CHECK del database (es. intervallo retributivo) violato da una scrittura concorrente.
    if (isConstraintError(error)) {
      throw conflict('I dati sono cambiati nel frattempo: aggiorna la pagina e riprova');
    }
    throw error;
  }
  if (!results[0] || results[0].meta.changes !== 1) {
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
  if (card.boardId === null || card.columnId === null) {
    // Opportunità senza bacheca (M5-SW.10-a): non ha una colonna da cui spostarla.
    throw conflict('La scheda non appartiene a nessuna bacheca: non si può spostare tra colonne');
  }
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

/**
 * Bacheca canonica (C-01): tutte le opportunità attive del workspace con lo stato della candidatura
 * corrente, più il nome della bacheca organizzativa. È una vista: nessuna posizione propria.
 */
export async function listPipelineCards(
  db: Database,
  workspaceId: string,
  filter: { companyId?: string } = {},
): Promise<(Card & { boardName: string | null })[]> {
  const rows = await withDetails(db)
    .where(
      filter.companyId
        ? and(
            eq(cards.workspaceId, workspaceId),
            eq(schema.applicationDetails.companyId, filter.companyId),
          )
        : and(eq(cards.workspaceId, workspaceId), isNull(cards.archivedAt)),
    )
    .orderBy(desc(cards.updatedAt), asc(cards.id))
    .limit(LIMITS.cardsPerBoardMax);
  const boards = await db
    .select({ id: schema.boards.id, name: schema.boards.name })
    .from(schema.boards)
    .where(eq(schema.boards.workspaceId, workspaceId));
  const names = new Map(boards.map((b) => [b.id, b.name]));
  return withSummaries(rows.map(toCard), await summariesForWorkspace(db, workspaceId)).map(
    (card) => ({ ...card, boardName: card.boardId ? (names.get(card.boardId) ?? null) : null }),
  );
}
