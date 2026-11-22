import {
  pipelineTransitionResponse,
  type Card,
  type PipelineTransitionInput,
} from '@jobward/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { scoped } from '@/features/boards/api';
import { refreshWorkflow } from '@/features/cards/workflow-cache';
import { useWorkspace } from '@/features/workspace/context';
import { apiRequest } from '@/lib/api';

export function usePipeline(card: Card) {
  const { workspace } = useWorkspace();
  const client = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (input: PipelineTransitionInput) =>
      apiRequest(scoped(workspace.id, `/cards/${card.id}/pipeline`), pipelineTransitionResponse, {
        method: 'POST',
        json: input,
      }),
    onSuccess: () => refreshWorkflow(client, workspace.id, card.id, card.boardId, 'interviews'),
  });
}
