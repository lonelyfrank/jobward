import type { Database } from '@jobward/database';
import { opportunitiesQuery, type GlobalSearchResponse } from '@jobward/schemas';
import { listBoards } from './boards';
import { searchOpportunities } from './opportunities';
import { foldSql, foldText, literalPattern, searchTerms } from './search-text';

/** Proiezioni limitate, isolate dal workspace verificato dal middleware. */
export async function searchWorkspace(
  d1: D1Database,
  db: Database,
  ws: string,
  q: string,
): Promise<GlobalSearchResponse> {
  const terms = searchTerms(q);
  if (!terms.length) return { opportunities: [], boards: [], interviews: [] };
  const text = foldSql(
    `coalesce(d.company, '') || char(10) || coalesce(d.position, '') || char(10) || k.title || char(10) || i.title || char(10) || i.type || char(10) || coalesce(strftime('%Y-%m-%d %d/%m/%Y', i.scheduled_at / 1000, 'unixepoch'), '') || char(10) || CASE i.type WHEN 'screening' THEN 'Primo contatto screening' WHEN 'technical' THEN 'Tecnico prova pratica' WHEN 'behavioral' THEN 'Conoscitivo motivazionale' WHEN 'panel' THEN 'Commissione più persone panel' WHEN 'final' THEN 'Finale' WHEN 'other' THEN 'Altro' ELSE i.type END`,
  );
  const [opportunities, boards, interviews] = await Promise.all([
    searchOpportunities(
      d1,
      db,
      ws,
      opportunitiesQuery.parse({ q, pageSize: '10', archived: 'include' }),
      { globalSearch: true },
    ),
    listBoards(db, ws),
    d1
      .prepare(
        `WITH search_interviews AS MATERIALIZED (
      SELECT i.id, i.title, i.type, i.scheduled_at AS scheduledAt, i.updated_at AS updatedAt,
      k.title AS cardTitle, k.id AS cardId, k.board_id AS boardId, d.company, ${text} AS searchText
      FROM interviews i JOIN cards k ON k.id = i.card_id AND k.workspace_id = i.workspace_id
      LEFT JOIN application_details d ON d.card_id = k.id AND d.workspace_id = k.workspace_id
      WHERE i.workspace_id = ?1)
      SELECT id, title, type, scheduledAt, cardTitle, cardId, boardId, company FROM search_interviews
      WHERE ${terms.map((_, index) => `searchText LIKE ?${index + 2} ESCAPE '\\'`).join(' AND ')}
      ORDER BY updatedAt DESC, id ASC LIMIT 10`,
      )
      .bind(ws, ...terms.map(literalPattern))
      .all<{
        id: string;
        title: string;
        type: string;
        scheduledAt: number | null;
        cardTitle: string;
        cardId: string;
        boardId: string;
        company: string | null;
      }>(),
  ]);
  return {
    opportunities: opportunities.items.map((card) => ({
      id: card.id,
      boardId: card.boardId,
      title: card.title,
      archived: card.archivedAt !== null,
      subtitle: [card.company, card.location, card.boardName, card.columnName]
        .filter(Boolean)
        .join(' · '),
    })),
    boards: boards
      .filter((board) =>
        terms.every((term) => foldText(`${board.name}\n${board.description ?? ''}`).includes(term)),
      )
      .slice(0, 10)
      .map((board) => ({
        id: board.id,
        title: board.name,
        subtitle: board.description ?? 'Bacheca di ricerca',
      })),
    interviews: interviews.results.map((interview) => ({
      id: interview.id,
      title: interview.title,
      boardId: interview.boardId,
      cardId: interview.cardId,
      subtitle: [
        interview.company,
        interview.cardTitle,
        interview.scheduledAt ? new Date(interview.scheduledAt).toISOString().slice(0, 10) : null,
      ]
        .filter(Boolean)
        .join(' · '),
    })),
  };
}
