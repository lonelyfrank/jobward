import type { Database } from '@jobward/database';
import type { CalendarItem, CalendarQuery, CalendarResponse } from '@jobward/schemas';
import { addDays, localDate, startOfLocalDay } from '@jobward/shared';
import { sql } from 'drizzle-orm';

/**
 * Calendario (D-06): colloqui programmati o svolti, attività con scadenza e scadenze degli annunci, nel
 * fuso del workspace. Una sola vista sugli stessi dati: nessuna copia, nessun evento esterno.
 */
export async function getCalendar(
  db: Database,
  workspaceId: string,
  query: CalendarQuery,
): Promise<CalendarResponse> {
  const [workspace] = await db.all<{ timezone: string }>(
    sql`SELECT timezone FROM workspaces WHERE id = ${workspaceId}`,
  );
  const timeZone = workspace?.timezone ?? 'UTC';
  const fromMs = startOfLocalDay(query.from, timeZone);
  const toMs = startOfLocalDay(addDays(query.to, 1), timeZone);

  const interviews = await db.all<{
    id: string;
    title: string;
    status: string;
    scheduledAt: number;
    cardId: string;
    cardTitle: string;
    boardId: string | null;
  }>(
    sql`SELECT i.id, i.title, i.status, i.scheduled_at AS scheduledAt, k.id AS cardId, k.title AS cardTitle,
               k.board_id AS boardId
        FROM interviews i JOIN cards k ON k.id = i.card_id
        WHERE i.workspace_id = ${workspaceId} AND i.scheduled_at IS NOT NULL
          AND i.status <> 'cancelled' AND k.archived_at IS NULL
          AND i.scheduled_at >= ${fromMs} AND i.scheduled_at < ${toMs}`,
  );
  const tasks = await db.all<{
    id: string;
    title: string;
    dueOn: string;
    done: number;
    cardId: string | null;
    cardTitle: string | null;
    boardId: string | null;
  }>(
    sql`SELECT t.id, t.title, t.due_on AS dueOn, (t.completed_at IS NOT NULL) AS done,
               k.id AS cardId, k.title AS cardTitle, k.board_id AS boardId
        FROM tasks t LEFT JOIN cards k ON k.id = t.card_id
        WHERE t.workspace_id = ${workspaceId} AND t.cancelled_at IS NULL AND t.due_on IS NOT NULL
          AND t.due_on BETWEEN ${query.from} AND ${query.to}
          AND (k.id IS NULL OR k.archived_at IS NULL)`,
  );
  const deadlines = await db.all<{
    cardId: string;
    cardTitle: string;
    deadlineOn: string;
    boardId: string | null;
  }>(
    sql`SELECT k.id AS cardId, k.title AS cardTitle, d.deadline_on AS deadlineOn, k.board_id AS boardId
        FROM application_details d JOIN cards k ON k.id = d.card_id
        WHERE d.workspace_id = ${workspaceId} AND k.archived_at IS NULL
          AND d.deadline_on BETWEEN ${query.from} AND ${query.to}`,
  );

  const items: CalendarItem[] = [
    ...interviews.map((i) => ({
      kind: 'interview' as const,
      id: i.id,
      date: localDate(i.scheduledAt, timeZone),
      at: i.scheduledAt,
      title: i.title,
      status: i.status,
      cardId: i.cardId,
      cardTitle: i.cardTitle,
      boardId: i.boardId,
    })),
    ...tasks.map((t) => ({
      kind: 'task' as const,
      id: t.id,
      date: t.dueOn,
      at: null,
      title: t.title,
      status: t.done ? 'done' : 'open',
      cardId: t.cardId,
      cardTitle: t.cardTitle,
      boardId: t.boardId,
    })),
    ...deadlines.map((d) => ({
      kind: 'deadline' as const,
      id: d.cardId,
      date: d.deadlineOn,
      at: null,
      title: 'Scadenza dell’annuncio',
      status: null,
      cardId: d.cardId,
      cardTitle: d.cardTitle,
      boardId: d.boardId,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.at ?? 0) - (b.at ?? 0));
  return { timeZone, items };
}
