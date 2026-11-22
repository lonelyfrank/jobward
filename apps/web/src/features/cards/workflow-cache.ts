import type { QueryClient } from '@tanstack/react-query';
import { invalidateSummaries, keys } from '@/features/boards/api';

/** Dipendenze della sola candidatura/bacheca coinvolta, sempre nel workspace corrente. */
export async function refreshWorkflow(
  client: QueryClient,
  ws: string,
  cardId: string,
  boardId: string | null,
  resource?: 'notes' | 'documents' | 'interviews',
) {
  const affected = [
    keys.card(ws, cardId),
    ...(boardId ? [keys.board(ws, boardId)] : []),
    keys.timeline(ws, cardId),
    keys.applications(ws, cardId),
    ...(resource ? [keys[resource](ws, cardId)] : []),
  ];
  invalidateSummaries(client, ws);
  await Promise.all(affected.map((queryKey) => client.invalidateQueries({ queryKey })));
}
