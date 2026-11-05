import type { Card } from '@meet-roulette/schemas';
import { Link2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { OUTCOME_LABELS, PRIORITY_LABELS, STAGE_LABELS, WORK_MODE_LABELS } from '@/lib/labels';
import { cn } from '@/lib/cn';

const PRIORITY_TONE = {
  none: 'neutral',
  low: 'neutral',
  medium: 'primary',
  high: 'warning',
  urgent: 'danger',
} as const;

/** Contenuto di una scheda nel Kanban. È solo presentazione: usato dalla scheda e dall'overlay di trascinamento. */
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
  // Una riga sola, in ordine di importanza: azienda, sede, modalità (solo ciò che c'è).
  const subtitle = [
    card.company,
    card.location,
    card.workMode ? WORK_MODE_LABELS[card.workMode] : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div
      className={cn(
        'flex items-start gap-1 rounded-lg border border-border bg-surface p-2 shadow-sm',
        overlay && 'rotate-1 cursor-grabbing shadow-md ring-2 ring-ring',
      )}
    >
      {handle}
      <div className="min-w-0 flex-1 py-1">
        {overlay ? (
          <span className="block text-sm font-medium break-words">{card.title}</span>
        ) : (
          <Link
            to={`/boards/${boardId}/cards/${card.id}`}
            className="block rounded-sm text-sm font-medium break-words hover:underline"
          >
            {card.title}
          </Link>
        )}
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
        {card.priority !== 'none' || card.sourceUrl || card.stage || card.outcome ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {card.stage ? <Badge tone="primary">{STAGE_LABELS[card.stage]}</Badge> : null}
            {card.outcome && card.outcome !== 'pending' ? (
              <Badge tone={card.outcome === 'accepted' ? 'primary' : 'neutral'}>
                {OUTCOME_LABELS[card.outcome]}
              </Badge>
            ) : null}
            {card.priority !== 'none' ? (
              <Badge tone={PRIORITY_TONE[card.priority]}>
                Priorità {PRIORITY_LABELS[card.priority].toLowerCase()}
              </Badge>
            ) : null}
            {card.sourceUrl ? (
              <Badge>
                <Link2 aria-hidden="true" className="size-3" />
                Annuncio
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
      {menu}
    </div>
  );
}
