import { ArrowUpRight, EllipsisVertical, SquareKanban, Star } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Surface } from '@/components/ui/surface';
import { isColorToken } from '@/lib/labels';
import { cn } from '@/lib/cn';
import type { BoardListItem } from './api';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Voce della galleria: apertura, preferita e menu delle azioni (tutte raggiungibili da tastiera). */
export function BoardCard({
  board,
  canMoveUp,
  canMoveDown,
  onToggleFavorite,
  onEdit,
  onMove,
  onDelete,
}: {
  board: BoardListItem;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onDelete: () => void;
}) {
  return (
    <Surface className="group relative isolate flex h-full flex-col overflow-hidden rounded-xl transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md motion-reduce:transform-none">
      <div
        data-board-color={isColorToken(board.color) ? board.color : 'default'}
        className="board-background flex flex-1 items-start gap-3.5 border-b border-border p-5"
      >
        <span
          aria-hidden="true"
          className="grid size-11 shrink-0 place-items-center rounded-[14px] border border-border bg-surface text-primary shadow-sm"
        >
          <SquareKanban className="size-5" />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="text-lg leading-snug font-bold tracking-tight">
            <Link
              to={`/boards/${board.id}`}
              className="line-clamp-2 break-words after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-[-3px] focus-visible:after:outline-ring"
              title={board.name}
            >
              {board.name}
            </Link>
          </h3>
          {board.description ? (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {board.description}
            </p>
          ) : null}
          <span
            aria-hidden="true"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-soft-foreground"
          >
            Apri bacheca
            <ArrowUpRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" />
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {plural(board.columnCount, 'colonna', 'colonne')} ·{' '}
          {plural(board.cardCount, 'scheda', 'schede')}
        </p>
        <div className="relative z-10 -mr-1.5 flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              board.isFavorite
                ? `Rimuovi “${board.name}” dai preferiti`
                : `Aggiungi “${board.name}” ai preferiti`
            }
            aria-pressed={board.isFavorite}
            onClick={onToggleFavorite}
            className={cn(board.isFavorite && 'bg-warning-soft text-warning-soft-foreground')}
          >
            <Star aria-hidden="true" className={cn(board.isFavorite && 'fill-current')} />
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Azioni per “${board.name}”`}>
                <EllipsisVertical aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={onEdit}>Modifica…</DropdownMenuItem>
              <DropdownMenuItem disabled={!canMoveUp} onSelect={() => onMove('up')}>
                Sposta su
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canMoveDown} onSelect={() => onMove('down')}>
                Sposta giù
              </DropdownMenuItem>
              <DropdownMenuItem danger onSelect={onDelete}>
                Elimina…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Surface>
  );
}
