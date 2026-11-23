import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { Card } from '@jobward/schemas';
import {
  derivePipelineStatus,
  type PipelineStatus,
  type PipelineTransitionKind,
} from '@jobward/shared';
import { ArrowRightLeft, CalendarClock, GripVertical } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotify } from '@/components/ui/notices';
import { Surface } from '@/components/ui/surface';
import { WorkspacePageHeader } from '@/components/ui/workspace-page-header';
import { NO_BOARD_LABEL } from '@/features/cards/card-path';
import { usePipelineBoard } from '@/features/pipeline-board/api';
import {
  PIPELINE_COLUMNS,
  columnOf,
  targetsIn,
  type PipelineColumnId,
} from '@/features/pipeline-board/columns';
import { PipelineConfirmation } from '@/features/pipeline/pipeline-panel';
import { STATUS_LABELS } from '@/features/pipeline/presentation';
import { useAvailableHeight } from '@/hooks/use-available-height';
import { cn } from '@/lib/cn';

type BoardCard = Card & { boardName: string | null };
type Pending = { card: BoardCard; kind: PipelineTransitionKind; to: PipelineStatus };

/** Richiesta di spostamento verso una colonna: transizione unica, scelta dell'esito o rifiuto. */
function useMoveRequest() {
  const notify = useNotify();
  const [pending, setPending] = useState<Pending | null>(null);
  const [choice, setChoice] = useState<{ card: BoardCard; column: PipelineColumnId } | null>(null);
  const request = (card: BoardCard, column: PipelineColumnId) => {
    if (columnOf(card) === column && column !== 'closed') return;
    const targets = targetsIn(card, column).filter((t) => t.to !== derivePipelineStatus(card));
    if (targets.length === 0) {
      notify(
        'error',
        `«${card.title}» non può passare a «${PIPELINE_COLUMNS.find((c) => c.id === column)?.title}» dallo stato attuale.`,
      );
      return;
    }
    if (targets.length === 1) setPending({ card, ...targets[0]! });
    else setChoice({ card, column });
  };
  return { pending, setPending, choice, setChoice, request };
}

function PipelineCard({
  card,
  onMove,
  dragging = false,
}: {
  card: BoardCard;
  onMove: (card: BoardCard, column: PipelineColumnId) => void;
  dragging?: boolean;
}) {
  const location = useLocation();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });
  const status = derivePipelineStatus(card);
  const next = card.interviewSummary.next;
  const current = columnOf(card);
  return (
    <article
      ref={setNodeRef}
      className={cn(
        'rounded-lg border border-border bg-surface p-3 shadow-sm',
        (isDragging || dragging) && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          className="-ml-1 mt-0.5 cursor-grab rounded p-0.5 text-muted-foreground hover:bg-hover-soft max-md:hidden"
          aria-label={`Trascina «${card.title}»`}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
        <Link
          to={`${location.pathname.replace(/\/$/, '')}/cards/${card.id}`}
          className="min-w-0 flex-1 text-sm font-semibold break-words hover:underline"
        >
          {card.title}
        </Link>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 shrink-0 max-md:size-11"
              aria-label={`Sposta «${card.title}» in un altro stato`}
            >
              <ArrowRightLeft aria-hidden="true" className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Sposta in…</DropdownMenuLabel>
            {PIPELINE_COLUMNS.filter((c) => c.id !== current || c.id === 'closed').map((c) => (
              <DropdownMenuItem key={c.id} onSelect={() => onMove(card, c.id)}>
                {c.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {card.company ? <p className="mt-1 text-sm text-muted-foreground">{card.company}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        {current === 'closed' ? <Badge tone="neutral">{STATUS_LABELS[status]}</Badge> : null}
        {card.applicationCount > 1 ? (
          <Badge tone="info">Candidatura n. {card.applicationCount}</Badge>
        ) : null}
        <span className="text-muted-foreground">{card.boardName ?? NO_BOARD_LABEL}</span>
      </div>
      {next ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-info-soft-foreground">
          <CalendarClock aria-hidden="true" className="size-3.5" />
          {next.title}
        </p>
      ) : null}
    </article>
  );
}

function Column({
  id,
  title,
  cards,
  onMove,
}: {
  id: PipelineColumnId;
  title: string;
  cards: BoardCard[];
  onMove: (card: BoardCard, column: PipelineColumnId) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`pipeline-col-${id}`}
      className={cn(
        // Da `md` la colonna è alta quanto l'area e le schede scorrono al suo interno.
        'flex w-72 shrink-0 flex-col rounded-xl border border-border bg-surface-muted/60 p-2 max-md:w-full md:h-full md:min-h-0',
        isOver && 'ring-2 ring-primary',
      )}
    >
      <h2
        id={`pipeline-col-${id}`}
        className="flex shrink-0 items-center justify-between px-1.5 pt-1 pb-2 text-sm font-semibold"
      >
        {title}
        <span className="rounded-full bg-surface px-2 text-xs tabular-nums text-muted-foreground">
          {cards.length}
        </span>
      </h2>
      <ul className="flex min-h-16 flex-col gap-2 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain">
        {cards.map((card) => (
          <li key={card.id}>
            <PipelineCard card={card} onMove={onMove} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Bacheca canonica (C-01): le colonne SONO gli stati della candidatura. È una vista sulle stesse
 * opportunità (nessuna posizione propria). Trascinare o usare «Sposta in…» apre sempre la conferma
 * della pipeline: lo stato cambia solo con una transizione esplicita e validata.
 */
export function Component() {
  const boardRef = useRef<HTMLDivElement>(null);
  const available = useAvailableHeight(boardRef);
  // Finestre molto basse: almeno 320 px, poi scorre la pagina.
  const boardHeight = available > 0 ? Math.max(320, available) : undefined;
  const board = usePipelineBoard();
  const move = useMoveRequest();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  );
  const cards = board.data ?? [];
  const byColumn = new Map<PipelineColumnId, BoardCard[]>(PIPELINE_COLUMNS.map((c) => [c.id, []]));
  for (const card of cards) byColumn.get(columnOf(card))?.push(card);
  const active = cards.find((c) => c.id === activeId) ?? null;

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const card = cards.find((c) => c.id === event.active.id);
    const column = event.over?.id as PipelineColumnId | undefined;
    if (card && column) move.request(card, column);
  };

  return (
    <>
      <WorkspacePageHeader title="Pipeline" canCreateCard />
      {board.isError ? (
        <Surface className="p-6" role="alert">
          Impossibile caricare la pipeline. Riprova tra poco.
        </Surface>
      ) : board.isPending ? (
        <p className="text-sm text-muted-foreground">Caricamento della pipeline…</p>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(e) => setActiveId(String(e.active.id))}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={onDragEnd}
        >
          <div
            // Area a scorrimento orizzontale: raggiungibile da tastiera anche quando le colonne sono vuote.
            role="region"
            aria-label="Colonne della pipeline"
            // Come la tabella delle opportunità: WCAG 2.1.1 richiede che una regione scorrevole sia focalizzabile.
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            // Alta quanto lo spazio visibile: la pagina non scorre (su telefono scorre quest'area).
            ref={boardRef}
            style={boardHeight ? { height: boardHeight } : undefined}
            className="flex gap-3 overflow-x-auto rounded-xl pb-2 focus-visible:outline-2 focus-visible:outline-offset-2 max-md:flex-col max-md:overflow-y-auto"
          >
            {PIPELINE_COLUMNS.map((c) => (
              <Column
                key={c.id}
                id={c.id}
                title={c.title}
                cards={byColumn.get(c.id) ?? []}
                onMove={move.request}
              />
            ))}
          </div>
          <DragOverlay>
            {active ? <PipelineCard card={active} onMove={() => {}} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {move.choice ? (
        <Dialog
          open
          onOpenChange={(open) => !open && move.setChoice(null)}
          title="Come si è chiusa?"
          description={`Scegli l’esito di «${move.choice.card.title}».`}
        >
          <DialogBody className="grid gap-2">
            {targetsIn(move.choice.card, move.choice.column).map((t) => (
              <Button
                key={t.to}
                variant="secondary"
                onClick={() => {
                  const card = move.choice!.card;
                  move.setChoice(null);
                  move.setPending({ card, ...t });
                }}
              >
                {STATUS_LABELS[t.to]}
              </Button>
            ))}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => move.setChoice(null)}>
              Annulla
            </Button>
          </DialogFooter>
        </Dialog>
      ) : null}

      {move.pending ? (
        <PipelineConfirmation
          card={move.pending.card}
          kind={move.pending.kind}
          to={move.pending.to}
          onClose={() => move.setPending(null)}
          onDone={() => move.setPending(null)}
        />
      ) : null}
      <Outlet />
    </>
  );
}
