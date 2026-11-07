import { noteResponse, notesPageResponse, type Card, type CreateNoteInput } from '@jobward/schemas';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { keys, scoped } from '@/features/boards/api';
import { refreshWorkflow } from '@/features/cards/workflow-cache';
import { useWorkspace } from '@/features/workspace/context';
import { apiRequest } from '@/lib/api';

export function useNotes(cardId: string, enabled: boolean) {
  const { workspace } = useWorkspace();
  return useInfiniteQuery({
    queryKey: keys.notes(workspace.id, cardId),
    enabled,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      apiRequest(
        scoped(
          workspace.id,
          `/cards/${cardId}/notes?limit=25${pageParam ? '&before=' + encodeURIComponent(pageParam) : ''}`,
        ),
        notesPageResponse,
        { signal },
      ),
    getNextPageParam: (last) => last.nextCursor,
  });
}
export function useNoteActions(card: Card) {
  const { workspace } = useWorkspace();
  const client = useQueryClient();
  const onSuccess = () => refreshWorkflow(client, workspace.id, card.id, card.boardId, 'notes');
  return {
    create: useMutation({
      retry: false,
      mutationFn: (input: CreateNoteInput) =>
        apiRequest(scoped(workspace.id, `/cards/${card.id}/notes`), noteResponse, {
          method: 'POST',
          json: input,
        }),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: string }) =>
        apiRequest(scoped(workspace.id, `/notes/${id}`), noteResponse, {
          method: 'PATCH',
          json: { body },
        }),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: string) =>
        apiRequest(scoped(workspace.id, `/notes/${id}`), z.undefined(), {
          method: 'DELETE',
          json: {},
        }),
      onSuccess,
    }),
  };
}
