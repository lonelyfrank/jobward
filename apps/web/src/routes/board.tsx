import { Archive, Palette, Pencil, Plus, SlidersHorizontal, Star, Trash2 } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Link, Outlet, useMatch, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { WorkspacePageHeader } from '@/components/ui/workspace-page-header';
import { ColumnDialog } from '@/features/kanban/column-dialog';
import { useNotify } from '@/components/ui/notices';
import { Skeleton } from '@/components/ui/skeleton';
import { Surface } from '@/components/ui/surface';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useBoardDetail, useDeleteBoard, useUpdateBoard } from '@/features/boards/api';
import { BoardDialog } from '@/features/boards/board-dialog';
import { BoardBackgroundDialog } from '@/features/boards/board-background-dialog';
import { ArchivedDialog } from '@/features/cards/archived-dialog';
import { setDensity, useDensity } from '@/features/kanban/density';
import { userMessage } from '@/features/kanban/mutations';
import { cn } from '@/lib/cn';
import { isColorToken } from '@/lib/labels';
import { boardBackgroundStyle, isBoardBackgroundImage } from '@/lib/board-backgrounds';
import { useViewEnter } from '@/hooks/use-view-enter';

// Il configuratore è usato di rado: non pesa sul caricamento della bacheca.
const CustomFieldsDialog = lazy(() =>
  import('@/features/custom-fields/fields-dialog').then((m) => ({ default: m.CustomFieldsDialog })),
);

/** Bacheca aperta: intestazione, Kanban e (come sotto-rotta) il pannello di dettaglio della scheda. */
export function BoardPage() {
  const { boardId = '' } = useParams();
  const navigate = useNavigate();
  const tableView = useMatch('/boards/:boardId/table/*') !== null;
  const density = useDensity();
  const contentRef = useViewEnter<HTMLDivElement>(`${tableView ? 'table' : 'kanban'}:${density}`);
  const notify = useNotify();
  const board = useBoardDetail(boardId);
  const update = useUpdateBoard();
  const remove = useDeleteBoard();

  const [addingColumn, setAddingColumn] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [configuringFields, setConfiguringFields] = useState(false);
  const [changingBackground, setChangingBackground] = useState(false);

  if (board.isPending) {
    return (
      <div className="px-4 pt-4 pb-4 sm:px-6 lg:px-8">
        <WorkspacePageHeader compact title="Bacheca" description="Caricamento…" />
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
      <div className="px-4 pt-4 pb-4 sm:px-6 lg:px-8">
        <WorkspacePageHeader compact title={notFound ? 'Bacheca non trovata' : 'Bacheca'} />
        <Surface className="p-6" role="alert">
          <p className="font-semibold">
            {notFound ? 'Bacheca non trovata' : 'Non riusciamo a caricare la bacheca.'}
          </p>
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
    <div className="flex h-full min-h-0 flex-col px-4 pt-4 pb-4 sm:px-6 lg:px-8">
      <WorkspacePageHeader
        compact
        className="mb-2 shrink-0"
        title={info.name}
        description={info.description ?? undefined}
        canCreateCard={columns.length > 0}
        boardId={boardId}
        backLink={{ to: '/boards', label: 'Torna alle bacheche' }}
        controls={
          <>
            <SegmentedControl
              as="nav"
              label="Visualizzazione della bacheca"
              value={tableView ? 'table' : 'kanban'}
            >
              {[
                { to: `/boards/${boardId}`, label: 'Kanban', active: !tableView },
                { to: `/boards/${boardId}/table`, label: 'Tabella', active: tableView },
              ].map((view) => (
                <Link
                  key={view.to}
                  to={view.to}
                  aria-current={view.active ? 'page' : undefined}
                  className={cn(
                    'relative z-10 inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold transition-colors max-md:min-h-11 md:h-7 md:px-2.5 md:text-[13px]',
                    view.active
                      ? 'text-primary-soft-foreground'
                      : 'text-muted-foreground hover:bg-surface hover:text-foreground',
                  )}
                >
                  {view.label}
                </Link>
              ))}
            </SegmentedControl>
            {!tableView ? (
              <SegmentedControl label="Densità delle schede" value={density}>
                {(
                  [
                    ['compact', 'Compatta'],
                    ['informative', 'Informativa'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={density === value}
                    onClick={() => setDensity(value)}
                    className={cn(
                      'relative z-10 inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold transition-colors max-md:min-h-11 md:h-7 md:px-2.5 md:text-[13px]',
                      density === value
                        ? 'text-primary-soft-foreground'
                        : 'text-muted-foreground hover:bg-surface hover:text-foreground',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </SegmentedControl>
            ) : null}
          </>
        }
        actions={[
          {
            id: 'add-column',
            group: 'create',
            label: 'Aggiungi colonna',
            icon: Plus,
            onSelect: () => setAddingColumn(true),
          },
          {
            id: 'background',
            group: 'view',
            label: `Cambia il background di ${info.name}`,
            icon: Palette,
            onSelect: () => setChangingBackground(true),
          },
          {
            id: 'archived',
            group: 'view',
            label: `Archiviate (${archivedTotal})`,
            icon: Archive,
            onSelect: () => setShowArchived(true),
          },
          {
            id: 'favorite',
            group: 'manage',
            label: info.isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti',
            icon: Star,
            onSelect: () =>
              update.mutate(
                { boardId: info.id, input: { isFavorite: !info.isFavorite } },
                { onError: () => notify('error', 'Non siamo riusciti ad aggiornare i preferiti.') },
              ),
          },
          {
            id: 'edit-board',
            group: 'manage',
            label: 'Modifica bacheca…',
            icon: Pencil,
            onSelect: () => setEditing(true),
          },
          {
            id: 'fields',
            group: 'manage',
            label: 'Campi personalizzati…',
            icon: SlidersHorizontal,
            onSelect: () => setConfiguringFields(true),
          },
          {
            id: 'delete-board',
            group: 'danger',
            label: 'Elimina bacheca…',
            icon: Trash2,
            danger: true,
            onSelect: () => setDeleting(true),
          },
        ]}
      />

      <div
        data-testid="board-surface"
        data-board-color={isColorToken(info.color) ? info.color : 'default'}
        data-board-image={
          isBoardBackgroundImage(info.backgroundImage) ? info.backgroundImage : undefined
        }
        style={boardBackgroundStyle(info.backgroundImage)}
        className="board-background min-h-0 flex-1 overflow-hidden rounded-xl border border-border"
      >
        <div ref={contentRef} className="h-full min-h-0">
          <Outlet />
        </div>
      </div>

      {changingBackground ? (
        <BoardBackgroundDialog key={info.id} board={info} onOpenChange={setChangingBackground} />
      ) : null}
      {addingColumn ? <ColumnDialog boardId={boardId} open onOpenChange={setAddingColumn} /> : null}
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
      {configuringFields ? (
        <Suspense fallback={null}>
          <CustomFieldsDialog
            boardId={boardId}
            boardName={info.name}
            open
            onOpenChange={(open) => !open && setConfiguringFields(false)}
          />
        </Suspense>
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
