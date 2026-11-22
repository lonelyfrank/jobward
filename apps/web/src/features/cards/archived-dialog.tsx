import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody } from '@/components/ui/dialog';
import { useNotify } from '@/components/ui/notices';
import { Skeleton } from '@/components/ui/skeleton';
import { useArchivedCards } from '@/features/boards/api';
import { useRestoreCard, userMessage } from '@/features/kanban/mutations';
import { useWorkspace } from '@/features/workspace/context';
import { formatDateTime } from '@/lib/format';

/** Schede archiviate di una bacheca, con ripristino. Nulla viene eliminato definitivamente. */
export function ArchivedDialog({
  boardId,
  columnNames,
  open,
  onOpenChange,
}: {
  boardId: string;
  columnNames: Record<string, string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { workspace } = useWorkspace();
  const archived = useArchivedCards(boardId, open);
  const restore = useRestoreCard(boardId);
  const notify = useNotify();

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Schede archiviate"
      description="Le schede archiviate non compaiono nella bacheca ma si possono ripristinare."
    >
      <DialogBody>
        {archived.isPending ? (
          <div role="status" aria-label="Caricamento delle schede archiviate">
            <Skeleton className="h-12" />
          </div>
        ) : archived.isError ? (
          <div role="alert">
            <p className="font-medium">Non riusciamo a caricare le schede archiviate.</p>
            <Button variant="secondary" className="mt-3" onClick={() => void archived.refetch()}>
              Riprova
            </Button>
          </div>
        ) : archived.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna scheda archiviata.</p>
        ) : (
          <ul className="divide-y divide-border">
            {archived.data.map((card) => (
              <li key={card.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{card.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {columnNames[card.columnId] ?? 'Colonna'} · archiviata il{' '}
                    {card.archivedAt ? formatDateTime(card.archivedAt, workspace.timezone) : '—'}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={restore.isPending}
                  onClick={() =>
                    restore.mutate(card.id, {
                      onSuccess: () => notify('success', `Scheda “${card.title}” ripristinata.`),
                      onError: (e) =>
                        notify(
                          'error',
                          userMessage(e, 'Non siamo riusciti a ripristinare la scheda.'),
                        ),
                    })
                  }
                >
                  <RotateCcw aria-hidden="true" />
                  Ripristina
                  <span className="sr-only"> “{card.title}”</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogBody>
    </Dialog>
  );
}
