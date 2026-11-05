import { EllipsisVertical, Star } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Surface } from '@/components/ui/surface';
import { COLOR_BORDER_TOP, isColorToken } from '@/lib/labels';
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
    <Surface
      className={cn(
        'flex h-full flex-col border-t-4 p-4',
        isColorToken(board.color) ? COLOR_BORDER_TOP[board.color] : 'border-t-border-strong',
      )}
    >
      <div className="flex items-start gap-1">
        <h3 className="min-w-0 flex-1 text-base font-semibold">
          <Link
            to={`/boards/${board.id}`}
            className="block truncate rounded-sm hover:underline max-md:py-2.5"
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
          className="-mt-1.5"
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
              className="-mt-1.5 -mr-2"
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
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{board.description}</p>
      ) : null}

      <p className="mt-auto pt-4 text-xs text-muted-foreground">
        {plural(board.columnCount, 'colonna', 'colonne')} ·{' '}
        {plural(board.cardCount, 'scheda', 'schede')}
      </p>
    </Surface>
  );
}
