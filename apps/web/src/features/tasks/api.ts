import {
  taskResponse,
  tasksResponse,
  taskSummaryResponse,
  type CreateTaskInput,
  type Task,
  type UpdateTaskInput,
} from '@jobward/schemas';
import type { TaskView } from '@jobward/shared';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { invalidateSummaries, keys, scoped } from '@/features/boards/api';
import { useWorkspace } from '@/features/workspace/context';
import { apiRequest } from '@/lib/api';

export interface TaskFilter {
  view: TaskView;
  cardId?: string | undefined;
}

/** Elenco a cursore: la data «oggi» arriva da ogni risposta (`asOf`), non dall'orologio del browser. */
export function useTasks(filter: TaskFilter, enabled = true) {
  const { workspace } = useWorkspace();
  return useInfiniteQuery({
    queryKey: [...keys.tasks(workspace.id), 'list', filter.view, filter.cardId ?? null],
    enabled,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ view: filter.view, limit: '50' });
      if (filter.cardId) params.set('cardId', filter.cardId);
      if (pageParam) params.set('cursor', pageParam);
      return apiRequest(scoped(workspace.id, `/tasks?${params.toString()}`), tasksResponse, {
        signal,
      });
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useTaskSummary() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: [...keys.tasks(workspace.id), 'summary'],
    queryFn: ({ signal }) =>
      apiRequest(scoped(workspace.id, '/tasks/summary'), taskSummaryResponse, { signal }),
  });
}

/** Una mutazione sulle attività riallinea elenchi, riepilogo, Overview e Timeline delle card coinvolte. */
export function refreshTasks(
  client: QueryClient,
  ws: string,
  cardIds: readonly (string | null | undefined)[],
) {
  invalidateSummaries(client, ws); // include keys.tasks(ws) e Overview
  for (const cardId of new Set(cardIds))
    if (cardId) void client.invalidateQueries({ queryKey: keys.timeline(ws, cardId) });
}

export type TaskCommand = 'complete' | 'reopen' | 'cancel';

export function useTaskActions() {
  const { workspace } = useWorkspace();
  const client = useQueryClient();
  const done = (cardIds: (string | null)[]) => () => refreshTasks(client, workspace.id, cardIds);
  return {
    create: useMutation({
      retry: false,
      mutationFn: (input: CreateTaskInput) =>
        apiRequest(scoped(workspace.id, '/tasks'), taskResponse, { method: 'POST', json: input }),
      onSuccess: (data) => done([data.task.cardId])(),
    }),
    update: useMutation({
      retry: false,
      mutationFn: ({
        id,
        input,
      }: {
        id: string;
        input: UpdateTaskInput;
        previousCardId: string | null;
      }) =>
        apiRequest(scoped(workspace.id, `/tasks/${id}`), taskResponse, {
          method: 'PATCH',
          json: input,
        }),
      onSuccess: (data, vars) => done([data.task.cardId, vars.previousCardId])(),
    }),
    command: useMutation({
      retry: false,
      mutationFn: ({ task, command }: { task: Task; command: TaskCommand }) =>
        apiRequest(scoped(workspace.id, `/tasks/${task.id}/${command}`), taskResponse, {
          method: 'POST',
          json: {},
        }),
      onSuccess: (data) => done([data.task.cardId])(),
    }),
  };
}

/** Rilegge una task (es. dopo un 409 «modificata altrove»). */
export function useTaskFetcher() {
  const { workspace } = useWorkspace();
  return (id: string) => apiRequest(scoped(workspace.id, `/tasks/${id}`), taskResponse);
}
