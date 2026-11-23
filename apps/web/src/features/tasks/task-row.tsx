import type { Task, TaskAsOf } from '@jobward/schemas';
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Check,
  Circle,
  MoreHorizontal,
} from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { PRIORITY_LABELS } from '@/lib/labels';
import { cardPath } from '@/features/cards/card-path';
import { describeDue, TASK_KIND_LABELS, type DueTone } from './presentation';

const TONE_CLASS: Record<DueTone, string> = {
  overdue: 'font-semibold text-danger',
  today: 'font-semibold text-primary',
  upcoming: 'text-foreground',
  neutral: 'text-muted-foreground',
};

/** Testo + icona: lo stato temporale non è mai affidato al solo colore. */
function DueIcon({ tone, done }: { tone: DueTone; done: boolean }) {
  const cls = 'size-4 shrink-0';
  if (done) return <Check aria-hidden="true" className={cls} />;
  if (tone === 'overdue') return <AlertTriangle aria-hidden="true" className={cls} />;
  if (tone === 'today') return <CalendarClock aria-hidden="true" className={cls} />;
  return <CalendarDays aria-hidden="true" className={cls} />;
}

export interface TaskRowProps {
  task: Task;
  asOf: TaskAsOf;
  /** Sola lettura: candidatura archiviata (le scritture darebbero 409). */
  readOnly?: boolean;
  /** Variante compatta (sezione della candidatura): senza chip della candidatura. */
  compact?: boolean;
  busy?: boolean;
  onOpen: (task: Task) => void;
  onToggle: (task: Task) => void;
  onCancel: (task: Task) => void;
  onReopen: (task: Task) => void;
}

export function TaskRow({
  task,
  asOf,
  readOnly = false,
  compact = false,
  busy = false,
  onOpen,
  onToggle,
  onCancel,
  onReopen,
}: TaskRowProps) {
  const due = describeDue(task, asOf);
  const archived = readOnly || task.card?.archived === true;
  const open = task.status === 'open';
  const done = task.status === 'done';
  const cancelled = task.status === 'cancelled';
  return (
    <li
      data-task-row
      data-task-id={task.id}
      data-due={due.due}
      // Una sola copia di ogni contenuto: la griglia cambia disposizione (scadenza sotto il testo a
      // telefono, in colonna da `md`) senza duplicare il testo nel DOM. Il testo va a capo, mai tagliato:
      // titolo, descrizione e, sotto, candidatura e badge sulla stessa riga.
      className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 border-b border-border py-2.5 last:border-b-0 md:grid-cols-[2rem_minmax(0,1fr)_9rem_2.5rem]"
    >
      {cancelled ? (
        <span
          aria-hidden="true"
          className="col-start-1 row-start-1 grid size-11 place-items-center text-muted-foreground md:size-8 md:pt-0.5"
        >
          <Circle className="size-5" />
        </span>
      ) : (
        <button
          type="button"
          disabled={archived || busy}
          aria-pressed={done}
          aria-label={done ? `Riapri: ${task.title}` : `Segna come completata: ${task.title}`}
          onClick={() => onToggle(task)}
          className="col-start-1 row-start-1 grid size-11 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-55 md:size-8 md:pt-0.5"
        >
          <span
            aria-hidden="true"
            className={cn(
              'grid size-6 place-items-center rounded-full border-2 transition-colors',
              done
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border-strong hover:border-primary',
            )}
          >
            {done ? <Check className="size-4" /> : null}
          </span>
        </button>
      )}

      <div className="col-start-2 row-start-1 min-w-0">
        <button
          type="button"
          onClick={() => onOpen(task)}
          className={cn(
            'block max-w-full pt-1 text-left text-[15px] leading-6 font-medium [overflow-wrap:anywhere] hover:underline focus-visible:underline max-md:min-h-11 max-md:py-2.5',
            (done || cancelled) && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </button>
        {task.description ? (
          <p className="text-sm text-muted-foreground [overflow-wrap:anywhere] max-md:hidden">
            {task.description}
          </p>
        ) : null}
        {(!compact && task.card) || task.kind !== 'general' || task.priority !== 'none' ? (
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {!compact && task.card ? (
              <Link
                to={cardPath(task.card)}
                className="min-w-0 text-[13px] text-primary [overflow-wrap:anywhere] hover:underline max-md:inline-flex max-md:min-h-11 max-md:items-center"
              >
                {task.card.company ? `${task.card.company} · ` : ''}
                {task.card.title}
                {task.card.archived ? ' (archiviata)' : ''}
              </Link>
            ) : null}
            {task.kind !== 'general' ? (
              <Badge tone="info">{TASK_KIND_LABELS[task.kind]}</Badge>
            ) : null}
            {task.priority !== 'none' ? (
              <Badge
                tone={
                  task.priority === 'urgent' || task.priority === 'high' ? 'warning' : 'neutral'
                }
              >
                Priorità {PRIORITY_LABELS[task.priority].toLowerCase()}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>

      <span
        className={cn(
          'col-span-2 col-start-2 row-start-2 inline-flex items-center gap-1.5 text-sm md:col-span-1 md:col-start-3 md:row-start-1 md:pt-1.5',
          TONE_CLASS[due.tone],
        )}
      >
        <DueIcon tone={due.tone} done={done} />
        <DueText due={due} dueOn={task.dueOn} />
      </span>

      {!archived ? (
        <div className="col-start-3 row-start-1 md:col-start-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:size-9"
                aria-label={`Altre azioni per: ${task.title}`}
                disabled={busy}
              >
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => onOpen(task)}>
                {open ? 'Modifica' : 'Apri'}
              </DropdownMenuItem>
              {!open ? (
                <DropdownMenuItem onSelect={() => onReopen(task)}>Riapri</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => onCancel(task)}>
                  Annulla attività
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </li>
  );
}

function DueText({ due, dueOn }: { due: ReturnType<typeof describeDue>; dueOn: string | null }) {
  return (
    <>
      {dueOn && due.full ? (
        <time dateTime={dueOn}>
          {due.text}
          <span className="sr-only"> ({due.full})</span>
        </time>
      ) : (
        <span>{due.text}</span>
      )}
    </>
  );
}
