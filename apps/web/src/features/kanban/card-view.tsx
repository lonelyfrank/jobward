import type { Card } from '@meet-roulette/schemas';
import { Link2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { PRIORITY_LABELS } from '@/lib/labels';
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
        {card.company ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{card.company}</p>
        ) : null}
        {card.priority !== 'none' || card.sourceUrl ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
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
