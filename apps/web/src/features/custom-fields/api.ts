import {
  cardCustomFieldResponse,
  cardCustomFieldsResponse,
  customFieldResponse,
  customFieldsResponse,
  deletedResponse,
  type CardCustomField,
  type CreateCustomFieldInput,
  type UpdateCustomFieldInput,
} from '@meet-roulette/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { keys, scoped } from '@/features/boards/api';
import { useWorkspace } from '@/features/workspace/context';
import { apiRequest } from '@/lib/api';

/** Definizioni dei campi di una bacheca (attivi e inattivi): per il configuratore. */
export function useBoardFields(boardId: string, enabled = true) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: keys.boardFields(workspace.id, boardId),
    queryFn: () =>
      apiRequest(scoped(workspace.id, `/boards/${boardId}/custom-fields`), customFieldsResponse),
    select: (data) => data.fields,
    enabled,
    staleTime: 0,
  });
}

/** Campi ATTIVI di una scheda con il loro valore. */
export function useCardFields(cardId: string) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: keys.cardFields(workspace.id, cardId),
    queryFn: () =>
      apiRequest(scoped(workspace.id, `/cards/${cardId}/custom-fields`), cardCustomFieldsResponse),
    select: (data) => data.fields,
  });
}

/** Cambiare le definizioni cambia ciò che ogni scheda della bacheca mostra. */
function useRefreshFields(boardId: string) {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: keys.boardFields(workspace.id, boardId) });
    void queryClient.invalidateQueries({ queryKey: ['card-fields', workspace.id] });
  };
}

export function useCreateField(boardId: string) {
  const { workspace } = useWorkspace();
  const refresh = useRefreshFields(boardId);
  return useMutation({
    mutationFn: (input: CreateCustomFieldInput) =>
      apiRequest(scoped(workspace.id, `/boards/${boardId}/custom-fields`), customFieldResponse, {
        method: 'POST',
        json: input,
      }),
    onSuccess: refresh,
  });
}

export function useUpdateField(boardId: string) {
  const { workspace } = useWorkspace();
  const refresh = useRefreshFields(boardId);
  return useMutation({
    mutationFn: ({ fieldId, input }: { fieldId: string; input: UpdateCustomFieldInput }) =>
      apiRequest(scoped(workspace.id, `/custom-fields/${fieldId}`), customFieldResponse, {
        method: 'PATCH',
        json: input,
      }),
    onSuccess: refresh,
  });
}

export function useMoveField(boardId: string) {
  const { workspace } = useWorkspace();
  const refresh = useRefreshFields(boardId);
  return useMutation({
    mutationFn: ({ fieldId, afterId }: { fieldId: string; afterId: string | null }) =>
      apiRequest(scoped(workspace.id, `/custom-fields/${fieldId}/move`), customFieldResponse, {
        method: 'POST',
        json: { afterId },
      }),
    onSuccess: refresh,
  });
}

export function useDeleteField(boardId: string) {
  const { workspace } = useWorkspace();
  const refresh = useRefreshFields(boardId);
  return useMutation({
    mutationFn: ({ fieldId, deleteValues }: { fieldId: string; deleteValues: boolean }) =>
      apiRequest(scoped(workspace.id, `/custom-fields/${fieldId}`), deletedResponse, {
        method: 'DELETE',
        json: { deleteValues },
      }),
    onSuccess: refresh,
  });
}

export function usePutFieldValue(cardId: string) {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fieldId, value }: { fieldId: string; value: unknown }) =>
      apiRequest(
        scoped(workspace.id, `/cards/${cardId}/custom-fields/${fieldId}`),
        cardCustomFieldResponse,
        { method: 'PUT', json: { value } },
      ),
    onSuccess: ({ field }) => {
      queryClient.setQueryData<{ fields: CardCustomField[] }>(
        keys.cardFields(workspace.id, cardId),
        (old) =>
          old
            ? { fields: old.fields.map((f) => (f.field.id === field.field.id ? field : f)) }
            : old,
      );
    },
  });
}
