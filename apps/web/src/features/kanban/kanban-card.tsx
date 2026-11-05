import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card, Column } from '@meet-roulette/schemas';
import { EllipsisVertical, GripVertical } from 'lucide-react';
import type { KeyboardEventHandler } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { CardView } from './card-view';

export type CardAction =
  { kind: 'up' } | { kind: 'down' } | { kind: 'column'; columnId: string } | { kind: 'archive' };

/**
 * Scheda trascinabile.
 * - Mouse e touch: si trascina da qualunque punto della scheda (il tocco richiede una breve
 *   pressione, così lo scorrimento della bacheca resta possibile).
 * - Tastiera e screen reader: la maniglia è un vero pulsante (Spazio/Invio per prendere,
 *   frecce per spostare). Il link del titolo e il menu restano normali controlli.
 * - Alternativa senza trascinamento: le voci "Sposta su/giù" e "Sposta in …" del menu.
 */
export function KanbanCard({
  card,
  boardId,
  columns,
  isFirst,
  isLast,
  onAction,
}: {
  card: Card;
  boardId: string;
  columns: Column[];
  isFirst: boolean;
  isLast: boolean;
  onAction: (card: Card, action: CardAction) => void;
}) {
  const navigate = useNavigate();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { type: 'card', columnId: card.columnId } });
  // Il puntatore (mouse/touch) attiva il trascinamento da tutta la scheda; la tastiera solo
  // dalla maniglia, così Invio sul titolo apre la scheda invece di sollevarla.
  const { onKeyDown, ...pointerListeners } = (listeners ?? {}) as Record<string, unknown>;

  const otherColumns = columns.filter((c) => c.id !== card.columnId);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-card-id={card.id}
      className={cn('list-none touch-manipulation', isDragging && 'opacity-40')}
      {...pointerListeners}
    >
      <CardView
        card={card}
        boardId={boardId}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            onKeyDown={onKeyDown as KeyboardEventHandler<HTMLButtonElement> | undefined}
            aria-label={`Sposta la scheda “${card.title}” con la tastiera`}
            className="-ml-0.5 grid size-8 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground hover:bg-surface-muted max-md:size-11"
          >
            <GripVertical aria-hidden="true" className="size-4" />
          </button>
        }
        menu={
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Azioni per la scheda “${card.title}”`}
                className="size-8 shrink-0 max-md:size-11"
              >
                <EllipsisVertical aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onSelect={() => void navigate(`/boards/${boardId}/cards/${card.id}`)}
              >
                Apri dettagli
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={isFirst} onSelect={() => onAction(card, { kind: 'up' })}>
                Sposta su
              </DropdownMenuItem>
              <DropdownMenuItem disabled={isLast} onSelect={() => onAction(card, { kind: 'down' })}>
                Sposta giù
              </DropdownMenuItem>
              {otherColumns.length > 0 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Sposta in</DropdownMenuLabel>
                  {otherColumns.map((c) => (
                    <DropdownMenuItem
                      key={c.id}
                      onSelect={() => onAction(card, { kind: 'column', columnId: c.id })}
                    >
                      <span className="truncate">{c.name}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onAction(card, { kind: 'archive' })}>
                Archivia
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
    </li>
  );
}
