import { useEffect, useMemo, useRef } from 'react';
import { useBlocker, useLocation, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogBody, DialogCloseButton } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useBoardDetail, useCardDetail } from '@/features/boards/api';
import { groupCards } from '@/features/kanban/board-state';
import { useWorkspace } from '@/features/workspace/context';
import { CardDetailForm } from './card-detail';
import { DirtyGuardContext } from './dirty-guard';
import { hashFromTab, tabFromHash, type CardTab } from './workspace-tabs';

/**
 * Modale della candidatura come sotto-rotta (`…/cards/:cardId`, con la scheda in `#colloqui` ecc.):
 * l'indirizzo è condivisibile, «indietro» la chiude e la vista sotto (Kanban, Tabella, Opportunità)
 * resta viva. Schermo intero a telefono, finestra ampia centrata da `md`.
 *
 * Modifiche non salvate: ogni tentativo di lasciare la pagina (Esc, X, clic fuori, «indietro»,
 * cambio di rotta) passa dal blocco di navigazione e chiede conferma; chiudere o ricaricare la
 * scheda del browser è coperto da `beforeunload`.
 */
export function CardDetailRoute() {
  const { boardId: boardParam, cardId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { workspace } = useWorkspace();
  const detail = useCardDetail(cardId);
  // Dalla bacheca l'id è nell'indirizzo; da Opportunità si ricava dalla scheda stessa.
  const boardId = boardParam ?? detail.data?.card.boardId ?? '';
  const board = useBoardDetail(boardId, boardId !== '');

  const groups = useMemo(
    () => (board.data ? groupCards(board.data.columns, board.data.cards) : {}),
    [board.data],
  );

  const dirtyRef = useRef<Set<string>>(new Set());
  const basePath = location.pathname.replace(/\/cards\/[^/]+\/?$/, '');
  // Si blocca solo l'USCITA dalla modale (cambia il percorso): cambiare scheda interna (hash) è libero.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyRef.current.size > 0 && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current.size > 0) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  // Si chiude tornando alla vista sotto cui si è aperta, con la stessa ricerca e gli stessi filtri.
  const close = () => void navigate(`${basePath}${location.search}`);
  const tab = tabFromHash(location.hash);
  // Radix attiva al focus e al mouse-down: prima del render successivo entrambi possono
  // chiedere la stessa navigazione. Una sola voce per gesto, altrimenti Back resta sulla scheda.
  const requestedHash = useRef(location.hash);
  useEffect(() => {
    requestedHash.current = location.hash;
  }, [location.hash]);
  const setTab = (next: CardTab) => {
    const hash = hashFromTab(next);
    if (hash === location.hash || hash === requestedHash.current) return;
    requestedHash.current = hash;
    void navigate(
      { pathname: location.pathname, search: location.search, hash: hashFromTab(next) },
      { replace: false },
    );
  };
  const title = detail.data?.card.title ?? 'Scheda';
  const notFound = detail.error && 'status' in detail.error && detail.error.status === 404;

  return (
    <DirtyGuardContext.Provider value={dirtyRef}>
      <Dialog
        open
        variant="workspace"
        title={title}
        description="Panoramica, colloqui, timeline, note, documenti e dettagli della candidatura"
        onOpenChange={(open) => !open && close()}
        onCloseAutoFocus={(event) => {
          // Il pulsante che ha aperto la modale (la scheda o la riga) non è più un «trigger»
          // Radix: il focus si riporta al suo link, se è ancora in pagina.
          const target = document.querySelector<HTMLElement>(`[data-card-id="${cardId}"] a`);
          if (target) {
            event.preventDefault();
            target.focus();
          }
        }}
      >
        {detail.isPending || (boardId !== '' && board.isPending) ? (
          <>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <p aria-hidden="true" className="text-lg font-semibold text-muted-foreground">
                Caricamento…
              </p>
              <DialogCloseButton />
            </div>
            <DialogBody>
              <div role="status" aria-label="Caricamento della scheda" className="space-y-3">
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
                <Skeleton className="h-32" />
              </div>
            </DialogBody>
          </>
        ) : (!detail.data && detail.isError) || (!board.data && board.isError) ? (
          <>
            <div className="flex items-center justify-end border-b border-border px-5 py-3">
              <DialogCloseButton />
            </div>
            <DialogBody>
              <p role="alert" className="font-medium">
                {notFound
                  ? 'Questa scheda non esiste o non è più disponibile.'
                  : 'Non riusciamo a caricare la scheda.'}
              </p>
              <div className="mt-4 flex gap-2">
                {!notFound ? (
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
                  Chiudi
                </Button>
              </div>
            </DialogBody>
          </>
        ) : board.data ? (
          <CardDetailForm
            key={detail.data.card.id}
            boardId={boardId}
            card={detail.data.card}
            columns={board.data.columns}
            lastCardIdOf={(columnId) => groups[columnId]?.at(-1)?.id ?? null}
            timeZone={workspace.timezone}
            tab={tab}
            onTabChange={setTab}
            onArchived={() => {
              dirtyRef.current.clear();
              close();
            }}
          />
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title="Hai modifiche non salvate"
        description={
          <p>
            Se esci ora le modifiche che hai scritto andranno perse. Puoi tornare alla scheda e
            salvarle.
          </p>
        }
        confirmLabel="Esci senza salvare"
        cancelLabel="Torna alla scheda"
        onConfirm={() => {
          dirtyRef.current.clear();
          if (blocker.state === 'blocked') blocker.proceed();
        }}
      />
    </DirtyGuardContext.Provider>
  );
}
