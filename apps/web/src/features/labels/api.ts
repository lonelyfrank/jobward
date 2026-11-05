import {
  cardLabelsResponse,
  deletedResponse,
  labelResponse,
  labelsResponse,
  type BoardDetailResponse,
  type CardDetailResponse,
  type CreateLabelInput,
  type UpdateLabelInput,
} from '@meet-roulette/schemas';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { invalidateSummaries, keys, scoped } from '@/features/boards/api';
import { useWorkspace } from '@/features/workspace/context';
import { apiRequest } from '@/lib/api';

export function useLabels() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: keys.labels(workspace.id),
    queryFn: () => apiRequest(scoped(workspace.id, '/labels'), labelsResponse),
    select: (data) => data.labels,
  });
}

/** Le etichette compaiono su schede, elenchi e tabella: dopo una modifica si riallineano tutti. */
function refreshLabelViews(queryClient: QueryClient, ws: string) {
  void queryClient.invalidateQueries({ queryKey: keys.labels(ws) });
  void queryClient.invalidateQueries({ queryKey: ['board', ws] });
  void queryClient.invalidateQueries({ queryKey: ['card', ws] });
  void queryClient.invalidateQueries({ queryKey: keys.opportunities(ws) });
}

export function useCreateLabel() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CreateLabelInput> & { name: string }) =>
      apiRequest(scoped(workspace.id, '/labels'), labelResponse, { method: 'POST', json: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.labels(workspace.id) }),
  });
}

export function useUpdateLabel() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ labelId, input }: { labelId: string; input: UpdateLabelInput }) =>
      apiRequest(scoped(workspace.id, `/labels/${labelId}`), labelResponse, {
        method: 'PATCH',
        json: input,
      }),
    onSuccess: () => refreshLabelViews(queryClient, workspace.id),
  });
}

export function useDeleteLabel() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ labelId, force }: { labelId: string; force: boolean }) =>
      apiRequest(scoped(workspace.id, `/labels/${labelId}`), deletedResponse, {
        method: 'DELETE',
        json: { force },
      }),
    onSuccess: () => refreshLabelViews(queryClient, workspace.id),
  });
}

/** Assegna/rimuove con la risposta del server (nessun dato provvisorio da annullare). */
export function useCardLabels(cardId: string, boardId: string) {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const apply = (labelIds: string[]) => {
    queryClient.setQueryData<BoardDetailResponse>(keys.board(workspace.id, boardId), (old) =>
      old
        ? { ...old, cards: old.cards.map((c) => (c.id === cardId ? { ...c, labelIds } : c)) }
        : old,
    );
    queryClient.setQueryData<CardDetailResponse>(keys.card(workspace.id, cardId), (old) =>
      old ? { ...old, card: { ...old.card, labelIds } } : old,
    );
    void queryClient.invalidateQueries({ queryKey: keys.labels(workspace.id) });
    invalidateSummaries(queryClient, workspace.id);
  };
  const assign = useMutation({
    mutationFn: (labelId: string) =>
      apiRequest(scoped(workspace.id, `/cards/${cardId}/labels`), cardLabelsResponse, {
        method: 'POST',
        json: { labelId },
      }),
    onSuccess: ({ labelIds }) => apply(labelIds),
  });
  const unassign = useMutation({
    mutationFn: (labelId: string) =>
      apiRequest(scoped(workspace.id, `/cards/${cardId}/labels/${labelId}`), cardLabelsResponse, {
        method: 'DELETE',
        json: {},
      }),
    onSuccess: ({ labelIds }) => apply(labelIds),
  });
  return { assign, unassign };
}
