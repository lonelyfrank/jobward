import { meResponse, workspaceResponse, type CreateWorkspaceInput } from '@meet-roulette/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export const meKey = ['me'] as const;

export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: () => apiRequest('/me', meResponse),
    // Gli errori di accesso (401/403) non si risolvono ritentando.
    retry: (count, error) =>
      !('status' in error && [401, 403].includes(Number(error.status))) && count < 2,
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkspaceInput) =>
      apiRequest('/workspaces', workspaceResponse, { method: 'POST', json: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meKey }),
  });
}
