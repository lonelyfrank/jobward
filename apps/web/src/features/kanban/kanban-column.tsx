import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card, Column } from '@jobward/schemas';
import { EllipsisVertical, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { COLOR_BORDER_TOP, isColorToken, STAGE_LABELS } from '@/lib/labels';
import { cn } from '@/lib/cn';
import { KanbanCard, type CardAction } from './kanban-card';
import { QuickCreate } from './quick-create';

export type ColumnAction = 'edit' | 'left' | 'right' | 'delete';

export function KanbanColumn({
  boardId,
  column,
  cards,
  allColumns,
  isFirst,
  isLast,
  onCardAction,
  onColumnAction,
}: {
  boardId: string;
  column: Column;
  cards: Card[];
  allColumns: Column[];
  isFirst: boolean;
  isLast: boolean;
  onCardAction: (card: Card, action: CardAction) => void;
  onColumnAction: (column: Column, action: ColumnAction) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id, data: { type: 'column' } });
  const headingId = `column-${column.id}`;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      data-column-id={column.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex max-h-full w-[85vw] shrink-0 snap-center flex-col rounded-lg border border-t-4 border-border bg-surface-muted sm:w-72 sm:snap-align-none',
        isColorToken(column.color) ? COLOR_BORDER_TOP[column.color] : 'border-t-border-strong',
        isDragging && 'opacity-40',
      )}
    >
      <header className="flex items-center gap-1 px-2 pt-2 pb-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Sposta la colonna “${column.name}”`}
          className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted-foreground hover:bg-surface max-md:size-11"
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="truncate text-sm font-semibold" title={column.name}>
            {column.name}
          </h3>
          {column.category ? (
            <p className="truncate text-xs text-muted-foreground">
              {STAGE_LABELS[column.category]}
            </p>
          ) : null}
        </div>
        <Badge aria-label={`${column.cardCount} ${column.cardCount === 1 ? 'scheda' : 'schede'}`}>
          {column.cardCount}
        </Badge>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Azioni per la colonna “${column.name}”`}
              className="size-8 max-md:size-11"
            >
              <EllipsisVertical aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => onColumnAction(column, 'edit')}>
              Modifica…
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isFirst} onSelect={() => onColumnAction(column, 'left')}>
              Sposta a sinistra
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isLast} onSelect={() => onColumnAction(column, 'right')}>
              Sposta a destra
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem danger onSelect={() => onColumnAction(column, 'delete')}>
              Elimina…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul
          aria-label={`Schede in ${column.name}`}
          className="min-h-12 flex-1 space-y-2 overflow-y-auto px-2 py-1"
        >
          {cards.map((card, index) => (
            <KanbanCard
              key={card.id}
              card={card}
              boardId={boardId}
              columns={allColumns}
              isFirst={index === 0}
              isLast={index === cards.length - 1}
              onAction={onCardAction}
            />
          ))}
        </ul>
      </SortableContext>
      {cards.length === 0 ? (
        <p className="px-4 pb-1 text-xs text-muted-foreground">Nessuna scheda in questa colonna.</p>
      ) : null}

      <div className="p-2 pt-1">
        <QuickCreate boardId={boardId} columnId={column.id} columnName={column.name} />
      </div>
    </section>
  );
}
