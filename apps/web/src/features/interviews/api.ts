import {
  interviewResponse,
  interviewsResponse,
  type CompleteInterviewInput,
  type CreateInterviewInput,
  type UpdateInterviewInput,
} from '@jobward/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { keys, scoped } from '@/features/boards/api';
import { useWorkspace } from '@/features/workspace/context';
import { refreshWorkflow } from '@/features/cards/workflow-cache';
import { apiRequest } from '@/lib/api';

export function useInterviews(cardId: string) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: keys.interviews(workspace.id, cardId),
    queryFn: () =>
      apiRequest(scoped(workspace.id, `/cards/${cardId}/interviews`), interviewsResponse),
    select: (data) => data.interviews,
  });
}

/**
 * Un colloquio cambia l'elenco, il riepilogo della scheda (Kanban, tabella, pannello) e la
 * cronologia: tutto si riallinea al server, senza dati provvisori da annullare.
 */
export function useInterviewActions(cardId: string, boardId: string) {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const onSuccess = () => refreshWorkflow(queryClient, workspace.id, cardId, boardId, 'interviews');
  return {
    create: useMutation({
      mutationFn: (input: CreateInterviewInput) =>
        apiRequest(scoped(workspace.id, `/cards/${cardId}/interviews`), interviewResponse, {
          method: 'POST',
          json: input,
        }),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: UpdateInterviewInput }) =>
        apiRequest(scoped(workspace.id, `/interviews/${id}`), interviewResponse, {
          method: 'PATCH',
          json: input,
        }),
      onSuccess,
    }),
    complete: useMutation({
      mutationFn: ({ id, input }: { id: string; input: CompleteInterviewInput }) =>
        apiRequest(scoped(workspace.id, `/interviews/${id}/complete`), interviewResponse, {
          method: 'POST',
          json: input,
        }),
      onSuccess,
    }),
    cancel: useMutation({
      mutationFn: (id: string) =>
        apiRequest(scoped(workspace.id, `/interviews/${id}/cancel`), interviewResponse, {
          method: 'POST',
          json: {},
        }),
      onSuccess,
    }),
  };
}
