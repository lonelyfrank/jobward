import { anchorBefore, BOARD_TEMPLATES } from '@jobward/shared';
import { Plus, SquareKanban } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { useNotify } from '@/components/ui/notices';
import { WorkspacePageHeader } from '@/components/ui/workspace-page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Surface } from '@/components/ui/surface';
import {
  useBoards,
  useDeleteBoard,
  useMoveBoard,
  useUpdateBoard,
  type BoardListItem,
} from '@/features/boards/api';
import { BoardCard } from '@/features/boards/board-card';
import { BoardDialog } from '@/features/boards/board-dialog';
import { ApiRequestError } from '@/lib/api';

/**
 * Galleria delle bacheche. L'ordine mostrato è: preferite, poi le altre, ciascun gruppo
 * nell'ordine scelto dall'utente. "Sposta su/giù" agisce all'interno del gruppo.
 */
export function BoardsPage() {
  const boards = useBoards();
  const navigate = useNavigate();
  const notify = useNotify();
  const update = useUpdateBoard();
  const move = useMoveBoard();
  const remove = useDeleteBoard();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BoardListItem | null>(null);
  const [deleting, setDeleting] = useState<BoardListItem | null>(null);

  const ordered = useMemo(() => boards.data ?? [], [boards.data]);
  const groups = useMemo(
    () => [ordered.filter((b) => b.isFavorite), ordered.filter((b) => !b.isFavorite)],
    [ordered],
  );
  const hasBoth = groups[0]!.length > 0 && groups[1]!.length > 0;

  const moveWithinGroup = (board: BoardListItem, direction: 'up' | 'down') => {
    const group = groups[board.isFavorite ? 0 : 1]!;
    const index = group.findIndex((b) => b.id === board.id);
    const target = group[direction === 'up' ? index - 1 : index + 1];
    if (!target) return;
    // Sopra: subito prima del vicino (= dopo il suo predecessore globale). Sotto: dopo il vicino.
    const afterId = direction === 'up' ? anchorBefore(ordered, target.id) : target.id;
    move.mutate(
      { boardId: board.id, afterId },
      {
        onError: () =>
          notify(
            'error',
            `Non siamo riusciti a spostare “${board.name}”: l’ordine è stato ripristinato.`,
          ),
      },
    );
  };

  const header = (
    <WorkspacePageHeader
      title="Bacheche"
      description="Una bacheca raccoglie le opportunità di una ricerca, organizzate nelle tue colonne."
      canCreateCard={ordered.some((board) => board.columnCount > 0)}
      actions={[
        {
          id: 'create-board',
          label: 'Nuova bacheca',
          icon: Plus,
          group: 'create',
          onSelect: () => setCreating(true),
        },
      ]}
    />
  );

  const dialogs = (
    <>
      <BoardDialog
        key={creating ? 'create-open' : 'create-closed'}
        open={creating}
        onOpenChange={setCreating}
        onCreated={(id) => void navigate(`/boards/${id}`)}
      />
      {editing ? (
        <BoardDialog
          key={editing.id}
          open
          board={editing}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            remove.reset();
          }
        }}
        title={`Eliminare “${deleting?.name ?? ''}”?`}
        description={
          <>
            <p>
              La bacheca, le sue {deleting?.columnCount ?? 0} colonne e tutte le sue schede (anche
              quelle archiviate) saranno eliminate definitivamente.
            </p>
            <p className="font-medium text-foreground">Questa azione non si può annullare.</p>
          </>
        }
        confirmLabel="Elimina bacheca"
        pending={remove.isPending}
        error={
          remove.error instanceof ApiRequestError
            ? remove.error.message
            : remove.error
              ? 'Qualcosa è andato storto. Riprova.'
              : null
        }
        onConfirm={() => {
          if (!deleting) return;
          const name = deleting.name;
          remove.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null);
              notify('success', `Bacheca “${name}” eliminata.`);
            },
          });
        }}
      />
    </>
  );

  if (boards.isPending) {
    return (
      <>
        {header}
        <div
          role="status"
          aria-label="Caricamento delle bacheche"
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        {dialogs}
      </>
    );
  }

  if (boards.isError) {
    return (
      <>
        {header}
        <Surface className="p-6" role="alert">
          <p className="font-medium">Non riusciamo a caricare le bacheche.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            I tuoi dati sono al sicuro: riprova tra un momento.
          </p>
          <Button variant="secondary" className="mt-4" onClick={() => void boards.refetch()}>
            Riprova
          </Button>
        </Surface>
      </>
    );
  }

  if (ordered.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={SquareKanban}
          title="Non hai ancora bacheche"
          description="Una bacheca è il posto dove tieni le opportunità di una ricerca. Parti da un template e personalizza le colonne come preferisci."
        >
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            Crea la tua prima bacheca
          </Button>
        </EmptyState>

        <section aria-labelledby="templates-title" className="mt-8">
          <h2
            id="templates-title"
            className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase"
          >
            Template disponibili
          </h2>
          <ul className="mt-3.5 grid gap-5 md:grid-cols-3">
            {BOARD_TEMPLATES.map((template) => (
              <li key={template.id}>
                <Surface className="h-full border-dashed border-border-strong/50 p-5">
                  <h3 className="font-medium">{template.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
                  {template.columns.length > 0 ? (
                    <ol
                      aria-label={`Colonne di ${template.name}`}
                      className="mt-3 flex flex-wrap gap-1.5"
                    >
                      {template.columns.map((column) => (
                        <li key={column.name}>
                          <Badge>{column.name}</Badge>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Nessuna colonna: la costruisci tu.
                    </p>
                  )}
                </Surface>
              </li>
            ))}
          </ul>
        </section>
        {dialogs}
      </>
    );
  }

  const renderGroup = (group: BoardListItem[], label: string | null) =>
    group.length === 0 ? null : (
      <section aria-label={label ?? 'Bacheche'}>
        {label ? (
          <h2 className="mb-3.5 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            {label}
          </h2>
        ) : null}
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {group.map((board, index) => (
            <li key={board.id}>
              <BoardCard
                board={board}
                canMoveUp={index > 0}
                canMoveDown={index < group.length - 1}
                onToggleFavorite={() =>
                  update.mutate(
                    { boardId: board.id, input: { isFavorite: !board.isFavorite } },
                    {
                      onError: () =>
                        notify('error', 'Non siamo riusciti ad aggiornare i preferiti. Riprova.'),
                    },
                  )
                }
                onEdit={() => setEditing(board)}
                onMove={(direction) => moveWithinGroup(board, direction)}
                onDelete={() => setDeleting(board)}
              />
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <>
      {header}
      <div className="space-y-8">
        {renderGroup(groups[0]!, hasBoth ? 'Preferite' : null)}
        {renderGroup(groups[1]!, hasBoth ? 'Tutte le bacheche' : null)}
      </div>
      {dialogs}
    </>
  );
}
