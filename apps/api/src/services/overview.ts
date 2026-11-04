import { schema, type Database } from '@meet-roulette/database';
import type { OverviewResponse } from '@meet-roulette/schemas';
import { and, asc, count, desc, eq, gte, isNotNull, isNull, lt } from 'drizzle-orm';

/**
 * Riepilogo della ricerca, calcolato esclusivamente da dati persistiti.
 * Con workspace vuoto tutti i contatori sono zero: nessun dato dimostrativo.
 */
export async function getOverview(
  db: Database,
  workspaceId: string,
  now: number,
): Promise<OverviewResponse> {
  const { boards, cards, applicationDetails, tasks } = schema;
  const liveCard = and(eq(cards.workspaceId, workspaceId), isNull(cards.archivedAt));
  const openTask = and(eq(tasks.workspaceId, workspaceId), isNull(tasks.completedAt));

  const [boardCount, cardCount, submitted, interviews, openTasks, overdue, upcoming, recent] =
    await db.batch([
      db.select({ n: count() }).from(boards).where(eq(boards.workspaceId, workspaceId)),
      db.select({ n: count() }).from(cards).where(liveCard),
      db
        .select({ n: count() })
        .from(applicationDetails)
        .innerJoin(cards, eq(cards.id, applicationDetails.cardId))
        .where(and(liveCard, isNotNull(applicationDetails.appliedOn))),
      db
        .select({ n: count() })
        .from(applicationDetails)
        .innerJoin(cards, eq(cards.id, applicationDetails.cardId))
        .where(and(liveCard, eq(applicationDetails.stage, 'interviewing'))),
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

  return {
    workspaceId,
    counts: {
      boards: boardCount[0]?.n ?? 0,
      opportunities: cardCount[0]?.n ?? 0,
      applicationsSubmitted: submitted[0]?.n ?? 0,
      interviews: interviews[0]?.n ?? 0,
      openTasks: openTasks[0]?.n ?? 0,
      overdueTasks: overdue[0]?.n ?? 0,
    },
    upcomingTasks: upcoming.flatMap((t) => (t.dueAt === null ? [] : [{ ...t, dueAt: t.dueAt }])),
    recentBoards: recent,
  };
}
