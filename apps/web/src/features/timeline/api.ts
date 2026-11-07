import { timelineResponse, type TimelineEntryDto } from '@jobward/schemas';
import { useInfiniteQuery } from '@tanstack/react-query';
import { keys, scoped } from '@/features/boards/api';
import { useWorkspace } from '@/features/workspace/context';
import { apiRequest } from '@/lib/api';

export function useTimeline(cardId: string, enabled: boolean) {
  const { workspace } = useWorkspace();
  return useInfiniteQuery({
    queryKey: keys.timeline(workspace.id, cardId),
    enabled,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      apiRequest(
        scoped(
          workspace.id,
          `/cards/${cardId}/timeline?limit=25${pageParam ? '&before=' + encodeURIComponent(pageParam) : ''}`,
        ),
        timelineResponse,
        { signal },
      ),
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** Il server decide ordine e cursore. Si rimuovono solo sovrapposizioni fra pagine/refetch. */
export function uniqueEntries(pages: { entries: TimelineEntryDto[] }[]): TimelineEntryDto[] {
  const seen = new Set<string>();
  return pages
    .flatMap((p) => p.entries)
    .filter((e) => {
      const key = `${e.source}:${e.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
