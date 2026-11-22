import {
  savedViewResponse,
  savedViewsResponse,
  type CreateSavedViewInput,
  type UpdateSavedViewInput,
} from '@jobward/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { scoped } from '@/features/boards/api';
import { useWorkspace } from '@/features/workspace/context';
import { apiRequest } from '@/lib/api';

const viewsKey = (ws: string) => ['saved-views', ws] as const;

export function useSavedViews() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: viewsKey(workspace.id),
    queryFn: ({ signal }) =>
      apiRequest(scoped(workspace.id, '/views'), savedViewsResponse, { signal }),
    select: (d) => d.views,
  });
}

export function useSavedViewMutations() {
  const { workspace } = useWorkspace();
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: viewsKey(workspace.id) });
  const create = useMutation({
    mutationFn: (input: CreateSavedViewInput) =>
      apiRequest(scoped(workspace.id, '/views'), savedViewResponse, {
        method: 'POST',
        json: input,
      }),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSavedViewInput }) =>
      apiRequest(scoped(workspace.id, `/views/${id}`), savedViewResponse, {
        method: 'PATCH',
        json: input,
      }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiRequest(scoped(workspace.id, `/views/${id}`), z.unknown(), { method: 'DELETE', json: {} }),
    onSuccess: refresh,
  });
  return { create, update, remove };
}
