import {
  documentResponse,
  documentsResponse,
  type Card,
  type CreateDocumentInput,
  type UpdateDocumentInput,
} from '@jobward/schemas';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { keys, scoped } from '@/features/boards/api';
import { refreshWorkflow } from '@/features/cards/workflow-cache';
import { useWorkspace } from '@/features/workspace/context';
import { apiRequest } from '@/lib/api';

export function useDocuments(cardId: string, enabled: boolean) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: keys.documents(workspace.id, cardId),
    enabled,
    queryFn: ({ signal }) =>
      apiRequest(scoped(workspace.id, `/cards/${cardId}/documents`), documentsResponse, { signal }),
    select: (data) => data.documents,
  });
}
export function useDocumentActions(card: Card) {
  const { workspace } = useWorkspace();
  const client = useQueryClient();
  const onSuccess = () => refreshWorkflow(client, workspace.id, card.id, card.boardId, 'documents');
  return {
    create: useMutation({
      retry: false,
      mutationFn: (input: CreateDocumentInput) =>
        apiRequest(scoped(workspace.id, `/cards/${card.id}/documents`), documentResponse, {
          method: 'POST',
          json: input,
        }),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: UpdateDocumentInput }) =>
        apiRequest(scoped(workspace.id, `/documents/${id}`), documentResponse, {
          method: 'PATCH',
          json: input,
        }),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: string) =>
        apiRequest(scoped(workspace.id, `/documents/${id}`), z.undefined(), {
          method: 'DELETE',
          json: {},
        }),
      onSuccess,
    }),
  };
}
