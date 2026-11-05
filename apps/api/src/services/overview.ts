import { schema, type Database } from '@meet-roulette/database';
import type { OverviewResponse } from '@meet-roulette/schemas';
import { SUBMITTED_STAGES } from '@meet-roulette/shared';
import { and, asc, count, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';

/**
 * Riepilogo della ricerca, calcolato esclusivamente da dati persistiti.
 * Con workspace vuoto tutti i contatori sono zero: nessun dato dimostrativo.
 */
export async function getOverview(
  db: Database,
  workspaceId: string,
  now: number,
): Promise<OverviewResponse> {
  const { boards, tasks } = schema;
  const openTask = and(eq(tasks.workspaceId, workspaceId), isNull(tasks.completedAt));

  const [boardCount, openTasks, overdue, upcoming, recent] = await db.batch([
    db.select({ n: count() }).from(boards).where(eq(boards.workspaceId, workspaceId)),
    db.select({ n: count() }).from(tasks).where(openTask),
    db
      .select({ n: count() })
      .from(tasks)
      .where(and(openTask, lt(tasks.dueAt, now))),
    db
      .select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueAt, cardId: tasks.cardId })
      .from(tasks)
      .where(and(openTask, gte(tasks.dueAt, now)))
      .orderBy(asc(tasks.dueAt))
      .limit(5),
    db
      .select({
        id: boards.id,
        name: boards.name,
        color: boards.color,
        icon: boards.icon,
        updatedAt: boards.updatedAt,
      })
      .from(boards)
      .where(eq(boards.workspaceId, workspaceId))
      .orderBy(desc(boards.updatedAt))
      .limit(5),
  ]);

  // Statistiche delle opportunità (definizioni in docs/m2/architecture.md, D-4). UNA riga per scheda
  // (join 1:1, nessuna moltiplicazione) e solo schede non archiviate: nessuna doppia contabilizzazione.
  //  - inviata: data di candidatura registrata OPPURE fase che la implica (non il nome della colonna);
  //  - in colloquio: fase "colloquio" e candidatura non ancora conclusa (esito assente o "in attesa").
  const submittedStages = sql.join(
    SUBMITTED_STAGES.map((stage) => sql`${stage}`),
    sql`, `,
  );
  const stats = await db.get<{
    opportunities: number;
    submitted: number | null;
    interviews: number | null;
  }>(sql`
    SELECT count(*) AS opportunities,
           sum(CASE WHEN d.applied_on IS NOT NULL OR d.stage IN (${submittedStages}) THEN 1 ELSE 0 END) AS submitted,
           sum(CASE WHEN d.stage = 'interviewing' AND (d.outcome IS NULL OR d.outcome = 'pending') THEN 1 ELSE 0 END) AS interviews
    FROM cards k
    LEFT JOIN application_details d ON d.card_id = k.id AND d.workspace_id = k.workspace_id
    WHERE k.workspace_id = ${workspaceId} AND k.archived_at IS NULL`);

  // Fuori dal batch e in SQL esplicito: in un batch D1 i risultati sono oggetti indicizzati per
  // nome di colonna, quindi due colonne chiamate `name` (bacheca e colonna) si fonderebbero e
  // i valori si sfaserebbero (verificato da test).
  const recentCards = await db.all<OverviewResponse['recentCards'][number]>(sql`
    SELECT k.id AS id, k.title AS title, k.board_id AS boardId,
           b.name AS boardName, c.name AS columnName, k.updated_at AS updatedAt
    FROM cards k
    JOIN boards b ON b.id = k.board_id AND b.workspace_id = k.workspace_id
    JOIN board_columns c ON c.id = k.column_id AND c.workspace_id = k.workspace_id
    WHERE k.workspace_id = ${workspaceId} AND k.archived_at IS NULL
    ORDER BY k.updated_at DESC, k.id
    LIMIT 5`);

  return {
    workspaceId,
    counts: {
      boards: boardCount[0]?.n ?? 0,
      opportunities: stats?.opportunities ?? 0,
      applicationsSubmitted: stats?.submitted ?? 0,
      interviews: stats?.interviews ?? 0,
      openTasks: openTasks[0]?.n ?? 0,
      overdueTasks: overdue[0]?.n ?? 0,
    },
    upcomingTasks: upcoming.flatMap((t) => (t.dueAt === null ? [] : [{ ...t, dueAt: t.dueAt }])),
    recentBoards: recent,
    recentCards,
  };
}
