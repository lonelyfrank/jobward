import {
  applicationMutationResponse,
  applicationsResponse,
  type Card,
  type CreateApplicationInput,
  type UpdateApplicationInput,
} from '@jobward/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { keys, scoped } from '@/features/boards/api';
import { refreshWorkflow } from '@/features/cards/workflow-cache';
import { useWorkspace } from '@/features/workspace/context';
import { apiRequest } from '@/lib/api';

export function useApplications(cardId: string) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: keys.applications(workspace.id, cardId),
    queryFn: ({ signal }) =>
      apiRequest(scoped(workspace.id, `/cards/${cardId}/applications`), applicationsResponse, {
        signal,
      }),
    select: (data) => data.applications,
  });
}

export function useCreateApplication(card: Pick<Card, 'id' | 'boardId'>) {
  const { workspace } = useWorkspace();
  const client = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (input: CreateApplicationInput) =>
      apiRequest(
        scoped(workspace.id, `/cards/${card.id}/applications`),
        applicationMutationResponse,
        { method: 'POST', json: input },
      ),
    onSuccess: () => refreshWorkflow(client, workspace.id, card.id, card.boardId),
  });
}

export function useUpdateApplication(card: Pick<Card, 'id' | 'boardId'>) {
  const { workspace } = useWorkspace();
  const client = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: ({ id, input }: { id: string; input: UpdateApplicationInput }) =>
      apiRequest(scoped(workspace.id, `/applications/${id}`), applicationMutationResponse, {
        method: 'PATCH',
        json: input,
      }),
    onSuccess: () => refreshWorkflow(client, workspace.id, card.id, card.boardId),
  });
}
