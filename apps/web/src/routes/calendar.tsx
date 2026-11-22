import type { CalendarItem } from '@jobward/schemas';
import { addDays, localDate } from '@jobward/shared';
import { CalendarClock, ChevronLeft, ChevronRight, ListChecks, MessagesSquare } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { WorkspacePageHeader } from '@/components/ui/workspace-page-header';
import { useCalendar } from '@/features/calendar/api';
import { cardPath } from '@/features/cards/card-path';
import { useWorkspace } from '@/features/workspace/context';
import { cn } from '@/lib/cn';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const KIND = {
  interview: {
    label: 'Colloquio',
    icon: MessagesSquare,
    tone: 'bg-info-soft text-info-soft-foreground',
  },
  task: {
    label: 'Attività',
    icon: ListChecks,
    tone: 'bg-primary-soft text-primary-soft-foreground',
  },
  deadline: {
    label: 'Scadenza',
    icon: CalendarClock,
    tone: 'bg-warning-soft text-warning-soft-foreground',
  },
} as const;

/** Primo giorno del mese (YYYY-MM-01) da `?mese=YYYY-MM`, altrimenti il mese corrente. */
function monthFrom(param: string | null, today: string): string {
  return param && /^\d{4}-(0[1-9]|1[0-2])$/.test(param) ? `${param}-01` : `${today.slice(0, 7)}-01`;
}
const shiftMonth = (first: string, delta: number) => {
  const d = new Date(`${first}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 10);
};
/** Altezza di un evento nella griglia (h-6) e spazio tra due eventi (gap-0.5), in px. */
const ITEM_HEIGHT = 24;
const ITEM_GAP = 2;
const weekdayIndex = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

function time(item: CalendarItem, timeZone: string) {
  return item.at === null
    ? null
    : new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone }).format(
        new Date(item.at),
      );
}

function ItemLink({
  item,
  timeZone,
  compact = false,
}: {
  item: CalendarItem;
  timeZone: string;
  /** Una sola riga a altezza fissa (griglia mensile); il testo completo resta nell'etichetta. */
  compact?: boolean;
}) {
  const kind = KIND[item.kind];
  const Icon = kind.icon;
  const at = time(item, timeZone);
  const label = `${kind.label}${at ? ` alle ${at}` : ''}: ${item.title}${
    item.cardTitle && item.kind !== 'deadline' ? ` — ${item.cardTitle}` : ''
  }${item.kind === 'deadline' && item.cardTitle ? ` — ${item.cardTitle}` : ''}`;
  const content = (
    <span
      className={cn(
        'flex gap-1.5 rounded-md px-1.5 text-xs leading-snug',
        compact ? 'h-6 items-center' : 'items-start py-1',
        kind.tone,
        item.status === 'done' && 'line-through opacity-70',
      )}
    >
      <Icon aria-hidden="true" className={cn('size-3.5 shrink-0', !compact && 'mt-0.5')} />
      <span className={cn('min-w-0', compact && 'truncate')}>
        {at ? <span className="font-semibold tabular-nums">{at} </span> : null}
        <span className={compact ? undefined : 'break-words'}>
          {item.kind === 'deadline' ? (item.cardTitle ?? item.title) : item.title}
        </span>
      </span>
    </span>
  );
  return item.cardId ? (
    <Link
      to={cardPath({ id: item.cardId, boardId: item.boardId })}
      aria-label={label}
      title={compact ? label : undefined}
      className="block"
    >
      {content}
    </Link>
  ) : (
    <span aria-label={label} title={compact ? label : undefined} className="block">
      {content}
    </span>
  );
}

/** «+N altri»: gli eventi che non entrano nella cella si aprono in un riquadro, senza allungarla. */
function MoreItems({
  day,
  label,
  items,
  hidden,
  timeZone,
}: {
  day: string;
  label: string;
  items: CalendarItem[];
  hidden: number;
  timeZone: string;
}) {
  const text = hidden === items.length ? `${items.length} eventi` : `+${hidden} altri`;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex h-6 w-full items-center rounded-md px-1.5 text-xs font-medium text-muted-foreground hover:bg-hover-soft hover:text-foreground"
          aria-label={`${text}: mostra tutti i ${items.length} eventi di ${label}`}
        >
          {text}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          aria-label={`Eventi di ${label}`}
          className="z-50 max-h-(--radix-popover-content-available-height) w-64 overflow-y-auto rounded-lg border border-border bg-surface p-2 shadow-[0_12px_32px_-8px_oklch(0.2_0.05_280/0.25)] data-[state=closed]:animate-[jobward-pop-out_100ms_ease-in_both] data-[state=open]:animate-[jobward-pop-in_160ms_cubic-bezier(0.22,1,0.36,1)_both]"
        >
          <p className="mb-1.5 px-0.5 text-xs font-semibold capitalize">{label}</p>
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={`${day}-${item.kind}-${item.id}`}>
                <ItemLink item={item} timeZone={timeZone} />
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Calendario: colloqui, scadenze delle attività e degli annunci, nel fuso del workspace. */
export function Component() {
  const { workspace } = useWorkspace();
  const [params, setParams] = useSearchParams();
  // «Oggi» fissato al montaggio: il render resta puro.
  const [now] = useState(() => Date.now());
  const today = localDate(now, workspace.timezone);
  const first = monthFrom(params.get('mese'), today);
  const next = shiftMonth(first, 1);
  const last = addDays(next, -1);
  // La griglia parte dal lunedì della prima settimana e finisce la domenica dell'ultima.
  const gridStart = addDays(first, -weekdayIndex(first));
  const gridEnd = addDays(last, 6 - weekdayIndex(last));
  const calendar = useCalendar(gridStart, gridEnd);
  // Quanti eventi entrano in una cella: le righe hanno tutte la stessa altezza, basta misurarne una.
  const firstCellList = useRef<HTMLUListElement>(null);
  const [capacity, setCapacity] = useState(3);
  useEffect(() => {
    const element = firstCellList.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      setCapacity(
        Math.max(0, Math.floor((element.clientHeight + ITEM_GAP) / (ITEM_HEIGHT + ITEM_GAP))),
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [calendar.isError]);
  const byDay = new Map<string, CalendarItem[]>();
  for (const item of calendar.data?.items ?? []) {
    byDay.set(item.date, [...(byDay.get(item.date) ?? []), item]);
  }
  const days: string[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);
  const monthLabel = new Intl.DateTimeFormat('it-IT', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${first}T00:00:00Z`));
  const go = (month: string) =>
    setParams(month === `${today.slice(0, 7)}-01` ? {} : { mese: month.slice(0, 7) });
  const monthItems = (calendar.data?.items ?? []).filter((i) => i.date >= first && i.date <= last);
  const dayLabel = (date: string) =>
    new Intl.DateTimeFormat('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00Z`));

  return (
    <div className="flex h-full min-h-0 flex-col px-4 pt-5 pb-4 sm:px-6 lg:px-8">
      <WorkspacePageHeader
        className="mb-3 shrink-0"
        title="Calendario"
        description="Colloqui, scadenze delle attività e degli annunci, nel fuso del workspace."
      />
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="icon"
          aria-label="Mese precedente"
          onClick={() => go(shiftMonth(first, -1))}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <h2 className="min-w-44 text-center text-lg font-semibold capitalize" aria-live="polite">
          {monthLabel}
        </h2>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Mese successivo"
          onClick={() => go(next)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => go(`${today.slice(0, 7)}-01`)}>
          Oggi
        </Button>
        <span className="ml-auto flex flex-wrap gap-2 text-xs">
          {Object.values(KIND).map((k) => (
            <span key={k.label} className={cn('rounded-full px-2 py-0.5', k.tone)}>
              {k.label}
            </span>
          ))}
        </span>
      </div>

      {calendar.isError ? (
        <Surface className="shrink-0 p-6" role="alert">
          Impossibile caricare il calendario. Riprova tra poco.
        </Surface>
      ) : (
        <>
          {/* Desktop: griglia mensile. */}
          <Surface className="flex min-h-0 flex-1 flex-col overflow-hidden max-md:hidden">
            <div className="grid shrink-0 grid-cols-7 border-b border-border text-xs font-semibold text-muted-foreground">
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-2 py-1.5">
                  {d}
                </div>
              ))}
            </div>
            <ol className="grid min-h-0 flex-1 auto-rows-[minmax(0,1fr)] grid-cols-7">
              {days.map((day, index) => {
                const outside = day < first || day > last;
                const items = byDay.get(day) ?? [];
                // Se non entrano tutti, l'ultimo posto va a «+N altri».
                const shown =
                  items.length <= capacity ? items : items.slice(0, Math.max(0, capacity - 1));
                return (
                  <li
                    key={day}
                    aria-label={`${dayLabel(day)}: ${items.length ? `${items.length} eventi` : 'nessun evento'}`}
                    className={cn(
                      'flex min-h-0 flex-col overflow-hidden border-r border-b border-border p-1 [&:nth-child(7n)]:border-r-0',
                      outside && 'bg-surface-muted/50 text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-grid size-6 shrink-0 place-items-center rounded-full text-xs tabular-nums',
                        day === today && 'bg-primary font-semibold text-primary-foreground',
                      )}
                    >
                      {Number(day.slice(8))}
                    </span>
                    <ul
                      ref={index === 0 ? firstCellList : undefined}
                      className="mt-0.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden"
                    >
                      {shown.map((item) => (
                        <li key={`${item.kind}-${item.id}`} className="shrink-0">
                          <ItemLink item={item} timeZone={workspace.timezone} compact />
                        </li>
                      ))}
                      {shown.length < items.length ? (
                        <li className="shrink-0">
                          <MoreItems
                            day={day}
                            label={dayLabel(day)}
                            items={items}
                            hidden={items.length - shown.length}
                            timeZone={workspace.timezone}
                          />
                        </li>
                      ) : null}
                    </ul>
                  </li>
                );
              })}
            </ol>
          </Surface>

          {/* Telefono: agenda del mese. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain md:hidden">
            {calendar.isPending ? (
              <p className="text-sm text-muted-foreground">Caricamento…</p>
            ) : monthItems.length === 0 ? (
              <Surface className="p-5 text-sm text-muted-foreground">
                Nessun evento in questo mese.
              </Surface>
            ) : (
              <ol className="space-y-3">
                {[...new Set(monthItems.map((i) => i.date))].map((day) => (
                  <li key={day}>
                    <h3
                      className={cn(
                        'mb-1 text-sm font-semibold capitalize',
                        day === today && 'text-primary',
                      )}
                    >
                      {dayLabel(day)}
                    </h3>
                    <ul className="space-y-1">
                      {(byDay.get(day) ?? []).map((item) => (
                        <li key={`${item.kind}-${item.id}`}>
                          <ItemLink item={item} timeZone={workspace.timezone} />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </div>
          {!calendar.isPending && monthItems.length === 0 ? (
            <p className="mt-2 shrink-0 text-sm text-muted-foreground max-md:hidden">
              Nessun evento in questo mese. Programma un colloquio, aggiungi un’attività con
              scadenza o indica la scadenza di un annuncio per vederli qui.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
