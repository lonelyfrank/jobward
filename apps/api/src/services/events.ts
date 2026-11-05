import { newId } from '@meet-roulette/database';

/** Eventi di cronologia e aggiornamento della bacheca, condivisi dai servizi di dominio. */

/** Istruzione che registra un evento solo se `existsSql` (sulla scheda) è ancora vera. */
export function eventStatement(
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

export const touchBoard = (d1: D1Database, workspaceId: string, boardId: string, now: number) =>
  d1
    .prepare(`UPDATE boards SET updated_at = ?1 WHERE id = ?2 AND workspace_id = ?3`)
    .bind(now, boardId, workspaceId);
