import { newId, schema, type Database } from '@jobward/database';
import type {
  ActivityEvent,
  Card,
  CardDetailResponse,
  CreateCardInput,
  MoveCardInput,
  UpdateCardInput,
} from '@jobward/schemas';
import { salaryIssues } from '@jobward/schemas';
import { LIMITS, POSITION_GAP } from '@jobward/shared';
import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { ApiError, conflict, notFound } from '../lib/errors';
import { getBoard } from './boards';
import { eventStatement, touchBoard } from './events';
import { summariesForBoard, summariesForCards, withSummaries } from './interview-summaries';
import { DETAIL_COLUMNS, DETAIL_KEYS_LIST, selectCards, toCard } from './card-rows';
import { decidePlacement, isConstraintError, readSiblings, rebalanceStatement } from './ordering';

const { cards, activityEvents, boardColumns } = schema;

const withDetails = selectCards;

/** Schede attive di una bacheca, in ordine di colonna e posizione. */
export async function listActiveCards(
  db: Database,
  workspaceId: string,
  boardId: string,
): Promise<Card[]> {
  const rows = await withDetails(db)
    .where(
      and(eq(cards.boardId, boardId), eq(cards.workspaceId, workspaceId), isNull(cards.archivedAt)),
    )
    .orderBy(asc(cards.columnId), asc(cards.position), asc(cards.id));
  return withSummaries(rows.map(toCard), await summariesForBoard(db, workspaceId, boardId));
}

export async function listArchivedCards(
  db: Database,
  workspaceId: string,
  boardId: string,
): Promise<Card[]> {
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
  return withSummaries(rows.map(toCard), await summariesForBoard(db, workspaceId, boardId));
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
  const details = input.details ?? {};
  assertSalaryState(details);
  // Colonne e valori dei soli dettagli indicati (non nulli): se non c'è nulla, nessuna riga 1:1.
  const present = DETAIL_KEYS_LIST.filter((key) => details[key] != null);

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
  // Eventi di dominio: solo se il valore CAMBIA, e solo se la scrittura dei dettagli è avvenuta
  // (la guardia confronta la riga con il valore appena scritto e con l'istante della modifica).
  const detailGuard = (column: string) =>
    `EXISTS (SELECT 1 FROM application_details d WHERE d.card_id = k.id AND d.updated_at = ?8 AND d.${column} IS ?9)`;
  if (input.stage !== undefined && input.stage !== current.stage) {
    statements.push(
      eventStatement(d1, {
        ...base,
        type: 'stage_changed',
        metadata: { from: current.stage, to: input.stage },
        guard: detailGuard('stage'),
        guardBinds: [input.stage],
      }),
    );
  }
  if (input.appliedOn != null && current.appliedOn === null) {
    statements.push(
      eventStatement(d1, {
        ...base,
        type: 'application_submitted',
        metadata: { appliedOn: input.appliedOn },
        guard: detailGuard('applied_on'),
        guardBinds: [input.appliedOn],
      }),
    );
  }
  if (input.outcome != null && input.outcome !== 'pending' && input.outcome !== current.outcome) {
    statements.push(
      eventStatement(d1, {
        ...base,
        type: 'application_closed',
        metadata: { outcome: input.outcome },
        guard: detailGuard('outcome'),
        guardBinds: [input.outcome],
      }),
    );
  }
  // Riapertura (M3-C2): un esito conclusivo riportato a «in corso» dal modulo Dettagli lascia lo
  // stesso evento dedicato della transizione `reopen` (una sola fonte di eventi). Senza ID di
  // operazione: non ha chiave di deduplica, come gli altri eventi di questo percorso.
  const closedOutcome = current.outcome !== null && current.outcome !== 'pending';
  if (
    input.outcome !== undefined &&
    (input.outcome === null || input.outcome === 'pending') &&
    closedOutcome
  ) {
    statements.push(
      eventStatement(d1, {
        ...base,
        type: 'application_reopened',
        metadata: { outcome: current.outcome },
        guard: detailGuard('outcome'),
        guardBinds: [input.outcome],
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
