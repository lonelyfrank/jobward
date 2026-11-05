import type { Card } from '@jobward/schemas';
import { CalendarClock, Link2, ListTodo } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { useLabels } from '@/features/labels/api';
import { LabelChip } from '@/features/labels/label-chip';
import { formatInterviewDate } from '@/features/interviews/time';
import { useWorkspace } from '@/features/workspace/context';
import { cn } from '@/lib/cn';
import {
  OUTCOME_LABELS,
  PRIORITY_LABELS,
  PRIORITY_TONE,
  STAGE_LABELS,
  STAGE_TONE,
  WORK_MODE_LABELS,
} from '@/lib/labels';
import { useDensity } from './density';

const ACTION_TEXT = {
  overdue: (title: string) => `Aggiorna “${title}”`,
  record_feedback: (title: string) => `Feedback: “${title}”`,
  schedule: (title: string) => `Programma “${title}”`,
} as const;

/**
 * Contenuto di una scheda nel Kanban (solo presentazione: usato anche dall'overlay di trascinamento).
 * Mostra SOLO dati registrati, tutti già presenti nella risposta della bacheca (nessuna richiesta
 * per scheda). Due densità, preferenza locale:
 *  - compatta: titolo, azienda, priorità, fase, prossimo colloquio;
 *  - informativa: in più sede/modalità, esito, etichette, annuncio e prossima azione.
 */
export function CardView({
  card,
  boardId,
  handle,
  menu,
  overlay = false,
}: {
  card: Card;
  boardId: string;
  handle?: ReactNode;
  menu?: ReactNode;
  overlay?: boolean;
}) {
  const density = useDensity();
  const compact = density === 'compact';
  const { workspace } = useWorkspace();
  const labels = useLabels();
  const cardLabels = (labels.data ?? []).filter((l) => card.labelIds.includes(l.id));
  const { next, action } = card.interviewSummary;
  // Una riga sola, in ordine di importanza: azienda, sede, modalità (solo ciò che c'è).
  const subtitle = compact
    ? (card.company ?? '')
    : [card.company, card.location, card.workMode ? WORK_MODE_LABELS[card.workMode] : null]
        .filter(Boolean)
        .join(' · ');
  const showOutcome = !compact && card.outcome && card.outcome !== 'pending';

  return (
    <div
      className={cn(
        'flex items-start gap-1 rounded-[14px] border border-border bg-surface p-3 shadow-sm',
        overlay && 'rotate-1 cursor-grabbing shadow-md ring-2 ring-ring',
      )}
    >
      {handle}
      <div className="min-w-0 flex-1 py-1">
        {overlay ? (
          <span className="block text-[15px] font-semibold break-words">{card.title}</span>
        ) : (
          <Link
            to={`/boards/${boardId}/cards/${card.id}`}
            className="block rounded-sm text-[15px] font-semibold break-words hover:text-primary"
          >
            {card.title}
          </Link>
        )}
        {subtitle ? (
          <p className="mt-1 truncate text-[13px] text-muted-foreground">{subtitle}</p>
        ) : null}
        {!compact && cardLabels.length > 0 ? (
          <ul aria-label="Etichette" className="mt-1.5 flex flex-wrap gap-1">
            {cardLabels.slice(0, 3).map((l) => (
              <li key={l.id} className="max-w-full">
                <LabelChip name={l.name} color={l.color} />
              </li>
            ))}
            {cardLabels.length > 3 ? (
              <li className="text-xs text-muted-foreground">+{cardLabels.length - 3}</li>
            ) : null}
          </ul>
        ) : null}
        {card.priority !== 'none' || card.stage || showOutcome || (!compact && card.sourceUrl) ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {card.stage ? (
              <Badge tone={STAGE_TONE[card.stage]}>{STAGE_LABELS[card.stage]}</Badge>
            ) : null}
            {showOutcome && card.outcome ? (
              <Badge tone={card.outcome === 'accepted' ? 'primary' : 'neutral'}>
                {OUTCOME_LABELS[card.outcome]}
              </Badge>
            ) : null}
            {card.priority !== 'none' ? (
              <Badge tone={PRIORITY_TONE[card.priority]}>
                Priorità {PRIORITY_LABELS[card.priority].toLowerCase()}
              </Badge>
            ) : null}
            {!compact && card.sourceUrl ? (
              <Badge>
                <Link2 aria-hidden="true" className="size-3" />
                Annuncio
              </Badge>
            ) : null}
          </div>
        ) : null}
        {next ? (
          <p className="mt-1.5 flex items-center gap-1 text-xs font-medium">
            <CalendarClock aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
            <span className="sr-only">Prossimo colloquio: </span>
            <time dateTime={new Date(next.scheduledAt).toISOString()}>
              {formatInterviewDate(next.scheduledAt, next.timezone, workspace.timezone, {
                short: true,
              })}
            </time>
            {!compact ? (
              <span className="truncate text-muted-foreground">· {next.title}</span>
            ) : null}
          </p>
        ) : null}
        {!compact && action ? (
          <p
            className={cn(
              'mt-1 flex items-center gap-1 text-xs',
              action.kind === 'overdue'
                ? 'font-medium text-warning-soft-foreground'
                : 'text-muted-foreground',
            )}
          >
            <ListTodo aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="sr-only">Prossima azione: </span>
            <span className="truncate">{ACTION_TEXT[action.kind](action.title)}</span>
          </p>
        ) : null}
      </div>
      {menu}
    </div>
  );
}
