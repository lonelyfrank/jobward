import { overviewResponse } from '@meet-roulette/schemas';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export function useOverview(workspaceId: string) {
  return useQuery({
    queryKey: ['overview', workspaceId],
    queryFn: () =>
      apiRequest(`/overview?workspaceId=${encodeURIComponent(workspaceId)}`, overviewResponse),
  });
}
