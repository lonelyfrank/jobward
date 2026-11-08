import { useEffect, useRef, useState, type RefObject } from 'react';
import { cn } from '@/lib/cn';

/** Distanza dal bordo inferiore della bacheca entro cui il puntatore fa comparire la barra. */
const NEAR_BOTTOM_PX = 56;
/** Per quanto la barra resta visibile dopo l'ultimo scorrimento. */
const IDLE_HIDE_MS = 900;

type Metrics = { scrollable: boolean; size: number; progress: number };
const HIDDEN: Metrics = { scrollable: false, size: 1, progress: 0 };

function readMetrics(canvas: HTMLElement): Metrics {
  const max = canvas.scrollWidth - canvas.clientWidth;
  if (max <= 1) return HIDDEN;
  return {
    scrollable: true,
    size: Math.min(1, canvas.clientWidth / canvas.scrollWidth),
    progress: Math.min(1, Math.max(0, canvas.scrollLeft / max)),
  };
}

function sameMetrics(a: Metrics, b: Metrics) {
  return a.scrollable === b.scrollable && a.size === b.size && a.progress === b.progress;
}

/**
 * Barra di scorrimento orizzontale della bacheca, sovrapposta e decorativa.
 *
 * La barra nativa del canvas è nascosta (vedi `kanban-board.tsx`): occupava una fascia a tutta
 * larghezza che il bordo arrotondato tagliava, e con `zoom` cambiava aspetto. Questa vive nel
 * contenitore non zoomato, dentro gli angoli arrotondati, e non sottrae altezza alle colonne.
 * Compare durante lo scorrimento o quando il mouse si avvicina al fondo; il canvas resta lo
 * scroller reale, quindi rotella, tastiera e touch funzionano come prima.
 * Usa solo rapporti (scrollLeft / scrollWidth), validi a qualsiasi livello di zoom.
 */
export function BoardScrollbar({
  canvasRef,
  viewportRef,
  zoom,
}: {
  canvasRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  zoom: number;
}) {
  const [metrics, setMetrics] = useState<Metrics>(HIDDEN);
  const [near, setNear] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startScroll: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      frame = 0;
      const next = readMetrics(canvas);
      setMetrics((m) => (sameMetrics(m, next) ? m : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const onScroll = () => {
      schedule();
      setScrolling(true);
      clearTimeout(idle);
      idle = setTimeout(() => setScrolling(false), IDLE_HIDE_MS);
    };

    const resize = new ResizeObserver(schedule);
    const observeChildren = () => {
      [...canvas.children].forEach((child) => resize.observe(child));
      schedule();
    };
    resize.observe(canvas);
    const mutation = new MutationObserver(observeChildren);
    mutation.observe(canvas, { childList: true });
    canvas.addEventListener('scroll', onScroll, { passive: true });
    observeChildren();
    return () => {
      resize.disconnect();
      mutation.disconnect();
      canvas.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
      clearTimeout(idle);
    };
  }, [canvasRef]);

  // Lo zoom cambia scrollWidth senza ridimensionare il canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frame = requestAnimationFrame(() => {
      const next = readMetrics(canvas);
      setMetrics((m) => (sameMetrics(m, next) ? m : next));
    });
    return () => cancelAnimationFrame(frame);
  }, [canvasRef, zoom]);

  // Prossimità del mouse al fondo della bacheca.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      setNear(viewport.getBoundingClientRect().bottom - event.clientY <= NEAR_BOTTOM_PX);
    };
    const onLeave = () => setNear(false);
    viewport.addEventListener('pointermove', onMove);
    viewport.addEventListener('pointerleave', onLeave);
    return () => {
      viewport.removeEventListener('pointermove', onMove);
      viewport.removeEventListener('pointerleave', onLeave);
    };
  }, [viewportRef]);

  // Spazio percorribile dalla manopola, in pixel dello schermo (la traccia non è zoomata).
  const freeTravel = () => {
    const track = trackRef.current?.getBoundingClientRect().width ?? 0;
    const thumb = thumbRef.current?.getBoundingClientRect().width ?? 0;
    return { thumb, free: Math.max(1, track - thumb) };
  };

  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const visible = metrics.scrollable && (near || scrolling || dragging);
  const thumbWidth = `max(2.5rem, ${metrics.size * 100}%)`;

  return (
    <div
      aria-hidden="true"
      data-testid="board-scrollbar"
      data-visible={visible}
      className={cn(
        'absolute inset-x-4 bottom-1 z-10 h-4 transition-opacity duration-200 motion-reduce:transition-none',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <div
        ref={trackRef}
        data-dragging={dragging}
        className="group absolute inset-x-0 bottom-0 h-2 cursor-pointer rounded-full bg-surface/95 shadow-sm transition-[height] duration-150 hover:h-3 data-[dragging=true]:h-3 motion-reduce:transition-none"
        onPointerDown={(event) => {
          // Clic sulla traccia: centra la manopola sul punto cliccato.
          const canvas = canvasRef.current;
          if (event.target !== event.currentTarget || !canvas) return;
          const { thumb, free } = freeTravel();
          const left = event.currentTarget.getBoundingClientRect().left;
          const fraction = Math.min(1, Math.max(0, (event.clientX - left - thumb / 2) / free));
          canvas.scrollLeft = fraction * (canvas.scrollWidth - canvas.clientWidth);
        }}
      >
        <div
          ref={thumbRef}
          data-dragging={dragging}
          className="absolute inset-y-0 cursor-grab touch-none rounded-full bg-primary/60 transition-colors group-hover:bg-primary data-[dragging=true]:cursor-grabbing data-[dragging=true]:bg-primary"
          style={{
            width: thumbWidth,
            left: `calc((100% - ${thumbWidth}) * ${metrics.progress})`,
          }}
          onPointerDown={(event) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { startX: event.clientX, startScroll: canvas.scrollLeft };
            setDragging(true);
          }}
          onPointerMove={(event) => {
            const canvas = canvasRef.current;
            if (!drag.current || !canvas) return;
            const max = canvas.scrollWidth - canvas.clientWidth;
            const { free } = freeTravel();
            canvas.scrollLeft =
              drag.current.startScroll + ((event.clientX - drag.current.startX) / free) * max;
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      </div>
    </div>
  );
}
