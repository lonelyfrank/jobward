import { EllipsisVertical, SquareKanban, Star } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Surface } from '@/components/ui/surface';
import { COLOR_BG, isColorToken } from '@/lib/labels';
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
    <Surface className="flex h-full flex-col p-6">
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-[14px] text-white',
            isColorToken(board.color) ? COLOR_BG[board.color] : 'bg-primary',
          )}
        >
          <SquareKanban className="size-5" />
        </span>
        <h3 className="min-w-0 flex-1 text-lg font-bold">
          <Link
            to={`/boards/${board.id}`}
            className="block truncate rounded-sm hover:text-primary max-md:py-2.5"
            title={board.name}
          >
            {board.name}
          </Link>
        </h3>
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
          className="-mt-0.5"
        >
          <Star
            aria-hidden="true"
            className={cn(board.isFavorite && 'fill-current text-accent-amber')}
          />
        </Button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Azioni per “${board.name}”`}
              className="-mt-0.5 -mr-2"
            >
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

      {board.description ? (
        <p className="mt-3 line-clamp-2 text-sm leading-snug text-muted-foreground">
          {board.description}
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-[13px] text-muted-foreground">
          {plural(board.columnCount, 'colonna', 'colonne')} ·{' '}
          {plural(board.cardCount, 'scheda', 'schede')}
        </p>
        <Link
          to={`/boards/${board.id}`}
          tabIndex={-1}
          aria-hidden="true"
          className="text-[13px] font-semibold text-primary"
        >
          Apri bacheca →
        </Link>
      </div>
    </Surface>
  );
}
