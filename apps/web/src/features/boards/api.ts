import {
  archivedCardsResponse,
  boardCreatedResponse,
  boardDetailResponse,
  boardResponse,
  boardsResponse,
  cardDetailResponse,
  cardResponse,
  columnResponse,
  deletedResponse,
  type BoardDetailResponse,
  type BoardListItem,
  type CreateBoardInput,
  type CreateColumnInput,
  type UpdateBoardInput,
  type UpdateColumnInput,
} from '@meet-roulette/schemas';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { applyPlacement } from '@meet-roulette/shared';
import { apiRequest } from '@/lib/api';
import { useWorkspace } from '@/features/workspace/context';

/** Chiavi di cache: sempre qualificate dal workspace, così non si mescolano mai tra utenti. */
export const keys = {
  boards: (ws: string) => ['boards', ws] as const,
  board: (ws: string, boardId: string) => ['board', ws, boardId] as const,
  archived: (ws: string, boardId: string) => ['archived', ws, boardId] as const,
  card: (ws: string, cardId: string) => ['card', ws, cardId] as const,
  overview: (ws: string) => ['overview', ws] as const,
  labels: (ws: string) => ['labels', ws] as const,
  boardFields: (ws: string, boardId: string) => ['board-fields', ws, boardId] as const,
  cardFields: (ws: string, cardId: string) => ['card-fields', ws, cardId] as const,
  /** Prefisso di tutte le ricerche del workspace (si invalida in blocco dopo una modifica). */
  opportunities: (ws: string) => ['opportunities', ws] as const,
};

/** Percorso API con il perimetro di workspace (verificato dal server per ogni richiesta). */
export const scoped = (ws: string, path: string) =>
  `${path}${path.includes('?') ? '&' : '?'}workspaceId=${encodeURIComponent(ws)}`;

/** Dopo una modifica ai dati, i riepiloghi che li aggregano devono essere ricalcolati. */
export function invalidateSummaries(queryClient: QueryClient, ws: string) {
  void queryClient.invalidateQueries({ queryKey: keys.overview(ws) });
  void queryClient.invalidateQueries({ queryKey: keys.boards(ws) });
  // Elenchi e tabella derivano dalle stesse schede: restano coerenti col Kanban.
  void queryClient.invalidateQueries({ queryKey: keys.opportunities(ws) });
}

// ---------------------------------------------------------------------------
// Bacheche
// ---------------------------------------------------------------------------

export function useBoards() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: keys.boards(workspace.id),
    queryFn: () => apiRequest(scoped(workspace.id, '/boards'), boardsResponse),
    select: (data) => data.boards,
  });
}

export function useBoardDetail(boardId: string, enabled = true) {
  const { workspace } = useWorkspace();
  return useQuery({
    enabled,
    queryKey: keys.board(workspace.id, boardId),
    queryFn: () => apiRequest(scoped(workspace.id, `/boards/${boardId}`), boardDetailResponse),
    // Un 404 non si risolve ritentando (bacheca eliminata o non accessibile).
    retry: (count, error) => !('status' in error && error.status === 404) && count < 2,
  });
}

export function useCreateBoard() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CreateBoardInput> & { name: string }) =>
      apiRequest(scoped(workspace.id, '/boards'), boardCreatedResponse, {
        method: 'POST',
        json: input,
      }),
    onSuccess: () => invalidateSummaries(queryClient, workspace.id),
  });
}

export function useUpdateBoard() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ boardId, input }: { boardId: string; input: UpdateBoardInput }) =>
      apiRequest(scoped(workspace.id, `/boards/${boardId}`), boardResponse, {
        method: 'PATCH',
        json: input,
      }),
    onSuccess: ({ board }) => {
      // Aggiorna subito la vista aperta; il resto si riallinea con l'invalidazione.
      queryClient.setQueryData<BoardDetailResponse>(keys.board(workspace.id, board.id), (old) =>
        old ? { ...old, board } : old,
      );
      invalidateSummaries(queryClient, workspace.id);
    },
  });
}

export function useDeleteBoard() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (boardId: string) =>
      apiRequest(scoped(workspace.id, `/boards/${boardId}`), deletedResponse, {
        method: 'DELETE',
        json: {},
      }),
    onSuccess: (_data, boardId) => {
      queryClient.removeQueries({ queryKey: keys.board(workspace.id, boardId) });
      invalidateSummaries(queryClient, workspace.id);
    },
  });
}

/** Riordino delle bacheche con aggiornamento ottimistico dell'elenco. */
export function useMoveBoard() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const key = keys.boards(workspace.id);
  return useMutation({
    mutationKey: ['move-board', workspace.id],
    scope: { id: `boards-${workspace.id}` },
    mutationFn: ({ boardId, afterId }: { boardId: string; afterId: string | null }) =>
      apiRequest(scoped(workspace.id, `/boards/${boardId}/move`), boardResponse, {
        method: 'POST',
        json: { afterId },
      }),
    onMutate: async ({ boardId, afterId }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<{ boards: BoardListItem[] }>(key);
      if (previous) {
        const moved = previous.boards.find((b) => b.id === boardId);
        const siblings = previous.boards.filter((b) => b.id !== boardId);
        const next = moved ? applyPlacement(siblings, moved, afterId) : null;
        if (next) queryClient.setQueryData(key, { boards: next });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      // Rollback: l'ordine torna quello confermato dal server.
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      // Si riallinea al server solo quando non restano altri spostamenti in coda.
      if (queryClient.isMutating({ mutationKey: ['move-board', workspace.id] }) === 1) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export type { BoardListItem };

// ---------------------------------------------------------------------------
// Colonne
// ---------------------------------------------------------------------------

export function useCreateColumn(boardId: string) {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CreateColumnInput> & { name: string }) =>
      apiRequest(scoped(workspace.id, `/boards/${boardId}/columns`), columnResponse, {
        method: 'POST',
        json: input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.board(workspace.id, boardId) });
      invalidateSummaries(queryClient, workspace.id);
    },
  });
}

export function useUpdateColumn(boardId: string) {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ columnId, input }: { columnId: string; input: UpdateColumnInput }) =>
      apiRequest(scoped(workspace.id, `/columns/${columnId}`), columnResponse, {
        method: 'PATCH',
        json: input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.board(workspace.id, boardId) });
    },
  });
}

export function useDeleteColumn(boardId: string) {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      columnId,
      moveCardsToColumnId,
    }: {
      columnId: string;
      moveCardsToColumnId: string | null;
    }) =>
      apiRequest(scoped(workspace.id, `/columns/${columnId}`), deletedResponse, {
        method: 'DELETE',
        json: { moveCardsToColumnId },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.board(workspace.id, boardId) });
      invalidateSummaries(queryClient, workspace.id);
    },
  });
}

// ---------------------------------------------------------------------------
// Schede (le mutazioni con aggiornamento ottimistico sono in features/kanban)
// ---------------------------------------------------------------------------

export function useCardDetail(cardId: string | undefined) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: keys.card(workspace.id, cardId ?? ''),
    queryFn: () => apiRequest(scoped(workspace.id, `/cards/${cardId}`), cardDetailResponse),
    enabled: cardId !== undefined,
    retry: (count, error) => !('status' in error && error.status === 404) && count < 2,
  });
}

export function useArchivedCards(boardId: string, enabled: boolean) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: keys.archived(workspace.id, boardId),
    queryFn: () =>
      apiRequest(scoped(workspace.id, `/boards/${boardId}/archived`), archivedCardsResponse),
    enabled,
    select: (data) => data.cards,
    // Nell'elenco delle archiviate i dati devono essere sempre freschi.
    staleTime: 0,
  });
}

export { cardResponse };
