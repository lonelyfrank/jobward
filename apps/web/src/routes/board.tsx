import { ArrowLeft, Archive, EllipsisVertical, Star } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotify } from '@/components/ui/notices';
import { Skeleton } from '@/components/ui/skeleton';
import { Surface } from '@/components/ui/surface';
import { useBoardDetail, useDeleteBoard, useUpdateBoard } from '@/features/boards/api';
import { BoardDialog } from '@/features/boards/board-dialog';
import { ArchivedDialog } from '@/features/cards/archived-dialog';
import { KanbanBoard } from '@/features/kanban/kanban-board';
import { userMessage } from '@/features/kanban/mutations';
import { cn } from '@/lib/cn';
import { COLOR_BG, isColorToken } from '@/lib/labels';

/** Bacheca aperta: intestazione, Kanban e (come sotto-rotta) il pannello di dettaglio della scheda. */
export function BoardPage() {
  const { boardId = '' } = useParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const board = useBoardDetail(boardId);
  const update = useUpdateBoard();
  const remove = useDeleteBoard();

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  if (board.isPending) {
    return (
      <div className="px-4 py-6 sm:px-8">
        <Skeleton className="mb-6 h-8 w-64" />
        <div role="status" aria-label="Caricamento della bacheca" className="flex gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-64 w-72 shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (board.isError) {
    const notFound = 'status' in board.error && board.error.status === 404;
    return (
      <div className="px-4 py-6 sm:px-8">
        <Surface className="p-6" role="alert">
          <h1 className="font-semibold">
            {notFound ? 'Bacheca non trovata' : 'Non riusciamo a caricare la bacheca.'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {notFound
              ? 'Potrebbe essere stata eliminata, o l’indirizzo non è corretto.'
              : 'I tuoi dati sono al sicuro: riprova tra un momento.'}
          </p>
          <div className="mt-4 flex gap-2">
            {!notFound ? (
              <Button variant="secondary" onClick={() => void board.refetch()}>
                Riprova
              </Button>
            ) : null}
            <Button variant="secondary" asChild>
              <Link to="/boards">Tutte le bacheche</Link>
            </Button>
          </div>
        </Surface>
      </div>
    );
  }

  const { board: info, columns } = board.data;
  const archivedTotal = columns.reduce((sum, c) => sum + c.archivedCount, 0);
  const columnNames = Object.fromEntries(columns.map((c) => [c.id, c.name]));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="px-4 pt-5 pb-4 sm:px-8">
        <Link
          to="/boards"
          className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground max-md:min-h-11 max-md:items-center"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Tutte le bacheche
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {isColorToken(info.color) ? (
                <span
                  aria-hidden="true"
                  className={cn('size-3 shrink-0 rounded-full', COLOR_BG[info.color])}
                />
              ) : null}
              <h1 className="truncate text-xl font-semibold tracking-tight">{info.name}</h1>
              <Button
                variant="ghost"
                size="icon"
                aria-label={info.isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                aria-pressed={info.isFavorite}
                onClick={() =>
                  update.mutate(
                    { boardId: info.id, input: { isFavorite: !info.isFavorite } },
                    {
                      onError: () =>
                        notify('error', 'Non siamo riusciti ad aggiornare i preferiti.'),
                    },
                  )
                }
              >
                <Star
                  aria-hidden="true"
                  className={cn(info.isFavorite && 'fill-current text-accent-amber')}
                />
              </Button>
            </div>
            {info.description ? (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{info.description}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowArchived(true)}>
              <Archive aria-hidden="true" />
              Archiviate
              <span className="sr-only"> ({archivedTotal})</span>
              <span aria-hidden="true" className="text-muted-foreground">
                {archivedTotal}
              </span>
            </Button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="Azioni bacheca">
                  <EllipsisVertical aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  Modifica bacheca…
                </DropdownMenuItem>
                <DropdownMenuItem danger onSelect={() => setDeleting(true)}>
                  Elimina bacheca…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <KanbanBoard boardId={boardId} data={board.data} />
      </div>

      <Outlet />

      <ArchivedDialog
        boardId={boardId}
        columnNames={columnNames}
        open={showArchived}
        onOpenChange={setShowArchived}
      />
      {editing ? (
        <BoardDialog
          key={info.id}
          open
          board={info}
          onOpenChange={(open) => !open && setEditing(false)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(false);
            remove.reset();
          }
        }}
        title={`Eliminare “${info.name}”?`}
        description={
          <>
            <p>
              La bacheca, le sue {columns.length} colonne e tutte le sue schede (anche quelle
              archiviate) saranno eliminate definitivamente.
            </p>
            <p className="font-medium text-foreground">Questa azione non si può annullare.</p>
          </>
        }
        confirmLabel="Elimina bacheca"
        pending={remove.isPending}
        error={
          remove.error ? userMessage(remove.error, 'Qualcosa è andato storto. Riprova.') : null
        }
        onConfirm={() =>
          remove.mutate(info.id, {
            onSuccess: () => {
              notify('success', `Bacheca “${info.name}” eliminata.`);
              void navigate('/boards');
            },
          })
        }
      />
    </div>
  );
}
