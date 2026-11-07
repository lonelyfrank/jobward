import { type Database } from '@jobward/database';
import type {
  CreateTaskInput,
  Task,
  TaskAsOf,
  TaskSummaryResponse,
  TasksQuery,
  UpdateTaskInput,
} from '@jobward/schemas';
import {
  LIMITS,
  localDate,
  startOfLocalDay,
  taskStatus,
  type TaskView,
  type TaskCounts,
} from '@jobward/shared';
import { sql } from 'drizzle-orm';
import { ApiError, conflict, notFound } from '../lib/errors';
import { requestFingerprint } from './idempotency';
import { isConstraintError } from './ordering';

/**
 * Attività (M3 Tasks, docs/m3/tasks-api-contracts.md). Regole:
 *  - la scadenza è una DATA di calendario nel fuso del workspace; «oggi» lo decide SEMPRE il server;
 *  - stato derivato da completed_at / cancelled_at (mai scritto): comandi complete / reopen / cancel;
 *  - creazione idempotente (ID del client + fingerprint immutabile), tetti applicati nello stesso INSERT;
 *  - modifiche con compare-and-swap su `updated_at`, strettamente monotono (max(now, precedente + 1));
 *  - le task di una candidatura ARCHIVIATA restano invariate ma sono in sola lettura (409) e sono
 *    escluse dall'elenco operativo e dai contatori (esclusione derivata: il ripristino le riporta);
 *  - nessuna cancellazione definitiva: si annulla. Nessun evento in `activity_events` (D-06).
 */

interface Row {
  id: string;
  cardId: string | null;
  title: string;
  description: string | null;
  kind: Task['kind'];
  priority: Task['priority'];
  dueOn: string | null;
  completedAt: number | null;
  cancelledAt: number | null;
  requestFingerprint: string | null;
  createdAt: number;
  updatedAt: number;
  cardBoardId: string | null;
  cardTitle: string | null;
  cardArchivedAt: number | null;
  cardCompany: string | null;
}

const SELECT = sql`
  SELECT t.id, t.card_id AS cardId, t.title, t.description, t.kind, t.priority, t.due_on AS dueOn,
         t.completed_at AS completedAt, t.cancelled_at AS cancelledAt,
         t.request_fingerprint AS requestFingerprint, t.created_at AS createdAt, t.updated_at AS updatedAt,
         k.board_id AS cardBoardId, k.title AS cardTitle, k.archived_at AS cardArchivedAt,
         d.company AS cardCompany
  FROM tasks t
  LEFT JOIN cards k ON k.id = t.card_id AND k.workspace_id = t.workspace_id
  LEFT JOIN application_details d ON d.card_id = k.id`;

const toTask = (row: Row): Task => ({
  id: row.id,
  cardId: row.cardId,
  card:
    row.cardId !== null && row.cardBoardId !== null
      ? {
          id: row.cardId,
          boardId: row.cardBoardId,
          title: row.cardTitle ?? '',
          company: row.cardCompany,
          archived: row.cardArchivedAt !== null,
        }
      : null,
  title: row.title,
  description: row.description,
  kind: row.kind,
  priority: row.priority,
  dueOn: row.dueOn,
  status: taskStatus(row),
  completedAt: row.completedAt,
  cancelledAt: row.cancelledAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const SAME_ID_OTHER_REQUEST =
  'Questo identificativo è già stato usato per una richiesta diversa: genera un nuovo modulo';
const ARCHIVED =
  'La candidatura è archiviata: ripristinala prima di modificare le attività collegate';
const STALE = "L'attività è cambiata nel frattempo: aggiorna la pagina";

/** Data locale e fuso del workspace per questa risposta (il client non usa il proprio orologio). */
export async function getAsOf(db: Database, workspaceId: string, now: number): Promise<TaskAsOf> {
  const row = await db.get<{ timezone: string }>(
    sql`SELECT timezone FROM workspaces WHERE id = ${workspaceId}`,
  );
  if (!row) throw notFound('Workspace');
  return { today: localDate(now, row.timezone), timeZone: row.timezone };
}

const OPEN = sql`t.completed_at IS NULL AND t.cancelled_at IS NULL`;
/** Task di card archiviate escluse da elenco operativo e contatori (derivato, reversibile). */
const VISIBLE = sql`(t.card_id IS NULL OR k.archived_at IS NULL)`;

async function findRow(db: Database, workspaceId: string, id: string): Promise<Row | null> {
  return (
    (await db.get<Row>(sql`${SELECT} WHERE t.workspace_id = ${workspaceId} AND t.id = ${id}`)) ??
    null
  );
}

export async function getTask(db: Database, workspaceId: string, id: string): Promise<Task> {
  const row = await findRow(db, workspaceId, id);
  if (!row) throw notFound('Attività'); // inesistente o di un altro workspace: stessa risposta
  return toTask(row);
}

/* ------------------------------ elenco, cursore ------------------------------ */

type Phase = 'o' | 'd' | 'c';
type Cursor =
  | { phase: 'o'; key: [number, string, number, number, string] }
  | { phase: 'd' | 'c'; key: [number, string] };

function encodeCursor(cursor: Cursor): string {
  const json = JSON.stringify([cursor.phase, ...cursor.key]);
  let binary = '';
  for (const b of new TextEncoder().encode(json)) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decodeCursor(raw: string, view: TaskView): Cursor {
  const invalid = () =>
    new ApiError(400, 'validation_error', 'Parametri non validi', [
      { path: 'cursor', message: 'Cursore non valido' },
    ]);
  const allowed: Record<TaskView, Phase[]> = {
    all: ['o', 'd'],
    open: ['o'],
    overdue: ['o'],
    no_due: ['o'],
    done: ['d'],
    cancelled: ['c'],
  };
  try {
    const padded = raw.replaceAll('-', '+').replaceAll('_', '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const value: unknown = JSON.parse(
      new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))),
    );
    if (!Array.isArray(value)) throw invalid();
    const [phase, ...rest] = value as unknown[];
    if (phase !== 'o' && phase !== 'd' && phase !== 'c') throw invalid();
    if (!allowed[view].includes(phase)) throw invalid();
    const safeInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
    const str = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
    if (phase === 'o') {
      const [noDue, dueKey, negRank, createdAt, id] = rest;
      if (
        rest.length === 5 &&
        (noDue === 0 || noDue === 1) &&
        str(dueKey, 10) &&
        safeInt(negRank) &&
        safeInt(createdAt) &&
        str(id, 64)
      )
        return { phase, key: [noDue, dueKey, negRank, createdAt, id] };
    } else {
      const [ts, id] = rest;
      if (rest.length === 2 && safeInt(ts) && str(id, 64)) return { phase, key: [ts, id] };
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
  }
  throw invalid();
}

const NO_DUE = sql`(t.due_on IS NULL)`;
const DUE_KEY = sql`COALESCE(t.due_on, '')`;
const NEG_RANK = sql`(CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END)`;

function afterOpen(c: Extract<Cursor, { phase: 'o' }> | null) {
  if (!c) return sql``;
  const [a, b, r, ts, id] = c.key;
  return sql`AND (
    ${NO_DUE} > ${a}
    OR (${NO_DUE} = ${a} AND ${DUE_KEY} > ${b})
    OR (${NO_DUE} = ${a} AND ${DUE_KEY} = ${b} AND ${NEG_RANK} > ${r})
    OR (${NO_DUE} = ${a} AND ${DUE_KEY} = ${b} AND ${NEG_RANK} = ${r} AND t.created_at > ${ts})
    OR (${NO_DUE} = ${a} AND ${DUE_KEY} = ${b} AND ${NEG_RANK} = ${r} AND t.created_at = ${ts} AND t.id > ${id})
  )`;
}

const openCursor = (row: Row): Cursor => ({
  phase: 'o',
  key: [
    row.dueOn === null ? 1 : 0,
    row.dueOn ?? '',
    { urgent: 0, high: 1, medium: 2, low: 3, none: 4 }[row.priority],
    row.createdAt,
    row.id,
  ],
});

export async function listTasks(
  db: Database,
  workspaceId: string,
  query: TasksQuery,
  now: number,
): Promise<{ tasks: Task[]; nextCursor: string | null; asOf: TaskAsOf }> {
  const asOf = await getAsOf(db, workspaceId, now);
  const limit = query.limit;
  const cursor = query.cursor ? decodeCursor(query.cursor, query.view) : null;

  let scope = VISIBLE;
  if (query.cardId) {
    const card = await db.get<{ id: string }>(
      sql`SELECT id FROM cards WHERE id = ${query.cardId} AND workspace_id = ${workspaceId}`,
    );
    if (!card) throw notFound('Scheda'); // inesistente o di un altro workspace
    scope = sql`t.card_id = ${query.cardId}`; // include le card archiviate (sola lettura)
  }
  const base = sql`WHERE t.workspace_id = ${workspaceId} AND ${scope}`;

  const fetchOpen = async (after: Extract<Cursor, { phase: 'o' }> | null, take: number) => {
    const extra =
      query.view === 'overdue'
        ? sql`AND t.due_on < ${asOf.today}`
        : query.view === 'no_due'
          ? sql`AND t.due_on IS NULL`
          : sql``;
    return db.all<Row>(
      sql`${SELECT} ${base} AND ${OPEN} ${extra} ${afterOpen(after)}
          ORDER BY ${NO_DUE}, ${DUE_KEY}, ${NEG_RANK}, t.created_at, t.id LIMIT ${take}`,
    );
  };
  const fetchStamped = async (
    column: 'completed_at' | 'cancelled_at',
    after: Extract<Cursor, { phase: 'd' | 'c' }> | null,
    take: number,
  ) => {
    const col = column === 'completed_at' ? sql`t.completed_at` : sql`t.cancelled_at`;
    const tail = after
      ? sql`AND (${col} < ${after.key[0]} OR (${col} = ${after.key[0]} AND t.id < ${after.key[1]}))`
      : sql``;
    return db.all<Row>(
      sql`${SELECT} ${base} AND ${col} IS NOT NULL ${tail} ORDER BY ${col} DESC, t.id DESC LIMIT ${take}`,
    );
  };
  const stampCursor = (row: Row, phase: 'd' | 'c'): Cursor => ({
    phase,
    key: [(phase === 'd' ? row.completedAt : row.cancelledAt) as number, row.id],
  });

  let page: { row: Row; cursor: Cursor }[];
  let more: boolean;
  const asOpen = (rows: Row[]) => rows.map((row) => ({ row, cursor: openCursor(row) }));
  const asDone = (rows: Row[], phase: 'd' | 'c') =>
    rows.map((row) => ({ row, cursor: stampCursor(row, phase) }));

  if (query.view === 'done' || query.view === 'cancelled') {
    const phase = query.view === 'done' ? 'd' : 'c';
    const rows = await fetchStamped(
      phase === 'd' ? 'completed_at' : 'cancelled_at',
      cursor as Extract<Cursor, { phase: 'd' | 'c' }> | null,
      limit + 1,
    );
    more = rows.length > limit;
    page = asDone(rows.slice(0, limit), phase);
  } else if (query.view === 'all') {
    // Prima le aperte (ordine operativo), poi le completate (più recenti prima).
    let combined: { row: Row; cursor: Cursor }[] = [];
    if (!cursor || cursor.phase === 'o') {
      const open = await fetchOpen(cursor as Extract<Cursor, { phase: 'o' }> | null, limit + 1);
      combined = asOpen(open);
      if (open.length <= limit) {
        const done = await fetchStamped('completed_at', null, limit + 1 - open.length);
        combined = combined.concat(asDone(done, 'd'));
      }
    } else {
      const done = await fetchStamped(
        'completed_at',
        cursor as Extract<Cursor, { phase: 'd' }>,
        limit + 1,
      );
      combined = asDone(done, 'd');
    }
    more = combined.length > limit;
    page = combined.slice(0, limit);
  } else {
    const rows = await fetchOpen(cursor as Extract<Cursor, { phase: 'o' }> | null, limit + 1);
    more = rows.length > limit;
    page = asOpen(rows.slice(0, limit));
  }

  const last = page.at(-1);
  return {
    tasks: page.map((p) => toTask(p.row)),
    nextCursor: more && last ? encodeCursor(last.cursor) : null,
    asOf,
  };
}

/* ------------------------------ riepilogo ------------------------------ */

/** Conteggi operativi: servizio CONDIVISO da `GET /tasks/summary` e `GET /overview`. */
export async function taskCounts(
  db: Database,
  workspaceId: string,
  today: string,
): Promise<TaskCounts> {
  const row = await db.get<Record<keyof TaskCounts, number | null>>(sql`
    SELECT
      sum(CASE WHEN ${OPEN} THEN 1 ELSE 0 END) AS open,
      sum(CASE WHEN ${OPEN} AND t.due_on = ${today} THEN 1 ELSE 0 END) AS today,
      sum(CASE WHEN ${OPEN} AND t.due_on < ${today} THEN 1 ELSE 0 END) AS overdue,
      sum(CASE WHEN ${OPEN} AND t.due_on IS NULL THEN 1 ELSE 0 END) AS noDue,
      sum(CASE WHEN t.completed_at IS NOT NULL THEN 1 ELSE 0 END) AS done
    FROM tasks t LEFT JOIN cards k ON k.id = t.card_id AND k.workspace_id = t.workspace_id
    WHERE t.workspace_id = ${workspaceId} AND ${VISIBLE}`);
  return {
    open: row?.open ?? 0,
    today: row?.today ?? 0,
    overdue: row?.overdue ?? 0,
    noDue: row?.noDue ?? 0,
    done: row?.done ?? 0,
  };
}

export async function getTaskSummary(
  db: Database,
  workspaceId: string,
  now: number,
): Promise<TaskSummaryResponse> {
  const asOf = await getAsOf(db, workspaceId, now);
  return { asOf, counts: await taskCounts(db, workspaceId, asOf.today) };
}

/** Prossime scadenze (aperte, oggi o dopo) per l'Overview; `dueAt` resta per retrocompatibilità. */
export async function upcomingTasks(db: Database, workspaceId: string, asOf: TaskAsOf, take = 5) {
  const rows = await db.all<{ id: string; title: string; dueOn: string; cardId: string | null }>(
    sql`SELECT t.id, t.title, t.due_on AS dueOn, t.card_id AS cardId
        FROM tasks t LEFT JOIN cards k ON k.id = t.card_id AND k.workspace_id = t.workspace_id
        WHERE t.workspace_id = ${workspaceId} AND ${VISIBLE} AND ${OPEN} AND t.due_on >= ${asOf.today}
        ORDER BY t.due_on, ${NEG_RANK}, t.created_at, t.id LIMIT ${take}`,
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    dueOn: r.dueOn,
    dueAt: startOfLocalDay(r.dueOn, asOf.timeZone),
    cardId: r.cardId,
  }));
}

/* ------------------------------ creazione ------------------------------ */

async function cardState(db: Database, workspaceId: string, cardId: string) {
  const card = await db.get<{ id: string; archivedAt: number | null }>(
    sql`SELECT id, archived_at AS archivedAt FROM cards WHERE id = ${cardId} AND workspace_id = ${workspaceId}`,
  );
  if (!card) throw notFound('Scheda'); // inesistente o di un altro workspace
  return card;
}

function resolveReplay(row: Row, fingerprint: string): Task {
  if (row.requestFingerprint !== fingerprint) throw conflict(SAME_ID_OTHER_REQUEST);
  return toTask(row);
}

export async function createTask(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  input: CreateTaskInput,
  now: number,
): Promise<{ task: Task; replayed: boolean; asOf: TaskAsOf }> {
  const asOf = await getAsOf(db, workspaceId, now);
  const cardId = input.cardId ?? null;
  const description = input.description ?? null;
  const dueOn = input.dueOn ?? null;
  const fingerprint = await requestFingerprint('task.create', {
    workspaceId,
    title: input.title,
    description,
    kind: input.kind,
    priority: input.priority,
    dueOn,
    cardId,
  });
  const existing = await findRow(db, workspaceId, input.id);
  if (existing) return { task: resolveReplay(existing, fingerprint), replayed: true, asOf };
  if (cardId !== null) {
    const card = await cardState(db, workspaceId, cardId); // 404 anche per una card altrui
    if (card.archivedAt !== null) throw conflict(ARCHIVED);
  }

  try {
    const result = await d1
      .prepare(
        `INSERT INTO tasks (id, workspace_id, card_id, title, description, kind, priority, due_on,
                            request_fingerprint, created_at, updated_at)
         SELECT ?1, w.id, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10
         FROM workspaces w
         WHERE w.id = ?2
           AND (?3 IS NULL OR EXISTS (SELECT 1 FROM cards k WHERE k.id = ?3 AND k.workspace_id = w.id AND k.archived_at IS NULL))
           AND (SELECT count(*) FROM tasks WHERE workspace_id = w.id AND completed_at IS NULL AND cancelled_at IS NULL) < ?11
           AND (SELECT count(*) FROM tasks WHERE workspace_id = w.id) < ?12`,
      )
      .bind(
        input.id,
        workspaceId,
        cardId,
        input.title,
        description,
        input.kind,
        input.priority,
        dueOn,
        fingerprint,
        now,
        LIMITS.openTasksPerWorkspaceMax,
        LIMITS.tasksPerWorkspaceMax,
      )
      .run();
    if (result.meta.changes !== 1) {
      const raced = await findRow(db, workspaceId, input.id);
      if (raced) return { task: resolveReplay(raced, fingerprint), replayed: true, asOf };
      if (cardId !== null && (await cardState(db, workspaceId, cardId)).archivedAt !== null)
        throw conflict(ARCHIVED);
      const open = await db.get<{ n: number }>(
        sql`SELECT count(*) AS n FROM tasks WHERE workspace_id = ${workspaceId} AND completed_at IS NULL AND cancelled_at IS NULL`,
      );
      if ((open?.n ?? 0) >= LIMITS.openTasksPerWorkspaceMax)
        throw conflict(`Puoi avere al massimo ${LIMITS.openTasksPerWorkspaceMax} attività da fare`);
      throw conflict(`Puoi avere al massimo ${LIMITS.tasksPerWorkspaceMax} attività in totale`);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (isConstraintError(error)) {
      // Richiesta concorrente con lo stesso ID: converge sulla stessa attività o perde con 409.
      const raced = await findRow(db, workspaceId, input.id);
      if (raced) return { task: resolveReplay(raced, fingerprint), replayed: true, asOf };
      throw conflict('Identificativo già in uso: genera un nuovo modulo');
    }
    throw error;
  }
  return { task: await getTask(db, workspaceId, input.id), replayed: false, asOf };
}

/* ------------------------------ modifica e comandi ------------------------------ */

const monotonic = (now: number, previous: number) => Math.max(now, previous + 1);

export async function updateTask(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  id: string,
  input: UpdateTaskInput,
  now: number,
): Promise<{ task: Task; asOf: TaskAsOf }> {
  const asOf = await getAsOf(db, workspaceId, now);
  const row = await findRow(db, workspaceId, id);
  if (!row) throw notFound('Attività');
  if (row.updatedAt !== input.expectedUpdatedAt) throw conflict(STALE);
  if (row.cardArchivedAt !== null) throw conflict(ARCHIVED);
  if (taskStatus(row) !== 'open')
    throw conflict('Le attività completate o annullate non si modificano: riaprila prima');
  if (input.cardId !== undefined && input.cardId !== null && input.cardId !== row.cardId) {
    const card = await cardState(db, workspaceId, input.cardId);
    if (card.archivedAt !== null) throw conflict(ARCHIVED);
  }

  const sets: string[] = [];
  const binds: unknown[] = [];
  const set = (column: string, value: unknown) => {
    binds.push(value);
    sets.push(`${column} = ?${binds.length}`);
  };
  if (input.title !== undefined) set('title', input.title);
  if (input.description !== undefined) set('description', input.description);
  if (input.kind !== undefined) set('kind', input.kind);
  if (input.priority !== undefined) set('priority', input.priority);
  if (input.dueOn !== undefined) set('due_on', input.dueOn);
  if (input.cardId !== undefined) set('card_id', input.cardId);
  const next = monotonic(now, row.updatedAt);
  set('updated_at', next);
  binds.push(id, workspaceId, row.updatedAt);
  const n = binds.length;
  const result = await d1
    .prepare(
      `UPDATE tasks SET ${sets.join(', ')}
       WHERE id = ?${n - 2} AND workspace_id = ?${n - 1} AND updated_at = ?${n}
         AND completed_at IS NULL AND cancelled_at IS NULL
         AND (card_id IS NULL OR EXISTS (SELECT 1 FROM cards k WHERE k.id = tasks.card_id AND k.workspace_id = tasks.workspace_id AND k.archived_at IS NULL))
         ${
           input.cardId
             ? `AND EXISTS (SELECT 1 FROM cards k2 WHERE k2.id = ?${binds.push(input.cardId)} AND k2.workspace_id = tasks.workspace_id AND k2.archived_at IS NULL)`
             : ''
         }`,
    )
    .bind(...binds)
    .run();
  if (result.meta.changes !== 1) {
    const after = await findRow(db, workspaceId, id);
    if (!after) throw notFound('Attività');
    throw conflict(STALE);
  }
  return { task: await getTask(db, workspaceId, id), asOf };
}

export type TaskCommand = 'complete' | 'reopen' | 'cancel';

const TARGET: Record<TaskCommand, 'done' | 'open' | 'cancelled'> = {
  complete: 'done',
  reopen: 'open',
  cancel: 'cancelled',
};

/**
 * Comandi di stato idempotenti: lo stato già raggiunto restituisce 200 senza ritoccare i timestamp;
 * una transizione non ammessa (completare un'annullata, annullare una completata) è 409.
 */
export async function changeTaskState(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  id: string,
  command: TaskCommand,
  now: number,
): Promise<{ task: Task; asOf: TaskAsOf }> {
  const asOf = await getAsOf(db, workspaceId, now);
  const row = await findRow(db, workspaceId, id);
  if (!row) throw notFound('Attività');
  const current = taskStatus(row);
  const target = TARGET[command];
  if (current === target) return { task: toTask(row), asOf }; // replay: nessuna modifica
  if (row.cardArchivedAt !== null) throw conflict(ARCHIVED);
  if (command !== 'reopen' && current !== 'open')
    throw conflict(
      current === 'done'
        ? 'La attività è già completata: riaprila prima di annullarla'
        : 'La attività è annullata: riaprila prima di completarla',
    );

  const next = monotonic(now, row.updatedAt);
  const cardOk = `(card_id IS NULL OR EXISTS (SELECT 1 FROM cards k WHERE k.id = tasks.card_id AND k.workspace_id = tasks.workspace_id AND k.archived_at IS NULL))`;
  const statements = {
    complete: `UPDATE tasks SET completed_at = ?1, updated_at = ?1 WHERE id = ?2 AND workspace_id = ?3 AND updated_at = ?4
               AND completed_at IS NULL AND cancelled_at IS NULL AND ${cardOk}`,
    cancel: `UPDATE tasks SET cancelled_at = ?1, updated_at = ?1 WHERE id = ?2 AND workspace_id = ?3 AND updated_at = ?4
             AND completed_at IS NULL AND cancelled_at IS NULL AND ${cardOk}`,
    reopen: `UPDATE tasks SET completed_at = NULL, cancelled_at = NULL, updated_at = ?1 WHERE id = ?2 AND workspace_id = ?3 AND updated_at = ?4
             AND (completed_at IS NOT NULL OR cancelled_at IS NOT NULL) AND ${cardOk}
             AND (SELECT count(*) FROM tasks t2 WHERE t2.workspace_id = ?3 AND t2.completed_at IS NULL AND t2.cancelled_at IS NULL) < ?5`,
  } as const;
  const binds: unknown[] = [next, id, workspaceId, row.updatedAt];
  if (command === 'reopen') binds.push(LIMITS.openTasksPerWorkspaceMax);
  const result = await d1
    .prepare(statements[command])
    .bind(...binds)
    .run();
  if (result.meta.changes !== 1) {
    const after = await findRow(db, workspaceId, id);
    if (!after) throw notFound('Attività');
    if (taskStatus(after) === target) return { task: toTask(after), asOf }; // convergenza
    if (command === 'reopen' && taskStatus(after) !== 'open' && after.updatedAt === row.updatedAt)
      throw conflict(`Puoi avere al massimo ${LIMITS.openTasksPerWorkspaceMax} attività da fare`);
    throw conflict(STALE);
  }
  return { task: await getTask(db, workspaceId, id), asOf };
}
