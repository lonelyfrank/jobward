import {
  closestCenter,
  DndContext,
  DragOverlay,
  getFirstCollision,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import type { BoardDetailResponse, Card, Column } from '@jobward/schemas';
import { anchorBefore } from '@jobward/shared';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNotify } from '@/components/ui/notices';
import { groupCards, menuMove } from './board-state';
import { useBoardZoom } from './board-zoom';
import { BoardZoomControls } from './board-zoom-controls';
import { CardView } from './card-view';
import { ColumnDialog } from './column-dialog';
import { DeleteColumnDialog } from './delete-column-dialog';
import type { CardAction } from './kanban-card';
import { KanbanColumn, type ColumnAction } from './kanban-column';
import {
  useArchiveCard,
  useMoveCard,
  useMoveColumn,
  useRestoreCard,
  userMessage,
} from './mutations';

type Items = Record<string, string[]>;

const INSTRUCTIONS =
  'Per spostare: premi Spazio o Invio sulla maniglia, usa le frecce per scegliere la posizione, Spazio o Invio per rilasciare, Esc per annullare. In alternativa usa il menu delle azioni.';

/**
 * Kanban interattivo (dnd-kit): schede trascinabili tra colonne e nella stessa colonna,
 * colonne trascinabili, tastiera (maniglie), touch (pressione breve) e menu alternativo.
 *
 * Durante il trascinamento lo stato "in volo" vive in `dragItems` (solo ordine degli id); al
 * rilascio si calcola la posizione finale come "dopo quale scheda" e la si invia con una
 * mutazione ottimistica (con rollback): vedi `mutations.ts`.
 */
export function KanbanBoard({ boardId, data }: { boardId: string; data: BoardDetailResponse }) {
  const { columns, cards } = data;
  const {
    zoom,
    viewportRef,
    canvasRef,
    zoomOut,
    zoomIn,
    fit,
    reset: resetZoom,
    fitting,
    canZoomOut,
    canZoomIn,
  } = useBoardZoom(boardId, columns.length);
  const notify = useNotify();
  const moveCard = useMoveCard(boardId);
  const moveColumn = useMoveColumn(boardId);
  const archive = useArchiveCard(boardId);
  const restore = useRestoreCard(boardId);

  const groups = useMemo(() => groupCards(columns, cards), [columns, cards]);
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const baseItems = useMemo<Items>(
    () =>
      Object.fromEntries(Object.entries(groups).map(([id, list]) => [id, list.map((c) => c.id)])),
    [groups],
  );

  const [dragItems, setDragItems] = useState<Items | null>(null);
  const [active, setActive] = useState<{
    type: 'card' | 'column';
    id: string;
    width?: number;
  } | null>(null);
  const items = dragItems ?? baseItems;
  const lastOverId = useRef<UniqueIdentifier | null>(null);

  const [editingColumn, setEditingColumn] = useState<Column | null>(null);
  const [deletingColumn, setDeletingColumn] = useState<Column | null>(null);

  const sensors = useSensors(
    // Il mouse parte dopo pochi pixel di movimento: un semplice click apre la scheda.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Il tocco richiede una breve pressione: lo scorrimento della bacheca resta libero.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const containerOf = useCallback(
    (id: UniqueIdentifier, source: Items): string | undefined =>
      id in source
        ? String(id)
        : Object.keys(source).find((key) => source[key]!.includes(String(id))),
    [],
  );

  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      if (active?.type === 'column') {
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter(
            (c) => c.data.current?.['type'] === 'column',
          ),
        });
      }
      const pointer = pointerWithin(args);
      const hits = pointer.length > 0 ? pointer : rectIntersection(args);
      let overId = getFirstCollision(hits, 'id');
      if (overId != null) {
        if (overId in items) {
          // Sopra una colonna: si cerca la scheda più vicina al suo interno...
          const inColumn = items[overId as string]!;
          const others = inColumn.filter((id) => id !== active?.id);
          const lastRect = others.length > 0 ? args.droppableRects.get(others.at(-1)!) : undefined;
          const pointerY = args.pointerCoordinates?.y;
          // ...tranne se il puntatore è sotto l'ultima scheda: allora si intende "in fondo" e
          // il bersaglio resta la colonna (altrimenti rilasciare sotto l'ultima la metterebbe sopra).
          const belowAll =
            lastRect !== undefined && pointerY !== undefined && pointerY > lastRect.bottom;
          if (inColumn.length > 0 && !belowAll) {
            overId =
              closestCenter({
                ...args,
                droppableContainers: args.droppableContainers.filter(
                  (c) => c.id !== overId && inColumn.includes(String(c.id)),
                ),
              })[0]?.id ?? overId;
          }
        }
        lastOverId.current = overId;
        return [{ id: overId }];
      }
      return lastOverId.current ? [{ id: lastOverId.current }] : [];
    },
    [active?.type, active?.id, items],
  );

  const onDragStart = ({ active: a }: DragStartEvent) => {
    const type = a.data.current?.['type'] === 'column' ? 'column' : 'card';
    setActive({ type, id: String(a.id), width: a.rect.current.initial?.width });
    if (type === 'card') setDragItems(structuredClone(baseItems));
  };

  const onDragOver = ({ active: a, over }: DragOverEvent) => {
    if (active?.type !== 'card' || !over || !dragItems) return;
    const from = containerOf(a.id, dragItems);
    const to = containerOf(over.id, dragItems);
    if (!from || !to || from === to) return;

    setDragItems((current) => {
      if (!current) return current;
      const source = current[from]!.filter((id) => id !== a.id);
      const target = [...current[to]!];
      const overIndex = target.indexOf(String(over.id));
      let index = target.length; // colonna (anche vuota): in fondo
      if (overIndex >= 0) {
        // Il centro della scheda trascinata oltre il centro del bersaglio ⇒ si inserisce DOPO.
        const moving = a.rect.current.translated;
        const below =
          moving !== null && moving.top + moving.height / 2 > over.rect.top + over.rect.height / 2;
        index = overIndex + (below ? 1 : 0);
      }
      target.splice(index, 0, String(a.id));
      return { ...current, [from]: source, [to]: target };
    });
  };

  const reset = () => {
    setActive(null);
    setDragItems(null);
    lastOverId.current = null;
  };

  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    if (active?.type === 'column') {
      reset();
      if (!over || a.id === over.id) return;
      const ids = columns.map((c) => c.id);
      const next = arrayMove(ids, ids.indexOf(String(a.id)), ids.indexOf(String(over.id)));
      const afterColumnId = anchorBefore(
        next.map((id) => ({ id })),
        String(a.id),
      );
      moveColumn.mutate({ columnId: String(a.id), afterColumnId });
      return;
    }

    const working = dragItems ? structuredClone(dragItems) : null;
    reset();
    // Rilasciata fuori da qualunque bersaglio: come un annullamento, nessuna modifica.
    if (!working || !over) return;
    const cardId = String(a.id);
    const original = cardById.get(cardId);
    const container = containerOf(cardId, working);
    if (!original || !container) return;

    if (over.id !== a.id) {
      const overContainer = containerOf(over.id, working);
      if (overContainer === container) {
        const list = working[container]!;
        const oldIndex = list.indexOf(cardId);
        const newIndex = list.indexOf(String(over.id));
        if (newIndex >= 0 && oldIndex !== newIndex)
          working[container] = arrayMove(list, oldIndex, newIndex);
      }
    }

    const finalList = working[container]!;
    const afterCardId = anchorBefore(
      finalList.map((id) => ({ id })),
      cardId,
    );
    const unchanged =
      container === original.columnId && afterCardId === anchorBefore(groups[container]!, cardId);
    if (unchanged) return;
    moveCard.mutate({ cardId, columnId: container, afterCardId });
  };

  const handleCardAction = (card: Card, action: CardAction) => {
    if (action.kind === 'archive') {
      archive.mutate(card.id, {
        onSuccess: () =>
          notify('success', `Scheda “${card.title}” archiviata.`, {
            label: 'Annulla',
            onClick: () =>
              restore.mutate(card.id, {
                onError: (e) =>
                  notify('error', userMessage(e, 'Non siamo riusciti a ripristinare la scheda.')),
              }),
          }),
        onError: (e) =>
          notify('error', userMessage(e, 'Non siamo riusciti ad archiviare la scheda.')),
      });
      return;
    }
    const move = menuMove(groups, card, action);
    if (move) moveCard.mutate(move);
  };

  const handleColumnAction = (column: Column, action: ColumnAction) => {
    if (action === 'edit') return setEditingColumn(column);
    if (action === 'delete') return setDeletingColumn(column);
    const index = columns.findIndex((c) => c.id === column.id);
    if (action === 'left' && index > 0) {
      moveColumn.mutate({
        columnId: column.id,
        afterColumnId: anchorBefore(columns, columns[index - 1]!.id),
      });
    }
    if (action === 'right' && index < columns.length - 1) {
      moveColumn.mutate({ columnId: column.id, afterColumnId: columns[index + 1]!.id });
    }
  };

  // Annunci per screen reader, in italiano.
  const announcements: Announcements = useMemo(() => {
    const labelOf = (id: UniqueIdentifier) =>
      cardById.get(String(id))?.title ?? columns.find((c) => c.id === id)?.name ?? 'elemento';
    const where = (id: UniqueIdentifier | undefined) => {
      if (id === undefined) return '';
      const key = (dragItems ?? baseItems)[String(id)]
        ? String(id)
        : containerOf(id, dragItems ?? baseItems);
      const column = columns.find((c) => c.id === key);
      return column ? ` in “${column.name}”` : '';
    };
    return {
      onDragStart: ({ active: a }) => `Hai preso “${labelOf(a.id)}”.`,
      // Sopra se stessa non è una novità da annunciare: resta "Hai preso …".
      onDragOver: ({ active: a, over }) =>
        over && over.id !== a.id
          ? `“${labelOf(a.id)}” è ora sopra “${labelOf(over.id)}”${where(over.id)}.`
          : undefined,
      onDragEnd: ({ active: a, over }) =>
        over ? `“${labelOf(a.id)}” rilasciata${where(over.id)}.` : `“${labelOf(a.id)}” rilasciata.`,
      onDragCancel: ({ active: a }) => `Spostamento di “${labelOf(a.id)}” annullato.`,
    };
  }, [baseItems, cardById, columns, containerOf, dragItems]);

  const activeCard = active?.type === 'card' ? cardById.get(active.id) : undefined;
  const activeColumn =
    active?.type === 'column' ? columns.find((c) => c.id === active.id) : undefined;

  return (
    <div ref={viewportRef} className="relative h-full min-h-0 overflow-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={reset}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: INSTRUCTIONS },
          restoreFocus: true,
        }}
      >
        {/* `relative`: gli elementi sr-only (absolute) restano contenuti e scorrono con la bacheca,
            altrimenti allargherebbero in orizzontale la pagina intera. */}
        <div
          ref={canvasRef}
          role="group"
          aria-label="Colonne della bacheca"
          data-testid="kanban"
          style={{ zoom, width: '100%', height: '100%' }}
          className="relative flex min-h-0 snap-x snap-mandatory items-start gap-3 overflow-x-auto p-3 sm:snap-none"
        >
          <SortableContext
            items={columns.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            {columns.map((column, index) => (
              <KanbanColumn
                key={column.id}
                zoom={zoom}
                boardId={boardId}
                column={{ ...column, cardCount: items[column.id]?.length ?? column.cardCount }}
                cards={(items[column.id] ?? []).flatMap((id) => cardById.get(id) ?? [])}
                allColumns={columns}
                isFirst={index === 0}
                isLast={index === columns.length - 1}
                onCardAction={handleCardAction}
                onColumnAction={handleColumnAction}
              />
            ))}
          </SortableContext>

          {columns.length === 0 ? (
            <p className="w-[85vw] shrink-0 text-sm text-muted-foreground sm:w-[18rem]">
              Questa bacheca non ha ancora colonne. Usa “Aggiungi colonna” nel menu delle azioni per
              iniziare.
            </p>
          ) : null}
        </div>

        <DragOverlay dropAnimation={null}>
          <div style={{ zoom, width: active?.width ? active.width / zoom : undefined }}>
            {activeCard ? <CardView card={activeCard} boardId={boardId} overlay /> : null}
            {activeColumn ? (
              <div className="w-[18rem] rounded-xl border border-border bg-surface-muted p-3 text-sm font-semibold shadow-md ring-2 ring-ring">
                {activeColumn.name}
              </div>
            ) : null}
          </div>
        </DragOverlay>
      </DndContext>

      {columns.length > 0 ? (
        <BoardZoomControls
          canvasRef={canvasRef}
          zoom={zoom}
          fitting={fitting}
          canZoomOut={canZoomOut}
          canZoomIn={canZoomIn}
          disabled={active !== null}
          onZoomOut={zoomOut}
          onZoomIn={zoomIn}
          onReset={resetZoom}
          onFit={fit}
        />
      ) : null}

      {editingColumn ? (
        <ColumnDialog
          key={editingColumn.id}
          boardId={boardId}
          open
          column={editingColumn}
          onOpenChange={(open) => !open && setEditingColumn(null)}
        />
      ) : null}
      {deletingColumn ? (
        <DeleteColumnDialog
          boardId={boardId}
          column={deletingColumn}
          otherColumns={columns.filter((c) => c.id !== deletingColumn.id)}
          onClose={() => setDeletingColumn(null)}
        />
      ) : null}
    </div>
  );
}
