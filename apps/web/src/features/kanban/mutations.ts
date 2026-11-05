import {
  cardResponse,
  columnResponse,
  type BoardDetailResponse,
  type Card,
  type CardDetailResponse,
  type CreateCardInput,
  type UpdateCardInput,
} from '@jobward/schemas';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useNotify } from '@/components/ui/notices';
import { invalidateSummaries, keys, scoped } from '@/features/boards/api';
import { useWorkspace } from '@/features/workspace/context';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { STAGE_LABELS } from '@/lib/labels';
import {
  appendCard,
  applyCardMove,
  applyColumnMove,
  removeCard,
  replaceCard,
  type CardMove,
  type ColumnMove,
} from './board-state';

/** Il messaggio del server è pensato per l'utente (es. 409); per gli altri errori uno generico. */
export function userMessage(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError && error.status >= 400 && error.status < 500
    ? error.message
    : fallback;
}

function useBoardCache(boardId: string) {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const key = keys.board(workspace.id, boardId);
  return {
    workspaceId: workspace.id,
    queryClient,
    key,
    get: () => queryClient.getQueryData<BoardDetailResponse>(key),
    set: (data: BoardDetailResponse | undefined) => queryClient.setQueryData(key, data),
  };
}

/** Ricarica la bacheca dal server solo quando non restano altre mutazioni dello stesso tipo in coda. */
function settleWhenIdle(
  queryClient: QueryClient,
  mutationKey: readonly unknown[],
  refresh: () => void,
) {
  if (queryClient.isMutating({ mutationKey }) === 1) refresh();
}

/**
 * Spostamento di una scheda con aggiornamento ottimistico e rollback.
 *
 * - `onMutate`: ferma i ricaricamenti in corso, salva lo stato, applica lo spostamento in locale.
 * - `onError`: ripristina lo stato salvato e avvisa l'utente (la scheda torna dov'era).
 * - `scope`: gli spostamenti della stessa bacheca vengono inviati UNO ALLA VOLTA, nell'ordine,
 *   così il server non vede mai richieste fuori sequenza.
 * - `onSettled`: a coda vuota riallinea alla verità del server.
 */
export function useMoveCard(boardId: string) {
  const cache = useBoardCache(boardId);
  const notify = useNotify();
  const updateCard = useUpdateCard(boardId);
  const mutationKey = ['move-card', cache.workspaceId, boardId] as const;

  return useMutation({
    mutationKey,
    scope: { id: `board-${boardId}` },
    mutationFn: (move: CardMove) =>
      apiRequest(scoped(cache.workspaceId, `/cards/${move.cardId}/move`), cardResponse, {
        method: 'POST',
        json: { columnId: move.columnId, afterCardId: move.afterCardId },
      }),
    onMutate: async (move) => {
      await cache.queryClient.cancelQueries({ queryKey: cache.key });
      const previous = cache.get();
      const next = previous ? applyCardMove(previous, move) : null;
      if (next) cache.set(next);
      return { previous };
    },
    onSuccess: ({ card }, move, context) => {
      // Suggerimento di fase (M2, D-3): INDIPENDENTE dallo spostamento, già concluso. Solo dopo un
      // cambio di colonna, solo se la colonna di arrivo dichiara una fase diversa da quella della
      // scheda, una volta per raffica di spostamenti, senza conferme modali. Fase ed esito non
      // vengono mai modificati dallo spostamento in sé.
      const target = cache.get()?.columns.find((c) => c.id === move.columnId);
      const fromColumnId = context?.previous?.cards.find((c) => c.id === move.cardId)?.columnId;
      const category = target?.category ?? null;
      if (
        category &&
        fromColumnId !== move.columnId &&
        card.stage !== category &&
        cache.queryClient.isMutating({ mutationKey }) === 1
      ) {
        notify(
          'success',
          `La colonna “${target?.name}” corrisponde alla fase “${STAGE_LABELS[category]}”.`,
          {
            label: 'Imposta fase',
            onClick: () =>
              updateCard.mutate(
                { cardId: card.id, input: { stage: category } },
                {
                  onSuccess: () =>
                    notify('success', `Fase impostata su “${STAGE_LABELS[category]}”.`),
                  onError: () => notify('error', 'Non siamo riusciti a impostare la fase.'),
                },
              ),
          },
        );
      }
    },
    onError: (error, _move, context) => {
      if (context?.previous) cache.set(context.previous);
      notify(
        'error',
        `${userMessage(error, 'Spostamento non riuscito.')} La scheda è tornata nella posizione originale.`,
      );
    },
    onSettled: (_data, _error, move) => {
      void cache.queryClient.invalidateQueries({
        queryKey: keys.card(cache.workspaceId, move.cardId),
      });
      settleWhenIdle(cache.queryClient, mutationKey, () => {
        void cache.queryClient.invalidateQueries({ queryKey: cache.key });
        invalidateSummaries(cache.queryClient, cache.workspaceId);
      });
    },
  });
}

export function useMoveColumn(boardId: string) {
  const cache = useBoardCache(boardId);
  const notify = useNotify();
  const mutationKey = ['move-column', cache.workspaceId, boardId] as const;

  return useMutation({
    mutationKey,
    scope: { id: `board-${boardId}` },
    mutationFn: (move: ColumnMove) =>
      apiRequest(scoped(cache.workspaceId, `/columns/${move.columnId}/move`), columnResponse, {
        method: 'POST',
        json: { afterId: move.afterColumnId },
      }),
    onMutate: async (move) => {
      await cache.queryClient.cancelQueries({ queryKey: cache.key });
      const previous = cache.get();
      const next = previous ? applyColumnMove(previous, move) : null;
      if (next) cache.set(next);
      return { previous };
    },
    onError: (error, _move, context) => {
      if (context?.previous) cache.set(context.previous);
      notify(
        'error',
        `${userMessage(error, 'Spostamento non riuscito.')} La colonna è tornata nella posizione originale.`,
      );
    },
    onSettled: () => {
      settleWhenIdle(cache.queryClient, mutationKey, () => {
        void cache.queryClient.invalidateQueries({ queryKey: cache.key });
      });
    },
  });
}

/** Creazione rapida: la scheda compare quando il server conferma (nessun dato provvisorio). */
export function useCreateCard(boardId: string) {
  const cache = useBoardCache(boardId);
  return useMutation({
    mutationFn: (input: Pick<CreateCardInput, 'columnId' | 'title'>) =>
      apiRequest(scoped(cache.workspaceId, '/cards'), cardResponse, {
        method: 'POST',
        json: input,
      }),
    onSuccess: ({ card }) => {
      const current = cache.get();
      if (current) cache.set(appendCard(current, card));
      invalidateSummaries(cache.queryClient, cache.workspaceId);
    },
  });
}

export function useUpdateCard(boardId: string) {
  const cache = useBoardCache(boardId);
  return useMutation({
    mutationFn: ({ cardId, input }: { cardId: string; input: UpdateCardInput }) =>
      apiRequest(scoped(cache.workspaceId, `/cards/${cardId}`), cardResponse, {
        method: 'PATCH',
        json: input,
      }),
    onSuccess: ({ card }) => {
      const current = cache.get();
      if (current) cache.set(replaceCard(current, card));
      cache.queryClient.setQueryData(
        keys.card(cache.workspaceId, card.id),
        (old: CardDetailResponse | undefined) => (old ? { ...old, card } : old),
      );
      // La cronologia può essere cambiata (es. priorità): si ricarica il dettaglio.
      void cache.queryClient.invalidateQueries({ queryKey: keys.card(cache.workspaceId, card.id) });
      invalidateSummaries(cache.queryClient, cache.workspaceId);
    },
  });
}

export function useArchiveCard(boardId: string) {
  const cache = useBoardCache(boardId);
  return useMutation({
    mutationFn: (cardId: string) =>
      apiRequest(scoped(cache.workspaceId, `/cards/${cardId}/archive`), cardResponse, {
        method: 'POST',
        json: {},
      }),
    onSuccess: ({ card }) => {
      const current = cache.get();
      if (current) cache.set(removeCard(current, card.id));
      void cache.queryClient.invalidateQueries({
        queryKey: keys.archived(cache.workspaceId, boardId),
      });
      void cache.queryClient.invalidateQueries({ queryKey: keys.card(cache.workspaceId, card.id) });
      invalidateSummaries(cache.queryClient, cache.workspaceId);
    },
  });
}

export function useRestoreCard(boardId: string) {
  const cache = useBoardCache(boardId);
  return useMutation({
    mutationFn: (cardId: string) =>
      apiRequest(scoped(cache.workspaceId, `/cards/${cardId}/restore`), cardResponse, {
        method: 'POST',
        json: {},
      }),
    onSuccess: ({ card }) => {
      void cache.queryClient.invalidateQueries({ queryKey: cache.key });
      void cache.queryClient.invalidateQueries({
        queryKey: keys.archived(cache.workspaceId, boardId),
      });
      void cache.queryClient.invalidateQueries({ queryKey: keys.card(cache.workspaceId, card.id) });
      invalidateSummaries(cache.queryClient, cache.workspaceId);
    },
  });
}

export type { Card };
