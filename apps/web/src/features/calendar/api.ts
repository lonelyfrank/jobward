import { calendarResponse } from '@jobward/schemas';
import { useQuery } from '@tanstack/react-query';
import { scoped } from '@/features/boards/api';
import { useWorkspace } from '@/features/workspace/context';
import { apiRequest } from '@/lib/api';

export function useCalendar(from: string, to: string) {
  const { workspace } = useWorkspace();
  return useQuery({
    // Sotto il prefisso delle attività: completare o creare un'attività aggiorna anche il calendario.
    queryKey: ['tasks', workspace.id, 'calendar', from, to],
    queryFn: ({ signal }) =>
      apiRequest(scoped(workspace.id, `/calendar?from=${from}&to=${to}`), calendarResponse, {
        signal,
      }),
  });
}
