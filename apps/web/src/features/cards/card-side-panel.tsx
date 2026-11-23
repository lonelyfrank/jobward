import type { Card, Column } from '@jobward/schemas';
import { PRIORITIES, type Priority } from '@jobward/shared';
import { CalendarDays, ChevronDown, ListTodo, SquareKanban, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { NO_BOARD_LABEL } from '@/features/cards/card-path';
import { formatInterviewDate } from '@/features/interviews/time';
import { LabelPicker } from '@/features/labels/label-picker';
import { cn } from '@/lib/cn';
import { INTERVIEW_MODALITY_LABELS, INTERVIEW_TYPE_LABELS, PRIORITY_LABELS } from '@/lib/labels';

const ACTION_TEXT = {
  overdue: (title: string) => `Aggiorna “${title}”: la data è trascorsa`,
  record_feedback: (title: string) => `Registra il feedback di “${title}”`,
  schedule: (title: string) => `Programma “${title}”`,
} as const;

/** Scheda bianca del pannello laterale (sfondo attenuato dietro). */
export function SideCard({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="rounded-2xl bg-surface p-4 shadow-xs">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex-1 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * Prossimi passi: il prossimo colloquio e l'azione che ne discende. Solo dati registrati, nessuna
 * stima (docs/features/APPLICATIONS.md).
 */
export function NextSteps({
  card,
  timeZone,
  onOpenInterviews,
}: {
  card: Card;
  timeZone: string;
  onOpenInterviews: () => void;
}) {
  const { next, action } = card.interviewSummary;
  if (!next && !action) {
    return (
      <SideCard title="Prossimi passi">
        <p className="text-sm text-muted-foreground">Nessun colloquio programmato.</p>
      </SideCard>
    );
  }
  return (
    <SideCard title="Prossimi passi">
      <ul className="space-y-1">
        {next ? (
          <li>
            <StepButton
              icon={<CalendarDays aria-hidden="true" className="size-5" />}
              tone="primary"
              title={formatInterviewDate(next.scheduledAt, next.timezone, timeZone)}
              detail={[
                next.title,
                INTERVIEW_TYPE_LABELS[next.type],
                next.modality ? INTERVIEW_MODALITY_LABELS[next.modality] : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              onClick={onOpenInterviews}
            />
          </li>
        ) : null}
        {action ? (
          <li>
            <StepButton
              icon={<ListTodo aria-hidden="true" className="size-5" />}
              tone="warning"
              title={ACTION_TEXT[action.kind](action.title)}
              detail="Apri i colloqui"
              onClick={onOpenInterviews}
            />
          </li>
        ) : null}
      </ul>
    </SideCard>
  );
}

function StepButton({
  icon,
  tone,
  title,
  detail,
  onClick,
}: {
  icon: ReactNode;
  tone: 'primary' | 'warning';
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-xl p-2 text-left transition-colors hover:bg-hover-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-[10px]',
          tone === 'primary'
            ? 'bg-primary-soft text-primary-soft-foreground'
            : 'bg-warning-soft text-warning-soft-foreground',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold [overflow-wrap:anywhere]">{title}</span>
        <span className="block text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
          {detail}
        </span>
      </span>
    </button>
  );
}

const selectClass =
  'h-11 w-full appearance-none rounded-xl border border-border-strong bg-surface pr-9 pl-10 text-sm font-medium text-foreground focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:ring-4 focus-visible:ring-primary-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70';

function IconSelect({
  id,
  label,
  icon,
  children,
  ...props
}: {
  id: string;
  label: string;
  icon: ReactNode;
  children: ReactNode;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <select
        id={id}
        className={selectClass}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

/**
 * Organizzazione della scheda nella bacheca: colonna, priorità ed etichette. Fanno parte della bozza
 * della modale e si salvano con il «Salva» unico, insieme ai dettagli (nessun salvataggio a metà).
 */
export function Organization({
  card,
  columns,
  columnId,
  priority,
  labelIds,
  disabled,
  dirty,
  onColumn,
  onPriority,
  onLabels,
}: {
  card: Card;
  columns: Column[];
  columnId: string | null;
  priority: Priority;
  labelIds: string[];
  disabled: boolean;
  dirty: boolean;
  onColumn: (columnId: string) => void;
  onPriority: (priority: Priority) => void;
  onLabels: (labelIds: string[]) => void;
}) {
  return (
    <SideCard
      title="Organizzazione"
      aside={
        dirty ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning-soft-foreground">
            <span aria-hidden="true" className="size-2 rounded-full bg-current" />
            Da salvare
          </span>
        ) : null
      }
    >
      <div className="space-y-2.5">
        <IconSelect
          id="card-column"
          label="Colonna"
          icon={<SquareKanban />}
          value={columnId ?? ''}
          disabled={disabled || card.columnId === null}
          onChange={onColumn}
        >
          {card.columnId === null ? <option value="">{NO_BOARD_LABEL}</option> : null}
          {columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </IconSelect>
        <IconSelect
          id="card-priority"
          label="Priorità"
          icon={<Star />}
          value={priority}
          disabled={disabled}
          onChange={(value) => onPriority(value as Priority)}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p === 'none' ? 'Nessuna priorità' : `Priorità ${PRIORITY_LABELS[p].toLowerCase()}`}
            </option>
          ))}
        </IconSelect>
        <LabelPicker cardId={card.id} labelIds={labelIds} disabled={disabled} onChange={onLabels} />
      </div>
    </SideCard>
  );
}
