import type { TimelineEntryDto } from '@jobward/schemas';
import { Button } from '@/components/ui/button';
import { describeEvent } from '@/features/cards/card-history';
import { LoadError } from '@/features/cards/workflow-feedback';
import { formatDateTime } from '@/lib/format';
import { uniqueEntries, useTimeline } from './api';

export function describeTimelineEntry(entry: TimelineEntryDto, zone: string): string {
  if (entry.source === 'note') return 'Nota aggiunta';
  return describeEvent(
    {
      id: entry.id,
      type: entry.kind,
      metadata: entry.data,
      occurredAt: entry.occurredAt,
    },
    zone,
  );
}

export function TimelineTab({
  cardId,
  timeZone,
  active,
}: {
  cardId: string;
  timeZone: string;
  active: boolean;
}) {
  const query = useTimeline(cardId, active);
  const entries = uniqueEntries(query.data?.pages ?? []);
  return (
    <section aria-label="Timeline della candidatura" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Timeline</h3>
        <Button
          variant="secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Aggiorna eventi
        </Button>
      </div>
      {query.isPending ? <p role="status">Caricamento della timeline…</p> : null}
      {query.isError ? (
        <LoadError
          error={query.error}
          onRetry={() => {
            if (query.isFetchNextPageError) void query.fetchNextPage();
            else void query.refetch();
          }}
        />
      ) : null}
      {!query.isPending && !query.isError && !entries.length ? (
        <p>Nessun evento registrato.</p>
      ) : null}
      <ol className="space-y-4 border-l border-border pl-4">
        {entries.map((entry) => (
          <li key={`${entry.source}:${entry.id}`} className="relative min-w-0 text-sm">
            <span
              aria-hidden="true"
              className={`absolute top-1.5 -left-[1.3rem] size-2 rounded-full ${entry.kind === 'application_reopened' || entry.kind === 'application_closed' ? 'bg-primary' : 'bg-border-strong'}`}
            />
            <p className="font-medium">{describeTimelineEntry(entry, timeZone)}</p>
            <time
              className="text-xs text-muted-foreground"
              dateTime={new Date(entry.occurredAt).toISOString()}
            >
              {formatDateTime(entry.occurredAt, timeZone)}
            </time>
            {entry.source === 'note' ? (
              <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{entry.data.body}</p>
            ) : null}
          </li>
        ))}
      </ol>
      {query.hasNextPage ? (
        <Button
          variant="secondary"
          disabled={query.isFetching}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? 'Caricamento…' : 'Carica altri eventi'}
        </Button>
      ) : null}
    </section>
  );
}
