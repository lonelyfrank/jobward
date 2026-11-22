import { pipelineBoardResponse } from '@jobward/schemas';
import { useQuery } from '@tanstack/react-query';
import { keys, scoped } from '@/features/boards/api';
import { useWorkspace } from '@/features/workspace/context';
import { apiRequest } from '@/lib/api';

/** Sotto il prefisso delle opportunità: ogni modifica a una scheda la riallinea. */
export function usePipelineBoard() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: [...keys.opportunities(workspace.id), 'pipeline-board'],
    queryFn: ({ signal }) =>
      apiRequest(scoped(workspace.id, '/opportunities/pipeline'), pipelineBoardResponse, {
        signal,
      }),
    select: (data) => data.cards,
  });
}
