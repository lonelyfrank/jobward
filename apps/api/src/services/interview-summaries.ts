import type { Database } from '@meet-roulette/database';
import {
  EMPTY_INTERVIEW_SUMMARY,
  summarizeInterviews,
  type InterviewSummary,
  type InterviewSummaryRow,
} from '@meet-roulette/schemas';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Riepilogo per Kanban, tabella e pannello (una query per bacheca o per pagina)
// ---------------------------------------------------------------------------

interface SummaryRow {
  cardId: string;
  id: string;
  sequence: number;
  title: string;
  type: InterviewSummaryRow['type'];
  status: InterviewSummaryRow['status'];
  scheduledAt: number | null;
  timezone: string | null;
  modality: InterviewSummaryRow['modality'];
  hasFeedback: number;
}

const SUMMARY_COLUMNS = sql`i.card_id AS cardId, i.id AS id, i.sequence AS sequence, i.title AS title, i.type AS type,
  i.status AS status, i.scheduled_at AS scheduledAt, i.timezone AS timezone, i.modality AS modality,
  (i.feedback_notes IS NOT NULL OR i.result IS NOT NULL) AS hasFeedback`;

function group(rows: SummaryRow[], now: number): Map<string, InterviewSummary> {
  const byCard = new Map<string, InterviewSummaryRow[]>();
  for (const row of rows) {
    const list = byCard.get(row.cardId) ?? [];
    list.push({ ...row, hasFeedback: Boolean(row.hasFeedback) });
    byCard.set(row.cardId, list);
  }
  return new Map([...byCard].map(([cardId, list]) => [cardId, summarizeInterviews(list, now)]));
}

/** Riepilogo di tutte le schede di una bacheca: UNA query, indipendente dal numero di schede. */
export async function summariesForBoard(
  db: Database,
  workspaceId: string,
  boardId: string,
  now = Date.now(),
): Promise<Map<string, InterviewSummary>> {
  const rows = await db.all<SummaryRow>(sql`
    SELECT ${SUMMARY_COLUMNS}
    FROM interviews i JOIN cards k ON k.id = i.card_id AND k.workspace_id = i.workspace_id
    WHERE i.workspace_id = ${workspaceId} AND k.board_id = ${boardId} AND i.status <> 'cancelled'`);
  return group(rows, now);
}

/** Riepilogo per un insieme limitato di schede (una pagina di ricerca, una singola scheda). */
export async function summariesForCards(
  db: Database,
  workspaceId: string,
  cardIds: string[],
  now = Date.now(),
): Promise<Map<string, InterviewSummary>> {
  if (cardIds.length === 0) return new Map();
  const ids = sql.join(
    cardIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const rows = await db.all<SummaryRow>(sql`
    SELECT ${SUMMARY_COLUMNS} FROM interviews i
    WHERE i.workspace_id = ${workspaceId} AND i.card_id IN (${ids}) AND i.status <> 'cancelled'`);
  return group(rows, now);
}

/** Aggiunge `interviewSummary` alle schede usando la mappa calcolata. */
export function withSummaries<T extends { id: string }>(
  cards: T[],
  summaries: Map<string, InterviewSummary>,
): (T & { interviewSummary: InterviewSummary })[] {
  return cards.map((card) => ({
    ...card,
    interviewSummary: summaries.get(card.id) ?? EMPTY_INTERVIEW_SUMMARY,
  }));
}
