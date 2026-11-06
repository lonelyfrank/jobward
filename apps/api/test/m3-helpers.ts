import { env } from 'cloudflare:workers';
import { addCard, createMinimalBoard, newUser, type Api } from './kanban-helpers';

/** ID stabile generato dal «client» (formato validato da `clientIdSchema`). */
export const uid = () => crypto.randomUUID();

export async function setupCard(email: string, title = 'Infermiere') {
  const user = await newUser(email);
  const board = await createMinimalBoard(user.api);
  const card = await addCard(user.api, board.columnIds[0]!, title);
  return { ...user, ...board, card };
}
export type Ctx = Awaited<ReturnType<typeof setupCard>>;

export interface EventRow {
  id: string;
  type: string;
  metadata: string;
  occurred_at: number;
  dedupe_key: string | null;
  operation_id: string | null;
  request_fingerprint: string | null;
}

/** Eventi della scheda letti direttamente dal database (comprese le colonne di idempotenza). */
export async function dbEvents(cardId: string): Promise<EventRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, type, metadata, occurred_at, dedupe_key, operation_id, request_fingerprint
     FROM activity_events WHERE card_id = ?1 ORDER BY occurred_at, id`,
  )
    .bind(cardId)
    .all<EventRow>();
  return results;
}
export const eventTypes = async (cardId: string) => (await dbEvents(cardId)).map((e) => e.type);
export const countOf = async (type: string, cardId: string) =>
  (await dbEvents(cardId)).filter((e) => e.type === type).length;

export const transition = (api: Api, cardId: string, body: Record<string, unknown>) =>
  api.post(`/cards/${cardId}/pipeline`, { id: uid(), ...body });

export async function cardState(api: Api, cardId: string) {
  const { card } = (await api.get(`/cards/${cardId}`)).body;
  return { stage: card.stage, outcome: card.outcome, appliedOn: card.appliedOn };
}

/** Esegue SQL di test (trigger che simulano un guasto, scritture dirette). */
export const exec = (sql: string) => env.DB.exec(sql.replaceAll(/\s+/g, ' ').trim());
