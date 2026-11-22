import { insightsResponse } from '@jobward/schemas';
import { useQuery } from '@tanstack/react-query';
import { keys, scoped } from '@/features/boards/api';
import { useWorkspace } from '@/features/workspace/context';
import { apiRequest } from '@/lib/api';

export function useInsights() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: keys.insights(workspace.id),
    queryFn: ({ signal }) =>
      apiRequest(scoped(workspace.id, '/insights'), insightsResponse, { signal }),
  });
}
