import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useBoardDetail, useCardDetail } from '@/features/boards/api';
import { groupCards } from '@/features/kanban/board-state';
import { useWorkspace } from '@/features/workspace/context';
import { CardDetailForm } from './card-detail';

/**
 * Pannello di dettaglio come sotto-rotta della bacheca (`/boards/:boardId/cards/:cardId`):
 * l'indirizzo è condivisibile, "indietro" lo chiude e la bacheca resta visibile e viva dietro.
 * A telefono occupa lo schermo intero; da `md` è un pannello laterale.
 */
export function CardDetailRoute() {
  const { boardId = '', cardId } = useParams();
  const navigate = useNavigate();
  const { workspace } = useWorkspace();
  const detail = useCardDetail(cardId);
  const board = useBoardDetail(boardId);

  const groups = useMemo(
    () => (board.data ? groupCards(board.data.columns, board.data.cards) : {}),
    [board.data],
  );

  const close = () => void navigate(`/boards/${boardId}`);
  const title = detail.data?.card.title ?? 'Scheda';

  return (
    <Dialog
      open
      variant="drawer"
      title={title}
      description="Dettagli e cronologia della scheda"
      onOpenChange={(open) => !open && close()}
      onCloseAutoFocus={(event) => {
        // Il pulsante che ha aperto il pannello (la scheda nella bacheca) non è più un
        // "trigger" Radix: il focus si riporta alla scheda, se è ancora sulla bacheca.
        const target = document.querySelector<HTMLElement>(`[data-card-id="${cardId}"] a`);
        if (target) {
          event.preventDefault();
          target.focus();
        }
      }}
    >
      {detail.isPending || board.isPending ? (
        <DialogBody>
          <div role="status" aria-label="Caricamento della scheda" className="space-y-3">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-32" />
          </div>
        </DialogBody>
      ) : detail.isError || board.isError ? (
        <DialogBody>
          <p role="alert" className="font-medium">
            {detail.error && 'status' in detail.error && detail.error.status === 404
              ? 'Questa scheda non esiste o non è più disponibile.'
              : 'Non riusciamo a caricare la scheda.'}
          </p>
          <div className="mt-4 flex gap-2">
            {!(detail.error && 'status' in detail.error && detail.error.status === 404) ? (
              <Button
                variant="secondary"
                onClick={() => {
                  void detail.refetch();
                  void board.refetch();
                }}
              >
                Riprova
              </Button>
            ) : null}
            <Button variant="secondary" onClick={close}>
              Torna alla bacheca
            </Button>
          </div>
        </DialogBody>
      ) : (
        <CardDetailForm
          key={detail.data.card.id}
          boardId={boardId}
          card={detail.data.card}
          history={detail.data.history}
          columns={board.data.columns}
          lastCardIdOf={(columnId) => groups[columnId]?.at(-1)?.id ?? null}
          timeZone={workspace.timezone}
          onArchived={close}
        />
      )}
    </Dialog>
  );
}
